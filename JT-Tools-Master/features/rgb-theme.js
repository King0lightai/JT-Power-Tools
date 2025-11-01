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

  // Inject theme CSS using user's chosen colors directly
  function injectThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    const { primary, background, text } = currentColors;

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
        border-color: ${background};
      }

      .border-transparent {
        border-color: transparent;
      }

      .border-white {
        border-color: ${background};
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
        box-shadow: 1px 0 0 ${background};
      }

      .shadow-line-left {
        box-shadow: -1px 0 0 ${background};
      }

      .shadow-line-bottom {
        box-shadow: 0 1px 0 ${background};
      }

      .shadow-sm {
        border: solid 1px ${background};
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
