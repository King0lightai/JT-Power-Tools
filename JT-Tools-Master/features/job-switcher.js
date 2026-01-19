// JobTread Smart Job Switcher Feature
// Keyboard shortcuts: J+S or ALT+J to quickly search and switch jobs
// Features: Quick job search, keyboard navigation, resizable sidebar

const SmartJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearchOpen = false;
  let jKeyPressed = false;
  let sidebarObserver = null;
  let lastMainContent = null; // Track the main content element for cleanup
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
  const SIDEBAR_SELECTOR = 'div.z-30.absolute.top-0.bottom-0.right-0';

  /**
   * Check if a sidebar element is specifically the Job Switcher
   * (not other sidebars like document viewers, etc.)
   */
  function isJobSwitcherSidebar(sidebar) {
    if (!sidebar) return false;

    // Check for "JOB SWITCHER" text in the header
    const headerText = sidebar.textContent || '';
    if (headerText.includes('JOB SWITCHER') || headerText.includes('Job Switcher')) {
      return true;
    }

    // Check for job search input placeholder
    const searchInput = sidebar.querySelector('input[placeholder*="Search Jobs"]') ||
                       sidebar.querySelector('input[placeholder*="Search jobs"]');
    if (searchInput) {
      return true;
    }

    // Check for the job list structure (multiple job entries with addresses)
    const jobEntries = sidebar.querySelectorAll('[role="button"]');
    let jobLikeEntries = 0;
    for (const entry of jobEntries) {
      const text = entry.textContent || '';
      // Job entries typically have address patterns or job numbers like "25-1001"
      if (/\d{2}-\d{4}/.test(text) || /\d+\s+\w+\s+(st|street|ave|avenue|ln|lane|dr|drive|rd|road)/i.test(text)) {
        jobLikeEntries++;
      }
    }
    if (jobLikeEntries >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Find the Job Switcher sidebar specifically
   */
  function findJobSwitcherSidebar() {
    const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
    for (const sidebar of sidebars) {
      if (isJobSwitcherSidebar(sidebar)) {
        return sidebar;
      }
    }
    return null;
  }

  /**
   * Get saved sidebar width from chrome.storage.sync
   */
  async function getSavedWidth() {
    try {
      const data = await chrome.storage.sync.get(STORAGE_KEY);
      const saved = data[STORAGE_KEY];
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
          return width;
        }
      }
    } catch (e) {
      console.warn('SmartJobSwitcher: Could not read saved width', e);
    }
    return DEFAULT_WIDTH;
  }

  /**
   * Save sidebar width to chrome.storage.sync
   */
  function saveWidth(width) {
    try {
      chrome.storage.sync.set({ [STORAGE_KEY]: String(width) });
    } catch (e) {
      console.warn('SmartJobSwitcher: Could not save width', e);
    }
  }

  /**
   * Create and inject the resize handle into the sidebar
   */
  async function injectResizeHandle(sidebar) {
    // Safety check: only inject into Job Switcher sidebar
    if (!isJobSwitcherSidebar(sidebar)) {
      return;
    }

    // Check if resize handle already exists
    if (sidebar.querySelector('.jt-resize-handle')) {
      // Still apply saved width in case sidebar was recreated
      await applySavedWidth(sidebar);
      return;
    }

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
    await applySavedWidth(sidebar);
  }

  /**
   * Apply saved width to sidebar and trigger reflow
   */
  async function applySavedWidth(sidebar) {
    const savedWidth = await getSavedWidth();
    updateSidebarWidth(sidebar, savedWidth);
  }

  /**
   * Find the main content container that JobTread uses for padding adjustment
   * JobTread uses a container with inline padding-right style matching sidebar width
   */
  function findMainContentContainer(sidebar) {
    // Get the current sidebar width to help identify the right element
    const sidebarWidth = sidebar.offsetWidth || DEFAULT_WIDTH;

    // Strategy 1: Look for sidebar's sibling with inline padding-right style
    // This is the most reliable because JobTread sets padding-right dynamically
    const parent = sidebar.parentElement;
    if (parent) {
      for (const sibling of parent.children) {
        if (sibling === sidebar) continue;

        // Check if this sibling has padding-right in inline style
        const inlinePaddingRight = sibling.style.paddingRight;
        if (inlinePaddingRight) {
          return sibling;
        }
      }
    }

    // Strategy 2: Look for siblings with grow class that have computed padding-right
    if (parent) {
      for (const sibling of parent.children) {
        if (sibling === sidebar) continue;

        if (sibling.classList.contains('grow') ||
            sibling.classList.contains('flex-1') ||
            sibling.classList.contains('flex-grow') ||
            sibling.classList.contains('min-w-0')) {
          // Check if it has significant padding-right (indicating sidebar awareness)
          const computed = window.getComputedStyle(sibling);
          const computedPadding = parseInt(computed.paddingRight, 10);
          if (computedPadding > 100) {
            return sibling;
          }
        }
      }
    }

    // Strategy 3: Find any sibling with grow class (fallback)
    if (parent) {
      for (const sibling of parent.children) {
        if (sibling === sidebar) continue;

        if (sibling.classList.contains('grow') ||
            sibling.classList.contains('flex-1') ||
            sibling.classList.contains('flex-grow')) {
          return sibling;
        }
      }
    }

    return null;
  }

  /**
   * Update sidebar width and adjust main content area
   */
  function updateSidebarWidth(sidebar, newWidth) {
    // Remove max-width constraint that might interfere
    sidebar.style.maxWidth = 'none';
    sidebar.style.width = `${newWidth}px`;

    // Find ALL elements with inline padding-right that might need updating
    // JobTread sets padding-right on multiple elements when sidebar is open
    const parent = sidebar.parentElement;
    if (parent) {
      // Update all siblings that have inline padding-right
      for (const sibling of parent.children) {
        if (sibling === sidebar) continue;

        if (sibling.style.paddingRight) {
          sibling.style.paddingRight = `${newWidth}px`;
        }
      }

      // Also check if parent has padding-right
      if (parent.style.paddingRight) {
        parent.style.paddingRight = `${newWidth}px`;
      }
    }

    // Also look for elements with padding-right set anywhere in the page
    // that matches approximately the default sidebar width
    const elementsWithPadding = document.querySelectorAll('[style*="padding-right"]');
    for (const el of elementsWithPadding) {
      if (el === sidebar || sidebar.contains(el)) continue;

      const currentPadding = parseInt(el.style.paddingRight, 10);
      // Update if padding is significant (likely set for sidebar)
      if (currentPadding >= MIN_WIDTH && currentPadding <= MAX_WIDTH) {
        el.style.paddingRight = `${newWidth}px`;
      }
    }

    // Force a reflow to ensure the width is applied
    void sidebar.offsetWidth;

    // Dispatch resize event to notify any listeners
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Reset tracking when sidebar closes
   * Note: JobTread handles resetting the main content padding itself when the sidebar closes
   */
  function resetMainContentMargin() {
    if (lastMainContent) {
      lastMainContent = null;
    }
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
  }

  /**
   * Handle mouse move during resize
   */
  function handleResizeMove(e) {
    if (!resizeState.isResizing) return;

    const sidebar = findJobSwitcherSidebar();
    if (!sidebar) {
      handleResizeEnd();
      return;
    }

    // Calculate new width (dragging left increases width since sidebar is on right)
    const deltaX = resizeState.startX - e.clientX;
    let newWidth = resizeState.startWidth + deltaX;

    // Clamp to min/max
    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

    // Apply new width and update main content
    updateSidebarWidth(sidebar, newWidth);
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
    const sidebar = findJobSwitcherSidebar();
    if (sidebar) {
      const finalWidth = sidebar.offsetWidth;
      saveWidth(finalWidth);

      // Reset resize handle visual
      const resizeHandle = sidebar.querySelector('.jt-resize-handle');
      if (resizeHandle) {
        resizeHandle.style.background = 'transparent';
      }
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
        // Check for added nodes (sidebar opening)
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a sidebar or contains one
            const sidebar = node.matches?.(SIDEBAR_SELECTOR)
              ? node
              : node.querySelector?.(SIDEBAR_SELECTOR);

            if (sidebar) {
              // Small delay to ensure sidebar is fully rendered, then check if it's the Job Switcher
              setTimeout(async () => {
                if (isJobSwitcherSidebar(sidebar)) {
                  await injectResizeHandle(sidebar);
                }
              }, 50);
            }
          }
        }

        // Check for removed nodes (sidebar closing)
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the removed node had our resize handle (meaning it was a Job Switcher we modified)
            const hadResizeHandle = node.querySelector?.('.jt-resize-handle') ||
                                   node.classList?.contains('jt-resize-handle');

            if (hadResizeHandle) {
              // Reset main content margin when Job Switcher sidebar is removed
              resetMainContentMargin();
            }
          }
        }
      }
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check if Job Switcher sidebar is already present
    const existingSidebar = findJobSwitcherSidebar();
    if (existingSidebar) {
      injectResizeHandle(existingSidebar); // async but fire-and-forget is fine here
    }
  }

  /**
   * Stop observing for sidebar appearances
   */
  function stopSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActive) {
      return;
    }

    isActive = true;

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    // Start observing for sidebar to add resize handle and filter UI
    startSidebarObserver();

    console.log('SmartJobSwitcher: Activated');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      return;
    }

    isActive = false;

    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);

    // Stop sidebar observer
    stopSidebarObserver();

    // Clean up any active resize state
    if (resizeState.isResizing) {
      handleResizeEnd();
    }

    // Reset main content margin
    resetMainContentMargin();

    closeSidebar();

    console.log('SmartJobSwitcher: Deactivated');
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
        e.preventDefault();
        e.stopPropagation();
        // Reset J key state immediately after opening
        jKeyPressed = false;
        openSidebar();
      }
      return;
    }

    // If sidebar is open and Enter is pressed, select top job and close
    if (isSearchOpen && e.key === 'Enter') {
      // Try multiple selectors for the search input
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                         document.querySelector('div.z-30.absolute input[type="text"]') ||
                         document.querySelector('div.z-30 input');

      // If we're in the sidebar (search input exists and is focused, or just in the sidebar)
      const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
      const isInSidebar = sidebar && sidebar.contains(document.activeElement);

      if ((searchInput && document.activeElement === searchInput) || isInSidebar) {
        e.preventDefault();
        e.stopPropagation();
        selectTopJobAndClose();
        return;
      }
    }

    // Close sidebar on Escape
    if (isSearchOpen && e.key === 'Escape') {
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
      showErrorNotification('Could not find job switcher button. Make sure you\'re on a job page.');
      return;
    }

    // Click to open sidebar
    jobNumberButton.click();
    isSearchOpen = true;

    // Focus the search input after a short delay to let sidebar render
    setTimeout(() => {
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                         document.querySelector('div.z-30.absolute input[type="text"]') ||
                         document.querySelector('div.z-30 input');

      if (searchInput) {
        searchInput.focus();
      }
    }, 150);
  }

  /**
   * Close the job switcher sidebar
   */
  function closeSidebar() {
    if (!isSearchOpen) {
      return;
    }

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
      } else {
        // Strategy 2: Try clicking outside the sidebar (on the overlay)
        const overlay = document.querySelector('div.z-30.absolute.inset-0:not(.top-0)') ||
                       document.querySelector('div.z-20.fixed.inset-0') ||
                       document.querySelector('[class*="backdrop"]') ||
                       document.querySelector('[class*="overlay"]');
        if (overlay) {
          overlay.click();
        } else {
          // Strategy 3: Dispatch Escape key to close
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
    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (!sidebar) {
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
        }
      }
    }

    // Strategy 3: Fall back to finding the top job in the list
    if (!selectedButton) {
      // Find the scrollable job list container
      const jobList = sidebar.querySelector('.overflow-y-auto') || sidebar;
      const jobButtons = jobList.querySelectorAll('div[role="button"][tabindex="0"]');

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
        break;
      }
    }

    if (selectedButton) {
      // Click the job button to navigate
      selectedButton.click();

      // Close sidebar after clicking - use a slightly longer delay to let click process
      // If navigation happens, sidebar will be removed anyway
      // If it doesn't navigate (same job), we want it to close
      setTimeout(() => {
        closeSidebar();
      }, 100);
    } else {
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
  window.SmartJobSwitcherFeature = SmartJobSwitcherFeature;
}
