const { session, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const extract = require('extract-zip');
const DownloadItem = require('./download-item');
const DownloadsStore = require('../../store/downloads-store');
const ParallelDownloader = require('./parallel-downloader');
const { isValidUrl, sanitizeFilename, extractFilenameFromUrl } = require('../../utils/validators');
const { DOWNLOAD_STATUS, LIMITS } = require('../../utils/constants');

class DownloadManager {
  constructor() {
    this.downloads = new Map();
    this.store = new DownloadsStore();
    this.mainWindow = null;
    this.updateIntervals = new Map();
    this.parallelDownloaders = new Map();
    this.useParallelDownload = true;
    this.downloadQueue = [];
    this.activeDownloads = [];
  }

  async init(mainWindow) {
    this.mainWindow = mainWindow;
    await this.store.init();
    const savedDownloads = this.store.getAllDownloads();
    savedDownloads.forEach(data => {
      const item = new DownloadItem(data.url, data.filename, data.savePath);
      Object.assign(item, data);
      this.downloads.set(item.id, item);
    });
    this.setupDownloadListener();
  }

  setupDownloadListener() {
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const downloadItem = Array.from(this.downloads.values())
        .find(d => d.status === DOWNLOAD_STATUS.PENDING && !d.electronItem);

      if (!downloadItem) return;

      downloadItem.electronItem = item;
      item.setSavePath(downloadItem.savePath);
      item.once('done', (event, state) => {
        this.handleDownloadDone(downloadItem.id, state);
      });
      item.on('updated', (event, state) => {
        if (state === 'progressing') {
          this.handleDownloadProgress(downloadItem.id, item);
        }
      });

      downloadItem.start();
      this.notifyRenderer('download-started', downloadItem.toJSON());
      this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
    });
  }

  async startDownload(url, filename) {
    if (!isValidUrl(url)) {
      throw new Error('URL inválida');
    }

    if (!filename) {
      filename = extractFilenameFromUrl(url);
    }

    filename = sanitizeFilename(filename);
    const downloadPath = await this.getDownloadPath();
    const savePath = path.join(downloadPath, filename);
    const downloadItem = new DownloadItem(url, filename, savePath);
    this.downloads.set(downloadItem.id, downloadItem);
    await this.store.addDownload(downloadItem.toJSON());
    this.addToQueue(downloadItem.id);

    return downloadItem.toJSON();
  }

  addToQueue(downloadId) {
    const downloadItem = this.downloads.get(downloadId);
    if (!downloadItem) return;
    
    const settings = this.store.getSettings();
    const maxConcurrent = settings.maxConcurrentDownloads || 1;
    
    if (this.activeDownloads.length < maxConcurrent) {
      this.startNextInQueue(downloadId);
    } else {
      this.downloadQueue.push(downloadId);
      downloadItem.status = DOWNLOAD_STATUS.PENDING;
      this.notifyRenderer('download-queued', downloadItem.toJSON());
      this.store.updateDownload(downloadId, downloadItem.toJSON());
    }
  }

  async startNextInQueue(downloadId = null) {
    const settings = this.store.getSettings();
    const maxConcurrent = settings.maxConcurrentDownloads || 1;
    
    if (downloadId) {
      this.activeDownloads.push(downloadId);
      const downloadItem = this.downloads.get(downloadId);
      if (!downloadItem) {
        this.activeDownloads = this.activeDownloads.filter(id => id !== downloadId);
        return;
      }
      
      if (this.useParallelDownload) {
        this.startParallelDownload(downloadItem);
      } else {
        this.mainWindow.webContents.downloadURL(downloadItem.url);
      }
    } else {
      while (this.activeDownloads.length < maxConcurrent && this.downloadQueue.length > 0) {
        const nextId = this.downloadQueue.shift();
        this.activeDownloads.push(nextId);
        
        const downloadItem = this.downloads.get(nextId);
        if (!downloadItem) {
          this.activeDownloads = this.activeDownloads.filter(id => id !== nextId);
          continue;
        }
        
        if (this.useParallelDownload) {
          this.startParallelDownload(downloadItem);
        } else {
          this.mainWindow.webContents.downloadURL(downloadItem.url);
        }
      }
    }
  }

  async startParallelDownload(downloadItem) {
    let lastNotification = Date.now();
    const notificationThrottle = 500;
    const settings = this.store.getSettings();
    
    const downloader = new ParallelDownloader(downloadItem.url, downloadItem.savePath, {
      numConnections: settings.numConnections || 100,
      
      onProgress: (data) => {
        downloadItem.updateProgress(data.downloadedSize, data.totalSize);
        const now = Date.now();
        if (now - lastNotification >= notificationThrottle) {
          this.notifyRenderer('download-progress', downloadItem.toJSON());
          lastNotification = now;
        }
        if (now - lastNotification >= 2000) {
          this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
        }
      },
      
      onComplete: async () => {
        downloadItem.complete();
        this.notifyRenderer('download-completed', downloadItem.toJSON());
        this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
        this.parallelDownloaders.delete(downloadItem.id);

        await this.handleZipExtraction(downloadItem);

        this.activeDownloads = this.activeDownloads.filter(id => id !== downloadItem.id);
        setImmediate(() => this.startNextInQueue());
      },
      
      onError: (error) => {
        downloadItem.setError(error.message);
        this.notifyRenderer('download-error', downloadItem.toJSON());
        this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
        this.parallelDownloaders.delete(downloadItem.id);
        
        this.activeDownloads = this.activeDownloads.filter(id => id !== downloadItem.id);
        setImmediate(() => this.startNextInQueue());
      }
    });

    this.parallelDownloaders.set(downloadItem.id, downloader);
    downloadItem.start();
    this.notifyRenderer('download-started', downloadItem.toJSON());
    
    downloader.start().catch(error => {
      console.error('Erro no download paralelo:', error);
      if (this.downloads.has(downloadItem.id) && this.activeDownloads.includes(downloadItem.id)) {
        downloadItem.setError(error.message);
        this.notifyRenderer('download-error', downloadItem.toJSON());
        this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
        this.parallelDownloaders.delete(downloadItem.id);
        this.activeDownloads = this.activeDownloads.filter(id => id !== downloadItem.id);
        setImmediate(() => this.startNextInQueue());
      }
    });
  }

  async cancelDownload(id) {
    const downloadItem = this.downloads.get(id);
    if (!downloadItem) {
      throw new Error('Download não encontrado');
    }
    
    const queueIndex = this.downloadQueue.indexOf(id);
    if (queueIndex > -1) {
      this.downloadQueue.splice(queueIndex, 1);
    }
    
    this.activeDownloads = this.activeDownloads.filter(activeId => activeId !== id);
    
    const parallelDownloader = this.parallelDownloaders.get(id);
    if (parallelDownloader) {
      parallelDownloader.cancel();
      this.parallelDownloaders.delete(id);
    }
    
    if (downloadItem.electronItem) {
      downloadItem.electronItem.cancel();
    }

    this.downloads.delete(id);
    await this.store.removeDownload(id);
    this.notifyRenderer('download-removed', { id });
    
    setImmediate(() => this.startNextInQueue());
  }

  async removeDownload(id) {
    this.downloads.delete(id);
    await this.store.removeDownload(id);
    this.notifyRenderer('download-removed', { id });
  }

  handleDownloadProgress(id, electronItem) {
    const downloadItem = this.downloads.get(id);
    if (!downloadItem) return;

    const receivedBytes = electronItem.getReceivedBytes();
    const totalBytes = electronItem.getTotalBytes();

    downloadItem.updateProgress(receivedBytes, totalBytes);
    if (!this.updateIntervals.has(id)) {
      this.updateIntervals.set(id, setInterval(() => {
        this.notifyRenderer('download-progress', downloadItem.toJSON());
        this.store.updateDownload(id, downloadItem.toJSON());
      }, LIMITS.PROGRESS_UPDATE_INTERVAL));
    }
  }

  async handleDownloadDone(id, state) {
    const downloadItem = this.downloads.get(id);
    if (!downloadItem) return;
    if (this.updateIntervals.has(id)) {
      clearInterval(this.updateIntervals.get(id));
      this.updateIntervals.delete(id);
    }

    if (state === 'completed') {
      downloadItem.complete();
      this.notifyRenderer('download-completed', downloadItem.toJSON());
      
      // Se for um arquivo ZIP e a extração automática estiver habilitada, processar extração
      const settings = this.store.getSettings();
      if (settings.autoExtract && downloadItem.savePath.toLowerCase().endsWith('.zip')) {
        await this.handleZipExtraction(downloadItem);
      } else {
        const newPath = await this.moveToHD(downloadItem.savePath, downloadItem);
        if (newPath) {
          downloadItem.savePath = newPath;
          this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
        }
      }
    } else if (state === 'cancelled') {
      downloadItem.cancel();
      this.notifyRenderer('download-cancelled', downloadItem.toJSON());
    } else if (state === 'interrupted') {
      downloadItem.setError('Download interrompido');
      this.notifyRenderer('download-error', downloadItem.toJSON());
    }

    this.store.updateDownload(id, downloadItem.toJSON());
  }

  async handleZipExtraction(downloadItem) {
    try {
      const settings = this.store.getSettings();
      
      // Verificar se a extração automática está habilitada
      if (!settings.autoExtract) {
        return;
      }

      // Verificar se o arquivo termina em .zip
      if (!downloadItem.savePath.toLowerCase().endsWith('.zip')) {
        return;
      }

      // Verificar se o arquivo existe
      try {
        await fs.access(downloadItem.savePath);
      } catch {
        console.log('Arquivo não encontrado para extração:', downloadItem.savePath);
        return;
      }

      // Atualizar status para "Extraindo..."
      downloadItem.setExtracting();
      this.notifyRenderer('download-progress', downloadItem.toJSON());
      this.store.updateDownload(downloadItem.id, downloadItem.toJSON());

      // Criar diretório de destino (mesmo nome do arquivo sem a extensão .zip)
      const extractDir = downloadItem.savePath.replace(/\.zip$/i, '');
      
      try {
        await fs.mkdir(extractDir, { recursive: true });
      } catch (error) {
        console.error('Erro ao criar diretório de extração:', error);
        // Voltar para completed mesmo em caso de erro
        downloadItem.complete();
        this.notifyRenderer('download-progress', downloadItem.toJSON());
        this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
        return;
      }

      // Extrair o arquivo ZIP
      console.log(`Extraindo ${downloadItem.filename} para ${extractDir}...`);
      await extract(downloadItem.savePath, { dir: extractDir });
      console.log(`Extração concluída: ${downloadItem.filename}`);
      
      // Verificar e converter arquivos ISO se necessário
      await this.handleISOConversion(extractDir, downloadItem);
      
      // Deletar o arquivo ZIP original após extração bem-sucedida
      try {
        await fs.unlink(downloadItem.savePath);
        console.log(`Arquivo ZIP deletado: ${downloadItem.filename}`);
      } catch (error) {
        console.error('Erro ao deletar arquivo ZIP:', error);
      }
      
      const newPath = await this.moveToHD(extractDir, downloadItem);
      if (newPath) {
        downloadItem.savePath = newPath;
      }
      
      downloadItem.complete();
      this.notifyRenderer('download-completed', downloadItem.toJSON());
      this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
      
    } catch (error) {
      console.error('Erro ao extrair arquivo ZIP:', error);
      // Voltar para completed mesmo em caso de erro
      downloadItem.complete();
      this.notifyRenderer('download-completed', downloadItem.toJSON());
      this.store.updateDownload(downloadItem.id, downloadItem.toJSON());
    }
  }

  async findISOFiles(dir) {
    const isoFiles = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Buscar recursivamente em subdiretórios
          const subDirISOs = await this.findISOFiles(fullPath);
          isoFiles.push(...subDirISOs);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.iso')) {
          isoFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar arquivos ISO:', error);
    }
    
    return isoFiles;
  }

  async convertISOToXEX(isoPath, downloadItem) {
    return new Promise((resolve, reject) => {
      try {
        // Criar diretório destino (mesmo nome do ISO sem extensão)
        const isoDir = path.dirname(isoPath);
        const isoName = path.basename(isoPath, path.extname(isoPath));
        const outputDir = path.join(isoDir, isoName);
        
        fs.mkdir(outputDir, { recursive: true }).then(() => {
          const exisoPath = path.join(app.getAppPath(), 'src', 'tools', 'exiso.exe');
          
          console.log(`Convertendo ISO: ${isoPath} para ${outputDir}...`);
          
          const exisoProcess = spawn(exisoPath, ['-d', outputDir, isoPath], {
            cwd: path.dirname(exisoPath),
            stdio: 'pipe'
          });
          
          let stdout = '';
          let stderr = '';
          
          exisoProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          exisoProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          exisoProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`Conversão concluída: ${path.basename(isoPath)}`);
              resolve(outputDir);
            } else {
              console.error(`Erro na conversão (código ${code}): ${stderr}`);
              reject(new Error(`Conversão falhou com código ${code}: ${stderr}`));
            }
          });
          
          exisoProcess.on('error', (error) => {
            console.error('Erro ao executar exiso.exe:', error);
            reject(error);
          });
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async handleISOConversion(extractDir, downloadItem) {
    try {
      const settings = this.store.getSettings();
      
      if (!settings.autoConvertISO) {
        return;
      }

      const isoFiles = await this.findISOFiles(extractDir);
      
      if (isoFiles.length === 0) {
        console.log('Nenhum arquivo ISO encontrado para conversão');
        return;
      }

      console.log(`Encontrados ${isoFiles.length} arquivo(s) ISO para conversão`);

      downloadItem.setConvertingIsoToXex();
      this.notifyRenderer('download-progress', downloadItem.toJSON());
      this.store.updateDownload(downloadItem.id, downloadItem.toJSON());

      for (const isoPath of isoFiles) {
        try {
          await this.convertISOToXEX(isoPath, downloadItem);
          
          try {
            await fs.unlink(isoPath);
            console.log(`Arquivo ISO deletado: ${path.basename(isoPath)}`);
          } catch (error) {
            console.error('Erro ao deletar arquivo ISO:', error);
          }
        } catch (error) {
          console.error(`Erro ao converter ISO ${path.basename(isoPath)}:`, error);
        }
      }

      console.log('Conversão de ISOs concluída');
      
    } catch (error) {
      console.error('Erro ao processar conversão de ISOs:', error);
    }
  }

  async moveToHD(sourcePath, downloadItem) {
    try {
      const settings = this.store.getSettings();
      
      if (!settings.moveToHD || !settings.hdPath) {
        return;
      }

      try {
        await fs.access(sourcePath);
      } catch {
        console.log('Arquivo não encontrado para mover para HD:', sourcePath);
        return;
      }

      const sourceStats = await fs.stat(sourcePath);
      const sourceName = path.basename(sourcePath);
      const targetPath = path.join(settings.hdPath, sourceName);

      downloadItem.setMovingToHD();
      this.notifyRenderer('download-progress', downloadItem.toJSON());
      this.store.updateDownload(downloadItem.id, downloadItem.toJSON());

      try {
        await fs.rename(sourcePath, targetPath);
        downloadItem.wasMovedToHD = true;
        return targetPath;
      } catch (error) {
        console.error(`Erro ao mover arquivo para HD: ${error.message}`);
        
        if (error.code === 'EXDEV') {
          if (sourceStats.isDirectory()) {
            await this.copyDirectory(sourcePath, targetPath);
            await fs.rm(sourcePath, { recursive: true, force: true });
          } else {
            await fs.copyFile(sourcePath, targetPath);
            await fs.unlink(sourcePath);
          }
          
          downloadItem.wasMovedToHD = true;
          return targetPath;
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Erro ao mover arquivo para HD:', error);
      return null;
    }
  }

  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const tgtPath = path.join(target, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, tgtPath);
      } else {
        await fs.copyFile(srcPath, tgtPath);
      }
    }
  }

  getAllDownloads() {
    return Array.from(this.downloads.values()).map(d => d.toJSON());
  }

  async openDownloadFolder(filePath) {
    const pathExists = async (targetPath) => {
      if (!targetPath) return false;
      try {
        await fs.access(targetPath);
        return true;
      } catch {
        return false;
      }
    };

    if (filePath) {
      if (await pathExists(filePath)) {
        shell.showItemInFolder(filePath);
        return;
      }

      const extractedDir = filePath.replace(/\.zip$/i, '');
      if (extractedDir !== filePath && (await pathExists(extractedDir))) {
        shell.openPath(extractedDir);
        return;
      }

      const parentDir = path.dirname(filePath);
      if (await pathExists(parentDir)) {
        shell.openPath(parentDir);
        return;
      }
    }

    const downloadPath = await this.getDownloadPath();
    shell.openPath(downloadPath);
  }

  async chooseDownloadFolder() {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openDirectory'],
      title: 'Escolher pasta de downloads'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      await this.store.updateSettings({ defaultDownloadPath: selectedPath });
      return selectedPath;
    }

    return null;
  }

  async getDownloadPath() {
    const settings = this.store.getSettings();
    let downloadPath = settings.defaultDownloadPath;

    if (!downloadPath) {
      downloadPath = path.join(app.getPath('userData'), 'downloads');
      await this.store.updateSettings({ defaultDownloadPath: downloadPath });
    }
    try {
      await fs.access(downloadPath);
    } catch {
      await fs.mkdir(downloadPath, { recursive: true });
    }

    return downloadPath;
  }

  notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

module.exports = DownloadManager;
