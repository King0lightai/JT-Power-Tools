// JobTread Quick Job Switcher Feature
// Keyboard shortcut (Alt+J) to quickly search and switch jobs

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearchOpen = false;

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

    closeSidebar();

    console.log('QuickJobSwitcher: Cleanup complete');
  }

  /**
   * Handle keydown events
   */
  function handleKeyDown(e) {
    // Open sidebar: Alt+J
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'j' || e.key === 'J') && !isSearchOpen) {
      console.log('QuickJobSwitcher: 🎯 Alt+J detected!');
      e.preventDefault();
      e.stopPropagation();
      openSidebar();
      return;
    }

    // If sidebar is open and Enter is pressed in the search input, close sidebar
    if (isSearchOpen && e.key === 'Enter') {
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]');
      if (searchInput && document.activeElement === searchInput) {
        console.log('QuickJobSwitcher: Enter pressed in search, closing sidebar');
        e.preventDefault();
        e.stopPropagation();
        closeSidebar();
        return;
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
