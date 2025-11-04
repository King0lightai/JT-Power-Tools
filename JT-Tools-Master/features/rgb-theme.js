// JobTread Custom Theme Feature Module
// Applies custom color theme to JobTread interface (PREMIUM FEATURE)
// Generates a complete color palette from a single base color

const CustomThemeFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let observer = null;
  let debounceTimer = null;
  let currentColors = {
    primary: '#3B82F6',
    background: '#F3E8FF',
    text: '#1F1B29'
  };

  // Initialize the feature
  function init(colors = null) {
    if (isActive) {
      console.log('CustomTheme: Already initialized');
      return;
    }

    console.log('CustomTheme: Initializing...');
    isActive = true;

    // Update colors if provided
    if (colors) {
      currentColors = { ...currentColors, ...colors };
    }

    // Inject custom theme CSS
    injectThemeCSS();

    // Apply contrast fixes to existing elements
    applyContrastFixes();

    // Start observing for new elements
    startObserver();

    console.log('CustomTheme: Custom theme applied with colors', currentColors);
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('CustomTheme: Not active, nothing to cleanup');
      return;
    }

    console.log('CustomTheme: Cleaning up...');
    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('CustomTheme: Custom theme removed');
  }

  // Update colors dynamically
  function updateColors(colors) {
    currentColors = { ...currentColors, ...colors };

    if (isActive) {
      // Re-inject CSS with new colors
      if (styleElement) {
        styleElement.remove();
      }
      injectThemeCSS();

      // Reapply contrast fixes with new colors
      applyContrastFixes();

      console.log('CustomTheme: Colors updated to', currentColors);
    }
  }

  // Get current colors
  function getColors() {
    return { ...currentColors };
  }

  // Helper function to convert hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // Helper function to convert RGB to hex
  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Calculate luminance to determine if color is light or dark
  function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0.5;

    // Normalize RGB values
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    // Calculate relative luminance
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Adjust color brightness (amount: positive to lighten, negative to darken)
  function adjustBrightness(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const adjust = (value) => {
      const newValue = value + amount;
      return Math.max(0, Math.min(255, newValue));
    };

    return rgbToHex(
      adjust(rgb.r),
      adjust(rgb.g),
      adjust(rgb.b)
    );
  }

  // Generate border color based on background luminance
  function getBorderColor(backgroundColor) {
    const luminance = getLuminance(backgroundColor);

    // If background is dark (luminance < 0.5), lighten the border
    // If background is light (luminance >= 0.5), darken the border
    if (luminance < 0.5) {
      return adjustBrightness(backgroundColor, 30); // Lighten by 30
    } else {
      return adjustBrightness(backgroundColor, -30); // Darken by 30
    }
  }

  // Inject theme CSS using user's chosen colors directly
  function injectThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    const { primary, background, text } = currentColors;

    // Generate border color that's slightly lighter/darker than background
    const borderColor = getBorderColor(background);

    // Create CSS using user's chosen colors
    const css = `
      /* === JT Power Tools - Custom Color Theme === */
      /* Using user's chosen Primary, Background, and Text colors */

      /* === Task Cards === */
      /* Use theme background for cards, keep task type color in thick border */
      td div.cursor-pointer[style*="border-left"] {
        background-color: ${background} !important;
        border-left-width: 5px !important;
        box-shadow: inset 4px 0 8px rgba(0, 0, 0, 0.1);
      }

      /* === General Styles === */
      *, ::backdrop, ::file-selector-button, :after, :before {
        border-color: ${borderColor};
      }

      .border-transparent {
        border-color: transparent !important;
      }

      /* === Formatter Toolbar Theme === */
      .jt-formatter-toolbar {
        background: ${background} !important;
        border-color: ${borderColor} !important;
      }

      .jt-formatter-toolbar button {
        background: ${background} !important;
        border: none !important;
        color: ${text} !important;
      }

      .jt-formatter-toolbar button:hover {
        background: ${background} !important;
        filter: brightness(0.95);
        border: none !important;
      }

      .jt-formatter-toolbar button:active {
        background: ${background} !important;
        filter: brightness(0.9);
      }

      /* Active buttons use primary color instead of blue */
      .jt-formatter-toolbar button.active {
        background: ${primary} !important;
        color: #ffffff !important;
        border-color: ${primary} !important;
      }

      .jt-formatter-toolbar button.active:hover {
        background: ${primary} !important;
        filter: brightness(0.9);
      }

      /* Color picker buttons - show "A" in the actual color */
      .jt-formatter-toolbar button.jt-color-green {
        color: #10b981 !important;
      }

      .jt-formatter-toolbar button.jt-color-yellow {
        color: #f59e0b !important;
      }

      .jt-formatter-toolbar button.jt-color-blue {
        color: #3b82f6 !important;
      }

      .jt-formatter-toolbar button.jt-color-red {
        color: #ef4444 !important;
      }

      .jt-formatter-toolbar button.jt-color-orange {
        color: #f97316 !important;
      }

      .jt-formatter-toolbar button.jt-color-purple {
        color: #a855f7 !important;
      }

      /* Active color buttons keep their color but with filled background */
      .jt-formatter-toolbar button.jt-color-green.active {
        background: #10b981 !important;
        color: #ffffff !important;
      }

      .jt-formatter-toolbar button.jt-color-yellow.active {
        background: #f59e0b !important;
        color: #ffffff !important;
      }

      .jt-formatter-toolbar button.jt-color-blue.active {
        background: #3b82f6 !important;
        color: #ffffff !important;
      }

      .jt-formatter-toolbar button.jt-color-red.active {
        background: #ef4444 !important;
        color: #ffffff !important;
      }

      .jt-formatter-toolbar button.jt-color-orange.active {
        background: #f97316 !important;
        color: #ffffff !important;
      }

      .jt-formatter-toolbar button.jt-color-purple.active {
        background: #a855f7 !important;
        color: #ffffff !important;
      }

      .jt-toolbar-divider {
        background: ${borderColor} !important;
      }

      .jt-dropdown-menu {
        background: ${background} !important;
        border-color: ${borderColor} !important;
      }

      .jt-dropdown-menu button {
        color: ${text} !important;
      }

      .jt-dropdown-menu button:hover {
        background: ${background} !important;
        filter: brightness(0.95);
      }

      .jt-dropdown-menu button.active {
        background: ${primary} !important;
        color: #ffffff !important;
      }

      .border-white {
        border-color: ${borderColor} !important;
      }

      /* === Gray Border Color Overrides === */
      .border-gray-100,
      .border-gray-200,
      .border-gray-300,
      .border-gray-400,
      .border-gray-500,
      .border-gray-600,
      .border-gray-700,
      .border-gray-800,
      [class*="border-gray"] {
        border-color: ${borderColor} !important;
      }

      /* === Table Border Overrides === */
      .border,
      .border-b,
      .border-t,
      .border-l,
      .border-r {
        border-color: ${borderColor} !important;
      }

      /* === Input Field Border Overrides === */
      input.border,
      input[class*="border-"],
      textarea.border,
      textarea[class*="border-"] {
        border-color: ${borderColor} !important;
      }

      input.hover\\:border-blue-500:hover,
      input.focus\\:border-blue-500:focus,
      textarea.hover\\:border-blue-500:hover,
      textarea.focus\\:border-blue-500:focus {
        border-color: ${borderColor} !important;
      }

      input.border-transparent,
      textarea.border-transparent {
        border-color: transparent !important;
      }

      /* === Divider Colors === */
      .divide-gray-500 > * + *,
      [class*="divide-gray"] > * + * {
        border-color: ${borderColor} !important;
      }

      /* === Background Colors === */
      /* Note: .bg-yellow-100 is excluded to preserve edited cell highlighting */
      .bg-white,
      .bg-gray-50,
      .bg-gray-100,
      .bg-gray-200,
      .bg-gray-700,
      .bg-slate-50,
      .bg-blue-50,
      .bg-blue-100 {
        background-color: ${background};
      }

      .focus\\:bg-white:focus,
      .focus\\:bg-gray-100:focus {
        background-color: ${background};
        filter: brightness(0.95);
      }

      /* === Hover Background States === */
      .hover\\:bg-gray-50:hover,
      .hover\\:bg-gray-100:hover,
      .hover\\:bg-gray-200:hover,
      .hover\\:bg-white:hover {
        background-color: ${background} !important;
        filter: brightness(0.95);
      }

      /* === Active Background States === */
      .active\\:bg-gray-100:active,
      .active\\:bg-gray-200:active,
      .active\\:bg-gray-300:active {
        background-color: ${background} !important;
        filter: brightness(0.9);
      }

      /* === Popups, Tooltips, and Modals === */
      [role="dialog"],
      [role="tooltip"],
      [role="menu"],
      [role="listbox"],
      .tooltip,
      .popup,
      .modal,
      .dropdown,
      div[class*="absolute"][class*="bg-"],
      div[class*="fixed"][class*="bg-"],
      div[class*="z-"][class*="bg-"] {
        background-color: ${background} !important;
        color: ${text} !important;
      }

      /* === Black/Dark Background Overrides === */
      .bg-black,
      .bg-gray-800,
      .bg-gray-900 {
        background-color: ${background} !important;
      }

      /* === Text Colors === */
      .text-gray-500,
      .text-gray-600,
      .text-gray-700,
      .text-gray-800,
      .text-gray-900,
      .text-black,
      .text-white {
        color: ${text};
      }

      .text-gray-300 {
        color: ${text};
        opacity: 0.8;
      }

      /* === Shadow Styles === */
      .shadow-line-right {
        box-shadow: 1px 0 0 ${borderColor};
      }

      .shadow-line-left {
        box-shadow: -1px 0 0 ${borderColor};
      }

      .shadow-line-bottom {
        box-shadow: 0 1px 0 ${borderColor};
      }

      .shadow-sm {
        border: solid 1px ${borderColor};
      }

      /* === Focus Styles === */
      .focus-within\\:bg-white,
      .focus-within\\:bg-blue-50:focus-within {
        background-color: ${background};
      }

      /* === Hover Styles === */
      .hover\\:bg-gray-50:hover,
      .hover\\:bg-gray-100:hover,
      .hover\\:bg-gray-200:hover,
      .hover\\:bg-gray-800:hover,
      .hover\\:bg-gray-900:hover,
      .hover\\:bg-blue-50:hover,
      .hover\\:bg-blue-100:hover {
        background-color: ${background};
        filter: brightness(0.9);
      }

      .hover\\:text-gray-800:hover,
      .hover\\:text-gray-900:hover {
        color: ${text};
      }

      /* === Active Styles === */
      .active\\:bg-gray-200:active {
        background-color: ${background};
        filter: brightness(0.85);
      }

      /* === Group Hover Styles === */
      .group-hover\\/row\\:bg-gray-50,
      .group-hover\\/row\\:bg-blue-100 {
        background-color: ${background};
      }

      .group:hover .group-hover\\:text-gray-800 {
        color: ${text};
      }

      .group:hover .group-hover\\:bg-slate-50 {
        background-color: ${background};
      }

      /* === Primary Color Overrides === */
      .bg-blue-500,
      .bg-blue-600,
      button[class*="bg-blue"] {
        background-color: ${primary} !important;
      }

      .hover\\:bg-blue-600:hover,
      .hover\\:bg-blue-700:hover {
        background-color: ${primary} !important;
        filter: brightness(0.9);
      }

      .text-blue-500,
      .text-blue-600,
      [class*="text-blue"] {
        color: ${primary} !important;
      }

      .border-blue-500,
      [class*="border-blue"] {
        border-color: ${borderColor} !important;
      }

      /* === Cyan Link Overrides === */
      .text-cyan-500,
      .text-cyan-600,
      a[class*="text-cyan"] {
        color: ${primary} !important;
      }

      .hover\\:text-cyan-600:hover,
      .focus\\:text-cyan-600:focus {
        color: ${primary} !important;
        filter: brightness(0.9);
      }

      /* === Purple Button Overrides (Send buttons, etc.) === */
      .bg-purple-700,
      .bg-purple-800,
      button[class*="bg-purple"] {
        background-color: ${primary} !important;
      }

      .hover\\:bg-purple-800:hover {
        background-color: ${primary} !important;
        filter: brightness(0.9);
      }

      .border-purple-700,
      .border-purple-800,
      [class*="border-purple"] {
        border-color: ${primary} !important;
      }

      /* === Search Bar and Gray Text Overrides === */
      .text-gray-400 {
        color: ${text} !important;
        opacity: 0.7;
      }

      .group-hover\\:text-gray-500,
      .group:hover .group-hover\\:text-gray-500 {
        color: ${text} !important;
        opacity: 0.85;
      }

      .placeholder-gray-400::placeholder,
      .group-hover\\:placeholder-gray-500:hover::placeholder {
        color: ${text} !important;
        opacity: 0.5;
      }
    `;

    styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.id = 'jt-custom-theme-styles';
    document.head.appendChild(styleElement);
  }

  // Start observing DOM changes for contrast fixes
  function startObserver() {
    observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        // Debounce to prevent excessive calls
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          // Temporarily disconnect observer to prevent infinite loop
          observer.disconnect();

          applyContrastFixes();

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
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Apply custom text color and current date highlighting
  function applyContrastFixes() {
    // Apply custom text color to schedule items
    const scheduleItems = document.querySelectorAll('div[style*="background-color"][style*="color"]');

    scheduleItems.forEach(item => {
      // Target calendar/schedule items (they have cursor-pointer class)
      if (item.classList.contains('cursor-pointer')) {
        fixTextContrast(item);
      }
    });

    // Highlight current date with primary color
    highlightCurrentDate();
  }

  // Fix text contrast for a single element using custom text color
  function fixTextContrast(element) {
    const style = element.getAttribute('style');
    if (!style) return;

    // Skip tags - they should keep their original colors
    // Tags have the rounded-sm class and px-2/py-1 padding
    if (element.classList.contains('rounded-sm') &&
        (element.classList.contains('px-2') || element.classList.contains('py-1'))) {
      return;
    }

    // Also skip draggable elements (alternative tag format)
    if (element.getAttribute('draggable') === 'true') {
      return;
    }

    // Check if element has both background-color and color in inline styles
    const bgColorMatch = style.match(/background-color:\s*rgb\([^)]+\)/);
    const textColorMatch = style.match(/color:\s*rgb\([^)]+\)/);

    if (bgColorMatch && textColorMatch) {
      // Get current computed color
      const currentColor = window.getComputedStyle(element).color;
      const customTextColor = hexToRgb(currentColors.text);
      const targetColor = `rgb(${customTextColor.r}, ${customTextColor.g}, ${customTextColor.b})`;

      // Only update if different (prevents infinite loop)
      if (currentColor !== targetColor) {
        // Override the color property with user's custom text color
        const newStyle = style.replace(/color:\s*rgb\([^)]+\)/, `color: ${targetColor}`);
        element.setAttribute('style', newStyle);
        element.style.color = targetColor;
      }
    }
  }

  // Highlight current date with primary color
  function highlightCurrentDate() {
    // Find all date cells with blue background (current date indicator)
    const currentDateDivs = document.querySelectorAll('div.bg-blue-500.text-white');

    currentDateDivs.forEach(dateDiv => {
      // Find the parent td cell
      let tdCell = dateDiv.closest('td');

      if (tdCell && !tdCell.classList.contains('jt-current-date-enhanced')) {
        // Add custom class to prevent re-processing
        tdCell.classList.add('jt-current-date-enhanced');

        // Fill entire cell background with primary color
        const primaryRgb = hexToRgb(currentColors.primary);
        tdCell.style.backgroundColor = `rgb(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b})`;
      }
    });
  }

  // Public API
  return {
    init,
    cleanup,
    updateColors,
    getColors,
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.RGBThemeFeature = CustomThemeFeature;
  window.CustomThemeFeature = CustomThemeFeature;
}
