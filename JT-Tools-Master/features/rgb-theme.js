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

    // Update colors if provided (with validation)
    if (colors) {
      currentColors = {
        primary: window.Sanitizer ? window.Sanitizer.sanitizeHexColor(colors.primary, currentColors.primary) : (colors.primary || currentColors.primary),
        background: window.Sanitizer ? window.Sanitizer.sanitizeHexColor(colors.background, currentColors.background) : (colors.background || currentColors.background),
        text: window.Sanitizer ? window.Sanitizer.sanitizeHexColor(colors.text, currentColors.text) : (colors.text || currentColors.text)
      };
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
    // Validate and sanitize colors before applying
    if (window.Sanitizer) {
      currentColors = {
        primary: colors.primary ? window.Sanitizer.sanitizeHexColor(colors.primary, currentColors.primary) : currentColors.primary,
        background: colors.background ? window.Sanitizer.sanitizeHexColor(colors.background, currentColors.background) : currentColors.background,
        text: colors.text ? window.Sanitizer.sanitizeHexColor(colors.text, currentColors.text) : currentColors.text
      };
    } else {
      // Fallback if Sanitizer not available
      currentColors = { ...currentColors, ...colors };
    }

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
    // Strict validation to prevent CSS injection
    if (!hex || typeof hex !== 'string') {
      console.warn('CustomTheme: Invalid hex color input:', hex);
      return null;
    }

    // Only allow valid hex color format
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
    if (!rgb) {
      // Fallback to assuming dark color if invalid
      console.warn('CustomTheme: Invalid color for luminance calculation:', hex);
      return 0;
    }

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

    // Generate lightened primary colors for selection states
    const primaryLight30 = adjustBrightness(primary, 70);  // 30% lighter -> brightness +70
    const primaryLight35 = adjustBrightness(primary, 65);  // 35% lighter -> brightness +65
    const primaryLight40 = adjustBrightness(primary, 60);  // 40% lighter -> brightness +60
    const primaryLight45 = adjustBrightness(primary, 55);  // 45% lighter -> brightness +55

    // Create CSS using user's chosen colors
    const css = `
      /* === JT Power Tools - Custom Color Theme === */
      /* Using user's chosen Primary, Background, and Text colors */

      /* === Logo Colors === */
      /* Make JOBTREAD text use primary color (keep orange text as-is) */
      .text-gray-800 {
        color: ${primary} !important;
      }

      /* === Task Cards === */
      /* Use theme background for cards, keep task type color in thick border */
      td div.cursor-pointer[style*="border-left"] {
        background-color: ${background} !important;
        color: ${text} !important;
        border-left-width: 5px !important;
        box-shadow: inset 4px 0 8px rgba(0, 0, 0, 0.1);
      }

      /* Ensure all text elements within task cards inherit the theme text color */
      td div.cursor-pointer[style*="border-left"] * {
        color: inherit !important;
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

      /* === Custom Tooltips with Primary Color === */
      .jt-custom-tooltip {
        position: absolute;
        background-color: ${primary} !important;
        color: #ffffff !important;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 1000000;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .jt-custom-tooltip.visible {
        opacity: 1;
      }

      .jt-custom-tooltip::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: ${primary};
      }

      /* === Native JobTread Tooltips with Primary Color === */
      /* Target Popper.js tooltips throughout JobTread interface */
      div[data-popper-placement].bg-black,
      div[data-popper-placement].bg-gray-800,
      div[data-popper-placement].bg-gray-900 {
        background-color: ${primary} !important;
        color: #ffffff !important;
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

      /* === Budget Table Border Normalization === */
      /* Ensure all table cells have thin borders, not thick ones */
      table input.border-blue-500,
      table textarea.border-blue-500,
      table input[class*="border-blue"],
      table textarea[class*="border-blue"],
      table input[class*="border-\\[calc"],
      table textarea[class*="border-\\[calc"] {
        border-width: 1px !important;
      }

      /* === Selected Box Border (Orange -> Primary) === */
      .border-jtOrange {
        border-color: ${primary} !important;
      }

      /* === Selected State Background (Primary Color) === */
      /* When an element has both border-jtOrange and bg-gray-100, it's selected */
      /* Give it a light version of the primary color for the background */
      .border-jtOrange.bg-gray-100 {
        background-color: ${primaryLight40} !important;
      }

      /* === Hover state for sidebar buttons === */
      .hover\\:bg-gray-100:hover {
        background-color: ${primaryLight45} !important;
      }

      .hover\\:border-gray-100:hover {
        border-color: ${primaryLight45} !important;
      }

      /* Hover state when already selected */
      .hover\\:bg-gray-100:hover.border-jtOrange {
        background-color: ${primaryLight35} !important;
      }

      .hover\\:border-gray-100:hover.border-jtOrange {
        border-color: ${primary} !important;
      }

      /* Active state for sidebar buttons */
      .active\\:bg-gray-200:active {
        background-color: ${primaryLight30} !important;
      }

      .active\\:border-gray-200:active {
        border-color: ${primaryLight30} !important;
      }

      /* === Selection Boxes and Checkboxes === */
      /* Checkbox and radio button accent colors */
      input[type="checkbox"]:checked,
      input[type="radio"]:checked {
        accent-color: ${primary} !important;
      }

      /* Selected rows in tables/lists */
      tr.selected,
      div.selected,
      [aria-selected="true"] {
        background-color: ${primaryLight45} !important;
        border-color: ${primary} !important;
      }

      /* === Per-job Tab Navigation Selected States === */
      /* Selected tab with gray-50 background */
      .border-t-2.border-jtOrange.bg-gray-50,
      .border-b-2.border-jtOrange.bg-gray-50 {
        background-color: ${primaryLight40} !important;
      }

      /* Hover states for tabs */
      .hover\\:bg-gray-50:hover {
        background-color: ${primaryLight45} !important;
      }

      .hover\\:border-gray-50:hover {
        border-color: ${primaryLight45} !important;
      }

      /* Hover state when tab is already selected */
      .hover\\:bg-gray-50:hover.border-jtOrange {
        background-color: ${primaryLight35} !important;
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

      /* === Budget Table Frozen Column Z-Index Fix === */
      /* Ensure sticky/frozen columns stay above resize handles */
      .sticky {
        z-index: 20 !important;
      }

      /* Reduce z-index of column resize handles */
      .absolute.z-10.cursor-col-resize {
        z-index: 5 !important;
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
