// JobTread Dark Mode Feature Module
// Applies dark theme to JobTread interface

const DarkModeFeature = (() => {
  let isActive = false;
  let styleElement = null;

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('DarkMode: Already initialized');
      return;
    }

    console.log('DarkMode: Initializing...');
    isActive = true;

    // Inject dark mode CSS
    injectDarkModeCSS();

    console.log('DarkMode: Dark theme applied');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('DarkMode: Not active, nothing to cleanup');
      return;
    }

    console.log('DarkMode: Cleaning up...');
    isActive = false;

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('DarkMode: Dark theme removed');
  }

  // Inject dark mode CSS
  function injectDarkModeCSS() {
    if (styleElement) return;

    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = chrome.runtime.getURL('styles/dark-mode.css');
    styleElement.id = 'jt-dark-mode-styles';
    document.head.appendChild(styleElement);
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.DarkModeFeature = DarkModeFeature;
}
