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

  // Calculate relative luminance and return appropriate text color
  function getContrastColor(rgbString) {
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;

    const [, r, g, b] = match.map(Number);

    // Calculate relative luminance using WCAG formula
    const [rNorm, gNorm, bNorm] = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    const luminance = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;

    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
  }

  // Fix text contrast for a single element
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
    const bgColorMatch = style.match(/background-color:\s*rgb\([^)]+\)/);
    const textColorMatch = style.match(/color:\s*rgb\([^)]+\)/);

    if (bgColorMatch && textColorMatch) {
      const backgroundColor = bgColorMatch[0].split(':')[1].trim().replace(';', '');
      const contrastColor = getContrastColor(backgroundColor);

      if (contrastColor) {
        // Get current color
        const currentColor = window.getComputedStyle(element).color;

        // Only update if the color is different (prevents infinite loop)
        if (currentColor !== contrastColor) {
          // Override the color property
          const newStyle = style.replace(/color:\s*rgb\([^)]+\)/, `color: ${contrastColor}`);
          element.setAttribute('style', newStyle);

          // Also ensure child text elements inherit this color
          element.style.color = contrastColor;
        }
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

  // Check if dark mode is currently active
  function isDarkModeActive() {
    // Check if dark mode CSS is injected
    return document.getElementById('jt-dark-mode-styles') !== null;
  }

  // Check if custom theme is currently active
  function isCustomThemeActive() {
    // Check if custom theme CSS is injected
    return document.getElementById('jt-custom-theme-styles') !== null;
  }

  // Process all schedule items
  function fixAllScheduleItems() {
    // Skip contrast fix if dark mode is active (dark mode handles colors)
    if (isDarkModeActive()) {
      console.log('ContrastFix: Dark mode active, skipping contrast adjustments');
      return;
    }

    // Skip contrast fix if custom theme is active (custom theme handles colors)
    if (isCustomThemeActive()) {
      console.log('ContrastFix: Custom theme active, skipping contrast adjustments');
      return;
    }

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
