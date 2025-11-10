
const state = {
  allFiles: [],
  filteredFiles: [],
  currentSort: { column: null, direction: 'asc' },
  isLoading: false,
  myrientUrl: null
}

const elements = {
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('error-message'),
  stats: document.getElementById('stats'),
  totalFiles: document.getElementById('total-files'),
  filteredCount: document.getElementById('filtered-count'),
  tableContainer: document.getElementById('table-container'),
  filesList: document.getElementById('files-list'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('search-input'),
  refreshBtn: document.getElementById('refresh-btn'),
  retryBtn: document.getElementById('retry-btn')
};

async function init() {
  await loadSettings();
  setupEventListeners();
  setupDownloadListeners();
  
  if (state.myrientUrl) {
    await loadFiles();
  } else {
    showInfo('Configure a URL do Myrient na aba Configurações para começar.');
  }
}

function setupDownloadListeners() {
  window.electronAPI.downloads.onCompleted(() => {
    if (state.filteredFiles.length > 0) {
      renderFiles();
    }
  });
  
  window.electronAPI.downloads.onStarted(() => {
    if (state.filteredFiles.length > 0) {
      renderFiles();
    }
  });
}

async function loadSettings() {
  try {
    const result = await window.electronAPI.settings.getSettings();
    if (result.success && result.data.myrientUrl) {
      state.myrientUrl = result.data.myrientUrl;
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
  }
}

window.addEventListener('settings-updated', async (event) => {
  if (event.detail.myrientUrl) {
    const oldUrl = state.myrientUrl;
    state.myrientUrl = event.detail.myrientUrl;
    
    if (oldUrl !== state.myrientUrl) {
      await loadFiles();
    }
  }
});

function setupEventListeners() {
  
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterFiles(e.target.value);
    }, 300);
  });

  elements.refreshBtn.addEventListener('click', () => {
    loadFiles();
  });

  elements.retryBtn.addEventListener('click', () => {
    loadFiles();
  });

  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      sortFiles(column);
    });
  });
}

async function loadFiles() {
  if (state.isLoading) return;

  if (!state.myrientUrl) {
    showInfo('Configure a URL do Myrient nas Configurações antes de carregar os arquivos.');
    return;
  }

  state.isLoading = true;
  showLoading();

  try {
    const result = await window.electronAPI.fetchFiles(state.myrientUrl);

    if (!result.success) {
      throw new Error(result.error);
    }

    state.allFiles = result.data;
    state.filteredFiles = [...state.allFiles];
    
    renderFiles();
    updateStats();
    showContent();
    
  } catch (error) {
    console.error('Erro ao carregar arquivos:', error);
    showError(error.message);
  } finally {
    state.isLoading = false;
  }
}

function filterFiles(query) {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    state.filteredFiles = [...state.allFiles];
  } else {
    state.filteredFiles = state.allFiles.filter(file =>
      file.name.toLowerCase().includes(lowerQuery)
    );
  }

  renderFiles();
  updateStats();
}

