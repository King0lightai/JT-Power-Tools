// JobTread Quick Job Switcher Feature
// Keyboard shortcuts: J+S or ALT+J to quickly search and switch jobs

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearchOpen = false;
  let jKeyPressed = false;

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

    console.log('QuickJobSwitcher: ✅ Listening for J+S or ALT+J keyboard shortcuts');
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

    closeSidebar();

    console.log('QuickJobSwitcher: Cleanup complete');
  }

  /**
   * Handle keydown events
   */
  function handleKeyDown(e) {
    // Don't track J key if sidebar is already open (prevents interference with typing)
    if (!isSearchOpen && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'j' || e.key === 'J')) {
      jKeyPressed = true;
    }

    // Open sidebar: J+S (both keys pressed together) or ALT+J
    const isJSShortcut = jKeyPressed && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 's' || e.key === 'S');
    const isAltJShortcut = e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'j' || e.key === 'J');

    if (isJSShortcut || isAltJShortcut) {
      // Check if sidebar actually exists (user may have manually closed it)
      const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');

      if (!sidebar) {
        // Sidebar doesn't exist, reset state and allow opening
        isSearchOpen = false;
      }

      if (!isSearchOpen) {
        console.log(`QuickJobSwitcher: 🎯 ${isAltJShortcut ? 'ALT+J' : 'J+S'} detected!`);
        e.preventDefault();
        e.stopPropagation();
        // Reset J key state immediately after opening
        jKeyPressed = false;
        openSidebar();
      } else {
        console.log('QuickJobSwitcher: Sidebar already open, ignoring shortcut');
      }
      return;
    }

    // If sidebar is open and Enter is pressed, select top job and close
    if (isSearchOpen && e.key === 'Enter') {
      console.log('QuickJobSwitcher: Enter pressed while sidebar open');

      // Try multiple selectors for the search input
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                         document.querySelector('div.z-30.absolute input[type="text"]') ||
                         document.querySelector('div.z-30 input');

      // If we're in the sidebar (search input exists and is focused, or just in the sidebar)
      const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
      const isInSidebar = sidebar && sidebar.contains(document.activeElement);

      console.log('QuickJobSwitcher: searchInput exists:', !!searchInput);
      console.log('QuickJobSwitcher: activeElement is searchInput:', document.activeElement === searchInput);
      console.log('QuickJobSwitcher: isInSidebar:', isInSidebar);

      if ((searchInput && document.activeElement === searchInput) || isInSidebar) {
        console.log('QuickJobSwitcher: Conditions met, selecting top job');
        e.preventDefault();
        e.stopPropagation();
        selectTopJobAndClose();
        return;
      } else {
        console.log('QuickJobSwitcher: Conditions NOT met, not handling Enter');
      }
    }

    // Close sidebar on Escape
    if (isSearchOpen && e.key === 'Escape') {
      console.log('QuickJobSwitcher: ESC pressed, closing sidebar');
      e.preventDefault();
      e.stopPropagation();
      closeSidebar();
      return;
    }
  }

  /**
   * Handle keyup events
   */
  function handleKeyUp(e) {
    // Reset J key state when released
    if (e.key === 'j' || e.key === 'J') {
      jKeyPressed = false;
    }
  }

  /**
   * Open the job switcher sidebar
   */
  function openSidebar() {
    console.log('QuickJobSwitcher: Opening sidebar...');

    // Find the job number button - try multiple selectors
    let jobNumberButton = null;

    // Strategy 1: Look for the specific structure
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
      showErrorNotification('Could not find job switcher button. Make sure you\'re on a job page.');
      return;
    }

    console.log('QuickJobSwitcher: ✅ Found job button:', jobNumberButton.textContent);

    // Click to open sidebar
    console.log('QuickJobSwitcher: Clicking job button to open sidebar...');
    jobNumberButton.click();
    isSearchOpen = true;

    // Focus the search input after a short delay to let sidebar render
    setTimeout(() => {
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                         document.querySelector('div.z-30.absolute input[type="text"]') ||
                         document.querySelector('div.z-30 input');

      if (searchInput) {
        searchInput.focus();
        console.log('QuickJobSwitcher: ✅ Search input focused');
      } else {
        console.log('QuickJobSwitcher: ⚠️ Could not find search input to focus');
      }
    }, 150);

    console.log('QuickJobSwitcher: ✅ Sidebar opened');
  }

  /**
   * Close the job switcher sidebar
   */
  function closeSidebar() {
    if (!isSearchOpen) {
      return;
    }

    console.log('QuickJobSwitcher: Closing sidebar...');

    // Find and click the close button
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (sidebar) {
      const closeButton = sidebar.querySelector('div[role="button"]');
      if (closeButton && (closeButton.textContent.includes('Close') || closeButton.querySelector('path[d*="M18 6"]'))) {
        closeButton.click();
        console.log('QuickJobSwitcher: ✅ Closed sidebar');
      }
    }

    isSearchOpen = false;
  }

  /**
   * Select the currently highlighted job (or top job) and close sidebar
   */
  function selectTopJobAndClose() {
    console.log('QuickJobSwitcher: Selecting job...');

    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (!sidebar) {
      console.error('QuickJobSwitcher: ❌ Could not find sidebar');
      closeSidebar();
      return;
    }

    let selectedButton = null;

    // Strategy 1: Check for visually highlighted items (arrow key navigation often uses visual highlighting)
    // Look for items with highlight classes like bg-blue-50, bg-blue-100, bg-gray-100, etc.
    const highlightedItems = sidebar.querySelectorAll(
      'div[role="button"][class*="bg-blue-"], ' +
      'div[role="button"][class*="bg-gray-100"], ' +
      'div[role="button"][aria-selected="true"], ' +
      'div[role="button"][data-highlighted], ' +
      'div[role="button"][data-selected], ' +
      'div[role="button"].highlighted, ' +
      'div[role="button"].selected'
    );

    for (const item of highlightedItems) {
      const text = item.textContent.trim();
      // Skip non-job items
      if (text.includes('Close') || text.includes('×') || text.includes('Job Switcher') ||
          item.querySelector('path[d*="M18 6"]')) {
        continue;
      }
      selectedButton = item;
      console.log(`QuickJobSwitcher: ✅ Using highlighted job: ${text.substring(0, 50)}`);
      break;
    }

    // Strategy 2: Check if there's a currently focused job button (from arrow key navigation)
    if (!selectedButton) {
      const activeElement = document.activeElement;

      // Check if the active element is a job button in the sidebar (not the search input)
      if (activeElement &&
          sidebar.contains(activeElement) &&
          activeElement.getAttribute('role') === 'button' &&
          activeElement.tagName !== 'INPUT') {
        const text = activeElement.textContent.trim();
        // Make sure it's not the close button or header
        if (!text.includes('Close') &&
            !text.includes('×') &&
            !text.includes('Job Switcher') &&
            !activeElement.querySelector('path[d*="M18 6"]')) {
          selectedButton = activeElement;
          console.log(`QuickJobSwitcher: ✅ Using focused job: ${text.substring(0, 50)}`);
        }
      }
    }

    // Strategy 3: Fall back to finding the top job
    if (!selectedButton) {
      // Find all job buttons
      const jobButtons = sidebar.querySelectorAll('div[role="button"][tabindex="0"]');
      console.log(`QuickJobSwitcher: Found ${jobButtons.length} buttons in sidebar`);

      // Find the first job (skip close button and header)
      for (const button of jobButtons) {
        const text = button.textContent.trim();

        // Skip close button
        if (text.includes('Close') || text.includes('×') || button.querySelector('path[d*="M18 6"]')) {
          continue;
        }

        // Skip header
        if (text.includes('Job Switcher')) {
          continue;
        }

        // This is the first job in the list
        selectedButton = button;
        console.log(`QuickJobSwitcher: ✅ Top job (fallback): ${text.substring(0, 50)}`);
        break;
      }
    }

    if (selectedButton) {
      console.log('QuickJobSwitcher: Clicking selected job...');

      // Click the job button to navigate
      selectedButton.click();

      // Close sidebar immediately after clicking
      // If navigation happens, sidebar will be removed anyway
      // If it doesn't navigate (same job), we want it to close
      setTimeout(() => {
        closeSidebar();
      }, 50);
    } else {
      console.log('QuickJobSwitcher: No jobs found, just closing sidebar');
      closeSidebar();
    }
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
