// JobTread Dark Mode Feature Module
// Applies dark theme to JobTread interface

const DarkModeFeature = (() => {
  let isActive = false;
  let styleElement = null;

  // Initialize the feature
  async function init() {
    if (isActive) {
      console.log('DarkMode: Already initialized');
      return;
    }

    console.log('DarkMode: Initializing...');

    // Inject dark mode CSS and wait for it to load
    await injectDarkModeCSS();

    isActive = true;
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
    if (styleElement) return Promise.resolve();

    return new Promise((resolve) => {
      styleElement = document.createElement('link');
      styleElement.rel = 'stylesheet';
      styleElement.href = chrome.runtime.getURL('styles/dark-mode.css');
      styleElement.id = 'jt-dark-mode-styles';

      // Wait for CSS to load before resolving
      styleElement.addEventListener('load', () => {
        console.log('DarkMode: CSS loaded successfully');
        resolve();
      });

      styleElement.addEventListener('error', () => {
        console.error('DarkMode: Failed to load CSS');
        resolve(); // Resolve anyway to prevent hanging
      });

      document.head.appendChild(styleElement);
    });
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
