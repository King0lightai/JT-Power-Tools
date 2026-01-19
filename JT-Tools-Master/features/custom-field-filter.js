// JobTread Custom Field Filter Feature
// API-powered filtering of jobs by custom field values in the Job Switcher sidebar
// Requires Power User tier and API configuration (Worker or Direct)

const CustomFieldFilterFeature = (() => {
  let isActive = false;
  let sidebarObserver = null;
  let customFieldDefinitions = null;
  let filterContainer = null;
  let activeFilters = {};

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

    // Remove any injected UI
    const existingFilter = document.getElementById('jt-custom-field-filter');
    if (existingFilter) {
      existingFilter.remove();
    }

    // Reset state
    customFieldDefinitions = null;
    filterContainer = null;
    activeFilters = {};

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
        <select id="jt-cf-value-select" class="rounded-sm border p-1 text-sm flex-1 appearance-none bg-white hover:bg-gray-50 focus:border-cyan-500 focus:shadow-sm transition" style="min-width: 0; display: none;">
          <option value="">Select value...</option>
        </select>
        <button id="jt-cf-clear-btn" class="rounded-sm border p-1 text-sm bg-white hover:bg-gray-50 text-gray-500" style="display: none;" title="Clear filter">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>
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

  /**
   * Set up event listeners for filter controls
   */
  function setupFilterEventListeners() {
    const statusSelect = document.getElementById('jt-cf-status-select');
    const fieldSelect = document.getElementById('jt-cf-field-select');
    const valueSelect = document.getElementById('jt-cf-value-select');
    const clearBtn = document.getElementById('jt-cf-clear-btn');

    // Job status filter (open/closed/all)
    if (statusSelect) {
      statusSelect.addEventListener('change', async (e) => {
        const status = e.target.value;
        activeFilters.jobStatus = status;

        // If we have a custom field filter active, re-apply with new status
        if (activeFilters.fieldName && activeFilters.value) {
          await applyFilter();
        } else {
          // Just filter by status alone
          await applyStatusFilter();
        }
      });
    }

    if (fieldSelect) {
      fieldSelect.addEventListener('change', async (e) => {
        const fieldId = e.target.value;
        const selectedOption = e.target.selectedOptions[0];

        if (!fieldId) {
          valueSelect.style.display = 'none';
          clearBtn.style.display = 'none';
          clearFilter();
          return;
        }

        // Show value select and populate based on field type
        valueSelect.style.display = 'block';
        valueSelect.innerHTML = '<option value="">Loading values...</option>';

        const fieldType = selectedOption.dataset.type;
        const fieldOptions = JSON.parse(selectedOption.dataset.options || '[]');
        const fieldName = selectedOption.textContent;

        // For fields with predefined options (select, radio, etc.)
        if (fieldOptions && fieldOptions.length > 0) {
          valueSelect.innerHTML = '<option value="">Select value...</option>';
          fieldOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            valueSelect.appendChild(option);
          });
        } else {
          // For other fields, try to get unique values from jobs
          try {
            let values;

            // Try Pro Service first (uses Cloudflare Worker)
            if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
              values = await JobTreadProService.getCustomFieldValues(fieldId, fieldName);
            } else if (typeof JobTreadAPI !== 'undefined') {
              // Fall back to direct API
              values = await JobTreadAPI.getCustomFieldValues(fieldId);
            } else {
              throw new Error('No API configured');
            }

            valueSelect.innerHTML = '<option value="">Select value...</option>';
            values.forEach(val => {
              const option = document.createElement('option');
              option.value = val;
              option.textContent = val;
              valueSelect.appendChild(option);
            });

            if (values.length === 0) {
              valueSelect.innerHTML = '<option value="">No values found</option>';
            }
          } catch (error) {
            console.error('CustomFieldFilter: Failed to get field values:', error);
            valueSelect.innerHTML = '<option value="">Error loading values</option>';
          }
        }

        // Store the selected field name for filtering
        activeFilters.fieldName = fieldName;
        activeFilters.fieldId = fieldId;
      });
    }

    if (valueSelect) {
      valueSelect.addEventListener('change', async (e) => {
        const value = e.target.value;
        if (!value) {
          clearFilter();
          return;
        }

        activeFilters.value = value;
        clearBtn.style.display = 'block';

        // Apply filter
        await applyFilter();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearFilter();
        fieldSelect.value = '';
        valueSelect.style.display = 'none';
        valueSelect.innerHTML = '<option value="">Select value...</option>';
        clearBtn.style.display = 'none';
      });
    }
  }

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
   * Apply the current filter (custom field + status)
   */
  async function applyFilter() {
    const statusDiv = document.getElementById('jt-cf-status');

    if (!activeFilters.fieldName || !activeFilters.value) {
      return;
    }

    const jobStatus = activeFilters.jobStatus || 'all';

    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Filtering...';
      statusDiv.style.color = '#6b7280';
    }

    try {
      // Fetch jobs filtered by custom field value (server-side using Pave 'with' clause)
      let jobs;

      // Try Pro Service first (uses Cloudflare Worker)
      if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
        const filters = [{
          fieldName: activeFilters.fieldName,
          value: activeFilters.value
        }];
        const result = await JobTreadProService.getFilteredJobs(filters, jobStatus);
        jobs = result.jobs || [];
      } else {
        // Fall back to direct API
        jobs = await JobTreadAPI.fetchJobsByCustomField(
          activeFilters.fieldName,
          activeFilters.value
        );
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
      <div role="button" tabindex="0" class="relative cursor-pointer p-2 flex items-center gap-2 border-t hover:bg-gray-50" data-job-id="${job.id}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em] shrink-0 text-xl text-green-500 invisible" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>
        <div class="grow min-w-0">
          <div class="text-cyan-500 text-xs font-bold uppercase truncate">${job.number || ''}</div>
          <div class="flex gap-2">
            <div class="grow min-w-0 font-bold truncate">${job.name || 'Unnamed Job'}</div>
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
