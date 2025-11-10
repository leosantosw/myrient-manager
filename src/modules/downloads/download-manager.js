const { session, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
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

        // Verificar se deve extrair arquivos .zip
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
      
      // Verificar se deve extrair arquivos .zip
      await this.handleZipExtraction(downloadItem);
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
      
      // Deletar o arquivo ZIP original após extração bem-sucedida
      try {
        await fs.unlink(downloadItem.savePath);
        console.log(`Arquivo ZIP deletado: ${downloadItem.filename}`);
      } catch (error) {
        console.error('Erro ao deletar arquivo ZIP:', error);
        // Não interrompe o fluxo, apenas loga o erro
      }
      
      // Voltar para completed após extração
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

  getAllDownloads() {
    return Array.from(this.downloads.values()).map(d => d.toJSON());
  }

  async openDownloadFolder(filePath) {
    if (filePath) {
      shell.showItemInFolder(filePath);
    } else {
      const downloadPath = await this.getDownloadPath();
      shell.openPath(downloadPath);
    }
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
