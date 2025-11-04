// JobTread Quick Job Switcher Feature
// Keyboard shortcut (Ctrl/Cmd+J) to quickly search and switch jobs

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearching = false;
  let searchQuery = '';
  let modifierKey = null; // Track which key was pressed (ctrl or meta)

  // UI Elements
  let floatingPopup = null;
  let hideStyleElement = null;

  /**
   * Initialize the feature
   */
  function init() {
    if (isActive) {
      console.log('QuickJobSwitcher: Already initialized');
      return;
    }

    console.log('QuickJobSwitcher: Initializing...');
    isActive = true;

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    console.log('QuickJobSwitcher: Listening for Ctrl/Cmd+J');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      console.log('QuickJobSwitcher: Not active, nothing to cleanup');
      return;
    }

    console.log('QuickJobSwitcher: Cleaning up...');
    isActive = false;

    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);

    closeQuickSearch();

    console.log('QuickJobSwitcher: Cleanup complete');
  }

  /**
   * Handle keydown events
   */
  function handleKeyDown(e) {
    // Start quick search: Ctrl+J or Cmd+J
    if ((e.ctrlKey || e.metaKey) && e.key === 'j' && !isSearching) {
      e.preventDefault();
      e.stopPropagation();
      modifierKey = e.ctrlKey ? 'ctrl' : 'meta';
      openQuickSearch();
      return;
    }

    // If we're in search mode
    if (isSearching) {
      // Cancel on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeQuickSearch();
        return;
      }

      // Pass through to search input (letters, numbers, backspace, space, etc.)
      if (isValidSearchKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        handleSearchInput(e);
      }
    }
  }

  /**
   * Handle keyup events - release modifier key to select
   */
  function handleKeyUp(e) {
    // If we're searching and they released the modifier key
    if (isSearching && ((modifierKey === 'ctrl' && !e.ctrlKey) || (modifierKey === 'meta' && !e.metaKey))) {
      console.log('QuickJobSwitcher: Modifier key released, selecting top result');
      selectTopResult();
    }
  }

  /**
   * Check if key is valid for search input
   */
  function isValidSearchKey(e) {
    return (
      e.key.length === 1 || // Single characters
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Space'
    );
  }

  /**
   * Open the quick search overlay
   */
  function openQuickSearch() {
    console.log('QuickJobSwitcher: Opening quick search...');
    isSearching = true;
    searchQuery = '';

    // Find and click the job number to open sidebar
    const jobNumberButton = document.querySelector('div[role="button"][tabindex="0"] .font-bold.text-2xl');
    if (!jobNumberButton) {
      console.error('QuickJobSwitcher: Could not find job number button');
      isSearching = false;
      return;
    }

    // Inject CSS to hide the sidebar
    hideStyleElement = document.createElement('style');
    hideStyleElement.id = 'jt-quick-search-hide';
    hideStyleElement.textContent = `
      /* Hide the job switcher sidebar */
      div.z-30.absolute.top-0.bottom-0.right-0[style*="width: 400px"] {
        opacity: 0 !important;
        pointer-events: none !important;
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
      }
    `;
    document.head.appendChild(hideStyleElement);

    // Click to open sidebar (invisibly)
    console.log('QuickJobSwitcher: Opening sidebar invisibly');
    jobNumberButton.click();

    // Wait for sidebar to open, then create floating popup
    setTimeout(() => {
      createFloatingPopup();
      focusSearchInput();
    }, 300);
  }

  /**
   * Create the floating search popup
   */
  function createFloatingPopup() {
    floatingPopup = document.createElement('div');
    floatingPopup.id = 'jt-quick-job-switcher';
    floatingPopup.innerHTML = `
      <div class="quick-search-overlay">
        <div class="quick-search-box">
          <div class="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <div class="search-query" id="quickSearchQuery">Search jobs...</div>
          <div class="search-hint">Release Ctrl to select</div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #jt-quick-job-switcher {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(2px);
        animation: fadeIn 0.15s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .quick-search-overlay {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 20px;
      }

      .quick-search-box {
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        padding: 20px 24px;
        min-width: 400px;
        max-width: 500px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideUp 0.2s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .search-icon {
        color: #999;
        display: flex;
        align-items: center;
      }

      .search-query {
        flex: 1;
        font-size: 16px;
        color: #1a1a1a;
        font-weight: 500;
        min-height: 24px;
        display: flex;
        align-items: center;
      }

      .search-query.empty {
        color: #999;
        font-weight: 400;
      }

      .search-hint {
        font-size: 11px;
        color: #999;
        background: #f5f5f5;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(floatingPopup);
    console.log('QuickJobSwitcher: Floating popup created');
  }

  /**
   * Focus the hidden search input
   */
  function focusSearchInput() {
    // Find the search input in the (invisible) sidebar
    const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]');
    if (searchInput) {
      searchInput.focus();
      console.log('QuickJobSwitcher: Search input focused');
    } else {
      console.error('QuickJobSwitcher: Could not find search input');
    }
  }

  /**
   * Handle search input from keyboard
   */
  function handleSearchInput(e) {
    const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]');
    if (!searchInput) return;

    // Update search query based on key
    if (e.key === 'Backspace') {
      searchQuery = searchQuery.slice(0, -1);
    } else if (e.key === 'Delete') {
      searchQuery = '';
    } else if (e.key.length === 1) {
      searchQuery += e.key;
    }

    // Update the hidden input
    searchInput.value = searchQuery;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Update the floating popup display
    updatePopupDisplay();

    console.log('QuickJobSwitcher: Search query:', searchQuery);
  }

  /**
   * Update the floating popup display
   */
  function updatePopupDisplay() {
    const queryDisplay = document.getElementById('quickSearchQuery');
    if (!queryDisplay) return;

    if (searchQuery === '') {
      queryDisplay.textContent = 'Search jobs...';
      queryDisplay.classList.add('empty');
    } else {
      queryDisplay.textContent = searchQuery;
      queryDisplay.classList.remove('empty');
    }
  }

  /**
   * Select the top result from the filtered list
   */
  function selectTopResult() {
    console.log('QuickJobSwitcher: Selecting top result...');

    // Find the first job result (not the current one with checkmark)
    const sidebar = document.querySelector('div.z-30.absolute[style*="width: 400px"]');
    if (!sidebar) {
      console.error('QuickJobSwitcher: Could not find sidebar');
      closeQuickSearch();
      return;
    }

    // Find all job buttons
    const jobButtons = sidebar.querySelectorAll('div[role="button"][tabindex="0"]');

    // Filter out the close button and header, find first visible job
    let topResult = null;
    for (const button of jobButtons) {
      // Skip if it's the close button (has X icon)
      if (button.querySelector('svg path[d*="M18 6"]')) continue;

      // This should be a job result
      topResult = button;
      break;
    }

    if (topResult) {
      console.log('QuickJobSwitcher: Found top result, clicking...');
      topResult.click();

      // Small delay to let the click register before closing
      setTimeout(() => {
        closeQuickSearch();
      }, 100);
    } else {
      console.log('QuickJobSwitcher: No results found');
      closeQuickSearch();
    }
  }

  /**
   * Close the quick search overlay
   */
  function closeQuickSearch() {
    console.log('QuickJobSwitcher: Closing quick search...');
    isSearching = false;
    searchQuery = '';
    modifierKey = null;

    // Remove floating popup
    if (floatingPopup) {
      floatingPopup.remove();
      floatingPopup = null;
    }

    // Remove hide style
    if (hideStyleElement) {
      hideStyleElement.remove();
      hideStyleElement = null;
    }

    // Close the sidebar if it's open
    setTimeout(() => {
      const closeButton = document.querySelector('div.z-30.absolute div[role="button"] svg path[d*="M18 6"]');
      if (closeButton) {
        closeButton.closest('div[role="button"]').click();
        console.log('QuickJobSwitcher: Closed sidebar');
      }
    }, 150);
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
  window.QuickJobSwitcherFeature = QuickJobSwitcherFeature;
}
