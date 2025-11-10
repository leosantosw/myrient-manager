const { ipcMain } = require('electron');

function registerDownloadHandlers(downloadManager) {
  ipcMain.handle('start-download', async (event, { url, filename }) => {
    try {
      const download = await downloadManager.startDownload(url, filename);
      return { success: true, data: download };
    } catch (error) {
      console.error('Erro ao iniciar download:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cancel-download', async (event, { id }) => {
    try {
      downloadManager.cancelDownload(id);
      return { success: true };
    } catch (error) {
      console.error('Erro ao cancelar download:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('remove-download', async (event, { id }) => {
    try {
      await downloadManager.removeDownload(id);
      return { success: true };
    } catch (error) {
      console.error('Erro ao remover download:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-downloads', async () => {
    try {
      const downloads = downloadManager.getAllDownloads();
      return { success: true, data: downloads };
    } catch (error) {
      console.error('Erro ao obter downloads:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-download-folder', async (event, { filePath } = {}) => {
    try {
      await downloadManager.openDownloadFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error('Erro ao abrir pasta:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('choose-download-folder', async () => {
    try {
      const path = await downloadManager.chooseDownloadFolder();
      return { success: true, data: path };
    } catch (error) {
      console.error('Erro ao escolher pasta:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-download-path', async () => {
    try {
      const path = await downloadManager.getDownloadPath();
      return { success: true, data: path };
    } catch (error) {
      console.error('Erro ao obter caminho:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerDownloadHandlers };
