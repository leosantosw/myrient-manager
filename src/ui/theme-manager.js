class ThemeManager {
  constructor() {
    this.theme = this.getStoredTheme() || 'dark';
    this.applyTheme(this.theme);
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupToggleButton());
    } else {
      this.setupToggleButton();
    }
  }

  getStoredTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (error) {
      console.error('Erro ao ler tema do localStorage:', error);
      return 'dark';
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Erro ao salvar tema no localStorage:', error);
    }
  }

  applyTheme(theme) {
    const html = document.documentElement;
    
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
    
    this.theme = theme;
    this.setStoredTheme(theme);
  }

  toggleTheme() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  setupToggleButton() {
    const toggleButton = document.getElementById('theme-toggle');
    
    if (!toggleButton) {
      console.warn('Botão de toggle de tema não encontrado');
      return;
    }

    toggleButton.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  getCurrentTheme() {
    return this.theme;
  }
}

const themeManager = new ThemeManager();

