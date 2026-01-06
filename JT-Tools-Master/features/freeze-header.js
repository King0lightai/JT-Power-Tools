// JT Power Tools - Freeze Header Feature
// Makes job header and navigation tabs sticky when scrolling on job pages

const FreezeHeaderFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let styleElement = null;
  let debounceTimer = null;
  let popupObserver = null;

  // CSS for sticky header - targets the specific JobTread structure
  const STICKY_STYLES = `
    /* Freeze Header Styles */

    /* Top header bar - already sticky in JobTread by default (z-[41], top: 0) */
    /* We only mark it with .jt-top-header to measure its height for positioning other elements */
    /* No CSS overrides needed - leave it as JobTread styled it */

    /* Tab navigation bar - stick below the top header */
    .jt-freeze-header-active .jt-job-tabs-container {
      position: sticky !important;
      top: var(--jt-header-height, 50px) !important;
      z-index: 40 !important;
      background-color: white !important;
      box-shadow: 0 1px 0 0 white !important;
    }

    /* Action toolbar bar - stick below the tabs (filters, search, view controls) */
    .jt-freeze-header-active .jt-action-toolbar {
      position: sticky !important;
      top: var(--jt-tabs-bottom, 90px) !important;
      z-index: 39 !important;
      background-color: white !important;
      box-shadow: 0 1px 0 0 white !important;
    }

    /* Budget table header container - JobTread already makes this sticky,
       but we need to override its top position to account for our frozen headers */
    .jt-freeze-header-active .jt-budget-header-container {
      top: var(--jt-toolbar-bottom, 138px) !important;
    }

    /* Ensure budget header children have white background */
    .jt-freeze-header-active .jt-budget-header-container .flex.min-w-max > div {
      background-color: white !important;
    }

    /* Schedule header container - same approach as budget header */
    .jt-freeze-header-active .jt-schedule-header-container {
      position: sticky !important;
      top: var(--jt-toolbar-bottom, 138px) !important;
      z-index: 30 !important;
      background-color: white !important;
    }

    /* Ensure schedule/task list header children have white background */
    .jt-freeze-header-active .jt-schedule-header-container > div {
      background-color: white !important;
    }

    /* Files page folder navigation bar (All Files breadcrumb) */
    .jt-freeze-header-active .jt-files-folder-bar {
      position: sticky !important;
      top: var(--jt-toolbar-bottom, 138px) !important;
      z-index: 38 !important;
      background-color: white !important;
    }

    /* Files page list header (Name, Related To, Tags, etc.) */
    .jt-freeze-header-active .jt-files-list-header {
      position: sticky !important;
      top: var(--jt-files-folder-bottom, 170px) !important;
      z-index: 37 !important;
      background-color: white !important;
    }

    /* Ensure files list header children have white background */
    .jt-freeze-header-active .jt-files-list-header > div {
      background-color: white !important;
    }

    /* Files page left sidebar (Documents, Daily Logs, Tasks, Tags, Type filters) */
    .jt-freeze-header-active .jt-files-sidebar {
      top: var(--jt-toolbar-bottom, 138px) !important;
    }

    /* Files page left sidebar - direct selector for sidebars using overflow-auto (not overflow-y-auto) */
    /* This catches the filter sidebar that has inline top: 48px and overflow-auto */
    /* Also set max-height to prevent sidebar from extending past viewport when top is adjusted */
    .jt-freeze-header-active div.sticky.border-r.w-64.overflow-auto.overscroll-contain {
      top: var(--jt-toolbar-bottom, 138px) !important;
      max-height: calc(100vh - var(--jt-toolbar-bottom, 138px)) !important;
    }

    /* Right-side sidebars (Daily Log, Task Details, Job Switcher, etc.) */
    /* All sidebars get z-index 41 to appear above frozen tabs (40) and toolbar (39) */
    .jt-freeze-header-active [data-is-drag-scroll-boundary="true"] {
      z-index: 41 !important;
    }

    /* Sticky scroll containers with overscroll-contain (sidebar panels like Cost Item Details) */
    /* These sidebars don't use data-is-drag-scroll-boundary but need positioning below frozen headers */
    /* Adjust top position to be below the frozen toolbar, not just below the main header */
    /* EXCLUDE global sidebars (Time Clock, Daily Log) which should stay at native header-level position */
    .jt-freeze-header-active div.sticky.overflow-y-auto.overscroll-contain:not(.jt-global-sidebar) {
      top: var(--jt-toolbar-bottom, 138px) !important;
      z-index: 41 !important;
    }

    /* Global sidebars (Time Clock, Daily Log) - keep at native position just below main header */
    .jt-freeze-header-active .jt-global-sidebar {
      /* Don't override top position - let it stay at native ~48px */
      z-index: 41 !important;
    }

    /* Main content area should have lower z-index than sidebars */
    /* Target the container that holds both content and sidebars */
    .jt-freeze-header-active .relative.grow.min-w-0.flex.flex-col {
      z-index: 0;
    }

    /* Ensure sidebars within this container still have high z-index */
    .jt-freeze-header-active .relative.grow.min-w-0.flex.flex-col > [data-is-drag-scroll-boundary="true"],
    .jt-freeze-header-active .relative.grow.min-w-0.flex.flex-col > .z-30.absolute {
      z-index: 41 !important;
    }

    /* Sidebar inner sticky elements - position below frozen toolbar */
    /* Only apply to job-page sidebars, NOT global overlays like Time Clock */
    /* Global sidebars have top: ~48px (just below header), job sidebars have top: ~100px+ (below tabs) */
    /* We exclude sidebars with top: 48-50px as these are global overlays that should stay at header level */
    /* We also exclude sidebar headers with top: 0 (e.g., "COST ITEM DETAILS", "Update Task") */
    /* We also exclude popups/modals (identified by shadow-lg, max-w-lg, m-auto, rounded-sm patterns) */
    /* We also exclude thead elements and z-10 elements (internal table headers like Availability view) */
    /* These excluded elements keep their native JobTread positioning */
    .jt-freeze-header-active [data-is-drag-scroll-boundary="true"] .sticky:not([style*="top: 0"]):not([style*="top: 48"]):not([style*="top: 49"]):not([style*="top: 50"]):not(.jt-popup-sticky):not(thead):not(.z-10) {
      top: var(--jt-toolbar-bottom, 138px) !important;
    }

    /* Exclude popup/modal sticky elements from freeze header positioning */
    /* Popups have characteristic classes: shadow-lg, max-w-*, m-auto, rounded-sm, border-t-jtOrange */
    .jt-freeze-header-active .shadow-lg.rounded-sm .sticky,
    .jt-freeze-header-active .max-w-lg .sticky,
    .jt-freeze-header-active .max-w-screen-lg .sticky,
    .jt-freeze-header-active .max-w-screen-xl .sticky,
    .jt-freeze-header-active .max-w-screen-2xl .sticky,
    .jt-freeze-header-active [class*="m-auto"][class*="shadow-lg"] .sticky,
    .jt-freeze-header-active .border-t-jtOrange ~ * .sticky,
    .jt-freeze-header-active .jt-popup-container .sticky {
      top: 0px !important;
    }

    /* Popup sticky elements with bottom positioning should also be preserved */
    .jt-freeze-header-active .shadow-lg.rounded-sm .sticky[style*="bottom"],
    .jt-freeze-header-active [class*="max-w-"] .sticky[style*="bottom"] {
      bottom: 0px !important;
      top: unset !important;
    }

    /* When a popup is in fullscreen mode, ensure its sticky elements stay at top: 0 */
    .jt-fullscreen-popup .sticky {
      top: 0px !important;
    }

    /* Reset nested sticky headers inside sidebar scroll containers to top: 0 */
    /* These are headers like "Update Task" that should stick at the top of their scrollable parent */
    /* Note: Repeated attribute selector boosts specificity to beat the :not() selectors above */
    .jt-freeze-header-active [data-is-drag-scroll-boundary="true"][data-is-drag-scroll-boundary="true"][data-is-drag-scroll-boundary="true"] .sticky .sticky {
      top: 0px !important;
    }

    /* Reset sticky headers inside overscroll-contain sidebar panels (Cost Item Details header) */
    /* The inner sticky header should stay at top: 0 relative to its scroll container */
    .jt-freeze-header-active div.sticky.overflow-y-auto.overscroll-contain > .sticky {
      top: 0px !important;
    }

    /* The inner flex container with the actual tabs */
    .jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b {
      background-color: white !important;
    }

    /* Ensure the tabs have proper background */
    .jt-freeze-header-active .jt-job-tabs-container a {
      background-color: inherit;
    }

    /* Active tab styling preserved */
    .jt-freeze-header-active .jt-job-tabs-container a.bg-gray-50 {
      background-color: rgb(249, 250, 251) !important;
    }

    /* Dark mode compatibility - uses body.jt-dark-mode class added by dark-mode.js */
    /* Note: Both classes are on body, so use body.class1.class2 (no space) */
    /* Note: .jt-top-header excluded - dark mode feature handles it directly */
    body.jt-dark-mode.jt-freeze-header-active .jt-job-tabs-container,
    body.jt-dark-mode.jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b,
    body.jt-dark-mode.jt-freeze-header-active .jt-action-toolbar,
    body.jt-dark-mode.jt-freeze-header-active .jt-budget-header-container .flex.min-w-max > div,
    body.jt-dark-mode.jt-freeze-header-active .jt-schedule-header-container,
    body.jt-dark-mode.jt-freeze-header-active .jt-schedule-header-container > div,
    body.jt-dark-mode.jt-freeze-header-active .jt-files-folder-bar,
    body.jt-dark-mode.jt-freeze-header-active .jt-files-list-header,
    body.jt-dark-mode.jt-freeze-header-active .jt-files-list-header > div,
    body.jt-dark-mode.jt-freeze-header-active .jt-files-sidebar,
    body.jt-dark-mode.jt-freeze-header-active div.sticky.border-r.w-64.overflow-auto.overscroll-contain {
      background-color: #2c2c2c !important;
      border-color: #464646 !important;
    }

    /* Dark mode box-shadow for gap coverage */
    body.jt-dark-mode.jt-freeze-header-active .jt-job-tabs-container,
    body.jt-dark-mode.jt-freeze-header-active .jt-action-toolbar {
      box-shadow: 0 1px 0 0 #2c2c2c !important;
    }

    body.jt-dark-mode.jt-freeze-header-active .jt-job-tabs-container a {
      color: #e5e7eb !important;
    }

    /* Active tab in dark mode */
    body.jt-dark-mode.jt-freeze-header-active .jt-job-tabs-container a.bg-gray-50 {
      background-color: #353535 !important;
    }

    /* Custom theme compatibility - uses body.jt-custom-theme class added by rgb-theme.js */
    /* Note: Both classes are on body, so use body.class1.class2 (no space) */
    /* Note: .jt-top-header excluded - custom theme feature handles it directly */
    body.jt-custom-theme.jt-freeze-header-active .jt-job-tabs-container,
    body.jt-custom-theme.jt-freeze-header-active .jt-job-tabs-container > .flex.overflow-auto.border-b,
    body.jt-custom-theme.jt-freeze-header-active .jt-action-toolbar,
    body.jt-custom-theme.jt-freeze-header-active .jt-budget-header-container .flex.min-w-max > div,
    body.jt-custom-theme.jt-freeze-header-active .jt-schedule-header-container,
    body.jt-custom-theme.jt-freeze-header-active .jt-schedule-header-container > div,
    body.jt-custom-theme.jt-freeze-header-active .jt-files-folder-bar,
    body.jt-custom-theme.jt-freeze-header-active .jt-files-list-header,
    body.jt-custom-theme.jt-freeze-header-active .jt-files-list-header > div,
    body.jt-custom-theme.jt-freeze-header-active .jt-files-sidebar,
    body.jt-custom-theme.jt-freeze-header-active div.sticky.border-r.w-64.overflow-auto.overscroll-contain {
      background-color: var(--jt-theme-background, white) !important;
    }

    /* Custom theme box-shadow for gap coverage */
    body.jt-custom-theme.jt-freeze-header-active .jt-job-tabs-container,
    body.jt-custom-theme.jt-freeze-header-active .jt-action-toolbar {
      box-shadow: 0 1px 0 0 var(--jt-theme-background, white) !important;
    }

    /* Active tab in custom theme */
    body.jt-custom-theme.jt-freeze-header-active .jt-job-tabs-container a.bg-gray-50 {
      background-color: var(--jt-theme-background, white) !important;
      filter: brightness(0.95);
    }
  `;

  /**
   * Inject CSS styles for sticky header
   */
  function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = 'jt-freeze-header-styles';
    styleElement.textContent = STICKY_STYLES;
    document.head.appendChild(styleElement);
    console.log('FreezeHeader: Styles injected');
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
      console.log('FreezeHeader: Styles removed');
    }
  }

  /**
   * Check if we're on a job page
   */
  function isJobPage() {
    return window.location.pathname.match(/^\/jobs\/[^/]+/);
  }

  /**
   * Check if we're on any files page (job-level or top-level)
   */
  function isFilesPage() {
    return window.location.pathname.match(/\/files/) ||
           window.location.pathname.match(/^\/jobs\/[^/]+\/files/);
  }

  /**
   * Check if we're on the budget page
   */
  function isBudgetPage() {
    return window.location.pathname.match(/^\/jobs\/[^/]+\/budget/);
  }

  /**
   * Check if we're on the schedule page
   */
  function isSchedulePage() {
    return window.location.pathname.match(/^\/jobs\/[^/]+\/schedule/);
  }

  /**
   * Check if an element is inside a popup container
   * Popups are identified by shadow-lg class on a container element
   * This is used to prevent marking elements inside popups with freeze header classes
   */
  function isInsidePopup(element) {
    // Check if element is inside a popup container
    // Popups typically have shadow-lg class combined with other styling
    const popupContainer = element.closest('.shadow-lg');
    if (!popupContainer) return false;

    // Make sure it's not the main content area (shadow-lg is also used elsewhere)
    // Popup containers typically have: shadow-lg + (rounded-sm or overflow-hidden) + (bg-white or border)
    // Also check if it's in a fixed/absolute positioned container (modal overlay)
    const hasPopupStyling = popupContainer.classList.contains('rounded-sm') ||
                           popupContainer.classList.contains('overflow-hidden') ||
                           popupContainer.closest('.fixed') ||
                           popupContainer.closest('[class*="m-auto"]');

    return hasPopupStyling;
  }

  /**
   * Find and mark the top header bar
   * Looking for: div.shrink-0.sticky with JobTread logo and search
   */
  function findAndMarkTopHeader() {
    // Already marked?
    if (document.querySelector('.jt-top-header')) {
      return true;
    }

    // Find the top header: div.shrink-0.sticky containing the JobTread logo SVG
    const stickyDivs = document.querySelectorAll('div.shrink-0.sticky');

    for (const div of stickyDivs) {
      // Check if it contains the JobTread logo (viewBox="0 0 120 18" is the text logo)
      const hasLogo = div.querySelector('svg[viewBox="0 0 120 18"]') ||
                      div.querySelector('svg[viewBox="0 0 8 8"]');
      // Also check for the search input with company name placeholder
      const hasSearch = div.querySelector('input[placeholder*="Search"]');

      if (hasLogo && hasSearch) {
        div.classList.add('jt-top-header');
        console.log('FreezeHeader: Found and marked top header');
        return true;
      }
    }

    // Fallback: look for the header with z-[41] class (JobTread's main header)
    const headerWithZ41 = document.querySelector('div.shrink-0.sticky.z-\\[41\\]');
    if (headerWithZ41) {
      headerWithZ41.classList.add('jt-top-header');
      console.log('FreezeHeader: Found top header via z-[41]');
      return true;
    }

    return false;
  }

  /**
   * Find and mark the job tabs container
   * Looking for: div.shrink-0 > div.flex.overflow-auto.border-b containing links to /jobs/
   */
  function findAndMarkTabs() {
    if (!isJobPage()) {
      console.log('FreezeHeader: Not on a job page, skipping tabs');
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-job-tabs-container')) {
      return true;
    }

    // Find the tab bar: look for div.shrink-0 containing div.flex.overflow-auto.border-b with job links
    const shrinkDivs = document.querySelectorAll('div.shrink-0');

    for (const div of shrinkDivs) {
      // Skip if this is already marked as something else
      if (div.classList.contains('jt-top-header')) continue;
      if (div.classList.contains('jt-action-toolbar')) continue;
      if (div.classList.contains('jt-budget-header-container')) continue;

      const tabContainer = div.querySelector('div.flex.overflow-auto.border-b');
      if (tabContainer) {
        // Verify it contains job navigation links
        const jobLinks = tabContainer.querySelectorAll('a[href^="/jobs/"]');
        if (jobLinks.length > 0) {
          // Check for typical tab names like Dashboard, Budget, Schedule
          const linkTexts = Array.from(jobLinks).map(a => a.textContent.trim().toLowerCase());
          const hasTypicalTabs = linkTexts.some(text =>
            ['dashboard', 'budget', 'schedule', 'messages', 'documents', 'to-dos'].includes(text)
          );

          if (hasTypicalTabs) {
            div.classList.add('jt-job-tabs-container');
            console.log('FreezeHeader: Found and marked job tabs container');
            return true;
          }
        }
      }
    }

    console.log('FreezeHeader: Job tabs container not found');
    return false;
  }

  /**
   * Find and mark the action toolbar (filters, search, view controls)
   * Looking for: div.shrink-0.sticky with z-30 and shadow-line-bottom, containing filters/search
   * Also handles Daily Logs and Files page action bars with different structure
   */
  function findAndMarkActionToolbar() {
    if (!isJobPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-action-toolbar')) {
      return true;
    }

    // Find action toolbars: div.shrink-0.sticky with z-30 class
    const toolbars = document.querySelectorAll('div.shrink-0.sticky.z-30, div.shrink-0.sticky.z-\\[30\\]');

    for (const toolbar of toolbars) {
      // Skip if already marked as something else
      if (toolbar.classList.contains('jt-top-header')) continue;
      if (toolbar.classList.contains('jt-job-tabs-container')) continue;
      if (toolbar.classList.contains('jt-budget-header-container')) continue;

      // Check if it contains typical toolbar elements (search, filters, view buttons)
      const hasSearch = toolbar.querySelector('input[placeholder="Search"]');
      const hasFilters = toolbar.querySelector('svg') && toolbar.querySelectorAll('[role="button"]').length > 2;

      if (hasSearch || hasFilters) {
        toolbar.classList.add('jt-action-toolbar');
        console.log('FreezeHeader: Found and marked action toolbar');
        return true;
      }
    }

    // Fallback: look for any sticky div with shadow-line-bottom and p-2 that has filter controls
    const shadowToolbars = document.querySelectorAll('div.shrink-0.sticky.shadow-line-bottom.p-2');
    for (const toolbar of shadowToolbars) {
      if (toolbar.classList.contains('jt-top-header')) continue;
      if (toolbar.classList.contains('jt-job-tabs-container')) continue;
      if (toolbar.classList.contains('jt-budget-header-container')) continue;

      // Verify it has multiple buttons (typical of action toolbar)
      const buttons = toolbar.querySelectorAll('[role="button"]');
      if (buttons.length >= 3) {
        toolbar.classList.add('jt-action-toolbar');
        console.log('FreezeHeader: Found action toolbar via shadow-line-bottom');
        return true;
      }
    }

    // Check for Daily Logs / Files page action bars
    // These use div.p-2 > div.relative > div.absolute.inset-0.flex structure
    const p2Containers = document.querySelectorAll('div.p-2');
    for (const container of p2Containers) {
      // Skip if already marked
      if (container.classList.contains('jt-action-toolbar')) continue;

      // Check for the specific structure: div.relative > div.absolute.inset-0.flex
      const relativeDiv = container.querySelector(':scope > div.relative');
      if (!relativeDiv) continue;

      const absoluteToolbar = relativeDiv.querySelector(':scope > div.absolute.inset-0.flex');
      if (!absoluteToolbar) continue;

      // Verify it's an action bar by checking for:
      // - Daily logs: links to /daily-logs with Details/Calendar tabs
      // - Files: Upload button, List/Grid toggles
      const hasDailyLogsLinks = absoluteToolbar.querySelector('a[href*="/daily-logs"]');
      const hasUploadButton = absoluteToolbar.textContent.includes('Upload');
      const hasListGridToggle = absoluteToolbar.textContent.includes('List') && absoluteToolbar.textContent.includes('Grid');
      const hasSearchInput = absoluteToolbar.querySelector('input[placeholder="Search"]');

      if (hasDailyLogsLinks || hasUploadButton || hasListGridToggle || hasSearchInput) {
        container.classList.add('jt-action-toolbar');
        console.log('FreezeHeader: Found and marked page action toolbar (daily logs/files)');
        return true;
      }
    }

    // Check for Documents page action bar
    // Uses div.bg-white.p-2.flex with Documents/Payments/Cost Inbox links
    const docToolbars = document.querySelectorAll('div.bg-white.p-2.flex');
    for (const toolbar of docToolbars) {
      // Skip if already marked
      if (toolbar.classList.contains('jt-action-toolbar')) continue;

      // Check for Documents tab links
      const hasDocumentsLink = toolbar.querySelector('a[href*="/documents"]');
      const hasPaymentsLink = toolbar.querySelector('a[href*="/payments"]');
      const hasCostInboxLink = toolbar.querySelector('a[href*="/cost-inbox"]');
      const hasSearchInput = toolbar.querySelector('input[placeholder="Search"]');

      if ((hasDocumentsLink || hasPaymentsLink || hasCostInboxLink) && hasSearchInput) {
        toolbar.classList.add('jt-action-toolbar');
        console.log('FreezeHeader: Found and marked documents page action toolbar');
        return true;
      }
    }

    return false;
  }

  /**
   * Find and mark the budget table header container
   * Looking for: div.sticky.z-30.break-inside-avoid that contains the budget header rows
   * JobTread already makes this sticky but with a hardcoded top value we need to override
   */
  function findAndMarkBudgetTableHeader() {
    if (!isBudgetPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-budget-header-container')) {
      return true;
    }

    // Find the sticky container that holds the budget header
    // It's div.sticky.z-30.break-inside-avoid containing div.flex.min-w-max with border-b-4
    const stickyContainers = document.querySelectorAll('div.sticky.z-30.break-inside-avoid');

    for (const container of stickyContainers) {
      // Skip if already marked as something else
      if (container.classList.contains('jt-top-header')) continue;
      if (container.classList.contains('jt-job-tabs-container')) continue;
      if (container.classList.contains('jt-action-toolbar')) continue;

      // Check if it contains the budget header structure (flex.min-w-max with border-b-4 children)
      const flexContainer = container.querySelector('div.flex.min-w-max');
      if (flexContainer) {
        const borderChildren = flexContainer.querySelectorAll(':scope > div.border-b-4');
        if (borderChildren.length > 0) {
          // Check for typical header text like "Details", "Estimating"
          const headerText = container.textContent.toLowerCase();
          if (headerText.includes('details') || headerText.includes('estimating') || headerText.includes('name')) {
            container.classList.add('jt-budget-header-container');
            console.log('FreezeHeader: Found and marked budget header container');
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Find and mark the schedule header container (Gantt view only)
   * Looking for: div.sticky.z-30 with bg-gray-700 dark header cells and month names
   * JobTread already makes this sticky but with a hardcoded top value we need to override
   */
  function findAndMarkScheduleHeader() {
    if (!isSchedulePage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-schedule-header-container')) {
      return true;
    }

    // Find sticky z-30 containers that contain the schedule header
    const stickyContainers = document.querySelectorAll('div.sticky.z-30');

    for (const container of stickyContainers) {
      // Skip if already marked as something else
      if (container.classList.contains('jt-top-header')) continue;
      if (container.classList.contains('jt-job-tabs-container')) continue;
      if (container.classList.contains('jt-action-toolbar')) continue;
      if (container.classList.contains('jt-budget-header-container')) continue;

      const headerText = container.textContent;

      // Check for GANTT VIEW: bg-gray-700 header cells with "Name" column and month names
      const darkHeaderCells = container.querySelectorAll('.bg-gray-700');
      if (darkHeaderCells.length > 0) {
        // Verify it has schedule-like content (month names or year)
        const hasGanttContent = headerText.includes('Name') &&
          (headerText.includes('2025') || headerText.includes('2026') || headerText.includes('2027') ||
           /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(headerText));

        if (hasGanttContent) {
          container.classList.add('jt-schedule-header-container');
          console.log('FreezeHeader: Found and marked schedule header container (gantt view)');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find and mark generic list headers (To-Do, Schedule list view, etc.)
   * Looking for: div.sticky.z-30 with div.flex.min-w-max containing Name + Due/Start/End columns
   * Works on any job page
   */
  function findAndMarkListHeader() {
    if (!isJobPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-schedule-header-container')) {
      return true;
    }

    // Find sticky z-30 containers that could be list headers
    const stickyContainers = document.querySelectorAll('div.sticky.z-30');

    for (const container of stickyContainers) {
      // Skip if already marked as something else
      if (container.classList.contains('jt-top-header')) continue;
      if (container.classList.contains('jt-job-tabs-container')) continue;
      if (container.classList.contains('jt-action-toolbar')) continue;
      if (container.classList.contains('jt-budget-header-container')) continue;
      if (container.classList.contains('jt-schedule-header-container')) continue;

      const headerText = container.textContent;

      // Look for a flex container with min-w-max that has list column headers
      const flexContainer = container.querySelector('div.flex.min-w-max');
      if (flexContainer) {
        // Check for LIST VIEW: has Name + Start/End columns (schedule list)
        const hasScheduleListColumns = headerText.includes('Name') &&
          headerText.includes('Start') &&
          headerText.includes('End') &&
          (headerText.includes('Type') || headerText.includes('Assignees'));

        // Check for TASK/TODO LIST VIEW: has Name + Due columns
        const hasTaskListColumns = headerText.includes('Name') &&
          headerText.includes('Due') &&
          (headerText.includes('Type') || headerText.includes('Assignees'));

        if (hasScheduleListColumns || hasTaskListColumns) {
          container.classList.add('jt-schedule-header-container');
          console.log('FreezeHeader: Found and marked list header container');
          return true;
        }
      }
    }

    // Check for standalone flex.min-w-max headers with sticky columns
    // These are headers where the container itself may not be sticky.z-30
    const flexHeaders = document.querySelectorAll('div.flex.min-w-max');
    for (const flexHeader of flexHeaders) {
      // Check if it has sticky z-10 children (typical of list headers)
      const stickyColumns = flexHeader.querySelectorAll(':scope > div.sticky.z-10');
      if (stickyColumns.length === 0) continue;

      // Skip if already marked or inside a marked container
      if (flexHeader.closest('.jt-schedule-header-container')) continue;
      if (flexHeader.closest('.jt-budget-header-container')) continue;

      const headerText = flexHeader.textContent;

      // Check for task/todo list headers with Name + Due or Name + Start/End
      const hasTaskColumns = headerText.includes('Name') &&
        (headerText.includes('Due') || (headerText.includes('Start') && headerText.includes('End')));

      if (hasTaskColumns) {
        // Find the parent sticky container or create marking on the flex header's parent
        let targetContainer = flexHeader.closest('div.sticky');
        if (!targetContainer) {
          // The flex header itself needs to be made sticky
          targetContainer = flexHeader;
        }

        if (!targetContainer.classList.contains('jt-schedule-header-container')) {
          targetContainer.classList.add('jt-schedule-header-container');
          console.log('FreezeHeader: Found and marked standalone list header');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find and mark the Files page folder navigation bar (All Files breadcrumb)
   * Looking for: div.sticky.z-30.flex.items-center with "All Files" or folder icon
   */
  function findAndMarkFilesFolderBar() {
    if (!isJobPage() && !isFilesPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-files-folder-bar')) {
      return true;
    }

    // Find sticky z-30 elements that look like folder navigation
    const stickyContainers = document.querySelectorAll('div.sticky.z-30.flex.items-center');

    for (const container of stickyContainers) {
      // Skip if already marked as something else
      if (container.classList.contains('jt-top-header')) continue;
      if (container.classList.contains('jt-job-tabs-container')) continue;
      if (container.classList.contains('jt-action-toolbar')) continue;
      if (container.classList.contains('jt-schedule-header-container')) continue;

      // Skip if inside a popup (e.g., files popup from budget view)
      if (isInsidePopup(container)) continue;

      const text = container.textContent;

      // Check for folder navigation indicators
      const hasFolderText = text.includes('All Files') || text.includes('Edit') && text.includes('Files');
      const hasFolderIcon = container.querySelector('svg path[d*="M20 20a2 2 0 0 0 2-2V8"]'); // Folder icon path

      if (hasFolderText || hasFolderIcon) {
        container.classList.add('jt-files-folder-bar');
        console.log('FreezeHeader: Found and marked files folder bar');
        return true;
      }
    }

    return false;
  }

  /**
   * Find and mark the Files page list header container (Name, Related To, Tags, etc.)
   * Looking for: div.sticky.z-30.shadow-line-bottom containing file list columns
   * Need to mark the outer sticky container, not the inner flex header
   */
  function findAndMarkFilesListHeader() {
    if (!isJobPage() && !isFilesPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-files-list-header')) {
      return true;
    }

    // Find sticky containers with z-30 and shadow-line-bottom (typical of file list header containers)
    const stickyContainers = document.querySelectorAll('div.sticky.z-30.shadow-line-bottom');

    for (const container of stickyContainers) {
      // Skip if already marked as something else
      if (container.classList.contains('jt-top-header')) continue;
      if (container.classList.contains('jt-job-tabs-container')) continue;
      if (container.classList.contains('jt-action-toolbar')) continue;
      if (container.classList.contains('jt-schedule-header-container')) continue;

      // Skip if inside a popup (e.g., files popup from budget view)
      if (isInsidePopup(container)) continue;

      const headerText = container.textContent;

      // Check for file list column headers
      const hasFileColumns = headerText.includes('Name') &&
        (headerText.includes('Related To') || headerText.includes('Tags') ||
         headerText.includes('Uploaded By') || headerText.includes('Uploaded At') ||
         headerText.includes('Folder') || headerText.includes('Type'));

      if (hasFileColumns) {
        container.classList.add('jt-files-list-header');
        console.log('FreezeHeader: Found and marked files list header container');
        return true;
      }
    }

    // Fallback: Find flex headers and mark their sticky parent
    const flexHeaders = document.querySelectorAll('div.flex.min-w-max.text-xs.font-semibold');

    for (const flexHeader of flexHeaders) {
      // Skip if already inside a marked container
      if (flexHeader.closest('.jt-files-list-header')) continue;
      if (flexHeader.closest('.jt-schedule-header-container')) continue;
      if (flexHeader.closest('.jt-budget-header-container')) continue;

      // Skip if inside a popup (e.g., files popup from budget view)
      if (isInsidePopup(flexHeader)) continue;

      const headerText = flexHeader.textContent;

      // Check for file list column headers
      const hasFileColumns = headerText.includes('Name') &&
        (headerText.includes('Related To') || headerText.includes('Tags') ||
         headerText.includes('Uploaded By') || headerText.includes('Uploaded At'));

      if (hasFileColumns) {
        // Try to find the sticky parent container
        const stickyParent = flexHeader.closest('div.sticky');
        if (stickyParent && !stickyParent.classList.contains('jt-files-list-header')) {
          stickyParent.classList.add('jt-files-list-header');
          console.log('FreezeHeader: Found and marked files list header (via sticky parent)');
          return true;
        }
        // Fallback to marking the flex header itself
        flexHeader.classList.add('jt-files-list-header');
        console.log('FreezeHeader: Found and marked files list header (flex header)');
        return true;
      }
    }

    return false;
  }

  /**
   * Find and mark the Files page left sidebar (Documents, Daily Logs, Tasks, Tags, Type filters)
   * Looking for: div.sticky.border-r.w-64 with filter sections (Tags, Type)
   */
  function findAndMarkFilesSidebar() {
    if (!isJobPage() && !isFilesPage()) {
      return false;
    }

    // Already marked?
    if (document.querySelector('.jt-files-sidebar')) {
      return true;
    }

    // Find sticky sidebars with border-r and w-64 class (files page structure)
    const sidebars = document.querySelectorAll('div.sticky.border-r.w-64');

    for (const sidebar of sidebars) {
      // Skip if already marked as something else
      if (sidebar.classList.contains('jt-top-header')) continue;
      if (sidebar.classList.contains('jt-job-tabs-container')) continue;

      // Skip if inside a popup (e.g., files popup from budget view)
      if (isInsidePopup(sidebar)) continue;

      const text = sidebar.textContent;

      // Check for files sidebar indicators (Tags, Type sections with file type options)
      const hasTagsSection = text.includes('Tags');
      const hasTypeSection = text.includes('Type') && (
        text.includes('Image') || text.includes('Video') ||
        text.includes('PDF') || text.includes('Excel') ||
        text.includes('Word') || text.includes('Other')
      );
      // Also check for Documents, Daily Logs, Tasks navigation items
      const hasNavItems = text.includes('Documents') && text.includes('Daily Logs');

      if ((hasTagsSection && hasTypeSection) || hasNavItems) {
        sidebar.classList.add('jt-files-sidebar');
        console.log('FreezeHeader: Found and marked files sidebar');
        return true;
      }
    }

    return false;
  }

  /**
   * Find and mark global sidebars (Time Clock, Daily Log, Notifications) that should NOT be affected by freeze header
   * These sidebars are global overlays that appear on any page and should stay at their native
   * position just below the main header (~48px), not pushed down below frozen tabs/toolbar
   */
  function findAndMarkGlobalSidebars() {
    // Find all sticky sidebars with overflow-y-auto and overscroll-contain
    const sidebars = document.querySelectorAll('div.sticky.overflow-y-auto.overscroll-contain');

    for (const sidebar of sidebars) {
      // Skip if already marked
      if (sidebar.classList.contains('jt-global-sidebar')) continue;

      // Skip if this is a job-specific sidebar (Cost Item Details, Task Details, etc.)
      // Job-specific sidebars are typically inside the main content area
      if (sidebar.closest('.jt-job-tabs-container') ||
          sidebar.closest('.jt-action-toolbar') ||
          sidebar.closest('.jt-budget-header-container')) {
        continue;
      }

      const text = sidebar.textContent || '';

      // Detect global sidebars by their characteristic content
      const isTimeClock = text.includes('TIME CLOCK') ||
                          text.includes('CLOCKED OUT') ||
                          text.includes('CLOCKED IN') ||
                          text.includes('Clock In') ||
                          text.includes('Clock Out');

      const isDailyLog = text.includes('NEW DAILY LOG') ||
                         text.includes('DAILY LOG') ||
                         (text.includes('Weather') && text.includes('Notes') && text.includes('Unplanned Tasks'));

      const isNotifications = text.includes('NOTIFICATIONS') &&
                              (text.includes('Unread') || text.includes('Mark All As Read') || text.includes('RSVPs'));

      // Also check computed top position - global sidebars have top ~48-52px
      const computedStyle = window.getComputedStyle(sidebar);
      const topValue = parseInt(computedStyle.top, 10);
      const isNearHeaderLevel = !isNaN(topValue) && topValue >= 40 && topValue <= 60;

      if (isTimeClock || isDailyLog || isNotifications || isNearHeaderLevel) {
        sidebar.classList.add('jt-global-sidebar');
        console.log('FreezeHeader: Marked global sidebar:', isTimeClock ? 'Time Clock' : isDailyLog ? 'Daily Log' : isNotifications ? 'Notifications' : 'Header-level sidebar');
      }
    }
  }

  /**
   * Calculate and set the correct top positions based on actual element heights
   */
  function updatePositions() {
    const topHeader = document.querySelector('.jt-top-header');
    const tabsContainer = document.querySelector('.jt-job-tabs-container');
    const actionToolbar = document.querySelector('.jt-action-toolbar');
    const filesFolderBar = document.querySelector('.jt-files-folder-bar');

    if (!topHeader) return;

    const headerHeight = topHeader.offsetHeight;
    let tabsBottom = headerHeight;
    let toolbarBottom = tabsBottom;
    let filesFolderBottom = toolbarBottom;

    if (tabsContainer) {
      tabsBottom = headerHeight + tabsContainer.offsetHeight;
      toolbarBottom = tabsBottom;
    }

    if (actionToolbar) {
      toolbarBottom = tabsBottom + actionToolbar.offsetHeight;
      filesFolderBottom = toolbarBottom;
    }

    if (filesFolderBar) {
      filesFolderBottom = toolbarBottom + filesFolderBar.offsetHeight;
    }

    // Set CSS custom properties for positioning
    document.documentElement.style.setProperty('--jt-header-height', `${headerHeight}px`);
    document.documentElement.style.setProperty('--jt-tabs-bottom', `${tabsBottom}px`);
    document.documentElement.style.setProperty('--jt-toolbar-bottom', `${toolbarBottom}px`);
    document.documentElement.style.setProperty('--jt-files-folder-bottom', `${filesFolderBottom}px`);

    console.log('FreezeHeader: Updated positions - header:', headerHeight, 'px, tabs bottom:', tabsBottom, 'px, toolbar bottom:', toolbarBottom, 'px, files folder bottom:', filesFolderBottom, 'px');
  }

  /**
   * Check if freeze header should be temporarily disabled
   * Disable when: Preview Document popup is open OR any popup is in fullscreen mode
   * This allows JobTread's native fullscreen behavior to work properly
   */
  let freezeHeaderSuspended = false;

  function checkAndSuspendFreezeHeader() {
    // Check for Preview Document popup (uses max-w-screen-lg class)
    const previewPopup = document.querySelector('.max-w-screen-lg.shadow-lg.rounded-sm');

    // Check for "Exit Fullscreen" button to detect fullscreen mode
    // The exit fullscreen SVG has path: M8 3v3a2 2 0 0 1-2 2H3...
    let isInFullscreenMode = false;

    const allButtons = document.querySelectorAll('[role="button"]');
    for (const button of allButtons) {
      const svg = button.querySelector('svg');
      if (!svg) continue;

      const pathData = svg.querySelector('path')?.getAttribute('d') || '';
      // Exit fullscreen icon path (arrows pointing inward)
      if (pathData.includes('M8 3v3a2 2 0 0 1-2 2H3')) {
        isInFullscreenMode = true;
        break;
      }
    }

    const shouldSuspend = previewPopup !== null || isInFullscreenMode;

    if (shouldSuspend && !freezeHeaderSuspended) {
      // Suspend freeze header to allow JobTread's native fullscreen to work
      document.body.classList.remove('jt-freeze-header-active');
      freezeHeaderSuspended = true;
      console.log('FreezeHeader: Suspended due to', isInFullscreenMode ? 'fullscreen mode' : 'Preview Document popup');
    } else if (!shouldSuspend && freezeHeaderSuspended) {
      // Resume freeze header
      document.body.classList.add('jt-freeze-header-active');
      freezeHeaderSuspended = false;
      console.log('FreezeHeader: Resumed');
    }
  }

  /**
   * Handle clicks on fullscreen/expand buttons in popups
   * Fullscreen buttons are identified by their expand icon SVG paths
   */
  function handleFullscreenButtonClick(event) {
    const button = event.target.closest('[role="button"]');
    if (!button) return;

    // Check if this button contains a fullscreen/expand icon
    const svg = button.querySelector('svg');
    if (!svg) return;

    const pathData = svg.querySelector('path')?.getAttribute('d') || '';

    // Enter fullscreen icon (arrows pointing outward from corners)
    const isEnterFullscreenIcon = pathData.includes('M8 3H5') || pathData.includes('M 8 3') ||
                                   pathData.includes('m14 10') || pathData.includes('M15 3h6');

    // Exit fullscreen icon (arrows pointing inward to corners)
    const isExitFullscreenIcon = pathData.includes('M8 3v3a2 2 0 0 1-2 2H3');

    if (!isEnterFullscreenIcon && !isExitFullscreenIcon) return;

    // Check freeze header suspension after popup resizes
    // Use longer delay for fullscreen transitions
    setTimeout(checkAndSuspendFreezeHeader, 200);
  }

  /**
   * Set up observer to watch for popup containers and suspend freeze header when needed
   */
  function setupPopupObserver() {
    if (popupObserver) {
      popupObserver.disconnect();
    }

    // Initial check for popups
    checkAndSuspendFreezeHeader();

    // Listen for fullscreen button clicks
    document.addEventListener('click', handleFullscreenButtonClick, true);

    // Watch for popups being added/removed from the DOM
    popupObserver = new MutationObserver((mutations) => {
      let shouldCheck = false;

      for (const mutation of mutations) {
        // Check added nodes for popups
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('shadow-lg') ||
                node.classList?.contains('rounded-sm') ||
                node.classList?.contains('max-w-screen-lg') ||
                node.querySelector?.('.shadow-lg.rounded-sm') ||
                node.querySelector?.('.max-w-screen-lg')) {
              shouldCheck = true;
              break;
            }
          }
        }
        // Check removed nodes (popup closed)
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('shadow-lg') ||
                node.classList?.contains('rounded-sm') ||
                node.classList?.contains('max-w-screen-lg')) {
              shouldCheck = true;
              break;
            }
          }
        }
        if (shouldCheck) break;
      }

      if (shouldCheck) {
        // Debounce popup detection
        setTimeout(checkAndSuspendFreezeHeader, 50);
      }
    });

    popupObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Clean up popup observer
   */
  function cleanupPopupObserver() {
    if (popupObserver) {
      popupObserver.disconnect();
      popupObserver = null;
    }
    document.removeEventListener('click', handleFullscreenButtonClick, true);

    // Reset suspension state
    freezeHeaderSuspended = false;
  }

  /**
   * Apply sticky behavior to the page
   */
  function applyFreezeHeader() {
    document.body.classList.add('jt-freeze-header-active');
    findAndMarkTopHeader();
    findAndMarkTabs();
    findAndMarkActionToolbar();
    findAndMarkBudgetTableHeader();
    findAndMarkScheduleHeader();
    findAndMarkListHeader();
    findAndMarkFilesFolderBar();
    findAndMarkFilesListHeader();
    findAndMarkFilesSidebar();
    findAndMarkGlobalSidebars();
    // Small delay to ensure elements are rendered before measuring
    setTimeout(updatePositions, 100);
    console.log('FreezeHeader: Applied');
  }

  /**
   * Remove sticky behavior
   */
  function removeFreezeHeader() {
    document.body.classList.remove('jt-freeze-header-active');

    // Remove marker classes
    document.querySelectorAll('.jt-top-header').forEach(el => {
      el.classList.remove('jt-top-header');
    });
    document.querySelectorAll('.jt-job-tabs-container').forEach(el => {
      el.classList.remove('jt-job-tabs-container');
    });
    document.querySelectorAll('.jt-action-toolbar').forEach(el => {
      el.classList.remove('jt-action-toolbar');
    });
    document.querySelectorAll('.jt-budget-header-container').forEach(el => {
      el.classList.remove('jt-budget-header-container');
    });
    document.querySelectorAll('.jt-schedule-header-container').forEach(el => {
      el.classList.remove('jt-schedule-header-container');
    });
    document.querySelectorAll('.jt-files-folder-bar').forEach(el => {
      el.classList.remove('jt-files-folder-bar');
    });
    document.querySelectorAll('.jt-files-list-header').forEach(el => {
      el.classList.remove('jt-files-list-header');
    });
    document.querySelectorAll('.jt-files-sidebar').forEach(el => {
      el.classList.remove('jt-files-sidebar');
    });
    document.querySelectorAll('.jt-global-sidebar').forEach(el => {
      el.classList.remove('jt-global-sidebar');
    });

    // Remove CSS custom properties
    document.documentElement.style.removeProperty('--jt-header-height');
    document.documentElement.style.removeProperty('--jt-tabs-bottom');
    document.documentElement.style.removeProperty('--jt-toolbar-bottom');
    document.documentElement.style.removeProperty('--jt-files-folder-bottom');

    console.log('FreezeHeader: Removed');
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActiveState) {
      console.log('FreezeHeader: Already initialized');
      return;
    }

    console.log('FreezeHeader: Initializing...');
    isActiveState = true;

    // Inject styles
    injectStyles();

    // Apply sticky header
    applyFreezeHeader();

    // Set up popup detection to exclude popups from freeze header effects
    setupPopupObserver();

    // Watch for DOM changes (SPA navigation)
    observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new content might be a header, tab, toolbar, or budget area
              if (node.classList && (
                node.classList.contains('shrink-0') ||
                node.classList.contains('sticky') ||
                node.classList.contains('min-w-max')
              )) {
                shouldUpdate = true;
                break;
              }
              if (node.querySelector && (
                node.querySelector('div.shrink-0') ||
                node.querySelector('a[href^="/jobs/"]') ||
                node.querySelector('div.sticky') ||
                node.querySelector('div.border-b-4')
              )) {
                shouldUpdate = true;
                break;
              }
            }
          }
        }
        if (shouldUpdate) break;
      }

      if (shouldUpdate) {
        // Debounce updates
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          findAndMarkTopHeader();
          findAndMarkTabs();
          findAndMarkActionToolbar();
          findAndMarkBudgetTableHeader();
          findAndMarkScheduleHeader();
          findAndMarkListHeader();
          findAndMarkFilesFolderBar();
          findAndMarkFilesListHeader();
          findAndMarkFilesSidebar();
          findAndMarkGlobalSidebars();
          updatePositions();
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    setInterval(() => {
      if (!isActiveState) return;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Remove old markings and re-apply
        document.querySelectorAll('.jt-top-header, .jt-job-tabs-container, .jt-action-toolbar, .jt-budget-header-container, .jt-schedule-header-container, .jt-files-folder-bar, .jt-files-list-header, .jt-files-sidebar, .jt-global-sidebar').forEach(el => {
          el.classList.remove('jt-top-header', 'jt-job-tabs-container', 'jt-action-toolbar', 'jt-budget-header-container', 'jt-schedule-header-container', 'jt-files-folder-bar', 'jt-files-list-header', 'jt-files-sidebar', 'jt-global-sidebar');
        });
        setTimeout(() => {
          findAndMarkTopHeader();
          findAndMarkTabs();
          findAndMarkActionToolbar();
          findAndMarkBudgetTableHeader();
          findAndMarkScheduleHeader();
          findAndMarkListHeader();
          findAndMarkFilesFolderBar();
          findAndMarkFilesListHeader();
          findAndMarkFilesSidebar();
          findAndMarkGlobalSidebars();
          updatePositions();
        }, 300);
      }
    }, 500);

    // Update position on window resize
    window.addEventListener('resize', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePositions, 100);
    });

    console.log('FreezeHeader: Feature loaded');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) {
      console.log('FreezeHeader: Not active, nothing to cleanup');
      return;
    }

    console.log('FreezeHeader: Cleaning up...');
    isActiveState = false;

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

    // Clean up popup observer
    cleanupPopupObserver();

    // Remove styles and applied classes
    removeStyles();
    removeFreezeHeader();

    console.log('FreezeHeader: Cleanup complete');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActiveState
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.FreezeHeaderFeature = FreezeHeaderFeature;
}
