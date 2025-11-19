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
      // Fetch and inject CSS as inline style to ensure it loads AFTER Tailwind
      // This guarantees our rules override Tailwind's caret-black class
      fetch(chrome.runtime.getURL('styles/dark-mode.css'))
        .then(response => response.text())
        .then(cssText => {
          styleElement = document.createElement('style');
          styleElement.id = 'jt-dark-mode-styles';
          styleElement.textContent = cssText;

          // Append at the VERY END of head to ensure highest priority
          document.head.appendChild(styleElement);

          console.log('DarkMode: CSS injected successfully (inline style at end of head)');

          // Also re-inject after a delay to ensure it stays after any late-loading styles
          setTimeout(() => {
            if (styleElement && document.head.contains(styleElement)) {
              // Move to end of head again
              document.head.appendChild(styleElement);
              console.log('DarkMode: CSS re-positioned at end of head for maximum priority');
            }
          }, 1000);

          // Monitor for any new stylesheets being added and re-position ours after them
          const observer = new MutationObserver(() => {
            if (styleElement && document.head.contains(styleElement)) {
              // Check if our style is still the last one
              const lastStyle = document.head.querySelector('style:last-of-type, link[rel="stylesheet"]:last-of-type');
              if (lastStyle !== styleElement) {
                document.head.appendChild(styleElement);
                console.log('DarkMode: CSS re-positioned after new stylesheet detected');
              }
            }
          });

          observer.observe(document.head, { childList: true });

          resolve();
        })
        .catch(error => {
          console.error('DarkMode: Failed to load CSS:', error);
          resolve(); // Resolve anyway to prevent hanging
        });
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
