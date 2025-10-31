// JobTread Schedule Drag & Drop Extension
// Enables dragging schedule items between dates

let draggedElement = null;
let draggedItemData = null;

// Function to make schedule items draggable
function makeScheduleItemsDraggable() {
    // Find all schedule items (divs with cursor-pointer class that have background colors)
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');

    scheduleItems.forEach(item => {
        if (!item.hasAttribute('draggable')) {
            item.setAttribute('draggable', 'true');
            item.style.cursor = 'grab';

            // Add drag event listeners
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
        }
    });
}

// Function to make date cells droppable
function makeDateCellsDroppable() {
    // Find all table cells in the calendar
    const dateCells = document.querySelectorAll('td.group.text-xs');

    dateCells.forEach(cell => {
        if (!cell.classList.contains('jt-drop-enabled')) {
            cell.classList.add('jt-drop-enabled');

            // Add drop event listeners
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('dragenter', handleDragEnter);
        }
    });
}

// Handle drag start
function handleDragStart(e) {
    draggedElement = this;
    this.style.cursor = 'grabbing';
    this.style.opacity = '0.5';

    // Try to extract item data (you may need to adjust this based on actual HTML structure)
    draggedItemData = {
        element: this,
        html: this.innerHTML,
        originalParent: this.closest('td')
    };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);

    console.log('Drag started:', draggedItemData);
}

// Handle drag end
function handleDragEnd(e) {
    this.style.opacity = '1';
    this.style.cursor = 'grab';

    // Remove all drop zone highlights
    document.querySelectorAll('.jt-drop-zone').forEach(cell => {
        cell.classList.remove('jt-drop-zone');
        cell.style.backgroundColor = '';
        cell.style.border = '';
    });
}

// Handle drag over (required to allow drop)
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }

    e.dataTransfer.dropEffect = 'move';
    return false;
}

// Handle drag enter
function handleDragEnter(e) {
    // Highlight the drop zone
    if (!this.classList.contains('jt-drop-zone')) {
        this.classList.add('jt-drop-zone');
        this.style.border = '2px dashed rgb(59, 130, 246)';
        this.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    }
}

// Handle drag leave
function handleDragLeave(e) {
    // Remove highlight when leaving the drop zone
    if (this.classList.contains('jt-drop-zone')) {
        this.classList.remove('jt-drop-zone');
        this.style.border = '';
        this.style.backgroundColor = '';
    }
}

// Handle drop
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    e.preventDefault();

    // Remove drop zone styling
    this.classList.remove('jt-drop-zone');
    this.style.border = '';
    this.style.backgroundColor = '';

    if (draggedElement && draggedItemData) {
        const targetCell = this;
        const originalCell = draggedItemData.originalParent;

        // Don't do anything if dropped on the same cell
        if (targetCell === originalCell) {
            console.log('Dropped on same cell, no action needed');
            return false;
        }

        console.log('Item dropped on new date cell');
        console.log('Original cell:', originalCell);
        console.log('Target cell:', targetCell);

        // Try to extract date information from the cell
        const targetDate = extractDateFromCell(targetCell);
        const originalDate = extractDateFromCell(originalCell);

        console.log('Moving from:', originalDate, 'to:', targetDate);

        // Attempt to update - will open sidebar and highlight date field
        if (targetDate) {
            attemptDateChange(draggedElement, targetDate, targetCell);
        } else {
            alert('Could not determine target date. Please try manually updating the item.');
        }
    }

    return false;
}

// Extract date from a table cell
function extractDateFromCell(cell) {
    if (!cell) return null;

    // Try to find the date number in the cell
    const dateDiv = cell.querySelector('div.font-bold');
    if (dateDiv) {
        const dateNumber = dateDiv.textContent.trim();

        // You'll need to determine the month and year from context
        // This is a simplified version - you may need to enhance this
        return dateNumber;
    }

    return null;
}

