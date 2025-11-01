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

  // Calculate hue rotation needed from default blue to target color
  function calculateHueRotation(targetColor) {
    const defaultBlue = '#3B82F6'; // Default blue

    const defaultRgb = hexToRgb(defaultBlue);
    const targetRgb = hexToRgb(targetColor);

    const defaultHsl = rgbToHsl(defaultRgb.r, defaultRgb.g, defaultRgb.b);
    const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

    // Calculate the hue rotation needed
    let rotation = targetHsl.h - defaultHsl.h;

    // Normalize to -180 to 180 range for shortest rotation
    if (rotation > 180) rotation -= 360;
    if (rotation < -180) rotation += 360;

    return {
      hueRotate: rotation,
      saturate: targetHsl.s / defaultHsl.s,
      brightness: targetHsl.l / defaultHsl.l
    };
  }

  // Inject theme CSS with filter-based approach (like Dark Reader)
  function injectThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    const filters = calculateHueRotation(currentColor);

    // Calculate adjustments
    const hueRotate = filters.hueRotate;
    const saturate = Math.max(0.5, Math.min(1.5, filters.saturate)); // Clamp between 0.5 and 1.5
    const brightness = Math.max(0.85, Math.min(1.15, filters.brightness)); // Clamp between 0.85 and 1.15

    // Create CSS with filter-based theming
    const css = `
      /* JT Tools - Custom Color Theme (Filter-based) */

      /* Apply hue rotation to the entire page */
      html {
        filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) brightness(${brightness});
      }

      /* Restore images, videos, and media to their original colors */
      img,
      video,
      canvas,
      iframe,
      [style*="background-image"],
      picture {
        filter: hue-rotate(${-hueRotate}deg) saturate(${1/saturate}) brightness(${1/brightness}) !important;
      }

      /* Restore avatars and profile pictures */
      [class*="avatar"],
      [class*="profile"],
      [alt*="avatar" i],
      [alt*="profile" i],
      [alt*="logo" i] {
        filter: hue-rotate(${-hueRotate}deg) saturate(${1/saturate}) brightness(${1/brightness}) !important;
      }

      /* Optional: Fine-tune specific elements if needed */
      /* This allows us to override specific cases where the global filter doesn't work well */
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
