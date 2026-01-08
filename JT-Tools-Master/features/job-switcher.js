// JobTread Quick Job Switcher Feature
// Keyboard shortcuts: J+S or ALT+J to quickly search and switch jobs
// Enhanced with custom field filtering via JobTread API

const QuickJobSwitcherFeature = (() => {
  let isActive = false;
  let isSearchOpen = false;
  let jKeyPressed = false;
  let customFieldDefinitions = null;
  let filterContainer = null;
  let activeFilters = {};

  /**
   * Initialize the feature
   */
  function init() {
    if (isActive) {
      console.log('QuickJobSwitcher: Already initialized');
      return;
    }

    console.log('QuickJobSwitcher: Initializing...');
    isActive = true;

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    // Watch for sidebar appearing (regardless of how it was opened)
    setupSidebarObserver();

    console.log('QuickJobSwitcher: ✅ Listening for J+S or ALT+J keyboard shortcuts');
  }

  /**
   * Set up a MutationObserver to detect when the job switcher sidebar appears
   * This ensures the filter UI is injected regardless of how the sidebar is opened
   */
  function setupSidebarObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is the job switcher sidebar (has z-30 class and contains "Job Switcher" text)
            let sidebar = null;

            // Check if the node itself is the sidebar container
            if (node.classList?.contains('z-30') && node.classList?.contains('absolute')) {
              sidebar = node;
            } else {
              // Check within added node for sidebar
              sidebar = node.querySelector?.('div.z-30.absolute');
            }

            // Verify it's the job switcher by checking for the title
            if (sidebar && sidebar.textContent?.includes('Job Switcher')) {
              console.log('QuickJobSwitcher: Sidebar detected via observer');
              // Find the search input and inject filter UI after a short delay
              setTimeout(() => {
                const searchInput = sidebar.querySelector('input[placeholder*="Search"]') ||
                                   sidebar.querySelector('input');
                if (searchInput) {
                  console.log('QuickJobSwitcher: Found search input, injecting filter UI');
                  injectFilterUI(searchInput);
                } else {
                  console.log('QuickJobSwitcher: Could not find search input in sidebar');
                }
              }, 150);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('QuickJobSwitcher: Sidebar observer set up');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      console.log('QuickJobSwitcher: Not active, nothing to cleanup');
      return;
    }

    console.log('QuickJobSwitcher: Cleaning up...');
    isActive = false;

    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);

    closeSidebar();

    console.log('QuickJobSwitcher: Cleanup complete');
  }

  /**
   * Handle keydown events
   */
  function handleKeyDown(e) {
    // Don't track J key if sidebar is already open (prevents interference with typing)
    if (!isSearchOpen && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'j' || e.key === 'J')) {
      jKeyPressed = true;
    }

    // Open sidebar: J+S (both keys pressed together) or ALT+J
    const isJSShortcut = jKeyPressed && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 's' || e.key === 'S');
    const isAltJShortcut = e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'j' || e.key === 'J');

    if (isJSShortcut || isAltJShortcut) {
      // Check if sidebar actually exists (user may have manually closed it)
      const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');

      if (!sidebar) {
        // Sidebar doesn't exist, reset state and allow opening
        isSearchOpen = false;
      }

      if (!isSearchOpen) {
        console.log(`QuickJobSwitcher: 🎯 ${isAltJShortcut ? 'ALT+J' : 'J+S'} detected!`);
        e.preventDefault();
        e.stopPropagation();
        // Reset J key state immediately after opening
        jKeyPressed = false;
        openSidebar();
      } else {
        console.log('QuickJobSwitcher: Sidebar already open, ignoring shortcut');
      }
      return;
    }

    // If sidebar is open and Enter is pressed, select top job and close
    if (isSearchOpen && e.key === 'Enter') {
      console.log('QuickJobSwitcher: Enter pressed while sidebar open');

      // Try multiple selectors for the search input
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                         document.querySelector('div.z-30.absolute input[type="text"]') ||
                         document.querySelector('div.z-30 input');

      // If we're in the sidebar (search input exists and is focused, or just in the sidebar)
      const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
      const isInSidebar = sidebar && sidebar.contains(document.activeElement);

      console.log('QuickJobSwitcher: searchInput exists:', !!searchInput);
      console.log('QuickJobSwitcher: activeElement is searchInput:', document.activeElement === searchInput);
      console.log('QuickJobSwitcher: isInSidebar:', isInSidebar);

      if ((searchInput && document.activeElement === searchInput) || isInSidebar) {
        console.log('QuickJobSwitcher: Conditions met, selecting top job');
        e.preventDefault();
        e.stopPropagation();
        selectTopJobAndClose();
        return;
      } else {
        console.log('QuickJobSwitcher: Conditions NOT met, not handling Enter');
      }
    }

    // Close sidebar on Escape
    if (isSearchOpen && e.key === 'Escape') {
      console.log('QuickJobSwitcher: ESC pressed, closing sidebar');
      e.preventDefault();
      e.stopPropagation();
      closeSidebar();
      return;
    }
  }

  /**
   * Handle keyup events
   */
  function handleKeyUp(e) {
    // Reset J key state when released
    if (e.key === 'j' || e.key === 'J') {
      jKeyPressed = false;
    }
  }

  /**
   * Open the job switcher sidebar
   */
  function openSidebar() {
    console.log('QuickJobSwitcher: Opening sidebar...');

    // Find the job number button - try multiple selectors
    let jobNumberButton = null;

    // Strategy 1: Look for the specific structure
    jobNumberButton = document.querySelector('.font-bold.text-2xl div[role="button"]');

    // Strategy 2: Look for any button with "Job" text
    if (!jobNumberButton) {
      const buttons = document.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        if (btn.textContent.includes('Job ')) {
          jobNumberButton = btn;
          break;
        }
      }
    }

    // Strategy 3: Look for text-2xl class with Job text
    if (!jobNumberButton) {
      const elements = document.querySelectorAll('.text-2xl');
      for (const el of elements) {
        if (el.textContent.includes('Job ')) {
          const button = el.querySelector('div[role="button"]');
          if (button) {
            jobNumberButton = button;
            break;
          }
        }
      }
    }

    if (!jobNumberButton) {
      console.error('QuickJobSwitcher: ❌ Could not find job number button');
      showErrorNotification('Could not find job switcher button. Make sure you\'re on a job page.');
      return;
    }

    console.log('QuickJobSwitcher: ✅ Found job button:', jobNumberButton.textContent);

    // Click to open sidebar
    console.log('QuickJobSwitcher: Clicking job button to open sidebar...');
    jobNumberButton.click();
    isSearchOpen = true;

    // Focus the search input after a short delay to let sidebar render
    setTimeout(() => {
      const searchInput = document.querySelector('div.z-30.absolute input[placeholder*="Search"]') ||
                         document.querySelector('div.z-30.absolute input[type="text"]') ||
                         document.querySelector('div.z-30 input');

      if (searchInput) {
        searchInput.focus();
        console.log('QuickJobSwitcher: ✅ Search input focused');

        // Inject custom field filter UI if API is configured
        injectFilterUI(searchInput);
      } else {
        console.log('QuickJobSwitcher: ⚠️ Could not find search input to focus');
      }
    }, 150);

    console.log('QuickJobSwitcher: ✅ Sidebar opened');
  }

  /**
   * Inject custom field filter UI after the search input
   */
  async function injectFilterUI(searchInput) {
    console.log('QuickJobSwitcher: injectFilterUI called');

    // Check if the feature is enabled in settings
    try {
      const result = await chrome.storage.sync.get(['jtToolsSettings']);
      const settings = result.jtToolsSettings || {};
      if (!settings.customFieldFilter) {
        console.log('QuickJobSwitcher: Custom field filter is disabled in settings');
        return;
      }
    } catch (e) {
      console.log('QuickJobSwitcher: Could not check settings, skipping filter UI');
      return;
    }

    // Check if API is configured (Worker or Direct)
    let isApiConfigured = false;

    // Check Worker API first (Pro Service)
    if (typeof JobTreadProService !== 'undefined') {
      isApiConfigured = await JobTreadProService.isConfigured();
      console.log('QuickJobSwitcher: Pro Service configured =', isApiConfigured);
    }

    // Fall back to Direct API if Worker not configured
    if (!isApiConfigured && typeof JobTreadAPI !== 'undefined') {
      isApiConfigured = await JobTreadAPI.isFullyConfigured();
      console.log('QuickJobSwitcher: Direct API configured =', isApiConfigured);
    }

    if (!isApiConfigured) {
      console.log('QuickJobSwitcher: No API configured (neither Worker nor Direct), skipping filter UI');
      return;
    }

    // Check if we already injected the filter UI
    const existing = document.getElementById('jt-custom-field-filter');
    if (existing) {
      console.log('QuickJobSwitcher: Filter UI already exists');
      return;
    }

    // Find the search input container (parent div with p-2 class)
    const searchContainer = searchInput.closest('div.p-2');
    console.log('QuickJobSwitcher: searchContainer =', searchContainer);

    if (!searchContainer) {
      console.log('QuickJobSwitcher: Could not find search container');
      // Try alternative: find parent containers
      console.log('QuickJobSwitcher: searchInput parents:', searchInput.parentElement, searchInput.parentElement?.parentElement);
      return;
    }

    console.log('QuickJobSwitcher: Injecting filter UI...');

    // Create filter container
    filterContainer = document.createElement('div');
    filterContainer.id = 'jt-custom-field-filter';
    filterContainer.className = 'p-2 pt-0';
    filterContainer.innerHTML = `
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
      console.log('QuickJobSwitcher: Loading custom field definitions...');

      // Try Pro Service first (uses Cloudflare Worker)
      let fieldsData;
      if (window.JobTreadProService && await JobTreadProService.isConfigured()) {
        console.log('QuickJobSwitcher: Using Pro Service (Worker API)');
        fieldsData = await JobTreadProService.getCustomFields();
        customFieldDefinitions = fieldsData.fields || [];
      } else {
        // Fall back to direct API
        console.log('QuickJobSwitcher: Using direct API');
        customFieldDefinitions = await JobTreadAPI.fetchCustomFieldDefinitions();
      }

      console.log('QuickJobSwitcher: Loaded', customFieldDefinitions.length, 'job custom fields');

      // Populate dropdown with job custom fields
      customFieldDefinitions.forEach(field => {
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
      console.error('QuickJobSwitcher: Failed to load custom fields:', error);
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
    const fieldSelect = document.getElementById('jt-cf-field-select');
    const valueSelect = document.getElementById('jt-cf-value-select');
    const clearBtn = document.getElementById('jt-cf-clear-btn');

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
            const values = await JobTreadAPI.getCustomFieldValues(fieldId);
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
            console.error('QuickJobSwitcher: Failed to get field values:', error);
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
   * Apply the current filter
   */
  async function applyFilter() {
    const statusDiv = document.getElementById('jt-cf-status');

    if (!activeFilters.fieldName || !activeFilters.value) {
      return;
    }

    console.log('QuickJobSwitcher: Applying filter:', activeFilters.fieldName, '=', activeFilters.value);

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
        console.log('QuickJobSwitcher: Filtering via Pro Service (Worker API)');
        const filters = [{
          fieldName: activeFilters.fieldName,
          value: activeFilters.value
        }];
        const result = await JobTreadProService.getFilteredJobs(filters);
        jobs = result.jobs || [];
      } else {
        // Fall back to direct API
        console.log('QuickJobSwitcher: Filtering via direct API');
        jobs = await JobTreadAPI.fetchJobsByCustomField(
          activeFilters.fieldName,
          activeFilters.value
        );
      }

      console.log('QuickJobSwitcher: Found', jobs.length, 'matching jobs');

      if (statusDiv) {
        statusDiv.textContent = `Found ${jobs.length} matching job${jobs.length !== 1 ? 's' : ''}`;
        statusDiv.style.color = '#10b981';
      }

      // Update the job list display
      updateJobListDisplay(jobs);
    } catch (error) {
      console.error('QuickJobSwitcher: Filter error:', error);
      if (statusDiv) {
        statusDiv.textContent = 'Filter error: ' + error.message;
        statusDiv.style.color = '#ef4444';
      }
    }
  }

  /**
   * Clear the current filter
   */
  function clearFilter() {
    activeFilters = {};

    const statusDiv = document.getElementById('jt-cf-status');
    if (statusDiv) {
      statusDiv.style.display = 'none';
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
      console.log('QuickJobSwitcher: Could not find job list container');
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

    const jobItemsHtml = jobs.map(job => `
      <div role="button" tabindex="0" class="relative cursor-pointer p-2 flex items-center gap-2 border-t hover:bg-gray-50" data-job-id="${job.id}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em] shrink-0 text-xl text-green-500 invisible" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>
        <div class="grow min-w-0">
          <div class="text-cyan-500 text-xs font-bold uppercase">${job.number || ''}</div>
          <div class="flex gap-2">
            <div class="grow min-w-0 font-bold">${job.name || 'Unnamed Job'}</div>
          </div>
        </div>
      </div>
    `).join('');

    jobListContainer.innerHTML = jobItemsHtml;

    // Add click handlers to navigate to jobs
    jobListContainer.querySelectorAll('[data-job-id]').forEach(item => {
      item.addEventListener('click', () => {
        const jobId = item.dataset.jobId;
        // Navigate to job page
        window.location.href = `/jobs/${jobId}`;
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

  /**
   * Close the job switcher sidebar
   */
  function closeSidebar() {
    if (!isSearchOpen) {
      return;
    }

    console.log('QuickJobSwitcher: Closing sidebar...');

    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (sidebar) {
      // Strategy 1: Find the close button by looking for X icon or Close text
      const allButtons = sidebar.querySelectorAll('div[role="button"]');
      let closeButton = null;

      for (const button of allButtons) {
        const text = button.textContent.trim();
        // Look for close button indicators
        if (text === 'Close' || text === '×' || text === 'X') {
          closeButton = button;
          break;
        }
        // Check for X icon SVG (close icon typically has M18 6 or similar path for X shape)
        const svg = button.querySelector('svg');
        if (svg) {
          const paths = svg.querySelectorAll('path');
          for (const path of paths) {
            const d = path.getAttribute('d') || '';
            // Common X/close icon path patterns
            if (d.includes('M18 6') || d.includes('m18 6') ||
                d.includes('M6 18') || d.includes('m6 18') ||
                (d.includes('18') && d.includes('6') && d.length < 50)) {
              closeButton = button;
              break;
            }
          }
          if (closeButton) break;
        }
      }

      if (closeButton) {
        closeButton.click();
        console.log('QuickJobSwitcher: ✅ Closed sidebar via close button');
      } else {
        // Strategy 2: Try clicking outside the sidebar (on the overlay)
        const overlay = document.querySelector('div.z-30.absolute.inset-0:not(.top-0)') ||
                       document.querySelector('div.z-20.fixed.inset-0') ||
                       document.querySelector('[class*="backdrop"]') ||
                       document.querySelector('[class*="overlay"]');
        if (overlay) {
          overlay.click();
          console.log('QuickJobSwitcher: ✅ Closed sidebar via overlay click');
        } else {
          // Strategy 3: Dispatch Escape key to close
          console.log('QuickJobSwitcher: Trying Escape key to close sidebar');
          const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true
          });
          sidebar.dispatchEvent(escEvent);
          document.dispatchEvent(escEvent);
        }
      }
    }

    isSearchOpen = false;
  }

  /**
   * Select the currently highlighted job (or top job) and close sidebar
   */
  function selectTopJobAndClose() {
    console.log('QuickJobSwitcher: Selecting job...');

    // Find the sidebar
    const sidebar = document.querySelector('div.z-30.absolute.top-0.bottom-0.right-0');
    if (!sidebar) {
      console.error('QuickJobSwitcher: ❌ Could not find sidebar');
      closeSidebar();
      return;
    }

    let selectedButton = null;

    // Strategy 1: Check for visually highlighted items (arrow key navigation uses visual highlighting)
    // JobTread uses various highlight classes - check for common patterns
    const allJobButtons = sidebar.querySelectorAll('div[role="button"]');

    for (const button of allJobButtons) {
      const text = button.textContent.trim();
      // Skip non-job items (close button, header, etc.)
      if (text === 'Close' || text === '×' || text === 'X' ||
          text.includes('Job Switcher') ||
          button.querySelector('path[d*="M18 6"]') ||
          button.querySelector('path[d*="M6 18"]')) {
        continue;
      }

      // Check for highlight indicators
      const classList = button.className || '';
      const hasHighlight = classList.includes('bg-blue-') ||
                          classList.includes('bg-cyan-') ||
                          classList.includes('bg-gray-100') ||
                          classList.includes('bg-gray-200') ||
                          classList.includes('highlighted') ||
                          classList.includes('selected') ||
                          classList.includes('active') ||
                          classList.includes('focus') ||
                          button.getAttribute('aria-selected') === 'true' ||
                          button.getAttribute('data-highlighted') === 'true' ||
                          button.getAttribute('data-selected') === 'true' ||
                          button.matches(':focus') ||
                          button.matches(':focus-visible');

      if (hasHighlight) {
        selectedButton = button;
        console.log(`QuickJobSwitcher: ✅ Using highlighted job: ${text.substring(0, 50)}`);
        break;
      }
    }

    // Strategy 2: Check if there's a currently focused element that's a job
    if (!selectedButton) {
      const activeElement = document.activeElement;

      // Check if the active element is a job button in the sidebar (not the search input)
      if (activeElement &&
          sidebar.contains(activeElement) &&
          activeElement.getAttribute('role') === 'button' &&
          activeElement.tagName !== 'INPUT') {
        const text = activeElement.textContent.trim();
        // Make sure it's not the close button or header
        if (text !== 'Close' && text !== '×' && text !== 'X' &&
            !text.includes('Job Switcher') &&
            !activeElement.querySelector('path[d*="M18 6"]')) {
          selectedButton = activeElement;
          console.log(`QuickJobSwitcher: ✅ Using focused job: ${text.substring(0, 50)}`);
        }
      }
    }

    // Strategy 3: Fall back to finding the top job in the list
    if (!selectedButton) {
      // Find the scrollable job list container
      const jobList = sidebar.querySelector('.overflow-y-auto') || sidebar;
      const jobButtons = jobList.querySelectorAll('div[role="button"][tabindex="0"]');
      console.log(`QuickJobSwitcher: Found ${jobButtons.length} buttons in sidebar`);

      // Find the first actual job (skip close button and header)
      for (const button of jobButtons) {
        const text = button.textContent.trim();

        // Skip close button
        if (text === 'Close' || text === '×' || text === 'X' ||
            button.querySelector('path[d*="M18 6"]') ||
            button.querySelector('path[d*="M6 18"]')) {
          continue;
        }

        // Skip header
        if (text.includes('Job Switcher')) {
          continue;
        }

        // Skip if it's just whitespace or very short (likely an icon-only button)
        if (text.length < 3) {
          continue;
        }

        // This is the first job in the list
        selectedButton = button;
        console.log(`QuickJobSwitcher: ✅ Top job (fallback): ${text.substring(0, 50)}`);
        break;
      }
    }

    if (selectedButton) {
      console.log('QuickJobSwitcher: Clicking selected job...');

      // Click the job button to navigate
      selectedButton.click();

      // Close sidebar after clicking - use a slightly longer delay to let click process
      // If navigation happens, sidebar will be removed anyway
      // If it doesn't navigate (same job), we want it to close
      setTimeout(() => {
        closeSidebar();
      }, 100);
    } else {
      console.log('QuickJobSwitcher: No jobs found, just closing sidebar');
      closeSidebar();
    }
  }

  /**
   * Show error notification
   */
  function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 999999;
      font-size: 13px;
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
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
  window.QuickJobSwitcherFeature = QuickJobSwitcherFeature;
}
