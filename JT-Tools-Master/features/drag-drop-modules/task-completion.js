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

      // Create checkbox button
      const checkbox = createCheckboxButton();

      // Add to the end of the task name container
      taskNameContainer.appendChild(checkbox);

      // Mark as processed
      processedTasks.add(item);

      // Add click handler
      checkbox.addEventListener('click', (e) => handleCheckboxClick(e, item));
    });

    console.log(`TaskCompletion: Added checkboxes to task cards`);
  }

  /**
   * Create the checkbox button element
   * @returns {HTMLElement} The checkbox button
   */
  function createCheckboxButton() {
    const button = document.createElement('div');
    button.className = 'jt-complete-checkbox inline-block align-bottom relative cursor-pointer p-0.5 rounded-sm hover:bg-gray-100';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.style.cssText = 'margin-left: auto; flex-shrink: 0;';

    // Create SVG checkbox icon (unchecked box)
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
    button.appendChild(svg);

    // Add title for tooltip
    button.setAttribute('title', 'Toggle task completion');

    return button;
  }

  /**
   * Handle checkbox click
   * @param {Event} e - The click event
   * @param {HTMLElement} taskCard - The task card element
   */
  function handleCheckboxClick(e, taskCard) {
    // Prevent event propagation to avoid triggering drag or opening sidebar
    e.stopPropagation();
    e.preventDefault();

    console.log('TaskCompletion: Checkbox clicked, toggling task completion...');

    // Show a loading state
    const checkbox = e.currentTarget;
    const originalHTML = checkbox.innerHTML;
    checkbox.style.opacity = '0.5';
    checkbox.style.pointerEvents = 'none';

    // Open sidebar to access the progress controls
    toggleTaskCompletion(taskCard, checkbox, originalHTML);
  }

  /**
   * Toggle task completion by opening sidebar and clicking the progress checkbox
   * @param {HTMLElement} taskCard - The task card element
   * @param {HTMLElement} checkbox - The checkbox button that was clicked
   * @param {string} originalHTML - Original HTML of checkbox for restoration
   */
  function toggleTaskCompletion(taskCard, checkbox, originalHTML) {
    console.log('TaskCompletion: Opening sidebar to toggle completion...');

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
                // Restore checkbox
                checkbox.style.opacity = '';
                checkbox.style.pointerEvents = '';

                // Show notification
                if (window.UIUtils) {
                  window.UIUtils.showNotification('Task completion toggled');
                }
              });
            } else {
              // Manual close if SidebarManager not available
              clearTimeout(failsafeTimeout);
              if (hideStyle) hideStyle.remove();
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
