// JobTread Schedule Drag & Drop Feature Module (Refactored)
// Main orchestrator - coordinates all drag-drop modules

const DragDropFeature = (() => {
  // Shared state
  const state = {
    draggedElement: null,
    draggedItemData: null,
    sourceDateInfo: null,
    shiftKeyAtDragStart: false,
    altKeyAtDragStart: false,
    isDateChangeInProgress: false
  };

  // Feature state
  let observer = null;
  let isActive = false;
  let eventHandlers = null;

  /**
   * Initialize the drag & drop feature
   */
  function init() {
    if (isActive) {
      console.log('DragDrop: Already initialized');
      return;
    }

    console.log('DragDrop: Initializing...');
    isActive = true;

    // Inject weekend styling
    if (window.WeekendUtils) {
      window.WeekendUtils.injectWeekendCSS();
    }

    // Create event handlers with access to shared state
    if (window.DragDropEventHandlers && window.DateChanger) {
      eventHandlers = window.DragDropEventHandlers.createHandlers(
        state,
        (element, newDateNumber, targetCell, dateInfo, sourceDateInfo, callback, changeEndDate) => {
          // Set flag to prevent observer re-entry during date changes
          state.isDateChangeInProgress = true;
          console.log('DragDrop: Set isDateChangeInProgress = true');

          window.DateChanger.attemptDateChange(
            element,
            newDateNumber,
            targetCell,
            dateInfo,
            sourceDateInfo,
            () => {
              // Callback when date change is complete
              state.isDateChangeInProgress = false;
              console.log('DragDrop: Set isDateChangeInProgress = false');

              // Force re-initialization to ensure items are draggable again
              console.log('DragDrop: Re-initializing drag and drop after date change');
              setTimeout(() => {
                initDragAndDrop();
              }, 100);
            },
            changeEndDate  // Pass Alt key state to change End date
          );
        }
      );
    }

    // Initial setup
    setTimeout(() => {
      initDragAndDrop();
      console.log('DragDrop: Feature loaded');
    }, 1000);

    // Watch for DOM changes and re-initialize
    observer = new MutationObserver((mutations) => {
      // CRITICAL: Don't re-initialize while date change is in progress
      if (state.isDateChangeInProgress) {
        console.log('DragDrop: MutationObserver - Skipping re-init, date change in progress');
        return;
      }

      let shouldReinit = false;

      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldReinit = true;
        }
      });

      if (shouldReinit) {
        setTimeout(initDragAndDrop, 500);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }


  /**
   * Cleanup the drag & drop feature
   */
  function cleanup() {
    if (!isActive) {
      console.log('DragDrop: Not active, nothing to cleanup');
      return;
    }

    console.log('DragDrop: Cleaning up...');
    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Cleanup drag & drop UI
    if (window.UIUtils) {
      window.UIUtils.cleanupDragDrop();
    }

    // Remove weekend CSS
    if (window.WeekendUtils) {
      window.WeekendUtils.removeWeekendCSS();
    }

    console.log('DragDrop: Cleanup complete');
  }

  /**
   * Initialize drag and drop on the current page
   */
  function initDragAndDrop() {
    if (!window.UIUtils || !eventHandlers) {
      console.error('DragDrop: Required modules not loaded');
      return;
    }

    window.UIUtils.initDragAndDrop(eventHandlers);
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
