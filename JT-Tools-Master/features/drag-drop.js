// JobTread Schedule Feature Module (Refactored)
// Main orchestrator - coordinates task completion modules
// NOTE: Drag & drop functionality DISABLED as of Jan 2026 - JobTread now has native drag & drop
// This module now only handles: Task Completion checkboxes & Action Items completion

const DragDropFeature = (() => {
  // Feature state
  let observer = null;
  let isActive = false;
  let retryTimeout = null;

  // Debounce timer for MutationObserver
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 300;

  /**
   * Initialize the schedule feature (task completion only - drag & drop disabled)
   */
  function init() {
    if (isActive) return;

    isActive = true;
    console.log('DragDrop: Activated');

    // NOTE: Drag & drop disabled - JobTread now has native drag & drop
    // Weekend styling and event handlers no longer needed

    // Initial setup - only task completion features (with retry for slow-loading pages)
    setTimeout(() => {
      initTaskCompletionWithRetry(3, 500);

      // Initialize Action Items Completion
      if (window.ActionItemsCompletion) {
        window.ActionItemsCompletion.init();
      }
    }, 1000);

    // Watch for DOM changes and re-initialize checkboxes (with error handling)
    observer = new MutationObserver((mutations) => {
      try {
        let shouldReinit = false;

        mutations.forEach(mutation => {
          if (mutation.addedNodes.length > 0) {
            shouldReinit = true;
          }
        });

        if (shouldReinit) {
          // Debounce rapid DOM changes to prevent multiple reinitializations
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(() => {
            initTaskCompletion();
            debounceTimer = null;
          }, DEBOUNCE_DELAY);
        }
      } catch (error) {
        console.error('ScheduleFeature: Error in MutationObserver callback:', error);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }


  /**
   * Cleanup the schedule feature
   */
  function cleanup() {
    if (!isActive) return;

    isActive = false;
    console.log('DragDrop: Deactivated');

    // Clear any pending timers
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // NOTE: Drag & drop UI cleanup no longer needed - feature disabled

    // Cleanup task completion checkboxes
    if (window.TaskCompletion) {
      window.TaskCompletion.cleanup();
    }

    // Cleanup action items completion
    if (window.ActionItemsCompletion) {
      window.ActionItemsCompletion.cleanup();
    }
  }

  /**
   * Initialize task completion checkboxes on the current page
   * NOTE: Drag & drop disabled - only task completion is active
   */
  function initTaskCompletion() {
    // Add completion checkboxes to task cards
    if (window.TaskCompletion) {
      window.TaskCompletion.addCompletionCheckboxes();
    }
  }

  /**
   * Initialize task completion with retry logic for slow-loading pages
   * Retries with exponential backoff if no task cards are found
   * @param {number} attemptsLeft - Number of retry attempts remaining
   * @param {number} delay - Current delay between retries (increases exponentially)
   */
  function initTaskCompletionWithRetry(attemptsLeft, delay) {
    if (!isActive) return;

    // Run the initialization
    initTaskCompletion();

    // Check if any task cards exist on the page
    const calendarTasks = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');
    const kanbanCards = document.querySelectorAll('div.cursor-\\[grab\\]');
    const hasTaskCards = calendarTasks.length > 0 || kanbanCards.length > 0;

    // Check if we added any checkboxes
    const checkboxes = document.querySelectorAll('.jt-complete-checkbox');

    // If we found task cards but no checkboxes were added, and we have retries left, try again
    if (hasTaskCards && checkboxes.length === 0 && attemptsLeft > 0) {
      console.log(`DragDrop: No checkboxes added yet, retrying in ${delay}ms (${attemptsLeft} attempts left)`);
      retryTimeout = setTimeout(() => {
        initTaskCompletionWithRetry(attemptsLeft - 1, Math.min(delay * 1.5, 2000));
      }, delay);
    } else if (!hasTaskCards && attemptsLeft > 0) {
      // No task cards found yet - page may still be loading
      console.log(`DragDrop: No task cards found, retrying in ${delay}ms (${attemptsLeft} attempts left)`);
      retryTimeout = setTimeout(() => {
        initTaskCompletionWithRetry(attemptsLeft - 1, Math.min(delay * 1.5, 2000));
      }, delay);
    } else if (checkboxes.length > 0) {
      console.log(`DragDrop: Successfully added ${checkboxes.length} checkboxes`);
    }
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
  window.DragDropFeature = DragDropFeature;
}
