const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expõe API segura para o renderer process
 * Usa contextBridge para isolar contextos e evitar vulnerabilidades
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Busca lista de arquivos do Myrient
   * @param {string} url - URL para fazer scraping
   * @returns {Promise<Object>} Objeto com {success, data, error}
   */
  fetchFiles: (url) => ipcRenderer.invoke('fetch-files', url),

  /**
   * API de Downloads
   */
  downloads: {
    // Ações
    start: (url, filename) => ipcRenderer.invoke('start-download', { url, filename }),
    pause: (id) => ipcRenderer.invoke('pause-download', { id }),
    resume: (id) => ipcRenderer.invoke('resume-download', { id }),
    cancel: (id) => ipcRenderer.invoke('cancel-download', { id }),
    remove: (id) => ipcRenderer.invoke('remove-download', { id }),
    getAll: () => ipcRenderer.invoke('get-downloads'),
    
    // Pasta
    openFolder: (filePath) => ipcRenderer.invoke('open-download-folder', { filePath }),
    chooseFolder: () => ipcRenderer.invoke('choose-download-folder'),
    getDownloadPath: () => ipcRenderer.invoke('get-download-path'),

    // Eventos (listeners)
    onProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    onStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
    onQueued: (callback) => ipcRenderer.on('download-queued', (event, data) => callback(data)),
    onCompleted: (callback) => ipcRenderer.on('download-completed', (event, data) => callback(data)),
    onPaused: (callback) => ipcRenderer.on('download-paused', (event, data) => callback(data)),
    onResumed: (callback) => ipcRenderer.on('download-resumed', (event, data) => callback(data)),
    onCancelled: (callback) => ipcRenderer.on('download-cancelled', (event, data) => callback(data)),
    onError: (callback) => ipcRenderer.on('download-error', (event, data) => callback(data)),
    onRemoved: (callback) => ipcRenderer.on('download-removed', (event, data) => callback(data))
  },

  /**
   * API de Configurações
   */
  settings: {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
    resetSettings: () => ipcRenderer.invoke('reset-settings'),
    clearHistory: () => ipcRenderer.invoke('clear-history')
  }
});
