const { ipcMain } = require('electron');
const { DEFAULT_SETTINGS } = require('../../utils/constants');

function registerSettingsHandlers(downloadManager) {
  ipcMain.handle('get-settings', async () => {
    try {
      const settings = downloadManager.store.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      console.error('Erro ao obter configurações:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-settings', async (event, settings) => {
    try {
      await downloadManager.store.updateSettings(settings);
      
      if (settings.numConnections !== undefined) {
        downloadManager.numConnections = settings.numConnections;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reset-settings', async () => {
    try {
      await downloadManager.store.updateSettings(DEFAULT_SETTINGS);
      const settings = downloadManager.store.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      console.error('Erro ao restaurar configurações:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-history', async () => {
    try {
      const allDownloads = downloadManager.store.getAllDownloads();
      const toRemove = allDownloads.filter(d => 
        d.status === 'completed' || 
        d.status === 'cancelled' || 
        d.status === 'error'
      );
      
      for (const download of toRemove) {
        await downloadManager.removeDownload(download.id);
      }
      
      return { success: true, count: toRemove.length };
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerSettingsHandlers };
