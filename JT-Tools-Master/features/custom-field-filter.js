// JobTread Custom Field Filter Feature
// API-powered filtering of jobs by custom field values in the Job Switcher sidebar
// Supports multi-select filtering (OR logic) and saved filters shared across company
// Requires Power User tier and API configuration (Worker or Direct)

const CustomFieldFilterFeature = (() => {
  let isActive = false;
  let sidebarObserver = null;
  let customFieldDefinitions = null;
  let filterContainer = null;
  let activeFilters = {};
  let savedFilters = [];
  let activeSavedFilterId = null;
  let dropdownOpen = false;
  let availableValues = [];

  const SIDEBAR_SELECTOR = 'div.z-30.absolute.top-0.bottom-0.right-0';

  /**
   * Check if a sidebar element is specifically the Job Switcher
   */
  function isJobSwitcherSidebar(sidebar) {
    if (!sidebar) return false;

    // Check for "JOB SWITCHER" text in the header
    const headerText = sidebar.textContent || '';
    if (headerText.includes('JOB SWITCHER') || headerText.includes('Job Switcher')) {
      return true;
    }

    // Check for job search input placeholder
    const searchInput = sidebar.querySelector('input[placeholder*="Search Jobs"]') ||
                       sidebar.querySelector('input[placeholder*="Search jobs"]');
    if (searchInput) {
      return true;
    }

    return false;
  }

  /**
   * Find the Job Switcher sidebar specifically
   */
  function findJobSwitcherSidebar() {
    const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
    for (const sidebar of sidebars) {
      if (isJobSwitcherSidebar(sidebar)) {
        return sidebar;
      }
    }
    return null;
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActive) {
      return;
    }

    isActive = true;

    // Start observing for sidebar to add filter UI
    startSidebarObserver();

    console.log('CustomFieldFilter: Activated');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      return;
    }

    isActive = false;

    // Stop sidebar observer
    stopSidebarObserver();

    // Remove click-outside listener
    document.removeEventListener('click', handleClickOutside);

    // Remove any injected UI
    const existingFilter = document.getElementById('jt-custom-field-filter');
    if (existingFilter) {
      existingFilter.remove();
    }

    // Reset state
    customFieldDefinitions = null;
    filterContainer = null;
    activeFilters = {};
    savedFilters = [];
    activeSavedFilterId = null;
    dropdownOpen = false;
    availableValues = [];

    console.log('CustomFieldFilter: Deactivated');
  }

  /**
   * Start observing for sidebar appearances
   */
  function startSidebarObserver() {
    if (sidebarObserver) {
      return;
    }

    sidebarObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const sidebar = node.matches?.(SIDEBAR_SELECTOR)
              ? node
              : node.querySelector?.(SIDEBAR_SELECTOR);

            if (sidebar) {
              // Small delay to ensure sidebar is fully rendered
              setTimeout(() => {
                if (isJobSwitcherSidebar(sidebar)) {
                  const searchInput = sidebar.querySelector('input[placeholder*="Search"]') ||
                                     sidebar.querySelector('input');
                  if (searchInput) {
                    injectFilterUI(searchInput);
                  }
                }
              }, 100);
            }
          }
        }
      }
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check if sidebar is already present
    const existingSidebar = findJobSwitcherSidebar();
    if (existingSidebar) {
      const searchInput = existingSidebar.querySelector('input[placeholder*="Search"]') ||
                         existingSidebar.querySelector('input');
      if (searchInput) {
        injectFilterUI(searchInput);
      }
    }
  }

  /**
   * Stop observing for sidebar appearances
   */
  function stopSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }
  }

  /**
   * Inject custom field filter UI after the search input
   */
  async function injectFilterUI(searchInput) {
    // Check if API is configured (Worker or Direct)
    let isApiConfigured = false;

    // Check Worker API first (Pro Service)
    if (typeof JobTreadProService !== 'undefined') {
      isApiConfigured = await JobTreadProService.isConfigured();
    }

    // Fall back to Direct API if Worker not configured
    if (!isApiConfigured && typeof JobTreadAPI !== 'undefined') {
      isApiConfigured = await JobTreadAPI.isFullyConfigured();
    }

    if (!isApiConfigured) {
      return;
    }

    // Check if we already injected the filter UI
    const existing = document.getElementById('jt-custom-field-filter');
    if (existing) {
      return;
    }

    // Find the search input container (parent div with p-2 class)
    const searchContainer = searchInput.closest('div.p-2');

    if (!searchContainer) {
      return;
    }

    // Create filter container
    filterContainer = document.createElement('div');
    filterContainer.id = 'jt-custom-field-filter';
    filterContainer.className = 'p-2 pt-0';
    filterContainer.innerHTML = `
      <div class="flex items-center gap-2 mb-2">
        <select id="jt-cf-status-select" class="rounded-sm border p-1 text-sm flex-1 appearance-none bg-white hover:bg-gray-50 focus:border-cyan-500 focus:shadow-sm transition" style="min-width: 0;">
          <option value="all">All Jobs</option>
          <option value="open">Open Jobs</option>
          <option value="closed">Closed Jobs</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <select id="jt-cf-field-select" class="rounded-sm border p-1 text-sm flex-1 appearance-none bg-white hover:bg-gray-50 focus:border-cyan-500 focus:shadow-sm transition" style="min-width: 0;">
          <option value="">Filter by Custom Field...</option>
        </select>
      </div>
      <div id="jt-cf-values-row" class="flex items-center gap-2 mt-2" style="display: none;">
        <div id="jt-cf-value-dropdown" class="relative flex-1" style="min-width: 0;">
          <button id="jt-cf-value-trigger" class="rounded-sm border p-1 text-sm w-full text-left bg-white hover:bg-gray-50 focus:border-cyan-500 focus:shadow-sm transition flex items-center justify-between" type="button">
            <span id="jt-cf-value-label" class="truncate text-gray-500">Select values...</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 shrink-0 ml-1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="jt-cf-value-panel" class="absolute z-50 mt-1 w-full rounded-sm border bg-white shadow-lg" style="display: none; max-height: 220px;">
            <div class="flex items-center justify-between p-1 border-b text-xs">
              <button id="jt-cf-select-all" class="text-cyan-600 hover:text-cyan-700 font-medium px-1">Select All</button>
              <button id="jt-cf-clear-all" class="text-gray-500 hover:text-gray-700 font-medium px-1">Clear All</button>
            </div>
            <div id="jt-cf-value-list" class="overflow-y-auto" style="max-height: 180px;"></div>
          </div>
        </div>
        <button id="jt-cf-save-filter-btn" class="rounded-sm border p-1 text-sm bg-white hover:bg-gray-50 text-gray-500" style="display: none;" title="Save current filter">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        </button>
        <button id="jt-cf-delete-filter-btn" class="rounded-sm border p-1 text-sm bg-white hover:bg-red-50 text-gray-500 hover:text-red-500" style="display: none;" title="Delete saved filter">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4" viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <button id="jt-cf-clear-btn" class="rounded-sm border p-1 text-sm bg-white hover:bg-gray-50 text-gray-500" style="display: none;" title="Clear filter">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>
        </button>
      </div>
      <div id="jt-cf-save-input-row" class="flex items-center gap-1 mt-2" style="display: none;">
        <input id="jt-cf-save-name" type="text" placeholder="Filter name..." class="rounded-sm border p-1 text-xs flex-1" style="min-width: 0;" maxlength="50">
        <button id="jt-cf-save-confirm" class="rounded-sm border p-1 text-xs bg-cyan-500 text-white hover:bg-cyan-600" title="Save">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </button>
        <button id="jt-cf-save-cancel" class="rounded-sm border p-1 text-xs bg-white hover:bg-gray-50 text-gray-500" title="Cancel">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div id="jt-cf-status" class="text-xs text-gray-500 mt-1" style="display: none;"></div>
    `;

    // Insert after search container
    searchContainer.after(filterContainer);

    // Load custom field definitions
    await loadCustomFieldDefinitions();

    // Set up event listeners
    setupFilterEventListeners();

    // Load saved filters
    await loadSavedFilters();

    // Add click-outside listener for dropdown
    document.addEventListener('click', handleClickOutside);
  }

  /**
   * Handle clicks outside the dropdown to close it
   */
  function handleClickOutside(e) {
    if (!dropdownOpen) return;
    const dropdown = document.getElementById('jt-cf-value-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      closeValueDropdown();
    }
  }

  /**
   * Load custom field definitions from API
   */
  async function loadCustomFieldDefinitions() {
    const fieldSelect = document.getElementById('jt-cf-field-select');
    if (!fieldSelect) return;

    try {
      // Try Pro Service first (uses Cloudflare Worker)
      let fieldsData;
      if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
        fieldsData = await JobTreadProService.getCustomFields();
        customFieldDefinitions = fieldsData.fields || [];
      } else {
        // Fall back to direct API
        customFieldDefinitions = await JobTreadAPI.fetchCustomFieldDefinitions();
      }

      // Only exclude multipleText - allow all other field types
      // multipleText can have multiple values per job which makes filtering complex
      customFieldDefinitions.forEach(field => {
        // Skip multipleText fields - they can have multiple values per job
        if (field.type === 'multipleText') {
          return;
        }

        const option = document.createElement('option');
        option.value = field.id;
        option.textContent = field.name;
        option.dataset.type = field.type;
        option.dataset.options = JSON.stringify(field.options || []);
        fieldSelect.appendChild(option);
      });

      // Show status message if no fields found
      const statusDiv = document.getElementById('jt-cf-status');
      if (statusDiv && customFieldDefinitions.length === 0) {
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'No Job custom fields found. Create some in JobTread Settings.';
        statusDiv.style.color = '#6b7280';
      }
    } catch (error) {
      console.error('CustomFieldFilter: Failed to load custom fields:', error);
      const statusDiv = document.getElementById('jt-cf-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Failed to load custom fields';
        statusDiv.style.color = '#ef4444';
      }
    }
  }

  // ─── Multi-select checkbox dropdown ──────────────────────────────────

  /**
   * Populate the checkbox dropdown with values
   */
  function populateValueCheckboxes(values) {
    availableValues = values;
    const list = document.getElementById('jt-cf-value-list');
    if (!list) return;

    list.innerHTML = '';

    if (values.length === 0) {
      list.innerHTML = '<div class="p-2 text-xs text-gray-400 text-center">No values found</div>';
      return;
    }

    values.forEach(val => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-sm';
      label.innerHTML = `
        <input type="checkbox" class="jt-cf-value-cb" value="${escapeAttr(val)}" style="accent-color: #06b6d4;">
        <span class="truncate">${escapeHtml(val)}</span>
      `;
      list.appendChild(label);

      // Listen for checkbox changes
      const cb = label.querySelector('input');
      cb.addEventListener('change', onValueCheckboxChange);
    });
  }

  /**
   * Handle checkbox change — update selected values and trigger filter
   */
  function onValueCheckboxChange() {
    const selected = getSelectedValues();
    updateValueLabel(selected);

    // If user manually changes values, clear saved filter tracking
    if (activeSavedFilterId) {
      activeSavedFilterId = null;
      // Reset status dropdown to the current job status
      const statusSelect = document.getElementById('jt-cf-status-select');
      if (statusSelect) statusSelect.value = activeFilters.jobStatus || 'all';
    }

    const clearBtn = document.getElementById('jt-cf-clear-btn');

    if (selected.length > 0) {
      activeFilters.values = selected;
      if (clearBtn) clearBtn.style.display = 'block';
      updateSaveDeleteVisibility();
      applyFilter();
    } else {
      delete activeFilters.values;
      if (clearBtn) clearBtn.style.display = 'none';
      updateSaveDeleteVisibility();
      clearFilter();
    }
  }

  /**
   * Get all currently selected values from checkboxes
   */
  function getSelectedValues() {
    const checkboxes = document.querySelectorAll('.jt-cf-value-cb:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  /**
   * Update the dropdown trigger label with selection count
   */
  function updateValueLabel(selected) {
    const label = document.getElementById('jt-cf-value-label');
    if (!label) return;

    if (selected.length === 0) {
      label.textContent = 'Select values...';
      label.className = 'truncate text-gray-500';
    } else if (selected.length === 1) {
      label.textContent = selected[0];
      label.className = 'truncate text-gray-900';
    } else {
      label.textContent = `${selected.length} values selected`;
      label.className = 'truncate text-gray-900';
    }
  }

  /**
   * Toggle the value dropdown panel
   */
  function toggleValueDropdown() {
    if (dropdownOpen) {
      closeValueDropdown();
    } else {
      openValueDropdown();
    }
  }

  function openValueDropdown() {
    const panel = document.getElementById('jt-cf-value-panel');
    if (panel) {
      panel.style.display = 'block';
      dropdownOpen = true;
    }
  }

  function closeValueDropdown() {
    const panel = document.getElementById('jt-cf-value-panel');
    if (panel) {
      panel.style.display = 'none';
      dropdownOpen = false;
    }
  }

  /**
   * Select all checkboxes
   */
  function selectAllValues() {
    document.querySelectorAll('.jt-cf-value-cb').forEach(cb => { cb.checked = true; });
    onValueCheckboxChange();
  }

  /**
   * Clear all checkboxes
   */
  function clearAllValues() {
    document.querySelectorAll('.jt-cf-value-cb').forEach(cb => { cb.checked = false; });
    onValueCheckboxChange();
  }

  /**
   * Set specific values as checked (for loading saved filters)
   */
  function setCheckedValues(values) {
    document.querySelectorAll('.jt-cf-value-cb').forEach(cb => {
      cb.checked = values.includes(cb.value);
    });
    const selected = getSelectedValues();
    updateValueLabel(selected);
  }

  // ─── Saved Filters ────────────────────────────────────────────────

  /**
   * Load saved filters from account service and populate the status dropdown
   */
  async function loadSavedFilters() {
    const statusSelect = document.getElementById('jt-cf-status-select');
    if (!statusSelect) return;

    // Check if user is logged in
    const isLoggedIn = typeof AccountService !== 'undefined' && AccountService.isLoggedIn();
    if (!isLoggedIn) return;

    try {
      const result = await AccountService.getSavedFilters();
      if (result.success) {
        savedFilters = result.filters || [];
        renderSavedFiltersInDropdown();
      }
    } catch (error) {
      console.error('CustomFieldFilter: Failed to load saved filters:', error);
    }
  }

  /**
   * Render saved filters as options in the status dropdown
   */
  function renderSavedFiltersInDropdown() {
    const statusSelect = document.getElementById('jt-cf-status-select');
    if (!statusSelect) return;

    // Remove existing saved filter optgroup if present
    const existingGroup = statusSelect.querySelector('optgroup[label="Saved Filters"]');
    if (existingGroup) existingGroup.remove();

    if (savedFilters.length === 0) return;

    // Create optgroup for saved filters
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Saved Filters';

    savedFilters.forEach(filter => {
      const option = document.createElement('option');
      option.value = `saved:${filter.id}`;
      option.textContent = filter.name;
      option.dataset.filterId = filter.id;
      optgroup.appendChild(option);
    });

    statusSelect.appendChild(optgroup);
  }

  /**
   * Load a saved filter into the UI and apply it
   */
  async function loadSavedFilter(filter) {
    const fieldSelect = document.getElementById('jt-cf-field-select');
    const valuesRow = document.getElementById('jt-cf-values-row');

    if (!fieldSelect) return;

    // Track which saved filter is active
    activeSavedFilterId = filter.id;

    // Set job status from saved filter
    activeFilters.jobStatus = filter.jobStatus || 'all';

    // Set field — find by field ID or name
    let fieldOption = null;
    for (const opt of fieldSelect.options) {
      if (opt.value === filter.fieldId || opt.textContent === filter.fieldName) {
        fieldOption = opt;
        break;
      }
    }

    if (!fieldOption) {
      console.warn('CustomFieldFilter: Saved filter field not found:', filter.fieldName);
      return;
    }

    fieldSelect.value = fieldOption.value;
    activeFilters.fieldName = filter.fieldName;
    activeFilters.fieldId = filter.fieldId;

    // Show values row and load values
    if (valuesRow) valuesRow.style.display = 'flex';

    // Load values for this field
    const fieldOptions = JSON.parse(fieldOption.dataset.options || '[]');
    const fieldName = fieldOption.textContent;

    if (fieldOptions && fieldOptions.length > 0) {
      populateValueCheckboxes(fieldOptions);
    } else {
      try {
        let values;
        if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
          values = await JobTreadProService.getCustomFieldValues(filter.fieldId, fieldName);
        } else if (typeof JobTreadAPI !== 'undefined') {
          values = await JobTreadAPI.getCustomFieldValues(filter.fieldId);
        } else {
          values = [];
        }
        populateValueCheckboxes(values);
      } catch (error) {
        console.error('CustomFieldFilter: Failed to load values for saved filter:', error);
        populateValueCheckboxes([]);
      }
    }

    // Check the saved values
    const filterValues = filter.filterValues || [];
    setCheckedValues(filterValues);

    // Apply
    activeFilters.values = filterValues;
    const clearBtn = document.getElementById('jt-cf-clear-btn');
    if (clearBtn) clearBtn.style.display = filterValues.length > 0 ? 'block' : 'none';
    updateSaveDeleteVisibility();

    if (filterValues.length > 0) {
      await applyFilter();
    }
  }

  /**
   * Save the current filter configuration
   */
  async function saveCurrentFilter(name) {
    if (!name || !activeFilters.fieldName || !activeFilters.values || activeFilters.values.length === 0) {
      return;
    }

    const isLoggedIn = typeof AccountService !== 'undefined' && AccountService.isLoggedIn();
    if (!isLoggedIn) return;

    const filter = {
      name: name.trim().substring(0, 50),
      fieldId: activeFilters.fieldId || '',
      fieldName: activeFilters.fieldName,
      filterValues: activeFilters.values,
      jobStatus: activeFilters.jobStatus || 'all'
    };

    try {
      const result = await AccountService.saveSavedFilter(filter);
      if (result.success) {
        console.log('CustomFieldFilter: Filter saved:', filter.name);
        await loadSavedFilters();

        // Select the newly saved filter in the dropdown
        if (result.data && result.data.id) {
          activeSavedFilterId = result.data.id;
          const statusSelect = document.getElementById('jt-cf-status-select');
          if (statusSelect) statusSelect.value = `saved:${result.data.id}`;
          updateSaveDeleteVisibility();
        }
      } else {
        console.error('CustomFieldFilter: Failed to save filter:', result.error);
      }
    } catch (error) {
      console.error('CustomFieldFilter: Save filter error:', error);
    }
  }

  /**
   * Delete a saved filter
   */
  async function deleteSavedFilter(filterId) {
    const isLoggedIn = typeof AccountService !== 'undefined' && AccountService.isLoggedIn();
    if (!isLoggedIn) return;

    try {
      const result = await AccountService.deleteSavedFilter(filterId);
      if (result.success) {
        console.log('CustomFieldFilter: Filter deleted:', filterId);
        savedFilters = savedFilters.filter(f => f.id !== filterId);
        renderSavedFiltersInDropdown();
      } else {
        console.error('CustomFieldFilter: Failed to delete filter:', result.error);
      }
    } catch (error) {
      console.error('CustomFieldFilter: Delete filter error:', error);
    }
  }

  /**
   * Show/hide save and delete buttons based on current state
   */
  function updateSaveDeleteVisibility() {
    const saveBtn = document.getElementById('jt-cf-save-filter-btn');
    const deleteBtn = document.getElementById('jt-cf-delete-filter-btn');

    const isLoggedIn = typeof AccountService !== 'undefined' && AccountService.isLoggedIn();
    const hasFilter = activeFilters.fieldName && activeFilters.values && activeFilters.values.length > 0;

    // Show save button when there's an active filter and no saved filter is loaded
    if (saveBtn) {
      saveBtn.style.display = (isLoggedIn && hasFilter && !activeSavedFilterId) ? 'block' : 'none';
    }

    // Show delete button when a saved filter is currently loaded
    if (deleteBtn) {
      deleteBtn.style.display = (isLoggedIn && activeSavedFilterId) ? 'block' : 'none';
    }
  }

  // ─── Event Listeners ──────────────────────────────────────────────

  /**
   * Set up event listeners for filter controls
   */
  function setupFilterEventListeners() {
    const statusSelect = document.getElementById('jt-cf-status-select');
    const fieldSelect = document.getElementById('jt-cf-field-select');
    const clearBtn = document.getElementById('jt-cf-clear-btn');
    const valueTrigger = document.getElementById('jt-cf-value-trigger');
    const selectAllBtn = document.getElementById('jt-cf-select-all');
    const clearAllBtn = document.getElementById('jt-cf-clear-all');
    const saveFilterBtn = document.getElementById('jt-cf-save-filter-btn');
    const deleteFilterBtn = document.getElementById('jt-cf-delete-filter-btn');
    const saveConfirmBtn = document.getElementById('jt-cf-save-confirm');
    const saveCancelBtn = document.getElementById('jt-cf-save-cancel');
    const saveNameInput = document.getElementById('jt-cf-save-name');

    // Job status / saved filter select
    if (statusSelect) {
      statusSelect.addEventListener('change', async (e) => {
        const value = e.target.value;

        // Check if a saved filter was selected
        if (value.startsWith('saved:')) {
          const filterId = value.replace('saved:', '');
          const filter = savedFilters.find(f => f.id === filterId);
          if (filter) {
            await loadSavedFilter(filter);
          }
          return;
        }

        // Regular status filter (all/open/closed)
        activeSavedFilterId = null;
        activeFilters.jobStatus = value;

        // If we have a custom field filter active, re-apply with new status
        if (activeFilters.fieldName && activeFilters.values && activeFilters.values.length > 0) {
          await applyFilter();
        } else {
          // Just filter by status alone
          await applyStatusFilter();
        }

        updateSaveDeleteVisibility();
      });
    }

    // Field selector
    if (fieldSelect) {
      fieldSelect.addEventListener('change', async (e) => {
        const fieldId = e.target.value;
        const selectedOption = e.target.selectedOptions[0];
        const valuesRow = document.getElementById('jt-cf-values-row');

        // Clear saved filter tracking when manually changing fields
        activeSavedFilterId = null;

        if (!fieldId) {
          if (valuesRow) valuesRow.style.display = 'none';
          if (clearBtn) clearBtn.style.display = 'none';
          closeValueDropdown();
          clearFilter();
          return;
        }

        // Show values row
        if (valuesRow) valuesRow.style.display = 'flex';

        const fieldOptions = JSON.parse(selectedOption.dataset.options || '[]');
        const fieldName = selectedOption.textContent;

        // Store the selected field info
        activeFilters.fieldName = fieldName;
        activeFilters.fieldId = fieldId;
        delete activeFilters.values;

        // Update label
        const label = document.getElementById('jt-cf-value-label');
        if (label) {
          label.textContent = 'Loading values...';
          label.className = 'truncate text-gray-400';
        }

        // Populate checkboxes
        if (fieldOptions && fieldOptions.length > 0) {
          populateValueCheckboxes(fieldOptions);
          updateValueLabel([]);
        } else {
          try {
            let values;
            if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
              values = await JobTreadProService.getCustomFieldValues(fieldId, fieldName);
            } else if (typeof JobTreadAPI !== 'undefined') {
              values = await JobTreadAPI.getCustomFieldValues(fieldId);
            } else {
              throw new Error('No API configured');
            }

            populateValueCheckboxes(values);
            updateValueLabel([]);

            if (values.length === 0) {
              const list = document.getElementById('jt-cf-value-list');
              if (list) list.innerHTML = '<div class="p-2 text-xs text-gray-400 text-center">No values found</div>';
            }
          } catch (error) {
            console.error('CustomFieldFilter: Failed to get field values:', error);
            const list = document.getElementById('jt-cf-value-list');
            if (list) list.innerHTML = '<div class="p-2 text-xs text-red-400 text-center">Error loading values</div>';
          }
        }

        if (clearBtn) clearBtn.style.display = 'none';
        updateSaveDeleteVisibility();
      });
    }

    // Value dropdown trigger
    if (valueTrigger) {
      valueTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleValueDropdown();
      });
    }

    // Select All / Clear All
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectAllValues();
      });
    }
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllValues();
      });
    }

    // Clear button — resets everything back to default
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        activeSavedFilterId = null;
        clearFilter();
        if (fieldSelect) fieldSelect.value = '';
        if (statusSelect) statusSelect.value = activeFilters.jobStatus || 'all';
        const valuesRow = document.getElementById('jt-cf-values-row');
        if (valuesRow) valuesRow.style.display = 'none';
        closeValueDropdown();
        clearBtn.style.display = 'none';
        hideSaveInput();
        updateSaveDeleteVisibility();
      });
    }

    // Save filter button — show name input
    if (saveFilterBtn) {
      saveFilterBtn.addEventListener('click', () => {
        const inputRow = document.getElementById('jt-cf-save-input-row');
        if (inputRow) {
          inputRow.style.display = 'flex';
          saveFilterBtn.style.display = 'none';
          if (saveNameInput) {
            saveNameInput.value = '';
            saveNameInput.focus();
          }
        }
      });
    }

    // Delete saved filter button
    if (deleteFilterBtn) {
      deleteFilterBtn.addEventListener('click', async () => {
        if (!activeSavedFilterId) return;
        await deleteSavedFilter(activeSavedFilterId);
        activeSavedFilterId = null;

        // Reset status dropdown to 'all'
        if (statusSelect) statusSelect.value = 'all';

        // Clear the filter UI
        clearFilter();
        if (fieldSelect) fieldSelect.value = '';
        const valuesRow = document.getElementById('jt-cf-values-row');
        if (valuesRow) valuesRow.style.display = 'none';
        closeValueDropdown();
        if (clearBtn) clearBtn.style.display = 'none';
        hideSaveInput();
        updateSaveDeleteVisibility();
      });
    }

    // Save confirm
    if (saveConfirmBtn) {
      saveConfirmBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (saveNameInput && saveNameInput.value.trim()) {
          await saveCurrentFilter(saveNameInput.value);
          hideSaveInput();
        }
      });
    }

    // Save cancel
    if (saveCancelBtn) {
      saveCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideSaveInput();
      });
    }

    // Enter key on save name input
    if (saveNameInput) {
      saveNameInput.addEventListener('keydown', async (e) => {
        // Stop propagation to prevent Job Switcher's Enter handler from
        // intercepting and closing the sidebar before the save completes
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.stopPropagation();
        }
        if (e.key === 'Enter' && saveNameInput.value.trim()) {
          e.preventDefault();
          await saveCurrentFilter(saveNameInput.value);
          hideSaveInput();
        } else if (e.key === 'Escape') {
          hideSaveInput();
        }
      });
    }
  }

  /**
   * Hide the save input row and show the save button
   */
  function hideSaveInput() {
    const inputRow = document.getElementById('jt-cf-save-input-row');
    if (inputRow) inputRow.style.display = 'none';
    updateSaveDeleteVisibility();
  }

  // ─── Filter Application ───────────────────────────────────────────

  /**
   * Apply status-only filter (open/closed/all)
   */
  async function applyStatusFilter() {
    const statusDiv = document.getElementById('jt-cf-status');
    const jobStatus = activeFilters.jobStatus || 'all';

    // If status is 'all' (default), just restore original display
    if (jobStatus === 'all') {
      restoreJobListDisplay();
      if (statusDiv) {
        statusDiv.style.display = 'none';
      }
      return;
    }

    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Filtering...';
      statusDiv.style.color = '#6b7280';
    }

    try {
      let jobs;

      if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
        const result = await JobTreadProService.getFilteredJobs([], jobStatus);
        jobs = result.jobs || [];
      } else {
        if (statusDiv) {
          statusDiv.textContent = 'Status filter requires API configuration';
          statusDiv.style.color = '#f59e0b';
        }
        return;
      }

      if (statusDiv) {
        const statusLabel = jobStatus === 'closed' ? 'closed' : '';
        statusDiv.textContent = `Found ${jobs.length} ${statusLabel} job${jobs.length !== 1 ? 's' : ''}`;
        statusDiv.style.color = '#10b981';
      }

      updateJobListDisplay(jobs);
    } catch (error) {
      console.error('CustomFieldFilter: Status filter error:', error);
      if (statusDiv) {
        statusDiv.textContent = 'Filter error: ' + error.message;
        statusDiv.style.color = '#ef4444';
      }
    }
  }

  /**
   * Apply the current filter (custom field multi-value + status)
   */
  async function applyFilter() {
    const statusDiv = document.getElementById('jt-cf-status');

    if (!activeFilters.fieldName || !activeFilters.values || activeFilters.values.length === 0) {
      return;
    }

    const jobStatus = activeFilters.jobStatus || 'all';

    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Filtering...';
      statusDiv.style.color = '#6b7280';
    }

    try {
      let jobs;

      // Try Pro Service first (uses Cloudflare Worker)
      if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
        const filters = [{
          fieldName: activeFilters.fieldName,
          values: activeFilters.values
        }];
        const result = await JobTreadProService.getFilteredJobs(filters, jobStatus);
        jobs = result.jobs || [];
      } else {
        // Fall back to direct API — filter client-side for multi-value
        const allJobs = await JobTreadAPI.fetchJobsByCustomField(
          activeFilters.fieldName,
          activeFilters.values[0]
        );
        // For direct API, we can only filter by one value at a time
        // So fetch all and filter client-side
        jobs = allJobs;
        // Client-side status filter for direct API
        if (jobStatus !== 'all') {
          const isClosed = jobStatus === 'closed';
          jobs = jobs.filter(job => (job.status === 'Closed') === isClosed);
        }
      }

      if (statusDiv) {
        statusDiv.textContent = `Found ${jobs.length} matching job${jobs.length !== 1 ? 's' : ''}`;
        statusDiv.style.color = '#10b981';
      }

      // Update the job list display
      updateJobListDisplay(jobs);
    } catch (error) {
      console.error('CustomFieldFilter: Filter error:', error);
      if (statusDiv) {
        statusDiv.textContent = 'Filter error: ' + error.message;
        statusDiv.style.color = '#ef4444';
      }
    }
  }

  /**
   * Clear the current filter (keeps status filter)
   */
  function clearFilter() {
    // Preserve the job status filter when clearing custom field filter
    const currentStatus = activeFilters.jobStatus;
    activeFilters = {};
    if (currentStatus) {
      activeFilters.jobStatus = currentStatus;
    }

    const statusDiv = document.getElementById('jt-cf-status');
    if (statusDiv) {
      statusDiv.style.display = 'none';
    }

    // If status is not 'all' (default), re-apply just the status filter
    if (currentStatus && currentStatus !== 'all') {
      applyStatusFilter();
      return;
    }

    // Restore original job list
    restoreJobListDisplay();
  }

  /**
   * Update the job list to show filtered results
   */
  function updateJobListDisplay(jobs) {
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (!sidebar) return;

    // Find the job list container (the scrollable area with job items)
    const jobListContainer = sidebar.querySelector('div[style*="padding-top: 0px"]');
    if (!jobListContainer) {
      return;
    }

    // Store original content if not already stored
    if (!jobListContainer.dataset.originalHtml) {
      jobListContainer.dataset.originalHtml = jobListContainer.innerHTML;
    }

    // Create filtered job items HTML
    if (jobs.length === 0) {
      jobListContainer.innerHTML = `
        <div class="p-4 text-center text-gray-500">
          No jobs match the selected filter
        </div>
      `;
      return;
    }

    const jobItemsHtml = jobs.map(job => {
      const isClosed = job.status === 'Closed' || job.closedOn;

      return `
      <div role="button" tabindex="0" class="relative cursor-pointer p-2 flex items-center gap-2 border-t hover:bg-gray-50" data-job-id="${escapeAttr(job.id)}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em] shrink-0 text-xl text-green-500 invisible" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>
        <div class="grow min-w-0">
          <div class="text-cyan-500 text-xs font-bold uppercase truncate">${escapeHtml(job.number || '')}</div>
          <div class="flex gap-2">
            <div class="grow min-w-0 font-bold truncate">${escapeHtml(job.name || 'Unnamed Job')}</div>
            ${isClosed ? '<div class="shrink-0 text-gray-500">Closed</div>' : ''}
          </div>
        </div>
      </div>
    `;
    }).join('');

    jobListContainer.innerHTML = jobItemsHtml;

    // Add click handlers to navigate to jobs
    jobListContainer.querySelectorAll('[data-job-id]').forEach(item => {
      item.addEventListener('click', () => {
        const jobId = item.dataset.jobId;

        // Smart navigation: preserve current section (budget, schedule, etc.)
        const currentPath = window.location.pathname;
        const jobSectionMatch = currentPath.match(/^\/jobs\/[^\/]+\/(.+)$/);

        let newPath;
        if (jobSectionMatch) {
          // Currently in a specific section (e.g., /jobs/123/budget)
          const section = jobSectionMatch[1];
          newPath = `/jobs/${jobId}/${section}`;
        } else {
          // Currently on job overview page or elsewhere
          newPath = `/jobs/${jobId}`;
        }

        // Use client-side navigation to keep sidebar open (like native Job Switcher)
        // Push new state and dispatch popstate to trigger React Router navigation
        window.history.pushState({}, '', newPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      });
    });
  }

  /**
   * Restore the original job list display
   */
  function restoreJobListDisplay() {
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (!sidebar) return;

    const jobListContainer = sidebar.querySelector('div[style*="padding-top: 0px"]');
    if (!jobListContainer || !jobListContainer.dataset.originalHtml) return;

    jobListContainer.innerHTML = jobListContainer.dataset.originalHtml;
    delete jobListContainer.dataset.originalHtml;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.CustomFieldFilterFeature = CustomFieldFilterFeature;
}
