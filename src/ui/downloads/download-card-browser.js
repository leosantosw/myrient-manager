

function createDownloadCard(download) {
  const card = createElement('div', {
    classes: ['download-card', `status-${download.status}`],
    attributes: { 'data-id': download.id }
  });

  card.innerHTML = `
    <div class="download-header">
      <div class="download-info">
        <div class="download-filename" title="${escapeHtml(download.filename)}">
          ${escapeHtml(download.filename)}
        </div>
        <div class="download-meta">
          <span class="download-status">${STATUS_LABELS[download.status]}</span>
          ${download.status === DOWNLOAD_STATUS.ERROR ? 
            `<span class="download-error">• ${escapeHtml(download.error)}</span>` : ''}
        </div>
      </div>
      <div class="download-actions">
        ${createActionButtons(download)}
      </div>
    </div>

    ${download.status === DOWNLOAD_STATUS.IN_PROGRESS || download.status === DOWNLOAD_STATUS.PAUSED ? `
      <div class="download-progress-container">
        <div class="download-progress-bar">
          <div class="download-progress-fill" style="width: ${download.progress}%"></div>
        </div>
        <div class="download-progress-text">
          ${formatPercentage(download.progress)} • 
          ${formatBytes(download.receivedBytes)} / ${formatBytes(download.totalBytes)}
        </div>
      </div>
      <div class="download-stats">
        <span class="download-speed">${formatSpeed(download.speed)}</span>
        ${download.eta > 0 ? `<span class="download-eta">• ${formatTimeRemaining(download.eta)} restantes</span>` : ''}
      </div>
    ` : ''}

    ${download.status === DOWNLOAD_STATUS.COMPLETED ? `
      <div class="download-completed-info">
        ✅ Concluído • ${formatBytes(download.totalBytes)}
      </div>
    ` : ''}
  `;

  return card;
}

function createActionButtons(download) {
  const buttons = [];

  switch (download.status) {
    case DOWNLOAD_STATUS.PENDING:
      
      buttons.push(`
        <button class="btn-icon btn-cancel" data-action="cancel" title="Cancelar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `);
      break;

    case DOWNLOAD_STATUS.IN_PROGRESS:
      
      buttons.push(`
        <button class="btn-icon btn-cancel" data-action="cancel" title="Cancelar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `);
      break;

    case DOWNLOAD_STATUS.COMPLETED:
      buttons.push(`
        <button class="btn-icon btn-open-folder" data-action="open-folder" title="Abrir pasta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      `);
      buttons.push(`
        <button class="btn-icon btn-remove" data-action="remove" title="Remover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `);
      break;

    case DOWNLOAD_STATUS.CANCELLED:
    case DOWNLOAD_STATUS.ERROR:
      buttons.push(`
        <button class="btn-icon btn-remove" data-action="remove" title="Remover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `);
      break;
  }

  return buttons.join('');
}

function updateDownloadCard(card, download) {
  const currentStatus = card.className.match(/status-(\w+)/)?.[1];
  const newStatus = download.status;
  
  const needsRebuild = currentStatus !== newStatus && (
    newStatus === DOWNLOAD_STATUS.COMPLETED ||
    newStatus === DOWNLOAD_STATUS.ERROR ||
    newStatus === DOWNLOAD_STATUS.IN_PROGRESS ||
    currentStatus === DOWNLOAD_STATUS.COMPLETED ||
    currentStatus === DOWNLOAD_STATUS.ERROR ||
    currentStatus === DOWNLOAD_STATUS.PENDING
  );
  
  if (needsRebuild) {
    const newCard = createDownloadCard(download);
    card.innerHTML = newCard.innerHTML;
    card.className = newCard.className;
    return;
  }
  
  card.className = `download-card status-${download.status}`;

  const statusEl = card.querySelector('.download-status');
  if (statusEl) {
    statusEl.textContent = STATUS_LABELS[download.status];
  }

  const progressFill = card.querySelector('.download-progress-fill');
  if (progressFill) {
    progressFill.style.width = `${download.progress}%`;
  }

  const progressText = card.querySelector('.download-progress-text');
  if (progressText) {
    progressText.innerHTML = `
      ${formatPercentage(download.progress)} • 
      ${formatBytes(download.receivedBytes)} / ${formatBytes(download.totalBytes)}
    `;
  }

  const speedEl = card.querySelector('.download-speed');
  if (speedEl) {
    speedEl.textContent = formatSpeed(download.speed);
  }

  const etaEl = card.querySelector('.download-eta');
  if (etaEl && download.eta > 0) {
    etaEl.textContent = `• ${formatTimeRemaining(download.eta)} restantes`;
  }

  const actionsContainer = card.querySelector('.download-actions');
  if (actionsContainer) {
    actionsContainer.innerHTML = createActionButtons(download);
  }
}
