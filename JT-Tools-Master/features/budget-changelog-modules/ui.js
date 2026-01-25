// Budget Changelog - UI Module
// Injects comparison UI into the Budget Backups sidebar

const BudgetChangelogUI = (() => {
  let diffModal = null;

  /**
   * Inject compare controls into the Budget Backups sidebar
   * @param {HTMLElement} sidebar - The Budget Backups sidebar element
   * @param {Array} backups - List of backup objects from API
   */
  function injectCompareControls(sidebar, backups) {
    // Check if we already injected
    if (sidebar.querySelector('#jt-budget-compare-controls')) {
      return;
    }

    // Find the header area of the sidebar
    const header = sidebar.querySelector('h2, [class*="font-bold"]');
    if (!header) {
      console.warn('BudgetChangelog: Could not find sidebar header');
      return;
    }

    // Create compare controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'jt-budget-compare-controls';
    controlsContainer.className = 'p-3 border-b bg-gray-50';
    controlsContainer.innerHTML = `
      <div class="text-sm font-medium text-gray-700 mb-2">Compare Backups</div>
      <div class="flex gap-2 items-center mb-2">
        <select id="jt-backup-old" class="flex-1 text-xs border rounded p-1.5 bg-white">
          <option value="">Select older backup...</option>
        </select>
        <span class="text-gray-400">→</span>
        <select id="jt-backup-new" class="flex-1 text-xs border rounded p-1.5 bg-white">
          <option value="">Select newer backup...</option>
        </select>
      </div>
      <button id="jt-compare-btn" class="w-full text-xs bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-1.5 px-3 rounded disabled:opacity-50 disabled:cursor-not-allowed transition">
        Compare Selected Backups
      </button>
      <div id="jt-compare-status" class="text-xs text-gray-500 mt-2 hidden"></div>
    `;

    // Insert after header's parent container
    const headerContainer = header.closest('div');
    if (headerContainer) {
      headerContainer.after(controlsContainer);
    } else {
      sidebar.insertBefore(controlsContainer, sidebar.firstChild);
    }

    // Populate dropdowns
    populateBackupDropdowns(backups);

    // Set up event listeners
    setupCompareEventListeners();
  }

  /**
   * Populate the backup selection dropdowns
   * @param {Array} backups - List of backup objects
   */
  function populateBackupDropdowns(backups) {
    const oldSelect = document.getElementById('jt-backup-old');
    const newSelect = document.getElementById('jt-backup-new');

    if (!oldSelect || !newSelect) return;

    // Sort backups by date (newest first)
    const sortedBackups = [...backups].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Clear existing options (keep placeholder)
    oldSelect.innerHTML = '<option value="">Select older backup...</option>';
    newSelect.innerHTML = '<option value="">Select newer backup...</option>';

    // Add backup options
    for (const backup of sortedBackups) {
      const date = new Date(backup.createdAt);
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      const user = backup.createdByUser?.name || 'Unknown';

      const optionHtml = `<option value="${backup.id}" data-url="${backup.url || ''}" data-date="${backup.createdAt}">${dateStr} - ${user}</option>`;

      oldSelect.insertAdjacentHTML('beforeend', optionHtml);
      newSelect.insertAdjacentHTML('beforeend', optionHtml);
    }

    // Pre-select most recent two if available
    if (sortedBackups.length >= 2) {
      newSelect.value = sortedBackups[0].id;
      oldSelect.value = sortedBackups[1].id;
    }
  }

  /**
   * Set up event listeners for compare controls
   */
  function setupCompareEventListeners() {
    const oldSelect = document.getElementById('jt-backup-old');
    const newSelect = document.getElementById('jt-backup-new');
    const compareBtn = document.getElementById('jt-compare-btn');

    if (!oldSelect || !newSelect || !compareBtn) return;

    // Enable/disable compare button based on selections
    const updateButtonState = () => {
      const canCompare = oldSelect.value && newSelect.value && oldSelect.value !== newSelect.value;
      compareBtn.disabled = !canCompare;
    };

    oldSelect.addEventListener('change', updateButtonState);
    newSelect.addEventListener('change', updateButtonState);

    // Initial button state
    updateButtonState();

    // Compare button click
    compareBtn.addEventListener('click', async () => {
      const oldOption = oldSelect.selectedOptions[0];
      const newOption = newSelect.selectedOptions[0];

      if (!oldOption?.value || !newOption?.value) return;

      await performComparison({
        oldId: oldOption.value,
        oldUrl: oldOption.dataset.url,
        oldDate: oldOption.dataset.date,
        newId: newOption.value,
        newUrl: newOption.dataset.url,
        newDate: newOption.dataset.date
      });
    });
  }

  /**
   * Perform the backup comparison
   * @param {Object} options - Comparison options with URLs and dates
   */
  async function performComparison(options) {
    const statusEl = document.getElementById('jt-compare-status');
    const compareBtn = document.getElementById('jt-compare-btn');

    try {
      // Show loading state
      if (statusEl) {
        statusEl.textContent = 'Downloading backups...';
        statusEl.classList.remove('hidden', 'text-red-500');
        statusEl.classList.add('text-gray-500');
      }
      if (compareBtn) {
        compareBtn.disabled = true;
        compareBtn.textContent = 'Comparing...';
      }

      // Fetch both CSVs
      const [oldCsv, newCsv] = await Promise.all([
        fetchBackupCSV(options.oldUrl, options.oldId),
        fetchBackupCSV(options.newUrl, options.newId)
      ]);

      if (statusEl) {
        statusEl.textContent = 'Analyzing changes...';
      }

      // Parse CSVs
      const oldItems = BudgetCSVParser.parse(oldCsv);
      const newItems = BudgetCSVParser.parse(newCsv);

      // Compare
      const diff = BudgetDiffEngine.compare(oldItems, newItems);

      // Show results
      showDiffModal(diff, {
        oldDate: formatDate(options.oldDate),
        newDate: formatDate(options.newDate)
      });

      if (statusEl) {
        statusEl.classList.add('hidden');
      }

    } catch (error) {
      console.error('BudgetChangelog: Comparison error:', error);
      if (statusEl) {
        statusEl.textContent = 'Error: ' + (error.message || 'Failed to compare backups');
        statusEl.classList.remove('hidden', 'text-gray-500');
        statusEl.classList.add('text-red-500');
      }
    } finally {
      if (compareBtn) {
        compareBtn.disabled = false;
        compareBtn.textContent = 'Compare Selected Backups';
      }
    }
  }

  /**
   * Fetch CSV content from a backup URL
   * @param {string} url - Backup download URL
   * @param {string} backupId - Backup ID (for API fallback)
   * @returns {Promise<string>} CSV text content
   */
  async function fetchBackupCSV(url, backupId) {
    // If we have a direct URL, use it
    if (url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download backup: ${response.status}`);
      }
      return await response.text();
    }

    // Otherwise, we need to get the URL via API
    // This would require JobTreadProService integration
    throw new Error('Backup URL not available. Please refresh the page and try again.');
  }

  /**
   * Format a date string for display
   * @param {string} dateStr - ISO date string
   * @returns {string} Formatted date
   */
  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  /**
   * Show the diff results in a modal
   * @param {Object} diff - Diff result from BudgetDiffEngine
   * @param {Object} options - Display options (dates, etc.)
   */
  function showDiffModal(diff, options = {}) {
    // Remove existing modal if any
    closeDiffModal();

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'jt-diff-modal-backdrop';
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeDiffModal();
    };

    // Create modal content
    const modal = document.createElement('div');
    modal.id = 'jt-diff-modal';
    modal.className = 'bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col';
    modal.innerHTML = `
      <div class="flex items-center justify-between p-4 border-b">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Budget Changelog</h2>
          <p class="text-sm text-gray-500">${options.oldDate || 'Older'} → ${options.newDate || 'Newer'}</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="jt-diff-copy-btn" class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition">
            Copy Summary
          </button>
          <button id="jt-diff-close-btn" class="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div class="overflow-auto flex-1 p-4">
        ${renderDiffContent(diff)}
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    diffModal = backdrop;

    // Set up modal event listeners
    document.getElementById('jt-diff-close-btn')?.addEventListener('click', closeDiffModal);
    document.getElementById('jt-diff-copy-btn')?.addEventListener('click', () => {
      copyDiffSummary(diff, options);
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeDiffModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Close the diff modal
   */
  function closeDiffModal() {
    if (diffModal) {
      diffModal.remove();
      diffModal = null;
    }
  }

  /**
   * Render the diff content HTML
   * @param {Object} diff - Diff result
   * @returns {string} HTML string
   */
  function renderDiffContent(diff) {
    if (!diff.hasChanges) {
      return `
        <div class="text-center py-8 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-lg font-medium">No Changes Detected</p>
          <p class="text-sm">These two backups are identical.</p>
        </div>
      `;
    }

    const { summary } = diff;
    let html = '';

    // Summary cards
    html += `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-gray-50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold ${summary.costChange >= 0 ? 'text-green-600' : 'text-red-600'}">
            ${BudgetDiffEngine.formatDelta(summary.costChange, true)}
          </div>
          <div class="text-xs text-gray-500">Cost Change</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold ${summary.priceChange >= 0 ? 'text-green-600' : 'text-red-600'}">
            ${BudgetDiffEngine.formatDelta(summary.priceChange, true)}
          </div>
          <div class="text-xs text-gray-500">Price Change</div>
        </div>
        <div class="bg-green-50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-green-600">+${summary.addedCount}</div>
          <div class="text-xs text-gray-500">Items Added</div>
        </div>
        <div class="bg-red-50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-red-600">-${summary.removedCount}</div>
          <div class="text-xs text-gray-500">Items Removed</div>
        </div>
      </div>
    `;

    // Added items
    if (diff.added.length > 0) {
      html += `
        <div class="mb-6">
          <h3 class="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
            <span class="w-2 h-2 bg-green-500 rounded-full"></span>
            Added Items (${diff.added.length})
          </h3>
          <div class="space-y-2">
            ${diff.added.map(item => renderAddedItem(item)).join('')}
          </div>
        </div>
      `;
    }

    // Removed items
    if (diff.removed.length > 0) {
      html += `
        <div class="mb-6">
          <h3 class="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
            <span class="w-2 h-2 bg-red-500 rounded-full"></span>
            Removed Items (${diff.removed.length})
          </h3>
          <div class="space-y-2">
            ${diff.removed.map(item => renderRemovedItem(item)).join('')}
          </div>
        </div>
      `;
    }

    // Modified items
    if (diff.modified.length > 0) {
      html += `
        <div class="mb-6">
          <h3 class="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-2">
            <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
            Modified Items (${diff.modified.length})
          </h3>
          <div class="space-y-2">
            ${diff.modified.map(mod => renderModifiedItem(mod)).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render an added item card
   * @param {Object} item - Budget item
   * @returns {string} HTML string
   */
  function renderAddedItem(item) {
    const location = item.hierarchy.slice(0, -1).join(' > ') || 'Root';
    return `
      <div class="bg-green-50 border border-green-200 rounded p-3">
        <div class="font-medium text-green-800">${escapeHtml(item.name)}</div>
        <div class="text-xs text-green-600 mb-1">${escapeHtml(location)}</div>
        <div class="flex gap-4 text-xs text-green-700">
          ${item.extendedCost !== null ? `<span>Cost: ${BudgetDiffEngine.formatCurrency(item.extendedCost)}</span>` : ''}
          ${item.extendedPrice !== null ? `<span>Price: ${BudgetDiffEngine.formatCurrency(item.extendedPrice)}</span>` : ''}
          ${item.quantity !== null ? `<span>Qty: ${item.quantity} ${item.unit || ''}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render a removed item card
   * @param {Object} item - Budget item
   * @returns {string} HTML string
   */
  function renderRemovedItem(item) {
    const location = item.hierarchy.slice(0, -1).join(' > ') || 'Root';
    return `
      <div class="bg-red-50 border border-red-200 rounded p-3">
        <div class="font-medium text-red-800">${escapeHtml(item.name)}</div>
        <div class="text-xs text-red-600 mb-1">${escapeHtml(location)}</div>
        <div class="flex gap-4 text-xs text-red-700">
          ${item.extendedCost !== null ? `<span>Cost: ${BudgetDiffEngine.formatCurrency(item.extendedCost)}</span>` : ''}
          ${item.extendedPrice !== null ? `<span>Price: ${BudgetDiffEngine.formatCurrency(item.extendedPrice)}</span>` : ''}
          ${item.quantity !== null ? `<span>Qty: ${item.quantity} ${item.unit || ''}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render a modified item card
   * @param {Object} mod - Modified item with changes
   * @returns {string} HTML string
   */
  function renderModifiedItem(mod) {
    const { item, changes } = mod;
    const location = item.hierarchy.slice(0, -1).join(' > ') || 'Root';

    const changesHtml = changes.map(change => {
      if (change.type === 'text' && change.field === 'description') {
        return `<div class="text-xs"><span class="text-gray-500">${change.label}:</span> <span class="text-yellow-700">(description changed)</span></div>`;
      }

      let oldDisplay = change.oldValue;
      let newDisplay = change.newValue;

      if (change.isCurrency) {
        oldDisplay = BudgetDiffEngine.formatCurrency(change.oldValue);
        newDisplay = BudgetDiffEngine.formatCurrency(change.newValue);
      } else if (change.type === 'boolean') {
        oldDisplay = change.oldValue ? 'Yes' : 'No';
        newDisplay = change.newValue ? 'Yes' : 'No';
      } else if (!oldDisplay && oldDisplay !== 0) {
        oldDisplay = '(empty)';
      }

      return `
        <div class="text-xs">
          <span class="text-gray-500">${change.label}:</span>
          <span class="text-red-600 line-through">${escapeHtml(String(oldDisplay))}</span>
          <span class="text-gray-400">→</span>
          <span class="text-green-600">${escapeHtml(String(newDisplay))}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="bg-yellow-50 border border-yellow-200 rounded p-3">
        <div class="font-medium text-yellow-800">${escapeHtml(item.name)}</div>
        <div class="text-xs text-yellow-600 mb-2">${escapeHtml(location)}</div>
        <div class="space-y-1">
          ${changesHtml}
        </div>
      </div>
    `;
  }

  /**
   * Copy diff summary to clipboard
   * @param {Object} diff - Diff result
   * @param {Object} options - Options with dates
   */
  async function copyDiffSummary(diff, options) {
    const summary = BudgetDiffEngine.generateTextSummary(diff, options);
    const copyBtn = document.getElementById('jt-diff-copy-btn');

    try {
      await navigator.clipboard.writeText(summary);
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('bg-green-100', 'text-green-700');
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('bg-green-100', 'text-green-700');
        }, 2000);
      }
    } catch (error) {
      console.error('BudgetChangelog: Failed to copy to clipboard:', error);
      if (copyBtn) {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Summary';
        }, 2000);
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Remove all injected UI elements
   */
  function cleanup() {
    closeDiffModal();
    const controls = document.getElementById('jt-budget-compare-controls');
    if (controls) {
      controls.remove();
    }
  }

  // Public API
  return {
    injectCompareControls,
    populateBackupDropdowns,
    showDiffModal,
    closeDiffModal,
    cleanup
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BudgetChangelogUI = BudgetChangelogUI;
}
