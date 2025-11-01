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

  // Generate color palette from base color
  function generatePalette(baseColor) {
    const rgb = hexToRgb(baseColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    return {
      // Primary colors
      primary: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      primaryDark: `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(hsl.l - 10, 10)}%)`,
      primaryDarker: `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(hsl.l - 15, 5)}%)`,
      primaryLight: `hsl(${hsl.h}, ${hsl.s}%, ${Math.min(hsl.l + 10, 90)}%)`,

      // Background colors (very light tints)
      bg50: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.3, 30)}%, 98%)`,
      bg100: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.4, 40)}%, 96%)`,
      bg200: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.5, 50)}%, 94%)`,
      bg300: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.6, 60)}%, 90%)`,

      // Text colors (dark shades)
      text: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.8, 80)}%, 15%)`,
      textLight: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.6, 60)}%, 30%)`,

      // Border colors
      border: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.4, 40)}%, 85%)`,
      borderDark: `hsl(${hsl.h}, ${Math.min(hsl.s * 0.5, 50)}%, 75%)`,

      // Accent (slightly shifted hue for variety)
      accent: `hsl(${(hsl.h + 10) % 360}, ${hsl.s}%, ${hsl.l}%)`,
    };
  }

  // Inject theme CSS with generated color palette
  function injectThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    const palette = generatePalette(currentColor);

    // Create CSS with generated color palette
    const css = `
      /* JT Tools - Custom Color Theme */

      /* Override primary background colors */
      body {
        background-color: ${palette.bg50} !important;
      }

      .bg-gray-50 {
        background-color: ${palette.bg50} !important;
      }

      .bg-gray-100 {
        background-color: ${palette.bg100} !important;
      }

      .bg-gray-200 {
        background-color: ${palette.bg200} !important;
      }

      /* Primary colors for buttons and accents */
      .bg-blue-500,
      .bg-blue-600,
      button.bg-blue-500,
      button.bg-blue-600,
      [class*="bg-blue"] {
        background-color: ${palette.primary} !important;
      }

      .hover\\:bg-blue-600:hover,
      .hover\\:bg-blue-700:hover {
        background-color: ${palette.primaryDark} !important;
      }

      button:active[class*="bg-blue"] {
        background-color: ${palette.primaryDarker} !important;
      }

      /* Text colors */
      .text-blue-500,
      .text-blue-600,
      [class*="text-blue"] {
        color: ${palette.primary} !important;
      }

      .text-gray-900 {
        color: ${palette.text} !important;
      }

      .text-gray-800 {
        color: ${palette.text} !important;
      }

      .text-gray-700 {
        color: ${palette.textLight} !important;
      }

      .text-gray-600 {
        color: ${palette.textLight} !important;
      }

      /* Border colors */
      .border-blue-500,
      [class*="border-blue"] {
        border-color: ${palette.primary} !important;
      }

      .border-gray-200 {
        border-color: ${palette.border} !important;
      }

      .border-gray-300 {
        border-color: ${palette.borderDark} !important;
      }

      /* Schedule cards */
      .schedule-item,
      [class*="schedule"] {
        border-left-color: ${palette.primary} !important;
        background-color: ${palette.bg100} !important;
      }

      /* Links */
      a {
        color: ${palette.primary} !important;
      }

      a:hover {
        color: ${palette.primaryDark} !important;
      }

      /* Focus states */
      input:focus,
      textarea:focus,
      select:focus {
        border-color: ${palette.primary} !important;
        outline-color: ${palette.primaryLight} !important;
        box-shadow: 0 0 0 3px ${palette.primaryLight}33 !important;
      }

      /* Checkbox and radio */
      input[type="checkbox"]:checked,
      input[type="radio"]:checked {
        background-color: ${palette.primary} !important;
        border-color: ${palette.primary} !important;
      }

      /* Badges and pills */
      .badge,
      .pill,
      [class*="badge"],
      [class*="pill"] {
        background-color: ${palette.bg200} !important;
        color: ${palette.text} !important;
      }

      /* Cards and panels */
      .card,
      .panel,
      [class*="card"],
      [class*="panel"] {
        background-color: white !important;
        border-color: ${palette.border} !important;
      }

      /* Hover states for list items */
      [class*="hover:bg-gray"]:hover {
        background-color: ${palette.bg200} !important;
      }

      /* Selected states */
      [class*="bg-blue"].selected,
      .selected[class*="bg-blue"] {
        background-color: ${palette.primaryLight} !important;
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
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.RGBThemeFeature = CustomThemeFeature;
  window.CustomThemeFeature = CustomThemeFeature;
}
