/**
 * Task Resize Module
 * Allows users to drag task cards to expand them across multiple days
 */

const TaskResize = (() => {
  const resizeState = {
    isResizing: false,
    taskElement: null,
    startCell: null,
    currentEndCell: null,
    highlightedCells: [],
    startX: 0,
    originalDays: 1
  };

  /**
   * Initialize resize handles for all task cards
   */
  function initializeTaskResize() {
    console.log('[TaskResize] Initializing task card resize functionality');

    // Find all task cards in the month view
    const taskCards = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');

    taskCards.forEach(card => {
      // Skip if already has resize handle
      if (card.querySelector('.jt-task-resize-handle')) {
        return;
      }

      // Add resize handle to the card
      addResizeHandle(card);
    });

    console.log(`[TaskResize] Added resize handles to ${taskCards.length} task cards`);
  }

  /**
   * Add a resize handle to a task card
   * @param {HTMLElement} card - The task card element
   */
  function addResizeHandle(card) {
    // Make the card position relative for absolute positioning of handle
    card.style.position = 'relative';
    // Ensure card doesn't prevent handle interaction
    card.style.overflow = 'visible';

    // Create resize handle element (solid bar like left border)
    const handle = document.createElement('div');
    handle.className = 'jt-task-resize-handle';
    handle.title = 'Drag to extend task end date';

    // Ensure the handle is interactive
    handle.style.pointerEvents = 'auto';
    handle.style.cursor = 'ew-resize';

    // Append handle to card
    card.appendChild(handle);

    // Attach event listeners
    handle.addEventListener('mousedown', (e) => handleResizeStart(e, card), { capture: true });

    // Add visual feedback on hover
    handle.addEventListener('mouseenter', () => {
      console.log('[TaskResize] Mouse entered resize handle');
    });

    console.log('[TaskResize] Added resize handle to card');
  }

  /**
   * Handle resize start (mousedown on resize handle)
   * @param {MouseEvent} e - The mouse event
   * @param {HTMLElement} card - The task card being resized
   */
  function handleResizeStart(e, card) {
    // Only trigger on left mouse button
    if (e.button !== 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    console.log('[TaskResize] ========================================');
    console.log('[TaskResize] Resize started!');
    console.log('[TaskResize] Mouse position:', e.clientX, e.clientY);
    console.log('[TaskResize] ========================================');

    // Get the parent cell of this task
    const startCell = card.closest('td.group.text-xs');
    if (!startCell) {
      console.error('[TaskResize] Could not find parent cell');
      return;
    }

    resizeState.isResizing = true;
    resizeState.taskElement = card;
    resizeState.startCell = startCell;
    resizeState.currentEndCell = startCell;
    resizeState.startX = e.clientX;
    resizeState.originalDays = 1; // We'll assume starting at 1 day
    resizeState.highlightedCells = [startCell];

    // Add visual feedback
    card.classList.add('jt-task-resizing');
    startCell.classList.add('jt-resize-preview');

    // Prevent dragging the task card itself
    const originalDraggable = card.getAttribute('draggable');
    card.setAttribute('draggable', 'false');
    card.dataset.originalDraggable = originalDraggable || 'true';

    // Attach document-level listeners
    document.addEventListener('mousemove', handleResizeMove, { capture: true });
    document.addEventListener('mouseup', handleResizeEnd, { capture: true });

    // Prevent text selection
    document.body.style.userSelect = 'none';

    console.log('[TaskResize] Event listeners attached, ready to resize');
  }

  /**
   * Handle resize move (mousemove while resizing)
   * @param {MouseEvent} e - The mouse event
   */
  function handleResizeMove(e) {
    if (!resizeState.isResizing || !resizeState.startCell) {
      return;
    }

    e.preventDefault();

    // Find which cell we're currently over
    const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
    const currentCell = elementUnderCursor?.closest('td.group.text-xs');

    if (!currentCell) {
      return;
    }

    // Only update if we've moved to a different cell
    if (currentCell === resizeState.currentEndCell) {
      return;
    }

    resizeState.currentEndCell = currentCell;

    // Get all cells between start and current
    const cellsInRange = getCellsInRange(resizeState.startCell, currentCell);

    // Clear previous highlights
    resizeState.highlightedCells.forEach(cell => {
      cell.classList.remove('jt-resize-preview');
    });

    // Highlight new range
    cellsInRange.forEach(cell => {
      cell.classList.add('jt-resize-preview');
    });

    resizeState.highlightedCells = cellsInRange;

    console.log(`[TaskResize] Spanning ${cellsInRange.length} days`);
  }

  /**
   * Handle resize end (mouseup after resizing)
   * @param {MouseEvent} e - The mouse event
   */
  function handleResizeEnd(e) {
    if (!resizeState.isResizing) {
      return;
    }

    console.log('[TaskResize] Resize ended');

    // Calculate the number of days spanned
    const numberOfDays = resizeState.highlightedCells.length;

    // Get the end date from the last cell
    if (numberOfDays > 1 && resizeState.highlightedCells.length > 0) {
      const lastCell = resizeState.highlightedCells[resizeState.highlightedCells.length - 1];
      const endDateInfo = window.DateUtils ? window.DateUtils.extractFullDateInfo(lastCell) : null;

      console.log('[TaskResize] End date info:', endDateInfo);

      // Update the task's End date
      const updated = updateTaskEndDate(endDateInfo);

      // Show notification
      if (window.UIUtils) {
        if (updated && endDateInfo) {
          const endDateStr = formatDate(endDateInfo);
          window.UIUtils.showNotification(`Task extended to ${endDateStr} (${numberOfDays} days)`);
        } else if (!updated) {
          window.UIUtils.showNotification('Click task to open sidebar, then try resizing again');
        }
      }
    } else if (numberOfDays === 1) {
      // If dragged back to 1 day
      if (window.UIUtils) {
        window.UIUtils.showNotification('Task end date unchanged');
      }
    }

    // Clean up visual feedback
    if (resizeState.taskElement) {
      resizeState.taskElement.classList.remove('jt-task-resizing');

      // Restore original draggable state
      const originalDraggable = resizeState.taskElement.dataset.originalDraggable || 'true';
      resizeState.taskElement.setAttribute('draggable', originalDraggable);
      delete resizeState.taskElement.dataset.originalDraggable;
    }

    resizeState.highlightedCells.forEach(cell => {
      cell.classList.remove('jt-resize-preview');
    });

    // Reset state
    resizeState.isResizing = false;
    resizeState.taskElement = null;
    resizeState.startCell = null;
    resizeState.currentEndCell = null;
    resizeState.highlightedCells = [];

    // Remove document-level listeners with capture
    document.removeEventListener('mousemove', handleResizeMove, { capture: true });
    document.removeEventListener('mouseup', handleResizeEnd, { capture: true });

    // Restore text selection
    document.body.style.userSelect = '';

    console.log('[TaskResize] Resize ended, cleanup complete');
  }

  /**
   * Get all cells in a range from start to end (horizontal)
   * @param {HTMLElement} startCell - The starting cell
   * @param {HTMLElement} endCell - The ending cell
   * @returns {HTMLElement[]} - Array of cells in the range
   */
  function getCellsInRange(startCell, endCell) {
    // Get the table row
    const row = startCell.parentElement;
    if (!row || row !== endCell.parentElement) {
      // If not in same row, just return start cell
      return [startCell];
    }

    // Get all cells in the row
    const allCells = Array.from(row.querySelectorAll('td.group.text-xs'));

    // Find indices
    const startIndex = allCells.indexOf(startCell);
    const endIndex = allCells.indexOf(endCell);

    if (startIndex === -1 || endIndex === -1) {
      return [startCell];
    }

    // Get cells in range (handle both directions)
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    return allCells.slice(minIndex, maxIndex + 1);
  }

  /**
   * Format date info into readable string
   * @param {Object} dateInfo - Date info object with day, month, year
   * @returns {string} - Formatted date string
   */
  function formatDate(dateInfo) {
    if (!dateInfo || !dateInfo.day || !dateInfo.month || !dateInfo.year) {
      return 'Unknown Date';
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[dateInfo.month - 1] || dateInfo.month;

    return `${monthName} ${dateInfo.day}, ${dateInfo.year}`;
  }

  /**
   * Update the task's End date in the sidebar
   * @param {Object} endDateInfo - Date info object with day, month, year
   * @returns {boolean} - True if update was successful
   */
  function updateTaskEndDate(endDateInfo) {
    console.log(`[TaskResize] Attempting to update task end date to:`, endDateInfo);

    if (!endDateInfo || !endDateInfo.day || !endDateInfo.month || !endDateInfo.year) {
      console.warn('[TaskResize] Invalid end date info');
      return false;
    }

    // Find the task sidebar
    const sidebar = document.querySelector('.overflow-y-auto.overscroll-contain.sticky');
    if (!sidebar) {
      console.warn('[TaskResize] Task sidebar not open - cannot update End date');
      return false;
    }

    // Find the End date section - look for "End" label
    const labels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const endLabel = labels.find(span => span.textContent.trim() === 'End');

    if (!endLabel) {
      console.warn('[TaskResize] Could not find End label in sidebar');
      return false;
    }

    // Find the date dropdown container
    const endSection = endLabel.closest('div.flex-1');
    const dateDropdown = endSection?.querySelector('div.group.items-center');

    if (!dateDropdown) {
      console.warn('[TaskResize] Could not find End date dropdown');
      return false;
    }

    // Click on the dropdown to open the date picker
    console.log('[TaskResize] Clicking End date dropdown to open picker');
    dateDropdown.click();

    // Wait for date picker to open, then select the date
    setTimeout(() => {
      selectDateInPicker(endDateInfo);
    }, 100);

    return true;
  }

  /**
   * Select a date in the opened date picker
   * @param {Object} dateInfo - Date info object with day, month, year
   */
  function selectDateInPicker(dateInfo) {
    console.log('[TaskResize] Attempting to select date in picker:', dateInfo);

    // Look for the calendar popup/modal
    // The date picker might be in a popup, look for buttons with the day number
    const dayButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));

    // Find button with matching day number
    const dayButton = dayButtons.find(btn => {
      const text = btn.textContent.trim();
      return text === dateInfo.day.toString();
    });

    if (dayButton) {
      console.log('[TaskResize] Found day button, clicking:', dateInfo.day);
      dayButton.click();
    } else {
      console.warn('[TaskResize] Could not find day button in date picker');
    }
  }

  /**
   * Check if currently resizing (to prevent conflicts with drag/drop)
   * @returns {boolean} - True if currently resizing
   */
  function isCurrentlyResizing() {
    return resizeState.isResizing;
  }

  /**
   * Clean up resize functionality
   */
  function cleanup() {
    console.log('[TaskResize] Cleaning up task resize functionality');

    // Remove all resize handles
    const handles = document.querySelectorAll('.jt-task-resize-handle');
    handles.forEach(handle => handle.remove());

    // Reset position style on all task cards
    const taskCards = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');
    taskCards.forEach(card => {
      if (card.style.position === 'relative') {
        card.style.position = '';
      }
    });

    // Remove document-level listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);

    // Clear any highlighted cells
    const highlightedCells = document.querySelectorAll('.jt-resize-preview');
    highlightedCells.forEach(cell => {
      cell.classList.remove('jt-resize-preview');
    });

    // Reset state
    resizeState.isResizing = false;
    resizeState.taskElement = null;
    resizeState.startCell = null;
    resizeState.currentEndCell = null;
    resizeState.highlightedCells = [];

    // Restore text selection
    document.body.style.userSelect = '';
  }

  // Public API
  return {
    initializeTaskResize,
    isCurrentlyResizing,
    cleanup
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TaskResize = TaskResize;
}