function sortFiles(column) {
  
  if (state.currentSort.column === column) {
    state.currentSort.direction = state.currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.currentSort.column = column;
    state.currentSort.direction = 'asc';
  }

  state.filteredFiles.sort((a, b) => {
    let aVal, bVal;

    if (column === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (column === 'size') {
      aVal = parseSizeToBytes(a.size);
      bVal = parseSizeToBytes(b.size);
    } else if (column === 'date') {
      aVal = new Date(a.date).getTime();
      bVal = new Date(b.date).getTime();
    }

    if (state.currentSort.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  updateSortIndicators();
  renderFiles();
}

function parseSizeToBytes(sizeStr) {
  const units = { B: 1, KiB: 1024, MiB: 1024**2, GiB: 1024**3, TiB: 1024**4 };
  const match = sizeStr.match(/^([\d.]+)\s*(\w+)$/);
  
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return value * (units[unit] || 1);
}

function updateSortIndicators() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    
    if (th.dataset.sort === state.currentSort.column) {
      th.classList.add(`sort-${state.currentSort.direction}`);
    }
  });
}

async function renderFiles() {
  elements.filesList.innerHTML = '';

  if (state.filteredFiles.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

  const downloadsResult = await window.electronAPI.downloads.getAll();
  const downloads = downloadsResult.success ? downloadsResult.data : [];

  state.filteredFiles.forEach(file => {
    const row = createFileRow(file, downloads);
    elements.filesList.appendChild(row);
  });
}

function createFileRow(file, downloads = []) {
  const tr = document.createElement('tr');
  
  const existingDownload = downloads.find(d => d.url === file.url);
  const isDownloaded = existingDownload && existingDownload.status === 'completed';
  const isDownloading = existingDownload && (existingDownload.status === 'in_progress' || existingDownload.status === 'pending');

  let downloadButton = '';
  if (isDownloaded) {
    downloadButton = `
      <span class="download-badge downloaded">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Baixado
      </span>
    `;
  } else if (isDownloading) {
    downloadButton = `
      <span class="download-badge downloading">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Baixando...
      </span>
    `;
  } else {
    downloadButton = `
      <button type="button" class="btn-download" data-url="${escapeHtml(file.url)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Baixar
      </button>
    `;
  }

  tr.innerHTML = `
    <td>
      <div class="file-name">
        ${escapeHtml(file.name)}
        ${isDownloaded ? '<span class="file-downloaded-icon" title="Arquivo já baixado">✓</span>' : ''}
      </div>
    </td>
    <td>
      <span class="file-size">${escapeHtml(file.size)}</span>
    </td>
    <td>
      <span class="file-date">${escapeHtml(file.date)}</span>
    </td>
    <td>
      ${downloadButton}
    </td>
  `;

  const downloadBtn = tr.querySelector('.btn-download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const scrollY = window.scrollY;
      handleDownload(file.url).then(() => {
        window.scrollTo(0, scrollY);
      });
    }, { passive: false });
  }

  return tr;
}

async function handleDownload(url) {
  try {
    
    const filename = decodeURIComponent(url.split('/').pop());

    const result = await window.electronAPI.downloads.start(url, filename);
    
    if (result.success) {
      console.log('Download iniciado:', filename);
      await renderFiles();
    } else {
      console.error('Erro ao iniciar download:', result.error);
      alert('Erro ao iniciar download: ' + result.error);
    }
  } catch (error) {
    console.error('Erro ao iniciar download:', error);
    alert('Erro ao iniciar download');
  }
}

function updateStats() {
  const total = state.allFiles.length;
  const filtered = state.filteredFiles.length;

  elements.totalFiles.textContent = `${total} arquivo${total !== 1 ? 's' : ''}`;

  if (filtered !== total) {
    elements.filteredCount.textContent = `(mostrando ${filtered})`;
    elements.filteredCount.style.display = 'inline';
  } else {
    elements.filteredCount.style.display = 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  elements.loading.classList.remove('hidden');
  elements.error.classList.add('hidden');
  elements.stats.classList.add('hidden');
  elements.tableContainer.classList.add('hidden');
  elements.emptyState.classList.add('hidden');
}

function showContent() {
  elements.loading.classList.add('hidden');
  elements.error.classList.add('hidden');
  elements.stats.classList.remove('hidden');
  elements.tableContainer.classList.remove('hidden');
}

function showError(message) {
  elements.loading.classList.add('hidden');
  elements.error.classList.remove('hidden');
  elements.error.classList.remove('info');
  elements.stats.classList.add('hidden');
  elements.tableContainer.classList.add('hidden');
  elements.emptyState.classList.add('hidden');
  elements.errorMessage.textContent = message;
}

function showInfo(message) {
  elements.loading.classList.add('hidden');
  elements.error.classList.remove('hidden');
  elements.error.classList.add('info');
  elements.stats.classList.add('hidden');
  elements.tableContainer.classList.add('hidden');
  elements.emptyState.classList.add('hidden');
  elements.errorMessage.textContent = message;
}

function showEmptyState() {
  elements.tableContainer.classList.add('hidden');
  elements.emptyState.classList.remove('hidden');
}

function hideEmptyState() {
  elements.emptyState.classList.add('hidden');
  elements.tableContainer.classList.remove('hidden');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
