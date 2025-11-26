// JT Power Tools - Budget QuickSum Feature
// Allows users to select budget items and see a quick sum of costs, prices, and margins

const BudgetQuickSumFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let debounceTimer = null;
  let summaryPanel = null;
  let selectedRows = new Set();
  let styleElement = null;
  const processedRows = new WeakSet();

  // CSS for QuickSum styling
  const QUICKSUM_STYLES = `
    /* QuickSum Checkbox Styles */
    .jt-quicksum-checkbox {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      cursor: pointer;
      accent-color: #3b82f6;
      flex-shrink: 0;
    }

    .jt-quicksum-checkbox:hover {
      transform: scale(1.1);
    }

    /* Row highlighting when selected */
    .jt-quicksum-selected {
      background-color: rgba(59, 130, 246, 0.1) !important;
    }

    .jt-quicksum-selected > td {
      background-color: rgba(59, 130, 246, 0.1) !important;
    }

    /* Checkbox cell */
    .jt-quicksum-checkbox-cell {
      width: 30px !important;
      min-width: 30px !important;
      padding: 4px 8px !important;
      text-align: center;
    }

    /* Summary Panel Styles */
    .jt-quicksum-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      min-width: 280px;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .jt-quicksum-panel.hidden {
      transform: translateY(20px);
      opacity: 0;
      pointer-events: none;
    }

    .jt-quicksum-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .jt-quicksum-panel-title {
      font-weight: 600;
      font-size: 14px;
      color: #374151;
    }

    .jt-quicksum-panel-count {
      font-size: 12px;
      color: #6b7280;
      background: #f3f4f6;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .jt-quicksum-panel-body {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      font-size: 13px;
    }

    .jt-quicksum-label {
      color: #6b7280;
    }

    .jt-quicksum-value {
      text-align: right;
      font-weight: 500;
      color: #111827;
    }

    .jt-quicksum-value.cost {
      color: #dc2626;
    }

    .jt-quicksum-value.price {
      color: #059669;
    }

    .jt-quicksum-value.margin {
      color: #3b82f6;
    }

    .jt-quicksum-value.margin.negative {
      color: #dc2626;
    }

    .jt-quicksum-divider {
      grid-column: 1 / -1;
      border-top: 1px solid #e5e7eb;
      margin: 4px 0;
    }

    .jt-quicksum-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }

    .jt-quicksum-btn {
      flex: 1;
      padding: 6px 12px;
      font-size: 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .jt-quicksum-btn-clear {
      background: #f3f4f6;
      color: #374151;
    }

    .jt-quicksum-btn-clear:hover {
      background: #e5e7eb;
    }

    .jt-quicksum-btn-selectall {
      background: #3b82f6;
      color: white;
    }

    .jt-quicksum-btn-selectall:hover {
      background: #2563eb;
    }

    /* Dark mode compatibility */
    .jt-dark-mode .jt-quicksum-panel,
    [data-theme="dark"] .jt-quicksum-panel {
      background: #1f2937;
      border-color: #374151;
    }

    .jt-dark-mode .jt-quicksum-panel-title,
    [data-theme="dark"] .jt-quicksum-panel-title {
      color: #f3f4f6;
    }

    .jt-dark-mode .jt-quicksum-panel-count,
    [data-theme="dark"] .jt-quicksum-panel-count {
      background: #374151;
      color: #d1d5db;
    }

    .jt-dark-mode .jt-quicksum-label,
    [data-theme="dark"] .jt-quicksum-label {
      color: #9ca3af;
    }

    .jt-dark-mode .jt-quicksum-value,
    [data-theme="dark"] .jt-quicksum-value {
      color: #f3f4f6;
    }

    .jt-dark-mode .jt-quicksum-divider,
    .jt-dark-mode .jt-quicksum-panel-header,
    .jt-dark-mode .jt-quicksum-actions,
    [data-theme="dark"] .jt-quicksum-divider,
    [data-theme="dark"] .jt-quicksum-panel-header,
    [data-theme="dark"] .jt-quicksum-actions {
      border-color: #374151;
    }

    .jt-dark-mode .jt-quicksum-selected,
    [data-theme="dark"] .jt-quicksum-selected {
      background-color: rgba(59, 130, 246, 0.2) !important;
    }

    .jt-dark-mode .jt-quicksum-btn-clear,
    [data-theme="dark"] .jt-quicksum-btn-clear {
      background: #374151;
      color: #d1d5db;
    }

    .jt-dark-mode .jt-quicksum-btn-clear:hover,
    [data-theme="dark"] .jt-quicksum-btn-clear:hover {
      background: #4b5563;
    }
  `;

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = 'jt-quicksum-styles';
    styleElement.textContent = QUICKSUM_STYLES;
    document.head.appendChild(styleElement);
    console.log('QuickSum: Styles injected');
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
      console.log('QuickSum: Styles removed');
    }
  }

  /**
   * Format currency value
   * @param {number} value - The value to format
   * @returns {string} Formatted currency string
   */
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Parse currency string to number
   * @param {string} text - The currency string to parse
   * @returns {number} Parsed number value
   */
  function parseCurrency(text) {
    if (!text) return 0;
    // Remove currency symbols, commas, and parentheses (for negative values)
    const cleaned = text.replace(/[$,()]/g, '').trim();
    // Handle parentheses as negative
    const isNegative = text.includes('(') || text.includes('-');
    const value = parseFloat(cleaned) || 0;
    return isNegative && value > 0 ? -value : value;
  }

  /**
   * Check if we're on a budget page
   * @returns {boolean}
   */
  function isBudgetPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('/budget') ||
           path.includes('/estimate') ||
           document.querySelector('[data-testid*="budget"]') !== null ||
           document.querySelector('table[class*="budget"]') !== null;
  }

  /**
   * Find budget table rows
   * @returns {NodeList} Budget rows
   */
  function findBudgetRows() {
    // Try various selectors for budget tables
    const selectors = [
      'table tbody tr[data-budget-row]',
      'table tbody tr[data-testid*="budget"]',
      'table tbody tr[data-testid*="line-item"]',
      '[class*="budget"] table tbody tr',
      'table[class*="budget"] tbody tr',
      // Generic table rows in budget view
      'main table tbody tr'
    ];

    for (const selector of selectors) {
      const rows = document.querySelectorAll(selector);
      if (rows.length > 0) {
        // Filter out header rows and empty rows
        const validRows = Array.from(rows).filter(row => {
          // Skip if it's a header row
          if (row.querySelector('th')) return false;
          // Skip if it has no cells
          if (row.querySelectorAll('td').length === 0) return false;
          // Skip if already has our checkbox
          if (row.querySelector('.jt-quicksum-checkbox')) return false;
          return true;
        });
        if (validRows.length > 0) {
          console.log(`QuickSum: Found ${validRows.length} budget rows using: ${selector}`);
          return validRows;
        }
      }
    }

    return [];
  }

  /**
   * Extract numeric values from a row
   * @param {HTMLElement} row - The table row
   * @returns {Object} Object with cost, price values
   */
  function extractRowValues(row) {
    const cells = row.querySelectorAll('td');
    let cost = 0;
    let price = 0;

    // Try to find cells with currency values
    cells.forEach((cell, index) => {
      const text = cell.textContent.trim();
      // Check if this looks like a currency value
      if (/^\$?[\d,]+\.?\d*$/.test(text.replace(/[(),-]/g, '').trim()) ||
          text.includes('$')) {
        const value = parseCurrency(text);

        // Try to determine if this is cost or price based on:
        // - Column header (if we can find it)
        // - Column position (typically cost before price)
        // - Cell attributes
        const header = findColumnHeader(row.closest('table'), index);
        const headerText = header ? header.textContent.toLowerCase() : '';

        if (headerText.includes('cost') || headerText.includes('expense')) {
          cost = value;
        } else if (headerText.includes('price') || headerText.includes('revenue') ||
                   headerText.includes('sell') || headerText.includes('total')) {
          price = value;
        } else if (cell.dataset.field === 'cost') {
          cost = value;
        } else if (cell.dataset.field === 'price') {
          price = value;
        } else {
          // Fallback: first numeric value is cost, second is price
          if (cost === 0) {
            cost = value;
          } else if (price === 0) {
            price = value;
          }
        }
      }
    });

    return { cost, price };
  }

  /**
   * Find column header for a given column index
   * @param {HTMLElement} table - The table element
   * @param {number} colIndex - The column index
   * @returns {HTMLElement|null} The header cell
   */
  function findColumnHeader(table, colIndex) {
    if (!table) return null;
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr:first-child');
    if (!headerRow) return null;
    const headers = headerRow.querySelectorAll('th, td');
    return headers[colIndex] || null;
  }

  /**
   * Create the summary panel
   */
  function createSummaryPanel() {
    if (summaryPanel) return;

    summaryPanel = document.createElement('div');
    summaryPanel.className = 'jt-quicksum-panel hidden';
    summaryPanel.id = 'jt-quicksum-panel';

    summaryPanel.innerHTML = `
      <div class="jt-quicksum-panel-header">
        <span class="jt-quicksum-panel-title">Quick Sum</span>
        <span class="jt-quicksum-panel-count" id="jt-quicksum-count">0 items</span>
      </div>
      <div class="jt-quicksum-panel-body">
        <span class="jt-quicksum-label">Cost:</span>
        <span class="jt-quicksum-value cost" id="jt-quicksum-cost">$0.00</span>

        <span class="jt-quicksum-label">Price:</span>
        <span class="jt-quicksum-value price" id="jt-quicksum-price">$0.00</span>

        <div class="jt-quicksum-divider"></div>

        <span class="jt-quicksum-label">Margin $:</span>
        <span class="jt-quicksum-value margin" id="jt-quicksum-margin">$0.00</span>

        <span class="jt-quicksum-label">Margin %:</span>
        <span class="jt-quicksum-value margin" id="jt-quicksum-margin-pct">0.0%</span>
      </div>
      <div class="jt-quicksum-actions">
        <button class="jt-quicksum-btn jt-quicksum-btn-clear" id="jt-quicksum-clear">Clear Selection</button>
        <button class="jt-quicksum-btn jt-quicksum-btn-selectall" id="jt-quicksum-selectall">Select All</button>
      </div>
    `;

    document.body.appendChild(summaryPanel);

    // Attach event listeners
    document.getElementById('jt-quicksum-clear').addEventListener('click', clearSelection);
    document.getElementById('jt-quicksum-selectall').addEventListener('click', selectAllVisible);

    console.log('QuickSum: Summary panel created');
  }

  /**
   * Update the summary panel with current selection
   */
  function updateSummary() {
    if (!summaryPanel) return;

    if (selectedRows.size === 0) {
      summaryPanel.classList.add('hidden');
      return;
    }

    summaryPanel.classList.remove('hidden');

    let totalCost = 0;
    let totalPrice = 0;

    selectedRows.forEach(row => {
      const values = extractRowValues(row);
      totalCost += values.cost;
      totalPrice += values.price;
    });

    const margin = totalPrice - totalCost;
    const marginPercent = totalPrice > 0 ? (margin / totalPrice) * 100 : 0;

    // Update display
    document.getElementById('jt-quicksum-count').textContent =
      `${selectedRows.size} item${selectedRows.size !== 1 ? 's' : ''}`;
    document.getElementById('jt-quicksum-cost').textContent = formatCurrency(totalCost);
    document.getElementById('jt-quicksum-price').textContent = formatCurrency(totalPrice);
    document.getElementById('jt-quicksum-margin').textContent = formatCurrency(margin);

    const marginPctEl = document.getElementById('jt-quicksum-margin-pct');
    marginPctEl.textContent = `${marginPercent.toFixed(1)}%`;

    // Update margin color for negative values
    const marginEl = document.getElementById('jt-quicksum-margin');
    if (margin < 0) {
      marginEl.classList.add('negative');
      marginPctEl.classList.add('negative');
    } else {
      marginEl.classList.remove('negative');
      marginPctEl.classList.remove('negative');
    }
  }

  /**
   * Toggle row selection
   * @param {HTMLElement} row - The row to toggle
   * @param {boolean} isSelected - Whether the row is selected
   */
  function toggleRowSelection(row, isSelected) {
    if (isSelected) {
      selectedRows.add(row);
      row.classList.add('jt-quicksum-selected');
    } else {
      selectedRows.delete(row);
      row.classList.remove('jt-quicksum-selected');
    }
    updateSummary();
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    selectedRows.forEach(row => {
      row.classList.remove('jt-quicksum-selected');
      const checkbox = row.querySelector('.jt-quicksum-checkbox');
      if (checkbox) checkbox.checked = false;
    });
    selectedRows.clear();
    updateSummary();
    console.log('QuickSum: Selection cleared');
  }

  /**
   * Select all visible rows
   */
  function selectAllVisible() {
    const rows = findBudgetRows();
    rows.forEach(row => {
      if (!processedRows.has(row)) return;
      const checkbox = row.querySelector('.jt-quicksum-checkbox');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        toggleRowSelection(row, true);
      }
    });
    console.log('QuickSum: Selected all visible rows');
  }

  /**
   * Add checkbox to a budget row
   * @param {HTMLElement} row - The table row
   */
  function addCheckboxToRow(row) {
    if (processedRows.has(row)) return;
    if (row.querySelector('.jt-quicksum-checkbox')) return;

    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'jt-quicksum-checkbox';
    checkbox.title = 'Select for Quick Sum';

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleRowSelection(row, checkbox.checked);
    });

    // Prevent checkbox click from triggering row click
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Find the first cell and prepend the checkbox
    const firstCell = row.querySelector('td');
    if (firstCell) {
      // Create a wrapper to avoid layout issues
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';

      // Move existing content into wrapper
      while (firstCell.firstChild) {
        wrapper.appendChild(firstCell.firstChild);
      }

      // Add checkbox and wrapper
      firstCell.insertBefore(checkbox, firstCell.firstChild);
      firstCell.appendChild(wrapper);
    }

    processedRows.add(row);
  }

  /**
   * Process all budget rows
   */
  function processBudgetRows() {
    if (!isBudgetPage()) {
      console.log('QuickSum: Not on a budget page');
      return;
    }

    const rows = findBudgetRows();
    rows.forEach(addCheckboxToRow);

    if (rows.length > 0) {
      console.log(`QuickSum: Processed ${rows.length} rows`);
    }
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActiveState) {
      console.log('QuickSum: Already initialized');
      return;
    }

    console.log('QuickSum: Initializing...');
    isActiveState = true;

    // Inject styles
    injectStyles();

    // Create summary panel
    createSummaryPanel();

    // Process existing rows
    processBudgetRows();

    // Watch for new rows being added
    observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new content might be budget-related
              if (node.tagName === 'TR' ||
                  node.tagName === 'TABLE' ||
                  node.tagName === 'TBODY' ||
                  (node.querySelector && (
                    node.querySelector('tr') ||
                    node.querySelector('table')
                  ))) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (shouldProcess) break;
      }

      if (shouldProcess) {
        // Debounce processing
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          processBudgetRows();
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    const urlCheckInterval = setInterval(() => {
      if (!isActiveState) {
        clearInterval(urlCheckInterval);
        return;
      }
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Clear selection on navigation
        clearSelection();
        // Re-process after navigation
        setTimeout(() => {
          processBudgetRows();
        }, 500);
      }
    }, 500);

    console.log('QuickSum: Feature loaded');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) {
      console.log('QuickSum: Not active, nothing to cleanup');
      return;
    }

    console.log('QuickSum: Cleaning up...');
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

    // Clear selection
    selectedRows.clear();

    // Remove checkboxes from rows
    document.querySelectorAll('.jt-quicksum-checkbox').forEach(checkbox => {
      checkbox.remove();
    });

    // Remove selected class from rows
    document.querySelectorAll('.jt-quicksum-selected').forEach(row => {
      row.classList.remove('jt-quicksum-selected');
    });

    // Remove summary panel
    if (summaryPanel) {
      summaryPanel.remove();
      summaryPanel = null;
    }

    // Remove styles
    removeStyles();

    console.log('QuickSum: Cleanup complete');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActiveState,
    // Expose for keyboard shortcuts or external use
    clearSelection,
    selectAllVisible,
    getSelectedCount: () => selectedRows.size
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.BudgetQuickSumFeature = BudgetQuickSumFeature;
}
