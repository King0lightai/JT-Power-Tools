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

    // Get the target URL
    const targetUrl = item.getAttribute('href');
    console.log('ActionItemsCompletion: Completing task in background iframe:', targetUrl);

    // Complete the task in a hidden iframe (no page navigation)
    completeTaskInIframe(targetUrl, taskId, (success) => {
      if (success) {
        console.log('ActionItemsCompletion: Task completed successfully');

        // Mark task as complete in storage
        markTaskComplete(taskId);

        // Fade out and remove the action item from the list
        item.style.transition = 'opacity 0.3s ease-out';
        item.style.opacity = '0';

        setTimeout(() => {
          item.remove();
          console.log('ActionItemsCompletion: Removed action item from list');
        }, 300);

        // Show notification
        if (window.UIUtils) {
          window.UIUtils.showNotification('Task completed');
        }
      } else {
        console.error('ActionItemsCompletion: Task completion failed');

        // Restore checkbox
        checkbox.style.opacity = '';
        checkbox.style.pointerEvents = '';

        // Show error notification
        if (window.UIUtils) {
          window.UIUtils.showNotification('Failed to complete task');
        }
      }
    });
  }

  /**
   * Complete a task in a hidden iframe (no visible page navigation)
   * @param {string} targetUrl - The URL of the task page
   * @param {string} taskId - The task ID
   * @param {Function} callback - Callback function (success: boolean)
   */
  function completeTaskInIframe(targetUrl, taskId, callback) {
    console.log('ActionItemsCompletion: Creating hidden iframe for task completion');

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position: absolute; top: -9999px; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');

    // Failsafe timeout
    const failsafeTimeout = setTimeout(() => {
      console.error('ActionItemsCompletion: Failsafe timeout - removing iframe');
      if (iframe.parentNode) {
        iframe.remove();
      }
      callback(false);
    }, 15000);

    // When iframe loads, complete the task inside it
    iframe.onload = () => {
      console.log('ActionItemsCompletion: Iframe loaded, waiting for page initialization...');

      // Wait for the page to initialize
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

          console.log('ActionItemsCompletion: Starting task completion in iframe...');

          // Find task card in iframe
          const taskCard = iframeDoc.querySelector('div.cursor-pointer[style*="background-color"]');
          if (!taskCard) {
            console.error('ActionItemsCompletion: Could not find task card in iframe');
            clearTimeout(failsafeTimeout);
            iframe.remove();
            callback(false);
            return;
          }

          console.log('ActionItemsCompletion: Found task card, opening sidebar in iframe...');

          // Click task card to open sidebar
          taskCard.click();

          // Wait for sidebar to open
          setTimeout(() => {
            const sidebar = iframeDoc.querySelector('div.overflow-y-auto.overscroll-contain.sticky');
            if (!sidebar) {
              console.error('ActionItemsCompletion: Sidebar did not open in iframe');
              clearTimeout(failsafeTimeout);
              iframe.remove();
              callback(false);
              return;
            }

            console.log('ActionItemsCompletion: Sidebar opened in iframe, finding progress checkbox...');

            // Find Progress checkbox
            const progressCheckbox = findProgressCheckboxInDocument(iframeDoc);
            if (!progressCheckbox) {
              console.error('ActionItemsCompletion: Could not find progress checkbox in iframe');
              clearTimeout(failsafeTimeout);
              iframe.remove();
              callback(false);
              return;
            }

            console.log('ActionItemsCompletion: Found progress checkbox, clicking it...');
            progressCheckbox.click();

            // Wait for Save button to appear and become enabled
            setTimeout(async () => {
              const saveButton = findSaveButtonInDocument(iframeDoc);
              if (!saveButton) {
                console.error('ActionItemsCompletion: Could not find Save button in iframe');
                clearTimeout(failsafeTimeout);
                iframe.remove();
                callback(false);
                return;
              }

              console.log('ActionItemsCompletion: Found Save button, waiting for it to enable...');

              // Wait for Save button to become enabled
              const isEnabled = await waitForSaveButtonEnabledInElement(saveButton, 2000);
              if (!isEnabled) {
                console.error('ActionItemsCompletion: Save button did not enable in time');
                clearTimeout(failsafeTimeout);
                iframe.remove();
                callback(false);
                return;
              }

              console.log('ActionItemsCompletion: Save button enabled, clicking it...');
              saveButton.click();

              // Wait for save to complete
              setTimeout(() => {
                console.log('ActionItemsCompletion: Task saved successfully in iframe');
                clearTimeout(failsafeTimeout);
                iframe.remove();
                callback(true);
              }, 800);
            }, 300);
          }, 1000);
        } catch (error) {
          console.error('ActionItemsCompletion: Error completing task in iframe:', error);
          clearTimeout(failsafeTimeout);
          iframe.remove();
          callback(false);
        }
      }, 1500);
    };

    iframe.onerror = () => {
      console.error('ActionItemsCompletion: Iframe failed to load');
      clearTimeout(failsafeTimeout);
      iframe.remove();
      callback(false);
    };

    // Add iframe to page and load the task URL
    document.body.appendChild(iframe);
    iframe.src = targetUrl;
  }

  /**
   * Find the progress checkbox in a document (for iframe use)
   * @param {Document} doc - The document to search in
   * @returns {HTMLElement|null} The progress checkbox or null
   */
  function findProgressCheckboxInDocument(doc) {
    const sidebar = doc.querySelector('div.overflow-y-auto.overscroll-contain.sticky');
    if (!sidebar) return null;

    const allLabels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const progressLabel = allLabels.find(span => span.textContent.trim() === 'Progress');
    if (!progressLabel) return null;

    const progressContainer = progressLabel.closest('div.flex.items-center.space-x-1');
    if (!progressContainer) return null;

    return progressContainer.querySelector('div[role="button"]');
  }

  /**
   * Find the Save button in a document (for iframe use)
   * @param {Document} doc - The document to search in
   * @returns {HTMLElement|null} The Save button or null
   */
  function findSaveButtonInDocument(doc) {
    const allButtons = Array.from(doc.querySelectorAll('div[role="button"]'));

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
  function waitForSaveButtonEnabledInElement(button, maxWaitMs = 2000) {
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
