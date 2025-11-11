

const DOWNLOAD_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  EXTRACTING: 'extracting',
  CONVERTING_ISO_TO_XEX: 'converting_iso_to_xex',
  MOVING_TO_HD: 'moving_to_hd',
  CANCELLED: 'cancelled',
  ERROR: 'error'
};

const STATUS_COLORS = {
  [DOWNLOAD_STATUS.PENDING]: '#94a3b8',
  [DOWNLOAD_STATUS.IN_PROGRESS]: '#3b82f6',
  [DOWNLOAD_STATUS.PAUSED]: '#f59e0b',
  [DOWNLOAD_STATUS.COMPLETED]: '#10b981',
  [DOWNLOAD_STATUS.EXTRACTING]: '#8b5cf6',
  [DOWNLOAD_STATUS.CONVERTING_ISO_TO_XEX]: '#f97316',
  [DOWNLOAD_STATUS.MOVING_TO_HD]: '#06b6d4',
  [DOWNLOAD_STATUS.CANCELLED]: '#64748b',
  [DOWNLOAD_STATUS.ERROR]: '#ef4444'
};

const STATUS_LABELS = {
  [DOWNLOAD_STATUS.PENDING]: 'Aguardando',
  [DOWNLOAD_STATUS.IN_PROGRESS]: 'Baixando',
  [DOWNLOAD_STATUS.PAUSED]: 'Pausado',
  [DOWNLOAD_STATUS.COMPLETED]: 'Concluído',
  [DOWNLOAD_STATUS.EXTRACTING]: 'Extraindo...',
  [DOWNLOAD_STATUS.CONVERTING_ISO_TO_XEX]: 'Convertendo ISO para XEX...',
  [DOWNLOAD_STATUS.MOVING_TO_HD]: 'Movendo para HD...',
  [DOWNLOAD_STATUS.CANCELLED]: 'Cancelado',
  [DOWNLOAD_STATUS.ERROR]: 'Erro'
};

const DEFAULT_SETTINGS = {
  myrientUrl: null,
  numConnections: 100,
  maxConcurrentDownloads: 1,
  defaultDownloadPath: null,
  maxHistory: 100,
  autoExtract: false,
  autoConvertISO: false,
  moveToHD: false,
  hdPath: null
};

const LIMITS = {
  MAX_HISTORY: 100,
  PROGRESS_UPDATE_INTERVAL: 500, 
  DEBOUNCE_DELAY: 300 
};

module.exports = {
  DOWNLOAD_STATUS,
  STATUS_COLORS,
  STATUS_LABELS,
  DEFAULT_SETTINGS,
  LIMITS
};
