const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream, createReadStream } = require('fs');

class ParallelDownloader {
  constructor(url, savePath, options = {}) {
    this.url = url;
    this.savePath = savePath;
    const filename = path.basename(savePath, path.extname(savePath));
    const timestamp = Date.now();
    this.tempDir = path.join(path.dirname(savePath), '.temp', `${filename}_${timestamp}`);
    this.numConnections = options.numConnections || 100;
    this.chunkSize = 10 * 1024 * 1024;
    this.totalSize = 0;
    this.downloadedSize = 0;
    this.chunks = [];
    this.activeDownloads = new Map();
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.lastUpdateTime = Date.now();
    this.lastDownloadedSize = 0;
    this.speedHistory = [];
    this.maxSpeedSamples = 10;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  async start() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const supportsRange = await this.checkRangeSupport();
      
      if (!supportsRange) {
        return await this.downloadNormal();
      }
      this.totalSize = await this.getFileSize();
      this.createChunks();
      await this.downloadChunks();
      
      if (this.isCancelled) {
        await this.cleanup();
        return;
      }
      
      await this.mergeChunks();
      await this.cleanup();
      
      this.onComplete();
      
    } catch (error) {
      if (this.isCancelled) {
        console.log('Download cancelado:', this.savePath);
        await this.cleanup();
        return;
      }
      
      console.error('Erro no download paralelo:', error);
      await this.cleanup();
      this.onError(error);
      throw error;
    }
  }

  async checkRangeSupport() {
    try {
      const response = await fetch(this.url, { method: 'HEAD' });
      return response.headers.get('accept-ranges') === 'bytes';
    } catch (error) {
      console.error('Erro ao verificar Range support:', error);
      return false;
    }
  }

  async getFileSize() {
    const response = await fetch(this.url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return parseInt(contentLength, 10);
  }

  createChunks() {
    const chunkSize = Math.ceil(this.totalSize / this.numConnections);
    
    for (let i = 0; i < this.numConnections; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize - 1, this.totalSize - 1);
      
      this.chunks.push({
        id: i,
        start,
        end,
        size: end - start + 1,
        downloaded: 0,
        path: path.join(this.tempDir, `chunk_${i}.part`)
      });
    }
  }

  async downloadChunks() {
    const promises = this.chunks.map(chunk => this.downloadChunk(chunk));
    await Promise.all(promises);
  }

  async downloadChunk(chunk) {
    if (this.isCancelled) return;

    try {
      const response = await fetch(this.url, {
        headers: {
          'Range': `bytes=${chunk.start}-${chunk.end}`,
          'Connection': 'keep-alive'
        },
        timeout: 60000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const fileStream = createWriteStream(chunk.path, {
        highWaterMark: 1024 * 1024
      });
      
      let downloaded = 0;
      let lastUpdate = Date.now();
      const updateInterval = 250;
      
      response.body.on('data', (data) => {
        if (this.isPaused || this.isCancelled) {
          response.body.destroy();
          fileStream.destroy();
          return;
        }
        
        downloaded += data.length;
        chunk.downloaded = downloaded;
        const now = Date.now();
        if (now - lastUpdate >= updateInterval) {
          this.updateProgress();
          lastUpdate = now;
        }
      });

      await pipeline(response.body, fileStream);
      this.updateProgress();
      
    } catch (error) {
      console.error(`Erro ao baixar chunk ${chunk.id}:`, error);
      throw error;
    }
  }

  updateProgress() {
    this.downloadedSize = this.chunks.reduce((sum, chunk) => sum + chunk.downloaded, 0);
    const progress = (this.downloadedSize / this.totalSize) * 100;
    const speed = this.calculateSpeed();
    
    this.onProgress({
      totalSize: this.totalSize,
      downloadedSize: this.downloadedSize,
      progress: progress,
      speed: speed
    });
  }

  calculateSpeed() {
    const now = Date.now();
    const timeDiff = (now - this.lastUpdateTime) / 1000;
    
    if (timeDiff < 0.1) return this.getAverageSpeed();
    
    const bytesDiff = this.downloadedSize - this.lastDownloadedSize;
    const currentSpeed = bytesDiff / timeDiff;
    this.speedHistory.push(currentSpeed);
    if (this.speedHistory.length > this.maxSpeedSamples) {
      this.speedHistory.shift();
    }
    this.lastUpdateTime = now;
    this.lastDownloadedSize = this.downloadedSize;
    
    return this.getAverageSpeed();
  }

  getAverageSpeed() {
    if (this.speedHistory.length === 0) return 0;
    
    const sum = this.speedHistory.reduce((a, b) => a + b, 0);
    return sum / this.speedHistory.length;
  }

  async mergeChunks() {
    const writeStream = createWriteStream(this.savePath);
    
    writeStream.setMaxListeners(this.chunks.length + 5);

    try {
      for (const chunk of this.chunks) {
        if (this.isCancelled) {
          writeStream.destroy();
          return;
        }

        await new Promise((resolve, reject) => {
          const readStream = createReadStream(chunk.path);
          
          readStream.on('data', (data) => {
            if (!writeStream.write(data)) {
              readStream.pause();
              writeStream.once('drain', () => readStream.resume());
            }
          });
          
          readStream.on('end', resolve);
          readStream.on('error', reject);
        });
      }

      writeStream.end();
      
      return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  async downloadNormal() {
    const response = await fetch(this.url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    this.totalSize = parseInt(response.headers.get('content-length'), 10);
    
    const fileStream = createWriteStream(this.savePath);
    
    response.body.on('data', (data) => {
      if (this.isPaused || this.isCancelled) {
        response.body.destroy();
        return;
      }
      
      this.downloadedSize += data.length;
      this.updateProgress();
    });

    await pipeline(response.body, fileStream);
    this.onComplete();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  cancel() {
    this.isCancelled = true;
    this.cleanup();
  }

  async cleanup() {
    try {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      } catch (e) {
        for (const chunk of this.chunks) {
          try {
            await fs.unlink(chunk.path);
          } catch (err) {}
        }
        
        try {
          await fs.rmdir(this.tempDir);
        } catch (err) {}
      }
    } catch (error) {
      console.error('Erro ao limpar arquivos temporários:', error);
    }
  }
}

module.exports = ParallelDownloader;
