const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fetchFilesList } = require('./src/scraper');
const DownloadManager = require('./src/modules/downloads/download-manager');
const { registerDownloadHandlers } = require('./src/modules/downloads/download-handlers');
const { registerSettingsHandlers } = require('./src/modules/settings/settings-handlers');

let mainWindow;
let downloadManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

/**
 * Handler IPC para buscar lista de arquivos
 */
ipcMain.handle('fetch-files', async (event, url) => {
  try {
    const files = await fetchFilesList(url);
    return { success: true, data: files };
  } catch (error) {
    console.error('Erro no IPC handler:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

app.whenReady().then(async () => {
  createWindow();
  downloadManager = new DownloadManager();
  await downloadManager.init(mainWindow);
  registerDownloadHandlers(downloadManager);
  registerSettingsHandlers(downloadManager);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
