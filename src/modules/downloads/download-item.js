const { v4: uuidv4 } = require('uuid');
const { DOWNLOAD_STATUS } = require('../../utils/constants');
const { calculateProgress, calculateSpeed, calculateETA, calculateAverageSpeed } = require('../../utils/calculators');

class DownloadItem {
  constructor(url, filename, savePath) {
    this.id = uuidv4();
    this.url = url;
    this.filename = filename;
    this.savePath = savePath;
    this.status = DOWNLOAD_STATUS.PENDING;
    this.totalBytes = 0;
    this.receivedBytes = 0;
    this.progress = 0;
    this.speed = 0;
    this.speedHistory = [];
    this.eta = 0;
    this.error = null;
    this.createdAt = new Date().toISOString();
    this.startedAt = null;
    this.completedAt = null;
    this.updatedAt = new Date().toISOString();

    this.electronItem = null;

    this.lastReceivedBytes = 0;
    this.lastUpdateTime = Date.now();
  }

  updateProgress(receivedBytes, totalBytes) {
    const now = Date.now();
    const interval = now - this.lastUpdateTime;

    this.receivedBytes = receivedBytes;
    this.totalBytes = totalBytes;
    this.progress = calculateProgress(receivedBytes, totalBytes);

    if (interval > 0) {
      const currentSpeed = calculateSpeed(receivedBytes, this.lastReceivedBytes, interval);
      this.speedHistory.push(currentSpeed);
      this.speed = calculateAverageSpeed(this.speedHistory);

      const remainingBytes = totalBytes - receivedBytes;
      this.eta = calculateETA(remainingBytes, this.speed);
    }

    this.lastReceivedBytes = receivedBytes;
    this.lastUpdateTime = now;
    this.updatedAt = new Date().toISOString();
  }

  start() {
    this.status = DOWNLOAD_STATUS.IN_PROGRESS;
    this.startedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  pause() {
    this.status = DOWNLOAD_STATUS.PAUSED;
    this.speed = 0;
    this.eta = 0;
    this.updatedAt = new Date().toISOString();
  }

  resume() {
    this.status = DOWNLOAD_STATUS.IN_PROGRESS;
    this.updatedAt = new Date().toISOString();
  }

  complete() {
    this.status = DOWNLOAD_STATUS.COMPLETED;
    this.progress = 100;
    this.speed = 0;
    this.eta = 0;
    this.completedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  setExtracting() {
    this.status = DOWNLOAD_STATUS.EXTRACTING;
    this.updatedAt = new Date().toISOString();
  }

  setConvertingIsoToXex() {
    this.status = DOWNLOAD_STATUS.CONVERTING_ISO_TO_XEX;
    this.updatedAt = new Date().toISOString();
  }

  cancel() {
    this.status = DOWNLOAD_STATUS.CANCELLED;
    this.speed = 0;
    this.eta = 0;
    this.updatedAt = new Date().toISOString();
  }

  setError(error) {
    this.status = DOWNLOAD_STATUS.ERROR;
    this.error = error;
    this.speed = 0;
    this.eta = 0;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      url: this.url,
      filename: this.filename,
      savePath: this.savePath,
      status: this.status,
      totalBytes: this.totalBytes,
      receivedBytes: this.receivedBytes,
      progress: this.progress,
      speed: this.speed,
      eta: this.eta,
      error: this.error,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = DownloadItem;