// Attempt to change the date by opening the task sidebar
function attemptDateChange(element, newDateNumber, targetCell) {
    console.log('Attempting to change date to:', newDateNumber);

    // Extract full date info from the target cell
    const dateInfo = extractFullDateInfo(targetCell);
    console.log('Full date info:', dateInfo);

    // Inject CSS to hide sidebar before it appears
    const hideStyle = document.createElement('style');
    hideStyle.id = 'jt-hide-sidebar-temp';
    hideStyle.textContent = `
        div.overflow-y-auto.overscroll-contain.sticky,
        div.overflow-y-auto.overscroll-contain.sticky * {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(hideStyle);
    console.log('Injected CSS to hide sidebar');

    // Click on the element to open the task sidebar
    console.log('Clicking on task to open sidebar...');
    element.click();

    // Wait for sidebar to appear and then highlight the date field
    setTimeout(() => {
        const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

        if (sidebar) {
            console.log('Sidebar found!');

            // Hide the sidebar completely with !important to override all styles
            sidebar.style.setProperty('opacity', '0', 'important');
            sidebar.style.setProperty('visibility', 'hidden', 'important');
            sidebar.style.setProperty('pointer-events', 'none', 'important');

            // Also hide parent containers
            let parent = sidebar.parentElement;
            let depth = 0;
            while (parent && depth < 3) {
                parent.style.setProperty('opacity', '0', 'important');
                parent.style.setProperty('visibility', 'hidden', 'important');
                parent = parent.parentElement;
                depth++;
            }

            console.log('Sidebar and parents hidden with !important');

            // Find the Start date field by looking for date patterns
            // Start date will have text like "Wed, Nov 5" or similar
            const allDateFields = sidebar.querySelectorAll('div.text-gray-700.truncate.leading-tight');

            let startDateParent = null;

            // Look for the field that contains a date pattern (e.g., "Wed, Dec 10")
            // OR relative dates like "Today", "Tomorrow", "Yesterday"
            for (const field of allDateFields) {
                const text = field.textContent.trim();
                // Match date patterns like "Mon, Jan 1" OR relative dates
                if (/^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(text) ||
                    /^(Today|Tomorrow|Yesterday)$/.test(text)) {
                    startDateParent = field.closest('div.group.items-center');
                    console.log('Found start date field:', text);
                    break;
                }
            }

            if (startDateParent) {
                // Instead of clicking through the calendar, type the date directly!
                console.log('Attempting to type date directly...');

                // Format the date as "Mon Day" (e.g., "Nov 7")
                const formattedDate = formatDateForInput(dateInfo);
                console.log('Formatted date:', formattedDate);

                // Show notification
                showNotification(`Automatically typing date: ${formattedDate}...`);

                // Click to focus the field
                startDateParent.click();

                // Wait a moment, then try to find the input field
                setTimeout(() => {
                    // Try to find the date input field specifically
                    let inputField = null;

                    // Look for input with date-like placeholder (e.g., "Thu, Nov 20")
                    const inputs = sidebar.querySelectorAll('input');
                    for (const input of inputs) {
                        const placeholder = input.getAttribute('placeholder');
                        const style = window.getComputedStyle(input);

                        // Check if placeholder matches date pattern like "Thu, Nov 20"
                        if (placeholder && /^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(placeholder)) {
                            if (style.display !== 'none' && style.opacity !== '0') {
                                inputField = input;
                                console.log('Found date input field with placeholder:', placeholder);
                                break;
                            }
                        }
                    }

                    // Fallback: look for input in the date picker popup (div.block.relative)
                    if (!inputField) {
                        const datePickerPopup = document.querySelector('div.block.relative input[placeholder]');
                        if (datePickerPopup) {
                            inputField = datePickerPopup;
                            console.log('Found input in date picker popup');
                        }
                    }

                    if (inputField) {
                        // Clear existing value
                        inputField.value = '';
                        inputField.focus();

                        // Type the date
                        console.log('Typing date into input:', formattedDate);
                        inputField.value = formattedDate;

                        // Trigger events to ensure the change is registered
                        inputField.dispatchEvent(new Event('input', { bubbles: true }));
                        inputField.dispatchEvent(new Event('change', { bubbles: true }));
                        inputField.dispatchEvent(new Event('blur', { bubbles: true }));

                        console.log('Date typed successfully!');

                        // Show success notification and close sidebar
                        setTimeout(() => {
                            showNotification(`✓ Date changed to ${formattedDate}!`);

                            // Close the sidebar (it's already hidden from view)
                            setTimeout(() => {
                                closeSidebar();
                            }, 500);
                        }, 300);
                    } else {
                        console.log('Could not find input field to type into');
                        showNotification('Could not find date input field. Please try manually.');
                    }
                }, 400);
            } else {
                console.log('Could not find date field with date pattern');
                alert('Could not find the start date field. Please update manually.');
            }
        } else {
            console.log('Could not find task sidebar');
            alert('Task sidebar did not open. Try clicking the item manually.');
        }
    }, 500); // Give the sidebar time to open
}

// Format date for typing into input field (e.g., "Nov 7")
function formatDateForInput(dateInfo) {
    // Use the month from dateInfo if available (extracted from the specific cell)
    let month = dateInfo.month || '';

    // If no month in dateInfo, fall back to current month
    if (!month) {
        const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        month = monthAbbrev[now.getMonth()];
        console.log('No month in dateInfo, using current month as fallback:', month);
    }

    // Return formatted as "Mon Day" (e.g., "Nov 7")
    const result = `${month} ${dateInfo.day}`;
    console.log('Final formatted date:', result);
    return result;
}

// Extract full date information from a cell (including month/year if possible)
function extractFullDateInfo(cell) {
    if (!cell) return null;

    const dateDiv = cell.querySelector('div.font-bold');
    if (!dateDiv) return null;

    const dateNumber = dateDiv.textContent.trim();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let month = null;

    // Method 1: Look for month marker in the same table
    // The first day of each month has the month name displayed
    // e.g., <div class="font-bold">1</div><div class="font-bold">November</div>
    const table = cell.closest('table');
    if (table) {
        // Get all cells in the table
        const allCells = table.querySelectorAll('td');

        // Find the index of the current cell
        const cellArray = Array.from(allCells);
        const currentCellIndex = cellArray.indexOf(cell);

        // Search backwards through cells to find the most recent month marker
        for (let i = currentCellIndex; i >= 0; i--) {
            const cellToCheck = cellArray[i];
            const boldDivs = cellToCheck.querySelectorAll('div.font-bold');

            // Check if any bold div contains a month name
            for (const div of boldDivs) {
                const text = div.textContent.trim();
                for (let m = 0; m < monthNames.length; m++) {
                    if (text === monthNames[m]) {
                        month = monthAbbrev[m];
                        console.log('Found month marker in cell:', monthNames[m], '->', month);
                        break;
                    }
                }
                if (month) break;
            }
            if (month) break;
        }
    }

    // Method 2: Search the row for month name
    if (!month) {
        const row = cell.closest('tr');
        if (row) {
            const cellsInRow = row.querySelectorAll('td');
            for (const cellInRow of cellsInRow) {
                const boldDivs = cellInRow.querySelectorAll('div.font-bold');
                for (const div of boldDivs) {
                    const text = div.textContent.trim();
                    for (let m = 0; m < monthNames.length; m++) {
                        if (text === monthNames[m]) {
                            month = monthAbbrev[m];
                            console.log('Found month in row:', monthNames[m], '->', month);
                            break;
                        }
                    }
                    if (month) break;
                }
                if (month) break;
            }
        }
    }

    // Fallback: use current month
    if (!month) {
        const now = new Date();
        month = monthAbbrev[now.getMonth()];
        console.log('Using current month as fallback:', month);
    }

    return {
        day: dateNumber,
        month: month,
        monthYear: month,
        fullDisplay: `${month} ${dateNumber}`
    };
}

// Close the sidebar
function closeSidebar() {
    console.log('Attempting to close sidebar...');

    // Find the sidebar
    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

    if (sidebar) {
        // Find the Close button - it has an X icon and "Close" text
        const closeButtons = sidebar.querySelectorAll('div[role="button"]');

        for (const button of closeButtons) {
            const text = button.textContent.trim();
            // Look for button with "Close" text and X icon (SVG with path M18 6 6 18M6 6l12 12)
            if (text.includes('Close')) {
                console.log('Found Close button, clicking...');
                button.click();

                // Remove the hiding CSS after a brief delay
                setTimeout(() => {
                    const hideStyle = document.getElementById('jt-hide-sidebar-temp');
                    if (hideStyle) {
                        hideStyle.remove();
                        console.log('Removed sidebar hiding CSS');
                    }
                }, 100);

                console.log('Sidebar closed successfully (was hidden from view)');
                return;
            }
        }

        console.log('Could not find Close button');

        // Remove hiding CSS even if close failed
        setTimeout(() => {
            const hideStyle = document.getElementById('jt-hide-sidebar-temp');
            if (hideStyle) {
                hideStyle.remove();
                console.log('Removed sidebar hiding CSS (fallback)');
            }
        }, 100);

        showNotification('Date changed! Please close the sidebar manually.');
    } else {
        console.log('Sidebar not found');
    }
}

// Show a notification banner
function showNotification(message, targetElement) {
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

    // Add animation
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

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Initialize drag and drop functionality
function initDragAndDrop() {
    makeScheduleItemsDraggable();
    makeDateCellsDroppable();
}

// Run on initial load
setTimeout(() => {
    initDragAndDrop();
    console.log('JobTread Drag & Drop Extension loaded');
}, 1000);

// Watch for DOM changes and re-initialize
const observer = new MutationObserver((mutations) => {
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
