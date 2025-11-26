// JT Power Tools - Freeze Header Feature
// Makes job header and navigation tabs sticky when scrolling on job pages

const FreezeHeaderFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let styleElement = null;
  let debounceTimer = null;

  // CSS for sticky header - targets the specific JobTread structure
  const STICKY_STYLES = `
    /* Freeze Header Styles */

    /* Top header bar - already sticky in JobTread, just ensure it stays */
    /* Keep z-index low (41 is JobTread's default) so modals appear above */
    .jt-freeze-header-active .jt-top-header {
      position: sticky !important;
      top: 0 !important;
      z-index: 41 !important;
      background-color: white !important;
    }

    /* Tab navigation bar - stick below the top header */
    /* z-index 40 keeps it below header but above content, below modals */
    .jt-freeze-header-active .jt-job-tabs-container {
      position: sticky !important;
      top: 50px !important; /* Height of top header */
      z-index: 40 !important;
      background-color: white !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
    }

    /* The inner flex container with the actual tabs */
    .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b {
      background-color: white !important;
    }

    /* Ensure the tabs have proper background */
    .jt-freeze-header-active .jt-job-tabs-container a {
      background-color: inherit;
    }

    /* Active tab styling preserved */
    .jt-freeze-header-active .jt-job-tabs-container a.bg-gray-50 {
      background-color: rgb(249, 250, 251) !important;
    }

    /* Dark mode compatibility */
    body.jt-dark-mode .jt-freeze-header-active .jt-top-header,
    body.jt-dark-mode .jt-freeze-header-active .jt-job-tabs-container,
    body.jt-dark-mode .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-top-header,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-job-tabs-container,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b {
      background-color: #1f2937 !important;
      border-color: #374151 !important;
    }

    body.jt-dark-mode .jt-freeze-header-active .jt-job-tabs-container a,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-job-tabs-container a {
      color: #e5e7eb !important;
    }

    /* Custom theme compatibility */
    .jt-custom-theme .jt-freeze-header-active .jt-top-header,
    .jt-custom-theme .jt-freeze-header-active .jt-job-tabs-container,
    .jt-custom-theme .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b {
      background-color: var(--jt-theme-background, white) !important;
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
   * Check if we're on a job page
   */
  function isJobPage() {
    return window.location.pathname.match(/^\/jobs\/[^/]+/);
  }

  /**
   * Find and mark the top header bar
   * Looking for: div.shrink-0.sticky with JobTread logo and search
   */
  function findAndMarkTopHeader() {
    // Already marked?
    if (document.querySelector('.jt-top-header')) {
      return true;
    }

    // Find the top header: div.shrink-0.sticky containing the JobTread logo SVG
    const stickyDivs = document.querySelectorAll('div.shrink-0.sticky');

    for (const div of stickyDivs) {
      // Check if it contains the JobTread logo (viewBox="0 0 120 18" is the text logo)
      const hasLogo = div.querySelector('svg[viewBox="0 0 120 18"]') ||
                      div.querySelector('svg[viewBox="0 0 8 8"]');
      // Also check for the search input
      const hasSearch = div.querySelector('input[placeholder*="Search"]');

      if (hasLogo || hasSearch) {
        div.classList.add('jt-top-header');
        console.log('FreezeHeader: Found and marked top header');
        return true;
      }
    }

    // Fallback: look for the header with shadow-line-bottom class
    const headerWithShadow = document.querySelector('div.shrink-0.sticky.shadow-line-bottom');
    if (headerWithShadow) {
      headerWithShadow.classList.add('jt-top-header');
      console.log('FreezeHeader: Found top header via shadow-line-bottom');
      return true;
    }

    return false;
  }

  /**
   * Find and mark the job tabs container
   * Looking for: div.shrink-0 > div.flex.overflow-auto.border-b containing links to /jobs/
   */
  function findAndMarkTabs() {
    if (!isJobPage()) {
      console.log('FreezeHeader: Not on a job page, skipping tabs');
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-job-tabs-container')) {
      return true;
    }

    // Find the tab bar: look for div.shrink-0 containing div.flex.overflow-auto.border-b with job links
    const shrinkDivs = document.querySelectorAll('div.shrink-0');

    for (const div of shrinkDivs) {
      // Skip if this is already marked as the top header
      if (div.classList.contains('jt-top-header')) continue;

      const tabContainer = div.querySelector('div.flex.overflow-auto.border-b');
      if (tabContainer) {
        // Verify it contains job navigation links
        const jobLinks = tabContainer.querySelectorAll('a[href^="/jobs/"]');
        if (jobLinks.length > 0) {
          // Check for typical tab names like Dashboard, Budget, Schedule
          const linkTexts = Array.from(jobLinks).map(a => a.textContent.trim().toLowerCase());
          const hasTypicalTabs = linkTexts.some(text =>
            ['dashboard', 'budget', 'schedule', 'messages', 'documents', 'to-dos'].includes(text)
          );

          if (hasTypicalTabs) {
            div.classList.add('jt-job-tabs-container');
            console.log('FreezeHeader: Found and marked job tabs container');
            return true;
          }
        }
      }
    }

    console.log('FreezeHeader: Job tabs container not found');
    return false;
  }

  /**
   * Calculate and set the correct top position for tabs based on header height
   */
  function updateTabsPosition() {
    const topHeader = document.querySelector('.jt-top-header');
    const tabsContainer = document.querySelector('.jt-job-tabs-container');

    if (topHeader && tabsContainer && styleElement) {
      const headerHeight = topHeader.offsetHeight;
      // Update the CSS with the actual header height
      const updatedStyles = STICKY_STYLES.replace(
        /top: 50px !important;/g,
        `top: ${headerHeight}px !important;`
      );
      styleElement.textContent = updatedStyles;
      console.log('FreezeHeader: Set tabs top position to', headerHeight, 'px');
    }
  }

  /**
   * Apply sticky behavior to the page
   */
  function applyFreezeHeader() {
    document.body.classList.add('jt-freeze-header-active');
    findAndMarkTopHeader();
    findAndMarkTabs();
    // Small delay to ensure elements are rendered before measuring
    setTimeout(updateTabsPosition, 100);
    console.log('FreezeHeader: Applied');
  }

  /**
   * Remove sticky behavior
   */
  function removeFreezeHeader() {
    document.body.classList.remove('jt-freeze-header-active');

    // Remove marker classes
    document.querySelectorAll('.jt-top-header').forEach(el => {
      el.classList.remove('jt-top-header');
    });
    document.querySelectorAll('.jt-job-tabs-container').forEach(el => {
      el.classList.remove('jt-job-tabs-container');
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
              if (node.classList && (
                node.classList.contains('shrink-0') ||
                node.classList.contains('sticky')
              )) {
                shouldUpdate = true;
                break;
              }
              if (node.querySelector && (
                node.querySelector('div.shrink-0') ||
                node.querySelector('a[href^="/jobs/"]')
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
          findAndMarkTopHeader();
          findAndMarkTabs();
          updateTabsPosition();
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    setInterval(() => {
      if (!isActiveState) return;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Remove old markings and re-apply
        document.querySelectorAll('.jt-top-header').forEach(el => {
          el.classList.remove('jt-top-header');
        });
        document.querySelectorAll('.jt-job-tabs-container').forEach(el => {
          el.classList.remove('jt-job-tabs-container');
        });
        setTimeout(() => {
          findAndMarkTopHeader();
          findAndMarkTabs();
          updateTabsPosition();
        }, 300);
      }
    }, 500);

    // Update position on window resize
    window.addEventListener('resize', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateTabsPosition, 100);
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
