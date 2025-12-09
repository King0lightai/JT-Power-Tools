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
    }, 150);

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

  // Get appropriate text color based on background luminance
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

  // Darken an RGB color for dark mode (reduce brightness significantly)
  function darkenColor(rgb) {
    // Reduce each channel to ~30% of original to create dark version
    return {
      r: Math.round(rgb.r * 0.3),
      g: Math.round(rgb.g * 0.3),
      b: Math.round(rgb.b * 0.3)
    };
  }

  // Fix text contrast for a single element
  // In dark mode/custom theme, also darkens bright backgrounds
  function fixTextContrast(element) {
    const style = element.getAttribute('style');
    if (!style) return;

    // Skip tags - they should keep their original colors
    if (element.classList.contains('rounded-sm') &&
        (element.classList.contains('px-2') || element.classList.contains('py-1'))) {
      return;
    }

    // Check if element has both background-color and color in inline styles
    const bgColorMatch = style.match(/background-color:\s*(rgb\([^)]+\))/);
    const textColorMatch = style.match(/(?<![a-z-])color:\s*rgb\([^)]+\)/);

    if (bgColorMatch && textColorMatch) {
      let backgroundColor = bgColorMatch[1];
      let newStyle = style;
      const bgRgb = parseRgb(backgroundColor);

      // In dark mode/custom theme, darken bright backgrounds
      if (isDarkOrCustomTheme() && bgRgb) {
        const luminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

        // If background is bright (luminance > 0.5), darken it
        if (luminance > 0.5) {
          const darkBg = darkenColor(bgRgb);
          backgroundColor = `rgb(${darkBg.r}, ${darkBg.g}, ${darkBg.b})`;
          newStyle = newStyle.replace(/background-color:\s*rgb\([^)]+\)/, `background-color: ${backgroundColor}`);
        }
      }

      const contrastColor = getContrastColor(backgroundColor);

      if (contrastColor) {
        newStyle = newStyle.replace(/(?<![a-z-])color:\s*rgb\([^)]+\)/, `color: ${contrastColor}`);

        // Only update if style actually changed
        if (newStyle !== style) {
          element.setAttribute('style', newStyle);
        }
      }
    }
  }

  // Highlight current date with blue background
  function highlightCurrentDate() {
    const currentDateDivs = document.querySelectorAll('div.bg-blue-500.text-white');

    currentDateDivs.forEach(dateDiv => {
      let tdCell = dateDiv.closest('td');

      if (tdCell && !tdCell.classList.contains('jt-current-date-enhanced')) {
        tdCell.classList.add('jt-current-date-enhanced');
        tdCell.style.backgroundColor = 'rgb(59, 130, 246)';
      }
    });
  }

  // Process all schedule items
  function fixAllScheduleItems() {
    // Target schedule items with inline background-color and color
    const scheduleItems = document.querySelectorAll('div[style*="background-color"][style*="color"]');

    scheduleItems.forEach(item => {
      // Only target calendar/schedule items (they have cursor-pointer class)
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
