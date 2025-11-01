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

      /* ===== BACKGROUND COLORS ===== */

      /* Main body background */
      body {
        background-color: ${palette.bg50} !important;
      }

      /* All gray background variations */
      [class*="bg-gray-50"],
      [class*="bg-gray-100"],
      [class*="bg-gray-200"] {
        background-color: ${palette.bg100} !important;
      }

      [class*="bg-gray-300"] {
        background-color: ${palette.bg200} !important;
      }

      /* Specific background shades */
      [style*="background-color: rgb(249, 250, 251)"],
      [style*="background-color: rgb(243, 244, 246)"],
      [style*="background: rgb(249, 250, 251)"],
      [style*="background: rgb(243, 244, 246)"] {
        background-color: ${palette.bg100} !important;
      }

      /* ===== PRIMARY/ACCENT COLORS ===== */

      /* All blue backgrounds (buttons, badges, etc) */
      [class*="bg-blue"],
      button[class*="bg-blue"],
      a[class*="bg-blue"] {
        background-color: ${palette.primary} !important;
      }

      /* Blue hover states */
      [class*="hover:bg-blue"]:hover,
      button:hover[class*="bg-blue"] {
        background-color: ${palette.primaryDark} !important;
      }

      /* Blue active states */
      button:active[class*="bg-blue"],
      [class*="active"][class*="bg-blue"] {
        background-color: ${palette.primaryDarker} !important;
      }

      /* Primary color backgrounds (alternative) */
      [class*="bg-primary"] {
        background-color: ${palette.primary} !important;
      }

      /* ===== TEXT COLORS ===== */

      /* Blue text */
      [class*="text-blue"],
      a[class*="text-blue"] {
        color: ${palette.primary} !important;
      }

      /* Dark gray text */
      [class*="text-gray-900"],
      [class*="text-gray-800"] {
        color: ${palette.text} !important;
      }

      /* Medium gray text */
      [class*="text-gray-700"],
      [class*="text-gray-600"],
      [class*="text-gray-500"] {
        color: ${palette.textLight} !important;
      }

      /* ===== BORDER COLORS ===== */

      /* Blue borders */
      [class*="border-blue"] {
        border-color: ${palette.primary} !important;
      }

      /* Gray borders */
      [class*="border-gray-200"],
      [class*="border-gray-300"] {
        border-color: ${palette.border} !important;
      }

      [class*="border-gray-400"] {
        border-color: ${palette.borderDark} !important;
      }

      /* Divide colors (dividers between elements) */
      [class*="divide-gray"] > * + * {
        border-color: ${palette.border} !important;
      }

      /* ===== SPECIFIC ELEMENTS ===== */

      /* Buttons */
      button {
        transition: all 0.2s ease;
      }

      /* Links */
      a:not([class*="bg-"]) {
        color: ${palette.primary} !important;
      }

      a:hover:not([class*="bg-"]) {
        color: ${palette.primaryDark} !important;
      }

      /* Form inputs */
      input:focus,
      textarea:focus,
      select:focus {
        border-color: ${palette.primary} !important;
        outline-color: ${palette.primaryLight} !important;
        box-shadow: 0 0 0 3px ${palette.primaryLight}33 !important;
      }

      /* Checkboxes and radios */
      input[type="checkbox"]:checked,
      input[type="radio"]:checked {
        background-color: ${palette.primary} !important;
        border-color: ${palette.primary} !important;
      }

      /* Ring colors (Tailwind focus rings) */
      [class*="ring-blue"],
      [class*="focus:ring-blue"]:focus {
        --tw-ring-color: ${palette.primary} !important;
      }

      /* ===== COMPONENT-SPECIFIC ===== */

      /* Schedule items/cards */
      [class*="schedule"],
      .schedule-item,
      div[class*="border-l-4"],
      div[class*="border-l-8"] {
        border-left-color: ${palette.primary} !important;
      }

      /* Cards and panels - keep white but add themed border */
      [class*="rounded"][class*="border"],
      [class*="shadow"][class*="bg-white"] {
        border-color: ${palette.border} !important;
      }

      /* Badges, pills, tags */
      [class*="badge"],
      [class*="pill"],
      [class*="tag"],
      span[class*="bg-"][class*="rounded"] {
        background-color: ${palette.bg200} !important;
        color: ${palette.text} !important;
      }

      /* Progress bars */
      [class*="progress"],
      [role="progressbar"] {
        background-color: ${palette.bg200} !important;
      }

      [class*="progress"] > div,
      [role="progressbar"] > div {
        background-color: ${palette.primary} !important;
      }

      /* Selected/active states */
      [class*="selected"],
      [aria-selected="true"],
      [class*="active"]:not(button) {
        background-color: ${palette.primaryLight} !important;
        border-color: ${palette.primary} !important;
      }

      /* Hover backgrounds for rows/list items */
      [class*="hover:bg-gray"]:hover,
      tr:hover,
      li:hover[class*="cursor-pointer"] {
        background-color: ${palette.bg200} !important;
      }

      /* SVG icons with blue color */
      svg[class*="text-blue"],
      [class*="text-blue"] svg {
        color: ${palette.primary} !important;
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
