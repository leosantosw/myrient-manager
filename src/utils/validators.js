

function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function sanitizeFilename(filename) {
  if (!filename) return 'download';

  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 255); 
}

function isValidPath(path) {
  if (!path || typeof path !== 'string') return false;

  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  return !invalidChars.test(path);
}

function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    return decodeURIComponent(filename) || 'download';
  } catch (e) {
    return 'download';
  }
}

module.exports = {
  isValidUrl,
  sanitizeFilename,
  isValidPath,
  extractFilenameFromUrl
};
