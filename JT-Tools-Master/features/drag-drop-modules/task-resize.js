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

    // Create resize handle element
    const handle = document.createElement('div');
    handle.className = 'jt-task-resize-handle';
    handle.title = 'Drag to expand task across days';
    handle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M9 5l7 7-7 7"/>
      </svg>
    `;

    // Append handle to card
    card.appendChild(handle);

    // Attach event listener
    handle.addEventListener('mousedown', (e) => handleResizeStart(e, card));
  }

  /**
   * Handle resize start (mousedown on resize handle)
   * @param {MouseEvent} e - The mouse event
   * @param {HTMLElement} card - The task card being resized
   */
  function handleResizeStart(e, card) {
    e.preventDefault();
    e.stopPropagation();

    console.log('[TaskResize] Resize started');

    // Get the parent cell of this task
    const startCell = card.closest('td.group.text-xs');
    if (!startCell) {
      console.error('[TaskResize] Could not find parent cell');
      return;
    }

    // Get current days value
    const daysInput = document.querySelector('input[value]');
    const currentDays = daysInput ? parseInt(daysInput.value) || 1 : 1;

    resizeState.isResizing = true;
    resizeState.taskElement = card;
    resizeState.startCell = startCell;
    resizeState.currentEndCell = startCell;
    resizeState.startX = e.clientX;
    resizeState.originalDays = currentDays;
    resizeState.highlightedCells = [startCell];

    // Add visual feedback
    card.classList.add('jt-task-resizing');
    startCell.classList.add('jt-resize-preview');

    // Prevent dragging the task card itself
    card.setAttribute('draggable', 'false');

    // Attach document-level listeners
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    // Prevent text selection
    document.body.style.userSelect = 'none';
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

    // Calculate the number of days
    const numberOfDays = resizeState.highlightedCells.length;

    // Update the task's Days field if it changed
    if (numberOfDays > 1 && numberOfDays !== resizeState.originalDays) {
      updateTaskDays(numberOfDays);

      // Show notification
      if (window.UIUtils) {
        window.UIUtils.showNotification(`Task expanded to ${numberOfDays} days`);
      }
    }

    // Clean up visual feedback
    if (resizeState.taskElement) {
      resizeState.taskElement.classList.remove('jt-task-resizing');
      resizeState.taskElement.setAttribute('draggable', 'true');
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

    // Remove document-level listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);

    // Restore text selection
    document.body.style.userSelect = '';
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
   * Update the task's Days field in the sidebar
   * @param {number} days - The new number of days
   */
  function updateTaskDays(days) {
    console.log(`[TaskResize] Updating task to ${days} days`);

    // Find the Days input field in the sidebar
    const sidebar = document.querySelector('.overflow-y-auto.overscroll-contain.sticky');
    if (!sidebar) {
      console.error('[TaskResize] Could not find task sidebar');
      return;
    }

    // Find the Days input - look for the label with "Days" text
    const labels = Array.from(sidebar.querySelectorAll('div'));
    const daysLabel = labels.find(div => div.textContent.trim() === 'Days');

    if (!daysLabel) {
      console.error('[TaskResize] Could not find Days label');
      return;
    }

    // Find the input field near the Days label
    const daysContainer = daysLabel.closest('div');
    const daysInput = daysContainer?.querySelector('input[value]');

    if (daysInput) {
      // Update the input value
      daysInput.value = days.toString();

      // Trigger input event to notify the application
      const inputEvent = new Event('input', { bubbles: true });
      daysInput.dispatchEvent(inputEvent);

      // Also trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      daysInput.dispatchEvent(changeEvent);

      console.log(`[TaskResize] Updated Days field to ${days}`);
    } else {
      console.error('[TaskResize] Could not find Days input field');
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
