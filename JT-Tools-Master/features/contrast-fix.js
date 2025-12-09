// JobTread Schedule Contrast Fix Feature Module
// Automatically adjusts text color for better readability
// Dependencies: utils/debounce.js (TimingUtils)

const ContrastFixFeature = (() => {
  let observer = null;
  let debouncedUpdate = null;
  let isActive = false;

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('ContrastFix: Already initialized');
      return;
    }

    console.log('ContrastFix: Initializing...');
    isActive = true;

    // Run initial fix
    fixAllScheduleItems();

    // Create debounced update function using TimingUtils
    debouncedUpdate = window.TimingUtils.debounce(() => {
      // Temporarily disconnect observer to prevent infinite loop
      observer.disconnect();

      fixAllScheduleItems();

      // Reconnect observer after a short delay
      setTimeout(() => {
        if (isActive) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      }, 100);
    }, 250);

    // Watch for DOM changes
    observer = new MutationObserver((mutations) => {
      const shouldUpdate = mutations.some(mutation => mutation.addedNodes.length > 0);

      if (shouldUpdate) {
        debouncedUpdate();
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('ContrastFix: Feature loaded');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('ContrastFix: Not active, nothing to cleanup');
      return;
    }

    console.log('ContrastFix: Cleaning up...');
    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Cancel debounced function
    if (debouncedUpdate) {
      debouncedUpdate.cancel();
      debouncedUpdate = null;
    }

    console.log('ContrastFix: Cleanup complete');
  }

  // Parse RGB string to values
  function parseRgb(rgbString) {
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  }

  // Calculate relative luminance (WCAG formula)
  function getLuminance(r, g, b) {
    const [rNorm, gNorm, bNorm] = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
  }

  // Calculate relative luminance and return appropriate text color
  function getContrastColor(rgbString) {
    const rgb = parseRgb(rgbString);
    if (!rgb) return null;

    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
  }

  // Check if dark mode or custom theme is active
  function isDarkOrCustomTheme() {
    return document.body.classList.contains('jt-dark-mode') ||
           document.body.classList.contains('jt-custom-theme');
  }

  // Extract border-left color from style (task type color)
  // Format: "border-left: 5px solid rgb(R, G, B)" or "border-left-color: rgb(...)"
  function extractBorderLeftColor(styleString) {
    // Try format: border-left: Xpx solid rgb(...)
    const solidMatch = styleString.match(/border-left:\s*\d+px\s+solid\s+(rgb\([^)]+\))/);
    if (solidMatch) return solidMatch[1];

    // Try format: border-left-color: rgb(...)
    const colorMatch = styleString.match(/border-left-color:\s*(rgb\([^)]+\))/);
    if (colorMatch) return colorMatch[1];

    return null;
  }

  // Fix text contrast for a single element
  // In dark mode/custom theme, also changes background to task type color
  function fixTextContrast(element) {
    const style = element.getAttribute('style');
    if (!style) return;

    // Skip tags - they should keep their original colors
    // Tags have the rounded-sm class and px-2/py-1 padding
    if (element.classList.contains('rounded-sm') &&
        (element.classList.contains('px-2') || element.classList.contains('py-1'))) {
      return;
    }

    // Check if element has both background-color and color in inline styles
    const bgColorMatch = style.match(/background-color:\s*(rgb\([^)]+\))/);
    const textColorMatch = style.match(/(?<![a-z-])color:\s*(rgb\([^)]+\))/);

    if (!bgColorMatch || !textColorMatch) return;

    const currentBgColor = bgColorMatch[1];
    let newBgColor = currentBgColor;
    let newTextColor;

    // Check if we should apply dark/custom theme styling
    if (isDarkOrCustomTheme()) {
      // Get task type color from border-left
      const taskTypeColor = extractBorderLeftColor(style);

      if (taskTypeColor) {
        // Check if this looks like an unselected task (pastel/light background)
        const bgRgb = parseRgb(currentBgColor);
        if (bgRgb) {
          const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

          // Light backgrounds (luminance > 0.6) are unselected tasks
          // Use task type color as background for better dark mode appearance
          if (bgLuminance > 0.6) {
            newBgColor = taskTypeColor;
          }
          // If background is darker but not the task type color, it might be completed
          // Keep it slightly darkened
        }
      }
    }

    // Calculate appropriate text color for the background
    newTextColor = getContrastColor(newBgColor);

    if (newTextColor) {
      // Build new style string
      let newStyle = style;

      // Update background if changed
      if (newBgColor !== currentBgColor) {
        newStyle = newStyle.replace(/background-color:\s*rgb\([^)]+\)/, `background-color: ${newBgColor}`);
      }

      // Update text color
      newStyle = newStyle.replace(/(?<![a-z-])color:\s*rgb\([^)]+\)/, `color: ${newTextColor}`);

      // Only apply if something changed
      if (newStyle !== style) {
        element.setAttribute('style', newStyle);
      }
    }
  }

  // Highlight current date with blue background
  function highlightCurrentDate() {
    // Find all date cells with the blue background (current date indicator)
    const currentDateDivs = document.querySelectorAll('div.bg-blue-500.text-white');

    currentDateDivs.forEach(dateDiv => {
      // Find the parent td cell
      let tdCell = dateDiv.closest('td');

      if (tdCell && !tdCell.classList.contains('jt-current-date-enhanced')) {
        // Add a custom class to prevent re-processing
        tdCell.classList.add('jt-current-date-enhanced');

        // Fill the entire cell background with blue
        tdCell.style.backgroundColor = 'rgb(59, 130, 246)';
      }
    });
  }

  // Process all schedule items
  function fixAllScheduleItems() {
    // Target the specific divs in schedule/calendar view that have inline background-color and color
    const scheduleItems = document.querySelectorAll('div[style*="background-color"][style*="color"]');

    scheduleItems.forEach(item => {
      // Make sure we're only targeting the calendar/schedule items (they have the cursor-pointer class)
      if (item.classList.contains('cursor-pointer')) {
        fixTextContrast(item);
      }
    });

    // Also highlight current date
    highlightCurrentDate();
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
  window.ContrastFixFeature = ContrastFixFeature;
}
