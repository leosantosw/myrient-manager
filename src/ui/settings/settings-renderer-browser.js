class SettingsRenderer {
  constructor() {
    this.elements = {};
    this.currentSettings = {};
  }

  async init() {
    this.cacheElements();
    this.setupEventListeners();
    await this.loadSettings();
  }

  cacheElements() {
    this.elements = {
      myrientUrl: document.getElementById('myrient-url'),
      downloadPath: document.getElementById('settings-download-path'),
      numConnections: document.getElementById('num-connections'),
      numConnectionsValue: document.getElementById('num-connections-value'),
      maxConcurrent: document.getElementById('max-concurrent'),
      maxConcurrentValue: document.getElementById('max-concurrent-value'),
      maxHistory: document.getElementById('max-history'),
      maxHistoryValue: document.getElementById('max-history-value'),
      
      testUrlBtn: document.getElementById('test-url-btn'),
      browsePathBtn: document.getElementById('browse-path-btn'),
      saveBtn: document.getElementById('save-settings-btn'),
      resetBtn: document.getElementById('reset-settings-btn'),
      clearHistoryBtn: document.getElementById('clear-history-btn'),
      
      status: document.getElementById('settings-status')
    };
  }

  setupEventListeners() {
    let autoSaveTimeout = null;
    
    const triggerAutoSave = () => {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        this.autoSaveSettings();
      }, 1000); 
    };

    this.elements.numConnections.addEventListener('input', (e) => {
      this.elements.numConnectionsValue.textContent = e.target.value;
      triggerAutoSave();
    });

    this.elements.maxConcurrent.addEventListener('input', (e) => {
      this.elements.maxConcurrentValue.textContent = e.target.value;
      triggerAutoSave();
    });

    this.elements.maxHistory.addEventListener('input', (e) => {
      this.elements.maxHistoryValue.textContent = e.target.value;
      triggerAutoSave();
    });

    this.elements.testUrlBtn.addEventListener('click', () => {
      this.testUrl();
    });

    this.elements.browsePathBtn.addEventListener('click', async () => {
      await this.browsePath();
    });

    this.elements.saveBtn.addEventListener('click', async () => {
      await this.saveSettings();
    });

    this.elements.resetBtn.addEventListener('click', async () => {
      await this.resetSettings();
    });

    this.elements.clearHistoryBtn.addEventListener('click', async () => {
      await this.clearHistory();
    });
  }

  async loadSettings() {
    try {
      const result = await window.electronAPI.settings.getSettings();
      
      if (result.success) {
        this.currentSettings = result.data;
        this.populateForm(this.currentSettings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      this.showStatus('Erro ao carregar configurações', 'error');
    }
  }

  populateForm(settings) {
    this.elements.myrientUrl.value = settings.myrientUrl || '';
    this.elements.downloadPath.value = settings.defaultDownloadPath || '';
    this.elements.numConnections.value = settings.numConnections || 100;
    this.elements.numConnectionsValue.textContent = settings.numConnections || 100;
    this.elements.maxConcurrent.value = settings.maxConcurrentDownloads || 1;
    this.elements.maxConcurrentValue.textContent = settings.maxConcurrentDownloads || 1;
    this.elements.maxHistory.value = settings.maxHistory || 100;
    this.elements.maxHistoryValue.textContent = settings.maxHistory || 100;
  }

  async testUrl() {
    const url = this.elements.myrientUrl.value.trim();
    
    if (!url) {
      this.showStatus('Por favor, insira uma URL', 'error');
      return;
    }

    this.elements.testUrlBtn.disabled = true;
    this.elements.testUrlBtn.textContent = 'Testando...';

    try {
      const result = await window.electronAPI.fetchFiles(url);
      
      if (result.success && result.data.length > 0) {
        const settings = {
          myrientUrl: url,
          defaultDownloadPath: this.elements.downloadPath.value,
          numConnections: parseInt(this.elements.numConnections.value),
          maxConcurrentDownloads: parseInt(this.elements.maxConcurrent.value),
          maxHistory: parseInt(this.elements.maxHistory.value)
        };
        
        const saveResult = await window.electronAPI.settings.updateSettings(settings);
        
        if (saveResult.success) {
          this.currentSettings = settings;
          
          window.dispatchEvent(new CustomEvent('settings-updated', { 
            detail: settings 
          }));
          
          this.showStatus(`✓ URL salva com sucesso! Encontrados ${result.data.length} arquivos`, 'success');
        } else {
          this.showStatus('Erro ao salvar URL', 'error');
        }
      } else {
        this.showStatus('URL não retornou arquivos válidos', 'error');
      }
    } catch (error) {
      this.showStatus('Erro ao testar URL: ' + error.message, 'error');
    } finally {
      this.elements.testUrlBtn.disabled = false;
      this.elements.testUrlBtn.textContent = 'Salvar';
    }
  }

  async browsePath() {
    try {
      const result = await window.electronAPI.downloads.chooseFolder();
      
      if (result.success && result.data) {
        this.elements.downloadPath.value = result.data;
        this.autoSaveSettings();
      }
    } catch (error) {
      console.error('Erro ao escolher pasta:', error);
      this.showStatus('Erro ao escolher pasta', 'error');
    }
  }

  async autoSaveSettings() {
    const settings = {
      myrientUrl: this.elements.myrientUrl.value.trim(),
      defaultDownloadPath: this.elements.downloadPath.value,
      numConnections: parseInt(this.elements.numConnections.value),
      maxConcurrentDownloads: parseInt(this.elements.maxConcurrent.value),
      maxHistory: parseInt(this.elements.maxHistory.value)
    };

    try {
      const result = await window.electronAPI.settings.updateSettings(settings);
      
      if (result.success) {
        this.currentSettings = settings;
        
        window.dispatchEvent(new CustomEvent('settings-updated', { 
          detail: settings 
        }));
        
        this.showStatus('Salvo automaticamente', 'success');
        
        setTimeout(() => {
          this.hideStatus();
        }, 2000);
      }
    } catch (error) {
      console.error('Erro no auto-save:', error);
    }
  }

  async saveSettings() {
    const settings = {
      myrientUrl: this.elements.myrientUrl.value.trim(),
      defaultDownloadPath: this.elements.downloadPath.value,
      numConnections: parseInt(this.elements.numConnections.value),
      maxConcurrentDownloads: parseInt(this.elements.maxConcurrent.value),
      maxHistory: parseInt(this.elements.maxHistory.value)
    };

    if (!settings.myrientUrl) {
      this.showStatus('URL do Myrient é obrigatória', 'error');
      return;
    }

    if (!settings.defaultDownloadPath) {
      this.showStatus('Pasta de downloads é obrigatória', 'error');
      return;
    }

    this.elements.saveBtn.disabled = true;
    this.elements.saveBtn.textContent = 'Salvando...';

    try {
      const result = await window.electronAPI.settings.updateSettings(settings);
      
      if (result.success) {
        this.currentSettings = settings;
        this.showStatus('✓ Configurações salvas com sucesso!', 'success');
        
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: settings }));
      } else {
        this.showStatus('Erro ao salvar configurações', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      this.showStatus('Erro ao salvar configurações', 'error');
    } finally {
      this.elements.saveBtn.disabled = false;
      this.elements.saveBtn.textContent = 'Salvar Configurações';
    }
  }

  async resetSettings() {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
      return;
    }

    try {
      const result = await window.electronAPI.settings.resetSettings();
      
      if (result.success) {
        this.currentSettings = result.data;
        this.populateForm(this.currentSettings);
        this.showStatus('✓ Configurações restauradas!', 'success');
      }
    } catch (error) {
      console.error('Erro ao restaurar configurações:', error);
      this.showStatus('Erro ao restaurar configurações', 'error');
    }
  }

  async clearHistory() {
    if (!confirm('Tem certeza que deseja limpar todo o histórico de downloads?')) {
      return;
    }

    this.elements.clearHistoryBtn.disabled = true;
    this.elements.clearHistoryBtn.textContent = 'Limpando...';

    try {
      const result = await window.electronAPI.settings.clearHistory();
      
      if (result.success) {
        const count = result.count || 0;
        this.showStatus(`✓ ${count} download(s) removido(s) do histórico!`, 'success');
      } else {
        this.showStatus('Erro ao limpar histórico', 'error');
      }
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      this.showStatus('Erro ao limpar histórico', 'error');
    } finally {
      this.elements.clearHistoryBtn.disabled = false;
      this.elements.clearHistoryBtn.textContent = 'Limpar Histórico de Downloads';
    }
  }

  showStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = `settings-status ${type}`;
    this.elements.status.classList.remove('hidden');

    setTimeout(() => {
      this.elements.status.classList.add('hidden');
    }, 5000);
  }

  hideStatus() {
    this.elements.status.classList.add('hidden');
  }
}

const settingsRenderer = new SettingsRenderer();
