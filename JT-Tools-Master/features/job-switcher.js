// JobTread Quick Job Switcher Feature
// Keyboard shortcut (Alt+J) to quickly search and switch jobs

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearching = false;
  let searchQuery = '';

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

    console.log('QuickJobSwitcher: ✅ Listening for Alt+J keyboard shortcut');
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

    closeQuickSearch();

    console.log('QuickJobSwitcher: Cleanup complete');
  }

  /**
   * Handle keydown events
   */
  function handleKeyDown(e) {
    // Toggle quick search: Alt+J
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'j' || e.key === 'J') && !isSearching) {
      console.log('QuickJobSwitcher: 🎯 Alt+J detected!');
      e.preventDefault();
      e.stopPropagation();
      openQuickSearch();
      return;
    }

    // If we're in search mode
    if (isSearching) {
      // Select top result on Enter
      if (e.key === 'Enter') {
        console.log('QuickJobSwitcher: Enter pressed, selecting top result');
        e.preventDefault();
        e.stopPropagation();
        selectTopResult();
        return;
      }

      // Cancel on Escape
      if (e.key === 'Escape') {
        console.log('QuickJobSwitcher: ESC pressed, canceling search');
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

    // Find the job number button - try multiple selectors
    let jobNumberButton = null;

    // Strategy 1: Look for the specific structure from user's HTML
    jobNumberButton = document.querySelector('.font-bold.text-2xl div[role="button"]');

    // Strategy 2: Look for any button with "Job" text
    if (!jobNumberButton) {
      const buttons = document.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        if (btn.textContent.includes('Job ')) {
          jobNumberButton = btn;
          break;
        }
      }
    }

    // Strategy 3: Look for text-2xl class with Job text
    if (!jobNumberButton) {
      const elements = document.querySelectorAll('.text-2xl');
      for (const el of elements) {
        if (el.textContent.includes('Job ')) {
          const button = el.querySelector('div[role="button"]');
          if (button) {
            jobNumberButton = button;
            break;
          }
        }
      }
    }

    if (!jobNumberButton) {
      console.error('QuickJobSwitcher: ❌ Could not find job number button');
      console.log('QuickJobSwitcher: Tried looking for:');
      console.log('  1. .font-bold.text-2xl div[role="button"]');
      console.log('  2. div[role="button"] containing "Job "');
      console.log('  3. .text-2xl containing "Job "');
      isSearching = false;
      showErrorNotification('Could not find job switcher button. Make sure you\'re on a job page.');
      return;
    }

    console.log('QuickJobSwitcher: ✅ Found job button:', jobNumberButton.textContent);

    // Inject CSS to hide the sidebar
    hideStyleElement = document.createElement('style');
    hideStyleElement.id = 'jt-quick-search-hide';
    hideStyleElement.textContent = `
      /* Hide the job switcher sidebar */
      div.z-30.absolute.top-0.bottom-0.right-0[style*="width: 400px"],
      div.z-30.absolute.top-0.bottom-0.right-0[data-is-drag-scroll-boundary] {
        opacity: 0 !important;
        pointer-events: none !important;
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(hideStyleElement);
    console.log('QuickJobSwitcher: ✅ Injected sidebar hiding CSS');

    // Click to open sidebar (invisibly)
    console.log('QuickJobSwitcher: Clicking job button to open sidebar...');
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
          <div class="search-query empty" id="quickSearchQuery">Search jobs...</div>
          <div class="search-hint">Press Enter to select</div>
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
    console.log('QuickJobSwitcher: ✅ Floating popup created and displayed');
  }

  /**
   * Focus the hidden search input
   */
  function focusSearchInput() {
    // Find the search input in the (invisible) sidebar - try multiple selectors
    let searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]');

    if (!searchInput) {
      searchInput = document.querySelector('input[placeholder*="Search Jobs"]');
    }

    if (!searchInput) {
      searchInput = document.querySelector('input[placeholder*="Search"]');
    }

    if (searchInput) {
      searchInput.focus();
      console.log('QuickJobSwitcher: ✅ Search input focused');
    } else {
      console.error('QuickJobSwitcher: ❌ Could not find search input');
    }
  }

  /**
   * Handle search input from keyboard
   */
  function handleSearchInput(e) {
    const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                        document.querySelector('input[placeholder*="Search Jobs"]') ||
                        document.querySelector('input[placeholder*="Search"]');

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
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

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

    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0[style*="width: 400px"]') ||
                    document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0[data-is-drag-scroll-boundary]');

    if (!sidebar) {
      console.error('QuickJobSwitcher: ❌ Could not find sidebar');
      closeQuickSearch();
      return;
    }

    console.log('QuickJobSwitcher: ✅ Found sidebar');

    // Find all job buttons
    const jobButtons = sidebar.querySelectorAll('div[role="button"][tabindex="0"]');
    console.log(`QuickJobSwitcher: Found ${jobButtons.length} buttons in sidebar`);

    // Filter out the close button and header, find first visible job
    let topResult = null;
    for (const button of jobButtons) {
      const text = button.textContent.trim();
      console.log(`QuickJobSwitcher: Checking button: ${text.substring(0, 50)}`);

      // Skip if it's the close button (has X or Close text)
      if (text.includes('Close') || text.includes('×') || button.querySelector('path[d*="M18 6"]')) {
        console.log('  → Skipping (close button)');
        continue;
      }

      // Skip the header
      if (text.includes('Job Switcher')) {
        console.log('  → Skipping (header)');
        continue;
      }

      // This should be a job result
      topResult = button;
      console.log(`QuickJobSwitcher: ✅ Top result: ${text.substring(0, 50)}`);
      break;
    }

    if (topResult) {
      console.log('QuickJobSwitcher: Clicking top result...');
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
      const closeButton = document.querySelector('div.z-30.absolute div[role="button"]');
      if (closeButton && closeButton.textContent.includes('Close')) {
        closeButton.click();
        console.log('QuickJobSwitcher: ✅ Closed sidebar');
      }
    }, 150);
  }

  /**
   * Show error notification
   */
  function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 999999;
      font-size: 13px;
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
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
