// JobTread Custom Theme Feature Module
// Applies custom color theme to JobTread interface (PREMIUM FEATURE)
// Generates a complete color palette from a single base color

const CustomThemeFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let currentColor = '#3B82F6'; // Default blue

  // Initialize the feature
  function init(color = null) {
    if (isActive) {
      console.log('CustomTheme: Already initialized');
      return;
    }

    console.log('CustomTheme: Initializing...');
    isActive = true;

    // Update color if provided
    if (color) {
      currentColor = color;
    }

    // Inject custom theme CSS
    injectThemeCSS();

    console.log('CustomTheme: Custom theme applied with color', currentColor);
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('CustomTheme: Not active, nothing to cleanup');
      return;
    }

    console.log('CustomTheme: Cleaning up...');
    isActive = false;

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('CustomTheme: Custom theme removed');
  }

  // Update color dynamically
  function updateColor(color) {
    currentColor = color;

    if (isActive) {
      // Re-inject CSS with new color
      if (styleElement) {
        styleElement.remove();
      }
      injectThemeCSS();
      console.log('CustomTheme: Color updated to', currentColor);
    }
  }

  // Get current color
  function getColor() {
    return currentColor;
  }

  // Convert hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  }

  // Convert RGB to HSL
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  // Generate color palette from base color (like dark mode does with grays)
  function generatePalette(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Helper to create HSL color string
    const makeColor = (hue, sat, light) => `hsl(${hue}, ${sat}%, ${light}%)`;

    // Use much higher saturation for dramatic effect like dark mode
    const baseSat = Math.max(hsl.s, 40); // Ensure minimum 40% saturation

    return {
      // Background colors (dramatic tints) - bold color presence
      bg_white: makeColor(hsl.h, baseSat * 0.5, 96),        // Noticeable tint
      bg_gray_50: makeColor(hsl.h, baseSat * 0.6, 93),      // Clear color
      bg_gray_100: makeColor(hsl.h, baseSat * 0.65, 90),    // Strong tint
      bg_gray_200: makeColor(hsl.h, baseSat * 0.7, 85),     // Very visible
      bg_slate_50: makeColor(hsl.h, baseSat * 0.55, 92),
      bg_blue_50: makeColor(hsl.h, baseSat * 0.7, 88),
      bg_blue_100: makeColor(hsl.h, baseSat * 0.75, 83),
      bg_yellow_100: makeColor((hsl.h + 30) % 360, baseSat * 0.5, 88),

      // Text colors (saturated dark shades)
      text_gray_500: makeColor(hsl.h, baseSat * 0.6, 40),
      text_gray_600: makeColor(hsl.h, baseSat * 0.65, 32),
      text_gray_700: makeColor(hsl.h, baseSat * 0.7, 25),
      text_gray_800: makeColor(hsl.h, baseSat * 0.75, 20),
      text_gray_900: makeColor(hsl.h, baseSat * 0.8, 15),
      text_black: makeColor(hsl.h, baseSat * 0.85, 10),

      // Border colors (visible)
      border: makeColor(hsl.h, baseSat * 0.6, 75),
      border_dark: makeColor(hsl.h, baseSat * 0.65, 65),

      // Primary/accent (the actual chosen color)
      primary: baseColor,
      primary_light: makeColor(hsl.h, hsl.s, Math.min(hsl.l + 10, 90)),
      primary_dark: makeColor(hsl.h, hsl.s, Math.max(hsl.l - 10, 10)),

      // Schedule card backgrounds (with inline styles)
      schedule_card_bg: makeColor(hsl.h, baseSat * 0.6, 92),
    };
  }

  // Inject theme CSS following dark mode's selector pattern
  function injectThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    const palette = generatePalette(currentColor);

    // Create CSS using the same selectors as dark mode, but with custom colors
    const css = `
      /* === JT Power Tools - Custom Color Theme === */
      /* Following dark mode's selector pattern with custom colors */

      /* === Schedule Card Overrides (Inline Styles) === */
      td div.cursor-pointer[style*="background-color"] {
        background-color: ${palette.schedule_card_bg} !important;
      }

      /* Keep colored left border visible */
      td div.cursor-pointer[style*="border-left"] {
        /* Border color preserved from inline style */
      }

      /* === General Styles === */
      *, ::backdrop, ::file-selector-button, :after, :before {
        border-color: ${palette.border};
      }

      .border-transparent {
        border-color: transparent;
      }

      .border-white {
        border-color: ${palette.border};
      }

      /* === Background Colors === */
      .bg-white {
        background-color: ${palette.bg_white};
      }

      .bg-gray-50 {
        background-color: ${palette.bg_gray_50};
      }

      .bg-gray-100 {
        background-color: ${palette.bg_gray_100};
      }

      .bg-gray-200 {
        background-color: ${palette.bg_gray_200};
      }

      .bg-gray-700 {
        background-color: ${palette.bg_gray_200};
      }

      .bg-yellow-100 {
        background-color: ${palette.bg_yellow_100};
      }

      .bg-slate-50 {
        background-color: ${palette.bg_slate_50};
      }

      .bg-blue-100 {
        background-color: ${palette.bg_blue_100};
      }

      .bg-blue-50 {
        background-color: ${palette.bg_blue_50};
      }

      .focus\\:bg-white:focus {
        background-color: ${palette.bg_gray_50};
      }

      /* === Text Colors === */
      .text-gray-500 {
        color: ${palette.text_gray_500};
      }

      .text-gray-600 {
        color: ${palette.text_gray_600};
      }

      .text-gray-700 {
        color: ${palette.text_gray_700};
      }

      .text-gray-800 {
        color: ${palette.text_gray_800};
      }

      .text-gray-900 {
        color: ${palette.text_gray_900};
      }

      .text-black {
        color: ${palette.text_black};
      }

      /* === Shadow Styles === */
      .shadow-line-right {
        box-shadow: 1px 0 0 ${palette.border};
      }

      .shadow-line-left {
        box-shadow: -1px 0 0 ${palette.border};
      }

      .shadow-line-bottom {
        box-shadow: 0 1px 0 ${palette.border};
      }

      .shadow-sm {
        border: solid 1px ${palette.border};
      }

      /* === Focus Styles === */
      .focus-within\\:bg-white {
        background-color: ${palette.bg_white};
      }

      .focus-within\\:bg-blue-50:focus-within {
        background-color: ${palette.bg_blue_50};
      }

      .focus\\:bg-gray-100:focus {
        background-color: ${palette.bg_gray_100};
      }

      /* === Hover Styles === */
      .hover\\:bg-gray-50:hover {
        background-color: ${palette.bg_gray_100};
      }

      .hover\\:bg-gray-100:hover {
        background-color: ${palette.bg_gray_100};
      }

      .hover\\:bg-gray-200:hover {
        background-color: ${palette.bg_gray_200};
      }

      .hover\\:text-gray-800:hover {
        color: ${palette.text_gray_800};
      }

      .hover\\:text-gray-900:hover {
        color: ${palette.text_gray_900};
      }

      .hover\\:bg-blue-50:hover {
        background-color: ${palette.bg_blue_50};
      }

      .hover\\:bg-blue-100:hover {
        background-color: ${palette.bg_blue_100};
      }

      /* === Active Styles === */
      .active\\:bg-gray-200:active {
        background-color: ${palette.bg_gray_200};
      }

      /* === Group Hover Styles === */
      .group-hover\\/row\\:bg-gray-50 {
        background-color: ${palette.bg_gray_100};
      }

      .group-hover\\/row\\:bg-blue-100 {
        background-color: ${palette.bg_blue_100};
      }

      .group:hover .group-hover\\:text-gray-800 {
        color: ${palette.text_gray_800};
      }

      .group:hover .group-hover\\:bg-slate-50 {
        background-color: ${palette.bg_slate_50};
      }

      /* === Primary Color Overrides === */
      /* Blue buttons and accents should use the user's chosen color */
      .bg-blue-500,
      .bg-blue-600,
      button[class*="bg-blue"] {
        background-color: ${palette.primary} !important;
      }

      .hover\\:bg-blue-600:hover,
      .hover\\:bg-blue-700:hover {
        background-color: ${palette.primary_dark} !important;
      }

      .text-blue-500,
      .text-blue-600,
      [class*="text-blue"] {
        color: ${palette.primary} !important;
      }

      .border-blue-500,
      [class*="border-blue"] {
        border-color: ${palette.primary} !important;
      }
    `;

    styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.id = 'jt-custom-theme-styles';
    document.head.appendChild(styleElement);
  }

  // Public API
  return {
    init,
    cleanup,
    updateColor,
    getColor,
    isActive: () => isActive,
    // Export palette generator for preview
    generatePalette: (color) => generatePalette(color)
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.RGBThemeFeature = CustomThemeFeature;
  window.CustomThemeFeature = CustomThemeFeature;
}
