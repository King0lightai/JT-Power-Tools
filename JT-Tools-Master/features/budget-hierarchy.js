// JobTread Budget Group Hierarchy Shading Feature Module
// Applies progressive shading to nested budget groups (up to 5 levels)
// Level 1 (top) = Darkest, Level 5 (deepest) = Lightest

const BudgetHierarchyFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let observer = null;

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

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

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

  // Generate 5 shades from a base color
  function generateShades(baseColor, isDarkMode = false) {
    const luminance = getLuminance(baseColor);
    const isDark = luminance < 0.5;

    // For dark mode, use smaller steps for closer shading
    const step = isDarkMode ? 10 : 15;

    if (isDark) {
      // For dark backgrounds, progressively lighten
      return [
        baseColor,                           // Level 1: Base (darkest)
        adjustBrightness(baseColor, step),       // Level 2
        adjustBrightness(baseColor, step * 2),   // Level 3
        adjustBrightness(baseColor, step * 3),   // Level 4
        adjustBrightness(baseColor, step * 4)    // Level 5 (lightest)
      ];
    } else {
      // For light backgrounds, progressively darken
      return [
        adjustBrightness(baseColor, -step * 4), // Level 1 (darkest)
        adjustBrightness(baseColor, -step * 3), // Level 2
        adjustBrightness(baseColor, -step * 2), // Level 3
        adjustBrightness(baseColor, -step),     // Level 4
        baseColor                                // Level 5: Base (lightest)
      ];
    }
  }

  // Detect which theme is active
  function getActiveTheme() {
    // Check if custom theme is active
    if (window.CustomThemeFeature && window.CustomThemeFeature.isActive()) {
      const colors = window.CustomThemeFeature.getColors();
      return {
        type: 'custom',
        baseColor: colors.background
      };
    }

    // Check if dark mode is active
    if (window.DarkModeFeature && window.DarkModeFeature.isActive()) {
      return {
        type: 'dark',
        baseColor: '#424242' // Neutral dark gray (less blue)
      };
    }

    // Default to light mode
    return {
      type: 'light',
      baseColor: '#F9FAFB' // gray-50 as base for light mode
    };
  }

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('BudgetHierarchy: Already initialized');
      return;
    }

    console.log('BudgetHierarchy: Initializing...');
    isActive = true;

    // Inject shading CSS
    injectShadingCSS();

    // Apply shading to existing groups
    applyGroupShading();

    // Start observing for new groups
    startObserver();

    console.log('BudgetHierarchy: Shading applied');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('BudgetHierarchy: Not active, nothing to cleanup');
      return;
    }

    console.log('BudgetHierarchy: Cleaning up...');
    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove shading classes
    removeAllShading();

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('BudgetHierarchy: Shading removed');
  }

  // Inject CSS for shading
  function injectShadingCSS() {
    // Remove old style if exists
    if (styleElement) {
      styleElement.remove();
    }

    // Get active theme and generate shades
    const theme = getActiveTheme();
    const isDarkMode = theme.type === 'dark';
    const shades = generateShades(theme.baseColor, isDarkMode);

    // Generate hover shades (slightly darker/lighter than base)
    const hoverShades = shades.map(shade => {
      const luminance = getLuminance(shade);
      return luminance < 0.5
        ? adjustBrightness(shade, -15)  // Darken for dark backgrounds
        : adjustBrightness(shade, -10); // Darken for light backgrounds
    });

    styleElement = document.createElement('style');
    styleElement.id = 'jt-budget-hierarchy-styles';
    styleElement.textContent = `
      /* Budget Group Hierarchy Shading */
      /* Generated for ${theme.type} theme */
      /* Level 1 = Darkest (Top level groups) */
      /* Level 5 = Lightest (Deepest nested groups) */

      .jt-group-level-1 { background-color: ${shades[0]} !important; }
      .jt-group-level-2 { background-color: ${shades[1]} !important; }
      .jt-group-level-3 { background-color: ${shades[2]} !important; }
      .jt-group-level-4 { background-color: ${shades[3]} !important; }
      .jt-group-level-5 { background-color: ${shades[4]} !important; }

      /* Hover states */
      .jt-group-level-1:hover { background-color: ${hoverShades[0]} !important; }
      .jt-group-level-2:hover { background-color: ${hoverShades[1]} !important; }
      .jt-group-level-3:hover { background-color: ${hoverShades[2]} !important; }
      .jt-group-level-4:hover { background-color: ${hoverShades[3]} !important; }
      .jt-group-level-5:hover { background-color: ${hoverShades[4]} !important; }

      /* Apply shading to all cells in the group row */
      .jt-group-level-1 > div,
      .jt-group-level-2 > div,
      .jt-group-level-3 > div,
      .jt-group-level-4 > div,
      .jt-group-level-5 > div {
        background-color: inherit !important;
      }

      /* Apply shading to indent spacer divs (nested inside first cell) */
      .jt-group-level-1 div.pl-3\\.5.border-r-2,
      .jt-group-level-2 div.pl-3\\.5.border-r-2,
      .jt-group-level-3 div.pl-3\\.5.border-r-2,
      .jt-group-level-4 div.pl-3\\.5.border-r-2,
      .jt-group-level-5 div.pl-3\\.5.border-r-2 {
        background-color: inherit !important;
      }

      /* Override specific background classes on spacers */
      .jt-group-level-1 div.pl-3\\.5.bg-white,
      .jt-group-level-1 div.pl-3\\.5.bg-blue-50,
      .jt-group-level-2 div.pl-3\\.5.bg-white,
      .jt-group-level-2 div.pl-3\\.5.bg-blue-50,
      .jt-group-level-3 div.pl-3\\.5.bg-white,
      .jt-group-level-3 div.pl-3\\.5.bg-blue-50,
      .jt-group-level-4 div.pl-3\\.5.bg-white,
      .jt-group-level-4 div.pl-3\\.5.bg-blue-50,
      .jt-group-level-5 div.pl-3\\.5.bg-white,
      .jt-group-level-5 div.pl-3\\.5.bg-blue-50 {
        background-color: inherit !important;
      }
    `;

    document.head.appendChild(styleElement);
    console.log(`BudgetHierarchy: Generated shades for ${theme.type} theme:`, shades);
  }

  // Refresh shading when theme changes
  function refreshShading() {
    if (!isActive) return;

    console.log('BudgetHierarchy: Refreshing shading due to theme change...');
    injectShadingCSS();
    applyGroupShading();
  }

  // Get nesting level of a group element
  function getGroupNestingLevel(groupCell) {
    // Count the number of indent divs (pl-3.5 border-r-2)
    const indentDivs = groupCell.querySelectorAll(':scope > div.pl-3\\.5.border-r-2');
    const level = indentDivs.length + 1; // 0 indents = level 1, 1 indent = level 2, etc.

    return Math.min(level, 5); // Cap at level 5
  }

  // Find all group cells (first cell with font-bold class)
  function findAllGroupCells() {
    // Group cells have font-bold class and contain the expand/collapse button
    return document.querySelectorAll('div.font-bold.flex[style*="width: 300px"]');
  }

  // Find the parent row element
  function findParentRow(groupCell) {
    // The row is typically the parent or grandparent element
    // Look for element that contains multiple cells (border-r elements)
    let current = groupCell.parentElement;
    let depth = 0;
    const maxDepth = 5;

    while (current && depth < maxDepth) {
      // Check if this element looks like a row (has multiple child cells)
      const cells = current.querySelectorAll(':scope > div.border-r');
      if (cells.length > 1) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }

    // If we can't find a row, return the group cell itself
    return groupCell;
  }

  // Apply shading to a single group
  function applyShading(groupCell) {
    const level = getGroupNestingLevel(groupCell);
    const row = findParentRow(groupCell);

    // Remove any existing level classes
    for (let i = 1; i <= 5; i++) {
      row.classList.remove(`jt-group-level-${i}`);
    }

    // Add the appropriate level class
    row.classList.add(`jt-group-level-${level}`);

    console.log(`BudgetHierarchy: Applied level ${level} shading to group`);
  }

  // Apply shading to all groups
  function applyGroupShading() {
    const groupCells = findAllGroupCells();
    console.log(`BudgetHierarchy: Found ${groupCells.length} groups`);

    groupCells.forEach(groupCell => {
      applyShading(groupCell);
    });
  }

  // Remove all shading classes
  function removeAllShading() {
    for (let i = 1; i <= 5; i++) {
      const shadedElements = document.querySelectorAll(`.jt-group-level-${i}`);
      shadedElements.forEach(el => {
        el.classList.remove(`jt-group-level-${i}`);
      });
    }
  }

  // Start observing for new groups
  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      if (!isActive) return;

      // Check if any new groups were added
      let shouldReapply = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check if added nodes contain group cells
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              if (node.classList?.contains('font-bold') ||
                  node.querySelector?.('div.font-bold.flex[style*="width: 300px"]')) {
                shouldReapply = true;
              }
            }
          });
        }
      }

      if (shouldReapply) {
        console.log('BudgetHierarchy: DOM changed, reapplying shading...');
        applyGroupShading();
      }
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('BudgetHierarchy: Observer started');
  }

  return {
    init,
    cleanup,
    refreshShading,
    isActive: () => isActive
  };
})();

// Make available globally
window.BudgetHierarchyFeature = BudgetHierarchyFeature;
