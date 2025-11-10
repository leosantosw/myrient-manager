

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

function formatDate(date) {
  if (!date) return '-';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatPercentage(value) {
  if (!value || value < 0) return '0%';
  if (value > 100) return '100%';
  return Math.round(value) + '%';
}

module.exports = {
  formatBytes,
  formatSpeed,
  formatTimeRemaining,
  formatDate,
  formatPercentage
};
