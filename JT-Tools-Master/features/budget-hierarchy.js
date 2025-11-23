// JobTread Budget Group Hierarchy Shading Feature Module
// Applies progressive shading to nested budget groups (up to 5 levels)
// Level 1 (top) = Lightest, Level 5 (deepest) = Darkest

const BudgetHierarchyFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let observer = null;
  let clickController = null; // AbortController for click listener

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

  // Helper function to convert hex to HSL
  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
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

  // Helper function to convert HSL to hex
  function hslToHex(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return rgbToHex(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    );
  }

  // Adjust color lightness in HSL (preserves hue and saturation)
  function adjustLightness(hex, amount) {
    const hsl = hexToHsl(hex);
    if (!hsl) return hex;

    // Adjust lightness and clamp between 0 and 100
    const newL = Math.max(0, Math.min(100, hsl.l + amount));

    return hslToHex(hsl.h, hsl.s, newL);
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
    const hsl = hexToHsl(baseColor);
    if (!hsl) return [baseColor, baseColor, baseColor, baseColor, baseColor];

    const isDark = hsl.l < 50;

    // Use smaller steps for more subtle shading
    // In HSL, lightness ranges from 0-100, so we use percentage-based steps
    const step = isDarkMode ? 2 : 3;

    if (isDark) {
      // For dark backgrounds, progressively lighten from darker to lighter
      return [
        adjustLightness(baseColor, step * 4),   // Level 1 (lightest)
        adjustLightness(baseColor, step * 3),   // Level 2
        adjustLightness(baseColor, step * 2),   // Level 3
        adjustLightness(baseColor, step),       // Level 4
        baseColor                               // Level 5: Base (darkest)
      ];
    } else {
      // For light backgrounds, progressively darken from lighter to darker
      return [
        baseColor,                              // Level 1: Base (lightest)
        adjustLightness(baseColor, -step),      // Level 2
        adjustLightness(baseColor, -step * 2),  // Level 3
        adjustLightness(baseColor, -step * 3),  // Level 4
        adjustLightness(baseColor, -step * 4)   // Level 5 (darkest)
      ];
    }
  }

  // Check if dark mode styles are injected in DOM
  function isDarkModeActive() {
    return document.getElementById('jt-dark-mode-styles') !== null;
  }

  // Check if custom theme styles are injected in DOM
  function isCustomThemeActive() {
    return document.getElementById('jt-custom-theme-styles') !== null;
  }

  // Detect which theme is active by checking DOM, not feature state
  function getActiveTheme() {
    // Check if custom theme CSS is actually injected in DOM
    if (isCustomThemeActive()) {
      // Try to get colors from feature if available
      if (window.CustomThemeFeature && typeof window.CustomThemeFeature.getColors === 'function') {
        const colors = window.CustomThemeFeature.getColors();
        return {
          type: 'custom',
          baseColor: colors.background
        };
      }
      // Fallback if feature not available but CSS is present
      return {
        type: 'custom',
        baseColor: '#F3E8FF' // Default custom theme background
      };
    }

    // Check if dark mode CSS is actually injected in DOM
    if (isDarkModeActive()) {
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
    if (isActive) return;

    isActive = true;

    // Delay initialization slightly to ensure dark mode/custom theme CSS is loaded
    // This prevents white shading when navigating back to budget pages
    setTimeout(() => {
      if (!isActive) return; // Check if cleanup was called during delay

      // Inject shading CSS with current theme
      injectShadingCSS();

      // Apply shading to existing groups
      applyGroupShading();

      // Start observing for new groups
      startObserver();

      console.log('BudgetHierarchy: Initialized with theme:', getActiveTheme().type);
    }, 100); // 100ms delay to let dark mode/theme CSS inject
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) return;

    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove click event listener
    if (clickController) {
      clickController.abort();
      clickController = null;
    }

    // Remove shading classes
    removeAllShading();

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    console.log('BudgetHierarchy: Cleanup complete (event listeners removed)');
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

    // Generate hover shades (slightly darker than base using HSL)
    const hoverShades = shades.map(shade => {
      const hsl = hexToHsl(shade);
      if (!hsl) return shade;

      // Darken by reducing lightness in HSL
      return adjustLightness(shade, hsl.l < 50 ? -3 : -4);
    });

    // Line items should match their parent group shades exactly
    const itemShades = [...shades];

    const itemHoverShades = [...hoverShades];

    styleElement = document.createElement('style');
    styleElement.id = 'jt-budget-hierarchy-styles';
    styleElement.textContent = `
      /* Budget Group Hierarchy Shading */
      /* Generated for ${theme.type} theme */
      /* Level 1 = Lightest (Top level groups) */
      /* Level 5 = Darkest (Deepest nested groups) */

      .jt-group-level-1 { background-color: ${shades[0]} !important; }
      .jt-group-level-2 { background-color: ${shades[1]} !important; }
      .jt-group-level-3 { background-color: ${shades[2]} !important; }
      .jt-group-level-4 { background-color: ${shades[3]} !important; }
      .jt-group-level-5 { background-color: ${shades[4]} !important; }

      /* Hover states for groups */
      .jt-group-level-1:hover { background-color: ${hoverShades[0]} !important; }
      .jt-group-level-2:hover { background-color: ${hoverShades[1]} !important; }
      .jt-group-level-3:hover { background-color: ${hoverShades[2]} !important; }
      .jt-group-level-4:hover { background-color: ${hoverShades[3]} !important; }
      .jt-group-level-5:hover { background-color: ${hoverShades[4]} !important; }

      /* Line items under groups (slightly lighter) */
      .jt-item-under-level-1 { background-color: ${itemShades[0]} !important; }
      .jt-item-under-level-2 { background-color: ${itemShades[1]} !important; }
      .jt-item-under-level-3 { background-color: ${itemShades[2]} !important; }
      .jt-item-under-level-4 { background-color: ${itemShades[3]} !important; }
      .jt-item-under-level-5 { background-color: ${itemShades[4]} !important; }

      /* Hover states for items */
      .jt-item-under-level-1:hover { background-color: ${itemHoverShades[0]} !important; }
      .jt-item-under-level-2:hover { background-color: ${itemHoverShades[1]} !important; }
      .jt-item-under-level-3:hover { background-color: ${itemHoverShades[2]} !important; }
      .jt-item-under-level-4:hover { background-color: ${itemHoverShades[3]} !important; }
      .jt-item-under-level-5:hover { background-color: ${itemHoverShades[4]} !important; }

      /* Apply shading to all cells in the group row */
      /* BUT preserve yellow highlighting for unsaved changes and blue for selection */
      .jt-group-level-1 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-group-level-2 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-group-level-3 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-group-level-4 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-group-level-5 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) {
        background-color: inherit !important;
      }

      /* Apply shading to indent spacer divs (nested inside first cell) */
      /* Only if parent cell doesn't have yellow or blue background */
      .jt-group-level-1 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-group-level-2 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-group-level-3 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-group-level-4 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-group-level-5 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2 {
        background-color: inherit !important;
      }

      /* Override specific background classes on spacers */
      /* Only if parent cell doesn't have yellow or blue background */
      /* Note: We exclude bg-blue-50 spacers to preserve selection highlighting */
      .jt-group-level-1 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-group-level-2 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-group-level-3 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-group-level-4 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-group-level-5 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white {
        background-color: inherit !important;
      }

      /* Apply shading to all cells in line item rows */
      /* BUT preserve yellow highlighting for unsaved changes and blue for selection */
      .jt-item-under-level-1 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-item-under-level-2 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-item-under-level-3 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-item-under-level-4 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]),
      .jt-item-under-level-5 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) {
        background-color: inherit !important;
      }

      /* Apply shading to indent spacer divs in line items */
      /* Only if parent cell doesn't have yellow or blue background */
      .jt-item-under-level-1 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-item-under-level-2 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-item-under-level-3 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-item-under-level-4 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2,
      .jt-item-under-level-5 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.border-r-2 {
        background-color: inherit !important;
      }

      /* Override specific background classes on spacers in line items */
      /* Only if parent cell doesn't have yellow or blue background */
      /* Note: We exclude bg-blue-50 spacers to preserve selection highlighting */
      .jt-item-under-level-1 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-item-under-level-2 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-item-under-level-3 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-item-under-level-4 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white,
      .jt-item-under-level-5 > div:not([class*="bg-yellow"]):not([class*="bg-blue"]) div.pl-3\\.5.bg-white {
        background-color: inherit !important;
      }

      /* Column resize handles */
      /* Reduce z-index so they don't appear over sticky headers when scrolling */
      .absolute.z-10.cursor-col-resize {
        z-index: 1 !important;
      }

      .absolute.z-10.cursor-col-resize:hover {
        background-color: ${isDarkMode ? '#555555' : hoverShades[0]} !important;
      }
    `;

    document.head.appendChild(styleElement);
  }

  // Refresh shading when theme changes
  function refreshShading() {
    if (!isActive) return;

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

  // Get nesting level of any row (group or line item)
  function getRowNestingLevel(row) {
    // First try to find a group cell (font-bold)
    const groupCell = row.querySelector('div.font-bold.flex[style*="width: 300px"]');
    if (groupCell) {
      return getGroupNestingLevel(groupCell);
    }

    // For line items, check the first cell for indent divs
    const firstCell = row.querySelector(':scope > div');
    if (firstCell) {
      const indentDivs = firstCell.querySelectorAll(':scope > div.pl-3\\.5.border-r-2');
      const level = indentDivs.length + 1;
      return Math.min(level, 5);
    }

    return 1; // Default to level 1 if we can't determine
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
  }


  // Remove all item shading
  function removeAllItemShading() {
    for (let i = 1; i <= 5; i++) {
      const shadedItems = document.querySelectorAll(`.jt-item-under-level-${i}`);
      shadedItems.forEach(el => {
        el.classList.remove(`jt-item-under-level-${i}`);
      });
    }
  }

  // Find the parent group for a line item by looking backwards
  function findParentGroupForItem(itemRow) {
    if (!itemRow) return null;

    const itemLevel = getRowNestingLevel(itemRow);
    let currentRow = itemRow.previousElementSibling;

    // Look backwards to find the nearest group at a shallower level
    while (currentRow) {
      const groupCell = currentRow.querySelector('div.font-bold.flex[style*="width: 300px"]');
      if (groupCell) {
        const groupLevel = getGroupNestingLevel(groupCell);
        // If this group is at a shallower level, it's the parent
        if (groupLevel < itemLevel) {
          return { row: currentRow, level: groupLevel };
        }
      }
      currentRow = currentRow.previousElementSibling;
    }

    return null; // No parent group found
  }

  // Check if we're on a budget page or in a budget context
  function isInBudgetContext() {
    const path = window.location.pathname.toLowerCase();

    // Explicitly exclude these pages first
    const excludedPaths = ['/tasks', '/task', '/schedule', '/todos', '/to-dos', '/assignments'];
    for (const excludePath of excludedPaths) {
      if (path.includes(excludePath)) {
        return false;
      }
    }

    // Check if URL contains budget (singular or plural)
    if (path.includes('/budget')) {
      return true;
    }

    return false;
  }

  // Apply shading to all groups
  function applyGroupShading() {
    // Only apply shading if we're in a budget context
    if (!isInBudgetContext()) {
      return;
    }

    const groupCells = findAllGroupCells();

    // First, remove all existing shading from items
    removeAllItemShading();

    // Apply shading to all groups
    groupCells.forEach(groupCell => {
      applyShading(groupCell);
    });

    // Now shade all line items by finding their parent groups
    let allRows = document.querySelectorAll('[class*="group/row"]');

    if (allRows.length === 0) {
      allRows = document.querySelectorAll('.group\\/row');
    }

    allRows.forEach(row => {
      // Skip if it's a group row
      const isGroup = row.querySelector('div.font-bold.flex[style*="width: 300px"]');
      if (isGroup) return;

      // This is a line item, find its parent group
      const parentGroup = findParentGroupForItem(row);
      if (parentGroup) {
        // Remove any existing item-level classes
        for (let i = 1; i <= 5; i++) {
          row.classList.remove(`jt-item-under-level-${i}`);
        }
        // Add the parent group's level
        row.classList.add(`jt-item-under-level-${parentGroup.level}`);
      }
    });
  }

  // Remove all shading classes
  function removeAllShading() {
    // Remove group shading
    for (let i = 1; i <= 5; i++) {
      const shadedElements = document.querySelectorAll(`.jt-group-level-${i}`);
      shadedElements.forEach(el => {
        el.classList.remove(`jt-group-level-${i}`);
      });
    }

    // Remove item shading
    removeAllItemShading();
  }

  // Start observing for new groups
  function startObserver() {
    if (observer) return;

    let reapplyTimeout = null;
    let themeRefreshTimeout = null;

    observer = new MutationObserver((mutations) => {
      if (!isActive) return;

      // Check if any changes warrant reapplying shading
      let shouldReapply = false;
      let shouldRefreshTheme = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check if theme styles were added/removed (dark mode or custom theme toggled)
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // Check if dark mode or custom theme CSS was injected
              if (node.id === 'jt-dark-mode-styles' || node.id === 'jt-custom-theme-styles') {
                console.log('BudgetHierarchy: Theme style detected, refreshing shading');
                shouldRefreshTheme = true;
              }

              // Check if budget rows were added
              if (node.classList?.contains('font-bold') ||
                  node.classList?.contains('group/row') ||
                  node.querySelector?.('div.font-bold.flex[style*="width: 300px"]') ||
                  node.querySelector?.('.group\\/row')) {
                shouldReapply = true;
              }
            }
          });

          // Check if theme styles were removed
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Check if dark mode or custom theme CSS was removed
              if (node.id === 'jt-dark-mode-styles' || node.id === 'jt-custom-theme-styles') {
                console.log('BudgetHierarchy: Theme style removed, refreshing shading');
                shouldRefreshTheme = true;
              }

              // Check if rows were removed (collapse scenario)
              if (node.classList?.contains('group/row')) {
                shouldReapply = true;
              }
            }
          });
        }

        // Watch for attribute changes (like style or class changes on expand/collapse)
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.classList?.contains('group/row') ||
              target.querySelector?.('.group\\/row')) {
            shouldReapply = true;
          }
        }
      }

      // If theme changed, refresh everything with new colors
      if (shouldRefreshTheme) {
        if (themeRefreshTimeout) clearTimeout(themeRefreshTimeout);
        themeRefreshTimeout = setTimeout(() => {
          refreshShading();
        }, 50);
      }
      // Otherwise just reapply shading if needed
      else if (shouldReapply) {
        // Debounce reapply to avoid excessive calls
        if (reapplyTimeout) clearTimeout(reapplyTimeout);
        reapplyTimeout = setTimeout(() => {
          applyGroupShading();
        }, 50); // 50ms debounce
      }
    });

    // Observe the entire document for changes with more aggressive options
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Also observe head for style injection (dark mode, custom theme)
    observer.observe(document.head, {
      childList: true,
      subtree: false
    });

    // Add click listener for expand/collapse buttons to force immediate reapply
    clickController = new AbortController();
    document.body.addEventListener('click', (e) => {
      if (!isActive) return;

      // Check if the click was on or near a collapse/expand button
      const target = e.target;
      const isExpandCollapseButton = target.closest('button')?.querySelector('svg') ||
                                     target.closest('svg')?.closest('button');

      if (isExpandCollapseButton) {
        // Force reapply after a short delay to let DOM update
        setTimeout(() => {
          applyGroupShading();
        }, 100);
      }
    }, { signal: clickController.signal });
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
