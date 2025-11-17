// Action Items Completion Module
// Adds checkboxes to Action Items card for quick task completion

const ActionItemsCompletion = (() => {
  // Track which action items have checkboxes added
  const processedItems = new WeakSet();

  /**
   * Initialize action items completion feature
   */
  function init() {
    console.log('ActionItemsCompletion: Initializing...');

    // Check if we're returning from a completion operation
    checkAndCompleteNavigation();

    // Add checkboxes to action items
    addCompletionCheckboxes();

    // Watch for changes to the Action Items card
    const observer = new MutationObserver(() => {
      addCompletionCheckboxes();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('ActionItemsCompletion: Initialized');
  }

  /**
   * Find the Action Items card on the page
   * @returns {HTMLElement|null} The Action Items card container
   */
  function findActionItemsCard() {
    // Look for a heading that says "Action Items"
    const headings = document.querySelectorAll('h2, h3, h4, div.font-bold, span.font-bold');

    for (const heading of headings) {
      if (heading.textContent.trim() === 'Action Items') {
        // Find the parent container
        const card = heading.closest('div.bg-white, div.rounded, div.shadow, div[class*="card"]');
        if (card) {
          console.log('ActionItemsCompletion: Found Action Items card');
          return card;
        }
      }
    }

    return null;
  }

  /**
   * Add completion checkboxes to all action items
   */
  function addCompletionCheckboxes() {
    const card = findActionItemsCard();
    if (!card) {
      return;
    }

    // Find all action item links
    // These are <a> tags with href containing /schedule?taskId= or /to-dos
    const actionItems = card.querySelectorAll('a[href*="/schedule?taskId="], a[href*="/to-dos"]');
    console.log(`ActionItemsCompletion: Found ${actionItems.length} action items`);

    actionItems.forEach(item => {
      // Skip if already processed
      if (processedItems.has(item)) {
        return;
      }

      // Skip if checkbox already exists
      if (item.querySelector('.jt-action-item-checkbox')) {
        return;
      }

      // Extract task ID from href
      const taskId = extractTaskId(item.getAttribute('href'));
      if (!taskId) {
        console.log('ActionItemsCompletion: Could not extract task ID from href');
        return;
      }

      // Create checkbox button (always unchecked - if task is complete, it won't be in Action Items)
      const checkbox = createCheckboxButton(false);

      // Find the View button
      const viewButton = findViewButton(item);
      if (!viewButton) {
        console.log('ActionItemsCompletion: Could not find View button');
        return;
      }

      // Insert checkbox before the View button
      viewButton.parentNode.insertBefore(checkbox, viewButton);

      // Mark as processed
      processedItems.add(item);

      // Add click handler
      checkbox.addEventListener('click', (e) => handleCheckboxClick(e, item, checkbox, taskId));
    });
  }

  /**
   * Extract task ID from href
   * @param {string} href - The href attribute value
   * @returns {string|null} The task ID or null
   */
  function extractTaskId(href) {
    if (!href) return null;

    // Extract from /schedule?taskId=XXXXX
    const taskIdMatch = href.match(/taskId=([^&]+)/);
    if (taskIdMatch) {
      return taskIdMatch[1];
    }

    // Extract from /to-dos/XXXXX
    const todoMatch = href.match(/\/to-dos\/([^/?]+)/);
    if (todoMatch) {
      return todoMatch[1];
    }

    return null;
  }

  /**
   * Find the View button in an action item
   * @param {HTMLElement} item - The action item link element
   * @returns {HTMLElement|null} The View button or null
   */
  function findViewButton(item) {
    // Look for a button with text "View"
    const buttons = item.querySelectorAll('div[role="button"]');

    for (const button of buttons) {
      const text = button.textContent.trim();
      if (text === 'View' || text.toLowerCase().includes('view')) {
        return button;
      }
    }

    // Fallback: look for any element with "View" text
    const allDivs = item.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.textContent.trim() === 'View') {
        return div;
      }
    }

    return null;
  }

  /**
   * Create the checkbox button element
   * @param {boolean} isComplete - Whether the task is currently complete
   * @returns {HTMLElement} The checkbox button
   */
  function createCheckboxButton(isComplete = false) {
    const button = document.createElement('div');
    button.className = 'jt-action-item-checkbox inline-block align-middle cursor-pointer p-1 rounded hover:bg-gray-100';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.style.cssText = 'margin-right: 8px; flex-shrink: 0;';

    // Create SVG checkbox icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('class', 'inline-block overflow-visible');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');

    // Checkbox rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '18');
    rect.setAttribute('height', '18');
    rect.setAttribute('x', '3');
    rect.setAttribute('y', '3');
    rect.setAttribute('rx', '2');
    svg.appendChild(rect);

    // Add checkmark if task is complete
    if (isComplete) {
      const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      checkmark.setAttribute('d', 'M20 6 9 17l-5-5');
      checkmark.setAttribute('class', 'jt-checkmark');
      svg.appendChild(checkmark);
    }

    button.appendChild(svg);

    // Add title for tooltip
    button.setAttribute('title', isComplete ? 'Task marked complete' : 'Mark task complete');

    return button;
  }

  /**
   * Update checkbox visual state
   * @param {HTMLElement} checkbox - The checkbox button element
   * @param {boolean} isComplete - Whether the task is now complete
   */
  function updateCheckboxState(checkbox, isComplete) {
    const svg = checkbox.querySelector('svg');
    if (!svg) return;

    // Remove existing checkmark if present
    const existingCheckmark = svg.querySelector('.jt-checkmark');
    if (existingCheckmark) {
      existingCheckmark.remove();
    }

    // Add checkmark if task is complete
    if (isComplete) {
      const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      checkmark.setAttribute('d', 'M20 6 9 17l-5-5');
      checkmark.setAttribute('class', 'jt-checkmark');
      svg.appendChild(checkmark);
    }

    // Update tooltip
    checkbox.setAttribute('title', isComplete ? 'Task marked complete' : 'Mark task complete');
  }

  /**
   * Handle checkbox click
   * @param {Event} e - The click event
   * @param {HTMLElement} item - The action item link element
   * @param {HTMLElement} checkbox - The checkbox button element
   * @param {string} taskId - The task ID
   */
  function handleCheckboxClick(e, item, checkbox, taskId) {
    // Prevent default link navigation
    e.stopPropagation();
    e.preventDefault();

    console.log('ActionItemsCompletion: Checkbox clicked for task:', taskId);

    // Show loading state
    checkbox.style.opacity = '0.5';
    checkbox.style.pointerEvents = 'none';

    // Store state for navigation completion
    const navigationState = {
      taskId,
      returnUrl: window.location.href,
      targetUrl: item.getAttribute('href'),
      timestamp: Date.now()
    };

    try {
      sessionStorage.setItem('jt-action-item-navigation', JSON.stringify(navigationState));
      console.log('ActionItemsCompletion: Navigating to task page (hidden):', navigationState.targetUrl);

      // Navigate to the task page (CSS hiding will be applied on load)
      window.location.href = navigationState.targetUrl;
    } catch (e) {
      console.error('ActionItemsCompletion: Error saving navigation state:', e);

      // Restore checkbox
      checkbox.style.opacity = '';
      checkbox.style.pointerEvents = '';

      if (window.UIUtils) {
        window.UIUtils.showNotification('Failed to complete task');
      }
    }
  }

  /**
   * Check if we're returning from a completion operation and complete it
   */
  function checkAndCompleteNavigation() {
    let navigationState = null;

    try {
      const data = sessionStorage.getItem('jt-action-item-navigation');
      if (data) {
        navigationState = JSON.parse(data);
      }
    } catch (e) {
      console.error('ActionItemsCompletion: Error reading navigation state:', e);
      return;
    }

    if (!navigationState) {
      return;
    }

    console.log('ActionItemsCompletion: Found navigation state, completing task:', navigationState.taskId);

    // Clear navigation state
    sessionStorage.removeItem('jt-action-item-navigation');

    // Check if we're on the task page (not the return page yet)
    if (window.location.href !== navigationState.returnUrl) {
      console.log('ActionItemsCompletion: On task page, starting completion process...');

      // Wait for page to fully load
      setTimeout(() => {
        completeTaskHeadless(navigationState);
      }, 1500);
    }
  }

  /**
   * Complete the task using headless sidebar interaction with CSS hiding
   * @param {Object} navigationState - The navigation state object
   */
  function completeTaskHeadless(navigationState) {
    console.log('ActionItemsCompletion: Starting headless task completion...');

    // Inject CSS to hide sidebar (make page look unchanged to user)
    const hideStyle = window.SidebarManager ?
      window.SidebarManager.injectHideSidebarCSS() : null;

    // Failsafe: Clean up after 10 seconds
    const failsafeTimeout = setTimeout(() => {
      console.log('ActionItemsCompletion: Failsafe timeout triggered');
      if (window.SidebarManager) {
        window.SidebarManager.removeSidebarCSS();
      }
      navigateBack(navigationState, false);
    }, 10000);

    // Wait for sidebar to be present (it should already be open because URL has ?taskId=)
    setTimeout(() => {
      const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

      if (!sidebar) {
        console.error('ActionItemsCompletion: Sidebar not found (should be auto-opened by taskId URL param)');
        clearTimeout(failsafeTimeout);
        if (hideStyle) hideStyle.remove();
        navigateBack(navigationState, false);
        return;
      }

      console.log('ActionItemsCompletion: Sidebar found (auto-opened for correct task), finding progress checkbox...');

      // Find the Progress checkbox
      const progressCheckbox = findProgressCheckbox(sidebar);

      if (!progressCheckbox) {
        console.error('ActionItemsCompletion: Could not find progress checkbox');
        clearTimeout(failsafeTimeout);
        if (hideStyle) hideStyle.remove();
        navigateBack(navigationState, false);
        return;
      }

      console.log('ActionItemsCompletion: Found progress checkbox, clicking it...');

      // Click the checkbox to mark complete
      progressCheckbox.click();

      // Wait for the change to register, then find and click Save button
      setTimeout(async () => {
        console.log('ActionItemsCompletion: Progress checkbox clicked, finding Save button...');

        // Find the Save button in toolbar
        const saveButton = findSaveButton();

        if (!saveButton) {
          console.error('ActionItemsCompletion: Could not find Save button');
          clearTimeout(failsafeTimeout);
          if (hideStyle) hideStyle.remove();
          navigateBack(navigationState, false);
          return;
        }

        console.log('ActionItemsCompletion: Found Save button, waiting for it to enable...');

        // Wait for Save button to become enabled
        const isEnabled = await waitForSaveButtonEnabled(saveButton, 2000);

        if (!isEnabled) {
          console.error('ActionItemsCompletion: Save button did not enable in time');
          clearTimeout(failsafeTimeout);
          if (hideStyle) hideStyle.remove();
          navigateBack(navigationState, false);
          return;
        }

        console.log('ActionItemsCompletion: Save button enabled, clicking it...');
        console.log('ActionItemsCompletion: Save button classes before click:', saveButton.className);

        // Click the Save button (use both click methods for better compatibility)
        saveButton.click();

        // Also dispatch a mouse event for better React compatibility
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        saveButton.dispatchEvent(clickEvent);

        console.log('ActionItemsCompletion: Save button clicked');

        // Wait longer for save to complete (give server time to process)
        setTimeout(() => {
          console.log('ActionItemsCompletion: Task saved, cleaning up...');

          // Clear failsafe
          clearTimeout(failsafeTimeout);

          // Close sidebar first, then navigate back
          if (window.SidebarManager) {
            window.SidebarManager.closeSidebar(null, () => {
              // Wait a bit more after sidebar closes before navigating
              setTimeout(() => {
                // Navigate back
                navigateBack(navigationState, true);
              }, 500);
            });
          } else {
            if (hideStyle) hideStyle.remove();
            // Wait before navigating to ensure save completes
            setTimeout(() => {
              navigateBack(navigationState, true);
            }, 500);
          }
        }, 1500);
      }, 800);
    }, 1000);
  }

  /**
   * Find the progress checkbox in the sidebar
   * @param {HTMLElement} sidebar - The sidebar element
   * @returns {HTMLElement|null} The progress checkbox or null
   */
  function findProgressCheckbox(sidebar) {
    const allLabels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const progressLabel = allLabels.find(span => span.textContent.trim() === 'Progress');
    if (!progressLabel) return null;

    const progressContainer = progressLabel.closest('div.flex.items-center.space-x-1');
    if (!progressContainer) return null;

    return progressContainer.querySelector('div[role="button"]');
  }

  /**
   * Find the Save button in the toolbar
   * @returns {HTMLElement|null} The Save button or null
   */
  function findSaveButton() {
    const allButtons = Array.from(document.querySelectorAll('div[role="button"]'));

    for (const button of allButtons) {
      const text = button.textContent.trim();
      const hasCheckmark = button.querySelector('path[d="M20 6 9 17l-5-5"]');

      if (hasCheckmark && text.includes('Save')) {
        return button;
      }
    }

    return null;
  }

  /**
   * Wait for a Save button element to become enabled
   * @param {HTMLElement} button - The Save button element
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} True if button became enabled, false if timeout
   */
  function waitForSaveButtonEnabled(button, maxWaitMs = 2000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkEnabled = () => {
        const classes = button.className;
        const isDisabled = classes.includes('pointer-events-none');

        if (!isDisabled) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime >= maxWaitMs) {
          resolve(false);
          return;
        }

        setTimeout(checkEnabled, 100);
      };

      checkEnabled();
    });
  }

  /**
   * Navigate back to the original page
   * @param {Object} navigationState - The navigation state object
   * @param {boolean} success - Whether the completion was successful
   */
  function navigateBack(navigationState, success) {
    console.log('ActionItemsCompletion: Navigating back to:', navigationState.returnUrl);

    // Navigate back
    window.location.href = navigationState.returnUrl;
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    const checkboxes = document.querySelectorAll('.jt-action-item-checkbox');
    checkboxes.forEach(checkbox => checkbox.remove());
    console.log('ActionItemsCompletion: Cleaned up checkboxes');
  }

  // Public API
  return {
    init,
    cleanup,
    addCompletionCheckboxes
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ActionItemsCompletion = ActionItemsCompletion;
}
