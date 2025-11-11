class DownloadsRenderer {
  constructor() {
    this.downloads = [];
    this.downloadCards = new Map();
    this.currentFilter = 'all';
    this.confirmationStates = new Map(); 
    this.elements = {};
    this.downloadCards = new Map();
    this.currentDownloadPath = null;
    this.playedSoundForDownloads = new Set();
  }

  async init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupIPCListeners();
    this.setupSettingsListener();
    await this.loadDownloads();
  }

  cacheElements() {
    this.elements = {
      container: document.getElementById('downloads-list'),
      emptyState: document.getElementById('downloads-empty'),
      filterButtons: document.querySelectorAll('.download-filter'),
      downloadPath: document.getElementById('download-path'),
      changePathBtn: document.getElementById('change-path-btn'),
      openFolderBtn: document.getElementById('open-folder-btn'),
      counters: {
        all: document.getElementById('count-all'),
        active: document.getElementById('count-active'),
        completed: document.getElementById('count-completed'),
        errors: document.getElementById('count-errors')
      }
    };
  }

  setupEventListeners() {
    
    this.elements.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        this.setFilter(filter);
      });
    });

    if (this.elements.changePathBtn) {
      this.elements.changePathBtn.addEventListener('click', async () => {
        await this.chooseDownloadFolder();
      });
    }

    if (this.elements.openFolderBtn) {
      this.elements.openFolderBtn.addEventListener('click', async () => {
        await window.electronAPI.downloads.openFolder();
      });
    }

    this.elements.container.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const card = button.closest('.download-card');
      const id = card.dataset.id;
      const action = button.dataset.action;

      this.handleCardAction(id, action);
    });
  }

  setupIPCListeners() {
    window.electronAPI.downloads.onProgress((download) => {
      this.updateDownload(download);
    });

    window.electronAPI.downloads.onStarted((download) => {
      this.updateDownload(download);
    });

    window.electronAPI.downloads.onQueued((download) => {
      this.addDownload(download);
    });

    window.electronAPI.downloads.onCompleted((download) => {
      this.updateDownload(download);
      this.playNotificationSound(download.id);
    });

    window.electronAPI.downloads.onPaused((download) => {
      this.updateDownload(download);
    });

    window.electronAPI.downloads.onResumed((download) => {
      this.updateDownload(download);
    });

    window.electronAPI.downloads.onCancelled((download) => {
      this.updateDownload(download);
    });

    window.electronAPI.downloads.onError((download) => {
      this.updateDownload(download);
    });

    window.electronAPI.downloads.onRemoved(({ id }) => {
      this.removeDownload(id);
    });
  }

  setupSettingsListener() {
    window.addEventListener('settings-updated', (event) => {
      const { detail } = event;
      if (!detail) return;

      const newPath = detail.defaultDownloadPath;
      if (!newPath || newPath === this.currentDownloadPath) {
        return;
      }

      if (this.elements.downloadPath) {
        this.elements.downloadPath.textContent = newPath;
      }
      this.currentDownloadPath = newPath;
    });
  }

  async loadDownloads() {
    const result = await window.electronAPI.downloads.getAll();
    
    if (result.success) {
      this.downloads = result.data;
      this.render();
      this.updateCounts();
    }

    await this.loadDownloadPath();
  }

  playNotificationSound(downloadId) {
    if (this.playedSoundForDownloads.has(downloadId)) {
      return;
    }
    
    try {
      const audio = new Audio('./assets/smooth-notify-alert.mp3');
      audio.volume = 0.7; // Volume moderado
      audio.play().catch(error => {
        console.log('Erro ao reproduzir som de notificação:', error);
      });
      
      // Marcar que o som já foi tocado para este download
      this.playedSoundForDownloads.add(downloadId);
      
      // Limpar o registro após 5 segundos para evitar acúmulo de memória
      setTimeout(() => {
        this.playedSoundForDownloads.delete(downloadId);
      }, 5000);
      
    } catch (error) {
      console.log('Erro ao criar elemento de áudio:', error);
    }
  }

  async loadDownloadPath() {
    try {
      
      const result = await window.electronAPI.downloads.getDownloadPath();
      
      if (result.success && result.data && this.elements.downloadPath) {
        this.elements.downloadPath.textContent = result.data;
        this.currentDownloadPath = result.data;
      }
    } catch (error) {
      console.error('Erro ao carregar caminho:', error);
      if (this.elements.downloadPath) {
        this.elements.downloadPath.textContent = 'Erro ao carregar';
      }
    }
  }

  addDownload(download) {
    this.downloads.unshift(download);
    this.render();
    this.updateCounts();
  }

  updateDownload(download) {
    const index = this.downloads.findIndex(d => d.id === download.id);
    
    if (index !== -1) {
      this.downloads[index] = download;
      
      const card = this.downloadCards.get(download.id);
      if (card) {
        updateDownloadCard(card, download);
        
        if (this.confirmationStates.has(download.id)) {
          const cancelBtn = card.querySelector('.btn-cancel');
          if (cancelBtn) {
            cancelBtn.classList.add('confirm-cancel');
            cancelBtn.title = 'Clique novamente para apagar';
            cancelBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            `;
          }
        }
      }
      
      this.updateCounts();
    } else {
      this.addDownload(download);
    }
  }

  removeDownload(id) {
    this.downloads = this.downloads.filter(d => d.id !== id);
    this.downloadCards.delete(id);
    this.confirmationStates.delete(id); 
    this.render();
    this.updateCounts();
  }

  filterDownloads(downloads) {
    switch (this.currentFilter) {
      case 'active':
        return downloads.filter(d => 
          d.status === DOWNLOAD_STATUS.IN_PROGRESS || 
          d.status === DOWNLOAD_STATUS.PAUSED ||
          d.status === DOWNLOAD_STATUS.PENDING ||
          d.status === DOWNLOAD_STATUS.EXTRACTING ||
          d.status === DOWNLOAD_STATUS.CONVERTING_ISO_TO_XEX
        );
      
      case 'completed':
        return downloads.filter(d => d.status === DOWNLOAD_STATUS.COMPLETED);
      
      case 'errors':
        return downloads.filter(d => d.status === DOWNLOAD_STATUS.ERROR);
      
      case 'all':
      default:
        return downloads;
    }
  }

  render() {
    clearElement(this.elements.container);
    this.downloadCards.clear();

    const filtered = this.filterDownloads(this.downloads);

    if (filtered.length === 0) {
      toggleVisibility(this.elements.emptyState, true);
      toggleVisibility(this.elements.container, false);
      return;
    }

    toggleVisibility(this.elements.emptyState, false);
    toggleVisibility(this.elements.container, true);

    filtered.forEach(download => {
      const card = createDownloadCard(download);
      this.downloadCards.set(download.id, card);
      this.elements.container.appendChild(card);
    });
  }

  setFilter(filter) {
    this.currentFilter = filter;
    
    this.elements.filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    this.render();
  }

  updateCounts() {
    const counts = {
      all: this.downloads.length,
      active: this.downloads.filter(d => 
        d.status === DOWNLOAD_STATUS.IN_PROGRESS || 
        d.status === DOWNLOAD_STATUS.PAUSED ||
        d.status === DOWNLOAD_STATUS.PENDING ||
        d.status === DOWNLOAD_STATUS.EXTRACTING ||
        d.status === DOWNLOAD_STATUS.CONVERTING_ISO_TO_XEX
      ).length,
      completed: this.downloads.filter(d => d.status === DOWNLOAD_STATUS.COMPLETED).length,
      errors: this.downloads.filter(d => d.status === DOWNLOAD_STATUS.ERROR).length
    };
    
    if (this.elements.counters.all) {
      this.elements.counters.all.textContent = counts.all;
    }
    if (this.elements.counters.active) {
      this.elements.counters.active.textContent = counts.active;
    }
    if (this.elements.counters.completed) {
      this.elements.counters.completed.textContent = counts.completed;
    }
    if (this.elements.counters.errors) {
      this.elements.counters.errors.textContent = counts.errors;
    }

    if (typeof tabsManager !== 'undefined') {
      tabsManager.updateBadge('downloads', counts.active);
    }
  }

  async handleCardAction(id, action) {
    try {
      switch (action) {
        case 'cancel':
          const card = this.downloadCards.get(id);
          if (!card) break;
          
          const cancelBtn = card.querySelector('.btn-cancel');
          if (!cancelBtn) break;
          
          if (this.confirmationStates.has(id)) {
            this.confirmationStates.delete(id);
            await window.electronAPI.downloads.cancel(id);
          } else {
            this.confirmationStates.set(id, true);
            cancelBtn.classList.add('confirm-cancel');
            cancelBtn.title = 'Clique novamente para apagar';
            
            cancelBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            `;
            
            setTimeout(() => {
              if (this.confirmationStates.has(id)) {
                this.confirmationStates.delete(id);
                const currentCard = this.downloadCards.get(id);
                if (currentCard) {
                  const currentCancelBtn = currentCard.querySelector('.btn-cancel');
                  if (currentCancelBtn) {
                    currentCancelBtn.classList.remove('confirm-cancel');
                    currentCancelBtn.title = 'Cancelar';
                    currentCancelBtn.innerHTML = `
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    `;
                  }
                }
              }
            }, 3000);
          }
          break;
        case 'remove':
          await window.electronAPI.downloads.remove(id);
          break;
        case 'open-folder':
          const download = this.downloads.find(d => d.id === id);
          if (download) {
            await window.electronAPI.downloads.openFolder(download.savePath);
          }
          break;
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error);
    }
  }

  async chooseDownloadFolder() {
    const result = await window.electronAPI.downloads.chooseFolder();
    
    if (result.success && result.data) {
      if (this.elements.downloadPath) {
        this.elements.downloadPath.textContent = result.data;
      }
      this.currentDownloadPath = result.data;
    }
  }
}

const downloadsRenderer = new DownloadsRenderer();
