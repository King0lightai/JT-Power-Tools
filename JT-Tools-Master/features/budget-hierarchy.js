// JobTread Budget Group Hierarchy Shading Feature Module
// Applies progressive shading to nested budget groups (up to 5 levels)
// Level 1 (top) = Darkest, Level 5 (deepest) = Lightest

const BudgetHierarchyFeature = (() => {
  let isActive = false;
  let styleElement = null;
  let observer = null;

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
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = 'jt-budget-hierarchy-styles';
    styleElement.textContent = `
      /* Budget Group Hierarchy Shading */
      /* Level 1 = Darkest (Top level groups) */
      /* Level 5 = Lightest (Deepest nested groups) */

      /* Light Mode Shading */
      .jt-group-level-1 { background-color: rgb(229, 231, 235) !important; } /* gray-200 */
      .jt-group-level-2 { background-color: rgb(243, 244, 246) !important; } /* gray-100 */
      .jt-group-level-3 { background-color: rgb(249, 250, 251) !important; } /* gray-50 */
      .jt-group-level-4 { background-color: rgb(255, 255, 255) !important; } /* white */
      .jt-group-level-5 { background-color: rgb(249, 250, 251) !important; } /* gray-50 lightest */

      /* Hover states */
      .jt-group-level-1:hover { background-color: rgb(209, 213, 219) !important; } /* gray-300 */
      .jt-group-level-2:hover { background-color: rgb(229, 231, 235) !important; } /* gray-200 */
      .jt-group-level-3:hover { background-color: rgb(243, 244, 246) !important; } /* gray-100 */
      .jt-group-level-4:hover { background-color: rgb(249, 250, 251) !important; } /* gray-50 */
      .jt-group-level-5:hover { background-color: rgb(243, 244, 246) !important; } /* gray-100 */

      /* Dark Mode Shading (when dark mode is active) */
      [data-theme="dark"] .jt-group-level-1 { background-color: rgb(55, 65, 81) !important; } /* gray-700 */
      [data-theme="dark"] .jt-group-level-2 { background-color: rgb(75, 85, 99) !important; } /* gray-600 */
      [data-theme="dark"] .jt-group-level-3 { background-color: rgb(107, 114, 128) !important; } /* gray-500 */
      [data-theme="dark"] .jt-group-level-4 { background-color: rgb(156, 163, 175) !important; } /* gray-400 */
      [data-theme="dark"] .jt-group-level-5 { background-color: rgb(209, 213, 219) !important; } /* gray-300 */

      /* Dark mode hover states */
      [data-theme="dark"] .jt-group-level-1:hover { background-color: rgb(31, 41, 55) !important; } /* gray-800 */
      [data-theme="dark"] .jt-group-level-2:hover { background-color: rgb(55, 65, 81) !important; } /* gray-700 */
      [data-theme="dark"] .jt-group-level-3:hover { background-color: rgb(75, 85, 99) !important; } /* gray-600 */
      [data-theme="dark"] .jt-group-level-4:hover { background-color: rgb(107, 114, 128) !important; } /* gray-500 */
      [data-theme="dark"] .jt-group-level-5:hover { background-color: rgb(156, 163, 175) !important; } /* gray-400 */

      /* Apply shading to all cells in the group row */
      .jt-group-level-1 > div,
      .jt-group-level-2 > div,
      .jt-group-level-3 > div,
      .jt-group-level-4 > div,
      .jt-group-level-5 > div {
        background-color: inherit !important;
      }
    `;

    document.head.appendChild(styleElement);
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
    isActive: () => isActive
  };
})();

// Make available globally
window.BudgetHierarchyFeature = BudgetHierarchyFeature;
