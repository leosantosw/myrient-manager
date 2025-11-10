

const DOWNLOAD_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  EXTRACTING: 'extracting',
  CONVERTING_ISO_TO_XEX: 'converting_iso_to_xex',
  CANCELLED: 'cancelled',
  ERROR: 'error'
};

const STATUS_LABELS = {
  [DOWNLOAD_STATUS.PENDING]: 'Aguardando',
  [DOWNLOAD_STATUS.IN_PROGRESS]: 'Baixando',
  [DOWNLOAD_STATUS.PAUSED]: 'Pausado',
  [DOWNLOAD_STATUS.COMPLETED]: 'Concluído',
  [DOWNLOAD_STATUS.EXTRACTING]: 'Extraindo...',
  [DOWNLOAD_STATUS.CONVERTING_ISO_TO_XEX]: 'Convertendo ISO para XEX...',
  [DOWNLOAD_STATUS.CANCELLED]: 'Cancelado',
  [DOWNLOAD_STATUS.ERROR]: 'Erro'
};

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  if (!bytes || bytes < 0) return '-';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '-';
  return formatBytes(bytesPerSecond) + '/s';
}

function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  } else if (minutes > 0) {
    return `${minutes}min ${secs}seg`;
  } else {
    return `${secs}seg`;
  }
}

function formatPercentage(value) {
  if (!value || value < 0) return '0%';
  if (value > 100) return '100%';
  return Math.round(value) + '%';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  
  if (options.classes) {
    element.className = Array.isArray(options.classes) 
      ? options.classes.join(' ') 
      : options.classes;
  }
  
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  if (options.text) {
    element.textContent = options.text;
  }
  
  if (options.html) {
    element.innerHTML = options.html;
  }
  
  return element;
}

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function toggleVisibility(element, show) {
  if (!element) return;
  element.classList.toggle('hidden', !show);
}
