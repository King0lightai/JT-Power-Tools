// JobTread Quick Job Switcher Feature
// Keyboard shortcuts: J+S or ALT+J to quickly search and switch jobs

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearchOpen = false;
  let jKeyPressed = false;
  let sidebarObserver = null;
  let resizeState = {
    isResizing: false,
    startX: 0,
    startWidth: 0
  };

  // Constants for resize functionality
  const STORAGE_KEY = 'jt-job-switcher-width';
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 800;
  const DEFAULT_WIDTH = 400;

  /**
   * Get saved sidebar width from localStorage
   */
  function getSavedWidth() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
          return width;
        }
      }
    } catch (e) {
      console.warn('QuickJobSwitcher: Could not read saved width', e);
    }
    return DEFAULT_WIDTH;
  }

  /**
   * Save sidebar width to localStorage
   */
  function saveWidth(width) {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch (e) {
      console.warn('QuickJobSwitcher: Could not save width', e);
    }
  }

  /**
   * Create and inject the resize handle into the sidebar
   */
  function injectResizeHandle(sidebar) {
    // Check if resize handle already exists
    if (sidebar.querySelector('.jt-resize-handle')) {
      // Still apply saved width in case sidebar was recreated
      applySavedWidth(sidebar);
      return;
    }

    console.log('QuickJobSwitcher: Injecting resize handle...');

    // Create the resize handle element
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'jt-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: col-resize;
      background: transparent;
      z-index: 100;
      transition: background 0.15s ease;
    `;

    // Visual indicator on hover
    resizeHandle.addEventListener('mouseenter', () => {
      resizeHandle.style.background = 'rgba(0, 0, 0, 0.1)';
    });
    resizeHandle.addEventListener('mouseleave', () => {
      if (!resizeState.isResizing) {
        resizeHandle.style.background = 'transparent';
      }
    });

    // Start resize on mousedown
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(e, sidebar);
    });

    // Insert the resize handle into the inner container (the one with bg-white)
    const innerContainer = sidebar.querySelector('.absolute.inset-0');
    if (innerContainer) {
      innerContainer.insertBefore(resizeHandle, innerContainer.firstChild);
    } else {
      sidebar.insertBefore(resizeHandle, sidebar.firstChild);
    }

    // Apply saved width
    applySavedWidth(sidebar);

    console.log(`QuickJobSwitcher: ✅ Resize handle injected`);
  }

  /**
   * Apply saved width to sidebar and trigger reflow
   */
  function applySavedWidth(sidebar) {
    const savedWidth = getSavedWidth();

    // Remove max-width constraint that might interfere
    sidebar.style.maxWidth = 'none';
    sidebar.style.width = `${savedWidth}px`;

    // Force a reflow to ensure the width is applied
    void sidebar.offsetWidth;

    // Dispatch resize event to notify any listeners
    window.dispatchEvent(new Event('resize'));

    console.log(`QuickJobSwitcher: Applied saved width: ${savedWidth}px`);
  }

  /**
   * Start the resize operation
   */
  function startResize(e, sidebar) {
    resizeState.isResizing = true;
    resizeState.startX = e.clientX;
    resizeState.startWidth = sidebar.offsetWidth;

    // Add global event listeners
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    console.log('QuickJobSwitcher: Started resize');
  }

  /**
   * Handle mouse move during resize
   */
  function handleResizeMove(e) {
    if (!resizeState.isResizing) return;

    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (!sidebar) {
      handleResizeEnd();
      return;
    }

    // Calculate new width (dragging left increases width since sidebar is on right)
    const deltaX = resizeState.startX - e.clientX;
    let newWidth = resizeState.startWidth + deltaX;

    // Clamp to min/max
    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

    // Apply new width (ensure max-width doesn't constrain)
    sidebar.style.maxWidth = 'none';
    sidebar.style.width = `${newWidth}px`;
  }

  /**
   * End the resize operation
   */
  function handleResizeEnd() {
    if (!resizeState.isResizing) return;

    resizeState.isResizing = false;

    // Remove global event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);

    // Restore normal cursor and selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // Save the final width
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (sidebar) {
      const finalWidth = sidebar.offsetWidth;
      saveWidth(finalWidth);
      console.log(`QuickJobSwitcher: Resize ended, saved width: ${finalWidth}px`);
    }

    // Reset resize handle visual
    const resizeHandle = sidebar?.querySelector('.jt-resize-handle');
    if (resizeHandle) {
      resizeHandle.style.background = 'transparent';
    }
  }

  /**
   * Start observing for sidebar appearances
   */
  function startSidebarObserver() {
    if (sidebarObserver) {
      return;
    }

    sidebarObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is the sidebar or contains it
            const sidebar = node.matches?.('div.z-30.absolute.top-0.bottom-0.right-0')
              ? node
              : node.querySelector?.('div.z-30.absolute.top-0.bottom-0.right-0');

            if (sidebar) {
              // Small delay to ensure sidebar is fully rendered
              setTimeout(() => injectResizeHandle(sidebar), 50);
            }
          }
        }
      }
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check if sidebar is already present
    const existingSidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (existingSidebar) {
      injectResizeHandle(existingSidebar);
    }

    console.log('QuickJobSwitcher: Sidebar observer started');
  }

  /**
   * Stop observing for sidebar appearances
   */
  function stopSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
      console.log('QuickJobSwitcher: Sidebar observer stopped');
    }
  }

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

    // Start observing for sidebar to add resize handle
    startSidebarObserver();

    console.log('QuickJobSwitcher: ✅ Listening for J+S or ALT+J keyboard shortcuts');
    console.log('QuickJobSwitcher: ✅ Resize functionality enabled');
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

    // Stop sidebar observer
    stopSidebarObserver();

    // Clean up any active resize state
    if (resizeState.isResizing) {
      handleResizeEnd();
    }

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

    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (sidebar) {
      // Strategy 1: Find the close button by looking for X icon or Close text
      const allButtons = sidebar.querySelectorAll('div[role="button"]');
      let closeButton = null;

      for (const button of allButtons) {
        const text = button.textContent.trim();
        // Look for close button indicators
        if (text === 'Close' || text === '×' || text === 'X') {
          closeButton = button;
          break;
        }
        // Check for X icon SVG (close icon typically has M18 6 or similar path for X shape)
        const svg = button.querySelector('svg');
        if (svg) {
          const paths = svg.querySelectorAll('path');
          for (const path of paths) {
            const d = path.getAttribute('d') || '';
            // Common X/close icon path patterns
            if (d.includes('M18 6') || d.includes('m18 6') ||
                d.includes('M6 18') || d.includes('m6 18') ||
                (d.includes('18') && d.includes('6') && d.length < 50)) {
              closeButton = button;
              break;
            }
          }
          if (closeButton) break;
        }
      }

      if (closeButton) {
        closeButton.click();
        console.log('QuickJobSwitcher: ✅ Closed sidebar via close button');
      } else {
        // Strategy 2: Try clicking outside the sidebar (on the overlay)
        const overlay = document.querySelector('div.z-30.absolute.inset-0:not(.top-0)') ||
                       document.querySelector('div.z-20.fixed.inset-0') ||
                       document.querySelector('[class*="backdrop"]') ||
                       document.querySelector('[class*="overlay"]');
        if (overlay) {
          overlay.click();
          console.log('QuickJobSwitcher: ✅ Closed sidebar via overlay click');
        } else {
          // Strategy 3: Dispatch Escape key to close
          console.log('QuickJobSwitcher: Trying Escape key to close sidebar');
          const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true
          });
          sidebar.dispatchEvent(escEvent);
          document.dispatchEvent(escEvent);
        }
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

    // Strategy 1: Check for visually highlighted items (arrow key navigation uses visual highlighting)
    // JobTread uses various highlight classes - check for common patterns
    const allJobButtons = sidebar.querySelectorAll('div[role="button"]');

    for (const button of allJobButtons) {
      const text = button.textContent.trim();
      // Skip non-job items (close button, header, etc.)
      if (text === 'Close' || text === '×' || text === 'X' ||
          text.includes('Job Switcher') ||
          button.querySelector('path[d*="M18 6"]') ||
          button.querySelector('path[d*="M6 18"]')) {
        continue;
      }

      // Check for highlight indicators
      const classList = button.className || '';
      const hasHighlight = classList.includes('bg-blue-') ||
                          classList.includes('bg-cyan-') ||
                          classList.includes('bg-gray-100') ||
                          classList.includes('bg-gray-200') ||
                          classList.includes('highlighted') ||
                          classList.includes('selected') ||
                          classList.includes('active') ||
                          classList.includes('focus') ||
                          button.getAttribute('aria-selected') === 'true' ||
                          button.getAttribute('data-highlighted') === 'true' ||
                          button.getAttribute('data-selected') === 'true' ||
                          button.matches(':focus') ||
                          button.matches(':focus-visible');

      if (hasHighlight) {
        selectedButton = button;
        console.log(`QuickJobSwitcher: ✅ Using highlighted job: ${text.substring(0, 50)}`);
        break;
      }
    }

    // Strategy 2: Check if there's a currently focused element that's a job
    if (!selectedButton) {
      const activeElement = document.activeElement;

      // Check if the active element is a job button in the sidebar (not the search input)
      if (activeElement &&
          sidebar.contains(activeElement) &&
          activeElement.getAttribute('role') === 'button' &&
          activeElement.tagName !== 'INPUT') {
        const text = activeElement.textContent.trim();
        // Make sure it's not the close button or header
        if (text !== 'Close' && text !== '×' && text !== 'X' &&
            !text.includes('Job Switcher') &&
            !activeElement.querySelector('path[d*="M18 6"]')) {
          selectedButton = activeElement;
          console.log(`QuickJobSwitcher: ✅ Using focused job: ${text.substring(0, 50)}`);
        }
      }
    }

    // Strategy 3: Fall back to finding the top job in the list
    if (!selectedButton) {
      // Find the scrollable job list container
      const jobList = sidebar.querySelector('.overflow-y-auto') || sidebar;
      const jobButtons = jobList.querySelectorAll('div[role="button"][tabindex="0"]');
      console.log(`QuickJobSwitcher: Found ${jobButtons.length} buttons in sidebar`);

      // Find the first actual job (skip close button and header)
      for (const button of jobButtons) {
        const text = button.textContent.trim();

        // Skip close button
        if (text === 'Close' || text === '×' || text === 'X' ||
            button.querySelector('path[d*="M18 6"]') ||
            button.querySelector('path[d*="M6 18"]')) {
          continue;
        }

        // Skip header
        if (text.includes('Job Switcher')) {
          continue;
        }

        // Skip if it's just whitespace or very short (likely an icon-only button)
        if (text.length < 3) {
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

      // Close sidebar after clicking - use a slightly longer delay to let click process
      // If navigation happens, sidebar will be removed anyway
      // If it doesn't navigate (same job), we want it to close
      setTimeout(() => {
        closeSidebar();
      }, 100);
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
