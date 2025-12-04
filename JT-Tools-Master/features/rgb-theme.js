// JobTread Custom Theme Feature Module
// Applies custom color theme to JobTread interface (PREMIUM FEATURE)
// Generates a complete color palette from three base colors using HSL manipulation

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

  // Generated palette (populated by generatePalette)
  let palette = {};

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

    // Generate the full color palette from base colors
    palette = generatePalette(currentColors);

    // Inject custom theme CSS
    injectThemeCSS();

    // Apply contrast fixes to existing elements
    applyContrastFixes();

    // Start observing for new elements
    startObserver();

    console.log('CustomTheme: Custom theme applied with palette', palette);
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
      // Regenerate the full palette with new colors
      palette = generatePalette(currentColors);

      // Re-inject CSS with new colors
      if (styleElement) {
        styleElement.remove();
      }
      injectThemeCSS();

      // Reapply contrast fixes with new colors
      applyContrastFixes();

      console.log('CustomTheme: Colors updated with palette', palette);
    }
  }

  // Get current colors
  function getColors() {
    return { ...currentColors };
  }

  // Get the generated palette
  function getPalette() {
    return { ...palette };
  }

  // ============================================================
  // COLOR UTILITY FUNCTIONS - HSL-based for better color control
  // ============================================================

  // Helper function to convert hex to RGB
  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') {
      console.warn('CustomTheme: Invalid hex color input:', hex);
      return null;
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // Helper function to convert RGB to hex
  function rgbToHex(r, g, b) {
    const toHex = (n) => {
      const clamped = Math.max(0, Math.min(255, Math.round(n)));
      return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Convert hex to HSL (returns {h: 0-360, s: 0-100, l: 0-100})
  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 50 };

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // Convert HSL to hex
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; // Normalize hue to 0-360
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return rgbToHex(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    );
  }

  // Calculate relative luminance (WCAG 2.0)
  function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

    const toLinear = (c) => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  }

  // Check if background is dark
  function isDark(hex) {
    return getLuminance(hex) < 0.4;
  }

  // Get contrasting text color (white or black)
  function getContrastText(backgroundColor) {
    return isDark(backgroundColor) ? '#ffffff' : '#000000';
  }

  // Adjust lightness of a color (amount: -100 to +100)
  function adjustLightness(hex, amount) {
    const hsl = hexToHsl(hex);
    return hslToHex(hsl.h, hsl.s, hsl.l + amount);
  }

  // Adjust saturation of a color (amount: -100 to +100)
  function adjustSaturation(hex, amount) {
    const hsl = hexToHsl(hex);
    return hslToHex(hsl.h, hsl.s + amount, hsl.l);
  }

  // Set specific lightness value
  function setLightness(hex, lightness) {
    const hsl = hexToHsl(hex);
    return hslToHex(hsl.h, hsl.s, lightness);
  }

  // Set specific saturation value
  function setSaturation(hex, saturation) {
    const hsl = hexToHsl(hex);
    return hslToHex(hsl.h, saturation, hsl.l);
  }

  // Blend two colors (0 = color1, 1 = color2)
  function blendColors(hex1, hex2, ratio) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return hex1;

    return rgbToHex(
      rgb1.r + (rgb2.r - rgb1.r) * ratio,
      rgb1.g + (rgb2.g - rgb1.g) * ratio,
      rgb1.b + (rgb2.b - rgb1.b) * ratio
    );
  }

  // Create rgba string from hex and alpha
  function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  // ============================================================
  // PALETTE GENERATION - Creates rich color system from 3 inputs
  // ============================================================

  function generatePalette(colors) {
    const { primary, background, text } = colors;
    const bgHsl = hexToHsl(background);
    const primaryHsl = hexToHsl(primary);
    const darkMode = isDark(background);

    // Calculate contrast direction (positive = lighten, negative = darken for contrast)
    const contrastDir = darkMode ? 1 : -1;

    // ---- BACKGROUND SHADES ----
    // Create 5 distinct background levels for visual hierarchy
    const bgShades = {
      // Level 0: Base background (cards, main content)
      base: background,
      // Level 1: Subtle shade (slight contrast for sections)
      subtle: hslToHex(bgHsl.h, bgHsl.s, bgHsl.l + (contrastDir * 3)),
      // Level 2: Muted (input backgrounds, list items)
      muted: hslToHex(bgHsl.h, bgHsl.s, bgHsl.l + (contrastDir * 6)),
      // Level 3: Emphasis (active states, hover)
      emphasis: hslToHex(bgHsl.h, bgHsl.s, bgHsl.l + (contrastDir * 10)),
      // Level 4: Strong (tooltips, overlays)
      strong: hslToHex(bgHsl.h, bgHsl.s, bgHsl.l + (contrastDir * 15)),
      // Level 5: Elevated (modals, dropdowns - opposite direction for depth)
      elevated: hslToHex(bgHsl.h, bgHsl.s, bgHsl.l + (contrastDir * -2))
    };

    // ---- BORDER COLORS ----
    // Create distinct border shades for depth perception
    const borderShades = {
      // Subtle border for cards and sections
      subtle: hslToHex(bgHsl.h, Math.min(bgHsl.s + 5, 30), bgHsl.l + (contrastDir * 12)),
      // Default border for inputs and dividers
      default: hslToHex(bgHsl.h, Math.min(bgHsl.s + 8, 35), bgHsl.l + (contrastDir * 18)),
      // Strong border for focus states
      strong: hslToHex(bgHsl.h, Math.min(bgHsl.s + 10, 40), bgHsl.l + (contrastDir * 25))
    };

    // ---- TEXT COLORS ----
    // Create text hierarchy
    const textShades = {
      primary: text,
      secondary: blendColors(text, background, 0.25),
      muted: blendColors(text, background, 0.45),
      disabled: blendColors(text, background, 0.6)
    };

    // ---- PRIMARY COLOR VARIATIONS ----
    // Create primary color palette for interactive elements
    const primaryShades = {
      base: primary,
      hover: hslToHex(primaryHsl.h, primaryHsl.s, primaryHsl.l + (darkMode ? 8 : -8)),
      active: hslToHex(primaryHsl.h, primaryHsl.s, primaryHsl.l + (darkMode ? 12 : -12)),
      // Light versions for backgrounds
      light: hslToHex(primaryHsl.h, Math.max(primaryHsl.s - 20, 20), darkMode ? 25 : 92),
      lighter: hslToHex(primaryHsl.h, Math.max(primaryHsl.s - 30, 15), darkMode ? 20 : 95),
      // For selection highlighting - blend with background
      selection: blendColors(background, primary, 0.15),
      selectionHover: blendColors(background, primary, 0.25),
      selectionStrong: blendColors(background, primary, 0.35)
    };

    // ---- HOVER/FOCUS/ACTIVE STATES ----
    // Distinct colors for interactive states (not just brightness filters!)
    const states = {
      hover: hslToHex(bgHsl.h, bgHsl.s + 2, bgHsl.l + (contrastDir * 5)),
      focus: blendColors(background, primary, 0.1),
      active: hslToHex(bgHsl.h, bgHsl.s + 3, bgHsl.l + (contrastDir * 8)),
      // Row hover - subtle but noticeable
      rowHover: hslToHex(bgHsl.h, bgHsl.s + 1, bgHsl.l + (contrastDir * 3))
    };

    // ---- ALERT COLORS ----
    // Generate alert colors that harmonize with the theme
    const alerts = generateAlertColors(background, darkMode);

    // ---- SCROLLBAR COLORS ----
    const scrollbar = {
      track: bgShades.muted,
      thumb: borderShades.default,
      thumbHover: primary
    };

    // ---- SHADOW COLORS ----
    const shadows = {
      color: darkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)',
      colorStrong: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)'
    };

    return {
      isDark: darkMode,
      background: bgShades,
      border: borderShades,
      text: textShades,
      primary: primaryShades,
      states,
      alerts,
      scrollbar,
      shadows,
      // Keep raw colors for backward compatibility
      raw: { primary, background, text }
    };
  }

  // Generate alert colors that blend with the theme
  function generateAlertColors(background, darkMode) {
    // Base alert hues
    const alertHues = {
      green: 145,
      yellow: 45,
      red: 0,
      orange: 25,
      purple: 270,
      blue: 210
    };

    const result = {};

    Object.entries(alertHues).forEach(([name, hue]) => {
      if (darkMode) {
        // Dark mode: desaturated dark backgrounds, bright text
        result[name] = {
          bg: hslToHex(hue, 35, 18),
          text: hslToHex(hue, 75, 65),
          border: hslToHex(hue, 50, 35)
        };
      } else {
        // Light mode: tinted light backgrounds, dark vivid text
        result[name] = {
          bg: hslToHex(hue, 65, 95),
          text: hslToHex(hue, 70, 40),
          border: hslToHex(hue, 55, 75)
        };
      }
    });

    // Body text adapts to background
    result.bodyText = darkMode ? '#e0e0e0' : '#374151';

    return result;
  }

  // Inject theme CSS using the generated palette
  function injectThemeCSS() {
    if (styleElement) {
      styleElement.remove();
    }

    // Use the pre-generated palette
    const p = palette;
    const { primary, background, text } = currentColors;

    // Get contrast text for primary color
    const primaryText = getContrastText(primary);

    // Get appropriate text colors for standard color picker colors
    const greenText = getContrastText('#10b981');
    const yellowText = getContrastText('#f59e0b');
    const blueText = getContrastText('#3b82f6');
    const redText = getContrastText('#ef4444');
    const orangeText = getContrastText('#f97316');
    const purpleText = getContrastText('#a855f7');

    // Create CSS using the rich palette
    const css = `
      /* === JT Power Tools - Custom Color Theme === */
      /* Rich palette generated from Primary, Background, and Text colors */

      /* === CSS Custom Properties for other features === */
      :root {
        --jt-theme-primary: ${p.primary.base};
        --jt-theme-primary-hover: ${p.primary.hover};
        --jt-theme-primary-active: ${p.primary.active};
        --jt-theme-background: ${p.background.base};
        --jt-theme-background-subtle: ${p.background.subtle};
        --jt-theme-background-muted: ${p.background.muted};
        --jt-theme-background-emphasis: ${p.background.emphasis};
        --jt-theme-background-elevated: ${p.background.elevated};
        --jt-theme-text: ${p.text.primary};
        --jt-theme-text-secondary: ${p.text.secondary};
        --jt-theme-text-muted: ${p.text.muted};
        --jt-theme-border: ${p.border.default};
        --jt-theme-border-subtle: ${p.border.subtle};
        --jt-theme-border-strong: ${p.border.strong};
      }

      /* === Custom Scrollbar Styling === */
      /* Only style scrollbars on scrollable containers, not all elements */
      html::-webkit-scrollbar,
      body::-webkit-scrollbar,
      [class*="overflow-auto"]::-webkit-scrollbar,
      [class*="overflow-y-auto"]::-webkit-scrollbar,
      [class*="overflow-x-auto"]::-webkit-scrollbar,
      [class*="overflow-scroll"]::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      html::-webkit-scrollbar-track,
      body::-webkit-scrollbar-track,
      [class*="overflow-auto"]::-webkit-scrollbar-track,
      [class*="overflow-y-auto"]::-webkit-scrollbar-track,
      [class*="overflow-x-auto"]::-webkit-scrollbar-track,
      [class*="overflow-scroll"]::-webkit-scrollbar-track {
        background: ${p.scrollbar.track};
        border-radius: 5px;
      }

      html::-webkit-scrollbar-thumb,
      body::-webkit-scrollbar-thumb,
      [class*="overflow-auto"]::-webkit-scrollbar-thumb,
      [class*="overflow-y-auto"]::-webkit-scrollbar-thumb,
      [class*="overflow-x-auto"]::-webkit-scrollbar-thumb,
      [class*="overflow-scroll"]::-webkit-scrollbar-thumb {
        background: ${p.scrollbar.thumb};
        border-radius: 5px;
        border: 2px solid ${p.background.base};
      }

      html::-webkit-scrollbar-thumb:hover,
      body::-webkit-scrollbar-thumb:hover,
      [class*="overflow-auto"]::-webkit-scrollbar-thumb:hover,
      [class*="overflow-y-auto"]::-webkit-scrollbar-thumb:hover,
      [class*="overflow-x-auto"]::-webkit-scrollbar-thumb:hover,
      [class*="overflow-scroll"]::-webkit-scrollbar-thumb:hover {
        background: ${p.scrollbar.thumbHover};
      }

      html::-webkit-scrollbar-corner,
      body::-webkit-scrollbar-corner {
        background: ${p.background.base};
      }

      /* Firefox - only on html/body, not all elements */
      html, body {
        scrollbar-width: thin;
        scrollbar-color: ${p.scrollbar.thumb} ${p.scrollbar.track};
      }

      /* === Logo Colors === */
      .text-gray-800 {
        color: ${p.primary.base} !important;
      }

      /* === Task Cards === */
      td div.cursor-pointer[style*="border-left"] {
        background-color: ${p.background.elevated} !important;
        color: ${p.text.primary} !important;
        border-left-width: 5px !important;
        box-shadow: inset 4px 0 8px ${p.shadows.color};
      }

      td div.cursor-pointer[style*="border-left"] * {
        color: inherit !important;
      }

      /* === General Border Colors === */
      *, ::backdrop, ::file-selector-button, :after, :before {
        border-color: ${p.border.default};
      }

      .border-transparent {
        border-color: transparent !important;
      }

      .border-white {
        border-color: ${p.border.subtle} !important;
      }

      input.border-transparent,
      textarea.border-transparent {
        border-color: transparent !important;
      }

      /* === Formatter Toolbar Theme === */
      .jt-formatter-toolbar {
        background: ${p.background.elevated} !important;
        border-color: ${p.border.default} !important;
        box-shadow: 0 4px 12px ${p.shadows.colorStrong} !important;
      }

      .jt-formatter-toolbar button {
        background: transparent !important;
        border: none !important;
        color: ${p.text.primary} !important;
      }

      .jt-formatter-toolbar button:hover {
        background: ${p.states.hover} !important;
        border: none !important;
      }

      .jt-formatter-toolbar button:active {
        background: ${p.states.active} !important;
      }

      .jt-formatter-toolbar button.active {
        background: ${p.primary.base} !important;
        color: ${primaryText} !important;
        border-color: ${p.primary.base} !important;
      }

      .jt-formatter-toolbar button.active:hover {
        background: ${p.primary.hover} !important;
      }

      /* Color picker buttons */
      .jt-formatter-toolbar button.jt-color-green { color: #10b981 !important; }
      .jt-formatter-toolbar button.jt-color-yellow { color: #f59e0b !important; }
      .jt-formatter-toolbar button.jt-color-blue { color: #3b82f6 !important; }
      .jt-formatter-toolbar button.jt-color-red { color: #ef4444 !important; }
      .jt-formatter-toolbar button.jt-color-orange { color: #f97316 !important; }
      .jt-formatter-toolbar button.jt-color-purple { color: #a855f7 !important; }

      .jt-formatter-toolbar button.jt-color-green.active { background: #10b981 !important; color: ${greenText} !important; }
      .jt-formatter-toolbar button.jt-color-yellow.active { background: #f59e0b !important; color: ${yellowText} !important; }
      .jt-formatter-toolbar button.jt-color-blue.active { background: #3b82f6 !important; color: ${blueText} !important; }
      .jt-formatter-toolbar button.jt-color-red.active { background: #ef4444 !important; color: ${redText} !important; }
      .jt-formatter-toolbar button.jt-color-orange.active { background: #f97316 !important; color: ${orangeText} !important; }
      .jt-formatter-toolbar button.jt-color-purple.active { background: #a855f7 !important; color: ${purpleText} !important; }

      .jt-toolbar-divider {
        background: ${p.border.default} !important;
      }

      .jt-dropdown-menu {
        background: ${p.background.elevated} !important;
        border-color: ${p.border.default} !important;
        box-shadow: 0 4px 12px ${p.shadows.colorStrong} !important;
      }

      .jt-dropdown-menu button {
        color: ${p.text.primary} !important;
      }

      .jt-dropdown-menu button:hover {
        background: ${p.states.hover} !important;
      }

      .jt-dropdown-menu button.active {
        background: ${p.primary.base} !important;
        color: ${primaryText} !important;
      }

      /* === Background Color Hierarchy === */
      .bg-white,
      .bg-slate-50 {
        background-color: ${p.background.base};
      }

      .bg-gray-50 {
        background-color: ${p.background.subtle} !important;
      }

      .bg-gray-100 {
        background-color: ${p.background.muted} !important;
      }

      .bg-gray-200 {
        background-color: ${p.background.emphasis} !important;
      }

      .bg-gray-700 {
        background-color: ${p.background.strong} !important;
      }

      /* === Selection Highlighting === */
      .bg-blue-50,
      .bg-blue-100 {
        background-color: ${p.primary.selection} !important;
      }

      /* Sticky columns - solid colors */
      .sticky[style*="left"].bg-blue-50,
      .sticky[style*="left"].bg-blue-100 {
        background-color: ${p.primary.selection} !important;
      }

      .group\\/row:has(.bg-blue-50) .sticky[style*="left"]:not(.bg-blue-50):not(.bg-blue-100),
      .group\\/row:has(.bg-blue-100) .sticky[style*="left"]:not(.bg-blue-50):not(.bg-blue-100) {
        background-color: ${p.primary.selection} !important;
      }

      .sticky[style*="top: 0px"].bg-blue-50,
      .sticky[style*="top: 0px"].bg-blue-100,
      .sticky[style*="top:0px"].bg-blue-50,
      .sticky[style*="top:0px"].bg-blue-100,
      .sticky[style*="top: 0"].bg-blue-50,
      .sticky[style*="top: 0"].bg-blue-100 {
        background-color: ${p.primary.selection} !important;
      }

      /* === Alert Colors (Theme-Harmonized) === */
      .bg-green-50 { background-color: ${p.alerts.green.bg} !important; }
      .bg-yellow-50 { background-color: ${p.alerts.yellow.bg} !important; }
      .bg-red-50 { background-color: ${p.alerts.red.bg} !important; }
      .bg-orange-50 { background-color: ${p.alerts.orange.bg} !important; }
      .bg-purple-50 { background-color: ${p.alerts.purple.bg} !important; }

      .text-green-500, .border-green-500 { color: ${p.alerts.green.text}; border-color: ${p.alerts.green.border}; }
      .text-yellow-500, .border-yellow-500 { color: ${p.alerts.yellow.text}; border-color: ${p.alerts.yellow.border}; }
      .text-red-500, .border-red-500 { color: ${p.alerts.red.text}; border-color: ${p.alerts.red.border}; }
      .text-orange-500, .border-orange-500 { color: ${p.alerts.orange.text}; border-color: ${p.alerts.orange.border}; }
      .text-purple-500, .border-purple-500 { color: ${p.alerts.purple.text}; border-color: ${p.alerts.purple.border}; }

      /* Alert body text */
      .bg-green-50, .bg-yellow-50, .bg-red-50, .bg-orange-50, .bg-purple-50 {
        color: ${p.alerts.bodyText};
      }

      /* Keep header colored */
      .bg-green-50 .text-green-500 { color: ${p.alerts.green.text} !important; }
      .bg-yellow-50 .text-yellow-500 { color: ${p.alerts.yellow.text} !important; }
      .bg-red-50 .text-red-500 { color: ${p.alerts.red.text} !important; }
      .bg-orange-50 .text-orange-500 { color: ${p.alerts.orange.text} !important; }
      .bg-purple-50 .text-purple-500 { color: ${p.alerts.purple.text} !important; }

      /* === Focus States (Real Colors, Not Filters!) === */
      .focus\\:bg-white:focus,
      .focus\\:bg-gray-100:focus {
        background-color: ${p.states.focus} !important;
      }

      .focus-within\\:bg-white {
        background-color: ${p.background.base};
      }

      .focus-within\\:bg-blue-50:focus-within {
        background-color: ${p.primary.selectionStrong} !important;
      }

      /* === Hover States (Real Colors, Not Filters!) === */
      .hover\\:bg-gray-50:hover {
        background-color: ${p.states.hover} !important;
      }

      .hover\\:bg-gray-100:hover {
        background-color: ${p.states.hover} !important;
      }

      .hover\\:bg-gray-200:hover {
        background-color: ${p.states.active} !important;
      }

      .hover\\:bg-slate-50:hover {
        background-color: ${p.states.hover} !important;
      }

      .hover\\:bg-white:hover {
        background-color: ${p.states.hover} !important;
      }

      /* Note: hover:bg-gray-800 and hover:bg-gray-900 are NOT overridden */
      /* They're used intentionally on dark toolbars/headers */

      /* Resize handles */
      .hover\\:bg-gray-300:hover {
        background-color: ${p.border.default} !important;
      }

      .hover\\:bg-blue-50:hover,
      .hover\\:bg-blue-100:hover {
        background-color: ${p.primary.selectionHover} !important;
      }

      /* === Active States === */
      .active\\:bg-gray-100:active,
      .active\\:bg-gray-200:active,
      .active\\:bg-gray-300:active {
        background-color: ${p.states.active} !important;
      }

      /* === Group Hover States === */
      .group-hover\\/row\\:bg-gray-50 {
        background-color: ${p.states.rowHover} !important;
      }

      .group-hover\\/row\\:bg-blue-100 {
        background-color: ${p.primary.selectionHover} !important;
      }

      .group:hover .group-hover\\:text-gray-800 {
        color: ${p.text.primary};
      }

      .group:hover .group-hover\\:bg-slate-50 {
        background-color: ${p.states.rowHover} !important;
      }

      /* === Popups, Tooltips, and Modals (Elevated Surfaces) === */
      /* Apply to dialogs, menus, and popper-positioned dropdowns */
      [role="dialog"],
      [role="menu"],
      [role="listbox"],
      div[data-popper-placement] {
        background-color: ${p.background.elevated} !important;
        color: ${p.text.primary} !important;
        box-shadow: 0 8px 24px ${p.shadows.colorStrong} !important;
      }

      /* Dropdown menu items - ensure proper text color (but preserve text-white) */
      div[data-popper-placement] div[role="button"]:not(.text-white),
      div[data-popper-placement] [tabindex]:not(.text-white) {
        color: ${p.text.primary} !important;
      }

      /* Dropdown dividers */
      div[data-popper-placement] .divide-y > * + * {
        border-color: ${p.border.subtle} !important;
      }

      /* Absolute/fixed positioned elements - theme colors but NO shadow */
      /* These are often content tiles, not popups */
      div[class*="absolute"][class*="bg-white"]:not(.inset-0):not([data-popper-placement]),
      div[class*="fixed"][class*="bg-white"]:not(.inset-0):not([data-popper-placement]) {
        background-color: ${p.background.base} !important;
        color: ${p.text.primary} !important;
      }

      /* Modal backdrop - keep semi-transparent */
      div.fixed.inset-0.bg-black,
      div.fixed.inset-0.bg-gray-800,
      div.fixed.inset-0.bg-gray-900 {
        background-color: rgba(0, 0, 0, 0.5) !important;
      }

      /* Note: .bg-gray-800, .bg-gray-900, .bg-black are NOT overridden */
      /* They're used intentionally for dark toolbars, file viewers, etc. */

      /* Only override opacity-based backgrounds in themed content areas */
      .bg-white [class*="bg-gray-800\\/"],
      .bg-white [class*="bg-gray-900\\/"],
      .bg-white [class*="bg-black\\/"] {
        background-color: ${p.background.strong} !important;
      }

      /* === Text Color Hierarchy === */
      /* Note: .text-white is NOT overridden - it's used intentionally on dark toolbars */
      .text-gray-900,
      .text-gray-800,
      .text-black {
        color: ${p.text.primary};
      }

      .text-gray-700,
      .text-gray-600 {
        color: ${p.text.secondary};
      }

      .text-gray-500 {
        color: ${p.text.muted};
      }

      .text-gray-400,
      .text-gray-300 {
        color: ${p.text.disabled};
      }

      /* Keep .text-white as white - used on intentionally dark UI elements */
      /* .text-white is NOT themed */

      .hover\\:text-gray-800:hover,
      .hover\\:text-gray-900:hover {
        color: ${p.text.primary};
      }

      .group-hover\\:text-gray-500,
      .group:hover .group-hover\\:text-gray-500 {
        color: ${p.text.secondary} !important;
      }

      .placeholder-gray-400::placeholder,
      .group-hover\\:placeholder-gray-500:hover::placeholder {
        color: ${p.text.muted} !important;
      }

      /* === Shadow Styles === */
      .shadow-line-right {
        box-shadow: 1px 0 0 ${p.border.subtle};
      }

      .shadow-line-left {
        box-shadow: -1px 0 0 ${p.border.subtle};
      }

      .shadow-line-bottom {
        box-shadow: 0 1px 0 ${p.border.subtle};
      }

      .shadow-sm {
        border: solid 1px ${p.border.subtle};
        box-shadow: none;
      }

      /* === Primary Buttons === */
      button.bg-blue-500,
      button.bg-blue-600,
      button[class*="bg-blue"] {
        background-color: ${p.primary.base} !important;
        color: ${primaryText} !important;
        box-shadow: 0 2px 4px ${p.shadows.color};
      }

      button.hover\\:bg-blue-600:hover,
      button.hover\\:bg-blue-700:hover,
      button.hover\\:bg-blue-500:hover {
        background-color: ${p.primary.hover} !important;
      }

      button.bg-purple-700,
      button.bg-purple-600,
      button[class*="bg-purple"] {
        background-color: ${p.primary.base} !important;
        border-color: ${p.primary.base} !important;
        color: ${primaryText} !important;
      }

      button.hover\\:bg-purple-800:hover,
      button.hover\\:bg-purple-700:hover {
        background-color: ${p.primary.hover} !important;
      }

      /* === Primary colors on non-button elements (menu items, etc.) === */
      .bg-blue-500:not(button),
      .bg-blue-600:not(button) {
        background-color: ${p.primary.base} !important;
      }

      /* Preserve text-white on blue backgrounds */
      .bg-blue-500.text-white,
      .bg-blue-600.text-white {
        color: ${primaryText} !important;
      }

      /* Hover states for non-button elements */
      .hover\\:bg-blue-500:hover:not(button),
      .hover\\:bg-blue-600:hover:not(button) {
        background-color: ${p.primary.base} !important;
      }

      .hover\\:text-white:hover {
        color: ${primaryText} !important;
      }

      /* === Selected State === */
      .border-jtOrange {
        border-color: ${p.primary.base} !important;
      }

      .border-jtOrange.bg-gray-100 {
        background-color: ${p.primary.selectionStrong} !important;
      }

      /* === Search Bar === */
      /* Note: Search inputs with bg-transparent should stay transparent */
      /* The outer container gets themed via .bg-white rules */

      /* === Budget Group Level Rows === */
      /* Exclude resize handles (.cursor-col-resize) from inheriting background */
      [class*="jt-group-level"] > div:not([class*="bg-yellow"]):not([class*="bg-blue"]):not(.bg-gray-50):not(.bg-gray-100):not(.cursor-col-resize) {
        background-color: inherit !important;
      }

      [class*="jt-item-under-level"] > div:not([class*="bg-yellow"]):not([class*="bg-blue"]):not(.bg-gray-50):not(.bg-gray-100):not(.cursor-col-resize) {
        background-color: inherit !important;
      }

      /* === Column Resize Handles === */
      .absolute.z-10.cursor-col-resize {
        z-index: 1 !important;
      }

      .absolute.z-10.cursor-col-resize:hover {
        background-color: ${p.border.strong} !important;
      }

      /* === Quick Notes === */
      .jt-quick-notes-btn.jt-notes-button-active {
        background: ${p.primary.base} !important;
        color: ${primaryText} !important;
      }

      .jt-quick-notes-btn.jt-notes-button-active:hover {
        background: ${p.primary.hover} !important;
      }

      .jt-quick-notes-floating-btn {
        background: ${p.primary.base} !important;
        color: ${primaryText} !important;
        box-shadow: 0 4px 12px ${p.shadows.colorStrong} !important;
      }

      .jt-quick-notes-floating-btn:hover {
        background: ${p.primary.hover} !important;
      }

      .jt-quick-notes-floating-btn.jt-notes-button-active {
        background: ${p.primary.active} !important;
      }

      .jt-quick-notes-panel.custom-theme {
        --jt-notes-bg: ${p.background.elevated};
        --jt-notes-text: ${p.text.primary};
        --jt-notes-border: ${p.border.default};
        --jt-notes-primary: ${p.primary.base};
        --jt-notes-input-bg: ${p.background.muted};
      }

      /* === Preview Button === */
      .jt-preview-btn.active {
        background: ${p.primary.base} !important;
        color: ${primaryText} !important;
        border-color: ${p.primary.base} !important;
        box-shadow: 0 2px 8px ${p.shadows.colorStrong};
      }

      .jt-preview-btn {
        background: ${p.background.muted} !important;
        color: ${p.text.primary} !important;
        border-color: ${p.border.default} !important;
      }

      .jt-preview-btn:hover {
        background: ${p.states.hover} !important;
        border-color: ${p.border.strong} !important;
      }

      .jt-preview-panel.custom-theme {
        --jt-preview-bg: ${p.background.elevated};
        --jt-preview-text: ${p.text.primary};
        --jt-preview-border: ${p.border.default};
        --jt-preview-primary: ${p.primary.base};
        --jt-preview-btn-bg: ${p.background.muted};
        --jt-preview-btn-text: ${p.text.primary};
        --jt-preview-btn-border: ${p.border.default};
        --jt-preview-btn-hover-bg: ${p.states.hover};
        --jt-preview-btn-hover-text: ${p.text.primary};
        --jt-preview-btn-hover-border: ${p.border.strong};
        --jt-preview-text-muted: ${p.text.muted};
        --jt-preview-scrollbar-track: ${p.scrollbar.track};
        --jt-preview-scrollbar-thumb: ${p.scrollbar.thumb};
        --jt-preview-scrollbar-thumb-hover: ${p.scrollbar.thumbHover};
      }

      .jt-preview-panel.custom-theme .jt-preview-header {
        background: ${p.background.elevated} !important;
        border-bottom-color: ${p.border.default} !important;
        color: ${p.text.primary} !important;
      }

      .jt-preview-panel.custom-theme .jt-preview-content {
        background: ${p.background.base} !important;
        color: ${p.text.primary} !important;
      }

      /* === Alert Modal === */
      .jt-alert-modal {
        background: ${p.background.elevated} !important;
        box-shadow: 0 8px 32px ${p.shadows.colorStrong} !important;
      }

      .jt-alert-modal-header {
        background: ${p.background.elevated} !important;
        border-bottom-color: ${p.border.default} !important;
      }

      .jt-alert-modal-title {
        color: ${p.primary.base} !important;
      }

      .jt-alert-modal-close {
        background: ${p.background.muted} !important;
        color: ${p.text.primary} !important;
        border-color: ${p.border.default} !important;
      }

      .jt-alert-modal-close:hover {
        background: ${p.states.hover} !important;
      }

      .jt-alert-modal-body {
        background: ${p.background.elevated} !important;
      }

      .jt-alert-dropdown-button {
        background: ${p.background.muted} !important;
        border-color: ${p.border.default} !important;
        color: ${p.text.primary} !important;
      }

      .jt-alert-dropdown-button:hover {
        background: ${p.states.hover} !important;
      }

      .jt-alert-dropdown-menu {
        background: ${p.background.elevated} !important;
        border-color: ${p.border.default} !important;
        box-shadow: 0 4px 12px ${p.shadows.colorStrong} !important;
      }

      .jt-alert-dropdown-item {
        background: transparent !important;
        border-bottom-color: ${p.border.subtle} !important;
        color: ${p.text.primary} !important;
      }

      .jt-alert-dropdown-item:hover {
        background: ${p.states.hover} !important;
      }

      .jt-alert-dropdown-item.active {
        background: ${p.primary.selection} !important;
      }

      .jt-alert-subject {
        background: ${p.background.muted} !important;
        border-color: ${p.border.default} !important;
        color: ${p.text.primary} !important;
      }

      .jt-alert-subject:hover:not(:focus) {
        background: ${p.states.hover} !important;
        border-color: ${p.border.strong} !important;
      }

      .jt-alert-subject:focus {
        background: ${p.background.muted} !important;
        border-color: ${p.primary.base} !important;
        box-shadow: 0 0 0 2px ${p.primary.selection} !important;
      }

      .jt-alert-message-container {
        border-color: ${p.border.default} !important;
      }

      .jt-alert-message {
        background: ${p.background.muted} !important;
        color: ${p.text.primary} !important;
      }

      .jt-alert-message:hover:not(:focus) {
        background: ${p.states.hover} !important;
      }

      .jt-alert-message:focus {
        background: ${p.background.muted} !important;
        box-shadow: 0 0 0 2px ${p.primary.selection} !important;
      }

      .jt-alert-modal-footer {
        background: ${p.background.elevated} !important;
        border-top-color: ${p.border.default} !important;
      }

      .jt-alert-btn-cancel {
        background: ${p.background.muted} !important;
        color: ${p.text.primary} !important;
        border-color: ${p.border.default} !important;
      }

      .jt-alert-btn-cancel:hover {
        background: ${p.states.hover} !important;
        border-color: ${p.border.strong} !important;
      }

      /* === Ring/Focus Ring Colors === */
      .ring-gray-200 {
        --tw-ring-color: ${p.border.default};
      }

      .focus-within\\:border-cyan-500:focus-within {
        border-color: ${p.primary.base} !important;
      }

      /* === Caret Color === */
      .caret-black {
        caret-color: ${p.text.primary};
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

  // Fix text contrast for a single element using palette text color
  function fixTextContrast(element) {
    const style = element.getAttribute('style');
    if (!style) return;

    // Skip tags - they should keep their original colors
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
      const textColor = hexToRgb(palette.text?.primary || currentColors.text);
      const targetColor = `rgb(${textColor.r}, ${textColor.g}, ${textColor.b})`;

      // Only update if different (prevents infinite loop)
      if (currentColor !== targetColor) {
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

        // Fill entire cell background with primary color from palette
        const primaryColor = palette.primary?.base || currentColors.primary;
        const primaryRgb = hexToRgb(primaryColor);
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
    getPalette,
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.RGBThemeFeature = CustomThemeFeature;
  window.CustomThemeFeature = CustomThemeFeature;
}
