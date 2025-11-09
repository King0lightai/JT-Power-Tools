// View Detector Module
// Detects which schedule view mode is active (normal or availability)

const ViewDetector = (() => {
  /**
   * Check if the availability view is currently active
   * @returns {boolean} True if availability view is active
   */
  function isAvailabilityView() {
    // Method 1: Check for "Availability" text in a selected/active state button
    // Look for the availability dropdown button and check if it's in an active state
    const availabilityButtons = Array.from(document.querySelectorAll('div[role="button"]'));
    const availabilityButton = availabilityButtons.find(btn => {
      const textDiv = btn.querySelector('div.grow');
      return textDiv && textDiv.textContent.trim() === 'Availability';
    });

    // Method 2: Check for unique availability view DOM structure
    // Availability view typically has a different table structure with user rows
    // Look for table headers that might contain day names (Mon, Tue, etc.) for a week view
    const weekDayHeaders = document.querySelectorAll('th');
    let hasWeekDayPattern = false;
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    if (weekDayHeaders.length > 0) {
      let consecutiveWeekDays = 0;
      weekDayHeaders.forEach(header => {
        const text = header.textContent.trim();
        if (weekDays.some(day => text.includes(day))) {
          consecutiveWeekDays++;
        }
      });
      // If we find multiple weekday headers, likely in availability view
      hasWeekDayPattern = consecutiveWeekDays >= 5;
    }

    // Method 3: Check for user list on the left (availability view specific)
    // Look for a table with user names in the first column
    const tables = document.querySelectorAll('table');
    let hasUserColumn = false;

    if (tables.length > 0) {
      // In availability view, we'd typically see user names in leftmost cells
      // This is harder to detect without knowing the exact structure
      // For now, we'll rely on other methods
    }

    const isAvailability = hasWeekDayPattern;

    console.log('ViewDetector: isAvailabilityView check:');
    console.log('  - Availability button found:', !!availabilityButton);
    console.log('  - Week day header pattern:', hasWeekDayPattern);
    console.log('  - Final result:', isAvailability);

    return isAvailability;
  }

  /**
   * Get the current view type
   * @returns {string} 'availability' or 'normal'
   */
  function getViewType() {
    return isAvailabilityView() ? 'availability' : 'normal';
  }

  /**
   * Get appropriate selectors based on current view
   * @returns {Object} Object with scheduleItems and dateCells selectors
   */
  function getSelectorsForCurrentView() {
    const viewType = getViewType();

    if (viewType === 'availability') {
      return {
        // In availability view, schedule items are still divs with background colors
        // but they may be in different cell types (td or th)
        scheduleItems: 'div.cursor-pointer[style*="background-color"], div[style*="background-color"]:not(.jt-weekend-cell)',

        // Date cells in availability view are table headers for the week columns
        // They could be th or td elements
        dateCells: 'td, th',

        viewType: 'availability'
      };
    } else {
      return {
        // Normal schedule view selectors (existing behavior)
        scheduleItems: 'div.cursor-pointer[style*="background-color"]',
        dateCells: 'td.group.text-xs',
        viewType: 'normal'
      };
    }
  }

  // Public API
  return {
    isAvailabilityView,
    getViewType,
    getSelectorsForCurrentView
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ViewDetector = ViewDetector;
}
