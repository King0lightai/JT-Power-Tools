/**
 * Print Mass Actions Feature (PREMIUM)
 * Adds a print button to the Mass Actions sidebar for printing selected To-Dos, Schedule items, or Budget items
 */

const PrintMassActionsFeature = (() => {
  let isActive = false;
  let sidebarObserver = null;
  let printButton = null;

  /**
   * Initialize the feature
   */
  async function init() {
    if (isActive) {
      console.log('Print Mass Actions: Already active');
      return;
    }

    // Check for premium license
    if (!window.LicenseService) {
      console.error('Print Mass Actions: LicenseService not available');
      return;
    }

    const hasLicense = await window.LicenseService.hasValidLicense();
    if (!hasLicense) {
      console.log('Print Mass Actions: Premium license required');
      return;
    }

    console.log('Print Mass Actions: Initializing...');
    isActive = true;

    // Start observing for Mass Actions sidebar
    startObserving();

    console.log('Print Mass Actions: Initialized');
  }

  /**
   * Start observing for Mass Actions sidebar
   */
  function startObserving() {
    // Check if sidebar is already open
    checkAndInjectButton();

    // Observe DOM changes for sidebar appearing
    sidebarObserver = new MutationObserver((mutations) => {
      checkAndInjectButton();
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if Mass Actions sidebar is present and inject button if needed
   */
  function checkAndInjectButton() {
    // Look for Mass Actions sidebar
    const massActionsSidebar = findMassActionsSidebar();

    if (massActionsSidebar && !printButton) {
      console.log('Print Mass Actions: Found Mass Actions sidebar, injecting print button');
      injectPrintButton(massActionsSidebar);
    } else if (!massActionsSidebar && printButton) {
      // Sidebar was closed, remove button reference
      printButton = null;
    }
  }

  /**
   * Find the Mass Actions sidebar
   * @returns {HTMLElement|null}
   */
  function findMassActionsSidebar() {
    // Look for the sidebar with "Mass Actions" heading
    const sidebars = document.querySelectorAll('div.z-30.absolute.top-0.bottom-0.right-0');

    console.log(`Print Mass Actions: Found ${sidebars.length} potential sidebars`);

    for (const sidebar of sidebars) {
      const heading = sidebar.querySelector('.font-bold.text-jtOrange.uppercase');
      if (heading) {
        const headingText = heading.textContent.trim();
        console.log(`Print Mass Actions: Checking heading: "${headingText}"`);

        // Match "Mass Actions" (case-insensitive)
        if (headingText.toUpperCase() === 'MASS ACTIONS') {
          console.log('Print Mass Actions: ✓ Found Mass Actions sidebar!');
          return sidebar;
        }
      }
    }

    console.log('Print Mass Actions: No Mass Actions sidebar found');
    return null;
  }

  /**
   * Inject print button into Mass Actions sidebar
   * @param {HTMLElement} sidebar
   */
  function injectPrintButton(sidebar) {
    console.log('Print Mass Actions: Attempting to inject print button...');

    // Find the bottom section with the "Remove" button
    const removeSection = sidebar.querySelector('.px-4.pb-4.space-y-2.text-center');

    if (!removeSection) {
      console.warn('Print Mass Actions: Could not find bottom section (.px-4.pb-4.space-y-2.text-center)');
      // Try alternative selectors
      const allSections = sidebar.querySelectorAll('.px-4');
      console.log(`Print Mass Actions: Found ${allSections.length} sections with .px-4`);
      return;
    }

    console.log('Print Mass Actions: ✓ Found remove section');

    // Check if button already exists
    if (removeSection.querySelector('.jt-print-mass-actions-btn')) {
      console.log('Print Mass Actions: Button already exists, skipping');
      return;
    }

    // Create print button
    printButton = document.createElement('div');
    printButton.className = 'jt-print-mass-actions-btn';
    printButton.setAttribute('role', 'button');
    printButton.setAttribute('tabindex', '0');
    printButton.style.cssText = `
      cursor: pointer;
      color: rgb(59, 130, 246);
      font-size: 0.875rem;
      margin-top: 0.5rem;
      transition: color 0.2s;
    `;

    printButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]" viewBox="0 0 24 24">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect width="12" height="8" x="6" y="14"></rect>
      </svg>
      Print Selected Items
    `;

    // Add hover effect
    printButton.addEventListener('mouseenter', () => {
      printButton.style.color = 'rgb(37, 99, 235)';
    });
    printButton.addEventListener('mouseleave', () => {
      printButton.style.color = 'rgb(59, 130, 246)';
    });

    // Add click handler
    printButton.addEventListener('click', handlePrintClick);
    printButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePrintClick();
      }
    });

    // Insert before the remove button
    const removeButton = removeSection.querySelector('div[role="button"]');
    if (removeButton) {
      console.log('Print Mass Actions: Inserting before remove button');
      removeSection.insertBefore(printButton, removeButton);
    } else {
      console.log('Print Mass Actions: Appending to section (no remove button found)');
      removeSection.appendChild(printButton);
    }

    console.log('Print Mass Actions: ✅ Print button successfully injected!');
  }

  /**
   * Handle print button click
   */
  async function handlePrintClick() {
    console.log('Print Mass Actions: Print button clicked');

    // Collect selected items
    const selectedItems = collectSelectedItems();

    if (!selectedItems || selectedItems.length === 0) {
      alert('No items selected to print');
      return;
    }

    console.log(`Print Mass Actions: Collected ${selectedItems.length} items`);

    // Generate and print
    generatePrintView(selectedItems);
  }

  /**
   * Collect selected items from the page
   * @returns {Array}
   */
  function collectSelectedItems() {
    const items = [];

    // Detect what type of page we're on and collect accordingly
    const pageType = detectPageType();
    console.log('Print Mass Actions: Detected page type:', pageType);

    switch (pageType) {
      case 'todos':
        return collectSelectedTodos();
      case 'schedule':
        return collectSelectedScheduleItems();
      case 'budget':
        return collectSelectedBudgetItems();
      default:
        console.warn('Print Mass Actions: Unknown page type');
        return [];
    }
  }

  /**
   * Detect the current page type
   * @returns {string} 'todos', 'schedule', 'budget', or 'unknown'
   */
  function detectPageType() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    console.log(`Print Mass Actions: Current URL: ${url}`);
    console.log(`Print Mass Actions: Current pathname: ${pathname}`);

    // Check URL patterns (note: JobTread uses /to-dos with hyphen)
    if (url.includes('/to-dos') || url.includes('/todos') || url.includes('/tasks') ||
        pathname.includes('/to-dos') || pathname.includes('/todos') || pathname.includes('/tasks')) {
      console.log('Print Mass Actions: Detected todos from URL pattern');
      return 'todos';
    } else if (url.includes('/schedule') || pathname.includes('/schedule')) {
      console.log('Print Mass Actions: Detected schedule from URL pattern');
      return 'schedule';
    } else if (url.includes('/budget') || pathname.includes('/budget')) {
      console.log('Print Mass Actions: Detected budget from URL pattern');
      return 'budget';
    }

    // Check page title as fallback
    const pageTitle = document.title.toLowerCase();
    console.log(`Print Mass Actions: Page title: "${pageTitle}"`);

    if (pageTitle.includes('todo') || pageTitle.includes('task')) {
      console.log('Print Mass Actions: Detected todos from page title');
      return 'todos';
    } else if (pageTitle.includes('schedule') || pageTitle.includes('calendar')) {
      console.log('Print Mass Actions: Detected schedule from page title');
      return 'schedule';
    } else if (pageTitle.includes('budget')) {
      console.log('Print Mass Actions: Detected budget from page title');
      return 'budget';
    }

    // Check for specific UI elements as last resort
    if (document.querySelector('input[placeholder="Name"]')) {
      console.log('Print Mass Actions: Detected todos from UI elements');
      return 'todos';
    }

    console.warn('Print Mass Actions: Could not detect page type');
    return 'unknown';
  }

  /**
   * Collect selected To-Do items
   * @returns {Array}
   */
  function collectSelectedTodos() {
    const items = [];

    console.log('Print Mass Actions: Collecting selected To-Dos...');

    // JobTread uses divs with group/row class for To-Dos
    // Selected rows have bg-blue-50 or bg-blue-100 classes on child elements
    const allRows = document.querySelectorAll('div.group\\/row, div[class*="group/row"]');
    console.log(`Print Mass Actions: Found ${allRows.length} total rows`);

    allRows.forEach((row, index) => {
      // Check if any child has blue background (indicates selection)
      const hasBlueBackground = row.querySelector('[class*="bg-blue-50"], [class*="bg-blue-100"]');

      if (hasBlueBackground) {
        console.log(`Print Mass Actions: Row ${index} is selected (has blue background)`);
        const item = extractTodoData(row);
        if (item) {
          items.push(item);
          console.log(`Print Mass Actions: ✓ Extracted todo: "${item.title}"`);
        }
      }
    });

    // Fallback: Try table-based structure (older JobTread layout)
    if (items.length === 0) {
      console.log('Print Mass Actions: No div-based todos found, trying table structure...');
      const selectedTableRows = document.querySelectorAll('tr[class*="bg-blue"]');

      selectedTableRows.forEach(row => {
        const item = extractTodoData(row);
        if (item && !items.find(i => i.title === item.title)) {
          items.push(item);
        }
      });
    }

    console.log(`Print Mass Actions: Collected ${items.length} selected To-Dos`);
    return items;
  }

  /**
   * Extract To-Do data from a row
   * @param {HTMLElement} row
   * @returns {Object|null}
   */
  function extractTodoData(row) {
    try {
      // Skip group rows (they have font-bold class on cells)
      const hasGroupMarker = row.querySelector('.shrink-0.border-b.border-r.font-bold');
      if (hasGroupMarker) {
        console.log('Print Mass Actions: Skipping group row');
        return null;
      }

      // Get task title from input
      let title = 'Untitled Task';
      const titleInput = row.querySelector('input[placeholder="Name"]');
      if (titleInput && titleInput.value) {
        title = titleInput.value.trim();
      } else {
        // Fallback to div content
        const titleElement = row.querySelector('div.truncate');
        if (titleElement) {
          title = titleElement.textContent.trim();
        }
      }

      // Get description from the gray text div (separate from title)
      let description = '';
      const descElement = row.querySelector('div.whitespace-pre-wrap.text-sm.text-gray-500');
      if (descElement) {
        description = descElement.textContent.trim();
      }

      // Get due date from the date input field
      let dueDate = '';
      const dueDateInput = row.querySelector('input[placeholder="Today"]');
      if (dueDateInput && dueDateInput.value) {
        dueDate = dueDateInput.value.trim();
      } else {
        // Fallback: look for date patterns in cells
        const cellDivs = row.querySelectorAll('div.shrink-0.border-b.border-r');
        cellDivs.forEach(cell => {
          const text = cell.textContent.trim();
          if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) || /[A-Z][a-z]{2}\s+\d{1,2}/.test(text) || /(Today|Tomorrow|Yesterday)/.test(text)) {
            if (!dueDate) {
              dueDate = text;
            }
          }
        });
      }

      // Get type/category from the colored badge
      let category = '';
      const categoryBadge = row.querySelector('div.truncate.text-xs.max-w-max');
      if (categoryBadge) {
        category = categoryBadge.textContent.trim();
      }

      // Get assignees from SVG text elements only
      const assignees = [];
      const assigneeSVGs = row.querySelectorAll('svg.fill-current text');
      assigneeSVGs.forEach(textEl => {
        const initials = textEl.textContent.trim();
        if (initials && initials.length <= 4 && !assignees.includes(initials)) {
          assignees.push(initials);
        }
      });

      // Get progress/status
      const progressElement = row.querySelector('input[type="range"], .text-green-600, .text-gray-600');
      let progress = '';
      if (progressElement) {
        if (progressElement.tagName === 'INPUT') {
          const value = parseFloat(progressElement.value || 0);
          if (value >= 0) {
            progress = Math.round(value * 100) + '%';
          } else {
            progress = 'Not Started';
          }
        } else {
          progress = progressElement.textContent.trim();
        }
      }

      console.log(`Print Mass Actions: Extracted - Title: "${title}", Description: "${description.substring(0, 30)}...", Due: "${dueDate}", Category: "${category}", Assignees: ${assignees.join(', ')}`);

      return {
        type: 'todo',
        title,
        description,
        dueDate,
        category,
        assignees,
        progress
      };
    } catch (error) {
      console.error('Print Mass Actions: Error extracting todo data:', error);
      return null;
    }
  }

  /**
   * Collect selected Schedule items
   * @returns {Array}
   */
  function collectSelectedScheduleItems() {
    const items = [];

    console.log('Print Mass Actions: Collecting selected Schedule items...');

    // Find all rows (divs or table rows)
    const allRows = document.querySelectorAll('div.group\\/row, div[class*="group/row"], tr');
    console.log(`Print Mass Actions: Found ${allRows.length} potential schedule rows`);

    allRows.forEach((row, index) => {
      // Check if any child has blue background (indicates selection)
      const hasBlueBackground = row.querySelector('[class*="bg-blue-50"], [class*="bg-blue-100"]');

      if (hasBlueBackground) {
        console.log(`Print Mass Actions: Schedule row ${index} is selected`);
        const scheduleData = extractScheduleData(row);
        if (scheduleData && !items.find(i => i.title === scheduleData.title)) {
          items.push(scheduleData);
          console.log(`Print Mass Actions: ✓ Extracted schedule item: "${scheduleData.title}"`);
        }
      }
    });

    console.log(`Print Mass Actions: Collected ${items.length} selected Schedule items`);
    return items;
  }

  /**
   * Extract Schedule item data
   * @param {HTMLElement} element
   * @returns {Object|null}
   */
  function extractScheduleData(element) {
    try {
      // Get title
      const titleElement = element.querySelector('div.font-bold, div.truncate');
      const title = titleElement ? titleElement.textContent.trim() : 'Untitled Event';

      // Get dates
      const dateElements = element.querySelectorAll('span, div');
      let startDate = '';
      let endDate = '';

      dateElements.forEach(el => {
        const text = el.textContent.trim();
        if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) || /[A-Z][a-z]{2}\s+\d{1,2}/.test(text)) {
          if (!startDate) {
            startDate = text;
          } else if (!endDate) {
            endDate = text;
          }
        }
      });

      return {
        type: 'schedule',
        title,
        startDate,
        endDate
      };
    } catch (error) {
      console.error('Print Mass Actions: Error extracting schedule data:', error);
      return null;
    }
  }

  /**
   * Collect selected Budget items
   * @returns {Array}
   */
  function collectSelectedBudgetItems() {
    const items = [];

    // Find all selected budget rows
    const selectedRows = document.querySelectorAll('tr[class*="bg-blue"]');

    selectedRows.forEach(row => {
      const budgetData = extractBudgetData(row);
      if (budgetData) {
        items.push(budgetData);
      }
    });

    return items;
  }

  /**
   * Extract Budget item data
   * @param {HTMLElement} row
   * @returns {Object|null}
   */
  function extractBudgetData(row) {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return null;

      // Get item name (usually first or second cell)
      const nameElement = row.querySelector('div.truncate, div.font-bold');
      const name = nameElement ? nameElement.textContent.trim() : 'Untitled Item';

      // Get amount values
      const amounts = [];
      cells.forEach(cell => {
        const text = cell.textContent.trim();
        if (/\$[\d,]+(\.\d{2})?/.test(text)) {
          amounts.push(text);
        }
      });

      return {
        type: 'budget',
        name,
        budgeted: amounts[0] || '',
        actual: amounts[1] || '',
        variance: amounts[2] || ''
      };
    } catch (error) {
      console.error('Print Mass Actions: Error extracting budget data:', error);
      return null;
    }
  }

  /**
   * Generate and open print view
   * @param {Array} items
   */
  function generatePrintView(items) {
    if (!items || items.length === 0) return;

    const itemType = items[0].type;
    const jobName = extractJobName();
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print ${itemType === 'todo' ? 'To-Dos' : itemType === 'schedule' ? 'Schedule Items' : 'Budget Items'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      padding: 40px;
      color: #333;
      line-height: 1.6;
    }

    .header {
      margin-bottom: 30px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
    }

    .header h1 {
      color: #1f2937;
      font-size: 28px;
      margin-bottom: 10px;
    }

    .header .meta {
      color: #6b7280;
      font-size: 14px;
    }

    .items {
      width: 100%;
    }

    .item {
      margin-bottom: 25px;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      page-break-inside: avoid;
      background: #ffffff;
    }

    .item-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 12px;
    }

    .item-details {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 8px;
      font-size: 14px;
    }

    .item-label {
      color: #6b7280;
      font-weight: 500;
    }

    .item-value {
      color: #374151;
    }

    .assignees {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .assignee {
      background: #f3f4f6;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
    }

    @media print {
      body {
        padding: 20px;
      }

      .item {
        box-shadow: none;
      }
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${itemType === 'todo' ? 'To-Do List' : itemType === 'schedule' ? 'Schedule Items' : 'Budget Items'}</h1>
    <div class="meta">
      ${jobName ? `<strong>Job:</strong> ${jobName}<br>` : ''}
      <strong>Printed:</strong> ${date}<br>
      <strong>Total Items:</strong> ${items.length}
    </div>
  </div>

  <div class="items">
`;

    // Add items based on type
    if (itemType === 'todo') {
      items.forEach((item, index) => {
        html += `
    <div class="item">
      <div class="item-title">${index + 1}. ${escapeHtml(item.title)}</div>
      ${item.description ? `<div style="margin-top: 8px; color: #6b7280; font-size: 14px;">${escapeHtml(item.description)}</div>` : ''}
      <div class="item-details">
        ${item.dueDate ? `<div class="item-label">Due Date:</div><div class="item-value">${escapeHtml(item.dueDate)}</div>` : ''}
        ${item.category ? `<div class="item-label">Type:</div><div class="item-value">${escapeHtml(item.category)}</div>` : ''}
        ${item.progress ? `<div class="item-label">Progress:</div><div class="item-value">${escapeHtml(item.progress)}</div>` : ''}
        ${item.assignees && item.assignees.length > 0 ? `
          <div class="item-label">Assignees:</div>
          <div class="item-value">
            <div class="assignees">
              ${item.assignees.map(a => `<span class="assignee">${escapeHtml(a)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
`;
      });
    } else if (itemType === 'schedule') {
      items.forEach((item, index) => {
        html += `
    <div class="item">
      <div class="item-title">${index + 1}. ${escapeHtml(item.title)}</div>
      <div class="item-details">
        ${item.startDate ? `<div class="item-label">Start Date:</div><div class="item-value">${escapeHtml(item.startDate)}</div>` : ''}
        ${item.endDate ? `<div class="item-label">End Date:</div><div class="item-value">${escapeHtml(item.endDate)}</div>` : ''}
      </div>
    </div>
`;
      });
    } else if (itemType === 'budget') {
      items.forEach((item, index) => {
        html += `
    <div class="item">
      <div class="item-title">${index + 1}. ${escapeHtml(item.name)}</div>
      <div class="item-details">
        ${item.budgeted ? `<div class="item-label">Budgeted:</div><div class="item-value">${escapeHtml(item.budgeted)}</div>` : ''}
        ${item.actual ? `<div class="item-label">Actual:</div><div class="item-value">${escapeHtml(item.actual)}</div>` : ''}
        ${item.variance ? `<div class="item-label">Variance:</div><div class="item-value">${escapeHtml(item.variance)}</div>` : ''}
      </div>
    </div>
`;
      });
    }

    html += `
  </div>

  <div class="footer">
    Generated by JT Power Tools
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
`;

    // Open in new window and print
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert('Please allow popups to use the print feature');
    }
  }

  /**
   * Extract job name from page
   * @returns {string}
   */
  function extractJobName() {
    // Look for job name button (e.g., "Job 0002")
    const jobButton = document.querySelector('div[role="button"].hover\\:text-gray-800');
    if (jobButton) {
      const jobName = jobButton.textContent.trim();
      if (jobName) {
        console.log(`Print Mass Actions: Found job name: "${jobName}"`);
        return jobName;
      }
    }

    // Try to find job name in header or title
    const jobNameElement = document.querySelector('h1, h2, [class*="job-name"], [class*="job-title"]');
    if (jobNameElement) {
      return jobNameElement.textContent.trim();
    }

    // Try to extract from URL
    const urlMatch = window.location.pathname.match(/\/jobs\/([^\/]+)/);
    if (urlMatch) {
      return decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
    }

    return '';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      return;
    }

    console.log('Print Mass Actions: Cleaning up...');

    // Stop observing
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }

    // Remove button if it exists
    if (printButton && printButton.parentNode) {
      printButton.remove();
    }
    printButton = null;

    isActive = false;
    console.log('Print Mass Actions: Cleaned up');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.PrintMassActionsFeature = PrintMassActionsFeature;
}
