// Action Items Completion Module
// Adds checkboxes to Action Items card for quick task completion

const ActionItemsCompletion = (() => {
  // Track which action items have checkboxes added
  const processedItems = new WeakSet();

  // Store completion state across page navigation
  const STORAGE_KEY = 'jt-action-items-completion-state';

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

      // Check if this task is marked as complete in storage
      const isComplete = isTaskMarkedComplete(taskId);

      // Create checkbox button
      const checkbox = createCheckboxButton(isComplete);

      // Find the task name container (div.font-bold)
      const taskNameContainer = item.querySelector('div.font-bold');
      if (!taskNameContainer) {
        console.log('ActionItemsCompletion: Could not find task name container');
        return;
      }

      // Insert checkbox before the task name (Option A position)
      taskNameContainer.parentNode.insertBefore(checkbox, taskNameContainer);

      // Mark as processed
      processedItems.add(item);

      // Add click handler
      checkbox.addEventListener('click', (e) => handleCheckboxClick(e, item, checkbox, taskId));

      // Apply strikethrough if marked complete
      if (isComplete) {
        applyCompletionStyle(item);
      }
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
   * Check if a task is marked as complete in storage
   * @param {string} taskId - The task ID
   * @returns {boolean} True if task is marked complete
   */
  function isTaskMarkedComplete(taskId) {
    const storage = getCompletionStorage();
    return storage.completedTasks.includes(taskId);
  }

  /**
   * Mark a task as complete in storage
   * @param {string} taskId - The task ID
   */
  function markTaskComplete(taskId) {
    const storage = getCompletionStorage();
    if (!storage.completedTasks.includes(taskId)) {
      storage.completedTasks.push(taskId);
      saveCompletionStorage(storage);
    }
  }

  /**
   * Get completion storage from localStorage
   * @returns {Object} Storage object
   */
  function getCompletionStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { completedTasks: [] };
    } catch (e) {
      console.error('ActionItemsCompletion: Error reading storage:', e);
      return { completedTasks: [] };
    }
  }

  /**
   * Save completion storage to localStorage
   * @param {Object} storage - Storage object
   */
  function saveCompletionStorage(storage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch (e) {
      console.error('ActionItemsCompletion: Error saving storage:', e);
    }
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
   * Apply completion styling to an action item
   * @param {HTMLElement} item - The action item link element
   */
  function applyCompletionStyle(item) {
    // Add strikethrough to task name
    const taskNameContainer = item.querySelector('div.font-bold');
    if (taskNameContainer) {
      taskNameContainer.style.textDecoration = 'line-through';
      taskNameContainer.style.opacity = '0.6';
    }
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

    // Check if already marked complete
    if (isTaskMarkedComplete(taskId)) {
      console.log('ActionItemsCompletion: Task already marked complete');
      if (window.UIUtils) {
        window.UIUtils.showNotification('Task already completed');
      }
      return;
    }

    // Show loading state
    checkbox.style.opacity = '0.5';
    checkbox.style.pointerEvents = 'none';

    // Store navigation state
    const navigationState = {
      taskId,
      returnUrl: window.location.href,
      targetUrl: item.getAttribute('href'),
      timestamp: Date.now()
    };

    try {
      sessionStorage.setItem('jt-action-item-navigation', JSON.stringify(navigationState));
    } catch (e) {
      console.error('ActionItemsCompletion: Error saving navigation state:', e);
    }

    // Navigate to the task page
    console.log('ActionItemsCompletion: Navigating to task page:', navigationState.targetUrl);
    window.location.href = navigationState.targetUrl;
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
   * Complete the task using headless sidebar interaction
   * @param {Object} navigationState - The navigation state object
   */
  function completeTaskHeadless(navigationState) {
    console.log('ActionItemsCompletion: Starting headless task completion...');

    // Inject CSS to hide sidebar
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

    // Find the task card on the page
    const taskCard = findTaskCardOnPage();

    if (!taskCard) {
      console.error('ActionItemsCompletion: Could not find task card on page');
      clearTimeout(failsafeTimeout);
      if (hideStyle) hideStyle.remove();
      navigateBack(navigationState, false);
      return;
    }

    console.log('ActionItemsCompletion: Found task card, opening sidebar...');

    // Open the sidebar
    if (window.SidebarManager) {
      window.SidebarManager.openSidebar(taskCard);
    } else {
      taskCard.click();
    }

    // Wait for sidebar to open
    setTimeout(() => {
      const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

      if (!sidebar) {
        console.error('ActionItemsCompletion: Sidebar did not open');
        clearTimeout(failsafeTimeout);
        if (hideStyle) hideStyle.remove();
        navigateBack(navigationState, false);
        return;
      }

      console.log('ActionItemsCompletion: Sidebar opened, finding progress checkbox...');

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
      setTimeout(() => {
        console.log('ActionItemsCompletion: Progress checkbox clicked, finding Save button...');

        // Find the Save button
        const saveButton = findSaveButton(sidebar);

        if (!saveButton) {
          console.error('ActionItemsCompletion: Could not find Save button');
          clearTimeout(failsafeTimeout);
          if (hideStyle) hideStyle.remove();
          navigateBack(navigationState, false);
          return;
        }

        console.log('ActionItemsCompletion: Found Save button, clicking it...');

        // Click the Save button
        saveButton.click();

        // Wait for save to complete
        setTimeout(() => {
          console.log('ActionItemsCompletion: Task saved, cleaning up...');

          // Clear failsafe
          clearTimeout(failsafeTimeout);

          // Close sidebar
          if (window.SidebarManager) {
            window.SidebarManager.closeSidebar(null, () => {
              // Navigate back
              navigateBack(navigationState, true);
            });
          } else {
            if (hideStyle) hideStyle.remove();
            navigateBack(navigationState, true);
          }
        }, 500);
      }, 300);
    }, 1000);
  }

  /**
   * Find the task card on the current page
   * @returns {HTMLElement|null} The task card element
   */
  function findTaskCardOnPage() {
    // Try to find schedule items
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');

    if (scheduleItems.length > 0) {
      console.log('ActionItemsCompletion: Found schedule items:', scheduleItems.length);
      // Return the first one (should be the task we navigated to)
      return scheduleItems[0];
    }

    // If no schedule items, look for any clickable task card
    const taskCards = document.querySelectorAll('[class*="task"], [class*="card"]');
    if (taskCards.length > 0) {
      console.log('ActionItemsCompletion: Found task cards:', taskCards.length);
      return taskCards[0];
    }

    return null;
  }

  /**
   * Find the progress checkbox in the sidebar
   * @param {HTMLElement} sidebar - The sidebar element
   * @returns {HTMLElement|null} The progress checkbox or null
   */
  function findProgressCheckbox(sidebar) {
    // Look for the Progress label
    const allLabels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const progressLabel = allLabels.find(span => span.textContent.trim() === 'Progress');

    if (!progressLabel) {
      console.log('ActionItemsCompletion: Progress label not found');
      console.log('ActionItemsCompletion: Available labels:', allLabels.map(l => l.textContent.trim()));
      return null;
    }

    console.log('ActionItemsCompletion: Found Progress label');

    // Find the container with Progress label
    const progressContainer = progressLabel.closest('div.flex.items-center.space-x-1');
    if (!progressContainer) {
      console.log('ActionItemsCompletion: Could not find progress container');
      return null;
    }

    // Find the checkbox button in the progress container
    const checkboxButton = progressContainer.querySelector('div[role="button"]');
    if (!checkboxButton) {
      console.log('ActionItemsCompletion: Could not find checkbox button in progress container');
      return null;
    }

    console.log('ActionItemsCompletion: Found progress checkbox button');
    return checkboxButton;
  }

  /**
   * Find the Save button in the sidebar
   * @param {HTMLElement} sidebar - The sidebar element
   * @returns {HTMLElement|null} The Save button or null
   */
  function findSaveButton(sidebar) {
    // Look for blue button with text "Save"
    // Button classes: bg-blue-500, border-blue-600
    const allButtons = Array.from(sidebar.querySelectorAll('div[role="button"]'));

    console.log('ActionItemsCompletion: Checking buttons for Save button...');

    for (const button of allButtons) {
      const text = button.textContent.trim();
      const classes = button.className;

      // Check if button has "Save" text and blue styling
      if (text === 'Save' || text.includes('Save')) {
        // Verify it's the blue save button (not other buttons)
        if (classes.includes('bg-blue-500') || classes.includes('bg-blue-600')) {
          console.log('ActionItemsCompletion: Found Save button (blue button with Save text)');
          return button;
        }
      }
    }

    // Fallback: look for any button with Save text
    const saveButton = allButtons.find(button => {
      const text = button.textContent.trim();
      return text === 'Save' || text.includes('Save');
    });

    if (saveButton) {
      console.log('ActionItemsCompletion: Found Save button (fallback search)');
      return saveButton;
    }

    console.log('ActionItemsCompletion: Save button not found');
    console.log('ActionItemsCompletion: Available button texts:', allButtons.map(b => b.textContent.trim()));
    return null;
  }

  /**
   * Navigate back to the original page
   * @param {Object} navigationState - The navigation state object
   * @param {boolean} success - Whether the completion was successful
   */
  function navigateBack(navigationState, success) {
    console.log('ActionItemsCompletion: Navigating back to:', navigationState.returnUrl);

    if (success) {
      // Mark task as complete in storage
      markTaskComplete(navigationState.taskId);
    }

    // Store success state for notification
    try {
      sessionStorage.setItem('jt-action-item-completed', JSON.stringify({
        taskId: navigationState.taskId,
        success
      }));
    } catch (e) {
      console.error('ActionItemsCompletion: Error saving completion state:', e);
    }

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
