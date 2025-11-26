// JT Power Tools - Freeze Header Feature
// Makes job header and navigation tabs sticky when scrolling

const FreezeHeaderFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let styleElement = null;
  let debounceTimer = null;

  // CSS for sticky header
  const STICKY_STYLES = `
    /* Freeze Header Styles */
    .jt-freeze-header-active [data-testid="job-header"],
    .jt-freeze-header-active .jt-job-header-container {
      position: sticky !important;
      top: 0 !important;
      z-index: 100 !important;
      background-color: var(--jt-header-bg, white) !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
    }

    /* Target the main job info header area */
    .jt-freeze-header-active main > div:first-child > div:first-child {
      position: sticky !important;
      top: 0 !important;
      z-index: 100 !important;
      background-color: var(--jt-header-bg, white) !important;
    }

    /* Target tab navigation that typically follows job info */
    .jt-freeze-header-active [role="tablist"],
    .jt-freeze-header-active nav[aria-label*="tab"],
    .jt-freeze-header-active .jt-tab-navigation {
      position: sticky !important;
      top: 60px !important;
      z-index: 99 !important;
      background-color: var(--jt-header-bg, white) !important;
    }

    /* Ensure content below still scrolls properly */
    .jt-freeze-header-active main {
      overflow-y: auto !important;
    }

    /* Dark mode compatibility */
    .jt-dark-mode .jt-freeze-header-active [data-testid="job-header"],
    .jt-dark-mode .jt-freeze-header-active .jt-job-header-container,
    .jt-dark-mode .jt-freeze-header-active main > div:first-child > div:first-child {
      --jt-header-bg: #1f2937 !important;
    }

    /* Custom theme compatibility */
    .jt-custom-theme .jt-freeze-header-active [data-testid="job-header"],
    .jt-custom-theme .jt-freeze-header-active .jt-job-header-container,
    .jt-custom-theme .jt-freeze-header-active main > div:first-child > div:first-child {
      --jt-header-bg: var(--jt-theme-background, white) !important;
    }
  `;

  /**
   * Inject CSS styles for sticky header
   */
  function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = 'jt-freeze-header-styles';
    styleElement.textContent = STICKY_STYLES;
    document.head.appendChild(styleElement);
    console.log('FreezeHeader: Styles injected');
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
      console.log('FreezeHeader: Styles removed');
    }
  }

  /**
   * Find and mark job header elements
   */
  function findAndMarkHeaders() {
    // Look for job page indicators
    const isJobPage = window.location.pathname.includes('/jobs/') ||
                      document.querySelector('[data-testid="job-header"]') ||
                      document.querySelector('h1[class*="job"]');

    if (!isJobPage) {
      console.log('FreezeHeader: Not on a job page, skipping');
      return;
    }

    // Try multiple selectors to find the job header
    const headerSelectors = [
      '[data-testid="job-header"]',
      'header[class*="job"]',
      'main > div:first-child > div:first-child',
      '.job-header',
      '[class*="JobHeader"]'
    ];

    let headerFound = false;
    for (const selector of headerSelectors) {
      const header = document.querySelector(selector);
      if (header && !header.classList.contains('jt-job-header-container')) {
        // Check if this looks like a header (has job title or action buttons)
        const hasJobTitle = header.querySelector('h1, h2, [class*="title"]');
        const hasActions = header.querySelector('button, [role="button"]');

        if (hasJobTitle || hasActions) {
          header.classList.add('jt-job-header-container');
          headerFound = true;
          console.log('FreezeHeader: Found header with selector:', selector);
          break;
        }
      }
    }

    // Look for tab navigation
    const tabSelectors = [
      '[role="tablist"]',
      'nav[aria-label*="tab"]',
      '[class*="TabNav"]',
      '.tabs-container'
    ];

    for (const selector of tabSelectors) {
      const tabs = document.querySelector(selector);
      if (tabs && !tabs.classList.contains('jt-tab-navigation')) {
        tabs.classList.add('jt-tab-navigation');
        console.log('FreezeHeader: Found tab navigation with selector:', selector);
        break;
      }
    }
  }

  /**
   * Apply sticky behavior to the page
   */
  function applyFreezeHeader() {
    document.body.classList.add('jt-freeze-header-active');
    findAndMarkHeaders();
    console.log('FreezeHeader: Applied');
  }

  /**
   * Remove sticky behavior
   */
  function removeFreezeHeader() {
    document.body.classList.remove('jt-freeze-header-active');

    // Remove marker classes
    document.querySelectorAll('.jt-job-header-container').forEach(el => {
      el.classList.remove('jt-job-header-container');
    });
    document.querySelectorAll('.jt-tab-navigation').forEach(el => {
      el.classList.remove('jt-tab-navigation');
    });

    console.log('FreezeHeader: Removed');
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActiveState) {
      console.log('FreezeHeader: Already initialized');
      return;
    }

    console.log('FreezeHeader: Initializing...');
    isActiveState = true;

    // Inject styles
    injectStyles();

    // Apply sticky header
    applyFreezeHeader();

    // Watch for DOM changes (SPA navigation)
    observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new content might be a header or tab area
              if (node.querySelector && (
                node.querySelector('[data-testid="job-header"]') ||
                node.querySelector('[role="tablist"]') ||
                node.matches('main') ||
                node.querySelector('main')
              )) {
                shouldUpdate = true;
                break;
              }
            }
          }
        }
        if (shouldUpdate) break;
      }

      if (shouldUpdate) {
        // Debounce updates
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          findAndMarkHeaders();
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Re-apply on navigation
        setTimeout(() => {
          findAndMarkHeaders();
        }, 500);
      }
    });

    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('FreezeHeader: Feature loaded');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) {
      console.log('FreezeHeader: Not active, nothing to cleanup');
      return;
    }

    console.log('FreezeHeader: Cleaning up...');
    isActiveState = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Remove styles and applied classes
    removeStyles();
    removeFreezeHeader();

    console.log('FreezeHeader: Cleanup complete');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActiveState
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.FreezeHeaderFeature = FreezeHeaderFeature;
}
