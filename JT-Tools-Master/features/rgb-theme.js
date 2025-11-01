// JobTread RGB Custom Theme Feature Module
// Applies custom RGB color theme to JobTread interface (PREMIUM FEATURE)

const RGBThemeFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let currentColors = {
    primary: { r: 59, g: 130, b: 246 },    // Default blue
    background: { r: 249, g: 250, b: 251 }, // Default light gray
    text: { r: 17, g: 24, b: 39 }          // Default dark text
  };

  // Initialize the feature
  function init(colors = null) {
    if (isActive) {
      console.log('RGBTheme: Already initialized');
      return;
    }

    console.log('RGBTheme: Initializing...');
    isActive = true;

    // Update colors if provided
    if (colors) {
      currentColors = { ...currentColors, ...colors };
    }

    // Inject custom RGB theme CSS
    injectRGBThemeCSS();

    console.log('RGBTheme: Custom theme applied', currentColors);
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('RGBTheme: Not active, nothing to cleanup');
      return;
    }

    console.log('RGBTheme: Cleaning up...');
    isActive = false;

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('RGBTheme: Custom theme removed');
  }

  // Update colors dynamically
  function updateColors(colors) {
    currentColors = { ...currentColors, ...colors };

    if (isActive) {
      // Re-inject CSS with new colors
      if (styleElement) {
        styleElement.remove();
      }
      injectRGBThemeCSS();
      console.log('RGBTheme: Colors updated', currentColors);
    }
  }

  // Get current colors
  function getColors() {
    return { ...currentColors };
  }

  // Inject RGB theme CSS with custom colors
  function injectRGBThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    const { primary, background, text } = currentColors;

    // Create CSS with custom RGB values
    const css = `
      /* JT Tools - Custom RGB Theme */

      /* CSS Variables for custom colors */
      :root {
        --jt-rgb-primary: ${primary.r}, ${primary.g}, ${primary.b};
        --jt-rgb-background: ${background.r}, ${background.g}, ${background.b};
        --jt-rgb-text: ${text.r}, ${text.g}, ${text.b};
      }

      /* Primary color applications */
      .bg-blue-500,
      .bg-blue-600,
      button.bg-blue-500,
      button.bg-blue-600 {
        background-color: rgb(var(--jt-rgb-primary)) !important;
      }

      .hover\\:bg-blue-600:hover,
      .hover\\:bg-blue-700:hover {
        background-color: rgb(calc(var(--jt-rgb-primary) * 0.9)) !important;
      }

      .text-blue-500,
      .text-blue-600 {
        color: rgb(var(--jt-rgb-primary)) !important;
      }

      .border-blue-500 {
        border-color: rgb(var(--jt-rgb-primary)) !important;
      }

      /* Background color applications */
      body,
      .bg-gray-50,
      .bg-gray-100 {
        background-color: rgb(var(--jt-rgb-background)) !important;
      }

      /* Text color applications */
      .text-gray-900,
      .text-gray-800 {
        color: rgb(var(--jt-rgb-text)) !important;
      }

      /* Schedule card customization */
      .schedule-item {
        border-left-color: rgb(var(--jt-rgb-primary)) !important;
        background-color: rgba(var(--jt-rgb-background), 0.95) !important;
        color: rgb(var(--jt-rgb-text)) !important;
      }

      /* Button states */
      button:hover {
        filter: brightness(0.95);
      }

      button:active {
        filter: brightness(0.9);
      }

      /* Link colors */
      a {
        color: rgb(var(--jt-rgb-primary)) !important;
      }

      a:hover {
        color: rgba(var(--jt-rgb-primary), 0.8) !important;
      }

      /* Focus states */
      input:focus,
      textarea:focus,
      select:focus {
        border-color: rgb(var(--jt-rgb-primary)) !important;
        outline-color: rgba(var(--jt-rgb-primary), 0.5) !important;
      }

      /* Checkbox and radio customization */
      input[type="checkbox"]:checked,
      input[type="radio"]:checked {
        background-color: rgb(var(--jt-rgb-primary)) !important;
        border-color: rgb(var(--jt-rgb-primary)) !important;
      }
    `;

    styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.id = 'jt-rgb-theme-styles';
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
  window.RGBThemeFeature = RGBThemeFeature;
}
