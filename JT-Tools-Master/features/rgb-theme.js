// JobTread Custom Theme Feature Module
// Applies custom color theme to JobTread interface (PREMIUM FEATURE)
// Generates a complete color palette from a single base color

const CustomThemeFeature = (() => {
  let isActive = false;
  let styleElement = null;
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

      /* === Schedule Card Overrides (Inline Styles) === */
      td div.cursor-pointer[style*="background-color"] {
        background-color: ${background} !important;
      }

      /* === General Styles === */
      *, ::backdrop, ::file-selector-button, :after, :before {
        border-color: ${borderColor};
      }

      .border-transparent {
        border-color: transparent;
      }

      .border-white {
        border-color: ${borderColor};
      }

      /* === Background Colors === */
      .bg-white,
      .bg-gray-50,
      .bg-gray-100,
      .bg-gray-200,
      .bg-gray-700,
      .bg-slate-50,
      .bg-blue-50,
      .bg-blue-100,
      .bg-yellow-100 {
        background-color: ${background};
      }

      .focus\\:bg-white:focus,
      .focus\\:bg-gray-100:focus {
        background-color: ${background};
        filter: brightness(0.95);
      }

      /* === Text Colors === */
      .text-gray-500,
      .text-gray-600,
      .text-gray-700,
      .text-gray-800,
      .text-gray-900,
      .text-black {
        color: ${text};
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
        border-color: ${primary} !important;
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
