// Event Handlers Module
// Handles all drag and drop DOM events

const DragDropEventHandlers = (() => {
  /**
   * Create event handlers with access to shared state
   * @param {Object} state - Shared state object containing draggedElement, draggedItemData, etc.
   * @param {Function} attemptDateChangeFn - The date change function to call on drop
   * @returns {Object} Event handler functions
   */
  function createHandlers(state, attemptDateChangeFn) {
    function handleDragStart(e) {
      // Prevent dragging if currently resizing a task
      if (window.TaskResize && window.TaskResize.isCurrentlyResizing()) {
        e.preventDefault();
        console.log('EventHandlers: Drag prevented - task resize in progress');
        return false;
      }

      state.draggedElement = this;
      this.style.cursor = 'grabbing';
      this.style.opacity = '0.5';

      // Capture Shift key state at drag start
      state.shiftKeyAtDragStart = e.shiftKey;

      const sourceCell = this.closest('td');
      state.sourceDateInfo = window.DateUtils ? window.DateUtils.extractFullDateInfo(sourceCell) : null;

      console.log('EventHandlers: ==========================================');
      console.log('EventHandlers: *** DRAG START ***');
      console.log('EventHandlers: Source date:', JSON.stringify(state.sourceDateInfo));
      console.log('EventHandlers: Shift key:', state.shiftKeyAtDragStart);
      console.log('EventHandlers: ==========================================');

      state.draggedItemData = {
        element: this,
        html: this.innerHTML,
        originalParent: sourceCell
      };

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragEnd(e) {
      console.log('EventHandlers: *** DRAG END ***');
      this.style.opacity = '1';
      this.style.cursor = 'grab';

      document.querySelectorAll('.jt-drop-zone').forEach(cell => {
        cell.classList.remove('jt-drop-zone');
        cell.style.backgroundColor = '';
        cell.style.border = '';
      });
    }

    function handleDragOver(e) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDragEnter(e) {
      const dateInfo = window.DateUtils ? window.DateUtils.extractDateFromCell(this) : null;
      console.log(`EventHandlers: handleDragEnter - Entering cell with date: ${dateInfo}`);

      if (!this.classList.contains('jt-drop-zone')) {
        this.classList.add('jt-drop-zone');
        this.style.border = '2px dashed rgb(59, 130, 246)';
        this.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      }
    }

    function handleDragLeave(e) {
      if (this.classList.contains('jt-drop-zone')) {
        this.classList.remove('jt-drop-zone');
        this.style.border = '';
        this.style.backgroundColor = '';
      }
    }

    function handleDrop(e) {
      // CRITICAL: Log at the very top to confirm function is called
      console.log('EventHandlers: ========================================');
      console.log('EventHandlers: ========== DROP EVENT START ==========');
      console.log('EventHandlers: ========================================');

      try {
        if (e.stopPropagation) {
          e.stopPropagation();
        }
        e.preventDefault();
        console.log('EventHandlers: Event handlers called successfully');

        this.classList.remove('jt-drop-zone');
        this.style.border = '';
        this.style.backgroundColor = '';
        console.log('EventHandlers: Visual cleanup complete');

        console.log('EventHandlers: Checking draggedElement:', !!state.draggedElement);
        console.log('EventHandlers: Checking draggedItemData:', !!state.draggedItemData);

        if (state.draggedElement && state.draggedItemData) {
          const targetCell = this;
          const originalCell = state.draggedItemData.originalParent;
          console.log('EventHandlers: Target cell:', targetCell);
          console.log('EventHandlers: Original cell:', originalCell);

          if (targetCell === originalCell) {
            console.log('EventHandlers: Drop on same cell, ignoring');
            return false;
          }

          console.log('EventHandlers: Different cells confirmed, proceeding with date extraction');
          console.log('EventHandlers: Extracting target date info...');
          let dateInfo = window.DateUtils ? window.DateUtils.extractFullDateInfo(targetCell, state.sourceDateInfo) : null;
          console.log('EventHandlers: Target date info extracted:', JSON.stringify(dateInfo));

          console.log('EventHandlers: Extracting source date info...');
          const sourceDateInfo = window.DateUtils ? window.DateUtils.extractFullDateInfo(originalCell, state.sourceDateInfo) : null;
          console.log('EventHandlers: Source date info extracted:', JSON.stringify(sourceDateInfo));

          if (dateInfo) {
            console.log('EventHandlers: Date info is valid, proceeding with year boundary checks');
            // Handle year transitions when dragging between months
            if (sourceDateInfo && sourceDateInfo.month && dateInfo.month && window.DateUtils) {
              const monthMap = window.DateUtils.MONTH_MAP;
              const sourceMonth = monthMap[sourceDateInfo.month];
              const targetMonth = monthMap[dateInfo.month];

              console.log(`EventHandlers: Year boundary check - Source: ${sourceDateInfo.month} ${sourceDateInfo.day}, ${sourceDateInfo.year} (month index: ${sourceMonth})`);
              console.log(`EventHandlers: Year boundary check - Target: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year} (month index: ${targetMonth})`);

              // If source and target are the same month, use source year as baseline
              if (sourceMonth === targetMonth) {
                console.log(`EventHandlers: Same month drag - using source year ${sourceDateInfo.year}`);
                dateInfo.year = sourceDateInfo.year;
              }
              // If dragging from December to January, increment year
              else if (sourceMonth === 11 && targetMonth === 0) {
                const originalYear = dateInfo.year;
                dateInfo.year = sourceDateInfo.year + 1;
                console.log(`EventHandlers: *** YEAR TRANSITION (Dec → Jan) *** Changed year from ${originalYear} to ${dateInfo.year}`);
                console.log(`EventHandlers: *** Target date will be: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
                if (window.UIUtils) {
                  window.UIUtils.showNotification(`Year transition: Moving to Jan ${dateInfo.year}`);
                }
              }
              // If dragging from January to December, decrement year
              else if (sourceMonth === 0 && targetMonth === 11) {
                const originalYear = dateInfo.year;
                dateInfo.year = sourceDateInfo.year - 1;
                console.log(`EventHandlers: *** YEAR TRANSITION (Jan → Dec) *** Changed year from ${originalYear} to ${dateInfo.year}`);
                console.log(`EventHandlers: *** Target date will be: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
                if (window.UIUtils) {
                  window.UIUtils.showNotification(`Year transition: Moving to Dec ${dateInfo.year}`);
                }
              }
              // For other month changes, use source year as baseline
              else {
                console.log(`EventHandlers: Different month, same year - using source year ${sourceDateInfo.year}`);
                dateInfo.year = sourceDateInfo.year;
              }
            } else {
              if (!sourceDateInfo) {
                console.error('EventHandlers: Failed to extract source date info - year transition detection skipped');
              } else if (!sourceDateInfo.month) {
                console.error('EventHandlers: Source date info missing month - year transition detection skipped');
              } else if (!dateInfo.month) {
                console.error('EventHandlers: Target date info missing month - year transition detection skipped');
              }
            }

            // Check Shift key at drop time (OR the state captured at drag start)
            const isShiftPressed = e.shiftKey || state.shiftKeyAtDragStart;
            console.log('EventHandlers: Drop - Shift at drop:', e.shiftKey, 'Shift at start:', state.shiftKeyAtDragStart, 'Final:', isShiftPressed);

            // Check if dropping on weekend and Shift is NOT pressed
            if (!isShiftPressed && window.WeekendUtils && window.WeekendUtils.isWeekendCell(targetCell, dateInfo)) {
              console.log('EventHandlers: Weekend detected, auto-skipping to Monday');
              const originalDate = `${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`;
              dateInfo = window.WeekendUtils.adjustDateToSkipWeekend(dateInfo);
              console.log(`EventHandlers: Weekend skip - changed from ${originalDate} to ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
              if (window.UIUtils) {
                window.UIUtils.showNotification('Weekend detected - moved to Monday');
              }
            } else if (isShiftPressed && window.WeekendUtils && window.WeekendUtils.isWeekendCell(targetCell, dateInfo)) {
              console.log('EventHandlers: Shift held - allowing weekend drop');
            }

            console.log(`EventHandlers: Final date before formatting: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
            console.log('EventHandlers: About to call attemptDateChange...');
            if (attemptDateChangeFn) {
              attemptDateChangeFn(state.draggedElement, dateInfo.day, targetCell, dateInfo, state.sourceDateInfo);
            }
            console.log('EventHandlers: attemptDateChange called (async operations continuing)');
          } else {
            console.error('EventHandlers: *** CRITICAL ERROR *** Could not determine target date');
            if (window.UIUtils) {
              window.UIUtils.showNotification('Could not determine target date. Please try manually.');
            }
          }
        } else {
          console.error('EventHandlers: Drop handler called but draggedElement or draggedItemData is missing');
          if (!state.draggedElement) console.error('EventHandlers: draggedElement is null/undefined');
          if (!state.draggedItemData) console.error('EventHandlers: draggedItemData is null/undefined');
        }

        // Reset shift state
        state.shiftKeyAtDragStart = false;
        console.log('EventHandlers: ========== DROP EVENT END ==========');

        return false;

      } catch (error) {
        console.error('EventHandlers: *** EXCEPTION IN handleDrop ***');
        console.error('EventHandlers: Error name:', error.name);
        console.error('EventHandlers: Error message:', error.message);
        console.error('EventHandlers: Error stack:', error.stack);
        if (window.UIUtils) {
          window.UIUtils.showNotification('Error during drag & drop. Check console for details.');
        }
        return false;
      }
    }

    return {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    };
  }

  // Public API
  return {
    createHandlers
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DragDropEventHandlers = DragDropEventHandlers;
}
