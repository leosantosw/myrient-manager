

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

function toggleClass(element, className, force) {
  if (!element) return;
  element.classList.toggle(className, force);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function toggleVisibility(element, show) {
  if (!element) return;
  element.classList.toggle('hidden', !show);
}

module.exports = {
  escapeHtml,
  createElement,
  clearElement,
  toggleClass,
  debounce,
  toggleVisibility
};
