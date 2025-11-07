// Sidebar Manager Module
// Handles sidebar visibility, opening, closing, and finding date fields

const SidebarManager = (() => {
  /**
   * Inject CSS to hide the sidebar during date change operations
   * @returns {HTMLElement} The style element that was injected
   */
  function injectHideSidebarCSS() {
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
    console.log('SidebarManager: Sidebar hiding CSS injected');
    return hideStyle;
  }

  /**
   * Remove the sidebar hiding CSS
   */
  function removeSidebarCSS() {
    const style = document.getElementById('jt-hide-sidebar-temp');
    if (style) {
      style.remove();
      console.log('SidebarManager: Removed hiding CSS');
    }
  }

  /**
   * Open the sidebar by clicking on an element
   * @param {HTMLElement} element - The element to click
   */
  function openSidebar(element) {
    console.log('SidebarManager: Clicking element to open sidebar');
    element.click();
  }

  /**
   * Close any currently open sidebar (without callbacks)
   * This is called before opening a new sidebar to prevent conflicts
   */
  function closeAnySidebar() {
    console.log('SidebarManager: Checking for any open sidebars to close...');

    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

    if (sidebar) {
      console.log('SidebarManager: Found open sidebar, closing it...');
      const closeButtons = sidebar.querySelectorAll('div[role="button"]');

      for (const button of closeButtons) {
        const text = button.textContent.trim();
        if (text.includes('Close')) {
          console.log('SidebarManager: Clicking Close button on existing sidebar');
          button.click();
          return true;
        }
      }

      console.log('SidebarManager: Could not find Close button, sidebar may remain open');
      return false;
    }

    console.log('SidebarManager: No open sidebar found');
    return false;
  }

  /**
   * Close the sidebar and cleanup hiding CSS
   * @param {number} failsafeTimeout - The timeout ID to clear
   * @param {Function} onDateChangeComplete - Callback when date change is complete
   */
  function closeSidebar(failsafeTimeout, onDateChangeComplete) {
    console.log('SidebarManager: Attempting to close sidebar...');

    // Notify that date change is complete
    if (onDateChangeComplete) {
      onDateChangeComplete();
    }

    // Clear the failsafe timeout since we're handling cleanup now
    if (failsafeTimeout) {
      clearTimeout(failsafeTimeout);
      console.log('SidebarManager: Cleared failsafe timeout');
    }

    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

    if (sidebar) {
      // Find and click Close button (clicking day in calendar already saved the change)
      const closeButtons = sidebar.querySelectorAll('div[role="button"]');

      for (const button of closeButtons) {
        const text = button.textContent.trim();
        if (text.includes('Close')) {
          console.log('SidebarManager: Found and clicking Close button');
          button.click();

          // Wait for sidebar to close BEFORE removing hiding CSS
          setTimeout(() => {
            removeSidebarCSS();
          }, 800);

          return;
        }
      }

      console.log('SidebarManager: Could not find Close button, sidebar will remain open');
      // Still remove CSS even if close failed
      setTimeout(() => {
        removeSidebarCSS();
      }, 800);
    } else {
      console.log('SidebarManager: Sidebar not found during close');
      // Remove CSS anyway
      removeSidebarCSS();
    }
  }

  /**
   * Find the date field in the sidebar (Start or End)
   * @param {HTMLElement} sidebar - The sidebar element
   * @param {Object} sourceDateInfo - The source date info for year inference
   * @param {string} fieldType - "Start" or "End" - which date field to find
   * @returns {Object} {startDateParent, sidebarSourceYear, sidebarSourceMonth, fieldTexts}
   */
  function findDateField(sidebar, sourceDateInfo, fieldType = 'Start') {
    console.log(`SidebarManager: findDateField - Looking for "${fieldType}" date field`);

    // Find the label (Start or End)
    const allLabels = Array.from(sidebar.querySelectorAll('span.font-bold'));
    const targetLabel = allLabels.find(span => span.textContent.trim() === fieldType);

    if (!targetLabel) {
      console.error(`SidebarManager: Could not find "${fieldType}" label in sidebar`);
      console.log('SidebarManager: Available labels:', allLabels.map(l => l.textContent.trim()));
      return { startDateParent: null, sidebarSourceYear: null, sidebarSourceMonth: null, fieldTexts: [] };
    }

    console.log(`SidebarManager: ✓ Found "${fieldType}" label`);

    // Find the container for this label (it's in a div.flex-1)
    const labelContainer = targetLabel.closest('div.flex-1');
    if (!labelContainer) {
      console.error(`SidebarManager: Could not find container for "${fieldType}" label`);
      return { startDateParent: null, sidebarSourceYear: null, sidebarSourceMonth: null, fieldTexts: [] };
    }

    // Find date fields within this container only
    const allDateFields = labelContainer.querySelectorAll('div.text-gray-700.truncate.leading-tight');
    console.log(`SidebarManager: findDateField - Found ${allDateFields.length} potential date fields in "${fieldType}" section`);

    let startDateParent = null;
    let sidebarSourceYear = null;
    let sidebarSourceMonth = null;
    const fieldTexts = [];

    for (const field of allDateFields) {
      const text = field.textContent.trim();
      fieldTexts.push(text);
      console.log(`SidebarManager: findDateField - Checking field text: "${text}"`);

      // Match formats:
      // 1. "Jan 1, 2026" (Month Day, Year)
      // 2. "Wed, Dec 31" (DayOfWeek, Month Day) - NEW format without year
      // 3. "Mon, January 15" (DayOfWeek, FullMonth Day) - legacy format
      // 4. "Today", "Tomorrow", "Yesterday"
      if (/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(text)) {
        // Extract year and month from "Jan 1, 2026" format
        const match = text.match(/^([A-Z][a-z]{2})\s+\d{1,2},\s+(20\d{2})$/);
        if (match) {
          sidebarSourceMonth = match[1];
          sidebarSourceYear = parseInt(match[2]);
          console.log(`SidebarManager: findDateField - Extracted from sidebar: ${sidebarSourceMonth} ${sidebarSourceYear}`);
        }
        startDateParent = field.closest('div.group.items-center');
        console.log('SidebarManager: findDateField - Found start date field:', text);
        break;
      } else if (/^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(text)) {
        // "Wed, Dec 31" or "Mon, January 15" format - extract month, get year from drag source
        const match = text.match(/^[A-Z][a-z]{2},\s+([A-Z][a-z]{2,})\s+\d{1,2}$/);
        if (match) {
          const fullOrShortMonth = match[1];
          // Convert full month names to 3-letter abbreviations
          const monthNameMap = {
            'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
            'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
            'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
          };
          sidebarSourceMonth = monthNameMap[fullOrShortMonth] || fullOrShortMonth;

          // CRITICAL: Infer year intelligently based on sidebar month vs source calendar month
          if (sourceDateInfo && sourceDateInfo.year && sourceDateInfo.month && window.DateUtils) {
            const monthIndexMap = window.DateUtils.MONTH_MAP;
            const sidebarMonthIndex = monthIndexMap[sidebarSourceMonth];
            const sourceCalendarMonthIndex = monthIndexMap[sourceDateInfo.month];

            console.log(`SidebarManager: findDateField - Sidebar month: ${sidebarSourceMonth} (${sidebarMonthIndex}), Source calendar month: ${sourceDateInfo.month} (${sourceCalendarMonthIndex}), Source year: ${sourceDateInfo.year}`);

            // If sidebar shows Dec (11) and source calendar shows Jan (0), sidebar is from previous year
            if (sidebarMonthIndex === 11 && sourceCalendarMonthIndex === 0) {
              sidebarSourceYear = sourceDateInfo.year - 1;
              console.log(`SidebarManager: findDateField - Dec→Jan year boundary detected, using previous year: ${sidebarSourceYear}`);
            }
            // If sidebar shows Jan (0) and source calendar shows Dec (11), sidebar is from next year
            else if (sidebarMonthIndex === 0 && sourceCalendarMonthIndex === 11) {
              sidebarSourceYear = sourceDateInfo.year + 1;
              console.log(`SidebarManager: findDateField - Jan→Dec year boundary detected, using next year: ${sidebarSourceYear}`);
            }
            // Otherwise, use source year
            else {
              sidebarSourceYear = sourceDateInfo.year;
              console.log(`SidebarManager: findDateField - Using year from drag source: ${sidebarSourceYear}`);
            }
          } else {
            // Fallback: use current year
            sidebarSourceYear = new Date().getFullYear();
            console.log(`SidebarManager: findDateField - No drag source year, using current year: ${sidebarSourceYear}`);
          }

          console.log(`SidebarManager: findDateField - Final extracted: ${sidebarSourceMonth} ${sidebarSourceYear}`);
        }
        startDateParent = field.closest('div.group.items-center');
        console.log('SidebarManager: findDateField - Found start date field:', text);
        break;
      } else if (/^(Today|Tomorrow|Yesterday)$/.test(text)) {
        startDateParent = field.closest('div.group.items-center');
        console.log('SidebarManager: findDateField - Found start date field:', text);
        break;
      }
    }

    return {
      startDateParent,
      sidebarSourceYear,
      sidebarSourceMonth,
      fieldTexts
    };
  }

  /**
   * Find date input field in sidebar or date picker popup
   * @param {HTMLElement} sidebar - The sidebar element
   * @returns {HTMLElement|null} The input field or null
   */
  function findInputField(sidebar) {
    let inputField = null;
    const sidebarInputs = sidebar.querySelectorAll('input[type="text"], input:not([type])');
    console.log(`SidebarManager: findInputField - Found ${sidebarInputs.length} potential input fields in sidebar`);

    for (const input of sidebarInputs) {
      const placeholder = input.placeholder || '';
      const style = window.getComputedStyle(input);

      console.log(`SidebarManager: findInputField - Checking input with placeholder: "${placeholder}", display: ${style.display}, opacity: ${style.opacity}`);

      // We're looking for any input that looks like a date field
      if (placeholder && (
          /^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(placeholder) ||  // "Mon, January 15"
          /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(placeholder) ||           // "Jan 1, 2026"
          /^[A-Z][a-z]{2}\s+\d{1,2}$/.test(placeholder)                       // "Jan 1"
      )) {
        if (style.display !== 'none' && style.opacity !== '0') {
          inputField = input;
          console.log('SidebarManager: findInputField - Found suitable date input field');
          break;
        }
      }
    }

    if (!inputField) {
      console.log('SidebarManager: findInputField - No input in sidebar, checking for popup date picker input');
      const datePickerPopup = document.querySelector('div.block.relative input[placeholder]');
      if (datePickerPopup) {
        inputField = datePickerPopup;
        console.log('SidebarManager: findInputField - Found date picker popup input');
      }
    }

    return inputField;
  }

  /**
   * Check and toggle checkboxes related to date updates (notify, linked items, etc.)
   * @param {HTMLElement} sidebar - The sidebar element
   */
  function checkUpdateCheckboxes(sidebar) {
    const checkboxes = sidebar.querySelectorAll('input[type="checkbox"]');
    console.log('SidebarManager: Found', checkboxes.length, 'checkboxes in sidebar');

    checkboxes.forEach((checkbox, index) => {
      // Look for labels or nearby text to identify the checkbox
      const label = checkbox.closest('label') || checkbox.parentElement;
      const labelText = label ? label.textContent.toLowerCase() : '';

      console.log(`SidebarManager: Checkbox ${index}: "${labelText.substring(0, 50)}", checked=${checkbox.checked}`);

      // Check for keywords that suggest this checkbox should be checked
      const shouldCheck = labelText.includes('notify') ||
                         labelText.includes('linked') ||
                         labelText.includes('dependent') ||
                         labelText.includes('update') ||
                         labelText.includes('push') ||
                         labelText.includes('move');

      if (shouldCheck && !checkbox.checked) {
        console.log('SidebarManager: Checking checkbox:', labelText.substring(0, 50));
        checkbox.click();
      }
    });
  }

  // Public API
  return {
    injectHideSidebarCSS,
    removeSidebarCSS,
    openSidebar,
    closeAnySidebar,
    closeSidebar,
    findDateField,
    findInputField,
    checkUpdateCheckboxes
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SidebarManager = SidebarManager;
}
