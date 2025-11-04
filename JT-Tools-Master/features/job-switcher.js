// JobTread Quick Job Switcher Feature
// Keyboard shortcut (Alt+J) to quickly search and switch jobs

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearching = false;
  let searchQuery = '';
  let currentJobs = []; // Store current job list for click handlers

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

    // Inject comprehensive CSS to hide the sidebar (like drag-drop feature)
    hideStyleElement = document.createElement('style');
    hideStyleElement.id = 'jt-quick-search-hide';
    hideStyleElement.textContent = `
      /* Hide ALL z-30 sidebars and overlays except our popup */
      div.z-30:not(#jt-quick-job-switcher):not(#jt-quick-job-switcher *) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        pointer-events: none !important;
      }
      /* Hide the outer sidebar container more aggressively */
      div.absolute.top-0.bottom-0.right-0:not(#jt-quick-job-switcher):not(#jt-quick-job-switcher *) {
        display: none !important;
        visibility: hidden !important;
      }
      /* Hide the white background layer */
      div.absolute.inset-0.bg-white.shadow-line-left {
        display: none !important;
        visibility: hidden !important;
      }
      /* Hide the inner sticky sidebar */
      div.overflow-y-auto.overscroll-contain.sticky {
        display: none !important;
        visibility: hidden !important;
      }
      /* Hide any fixed/absolute overlays and backdrops except ours */
      body > div.fixed.inset-0:not(#jt-quick-job-switcher),
      div.fixed.inset-0:not(#jt-quick-job-switcher):not(#jt-quick-job-switcher *) {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(hideStyleElement);
    console.log('QuickJobSwitcher: ✅ Injected comprehensive sidebar hiding CSS');

    // Click to open sidebar (invisibly)
    console.log('QuickJobSwitcher: Clicking job button to open sidebar...');
    jobNumberButton.click();

    // Wait for sidebar to open, then create floating popup
    setTimeout(() => {
      createFloatingPopup();
      focusSearchInput();
      updateJobResults();
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
        <div class="quick-search-container">
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
          <div class="quick-search-results" id="quickSearchResults"></div>
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

      .quick-search-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        min-width: 500px;
        max-width: 600px;
        animation: slideUp 0.2s ease;
        overflow: hidden;
      }

      .quick-search-box {
        padding: 20px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #e8e8e8;
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

      .quick-search-results {
        max-height: 400px;
        overflow-y: auto;
        padding: 8px 0;
      }

      .quick-search-results:empty {
        display: none;
      }

      .result-item {
        padding: 12px 24px;
        cursor: pointer;
        transition: background 0.1s ease;
        border-left: 3px solid transparent;
      }

      .result-item:hover {
        background: #f5f5f5;
      }

      .result-item.selected {
        background: #f0f9ff;
        border-left-color: #1a1a1a;
      }

      .result-job-number {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 4px;
      }

      .result-job-name {
        font-size: 13px;
        color: #666;
      }

      .result-customer {
        font-size: 12px;
        color: #999;
        margin-top: 2px;
      }

      .no-results {
        padding: 32px 24px;
        text-align: center;
        color: #999;
        font-size: 14px;
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
    updateJobResults();

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
   * Update the job results list from the hidden sidebar
   */
  function updateJobResults() {
    const resultsContainer = document.getElementById('quickSearchResults');
    if (!resultsContainer) return;

    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0[style*="width: 400px"]') ||
                    document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0[data-is-drag-scroll-boundary]') ||
                    document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');

    if (!sidebar) {
      resultsContainer.innerHTML = '<div class="no-results">Loading jobs...</div>';
      return;
    }

    // Find all job buttons
    const jobButtons = sidebar.querySelectorAll('div[role="button"][tabindex="0"]');
    const jobs = [];

    for (const button of jobButtons) {
      const text = button.textContent.trim();

      // Skip close button and header
      if (text.includes('Close') || text.includes('×') || text.includes('Job Switcher')) {
        continue;
      }

      // Skip if it looks like a close button (has X icon path)
      if (button.querySelector('path[d*="M18 6"]')) {
        continue;
      }

      // Try to parse job information
      // Format is usually: "Job <number>\n<name>\n<customer>"
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      if (lines.length > 0) {
        jobs.push({
          element: button,
          fullText: text,
          lines: lines
        });
      }
    }

    // Display results
    if (jobs.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No jobs found</div>';
      currentJobs = [];
      return;
    }

    // Store jobs for click handlers
    currentJobs = jobs;

    resultsContainer.innerHTML = jobs.map((job, index) => {
      const isSelected = index === 0 ? 'selected' : '';

      // Parse job info
      let jobNumber = '';
      let jobName = '';
      let customer = '';

      if (job.lines.length >= 1) {
        jobNumber = job.lines[0]; // Usually "Job 12345"
      }
      if (job.lines.length >= 2) {
        jobName = job.lines[1];
      }
      if (job.lines.length >= 3) {
        customer = job.lines[2];
      }

      return `
        <div class="result-item ${isSelected}" data-index="${index}">
          <div class="result-job-number">${jobNumber}</div>
          ${jobName ? `<div class="result-job-name">${jobName}</div>` : ''}
          ${customer ? `<div class="result-customer">${customer}</div>` : ''}
        </div>
      `;
    }).join('');

    // Add click handlers to result items
    const resultItems = resultsContainer.querySelectorAll('.result-item');
    resultItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        console.log(`QuickJobSwitcher: Clicked job at index ${index}`);
        selectJobByIndex(index);
      });
    });

    console.log(`QuickJobSwitcher: Displayed ${jobs.length} job results with click handlers`);
  }

  /**
   * Select a job by index from the current results list
   */
  function selectJobByIndex(index) {
    console.log(`QuickJobSwitcher: Selecting job at index ${index}`);

    if (!currentJobs || index >= currentJobs.length) {
      console.error(`QuickJobSwitcher: Invalid index ${index}`);
      closeQuickSearch();
      return;
    }

    const selectedJob = currentJobs[index];
    if (selectedJob && selectedJob.element) {
      console.log(`QuickJobSwitcher: Clicking job: ${selectedJob.lines[0]}`);
      selectedJob.element.click();

      // Small delay to let the click register before closing
      setTimeout(() => {
        closeQuickSearch();
      }, 100);
    } else {
      console.error('QuickJobSwitcher: No job element found');
      closeQuickSearch();
    }
  }

  /**
   * Select the top result from the filtered list
   */
  function selectTopResult() {
    console.log('QuickJobSwitcher: Selecting top result (Enter pressed)');
    selectJobByIndex(0);
  }

  /**
   * Close the quick search overlay
   */
  function closeQuickSearch() {
    console.log('QuickJobSwitcher: Closing quick search...');
    isSearching = false;
    searchQuery = '';
    currentJobs = [];

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
