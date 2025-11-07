// UI Utilities Module
// Handles notifications and DOM setup for draggable elements

const UIUtils = (() => {
  /**
   * Show a toast notification to the user
   * @param {string} message - The message to display
   */
  function showNotification(message) {
    // Find the search box container
    const searchContainer = document.querySelector('div.relative.h-10.cursor-pointer.grow.min-w-0.rounded-sm');

    if (!searchContainer) {
      console.warn('DragDrop: Search container not found, notification not displayed');
      return;
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        background: rgb(59, 130, 246);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 250px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        animation: fadeIn 0.2s ease-out;
    `;
    notification.textContent = message;

    // Inject animation styles if not already present
    if (!document.getElementById('jt-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'jt-notification-styles';
      style.textContent = `
          @keyframes fadeIn {
              from {
                  opacity: 0;
                  transform: translateY(-50%) translateX(20px);
              }
              to {
                  opacity: 1;
                  transform: translateY(-50%) translateX(0);
              }
          }
          @keyframes fadeOut {
              from {
                  opacity: 1;
                  transform: translateY(-50%) translateX(0);
              }
              to {
                  opacity: 0;
                  transform: translateY(-50%) translateX(20px);
              }
          }
      `;
      document.head.appendChild(style);
    }

    // Ensure the search container has relative positioning
    const originalPosition = searchContainer.style.position;
    if (!originalPosition || originalPosition === 'static') {
      searchContainer.style.position = 'relative';
    }

    searchContainer.appendChild(notification);

    // Remove after 3 seconds with fade out animation
    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        notification.remove();
        // Restore original position if it was changed
        if (!originalPosition || originalPosition === 'static') {
          searchContainer.style.position = originalPosition || '';
        }
      }, 200);
    }, 3000);
  }

  /**
   * Make schedule items draggable
   * @param {Object} handlers - Event handlers {onDragStart, onDragEnd}
   */
  function makeScheduleItemsDraggable(handlers) {
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');

    scheduleItems.forEach(item => {
      // Always ensure draggable attribute and cursor are set
      item.setAttribute('draggable', 'true');
      item.style.cursor = 'grab';

      // Remove old event listeners if they exist to prevent duplicates
      // Note: We can't remove specific listeners without references, so we mark items
      if (!item.hasAttribute('data-jt-drag-initialized')) {
        item.setAttribute('data-jt-drag-initialized', 'true');

        if (handlers.onDragStart) {
          item.addEventListener('dragstart', handlers.onDragStart);
        }
        if (handlers.onDragEnd) {
          item.addEventListener('dragend', handlers.onDragEnd);
        }
      }
    });
  }

  /**
   * Make date cells droppable
   * @param {Object} handlers - Event handlers {onDragOver, onDrop, onDragLeave, onDragEnter}
   */
  function makeDateCellsDroppable(handlers) {
    const dateCells = document.querySelectorAll('td.group.text-xs');
    console.log(`UIUtils: makeDateCellsDroppable - Found ${dateCells.length} cells to make droppable`);

    let newCells = 0;
    dateCells.forEach((cell, index) => {
      if (!cell.classList.contains('jt-drop-enabled')) {
        cell.classList.add('jt-drop-enabled');
        newCells++;

        // Mark weekends if WeekendUtils is available
        if (window.WeekendUtils && window.WeekendUtils.isWeekendCell(cell)) {
          cell.classList.add('jt-weekend-cell');
        }

        if (handlers.onDragOver) {
          cell.addEventListener('dragover', handlers.onDragOver);
        }
        if (handlers.onDrop) {
          cell.addEventListener('drop', handlers.onDrop);
        }
        if (handlers.onDragLeave) {
          cell.addEventListener('dragleave', handlers.onDragLeave);
        }
        if (handlers.onDragEnter) {
          cell.addEventListener('dragenter', handlers.onDragEnter);
        }

        // Log a sample of cells to verify they're in different months
        if (index < 3 || index > dateCells.length - 3) {
          if (window.DateUtils) {
            const dateInfo = window.DateUtils.extractDateFromCell(cell);
            console.log(`UIUtils: makeDateCellsDroppable - Cell ${index}: day=${dateInfo}, classes=${cell.className}`);
          }
        }
      }
    });
    console.log(`UIUtils: makeDateCellsDroppable - Attached listeners to ${newCells} new cells`);
  }

  /**
   * Initialize drag and drop on the page
   * @param {Object} handlers - All event handlers
   */
  function initDragAndDrop(handlers) {
    makeScheduleItemsDraggable(handlers);
    makeDateCellsDroppable(handlers);
  }

  /**
   * Cleanup draggable attributes and drop zone classes
   */
  function cleanupDragDrop() {
    // Remove draggable attributes and event listeners
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[draggable="true"]');
    scheduleItems.forEach(item => {
      item.removeAttribute('draggable');
      item.removeAttribute('data-jt-drag-initialized');
      item.style.cursor = '';
      // Note: We can't easily remove event listeners without references
      // But since we're likely reloading the page, this is acceptable
    });

    // Remove drop zone classes
    const dateCells = document.querySelectorAll('td.jt-drop-enabled');
    dateCells.forEach(cell => {
      cell.classList.remove('jt-drop-enabled');
      cell.classList.remove('jt-weekend-cell');
    });
  }

  // Public API
  return {
    showNotification,
    makeScheduleItemsDraggable,
    makeDateCellsDroppable,
    initDragAndDrop,
    cleanupDragDrop
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.UIUtils = UIUtils;
}
