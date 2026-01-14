// JobTread Schedule Feature Module (Refactored)
// Main orchestrator - coordinates task completion modules
// NOTE: Drag & drop functionality DISABLED as of Jan 2026 - JobTread now has native drag & drop
// This module now only handles: Task Completion checkboxes & Action Items completion

const DragDropFeature = (() => {
  // Feature state
  let observer = null;
  let isActive = false;

  /**
   * Initialize the schedule feature (task completion only - drag & drop disabled)
   */
  function init() {
    if (isActive) {
      console.log('ScheduleFeature: Already initialized');
      return;
    }

    console.log('ScheduleFeature: Initializing (task completion only, drag & drop disabled)...');
    isActive = true;

    // NOTE: Drag & drop disabled - JobTread now has native drag & drop
    // Weekend styling and event handlers no longer needed

    // Initial setup - only task completion features
    setTimeout(() => {
      initTaskCompletion();

      // Initialize Action Items Completion
      if (window.ActionItemsCompletion) {
        window.ActionItemsCompletion.init();
      }

      console.log('ScheduleFeature: Feature loaded (task completion only)');
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
          setTimeout(initTaskCompletion, 500);
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
    if (!isActive) {
      console.log('ScheduleFeature: Not active, nothing to cleanup');
      return;
    }

    console.log('ScheduleFeature: Cleaning up...');
    isActive = false;

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

    console.log('ScheduleFeature: Cleanup complete');
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
