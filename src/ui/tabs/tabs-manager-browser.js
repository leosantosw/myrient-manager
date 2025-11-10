
class TabsManager {
  constructor() {
    this.currentTab = 'files';
    this.tabs = new Map();
    this.tabButtons = new Map();
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.showTab(this.currentTab);
  }

  cacheElements() {
    
    document.querySelectorAll('[data-tab]').forEach(btn => {
      const tabName = btn.dataset.tab;
      this.tabButtons.set(tabName, btn);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      const tabName = content.id.replace('-tab', '');
      this.tabs.set(tabName, content);
    });
  }

  setupEventListeners() {
    this.tabButtons.forEach((btn, tabName) => {
      btn.addEventListener('click', () => {
        this.showTab(tabName);
      });
    });
  }

  showTab(tabName) {
    this.currentTab = tabName;

    this.tabButtons.forEach((btn, name) => {
      btn.classList.toggle('active', name === tabName);
    });

    this.tabs.forEach((content, name) => {
      content.classList.toggle('active', name === tabName);
    });
  }

  updateBadge(tabName, count) {
    const btn = this.tabButtons.get(tabName);
    if (!btn) return;

    let badge = btn.querySelector('.badge');
    
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        btn.appendChild(badge);
      }
      badge.textContent = count;
      badge.style.display = 'inline';
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

  getCurrentTab() {
    return this.currentTab;
  }
}

const tabsManager = new TabsManager();
