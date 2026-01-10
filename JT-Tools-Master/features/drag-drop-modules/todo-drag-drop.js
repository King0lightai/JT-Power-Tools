// ToDo Drag & Drop Module
// Handles drag and drop for ToDos in the month view calendar
// ToDos only have a Due date (no Start/End dates)

const ToDoDragDrop = (() => {
  /**
   * Check if the current URL indicates we're on the ToDos page
   * @returns {boolean} True if URL contains "to-dos"
   */
  function isToDosPage() {
    const url = window.location.href;
    const isToDos = url.includes('to-dos');
    console.log('ToDoDragDrop: isToDosPage check - URL:', url, 'Result:', isToDos);
    return isToDos;
  }

  /**
   * Check if a dragged element is a ToDo item
   * This can be determined by the sidebar content when opened
   * @param {HTMLElement} sidebar - The sidebar element
   * @returns {boolean} True if the sidebar shows a ToDo item
   */
  function isToDoItem(sidebar) {
    if (!sidebar) return false;

    // Look for "Due" label without Start/End labels (ToDo-specific pattern)
    const allLabels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const labelTexts = allLabels.map(l => l.textContent.trim());

    // ToDos have "Due" but typically don't have "Start" or "End"
    const hasDue = labelTexts.includes('Due');
    const hasStart = labelTexts.includes('Start');
    const hasEnd = labelTexts.includes('End');

    // If we have Due but not Start AND not End, this is likely a ToDo
    // (Some task types may have Due + Start/End, but pure ToDos only have Due)
    const isToDo = hasDue && !hasStart && !hasEnd;

    console.log('ToDoDragDrop: isToDoItem check - Labels:', labelTexts);
    console.log('ToDoDragDrop: hasDue:', hasDue, 'hasStart:', hasStart, 'hasEnd:', hasEnd);
    console.log('ToDoDragDrop: isToDo:', isToDo);

    return isToDo;
  }

  /**
   * Determine if we should use ToDo mode for a date change
   * Combines URL check and sidebar check
   * @param {HTMLElement} sidebar - The sidebar element (optional, for verification)
   * @returns {boolean} True if we should use ToDo mode
   */
  function shouldUseToDoDragDrop(sidebar = null) {
    // Primary check: URL contains "to-dos"
    if (isToDosPage()) {
      console.log('ToDoDragDrop: Using ToDo mode (URL-based detection)');
      return true;
    }

    // Secondary check: Verify by sidebar content if provided
    if (sidebar && isToDoItem(sidebar)) {
      console.log('ToDoDragDrop: Using ToDo mode (sidebar-based detection)');
      return true;
    }

    return false;
  }

  /**
   * Get the field type to use based on current context
   * For ToDos, always returns 'Due'
   * For other items, returns 'Start' or 'End' based on Alt key
   * @param {boolean} altKeyPressed - Whether Alt key was pressed (for End date)
   * @param {HTMLElement} sidebar - The sidebar element (optional)
   * @returns {string} The field type: 'Due', 'Start', or 'End'
   */
  function getFieldTypeForContext(altKeyPressed = false, sidebar = null) {
    if (shouldUseToDoDragDrop(sidebar)) {
      // ToDos only have Due date - Alt key doesn't change this
      console.log('ToDoDragDrop: ToDo detected, using "Due" field');
      return 'Due';
    }

    // Default behavior for non-ToDo items
    const fieldType = altKeyPressed ? 'End' : 'Start';
    console.log('ToDoDragDrop: Non-ToDo item, using "' + fieldType + '" field');
    return fieldType;
  }

  /**
   * Find the Due date field in the ToDo sidebar
   * @param {HTMLElement} sidebar - The sidebar element
   * @param {Object} sourceDateInfo - The source date info for year inference
   * @returns {Object} {dueDateParent, sidebarSourceYear, sidebarSourceMonth, fieldTexts}
   */
  function findDueDateField(sidebar, sourceDateInfo) {
    console.log('ToDoDragDrop: findDueDateField - Looking for "Due" date field');

    // Find the label "Due"
    const allLabels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const dueLabel = allLabels.find(span => span.textContent.trim() === 'Due');

    if (!dueLabel) {
      console.error('ToDoDragDrop: Could not find "Due" label in sidebar');
      console.log('ToDoDragDrop: Available labels:', allLabels.map(l => l.textContent.trim()));
      return { dueDateParent: null, sidebarSourceYear: null, sidebarSourceMonth: null, fieldTexts: [] };
    }

    console.log('ToDoDragDrop: ✓ Found "Due" label');

    // Find the container for the Due label
    // The structure is: div.flex-1 > div.flex > span.font-bold "Due"
    // And the date field is in div.block.relative within the same flex-1 container
    const labelContainer = dueLabel.closest('div.flex-1');
    if (!labelContainer) {
      console.error('ToDoDragDrop: Could not find container for "Due" label');
      return { dueDateParent: null, sidebarSourceYear: null, sidebarSourceMonth: null, fieldTexts: [] };
    }

    // Find date fields within this container
    const allDateFields = labelContainer.querySelectorAll('div.text-gray-700.truncate.leading-tight');
    console.log('ToDoDragDrop: Found', allDateFields.length, 'potential date fields in "Due" section');

    let dueDateParent = null;
    let sidebarSourceYear = null;
    let sidebarSourceMonth = null;
    const fieldTexts = [];

    for (const field of allDateFields) {
      const text = field.textContent.trim();
      fieldTexts.push(text);
      console.log('ToDoDragDrop: Checking field text:', text);

      // Match date formats:
      // 1. "Jan 1, 2026" (Month Day, Year)
      // 2. "Wed, Dec 31" (DayOfWeek, Month Day)
      // 3. "Today", "Tomorrow", "Yesterday"
      if (/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(text)) {
        // Extract year and month from "Jan 1, 2026" format
        const match = text.match(/^([A-Z][a-z]{2})\s+\d{1,2},\s+(20\d{2})$/);
        if (match) {
          sidebarSourceMonth = match[1];
          sidebarSourceYear = parseInt(match[2]);
          console.log('ToDoDragDrop: Extracted from sidebar:', sidebarSourceMonth, sidebarSourceYear);
        }
        dueDateParent = field.closest('div.group.items-center');
        console.log('ToDoDragDrop: Found Due date field:', text);
        break;
      } else if (/^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(text)) {
        // "Wed, Dec 31" format - extract month, infer year
        const match = text.match(/^[A-Z][a-z]{2},\s+([A-Z][a-z]{2,})\s+\d{1,2}$/);
        if (match) {
          const fullOrShortMonth = match[1];
          const monthNameMap = {
            'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
            'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
            'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
          };
          sidebarSourceMonth = monthNameMap[fullOrShortMonth] || fullOrShortMonth;

          // Infer year from drag source with year boundary logic
          if (sourceDateInfo && sourceDateInfo.year && sourceDateInfo.month && window.DateUtils) {
            const monthIndexMap = window.DateUtils.MONTH_MAP;
            const sidebarMonthIndex = monthIndexMap[sidebarSourceMonth];
            const sourceCalendarMonthIndex = monthIndexMap[sourceDateInfo.month];

            console.log('ToDoDragDrop: Sidebar month:', sidebarSourceMonth, '(' + sidebarMonthIndex + ')');
            console.log('ToDoDragDrop: Source calendar month:', sourceDateInfo.month, '(' + sourceCalendarMonthIndex + ')');

            // Apply year boundary logic
            if (sidebarMonthIndex === 11 && sourceCalendarMonthIndex === 0) {
              sidebarSourceYear = sourceDateInfo.year - 1;
              console.log('ToDoDragDrop: Dec→Jan boundary, using previous year:', sidebarSourceYear);
            } else if (sidebarMonthIndex === 0 && sourceCalendarMonthIndex === 11) {
              sidebarSourceYear = sourceDateInfo.year + 1;
              console.log('ToDoDragDrop: Jan→Dec boundary, using next year:', sidebarSourceYear);
            } else {
              sidebarSourceYear = sourceDateInfo.year;
              console.log('ToDoDragDrop: Using source year:', sidebarSourceYear);
            }
          } else {
            sidebarSourceYear = new Date().getFullYear();
            console.log('ToDoDragDrop: No source year available, using current year:', sidebarSourceYear);
          }
        }
        dueDateParent = field.closest('div.group.items-center');
        console.log('ToDoDragDrop: Found Due date field:', text);
        break;
      } else if (/^(Today|Tomorrow|Yesterday)$/.test(text)) {
        dueDateParent = field.closest('div.group.items-center');
        console.log('ToDoDragDrop: Found Due date field:', text);
        break;
      }
    }

    return {
      dueDateParent,
      sidebarSourceYear,
      sidebarSourceMonth,
      fieldTexts
    };
  }

  // Public API
  return {
    isToDosPage,
    isToDoItem,
    shouldUseToDoDragDrop,
    getFieldTypeForContext,
    findDueDateField
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ToDoDragDrop = ToDoDragDrop;
}
