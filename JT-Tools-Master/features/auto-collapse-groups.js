// Auto-Collapse Full Groups Feature Module
// Automatically collapses groups that are 100% complete on initial page load
// Works for both Gantt/Schedule views and List views

const AutoCollapseGroupsFeature = (() => {
  let isActive = false;
  let observer = null;
  let initialCollapseApplied = false;
  let collapseTimeout = null;

  // Detect if we're in Gantt/Schedule view or List view
  function detectViewType() {
    // Gantt view has sticky z-10 elements with specific structure
    const ganttHeader = document.querySelector('div.shrink-0.sticky.z-10.flex.items-center.border-b input[value*="%"]');
    if (ganttHeader) {
      return 'gantt';
    }

    // List view has group/row elements with different structure
    const listRow = document.querySelector('div.group\\/row, [class*="group/row"]');
    if (listRow) {
      return 'list';
    }

    return null;
  }

  // Check if we're on a schedule/tasks page
  function isOnSchedulePage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('/schedule') ||
           path.includes('/tasks') ||
           path.includes('/to-dos') ||
           path.includes('/todos');
  }

  // Get all group rows in Gantt view
  function getGanttGroupRows() {
    // Gantt groups have a specific structure with font-bold and expand/collapse buttons
    const rows = [];

    // Find rows that have the progress input field (groups show percentage)
    const progressInputs = document.querySelectorAll('div.shrink-0.sticky.z-10 input[value*="%"]');

    progressInputs.forEach(input => {
      // Find the parent row
      const row = input.closest('div.flex.min-w-max');
      if (row && !rows.includes(row)) {
        rows.push(row);
      }
    });

    return rows;
  }

  // Get all group rows in List view
  function getListGroupRows() {
    const rows = [];

    // List view groups have font-bold styling and specific structure
    const allRows = document.querySelectorAll('div.group\\/row, [class*="group/row"]');

    allRows.forEach(row => {
      // Check if this is a group row (has font-bold cells)
      const fontBoldCell = row.querySelector('div.font-bold');
      if (fontBoldCell) {
        rows.push(row);
      }
    });

    return rows;
  }

  // Check if a Gantt group is 100% complete
  function isGanttGroupComplete(row) {
    // Look for the progress input with "100%" value
    const progressInput = row.querySelector('input[value="100%"]');
    return !!progressInput;
  }

  // Check if a List group is 100% complete
  function isListGroupComplete(row) {
    // Method 1: Check for checkmark SVG (child groups with complete status)
    // The checkmark has paths: "M21.801 10A10 10 0 1 1 17 3.335" and "m9 11 3 3L22 4"
    const checkmarkPath = row.querySelector('path[d="m9 11 3 3L22 4"]');
    if (checkmarkPath) {
      // Make sure it's in the status column (blue circle with check)
      const parentSvg = checkmarkPath.closest('svg');
      if (parentSvg && parentSvg.classList.contains('text-blue-500')) {
        return true;
      }
    }

    // Method 2: Check for "100%" text (parent groups show percentage)
    // Look in the name cell area for percentage text
    const nameCells = row.querySelectorAll('div.font-bold');
    for (const cell of nameCells) {
      const percentText = cell.querySelector('div.text-gray-400');
      if (percentText && percentText.textContent.trim() === '100%') {
        return true;
      }
    }

    return false;
  }

  // Check if a group is currently expanded
  function isGroupExpanded(row) {
    // Look for the expand/collapse chevron button
    // Expanded: has rotate-90 class
    // Collapsed: no rotation
    const chevron = row.querySelector('svg path[d="m9 18 6-6-6-6"]');
    if (chevron) {
      const svg = chevron.closest('svg');
      return svg && svg.classList.contains('rotate-90');
    }

    // Gantt view uses different chevron path
    const ganttChevron = row.querySelector('svg path[d="m6 9 6 6 6-6"]');
    if (ganttChevron) {
      // In Gantt, check if children are visible
      return true; // Gantt groups are expanded by default
    }

    return true; // Assume expanded if we can't determine
  }

  // Collapse a group by clicking its toggle button
  function collapseGroup(row) {
    // Find the expand/collapse button
    const toggleButton = row.querySelector('div[role="button"] svg path[d="m9 18 6-6-6-6"]')?.closest('[role="button"]') ||
                         row.querySelector('button svg path[d="m9 18 6-6-6-6"]')?.closest('button') ||
                         row.querySelector('[tabindex="-1"][role="button"]:has(svg path[d="m9 18 6-6-6-6"])') ||
                         row.querySelector('div[tabindex="-1"][role="button"] svg.transition')?.closest('[role="button"]');

    if (!toggleButton) {
      // Try Gantt view toggle button
      const ganttToggle = row.querySelector('div[role="button"] svg path[d="m6 9 6 6 6-6"]')?.closest('[role="button"]');
      if (ganttToggle) {
        ganttToggle.click();
        return true;
      }
      return false;
    }

    // Only collapse if currently expanded
    const svg = toggleButton.querySelector('svg');
    if (svg && svg.classList.contains('rotate-90')) {
      toggleButton.click();
      return true;
    }

    return false;
  }

  // Process all groups and collapse complete ones
  function processGroups() {
    if (!isActive) return;

    const viewType = detectViewType();
    if (!viewType) {
      // Not in a supported view, try again later
      return;
    }

    let collapsedCount = 0;

    if (viewType === 'gantt') {
      const groups = getGanttGroupRows();
      groups.forEach(row => {
        if (isGanttGroupComplete(row) && isGroupExpanded(row)) {
          if (collapseGroup(row)) {
            collapsedCount++;
          }
        }
      });
    } else if (viewType === 'list') {
      const groups = getListGroupRows();
      groups.forEach(row => {
        if (isListGroupComplete(row) && isGroupExpanded(row)) {
          if (collapseGroup(row)) {
            collapsedCount++;
          }
        }
      });
    }

    if (collapsedCount > 0) {
      console.log(`AutoCollapseGroups: Collapsed ${collapsedCount} complete group(s)`);
    }
  }

  // Wait for groups to be rendered then apply collapse
  function applyInitialCollapse() {
    if (!isActive || initialCollapseApplied) return;

    // Clear any pending timeout
    if (collapseTimeout) {
      clearTimeout(collapseTimeout);
    }

    // Wait for DOM to settle after page load
    collapseTimeout = setTimeout(() => {
      const viewType = detectViewType();
      if (viewType) {
        initialCollapseApplied = true;
        processGroups();
        console.log('AutoCollapseGroups: Initial collapse applied');
      } else {
        // View not ready yet, try again
        collapseTimeout = setTimeout(() => applyInitialCollapse(), 500);
      }
    }, 800); // Give time for groups to render
  }

  // Start observing for page navigation (SPA)
  function startObserver() {
    if (observer) return;

    let navigationTimeout = null;

    observer = new MutationObserver((mutations) => {
      if (!isActive) return;

      // Check for significant DOM changes that might indicate navigation
      let significantChange = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              // Check if schedule/group content was added
              if (node.classList?.contains('group/row') ||
                  node.querySelector?.('.group\\/row') ||
                  node.querySelector?.('[class*="group/row"]') ||
                  node.querySelector?.('input[value*="%"]')) {
                significantChange = true;
                break;
              }
            }
          }
        }
        if (significantChange) break;
      }

      if (significantChange && !initialCollapseApplied) {
        // Debounce to avoid multiple triggers
        if (navigationTimeout) {
          clearTimeout(navigationTimeout);
        }
        navigationTimeout = setTimeout(() => {
          applyInitialCollapse();
        }, 300);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Listen for URL changes (for SPA navigation)
  function setupNavigationListener() {
    // Only track pathname changes, not query params or hash
    // This prevents re-collapse when clicking on tasks (which adds task ID to URL)
    let lastPathname = window.location.pathname;

    const checkUrl = () => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        initialCollapseApplied = false;

        // Only apply collapse on schedule pages
        if (isOnSchedulePage()) {
          applyInitialCollapse();
        }
      }
    };

    // Check periodically for URL changes (handles pushState)
    setInterval(checkUrl, 500);

    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', () => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        initialCollapseApplied = false;
        if (isOnSchedulePage()) {
          applyInitialCollapse();
        }
      }
    });
  }

  // Initialize the feature
  function init() {
    if (isActive) return;

    isActive = true;
    initialCollapseApplied = false;

    console.log('AutoCollapseGroups: Initializing...');

    // Set up navigation listener for SPA
    setupNavigationListener();

    // Start DOM observer
    startObserver();

    // Apply initial collapse if on schedule page
    if (isOnSchedulePage()) {
      applyInitialCollapse();
    }

    console.log('AutoCollapseGroups: Initialized');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) return;

    isActive = false;
    initialCollapseApplied = false;

    if (collapseTimeout) {
      clearTimeout(collapseTimeout);
      collapseTimeout = null;
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    console.log('AutoCollapseGroups: Cleanup complete');
  }

  return {
    init,
    cleanup,
    isActive: () => isActive,
    // Expose for manual triggering if needed
    processGroups
  };
})();

// Make available globally
window.AutoCollapseGroupsFeature = AutoCollapseGroupsFeature;
