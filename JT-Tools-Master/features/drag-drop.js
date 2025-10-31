// JobTread Schedule Drag & Drop Feature Module
// Enables dragging schedule items between dates

const DragDropFeature = (() => {
  let draggedElement = null;
  let draggedItemData = null;
  let observer = null;
  let isActive = false;

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('DragDrop: Already initialized');
      return;
    }

    console.log('DragDrop: Initializing...');
    isActive = true;

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
    });

    console.log('DragDrop: Cleanup complete');
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

        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('dragenter', handleDragEnter);
      }
    });
  }

  // Event handlers (same as original code)
  function handleDragStart(e) {
    draggedElement = this;
    this.style.cursor = 'grabbing';
    this.style.opacity = '0.5';

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

      const targetDate = extractDateFromCell(targetCell);

      if (targetDate) {
        attemptDateChange(draggedElement, targetDate, targetCell);
      } else {
        console.log('DragDrop: Could not determine target date');
        showNotification('Could not determine target date. Please try manually.');
      }
    }

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

    // Fallback to current month
    if (!month) {
      const now = new Date();
      month = monthAbbrev[now.getMonth()];
    }

    return {
      day: dateNumber,
      month: month,
      monthYear: month,
      fullDisplay: `${month} ${dateNumber}`
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

    return `${month} ${dateInfo.day}`;
  }

  function attemptDateChange(element, newDateNumber, targetCell) {
    const dateInfo = extractFullDateInfo(targetCell);

    // Inject CSS to hide sidebar AND backdrop completely behind the calendar
    const hideStyle = document.createElement('style');
    hideStyle.id = 'jt-hide-sidebar-temp';
    hideStyle.textContent = `
        /* Hide the sidebar completely */
        div.overflow-y-auto.overscroll-contain.sticky {
            opacity: 0 !important;
            visibility: hidden !important;
            position: fixed !important;
            z-index: -9999 !important;
            pointer-events: none !important;
            transform: translateX(-9999px) !important;
            display: none !important;
        }
        /* Hide any backdrop/overlay */
        div[class*="fixed"][class*="inset"] {
            opacity: 0 !important;
            visibility: hidden !important;
            z-index: -9999 !important;
            pointer-events: none !important;
        }
        /* Hide any modal backgrounds */
        div[style*="position: fixed"] {
            z-index: -9999 !important;
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

    // Always remove the hiding CSS immediately
    const hideStyle = document.getElementById('jt-hide-sidebar-temp');
    if (hideStyle) {
      hideStyle.remove();
      console.log('DragDrop: Removed hiding CSS');
    }

    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

    if (sidebar) {
      const closeButtons = sidebar.querySelectorAll('div[role="button"]');

      for (const button of closeButtons) {
        const text = button.textContent.trim();
        if (text.includes('Close')) {
          console.log('DragDrop: Found and clicking Close button');
          button.click();
          return;
        }
      }

      console.log('DragDrop: Could not find Close button, sidebar will remain open');
    } else {
      console.log('DragDrop: Sidebar not found during close');
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
