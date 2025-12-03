// JT Power Tools - Expand All Day Events Feature
// Collapses hourly time grid and expands all-day events section in week/day views

const ExpandAllDayFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let styleElement = null;
  let debounceTimer = null;
  let urlCheckInterval = null;
  let isCollapsed = false; // When true, time grid is hidden and all-day is expanded

  // CSS for collapsed/expanded all-day view
  const EXPAND_STYLES = `
    /* Expand All Day Events Styles */

    /* Toggle button styling */
    .jt-expand-allday-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 500;
      border-radius: 3px;
      border: 1px solid #d1d5db;
      background-color: white;
      color: #6b7280;
      margin-left: 4px;
      transition: all 0.15s ease;
      user-select: none;
      white-space: nowrap;
    }

    .jt-expand-allday-btn:hover {
      background-color: #f3f4f6;
      border-color: #9ca3af;
    }

    .jt-expand-allday-btn.active {
      background-color: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    .jt-expand-allday-btn.active:hover {
      background-color: #2563eb;
      border-color: #2563eb;
    }

    .jt-expand-allday-btn svg {
      width: 12px;
      height: 12px;
      margin-right: 3px;
    }

    /* When collapsed (time grid hidden), hide the hourly time grid */
    .jt-allday-collapsed .jt-hourly-grid {
      display: none !important;
    }

    /* When collapsed, remove max-height constraint on all-day container */
    .jt-allday-collapsed .jt-allday-container {
      max-height: none !important;
      overflow-y: visible !important;
    }

    /* Ensure all-day events section fills available space when collapsed */
    .jt-allday-collapsed .jt-allday-section {
      flex-grow: 1;
    }

    /* Make all-day event cards larger when time grid is collapsed */
    .jt-allday-collapsed .jt-allday-container .grid > div > div[style*="height: 20px"] {
      height: 48px !important;
    }

    .jt-allday-collapsed .jt-allday-container .select-none.break-inside-avoid {
      height: 48px !important;
    }

    /* Increase font size and padding for event cards when collapsed */
    .jt-allday-collapsed .jt-allday-container .text-xs {
      font-size: 0.875rem !important;
      line-height: 1.25rem !important;
    }

    .jt-allday-collapsed .jt-allday-container .px-1 {
      padding-left: 0.5rem !important;
      padding-right: 0.5rem !important;
    }

    .jt-allday-collapsed .jt-allday-container .py-0\\.5 {
      padding-top: 0.375rem !important;
      padding-bottom: 0.375rem !important;
    }

    /* Make assignee avatars slightly larger */
    .jt-allday-collapsed .jt-allday-container .h-4.w-4 {
      height: 1.25rem !important;
      width: 1.25rem !important;
    }

    /* Increase spacing between rows */
    .jt-allday-collapsed .jt-allday-container .grid {
      gap: 2px;
    }

    /* Dark mode support */
    body.jt-dark-mode .jt-expand-allday-btn {
      background-color: #2c2c2c;
      border-color: #464646;
      color: #e5e7eb;
    }

    body.jt-dark-mode .jt-expand-allday-btn:hover {
      background-color: #353535;
      border-color: #525252;
    }

    body.jt-dark-mode .jt-expand-allday-btn.active {
      background-color: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    /* Custom theme support */
    body.jt-custom-theme .jt-expand-allday-btn {
      background-color: var(--jt-theme-background, white);
      border-color: var(--jt-theme-border, #d1d5db);
      color: var(--jt-theme-text, #6b7280);
    }

    body.jt-custom-theme .jt-expand-allday-btn:hover {
      filter: brightness(0.95);
    }

    body.jt-custom-theme .jt-expand-allday-btn.active {
      background-color: var(--jt-theme-primary, #3b82f6);
      border-color: var(--jt-theme-primary, #3b82f6);
      color: white;
    }
  `;

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = 'jt-expand-allday-styles';
    styleElement.textContent = EXPAND_STYLES;
    document.head.appendChild(styleElement);
    console.log('ExpandAllDay: Styles injected');
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
      console.log('ExpandAllDay: Styles removed');
    }
  }

  /**
   * Check if we're on a schedule page with week/day view
   */
  function isScheduleWeekDayView() {
    // Check URL for schedule page
    const isSchedulePage = window.location.pathname.includes('/schedule');
    if (!isSchedulePage) return false;

    // Look for the "all-day" label which indicates week/day view
    const allDayLabel = findAllDayLabel();
    return !!allDayLabel;
  }

  /**
   * Find the "all-day" label element
   */
  function findAllDayLabel() {
    // Look for the sticky element containing "all-day" text
    const candidates = document.querySelectorAll('div.sticky.z-10, div.shrink-0.sticky');
    for (const el of candidates) {
      if (el.textContent.trim().toLowerCase() === 'all-day') {
        return el;
      }
    }

    // Alternative: look for text-right with "all-day"
    const textRightEls = document.querySelectorAll('div.text-right.text-gray-400');
    for (const el of textRightEls) {
      if (el.textContent.trim().toLowerCase() === 'all-day') {
        return el;
      }
    }

    return null;
  }

  /**
   * Find the all-day events container (the scrollable area with events)
   */
  function findAllDayContainer() {
    // Look for the overflow-y-auto container that has max-height set
    const containers = document.querySelectorAll('div.overflow-y-auto[style*="max-height"]');
    for (const container of containers) {
      // Check if it's in the same row as the "all-day" label
      const parent = container.closest('div.flex.min-w-max');
      if (parent) {
        const hasAllDayLabel = parent.querySelector('div.text-right')?.textContent.includes('all-day');
        if (hasAllDayLabel) {
          return container;
        }
      }
    }

    // Alternative: find by structure - look for the container next to the all-day label
    const allDayLabel = findAllDayLabel();
    if (allDayLabel) {
      const row = allDayLabel.closest('div.flex.min-w-max');
      if (row) {
        const container = row.querySelector('div.overflow-y-auto');
        if (container) return container;
      }
    }

    return null;
  }

  /**
   * Find the hourly time grid section
   */
  function findHourlyGrid() {
    // Look for the container with hourly time slots (contains "AM" or "PM" labels)
    const scrollContainers = document.querySelectorAll('div.overflow-auto');
    for (const container of scrollContainers) {
      const timeLabels = container.querySelectorAll('div.text-gray-400.text-xs');
      for (const label of timeLabels) {
        const text = label.textContent.trim();
        if (/^\d{1,2}\s?(AM|PM)$/i.test(text) || /^\d{1,2}:\d{2}\s?(AM|PM)?$/i.test(text)) {
          // Found a time label, return the parent container
          const gridParent = label.closest('div.flex.min-w-max');
          if (gridParent) {
            return gridParent.parentElement;
          }
        }
      }
    }

    // Alternative: find by structure - the hourly grid is typically after the all-day section
    const allDaySection = findAllDaySection();
    if (allDaySection && allDaySection.nextElementSibling) {
      const potentialGrid = allDaySection.nextElementSibling;
      // Check if it contains time labels
      const hasTimeLabels = potentialGrid.textContent.match(/\d{1,2}\s?(AM|PM)/i);
      if (hasTimeLabels) {
        return potentialGrid;
      }
    }

    return null;
  }

  /**
   * Find the all-day section (header + events container)
   */
  function findAllDaySection() {
    // Look for the sticky header containing the all-day row
    const allDayLabel = findAllDayLabel();
    if (allDayLabel) {
      // Navigate up to find the section container
      let section = allDayLabel.closest('div.overflow-auto');
      if (section) {
        // Get the parent that contains both header and content
        return section;
      }
    }
    return null;
  }

  /**
   * Create the collapse/expand toggle button
   */
  function createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'jt-expand-allday-btn';
    btn.setAttribute('title', 'Collapse time grid to show only all-day events');

    // Icon - collapse arrows (pointing inward)
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/>
      </svg>
      <span>Collapse</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleCollapsed();
    });

    return btn;
  }

  /**
   * Add the toggle button to the UI
   */
  function addToggleButton() {
    // Check if button already exists
    if (document.querySelector('.jt-expand-allday-btn')) {
      return;
    }

    const allDayLabel = findAllDayLabel();
    if (!allDayLabel) {
      console.log('ExpandAllDay: All-day label not found');
      return;
    }

    const btn = createToggleButton();

    // Insert button after the "all-day" text
    allDayLabel.appendChild(btn);

    // Update button state based on current collapsed state
    updateButtonState(btn);

    console.log('ExpandAllDay: Toggle button added');
  }

  /**
   * Update button visual state
   */
  function updateButtonState(btn) {
    if (!btn) {
      btn = document.querySelector('.jt-expand-allday-btn');
    }
    if (!btn) return;

    if (isCollapsed) {
      // Time grid is hidden, show "Expand" to restore it
      btn.classList.add('active');
      btn.querySelector('span').textContent = 'Expand';
      btn.setAttribute('title', 'Expand to show hourly time grid');
      // Update icon to expand arrows (pointing outward)
      btn.querySelector('svg').innerHTML = '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>';
    } else {
      // Time grid is visible, show "Collapse" to hide it
      btn.classList.remove('active');
      btn.querySelector('span').textContent = 'Collapse';
      btn.setAttribute('title', 'Collapse time grid to show only all-day events');
      // Update icon to collapse arrows (pointing inward)
      btn.querySelector('svg').innerHTML = '<path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/>';
    }
  }

  /**
   * Toggle the collapsed state
   */
  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
    applyCollapsedState();
    updateButtonState();

    // Save state to storage
    saveCollapsedState();

    console.log('ExpandAllDay: Toggled to', isCollapsed ? 'collapsed (time grid hidden)' : 'expanded (time grid visible)');
  }

  /**
   * Apply the collapsed/expanded state to the DOM
   */
  function applyCollapsedState() {
    // Always re-find elements in case DOM has changed
    const allDayContainer = findAllDayContainer();
    const hourlyGrid = findHourlyGrid();
    const allDaySection = findAllDaySection();

    // Find the main calendar view container (try multiple selectors)
    let calendarContainer = document.querySelector('div.grow.flex.flex-col');
    if (!calendarContainer) {
      // Fallback: find the container that holds the schedule view
      calendarContainer = document.querySelector('div.flex.flex-col.grow');
    }

    if (calendarContainer) {
      if (isCollapsed) {
        calendarContainer.classList.add('jt-allday-collapsed');
      } else {
        calendarContainer.classList.remove('jt-allday-collapsed');
      }
    }

    // Mark the all-day container
    if (allDayContainer) {
      allDayContainer.classList.add('jt-allday-container');
      if (isCollapsed) {
        allDayContainer.style.maxHeight = 'none';
        allDayContainer.style.overflow = 'visible';
      } else {
        allDayContainer.style.maxHeight = '';
        allDayContainer.style.overflow = '';
      }
    }

    // Mark the hourly grid
    if (hourlyGrid) {
      hourlyGrid.classList.add('jt-hourly-grid');
      if (isCollapsed) {
        hourlyGrid.style.display = 'none';
      } else {
        hourlyGrid.style.display = '';
      }
    }

    // Mark the all-day section
    if (allDaySection) {
      allDaySection.classList.add('jt-allday-section');
    }

    // Apply larger card styles via inline style override when collapsed
    if (isCollapsed) {
      applyLargerCardStyles();
    } else {
      removeLargerCardStyles();
    }

    // Update button state in case it was re-created
    updateButtonState();
  }

  /**
   * Apply larger styles to all-day event cards
   */
  function applyLargerCardStyles() {
    const allDayContainer = document.querySelector('.jt-allday-container');
    if (!allDayContainer) {
      // Try to find and mark it again
      const container = findAllDayContainer();
      if (container) {
        container.classList.add('jt-allday-container');
        applyLargerCardStyles();
      }
      return;
    }

    // Find all event card containers and increase their height
    const eventRows = allDayContainer.querySelectorAll('.select-none.break-inside-avoid');
    eventRows.forEach(row => {
      if (row.style.height !== '48px') {
        row.style.height = '48px';
      }
    });

    // Also target the grid row divs that set height (both 20px original and any unmarked)
    const gridRows = allDayContainer.querySelectorAll('div[style*="height"]');
    gridRows.forEach(row => {
      const currentHeight = row.style.height;
      if (currentHeight && currentHeight !== '48px' && parseInt(currentHeight) < 48) {
        row.style.height = '48px';
      }
    });

    // Also target parent wrapper divs in the grid
    const gridParent = allDayContainer.querySelector('.grid');
    if (gridParent) {
      const gridChildren = gridParent.querySelectorAll(':scope > div > div[style*="height"]');
      gridChildren.forEach(child => {
        if (child.style.height !== '48px' && parseInt(child.style.height) < 48) {
          child.style.height = '48px';
        }
      });
    }
  }

  /**
   * Remove larger card styles
   */
  function removeLargerCardStyles() {
    const allDayContainer = document.querySelector('.jt-allday-container');
    if (!allDayContainer) return;

    const eventRows = allDayContainer.querySelectorAll('.select-none.break-inside-avoid');
    eventRows.forEach(row => {
      row.style.height = '';
    });

    const gridRows = allDayContainer.querySelectorAll('div[style*="height: 48px"]');
    gridRows.forEach(row => {
      row.style.height = '20px';
    });
  }

  /**
   * Save collapsed state to chrome storage
   */
  async function saveCollapsedState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ jtExpandAllDayCollapsed: isCollapsed });
      }
    } catch (error) {
      console.error('ExpandAllDay: Error saving state:', error);
    }
  }

  /**
   * Load collapsed state from chrome storage
   */
  async function loadCollapsedState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['jtExpandAllDayCollapsed']);
        if (result.jtExpandAllDayCollapsed !== undefined) {
          isCollapsed = result.jtExpandAllDayCollapsed;
        }
      }
    } catch (error) {
      console.error('ExpandAllDay: Error loading state:', error);
    }
  }

  /**
   * Set up the feature on the current page
   */
  function setupFeature() {
    if (!isScheduleWeekDayView()) {
      console.log('ExpandAllDay: Not on week/day schedule view');
      return;
    }

    addToggleButton();
    applyCollapsedState();
    console.log('ExpandAllDay: Feature set up');
  }

  /**
   * Remove feature elements from the page
   */
  function removeFeatureElements() {
    // Remove toggle button
    const btn = document.querySelector('.jt-expand-allday-btn');
    if (btn) {
      btn.remove();
    }

    // Remove collapsed state
    const calendarContainer = document.querySelector('.jt-allday-collapsed');
    if (calendarContainer) {
      calendarContainer.classList.remove('jt-allday-collapsed');
    }

    // Remove markers and reset styles
    document.querySelectorAll('.jt-allday-container').forEach(el => {
      el.classList.remove('jt-allday-container');
      el.style.maxHeight = '';
    });

    document.querySelectorAll('.jt-hourly-grid').forEach(el => {
      el.classList.remove('jt-hourly-grid');
      el.style.display = '';
    });

    document.querySelectorAll('.jt-allday-section').forEach(el => {
      el.classList.remove('jt-allday-section');
    });

    // Reset card heights
    removeLargerCardStyles();
  }

  /**
   * Initialize the feature
   */
  async function init() {
    if (isActiveState) {
      console.log('ExpandAllDay: Already initialized');
      return;
    }

    console.log('ExpandAllDay: Initializing...');
    isActiveState = true;

    // Load saved state
    await loadCollapsedState();

    // Inject styles
    injectStyles();

    // Set up feature
    setupFeature();

    // Watch for DOM changes (SPA navigation, view changes, sidebar open/close)
    observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      let shouldReapplyStyles = false;

      for (const mutation of mutations) {
        // Check if changes happened inside the all-day container (cards added/removed)
        const allDayContainer = document.querySelector('.jt-allday-container');
        if (allDayContainer && allDayContainer.contains(mutation.target)) {
          shouldReapplyStyles = true;
        }

        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new content might be schedule-related
              const text = node.textContent || '';
              if (text.includes('all-day') || text.match(/\d{1,2}\s?(AM|PM)/i)) {
                shouldUpdate = true;
                break;
              }
              if (node.querySelector && node.querySelector('[class*="overflow-auto"]')) {
                shouldUpdate = true;
                break;
              }
              // Check if schedule cards are being added (e.g., after sidebar closes)
              if (node.classList && (node.classList.contains('select-none') ||
                  node.classList.contains('break-inside-avoid'))) {
                shouldReapplyStyles = true;
              }
              if (node.querySelector && node.querySelector('.select-none.break-inside-avoid')) {
                shouldReapplyStyles = true;
              }
            }
          }
        }
        if (shouldUpdate) break;
      }

      // Re-apply styles to new cards if collapsed
      if (shouldReapplyStyles && isCollapsed) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          applyCollapsedState();
        }, 100);
      } else if (shouldUpdate) {
        // Debounce full setup updates
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          setupFeature();
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    urlCheckInterval = setInterval(() => {
      if (!isActiveState) return;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Re-setup on navigation
        setTimeout(() => {
          removeFeatureElements();
          setupFeature();
        }, 300);
      }
    }, 500);

    console.log('ExpandAllDay: Feature loaded');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) {
      console.log('ExpandAllDay: Not active, nothing to cleanup');
      return;
    }

    console.log('ExpandAllDay: Cleaning up...');
    isActiveState = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Clear interval
    if (urlCheckInterval) {
      clearInterval(urlCheckInterval);
      urlCheckInterval = null;
    }

    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Remove styles and elements
    removeStyles();
    removeFeatureElements();

    console.log('ExpandAllDay: Cleanup complete');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActiveState,
    isCollapsed: () => isCollapsed
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.ExpandAllDayFeature = ExpandAllDayFeature;
}
