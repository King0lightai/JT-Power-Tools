// Action Items Completion Module
// Adds checkboxes to Action Items card for quick task completion

const ActionItemsCompletion = (() => {
  // Feature state
  let isActive = false;
  let observer = null;

  // Track which action items have checkboxes added
  const processedItems = new WeakSet();

  /**
   * Initialize action items completion feature
   */
  function init() {
    if (isActive) {
      console.log('ActionItemsCompletion: Already initialized');
      return;
    }

    console.log('ActionItemsCompletion: Initializing...');
    isActive = true;

    // Add checkboxes to action items
    addCompletionCheckboxes();

    // Watch for changes to the Action Items card
    observer = new MutationObserver(() => {
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
        return;
      }

      // Create checkbox button (always unchecked - if task is complete, it won't be in Action Items)
      const checkbox = createCheckboxButton(false);

      // Find the View button
      const viewButton = findViewButton(item);
      if (!viewButton) {
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
    // Look for a button with text "View" inside the item
    const buttons = item.querySelectorAll('div[role="button"]');

    for (const button of buttons) {
      const text = button.textContent.trim();
      if (text === 'View' || text.toLowerCase().includes('view')) {
        return button;
      }
    }

    // Fallback: look for any element with "View" text inside item
    const allDivs = item.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.textContent.trim() === 'View') {
        return div;
      }
    }

    // Extended fallback: search parent container for View button
    // The View button might be a sibling or in a flex container
    const parent = item.parentElement;
    if (parent) {
      const siblingButtons = parent.querySelectorAll('div[role="button"]');
      for (const button of siblingButtons) {
        const text = button.textContent.trim();
        if (text === 'View' || text.toLowerCase().includes('view')) {
          return button;
        }
      }
    }

    // Last resort: find the first button-like element in the item
    const firstButton = item.querySelector('[role="button"], button');
    if (firstButton) {
      return firstButton;
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

    // Get the target URL
    const targetUrl = item.getAttribute('href');
    console.log('ActionItemsCompletion: Completing task in hidden iframe:', targetUrl);

    // Complete the task in a hidden iframe (no page navigation)
    completeTaskInIframe(targetUrl, taskId, item, (success) => {
      if (success) {
        // Fade out and remove the action item from the list
        item.style.transition = 'opacity 0.3s ease-out';
        item.style.opacity = '0';

        setTimeout(() => {
          item.remove();
        }, 300);

        // Show notification
        if (window.UIUtils) {
          window.UIUtils.showNotification('Task completed');
        }
      } else {
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
   * @param {HTMLElement} item - The action item element
   * @param {Function} callback - Callback function (success: boolean)
   */
  function completeTaskInIframe(targetUrl, taskId, item, callback) {
    // Create hidden iframe WITHOUT sandbox to allow full functionality
    // Make it full-size so toolbar renders, but position it off-screen
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position: absolute; top: -9999px; left: -9999px; width: 1920px; height: 1080px; opacity: 0; pointer-events: none; border: none;';

    // NO sandbox attribute - this allows the toolbar to fully render

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
      // Wait for the page to initialize
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

          // Wait for sidebar to be present (auto-opened by ?taskId= URL param)
          setTimeout(() => {
            // Try multiple sidebar selectors for robustness
            const sidebarSelectors = [
              'div.overflow-y-auto.overscroll-contain.sticky',
              'div.sticky.overflow-y-auto',
              'div[data-is-drag-scroll-boundary="true"]',
              'div.overflow-y-auto.sticky',
              'div.sticky[class*="overflow"]'
            ];

            let sidebar = null;
            for (const selector of sidebarSelectors) {
              sidebar = iframeDoc.querySelector(selector);
              if (sidebar) {
                console.log('ActionItemsCompletion: Found sidebar with selector:', selector);
                break;
              }
            }

            if (!sidebar) {
              console.error('ActionItemsCompletion: Sidebar not found in iframe (tried multiple selectors)');
              clearTimeout(failsafeTimeout);
              iframe.remove();
              callback(false);
              return;
            }

            // Find Progress checkbox
            const progressCheckbox = findProgressCheckboxInDoc(iframeDoc);
            if (!progressCheckbox) {
              console.error('ActionItemsCompletion: Could not find progress checkbox in iframe');
              clearTimeout(failsafeTimeout);
              iframe.remove();
              callback(false);
              return;
            }
            progressCheckbox.click();

            // Wait for Save button to appear and become enabled
            setTimeout(async () => {
              const saveButton = findSaveButtonInDoc(iframeDoc);
              if (!saveButton) {
                console.error('ActionItemsCompletion: Could not find Save button in iframe');
                clearTimeout(failsafeTimeout);
                iframe.remove();
                callback(false);
                return;
              }

              // Wait for Save button to become enabled
              const isEnabled = await waitForSaveButtonEnabledInDoc(saveButton, 2000);
              if (!isEnabled) {
                console.error('ActionItemsCompletion: Save button did not enable in time');
                clearTimeout(failsafeTimeout);
                iframe.remove();
                callback(false);
                return;
              }

              // Click Save button
              saveButton.click();

              // Also dispatch mouse event for React compatibility
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: iframe.contentWindow
              });
              saveButton.dispatchEvent(clickEvent);

              // Wait for save to complete
              setTimeout(() => {
                clearTimeout(failsafeTimeout);
                iframe.remove();
                callback(true);
              }, 2000);
            }, 800);
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
   * Find the progress checkbox in a document
   * @param {Document} doc - The iframe document to search in
   * @returns {HTMLElement|null} The progress checkbox or null
   */
  function findProgressCheckboxInDoc(doc) {
    // Try multiple sidebar selectors for robustness
    const sidebarSelectors = [
      'div.overflow-y-auto.overscroll-contain.sticky',
      'div.sticky.overflow-y-auto',
      'div[data-is-drag-scroll-boundary="true"]',
      'div.overflow-y-auto.sticky',
      'div.sticky[class*="overflow"]'
    ];

    let sidebar = null;
    for (const selector of sidebarSelectors) {
      sidebar = doc.querySelector(selector);
      if (sidebar) break;
    }

    // Fallback: search the entire document
    const searchRoot = sidebar || doc.body;

    // Find "Progress" label using multiple selectors
    const labelSelectors = [
      'span.font-bold',
      'span[class*="font-bold"]',
      'label',
      'div.font-bold',
      'strong'
    ];

    let progressLabel = null;
    for (const selector of labelSelectors) {
      const labels = Array.from(searchRoot.querySelectorAll(selector));
      progressLabel = labels.find(el => el.textContent.trim() === 'Progress');
      if (progressLabel) break;
    }

    if (!progressLabel) {
      // Last resort: search by text content
      const allElements = searchRoot.querySelectorAll('*');
      for (const el of allElements) {
        if (el.childNodes.length === 1 &&
            el.childNodes[0].nodeType === Node.TEXT_NODE &&
            el.textContent.trim() === 'Progress') {
          progressLabel = el;
          break;
        }
      }
    }

    if (!progressLabel) return null;

    // Find the checkbox button near the Progress label
    // Try multiple container patterns
    let progressContainer = progressLabel.closest('div.flex.items-center.space-x-1');
    if (!progressContainer) {
      progressContainer = progressLabel.closest('div.flex.items-center');
    }
    if (!progressContainer) {
      progressContainer = progressLabel.closest('div[class*="flex"]');
    }
    if (!progressContainer) {
      progressContainer = progressLabel.parentElement;
    }

    if (!progressContainer) return null;

    // Find the button in the container
    let button = progressContainer.querySelector('div[role="button"]');
    if (!button) {
      button = progressContainer.querySelector('[role="button"]');
    }
    if (!button) {
      button = progressContainer.querySelector('button');
    }

    return button;
  }

  /**
   * Find the Save button in a document
   * @param {Document} doc - The iframe document to search in
   * @returns {HTMLElement|null} The Save button or null
   */
  function findSaveButtonInDoc(doc) {
    const allButtons = Array.from(doc.querySelectorAll('div[role="button"], [role="button"], button'));

    for (const button of allButtons) {
      const text = button.textContent.trim();

      // Check for Save text (primary method)
      if (text.includes('Save')) {
        // Verify it has a checkmark icon (various possible paths)
        const hasCheckmark = button.querySelector('path[d="M20 6 9 17l-5-5"]') ||
                            button.querySelector('path[d*="M20 6"]') ||
                            button.querySelector('path[d*="9 17"]') ||
                            button.querySelector('svg');

        if (hasCheckmark) {
          return button;
        }
      }
    }

    // Fallback: find button with just "Save" text
    for (const button of allButtons) {
      const text = button.textContent.trim();
      if (text === 'Save' || text.startsWith('Save')) {
        return button;
      }
    }

    return null;
  }

  /**
   * Wait for a Save button element to become enabled
   * @param {HTMLElement} button - The Save button element from iframe document
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} True if button became enabled, false if timeout
   */
  function waitForSaveButtonEnabledInDoc(button, maxWaitMs = 2000) {
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
    if (!isActive) {
      console.log('ActionItemsCompletion: Not active, nothing to cleanup');
      return;
    }

    console.log('ActionItemsCompletion: Cleaning up...');
    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove all checkboxes
    const checkboxes = document.querySelectorAll('.jt-action-item-checkbox');
    checkboxes.forEach(checkbox => checkbox.remove());

    console.log('ActionItemsCompletion: Cleanup complete');
  }

  // Public API
  return {
    init,
    cleanup,
    addCompletionCheckboxes,
    isActive: () => isActive
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ActionItemsCompletion = ActionItemsCompletion;
}
