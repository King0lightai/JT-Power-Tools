// JobTread Schedule Drag & Drop Feature Module
// Enables dragging schedule items between dates

const DragDropFeature = (() => {
  let draggedElement = null;
  let draggedItemData = null;
  let observer = null;
  let isActive = false;
  let shiftKeyAtDragStart = false; // Track Shift at drag start

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('DragDrop: Already initialized');
      return;
    }

    console.log('DragDrop: Initializing...');
    isActive = true;

    // Inject weekend styling
    injectWeekendCSS();

    // Initial setup
    setTimeout(() => {
      initDragAndDrop();
      console.log('DragDrop: Feature loaded');
    }, 1000);

    // Watch for DOM changes and re-initialize
    observer = new MutationObserver((mutations) => {
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

  // Cleanup the feature
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

    // Remove draggable attributes and event listeners
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[draggable="true"]');
    scheduleItems.forEach(item => {
      item.removeAttribute('draggable');
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

    // Remove weekend CSS
    const weekendStyle = document.getElementById('jt-weekend-styling');
    if (weekendStyle) {
      weekendStyle.remove();
    }

    console.log('DragDrop: Cleanup complete');
  }

  // Inject CSS to grey out weekends
  function injectWeekendCSS() {
    if (document.getElementById('jt-weekend-styling')) return;

    const style = document.createElement('style');
    style.id = 'jt-weekend-styling';
    style.textContent = `
      /* Grey out weekend columns */
      td.jt-weekend-cell {
        background-color: rgba(0, 0, 0, 0.03) !important;
        opacity: 0.6;
      }

      /* Slightly darker on hover to show it's still interactive with Shift */
      td.jt-weekend-cell:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Function to make schedule items draggable
  function makeScheduleItemsDraggable() {
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');

    scheduleItems.forEach(item => {
      if (!item.hasAttribute('draggable')) {
        item.setAttribute('draggable', 'true');
        item.style.cursor = 'grab';

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
      }
    });
  }

  // Function to make date cells droppable
  function makeDateCellsDroppable() {
    const dateCells = document.querySelectorAll('td.group.text-xs');

    dateCells.forEach(cell => {
      if (!cell.classList.contains('jt-drop-enabled')) {
        cell.classList.add('jt-drop-enabled');

        // Mark weekends
        if (isWeekendCell(cell)) {
          cell.classList.add('jt-weekend-cell');
        }

        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('dragenter', handleDragEnter);
      }
    });
  }

  // Check if a cell is a weekend
  function isWeekendCell(cell, providedDateInfo = null) {
    const dateInfo = providedDateInfo || extractFullDateInfo(cell);
    if (!dateInfo || !dateInfo.day || !dateInfo.month) return false;

    // Use the year from dateInfo (which now includes year from extraction)
    const year = dateInfo.year || new Date().getFullYear();

    // Parse the date
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const monthIndex = monthMap[dateInfo.month];
    if (monthIndex === undefined) return false;

    const date = new Date(year, monthIndex, parseInt(dateInfo.day));
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  // Adjust date to skip weekends (move to next Monday)
  function adjustDateToSkipWeekend(dateInfo) {
    const year = dateInfo.year || new Date().getFullYear();
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const monthIndex = monthMap[dateInfo.month];
    const date = new Date(year, monthIndex, parseInt(dateInfo.day));
    const dayOfWeek = date.getDay();

    // If Saturday (6), add 2 days to get to Monday
    // If Sunday (0), add 1 day to get to Monday
    if (dayOfWeek === 6) {
      date.setDate(date.getDate() + 2);
    } else if (dayOfWeek === 0) {
      date.setDate(date.getDate() + 1);
    }

    // Convert back to month abbrev and day (year may have changed)
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      day: date.getDate().toString(),
      month: monthAbbrev[date.getMonth()],
      year: date.getFullYear(),
      fullDisplay: `${monthAbbrev[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    };
  }

  // Event handlers (same as original code)
  function handleDragStart(e) {
    draggedElement = this;
    this.style.cursor = 'grabbing';
    this.style.opacity = '0.5';

    // Capture Shift key state at drag start
    shiftKeyAtDragStart = e.shiftKey;
    console.log('DragDrop: Drag started, Shift key:', shiftKeyAtDragStart);

    draggedItemData = {
      element: this,
      html: this.innerHTML,
      originalParent: this.closest('td')
    };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
  }

  function handleDragEnd(e) {
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
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    this.classList.remove('jt-drop-zone');
    this.style.border = '';
    this.style.backgroundColor = '';

    if (draggedElement && draggedItemData) {
      const targetCell = this;
      const originalCell = draggedItemData.originalParent;

      if (targetCell === originalCell) {
        return false;
      }

      let dateInfo = extractFullDateInfo(targetCell);
      const sourceDateInfo = extractFullDateInfo(originalCell);

      if (dateInfo) {
        // Handle year transitions when dragging between months
        if (sourceDateInfo && sourceDateInfo.month && dateInfo.month) {
          const monthMap = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const sourceMonth = monthMap[sourceDateInfo.month];
          const targetMonth = monthMap[dateInfo.month];

          // If dragging from December to January, increment year
          if (sourceMonth === 11 && targetMonth === 0) {
            dateInfo.year = sourceDateInfo.year + 1;
            console.log('DragDrop: Year transition detected (Dec → Jan), year:', dateInfo.year);
          }
          // If dragging from January to December, decrement year
          else if (sourceMonth === 0 && targetMonth === 11) {
            dateInfo.year = sourceDateInfo.year - 1;
            console.log('DragDrop: Year transition detected (Jan → Dec), year:', dateInfo.year);
          }
        }

        // Check Shift key at drop time (OR the state captured at drag start)
        const isShiftPressed = e.shiftKey || shiftKeyAtDragStart;
        console.log('DragDrop: Drop - Shift at drop:', e.shiftKey, 'Shift at start:', shiftKeyAtDragStart);

        // Check if dropping on weekend and Shift is NOT pressed
        if (!isShiftPressed && isWeekendCell(targetCell, dateInfo)) {
          console.log('DragDrop: Weekend detected, auto-skipping to Monday');
          dateInfo = adjustDateToSkipWeekend(dateInfo);
          showNotification('Weekend detected - moved to Monday');
        } else if (isShiftPressed && isWeekendCell(targetCell, dateInfo)) {
          console.log('DragDrop: Shift held - allowing weekend drop');
        }

        attemptDateChange(draggedElement, dateInfo.day, targetCell, dateInfo);
      } else {
        console.log('DragDrop: Could not determine target date');
        showNotification('Could not determine target date. Please try manually.');
      }
    }

    // Reset shift state
    shiftKeyAtDragStart = false;

    return false;
  }

  // Helper functions (kept from original)
  function extractDateFromCell(cell) {
    if (!cell) return null;
    const dateDiv = cell.querySelector('div.font-bold');
    if (dateDiv) {
      return dateDiv.textContent.trim();
    }
    return null;
  }

  function extractFullDateInfo(cell) {
    if (!cell) return null;

    const dateDiv = cell.querySelector('div.font-bold');
    if (!dateDiv) return null;

    const dateNumber = dateDiv.textContent.trim();
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    let month = null;
    let year = null;

    // Search for month marker in table
    const table = cell.closest('table');
    if (table) {
      const allCells = table.querySelectorAll('td');
      const cellArray = Array.from(allCells);
      const currentCellIndex = cellArray.indexOf(cell);

      for (let i = currentCellIndex; i >= 0; i--) {
        const cellToCheck = cellArray[i];
        const boldDivs = cellToCheck.querySelectorAll('div.font-bold');

        for (const div of boldDivs) {
          const text = div.textContent.trim();

          // Check for year (4 digits)
          const yearMatch = text.match(/\b(20\d{2})\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[1]);
          }

          // Check for month name
          for (let m = 0; m < monthNames.length; m++) {
            if (text === monthNames[m]) {
              month = monthAbbrev[m];
              break;
            }
          }
          if (month) break;
        }
        if (month) break;
      }
    }

    // Fallback to current month and year
    if (!month || !year) {
      const now = new Date();
      if (!month) month = monthAbbrev[now.getMonth()];
      if (!year) year = now.getFullYear();
    }

    return {
      day: dateNumber,
      month: month,
      year: year,
      monthYear: month,
      fullDisplay: `${month} ${dateNumber}, ${year}`
    };
  }

  function formatDateForInput(dateInfo) {
    let month = dateInfo.month || '';

    if (!month) {
      const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      month = monthAbbrev[now.getMonth()];
    }

    // Return format without year - JobTread infers year from calendar context
    // This allows cross-year drags to work (e.g., Dec to Jan assumes next year)
    return `${month} ${dateInfo.day}`;
  }

  function attemptDateChange(element, newDateNumber, targetCell, providedDateInfo = null) {
    const dateInfo = providedDateInfo || extractFullDateInfo(targetCell);

    // Inject CSS to make entire sidebar structure completely invisible
    const hideStyle = document.createElement('style');
    hideStyle.id = 'jt-hide-sidebar-temp';
    hideStyle.textContent = `
        /* Hide the outer sidebar container (the one with z-30) */
        div.z-30.absolute.top-0.bottom-0.right-0 {
            opacity: 0 !important;
            position: fixed !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            pointer-events: none !important;
        }
        /* Hide the white background layer */
        div.absolute.inset-0.bg-white.shadow-line-left {
            opacity: 0 !important;
            background: transparent !important;
        }
        /* Hide the inner sticky sidebar */
        div.overflow-y-auto.overscroll-contain.sticky {
            opacity: 0 !important;
        }
        /* Hide any fixed/absolute overlays and backdrops */
        body > div.fixed.inset-0:not(.jt-formatter-toolbar),
        div[style*="position: fixed"][style*="inset"],
        div[class*="backdrop"] {
            opacity: 0 !important;
            position: fixed !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
        }
    `;
    document.head.appendChild(hideStyle);

    // Failsafe: Remove CSS after 5 seconds no matter what
    const failsafeTimeout = setTimeout(() => {
      const style = document.getElementById('jt-hide-sidebar-temp');
      if (style) {
        style.remove();
        console.log('DragDrop: Failsafe removed hiding CSS');
      }
    }, 5000);

    // Click to open sidebar
    element.click();

    // Wait for sidebar and process
    setTimeout(() => {
      const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

      if (sidebar) {
        console.log('DragDrop: Sidebar found, processing date change...');

        // Find start date field
        const allDateFields = sidebar.querySelectorAll('div.text-gray-700.truncate.leading-tight');
        let startDateParent = null;

        for (const field of allDateFields) {
          const text = field.textContent.trim();
          if (/^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(text) ||
              /^(Today|Tomorrow|Yesterday)$/.test(text)) {
            startDateParent = field.closest('div.group.items-center');
            break;
          }
        }

        if (startDateParent) {
          const formattedDate = formatDateForInput(dateInfo);
          console.log('DragDrop: Formatting date:', formattedDate);

          // Look for and check any "notify" or "update linked" checkboxes
          const checkboxes = sidebar.querySelectorAll('input[type="checkbox"]');
          console.log('DragDrop: Found', checkboxes.length, 'checkboxes in sidebar');

          checkboxes.forEach((checkbox, index) => {
            // Look for labels or nearby text to identify the checkbox
            const label = checkbox.closest('label') || checkbox.parentElement;
            const labelText = label ? label.textContent.toLowerCase() : '';

            console.log(`DragDrop: Checkbox ${index}: "${labelText.substring(0, 50)}", checked=${checkbox.checked}`);

            // Check for keywords that suggest this checkbox should be checked
            const shouldCheck = labelText.includes('notify') ||
                               labelText.includes('linked') ||
                               labelText.includes('dependent') ||
                               labelText.includes('update') ||
                               labelText.includes('push') ||
                               labelText.includes('move');

            if (shouldCheck && !checkbox.checked) {
              console.log('DragDrop: Checking checkbox:', labelText.substring(0, 50));
              checkbox.click();
            }
          });

          startDateParent.click();

          setTimeout(() => {
            let inputField = null;
            const inputs = sidebar.querySelectorAll('input');

            for (const input of inputs) {
              const placeholder = input.getAttribute('placeholder');
              const style = window.getComputedStyle(input);

              if (placeholder && /^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(placeholder)) {
                if (style.display !== 'none' && style.opacity !== '0') {
                  inputField = input;
                  break;
                }
              }
            }

            if (!inputField) {
              const datePickerPopup = document.querySelector('div.block.relative input[placeholder]');
              if (datePickerPopup) {
                inputField = datePickerPopup;
              }
            }

            if (inputField) {
              inputField.value = '';
              inputField.focus();
              inputField.value = formattedDate;

              // Dispatch input event
              inputField.dispatchEvent(new Event('input', { bubbles: true }));

              // Simulate pressing Enter key to trigger the full update
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              inputField.dispatchEvent(enterEvent);

              // Also dispatch keyup for Enter
              const enterUpEvent = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              inputField.dispatchEvent(enterUpEvent);

              // Dispatch change and blur events
              inputField.dispatchEvent(new Event('change', { bubbles: true }));
              inputField.dispatchEvent(new Event('blur', { bubbles: true }));

              console.log('DragDrop: Date typed and Enter key simulated');

              setTimeout(() => {
                closeSidebar(failsafeTimeout);
              }, 500);
            } else {
              console.log('DragDrop: Could not find input field');
              showNotification('Could not find date input field. Please try manually.');
              // Cleanup CSS even on error
              setTimeout(() => {
                closeSidebar(failsafeTimeout);
              }, 500);
            }
          }, 400);
        } else {
          console.log('DragDrop: Could not find start date field');
          showNotification('Could not find date field. Please update manually.');
          // Cleanup CSS
          closeSidebar(failsafeTimeout);
        }
      } else {
        console.log('DragDrop: Sidebar did not open');
        showNotification('Sidebar did not open. Please try manually.');
        // Cleanup CSS
        closeSidebar(failsafeTimeout);
      }
    }, 500);
  }

  function closeSidebar(failsafeTimeout) {
    console.log('DragDrop: Attempting to close sidebar...');

    // Clear the failsafe timeout since we're handling cleanup now
    if (failsafeTimeout) {
      clearTimeout(failsafeTimeout);
      console.log('DragDrop: Cleared failsafe timeout');
    }

    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

    if (sidebar) {
      const closeButtons = sidebar.querySelectorAll('div[role="button"]');

      for (const button of closeButtons) {
        const text = button.textContent.trim();
        if (text.includes('Close')) {
          console.log('DragDrop: Found and clicking Close button');
          button.click();

          // Wait for sidebar to close BEFORE removing hiding CSS
          setTimeout(() => {
            const hideStyle = document.getElementById('jt-hide-sidebar-temp');
            if (hideStyle) {
              hideStyle.remove();
              console.log('DragDrop: Removed hiding CSS after sidebar closed');
            }
          }, 800); // Wait 800ms for sidebar close animation to fully complete

          return;
        }
      }

      console.log('DragDrop: Could not find Close button, sidebar will remain open');
      // Still remove CSS even if close failed
      setTimeout(() => {
        const hideStyle = document.getElementById('jt-hide-sidebar-temp');
        if (hideStyle) {
          hideStyle.remove();
        }
      }, 800);
    } else {
      console.log('DragDrop: Sidebar not found during close');
      // Remove CSS anyway
      const hideStyle = document.getElementById('jt-hide-sidebar-temp');
      if (hideStyle) {
        hideStyle.remove();
        console.log('DragDrop: Removed hiding CSS');
      }
    }
  }

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

  function initDragAndDrop() {
    makeScheduleItemsDraggable();
    makeDateCellsDroppable();
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
