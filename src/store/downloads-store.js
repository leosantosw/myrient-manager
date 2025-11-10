const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { DOWNLOAD_STATUS, DEFAULT_SETTINGS, LIMITS } = require('../utils/constants');

class DownloadsStore {
  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'downloads-store.json');
    this.data = {
      downloads: [],
      settings: { ...DEFAULT_SETTINGS }
    };
  }

  async init() {
    try {
      await this.load();
      console.log('Downloads store inicializado');
    } catch (error) {
      console.log('Criando novo store de downloads');
      await this.save();
    }
  }

  async load() {
    const data = await fs.readFile(this.storePath, 'utf-8');
    this.data = JSON.parse(data);

    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
  }

  async save() {
    await fs.writeFile(this.storePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async addDownload(download) {
    this.data.downloads.unshift(download);

    if (this.data.downloads.length > LIMITS.MAX_HISTORY) {
      this.data.downloads = this.data.downloads.slice(0, LIMITS.MAX_HISTORY);
    }
    
    await this.save();
  }

  async updateDownload(id, updates) {
    const index = this.data.downloads.findIndex(d => d.id === id);
    
    if (index !== -1) {
      this.data.downloads[index] = {
        ...this.data.downloads[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await this.save();
    }
  }

  async removeDownload(id) {
    this.data.downloads = this.data.downloads.filter(d => d.id !== id);
    await this.save();
  }

  getDownload(id) {
    return this.data.downloads.find(d => d.id === id);
  }

  getAllDownloads() {
    return [...this.data.downloads];
  }

  getDownloadsByStatus(status) {
    return this.data.downloads.filter(d => d.status === status);
  }

  getActiveDownloads() {
    return this.data.downloads.filter(d => 
      d.status === DOWNLOAD_STATUS.IN_PROGRESS || 
      d.status === DOWNLOAD_STATUS.PAUSED
    );
  }

  async updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    await this.save();
  }

  getSettings() {
    return { ...this.data.settings };
  }

  async cleanOldDownloads(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    this.data.downloads = this.data.downloads.filter(d => {
      if (d.status === DOWNLOAD_STATUS.IN_PROGRESS || d.status === DOWNLOAD_STATUS.PAUSED) {
        return true; 
      }
      
      const downloadDate = new Date(d.completedAt || d.createdAt);
      return downloadDate > cutoffDate;
    });

    await this.save();
  }
}

module.exports = DownloadsStore;
