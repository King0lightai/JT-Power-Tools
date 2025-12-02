// Task Completion Module
// Adds checkboxes to task cards for quick completion toggling

const TaskCompletion = (() => {
  // Track which tasks have checkboxes added
  const processedTasks = new WeakSet();

  /**
   * Add completion checkbox to all task cards
   */
  function addCompletionCheckboxes() {
    // Get selectors based on current view (normal or availability)
    const selectors = window.ViewDetector ? window.ViewDetector.getSelectorsForCurrentView() : {
      scheduleItems: 'div.cursor-pointer[style*="background-color"]',
      viewType: 'normal'
    };

    const scheduleItems = document.querySelectorAll(selectors.scheduleItems);
    console.log(`TaskCompletion: Found ${scheduleItems.length} task cards`);

    scheduleItems.forEach(item => {
      // Skip if already processed
      if (processedTasks.has(item)) {
        return;
      }

      // Find the task name container (first div with flex items-center space-x-1)
      const taskNameContainer = item.querySelector('div.flex.items-center.space-x-1');
      if (!taskNameContainer) {
        console.log('TaskCompletion: Could not find task name container');
        return;
      }

      // Check if checkbox already exists
      if (taskNameContainer.querySelector('.jt-complete-checkbox')) {
        return;
      }

      // Skip tasks with subtasks - JT requires all subtasks to be completed first
      // Subtask indicator looks like "0/2" or "1/3" in a div.grow.shrink-0.text-right
      if (hasSubtaskIndicator(taskNameContainer)) {
        console.log('TaskCompletion: Skipping task with subtasks');
        return;
      }

      // Detect if task is already complete
      const isComplete = isTaskComplete(taskNameContainer);

      // Create checkbox button with current completion status
      const checkbox = createCheckboxButton(isComplete);

      // Add to the end of the task name container
      taskNameContainer.appendChild(checkbox);

      // Mark as processed
      processedTasks.add(item);

      // Add click handler
      checkbox.addEventListener('click', (e) => handleCheckboxClick(e, item, checkbox));
    });

    console.log(`TaskCompletion: Added checkboxes to task cards`);
  }

  /**
   * Detect if a task is complete by looking for the checkmark icon in the task name
   * @param {HTMLElement} taskNameContainer - The task name container element
   * @returns {boolean} True if task is complete
   */
  function isTaskComplete(taskNameContainer) {
    // Look for the checkmark SVG path in the task name
    // Completed tasks have: <path d="M20 6 9 17l-5-5"></path>
    const checkmarkPath = taskNameContainer.querySelector('path[d="M20 6 9 17l-5-5"]');
    return !!checkmarkPath;
  }

  /**
   * Check if a task has subtasks by looking for the subtask indicator (e.g., "0/2", "1/3")
   * JT requires all subtasks to be completed before the parent can be marked complete
   * @param {HTMLElement} taskNameContainer - The task name container element
   * @returns {boolean} True if task has subtasks
   */
  function hasSubtaskIndicator(taskNameContainer) {
    // Subtask indicator is in a div with classes: grow shrink-0 text-right
    // and contains text like "0/2" or "1/3"
    const subtaskDiv = taskNameContainer.querySelector('div.grow.shrink-0.text-right');
    if (!subtaskDiv) {
      return false;
    }

    // Check if the text matches the subtask pattern (number/number)
    const text = subtaskDiv.textContent.trim();
    const subtaskPattern = /^\d+\/\d+$/;
    return subtaskPattern.test(text);
  }

  /**
   * Create the checkbox button element
   * @param {boolean} isComplete - Whether the task is currently complete
   * @returns {HTMLElement} The checkbox button
   */
  function createCheckboxButton(isComplete = false) {
    const button = document.createElement('div');
    button.className = 'jt-complete-checkbox inline-block align-bottom relative cursor-pointer p-0.5 rounded-sm hover:bg-gray-100';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.style.cssText = 'margin-left: auto; flex-shrink: 0;';

    // Create SVG checkbox icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('class', 'inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]');
    svg.setAttribute('viewBox', '0 0 24 24');

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
    button.setAttribute('title', isComplete ? 'Mark as incomplete' : 'Mark as complete');

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
    checkbox.setAttribute('title', isComplete ? 'Mark as incomplete' : 'Mark as complete');
  }

  /**
   * Handle checkbox click
   * @param {Event} e - The click event
   * @param {HTMLElement} taskCard - The task card element
   * @param {HTMLElement} checkbox - The checkbox button element
   */
  function handleCheckboxClick(e, taskCard, checkbox) {
    // Prevent event propagation to avoid triggering drag or opening sidebar
    e.stopPropagation();
    e.preventDefault();

    console.log('TaskCompletion: Checkbox clicked, toggling task completion...');

    // Detect current completion state
    const taskNameContainer = taskCard.querySelector('div.flex.items-center.space-x-1');
    const wasComplete = isTaskComplete(taskNameContainer);

    // Show a loading state
    checkbox.style.opacity = '0.5';
    checkbox.style.pointerEvents = 'none';

    // Open sidebar to access the progress controls
    toggleTaskCompletion(taskCard, checkbox, wasComplete);
  }

  /**
   * Toggle task completion by opening sidebar and clicking the progress checkbox
   * @param {HTMLElement} taskCard - The task card element
   * @param {HTMLElement} checkbox - The checkbox button that was clicked
   * @param {boolean} wasComplete - Whether the task was complete before clicking
   */
  function toggleTaskCompletion(taskCard, checkbox, wasComplete) {
    console.log('TaskCompletion: Opening sidebar to toggle completion...');
    console.log('TaskCompletion: Task was complete:', wasComplete);

    // Inject CSS to hide sidebar
    const hideStyle = window.SidebarManager ? window.SidebarManager.injectHideSidebarCSS() : null;

    // Failsafe: Remove CSS after 5 seconds no matter what
    const failsafeTimeout = setTimeout(() => {
      if (window.SidebarManager) {
        window.SidebarManager.removeSidebarCSS();
        console.log('TaskCompletion: Failsafe removed hiding CSS');
      }
      // Restore checkbox
      checkbox.style.opacity = '';
      checkbox.style.pointerEvents = '';
    }, 5000);

    // Click to open sidebar
    if (window.SidebarManager) {
      window.SidebarManager.openSidebar(taskCard);
    } else {
      taskCard.click();
    }

    // Wait for sidebar to open
    setTimeout(() => {
      const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

      if (sidebar) {
        console.log('TaskCompletion: Sidebar found, looking for progress checkbox...');

        // Find the Progress section
        const progressCheckbox = findProgressCheckbox(sidebar);

        if (progressCheckbox) {
          console.log('TaskCompletion: Found progress checkbox, clicking it...');

          // Click the checkbox to toggle completion
          progressCheckbox.click();

          // Wait a bit for the change to register
          setTimeout(() => {
            // Close the sidebar
            if (window.SidebarManager) {
              window.SidebarManager.closeSidebar(failsafeTimeout, () => {
                console.log('TaskCompletion: Task completion toggled successfully');

                // Update checkbox visual state (toggle from previous state)
                const newCompletionState = !wasComplete;
                updateCheckboxState(checkbox, newCompletionState);

                // Restore checkbox
                checkbox.style.opacity = '';
                checkbox.style.pointerEvents = '';

                // Show notification
                if (window.UIUtils) {
                  const statusText = newCompletionState ? 'completed' : 'marked incomplete';
                  window.UIUtils.showNotification(`Task ${statusText}`);
                }
              });
            } else {
              // Manual close if SidebarManager not available
              clearTimeout(failsafeTimeout);
              if (hideStyle) hideStyle.remove();

              // Update checkbox visual state
              const newCompletionState = !wasComplete;
              updateCheckboxState(checkbox, newCompletionState);

              checkbox.style.opacity = '';
              checkbox.style.pointerEvents = '';
            }
          }, 300);
        } else {
          console.error('TaskCompletion: Could not find progress checkbox in sidebar');
          // Close sidebar and restore
          if (window.SidebarManager) {
            window.SidebarManager.closeSidebar(failsafeTimeout, () => {
              checkbox.style.opacity = '';
              checkbox.style.pointerEvents = '';
            });
          } else {
            clearTimeout(failsafeTimeout);
            if (hideStyle) hideStyle.remove();
            checkbox.style.opacity = '';
            checkbox.style.pointerEvents = '';
          }

          if (window.UIUtils) {
            window.UIUtils.showNotification('Could not find progress checkbox');
          }
        }
      } else {
        console.error('TaskCompletion: Sidebar did not open');
        clearTimeout(failsafeTimeout);
        if (hideStyle) hideStyle.remove();
        checkbox.style.opacity = '';
        checkbox.style.pointerEvents = '';

        if (window.UIUtils) {
          window.UIUtils.showNotification('Sidebar did not open');
        }
      }
    }, 500);
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
      console.log('TaskCompletion: Progress label not found');
      console.log('TaskCompletion: Available labels:', allLabels.map(l => l.textContent.trim()));
      return null;
    }

    console.log('TaskCompletion: Found Progress label');

    // Find the container with Progress label
    const progressContainer = progressLabel.closest('div.flex.items-center.space-x-1');
    if (!progressContainer) {
      console.log('TaskCompletion: Could not find progress container');
      return null;
    }

    // Find the checkbox button in the progress container
    // It's a div with role="button" containing an SVG with a rect
    const checkboxButton = progressContainer.querySelector('div[role="button"]');
    if (!checkboxButton) {
      console.log('TaskCompletion: Could not find checkbox button in progress container');
      return null;
    }

    console.log('TaskCompletion: Found progress checkbox button');
    return checkboxButton;
  }

  /**
   * Cleanup checkboxes
   */
  function cleanup() {
    const checkboxes = document.querySelectorAll('.jt-complete-checkbox');
    checkboxes.forEach(checkbox => checkbox.remove());
    console.log('TaskCompletion: Cleaned up checkboxes');
  }

  // Public API
  return {
    addCompletionCheckboxes,
    cleanup
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TaskCompletion = TaskCompletion;
}
