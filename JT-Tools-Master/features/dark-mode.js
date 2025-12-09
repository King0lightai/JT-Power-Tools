// JobTread Dark Mode Feature Module
// Applies dark theme to JobTread interface
// Dependencies: utils/color-utils.js (ColorUtils), utils/debounce.js (TimingUtils)

const DarkModeFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let observer = null;
  let debouncedStyleUpdate = null;

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('DarkMode: Already initialized');
      return;
    }

    console.log('DarkMode: Initializing...');
    isActive = true;

    // Add dark mode class to body for other features to detect
    document.body.classList.add('jt-dark-mode');

    // Inject dark mode CSS
    injectDarkModeCSS();

    // Apply schedule card styling
    applyScheduleCardStyles();

    // Start observing for new elements
    startObserver();

    console.log('DarkMode: Dark theme applied');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('DarkMode: Not active, nothing to cleanup');
      return;
    }

    console.log('DarkMode: Cleaning up...');
    isActive = false;

    // Remove dark mode class from body
    document.body.classList.remove('jt-dark-mode');

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Cancel debounced function
    if (debouncedStyleUpdate) {
      debouncedStyleUpdate.cancel();
      debouncedStyleUpdate = null;
    }

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('DarkMode: Dark theme removed');
  }

  // Inject dark mode CSS
  function injectDarkModeCSS() {
    if (styleElement) return;

    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = chrome.runtime.getURL('styles/dark-mode.css');
    styleElement.id = 'jt-dark-mode-styles';
    document.head.appendChild(styleElement);
  }

  // Start observing DOM changes for schedule cards
  function startObserver() {
    // Create debounced style update function using TimingUtils
    debouncedStyleUpdate = window.TimingUtils.debounce(() => {
      // Temporarily disconnect observer to prevent infinite loop
      observer.disconnect();

      applyScheduleCardStyles();

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

    observer = new MutationObserver((mutations) => {
      const shouldUpdate = mutations.some(mutation => mutation.addedNodes.length > 0);

      if (shouldUpdate) {
        debouncedStyleUpdate();
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Apply dark mode styling to schedule cards
  // Sets background to task type color (from border-left) with contrast text
  function applyScheduleCardStyles() {
    // Target schedule cards - they have cursor-pointer class and border-left style
    const scheduleCards = document.querySelectorAll('td div.cursor-pointer[style*="border-left"]');

    scheduleCards.forEach(card => {
      styleScheduleCard(card);
    });
  }

  // Style a single schedule card
  function styleScheduleCard(element) {
    const style = element.getAttribute('style');
    if (!style) return;

    // Skip tags - they should keep their original colors
    if (element.classList.contains('rounded-sm') &&
        (element.classList.contains('px-2') || element.classList.contains('py-1'))) {
      return;
    }

    // Skip if already processed
    if (element.dataset.jtDarkModeStyled === 'true') {
      return;
    }

    // Check if this is a selected task (has ring/outline classes indicating selection)
    const isSelected = element.classList.contains('ring-2') ||
                       element.classList.contains('outline') ||
                       element.closest('[class*="ring-"]');

    // For selected tasks, don't override - let the selection highlight show
    if (isSelected) {
      return;
    }

    // Extract border-left color (task type color)
    const borderLeftMatch = style.match(/border-left(?:-color)?:\s*(rgb\([^)]+\)|#[a-fA-F0-9]+)/);
    if (!borderLeftMatch) return;

    let taskTypeColor = borderLeftMatch[1];

    // Convert rgb to hex if needed for ColorUtils
    if (taskTypeColor.startsWith('rgb')) {
      const rgbMatch = taskTypeColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        taskTypeColor = window.ColorUtils.rgbToHex(r, g, b);
      }
    }

    // Get contrast text color (white or black)
    const contrastText = window.ColorUtils.getContrastText(taskTypeColor);

    // Check if task is completed (has darkened/muted appearance)
    const bgColorMatch = style.match(/background-color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    let backgroundColor = taskTypeColor;

    if (bgColorMatch) {
      const currentR = parseInt(bgColorMatch[1]);
      const currentG = parseInt(bgColorMatch[2]);
      const currentB = parseInt(bgColorMatch[3]);
      const currentHex = window.ColorUtils.rgbToHex(currentR, currentG, currentB);
      const currentLuminance = window.ColorUtils.getLuminance(currentHex);

      // If current background is very light (pastel), it's an unselected/active task
      // If it's darker than the task type color, it might be completed
      const taskTypeLuminance = window.ColorUtils.getLuminance(taskTypeColor);

      if (currentLuminance < taskTypeLuminance * 0.7) {
        // Task appears completed/darkened - darken the task type color
        backgroundColor = window.ColorUtils.adjustLightness(taskTypeColor, -20);
      }
    }

    // Apply the new background and text colors
    const bgRgb = window.ColorUtils.hexToRgb(backgroundColor);
    const textRgb = window.ColorUtils.hexToRgb(contrastText);

    if (bgRgb && textRgb) {
      // Update inline style - replace background-color and color
      let newStyle = style;
      newStyle = newStyle.replace(/background-color:\s*rgb\([^)]+\)/, `background-color: rgb(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b})`);
      newStyle = newStyle.replace(/(?<![a-z-])color:\s*rgb\([^)]+\)/, `color: rgb(${textRgb.r}, ${textRgb.g}, ${textRgb.b})`);

      element.setAttribute('style', newStyle);

      // Mark as processed to avoid re-processing
      element.dataset.jtDarkModeStyled = 'true';
    }
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
  window.DarkModeFeature = DarkModeFeature;
}
