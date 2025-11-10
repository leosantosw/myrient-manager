

function calculateSpeed(receivedBytes, previousBytes, intervalMs) {
  if (!intervalMs || intervalMs <= 0) return 0;
  
  const bytesDownloaded = receivedBytes - previousBytes;
  const seconds = intervalMs / 1000;
  
  return bytesDownloaded / seconds;
}

function calculateETA(remainingBytes, speed) {
  if (!speed || speed <= 0) return 0;
  return remainingBytes / speed;
}

function calculateProgress(receivedBytes, totalBytes) {
  if (!totalBytes || totalBytes <= 0) return 0;
  return Math.min((receivedBytes / totalBytes) * 100, 100);
}

function calculateAverageSpeed(speeds, maxSamples = 10) {
  if (!speeds || speeds.length === 0) return 0;
  
  const recentSpeeds = speeds.slice(-maxSamples);
  const sum = recentSpeeds.reduce((acc, speed) => acc + speed, 0);
  
  return sum / recentSpeeds.length;
}

module.exports = {
  calculateSpeed,
  calculateETA,
  calculateProgress,
  calculateAverageSpeed
};
