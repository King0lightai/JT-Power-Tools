// UI Utilities Module
// Handles notifications and DOM setup for draggable elements

const UIUtils = (() => {
  /**
   * Show a toast notification to the user
   * @param {string} message - The message to display
   */
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgb(59, 130, 246);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
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
