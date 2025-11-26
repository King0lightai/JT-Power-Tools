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
      top: var(--jt-header-height, 50px) !important;
      z-index: 40 !important;
      background-color: white !important;
    }

    /* Action toolbar bar - stick below the tabs (filters, search, view controls) */
    /* z-index 39 keeps it below tabs, below modals */
    .jt-freeze-header-active .jt-action-toolbar {
      position: sticky !important;
      top: var(--jt-tabs-bottom, 90px) !important;
      z-index: 39 !important;
      background-color: white !important;
    }

    /* Budget table header - stick below the action toolbar */
    /* z-index 38 keeps it below toolbar, below modals */
    .jt-freeze-header-active .jt-budget-table-header {
      position: sticky !important;
      top: var(--jt-toolbar-bottom, 138px) !important;
      z-index: 38 !important;
      background-color: white !important;
    }

    /* Ensure budget header children have white background */
    .jt-freeze-header-active .jt-budget-table-header > div {
      background-color: white !important;
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
    body.jt-dark-mode .jt-freeze-header-active .jt-action-toolbar,
    body.jt-dark-mode .jt-freeze-header-active .jt-budget-table-header,
    body.jt-dark-mode .jt-freeze-header-active .jt-budget-table-header > div,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-top-header,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-job-tabs-container,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-action-toolbar,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-budget-table-header,
    #jt-dark-mode-styles ~ * .jt-freeze-header-active .jt-budget-table-header > div {
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
    .jt-custom-theme .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b,
    .jt-custom-theme .jt-freeze-header-active .jt-action-toolbar,
    .jt-custom-theme .jt-freeze-header-active .jt-budget-table-header,
    .jt-custom-theme .jt-freeze-header-active .jt-budget-table-header > div {
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
   * Check if we're on the budget page
   */
  function isBudgetPage() {
    return window.location.pathname.match(/^\/jobs\/[^/]+\/budget/);
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
      // Also check for the search input with company name placeholder
      const hasSearch = div.querySelector('input[placeholder*="Search"]');

      if (hasLogo && hasSearch) {
        div.classList.add('jt-top-header');
        console.log('FreezeHeader: Found and marked top header');
        return true;
      }
    }

    // Fallback: look for the header with z-[41] class (JobTread's main header)
    const headerWithZ41 = document.querySelector('div.shrink-0.sticky.z-\\[41\\]');
    if (headerWithZ41) {
      headerWithZ41.classList.add('jt-top-header');
      console.log('FreezeHeader: Found top header via z-[41]');
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
      // Skip if this is already marked as something else
      if (div.classList.contains('jt-top-header')) continue;
      if (div.classList.contains('jt-action-toolbar')) continue;
      if (div.classList.contains('jt-budget-table-header')) continue;

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
   * Find and mark the action toolbar (filters, search, view controls)
   * Looking for: div.shrink-0.sticky with z-30 and shadow-line-bottom, containing filters/search
   */
  function findAndMarkActionToolbar() {
    if (!isJobPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-action-toolbar')) {
      return true;
    }

    // Find action toolbars: div.shrink-0.sticky with z-30 class
    const toolbars = document.querySelectorAll('div.shrink-0.sticky.z-30, div.shrink-0.sticky.z-\\[30\\]');

    for (const toolbar of toolbars) {
      // Skip if already marked as something else
      if (toolbar.classList.contains('jt-top-header')) continue;
      if (toolbar.classList.contains('jt-job-tabs-container')) continue;
      if (toolbar.classList.contains('jt-budget-table-header')) continue;

      // Check if it contains typical toolbar elements (search, filters, view buttons)
      const hasSearch = toolbar.querySelector('input[placeholder="Search"]');
      const hasFilters = toolbar.querySelector('svg') && toolbar.querySelectorAll('[role="button"]').length > 2;

      if (hasSearch || hasFilters) {
        toolbar.classList.add('jt-action-toolbar');
        console.log('FreezeHeader: Found and marked action toolbar');
        return true;
      }
    }

    // Fallback: look for any sticky div with shadow-line-bottom and p-2 that has filter controls
    const shadowToolbars = document.querySelectorAll('div.shrink-0.sticky.shadow-line-bottom.p-2');
    for (const toolbar of shadowToolbars) {
      if (toolbar.classList.contains('jt-top-header')) continue;
      if (toolbar.classList.contains('jt-job-tabs-container')) continue;
      if (toolbar.classList.contains('jt-budget-table-header')) continue;

      // Verify it has multiple buttons (typical of action toolbar)
      const buttons = toolbar.querySelectorAll('[role="button"]');
      if (buttons.length >= 3) {
        toolbar.classList.add('jt-action-toolbar');
        console.log('FreezeHeader: Found action toolbar via shadow-line-bottom');
        return true;
      }
    }

    return false;
  }

  /**
   * Find and mark the budget table header row
   * Looking for: div.flex.min-w-max containing multiple div.shrink-0 with border-b-4
   */
  function findAndMarkBudgetTableHeader() {
    if (!isBudgetPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-budget-table-header')) {
      return true;
    }

    // Find the budget table header: div.flex.min-w-max with border-b-4 children
    const flexContainers = document.querySelectorAll('div.flex.min-w-max');

    for (const container of flexContainers) {
      // Skip if already marked
      if (container.classList.contains('jt-top-header')) continue;
      if (container.classList.contains('jt-job-tabs-container')) continue;
      if (container.classList.contains('jt-action-toolbar')) continue;

      // Check if it has children with border-b-4 (the thick bottom border)
      const borderChildren = container.querySelectorAll(':scope > div.border-b-4');
      if (borderChildren.length > 0) {
        // Check for typical header text like "Details", "Estimating"
        const headerText = container.textContent.toLowerCase();
        if (headerText.includes('details') || headerText.includes('estimating')) {
          container.classList.add('jt-budget-table-header');
          console.log('FreezeHeader: Found and marked budget table header');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate and set the correct top positions based on actual element heights
   */
  function updatePositions() {
    const topHeader = document.querySelector('.jt-top-header');
    const tabsContainer = document.querySelector('.jt-job-tabs-container');
    const actionToolbar = document.querySelector('.jt-action-toolbar');
    const budgetTableHeader = document.querySelector('.jt-budget-table-header');

    if (!topHeader) return;

    const headerHeight = topHeader.offsetHeight;
    let tabsBottom = headerHeight;
    let toolbarBottom = tabsBottom;

    if (tabsContainer) {
      tabsBottom = headerHeight + tabsContainer.offsetHeight;
      toolbarBottom = tabsBottom;
    }

    if (actionToolbar) {
      toolbarBottom = tabsBottom + actionToolbar.offsetHeight;
    }

    // Set CSS custom properties for positioning
    document.documentElement.style.setProperty('--jt-header-height', `${headerHeight}px`);
    document.documentElement.style.setProperty('--jt-tabs-bottom', `${tabsBottom}px`);
    document.documentElement.style.setProperty('--jt-toolbar-bottom', `${toolbarBottom}px`);

    console.log('FreezeHeader: Updated positions - header:', headerHeight, 'px, tabs bottom:', tabsBottom, 'px, toolbar bottom:', toolbarBottom, 'px');
  }

  /**
   * Apply sticky behavior to the page
   */
  function applyFreezeHeader() {
    document.body.classList.add('jt-freeze-header-active');
    findAndMarkTopHeader();
    findAndMarkTabs();
    findAndMarkActionToolbar();
    findAndMarkBudgetTableHeader();
    // Small delay to ensure elements are rendered before measuring
    setTimeout(updatePositions, 100);
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
    document.querySelectorAll('.jt-action-toolbar').forEach(el => {
      el.classList.remove('jt-action-toolbar');
    });
    document.querySelectorAll('.jt-budget-table-header').forEach(el => {
      el.classList.remove('jt-budget-table-header');
    });

    // Remove CSS custom properties
    document.documentElement.style.removeProperty('--jt-header-height');
    document.documentElement.style.removeProperty('--jt-tabs-bottom');
    document.documentElement.style.removeProperty('--jt-toolbar-bottom');

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
              // Check if new content might be a header, tab, toolbar, or budget area
              if (node.classList && (
                node.classList.contains('shrink-0') ||
                node.classList.contains('sticky') ||
                node.classList.contains('min-w-max')
              )) {
                shouldUpdate = true;
                break;
              }
              if (node.querySelector && (
                node.querySelector('div.shrink-0') ||
                node.querySelector('a[href^="/jobs/"]') ||
                node.querySelector('div.sticky') ||
                node.querySelector('div.border-b-4')
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
          findAndMarkActionToolbar();
          findAndMarkBudgetTableHeader();
          updatePositions();
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
        document.querySelectorAll('.jt-top-header, .jt-job-tabs-container, .jt-action-toolbar, .jt-budget-table-header').forEach(el => {
          el.classList.remove('jt-top-header', 'jt-job-tabs-container', 'jt-action-toolbar', 'jt-budget-table-header');
        });
        setTimeout(() => {
          findAndMarkTopHeader();
          findAndMarkTabs();
          findAndMarkActionToolbar();
          findAndMarkBudgetTableHeader();
          updatePositions();
        }, 300);
      }
    }, 500);

    // Update position on window resize
    window.addEventListener('resize', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePositions, 100);
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
