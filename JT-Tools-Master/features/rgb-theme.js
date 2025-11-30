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

    // Add custom theme class to body for other features to detect
    document.body.classList.add('jt-custom-theme');

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

    // Remove custom theme class from body
    document.body.classList.remove('jt-custom-theme');

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

  // Get appropriate text color (white or black) based on background luminance
  // Uses WCAG 2.0 contrast calculation - same as contrast-fix feature
  function getTextColor(backgroundColor) {
    const luminance = getLuminance(backgroundColor);
    // Use black text for light backgrounds (luminance > 0.5), white for dark backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
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

    // Generate subtle selection colors using rgba with low opacity for a faded effect
    const hexToRgba = (hex, alpha) => {
      const rgb = hexToRgb(hex);
      return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : hex;
    };
    const primaryFaded15 = hexToRgba(primary, 0.15);  // 15% opacity for subtle highlight
    const primaryFaded20 = hexToRgba(primary, 0.20);  // 20% opacity for hover state

    // Blend primary color with background for solid sticky column colors (prevent see-through)
    const blendColors = (foregroundHex, backgroundHex, alpha) => {
      const fg = hexToRgb(foregroundHex);
      const bg = hexToRgb(backgroundHex);
      if (!fg || !bg) return backgroundHex;

      const r = Math.round(bg.r * (1 - alpha) + fg.r * alpha);
      const g = Math.round(bg.g * (1 - alpha) + fg.g * alpha);
      const b = Math.round(bg.b * (1 - alpha) + fg.b * alpha);

      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };
    const primaryBlended15 = blendColors(primary, background, 0.15);  // Solid blend for sticky columns

    // Subtle background shades for visual hierarchy
    const backgroundSubtle = adjustBrightness(background, -5);   // 5% darker for bg-gray-50
    const backgroundMuted = adjustBrightness(background, -10);   // 10% darker for bg-gray-100
    const backgroundDark = adjustBrightness(background, -15);    // 15% darker for tooltips

    // Get appropriate text color for primary background (auto white/black based on luminance)
    // Uses WCAG 2.0 luminance calculation: luminance > 0.5 = black text, otherwise white text
    const primaryText = getTextColor(primary);

    // Get appropriate text colors for standard color picker colors
    // These ensure formatter toolbar color buttons have readable text on their background colors
    const greenText = getTextColor('#10b981');   // green-500
    const yellowText = getTextColor('#f59e0b');  // yellow-500
    const blueText = getTextColor('#3b82f6');    // blue-500
    const redText = getTextColor('#ef4444');     // red-500
    const orangeText = getTextColor('#f97316');  // orange-500
    const purpleText = getTextColor('#a855f7');  // purple-500

    // Create CSS using user's chosen colors
    const css = `
      /* === JT Power Tools - Custom Color Theme === */
      /* Using user's chosen Primary, Background, and Text colors */

      /* === CSS Custom Properties for other features === */
      :root {
        --jt-theme-primary: ${primary};
        --jt-theme-background: ${background};
        --jt-theme-text: ${text};
        --jt-theme-border: ${borderColor};
      }

      /* === Custom Scrollbar Styling === */
      /* WebKit browsers (Chrome, Safari, Edge) */
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      ::-webkit-scrollbar-track {
        background: ${background};
        border-radius: 5px;
      }

      ::-webkit-scrollbar-thumb {
        background: ${borderColor};
        border-radius: 5px;
        border: 2px solid ${background};
      }

      ::-webkit-scrollbar-thumb:hover {
        background: ${primary};
      }

      ::-webkit-scrollbar-corner {
        background: ${background};
      }

      /* Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: ${borderColor} ${background};
      }

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
        color: ${primaryText} !important;
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
        color: ${greenText} !important;
      }

      .jt-formatter-toolbar button.jt-color-yellow.active {
        background: #f59e0b !important;
        color: ${yellowText} !important;
      }

      .jt-formatter-toolbar button.jt-color-blue.active {
        background: #3b82f6 !important;
        color: ${blueText} !important;
      }

      .jt-formatter-toolbar button.jt-color-red.active {
        background: #ef4444 !important;
        color: ${redText} !important;
      }

      .jt-formatter-toolbar button.jt-color-orange.active {
        background: #f97316 !important;
        color: ${orangeText} !important;
      }

      .jt-formatter-toolbar button.jt-color-purple.active {
        background: #a855f7 !important;
        color: ${purpleText} !important;
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

      input.border-transparent,
      textarea.border-transparent {
        border-color: transparent !important;
      }

      /* === Background Colors === */
      /* Note: .bg-yellow-100 is excluded to preserve edited cell highlighting */
      /* Note: .bg-blue-50 and .bg-blue-100 are excluded - they're used for selection highlighting */
      .bg-white,
      .bg-slate-50 {
        background-color: ${background};
      }

      /* Subtle shade for slight contrast (hover states, badges) */
      .bg-gray-50 {
        background-color: ${backgroundSubtle} !important;
      }

      /* Muted shade for page backgrounds (messages, lists) */
      .bg-gray-100,
      .bg-gray-200 {
        background-color: ${backgroundMuted} !important;
      }

      /* Dark backgrounds get the darkest shade */
      .bg-gray-700 {
        background-color: ${backgroundDark} !important;
      }

      /* === Budget Row Selection Highlighting === */
      /* When budget rows are selected, they get bg-blue-50 or bg-blue-100 classes */
      /* Use same subtle color for consistent highlighting across all selected cells */
      .bg-blue-50,
      .bg-blue-100 {
        background-color: ${primaryFaded15} !important;
      }

      /* Sticky columns need solid colors to prevent see-through when scrolling */
      /* Use blended color: background + 15% primary = solid result */
      .sticky[style*="left"].bg-blue-50,
      .sticky[style*="left"].bg-blue-100 {
        background-color: ${primaryBlended15} !important;
      }

      .group\\/row:has(.bg-blue-50) .sticky[style*="left"]:not(.bg-blue-50):not(.bg-blue-100),
      .group\\/row:has(.bg-blue-100) .sticky[style*="left"]:not(.bg-blue-50):not(.bg-blue-100) {
        background-color: ${primaryBlended15} !important;
      }

      .sticky[style*="top: 0px"].bg-blue-50,
      .sticky[style*="top: 0px"].bg-blue-100,
      .sticky[style*="top:0px"].bg-blue-50,
      .sticky[style*="top:0px"].bg-blue-100,
      .sticky[style*="top: 0"].bg-blue-50,
      .sticky[style*="top: 0"].bg-blue-100 {
        background-color: ${primaryBlended15} !important;
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
      .hover\\:bg-slate-50:hover,
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
      /* Exclude data-popper tooltips - they get primary color below */
      [role="dialog"],
      [role="tooltip"],
      [role="menu"],
      [role="listbox"],
      .tooltip,
      .popup,
      .modal,
      .dropdown,
      div[class*="absolute"][class*="bg-"]:not(.inset-0):not([class*="opacity"]):not([data-popper-placement]),
      div[class*="fixed"][class*="bg-"]:not(.inset-0):not([class*="opacity"]):not([data-popper-placement]),
      div[class*="z-"][class*="bg-"]:not(.inset-0):not([class*="opacity"]):not([data-popper-placement]) {
        background-color: ${background} !important;
        color: ${text} !important;
      }

      /* Modal/popup backdrop - solid background for RGB theme */
      div.fixed.inset-0.bg-black,
      div.fixed.inset-0.bg-gray-800,
      div.fixed.inset-0.bg-gray-900,
      div.absolute.inset-0.bg-black,
      div.absolute.inset-0.bg-gray-800,
      div.absolute.inset-0.bg-gray-900 {
        background-color: ${background} !important;
      }

      /* === Black/Dark Background Overrides === */
      /* Exclude backdrop elements (inset-0 = full screen overlay) */
      .bg-black:not(.inset-0):not([data-popper-placement]),
      .bg-gray-800:not(.inset-0):not([data-popper-placement]),
      .bg-gray-900:not(.inset-0):not([data-popper-placement]) {
        background-color: ${background} !important;
      }

      /* Opacity-based dark backgrounds - make solid for RGB theme */
      [class*="bg-gray-800\\/"],
      [class*="bg-gray-900\\/"],
      [class*="bg-black\\/"] {
        background-color: ${background} !important;
      }

      /* File/document viewer panels - solid background */
      /* Targets panels with dark text (text-white) indicating dark background parent */
      div.lg\\:grow.flex.flex-col.h-full,
      div.relative.grow.min-w-0,
      div.h-full.overflow-auto {
        background-color: ${background} !important;
      }

      /* JobTread native tooltips (Popper.js) - use primary color */
      div[data-popper-placement] {
        background-color: ${primary} !important;
        color: ${primaryText} !important;
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
      .focus-within\\:bg-white {
        background-color: ${background};
      }

      .focus-within\\:bg-blue-50:focus-within {
        background-color: ${primaryLight40} !important;
      }

      /* === Hover Styles === */
      .hover\\:bg-gray-50:hover,
      .hover\\:bg-gray-100:hover,
      .hover\\:bg-gray-200:hover,
      .hover\\:bg-gray-800:hover,
      .hover\\:bg-gray-900:hover {
        background-color: ${background};
        filter: brightness(0.9);
      }

      .hover\\:bg-blue-50:hover,
      .hover\\:bg-blue-100:hover {
        background-color: ${primaryFaded15} !important;
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
      .group-hover\\/row\\:bg-gray-50 {
        background-color: ${background};
      }

      .group-hover\\/row\\:bg-blue-100 {
        background-color: ${primaryFaded15} !important;
      }

      .group:hover .group-hover\\:text-gray-800 {
        color: ${text};
      }

      .group:hover .group-hover\\:bg-slate-50 {
        background-color: ${background};
      }

      /* === Primary Color for Action Buttons === */
      /* Only theme actual buttons, not all blue elements */
      button.bg-blue-500,
      button.bg-blue-600,
      button[class*="bg-blue"] {
        background-color: ${primary} !important;
        color: ${primaryText} !important;
      }

      button.hover\\:bg-blue-600:hover,
      button.hover\\:bg-blue-700:hover,
      button.hover\\:bg-blue-500:hover {
        background-color: ${primary} !important;
        filter: brightness(0.9);
      }

      /* Purple buttons (Send button, etc.) */
      button.bg-purple-700,
      button.bg-purple-600,
      button[class*="bg-purple"] {
        background-color: ${primary} !important;
        border-color: ${primary} !important;
        color: ${primaryText} !important;
      }

      button.hover\\:bg-purple-800:hover,
      button.hover\\:bg-purple-700:hover {
        background-color: ${primary} !important;
        filter: brightness(0.9);
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

      /* === Search Bar Hover State === */
      /* Search bar should use shaded background, not primary color */
      input[placeholder*="Search"].bg-transparent:hover,
      input[placeholder*="Search"].bg-transparent:focus,
      div:has(> input[placeholder*="Search"]):hover,
      div:has(> input[placeholder*="Search"]):focus-within {
        background-color: ${background} !important;
        filter: brightness(0.95);
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

      /* === Budget Group Level Row Shading === */
      /* Ensure group level rows have consistent shading across ALL cells */
      /* This makes sure row numbers and unit columns also get the group shade */
      /* BUT preserve yellow highlighting for unsaved changes and blue for selection */
      [class*="jt-group-level"] > div:not([class*="bg-yellow"]):not([class*="bg-blue"]):not(.bg-gray-50):not(.bg-gray-100) {
        background-color: inherit !important;
      }

      /* Also apply to item-under-level rows */
      [class*="jt-item-under-level"] > div:not([class*="bg-yellow"]):not([class*="bg-blue"]):not(.bg-gray-50):not(.bg-gray-100) {
        background-color: inherit !important;
      }

      /* === Budget Table Frozen Column Highlighting === */
      /* Only handle colors - no z-index or positioning changes */

      /* === Column Resize Handles === */
      /* Reduce z-index so they don't appear over sticky headers when scrolling */
      .absolute.z-10.cursor-col-resize {
        z-index: 1 !important;
      }

      .absolute.z-10.cursor-col-resize:hover {
        background-color: ${borderColor} !important;
        filter: brightness(0.8);
      }

      /* === Quick Notes Button Theme === */
      /* Quick Notes button active state uses primary color */
      .jt-quick-notes-btn.jt-notes-button-active {
        background: ${primary} !important;
        color: ${primaryText} !important;
      }

      .jt-quick-notes-btn.jt-notes-button-active:hover {
        background: ${primary} !important;
        filter: brightness(0.9);
      }

      .jt-quick-notes-floating-btn {
        background: ${primary} !important;
        color: ${primaryText} !important;
      }

      .jt-quick-notes-floating-btn:hover {
        background: ${primary} !important;
        filter: brightness(0.9);
      }

      .jt-quick-notes-floating-btn.jt-notes-button-active {
        background: ${primary} !important;
        filter: brightness(0.8);
      }

      /* Quick Notes Panel custom theme support */
      .jt-quick-notes-panel.custom-theme {
        --jt-notes-bg: ${background};
        --jt-notes-text: ${text};
        --jt-notes-border: ${borderColor};
        --jt-notes-primary: ${primary};
        --jt-notes-input-bg: ${background};
      }

      /* === Preview Button Theme === */
      /* Preview button active state uses primary color */
      .jt-preview-btn.active {
        background: ${primary} !important;
        color: ${primaryText} !important;
        border-color: ${primary} !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .jt-preview-btn {
        background: ${background} !important;
        color: ${text} !important;
        border-color: ${borderColor} !important;
      }

      .jt-preview-btn:hover {
        background: ${background} !important;
        filter: brightness(0.95);
        border-color: ${borderColor} !important;
      }

      /* Preview Panel custom theme support */
      .jt-preview-panel.custom-theme {
        --jt-preview-bg: ${background};
        --jt-preview-text: ${text};
        --jt-preview-border: ${borderColor};
        --jt-preview-primary: ${primary};
        --jt-preview-btn-bg: ${background};
        --jt-preview-btn-text: ${text};
        --jt-preview-btn-border: ${borderColor};
        --jt-preview-btn-hover-bg: ${background};
        --jt-preview-btn-hover-text: ${text};
        --jt-preview-btn-hover-border: ${borderColor};
        --jt-preview-text-muted: ${text};
        --jt-preview-scrollbar-track: ${background};
        --jt-preview-scrollbar-thumb: ${borderColor};
        --jt-preview-scrollbar-thumb-hover: ${borderColor};
      }

      .jt-preview-panel.custom-theme .jt-preview-header {
        background: ${background} !important;
        border-bottom-color: ${borderColor} !important;
        color: ${text} !important;
      }

      .jt-preview-panel.custom-theme .jt-preview-content {
        background: ${background} !important;
        color: ${text} !important;
      }

      /* === Alert Modal Theme === */
      /* Alert modal integration with custom theme */
      .jt-alert-modal {
        background: ${background} !important;
      }

      .jt-alert-modal-header {
        background: ${background} !important;
        border-bottom-color: ${borderColor} !important;
      }

      .jt-alert-modal-title {
        color: ${primary} !important;
      }

      .jt-alert-modal-close {
        background: ${background} !important;
        color: ${text} !important;
        border-color: ${borderColor} !important;
      }

      .jt-alert-modal-close:hover {
        background: ${background} !important;
        filter: brightness(0.95);
      }

      .jt-alert-modal-body {
        background: ${background} !important;
      }

      .jt-alert-dropdown-button {
        background: ${background} !important;
        border-color: ${borderColor} !important;
        color: ${text} !important;
      }

      .jt-alert-dropdown-button:hover {
        background: ${background} !important;
        filter: brightness(0.95);
      }

      .jt-alert-dropdown-menu {
        background: ${background} !important;
        border-color: ${borderColor} !important;
      }

      .jt-alert-dropdown-item {
        background: ${background} !important;
        border-bottom-color: ${borderColor} !important;
        color: ${text} !important;
      }

      .jt-alert-dropdown-item:hover {
        background: ${background} !important;
        filter: brightness(0.95);
      }

      .jt-alert-dropdown-item.active {
        background: ${primaryLight40} !important;
      }

      .jt-alert-subject {
        background: ${background} !important;
        border-color: ${borderColor} !important;
        color: ${text} !important;
      }

      .jt-alert-subject:hover:not(:focus) {
        background: ${background} !important;
        filter: brightness(0.95);
        border-color: ${borderColor} !important;
      }

      .jt-alert-subject:focus {
        background: ${background} !important;
        border-color: ${primary} !important;
      }

      .jt-alert-message-container {
        border-color: ${borderColor} !important;
      }

      .jt-alert-message {
        background: ${background} !important;
        color: ${text} !important;
      }

      .jt-alert-message:hover:not(:focus) {
        background: ${background} !important;
        filter: brightness(0.95);
      }

      .jt-alert-message:focus {
        background: ${background} !important;
      }

      .jt-alert-modal-footer {
        background: ${background} !important;
        border-top-color: ${borderColor} !important;
      }

      .jt-alert-btn-cancel {
        background: ${background} !important;
        color: ${text} !important;
        border-color: ${borderColor} !important;
      }

      .jt-alert-btn-cancel:hover {
        background: ${background} !important;
        filter: brightness(0.95);
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
