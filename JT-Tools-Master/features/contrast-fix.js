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
      fixAllScheduleItems();
    }, 100);

    // Watch for DOM changes - both new nodes AND style attribute changes
    observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldUpdate = true;
          break;
        }
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          // Check if this is a schedule item that JobTread modified (not us)
          const target = mutation.target;
          if (target.classList && target.classList.contains('cursor-pointer')) {
            // Check if the background changed from what we set
            const expectedBg = target.dataset.jtExpectedBg;
            if (expectedBg) {
              const currentStyle = target.getAttribute('style') || '';
              const bgMatch = currentStyle.match(/background-color:\s*(rgb\([^)]+\))/);
              const currentBg = bgMatch ? bgMatch[1] : null;
              // If background changed from what we set, JobTread updated it
              if (currentBg && currentBg !== expectedBg) {
                shouldUpdate = true;
                break;
              }
            } else {
              // No expected bg tracked, needs processing
              shouldUpdate = true;
              break;
            }
          }
        }
      }

      if (shouldUpdate) {
        debouncedUpdate();
      }
    });

    // Start observing - watch for both added nodes and style changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
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

  // Check if a background color is "light" (unselected task state)
  // Light backgrounds have high luminance (pastel colors like rgb(230, 244, 247))
  // Selected tasks have saturated/darker backgrounds matching their task type color
  function isLightBackground(rgbString) {
    const rgb = parseRgb(rgbString);
    if (!rgb) return false;

    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

    // Luminance > 0.7 indicates a light/pastel background (unselected state)
    // Selected tasks typically have luminance < 0.5
    return luminance > 0.7;
  }

  // Get the appropriate background color for unselected tasks based on theme
  function getThemeBackgroundColor() {
    if (isCustomThemeActive()) {
      // Try to get the custom theme's elevated background color from CSS variable
      const elevated = getComputedStyle(document.documentElement).getPropertyValue('--jt-theme-background-elevated').trim();
      if (elevated) {
        // Convert hex to rgb if needed
        if (elevated.startsWith('#')) {
          const r = parseInt(elevated.slice(1, 3), 16);
          const g = parseInt(elevated.slice(3, 5), 16);
          const b = parseInt(elevated.slice(5, 7), 16);
          return `rgb(${r}, ${g}, ${b})`;
        }
        return elevated;
      }
    }
    // Default dark mode background
    return 'rgb(58, 58, 58)'; // #3a3a3a
  }

  // Fix text contrast for a single element
  // In dark mode/custom theme, also handles background color for unselected tasks
  function fixTextContrast(element, isDarkOrCustomTheme = false) {
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
    const textColorMatch = style.match(/color:\s*rgb\([^)]+\)/);

    if (bgColorMatch && textColorMatch) {
      const backgroundColor = bgColorMatch[1];
      let newStyle = style;
      let newBgColor = backgroundColor;
      let needsUpdate = false;

      // Clear expected background if it doesn't match current (JobTread changed it)
      const expectedBg = element.dataset.jtExpectedBg;
      if (expectedBg && expectedBg !== backgroundColor) {
        delete element.dataset.jtExpectedBg;
      }

      // In dark mode/custom theme, handle background colors intelligently
      if (isDarkOrCustomTheme) {
        if (isLightBackground(backgroundColor)) {
          // Light background = unselected task, override to theme background
          newBgColor = getThemeBackgroundColor();
          newStyle = newStyle.replace(/background-color:\s*rgb\([^)]+\)/, `background-color: ${newBgColor}`);
          needsUpdate = true;
        }
        // If NOT light background = selected task, preserve the original colored background
      }

      // Calculate contrast color based on the (potentially modified) background
      const contrastColor = getContrastColor(newBgColor);

      if (contrastColor) {
        const currentColor = window.getComputedStyle(element).color;

        // Update if color is different or background was changed
        if (currentColor !== contrastColor || needsUpdate) {
          newStyle = newStyle.replace(/color:\s*rgb\([^)]+\)/, `color: ${contrastColor}`);
          element.setAttribute('style', newStyle);
          element.style.color = contrastColor;
          // Track the expected background so we can detect when JobTread changes it
          element.dataset.jtExpectedBg = newBgColor;
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
    // Check if dark mode or custom theme is active
    const isDarkOrCustomTheme = isDarkModeActive() || isCustomThemeActive();

    // Target the specific divs in schedule/calendar view that have inline background-color and color
    const scheduleItems = document.querySelectorAll('div[style*="background-color"][style*="color"]');

    scheduleItems.forEach(item => {
      // Make sure we're only targeting the calendar/schedule items (they have the cursor-pointer class)
      if (item.classList.contains('cursor-pointer')) {
        fixTextContrast(item, isDarkOrCustomTheme);
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
