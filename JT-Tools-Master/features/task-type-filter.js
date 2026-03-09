/**
 * JT Power Tools - Task Type Filter Feature
 * Adds a filter bar between the TASKS row and assignee rows in the Schedule Availability view
 * to filter visible task cards by task type (e.g., Labor, Material, Equipment, Inspection, etc.)
 *
 * DOM Structure (from screenshot):
 *   [Header: "As of: date" | "2-Mar Monday" ...]
 *   [TASKS row: orange "TASKS" label | task cards per day column]
 *   [OUR FILTER BAR INSERTS HERE]
 *   [Assignee rows: Warren, Tommy, Ben, Ethan, Jose...]
 *
 * Uses the JobTread Pave API to:
 *   1. Fetch org task types (organization.taskTypes.nodes { id, name })
 *   2. Fetch tasks by date range (organization.tasks with where filters)
 * Then matches task cards in the DOM by name and hides/shows based on selected types.
 *
 * @module TaskTypeFilterFeature
 * @version 1.0.0
 * @requires JobTreadAPI, TimingUtils, Sanitizer
 */

const TaskTypeFilterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let urlCheckInterval = null;
  let styleElement = null;
  let filterContainer = null;
  let debouncedScanAndBuild = null;

  // Storage key for persisting selected task types
  const STORAGE_KEY = 'jtTaskTypeFilterSelections';
  const CACHE_KEY = 'jtTaskTypeFilterCache';
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // State
  let taskTypes = [];            // Array of { id, name } from API
  let selectedTypes = {};        // { typeId: true/false }
  let tasksByType = {};          // { typeId: [{ id, name, startDate, endDate, job, assignees }] }
  let allTasks = [];             // All fetched tasks
  let isLoading = false;
  let lastError = null;
  let _isCollapsed = false;

  // Date range from the current schedule view
  let visibleStartDate = null;
  let visibleEndDate = null;

  /**
   * Check if we're on the Schedule Availability view
   */
  function isAvailabilityView() {
    if (!window.location.pathname.includes('/schedule')) {
      return false;
    }

    const availabilityBtn = document.querySelector('button[class*="flex"][class*="items-center"]');
    if (availabilityBtn && availabilityBtn.textContent.includes('Availability')) {
      return true;
    }

    const assigneeSidebar = document.querySelector('div.text-xs.uppercase.truncate.p-1.border-b.font-bold.text-jtOrange');
    if (assigneeSidebar) {
      return true;
    }

    return false;
  }

  /**
   * Parse the visible date range from the schedule table header
   * The header row contains day abbreviations (SUN MON TUE...) and date numbers (1-31)
   * We also look for month/year context from the page
   */
  function parseVisibleDateRange() {
    const table = document.querySelector('table');
    if (!table) return null;

    // Look for date header cells - the row with day numbers
    const headerRows = table.querySelectorAll('thead tr');
    if (headerRows.length < 2) return null;

    // The second header row typically has the date numbers
    const dateRow = headerRows[1] || headerRows[0];
    const dateCells = dateRow.querySelectorAll('th');

    const dateNumbers = [];
    dateCells.forEach(cell => {
      const text = cell.textContent.trim();
      const num = parseInt(text, 10);
      if (!isNaN(num) && num >= 1 && num <= 31) {
        dateNumbers.push(num);
      }
    });

    if (dateNumbers.length === 0) return null;

    // Try to find the month/year from the page header
    // Look for text like "March 2026" or similar date context
    const dateContext = findDateContext();
    const year = dateContext.year || new Date().getFullYear();
    const month = dateContext.month !== null ? dateContext.month : new Date().getMonth();

    const firstDay = Math.min(...dateNumbers);
    const lastDay = Math.max(...dateNumbers);

    // Handle month boundary (e.g., dates go from 28 to 3)
    if (lastDay - firstDay > 20 && dateNumbers.length <= 14) {
      // Likely spanning two months
      const startDate = new Date(year, month, firstDay);
      const endDate = new Date(year, month + 1, lastDay);
      return { start: formatDate(startDate), end: formatDate(endDate) };
    }

    const startDate = new Date(year, month, firstDay);
    const endDate = new Date(year, month, lastDay);

    return { start: formatDate(startDate), end: formatDate(endDate) };
  }

  /**
   * Find month/year context from the page
   */
  function findDateContext() {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];

    // Look for month/year text in headers, buttons, or prominent elements
    const candidates = document.querySelectorAll('h1, h2, h3, button, span.font-bold, div.font-bold');
    for (const el of candidates) {
      const text = el.textContent.toLowerCase().trim();
      for (let i = 0; i < months.length; i++) {
        if (text.includes(months[i])) {
          const yearMatch = text.match(/\b(20\d{2})\b/);
          return {
            month: i,
            year: yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear()
          };
        }
      }
    }

    return { month: null, year: null };
  }

  /**
   * Format date as YYYY-MM-DD
   */
  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── API CALLS ──────────────────────────────────────────────

  /**
   * Fetch task types from the org via Pave API
   */
  async function fetchTaskTypes() {
    const orgId = await getOrgId();
    if (!orgId) throw new Error('Organization ID not found');

    const query = {
      organization: {
        $: { id: orgId },
        taskTypes: {
          nodes: {
            id: {},
            name: {}
          }
        }
      }
    };

    const result = await executePaveQuery(query);
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    return result.organization.taskTypes.nodes || [];
  }

  /**
   * Fetch tasks for a date range from the org via Pave API
   * Includes task type, job info, and assigned memberships
   */
  async function fetchTasksForDateRange(startDate, endDate) {
    const orgId = await getOrgId();
    if (!orgId) throw new Error('Organization ID not found');

    const query = {
      organization: {
        $: { id: orgId },
        tasks: {
          $: {
            size: 500,
            where: {
              and: [
                ['isToDo', '=', false],
                ['startDate', '>=', startDate],
                ['startDate', '<=', endDate]
              ]
            },
            sortBy: [{ field: 'startDate' }]
          },
          nextPage: {},
          nodes: {
            id: {},
            name: {},
            startDate: {},
            endDate: {},
            progress: {},
            completed: {},
            taskType: { id: {}, name: {} },
            assignedMemberships: {
              nodes: {
                id: {},
                user: { id: {}, name: {} }
              }
            },
            job: { id: {}, name: {} }
          }
        }
      }
    };

    const result = await executePaveQuery(query);
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    return result.organization.tasks.nodes || [];
  }

  /**
   * Get org ID from storage (try pro service first, then direct API)
   */
  async function getOrgId() {
    try {
      // Try pro service storage first
      const local = await chrome.storage.local.get(['jtpro_org_id']);
      if (local.jtpro_org_id) return local.jtpro_org_id;

      // Fall back to direct API storage
      const sync = await chrome.storage.sync.get(['jtToolsOrgId']);
      return sync.jtToolsOrgId || null;
    } catch (e) {
      console.error('TaskTypeFilter: Error getting org ID:', e);
      return null;
    }
  }

  /**
   * Execute a Pave query using available API services
   */
  async function executePaveQuery(query) {
    // Try JobTreadAPI first (it handles proxy routing for content scripts)
    if (typeof window.JobTreadAPI !== 'undefined' && window.JobTreadAPI.paveQuery) {
      return await window.JobTreadAPI.paveQuery(query);
    }

    // Fallback: direct API call via background proxy
    const apiKey = await getGrantKey();
    if (!apiKey) throw new Error('No API key available');

    const wrappedQuery = {
      query: {
        $: { grantKey: apiKey },
        ...query
      }
    };

    const result = await chrome.runtime.sendMessage({
      type: 'JOBTREAD_API_REQUEST',
      url: 'https://api.jobtread.com/pave',
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wrappedQuery)
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }

    return result.data;
  }

  /**
   * Get grant key from storage
   */
  async function getGrantKey() {
    try {
      const local = await chrome.storage.local.get(['jtpro_grant_key']);
      if (local.jtpro_grant_key) return local.jtpro_grant_key;

      const sync = await chrome.storage.sync.get(['jtToolsApiKey']);
      return sync.jtToolsApiKey || null;
    } catch (e) {
      return null;
    }
  }

  // ─── DATA MANAGEMENT ───────────────────────────────────────

  /**
   * Load data: fetch task types and tasks for current date range
   */
  async function loadData() {
    if (isLoading) return;
    isLoading = true;
    lastError = null;
    updateLoadingState();

    try {
      // Parse date range from the schedule view
      const dateRange = parseVisibleDateRange();
      if (!dateRange) {
        throw new Error('Could not determine visible date range');
      }

      visibleStartDate = dateRange.start;
      visibleEndDate = dateRange.end;

      // Check cache
      const cached = await getCachedData();
      if (cached && cached.startDate === visibleStartDate && cached.endDate === visibleEndDate) {
        taskTypes = cached.taskTypes;
        allTasks = cached.tasks;
        console.log('TaskTypeFilter: Using cached data');
      } else {
        // Fetch fresh data
        const [types, tasks] = await Promise.all([
          fetchTaskTypes(),
          fetchTasksForDateRange(visibleStartDate, visibleEndDate)
        ]);

        taskTypes = types;
        allTasks = tasks;

        // Cache results
        await setCachedData({
          startDate: visibleStartDate,
          endDate: visibleEndDate,
          taskTypes: types,
          tasks: tasks,
          timestamp: Date.now()
        });

        console.log(`TaskTypeFilter: Loaded ${types.length} task types, ${tasks.length} tasks`);
      }

      // Index tasks by type
      tasksByType = {};
      taskTypes.forEach(t => { tasksByType[t.id] = []; });
      tasksByType['_untyped'] = [];

      allTasks.forEach(task => {
        const typeId = task.taskType ? task.taskType.id : '_untyped';
        if (!tasksByType[typeId]) tasksByType[typeId] = [];
        tasksByType[typeId].push(task);
      });

      // Load saved selections
      await loadSelections();

      // Initialize selections for new types
      taskTypes.forEach(t => {
        if (selectedTypes[t.id] === undefined) {
          selectedTypes[t.id] = true; // Default: all types visible
        }
      });

    } catch (error) {
      console.error('TaskTypeFilter: Error loading data:', error);
      lastError = error.message;
    } finally {
      isLoading = false;
      buildFilterUI();
      applyFilters();
    }
  }

  async function getCachedData() {
    try {
      const result = await chrome.storage.local.get([CACHE_KEY]);
      const cached = result[CACHE_KEY];
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function setCachedData(data) {
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: data });
    } catch (e) {
      console.error('TaskTypeFilter: Cache write error:', e);
    }
  }

  async function loadSelections() {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        selectedTypes = result[STORAGE_KEY];
      }
    } catch (e) {
      console.error('TaskTypeFilter: Error loading selections:', e);
    }
  }

  async function saveSelections() {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: selectedTypes });
    } catch (e) {
      console.error('TaskTypeFilter: Error saving selections:', e);
    }
  }

  // ─── UI ─────────────────────────────────────────────────────

  /**
   * Build and inject the filter bar UI
   */
  function buildFilterUI() {
    // Remove existing container if present
    if (filterContainer) {
      _isCollapsed = filterContainer.classList.contains('collapsed');
      filterContainer.remove();
    }

    filterContainer = document.createElement('div');
    filterContainer.id = 'jt-task-type-filter';
    filterContainer.className = 'jt-task-type-filter-container' + (_isCollapsed ? ' collapsed' : '');

    // Build chip HTML for each task type
    let chipsHtml = '';
    if (taskTypes.length > 0) {
      taskTypes.forEach(type => {
        const isActive = selectedTypes[type.id] !== false;
        const count = (tasksByType[type.id] || []).length;
        chipsHtml += `
          <button class="jt-ttf-chip ${isActive ? 'active' : ''}" data-type-id="${Sanitizer.escapeHTML(type.id)}" title="${Sanitizer.escapeHTML(type.name)}: ${count} task${count !== 1 ? 's' : ''}">
            <span class="jt-ttf-chip-label">${Sanitizer.escapeHTML(type.name)}</span>
            <span class="jt-ttf-chip-count">${count}</span>
          </button>
        `;
      });

      // Add "Untyped" chip if there are tasks without a type
      const untypedCount = (tasksByType['_untyped'] || []).length;
      if (untypedCount > 0) {
        const isActive = selectedTypes['_untyped'] !== false;
        chipsHtml += `
          <button class="jt-ttf-chip untyped ${isActive ? 'active' : ''}" data-type-id="_untyped" title="No Type: ${untypedCount} task${untypedCount !== 1 ? 's' : ''}">
            <span class="jt-ttf-chip-label">No Type</span>
            <span class="jt-ttf-chip-count">${untypedCount}</span>
          </button>
        `;
      }
    }

    // Determine active count
    const activeCount = Object.values(selectedTypes).filter(v => v !== false).length;
    const totalCount = taskTypes.length + ((tasksByType['_untyped'] || []).length > 0 ? 1 : 0);

    const html = `
      <div class="jt-ttf-header">
        <div class="jt-ttf-title-row">
          <span class="jt-ttf-icon">⚡</span>
          <span class="jt-ttf-title">Task Type Filter</span>
          <span class="jt-ttf-badge">${activeCount}/${totalCount}</span>
          <div class="jt-ttf-actions">
            <button class="jt-ttf-action" data-action="all" title="Show all types">All</button>
            <button class="jt-ttf-action" data-action="none" title="Hide all types">None</button>
            <button class="jt-ttf-action jt-ttf-refresh" data-action="refresh" title="Refresh data">↻</button>
          </div>
          <button class="jt-ttf-collapse" title="Collapse/expand">▾</button>
        </div>
        ${lastError ? `<div class="jt-ttf-error">⚠ ${Sanitizer.escapeHTML(lastError)}</div>` : ''}
        ${isLoading ? '<div class="jt-ttf-loading">Loading task types...</div>' : ''}
      </div>
      <div class="jt-ttf-chips">
        ${chipsHtml || '<span class="jt-ttf-empty">No task types found</span>'}
      </div>
    `;

    filterContainer.innerHTML = html;

    // Attach event listeners
    attachEventListeners();

    // Insert into DOM
    insertFilterUI();
  }

  /**
   * Update loading indicator in existing UI
   */
  function updateLoadingState() {
    if (!filterContainer) return;
    const header = filterContainer.querySelector('.jt-ttf-header');
    if (!header) return;

    let loadingEl = header.querySelector('.jt-ttf-loading');
    if (isLoading && !loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.className = 'jt-ttf-loading';
      loadingEl.textContent = 'Loading task types...';
      header.appendChild(loadingEl);
    } else if (!isLoading && loadingEl) {
      loadingEl.remove();
    }
  }

  /**
   * Attach click handlers to filter chips and actions
   */
  function attachEventListeners() {
    if (!filterContainer) return;

    // Collapse/expand toggle
    const collapseBtn = filterContainer.querySelector('.jt-ttf-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        filterContainer.classList.toggle('collapsed');
      });
    }

    // Header click to collapse/expand
    const header = filterContainer.querySelector('.jt-ttf-title-row');
    if (header) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.jt-ttf-action') || e.target.closest('.jt-ttf-collapse')) return;
        filterContainer.classList.toggle('collapsed');
      });
    }

    // Task type chip toggles
    const chips = filterContainer.querySelectorAll('.jt-ttf-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const typeId = chip.getAttribute('data-type-id');
        const isActive = chip.classList.contains('active');

        selectedTypes[typeId] = !isActive;
        chip.classList.toggle('active');

        updateBadge();
        saveSelections();
        applyFilters();
      });
    });

    // Action buttons (All / None / Refresh)
    const actionBtns = filterContainer.querySelectorAll('.jt-ttf-action');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');

        if (action === 'all') {
          Object.keys(selectedTypes).forEach(k => { selectedTypes[k] = true; });
          filterContainer.querySelectorAll('.jt-ttf-chip').forEach(c => c.classList.add('active'));
          updateBadge();
          saveSelections();
          applyFilters();
        } else if (action === 'none') {
          Object.keys(selectedTypes).forEach(k => { selectedTypes[k] = false; });
          filterContainer.querySelectorAll('.jt-ttf-chip').forEach(c => c.classList.remove('active'));
          updateBadge();
          saveSelections();
          applyFilters();
        } else if (action === 'refresh') {
          // Clear cache and reload
          try {
            await chrome.storage.local.remove([CACHE_KEY]);
          } catch (e) { /* ignore */ }
          loadData();
        }
      });
    });
  }

  /**
   * Update the active count badge
   */
  function updateBadge() {
    if (!filterContainer) return;
    const badge = filterContainer.querySelector('.jt-ttf-badge');
    if (!badge) return;

    const activeCount = Object.values(selectedTypes).filter(v => v !== false).length;
    const totalCount = taskTypes.length + ((tasksByType['_untyped'] || []).length > 0 ? 1 : 0);
    badge.textContent = `${activeCount}/${totalCount}`;
  }

  /**
   * Find the TASKS row in the schedule table
   * The TASKS row has an orange "TASKS" label (similar to INTERNAL/VENDOR category headers)
   * and contains all task cards for the visible date range.
   */
  function findTasksRow() {
    const table = document.querySelector('table');
    if (!table) return null;

    const rows = table.querySelectorAll('tbody tr');
    for (const row of rows) {
      const firstCell = row.querySelector('td:first-child');
      if (!firstCell) continue;

      // Look for the orange "TASKS" header text
      const orangeHeaders = firstCell.querySelectorAll(
        'div.text-xs.uppercase.truncate.p-1.border-b.font-bold, ' +
        '[class*="text-jtOrange"], ' +
        'div.font-bold.uppercase'
      );

      for (const header of orangeHeaders) {
        const text = header.textContent.trim().toUpperCase();
        if (text === 'TASKS') {
          return row;
        }
      }

      // Also check if the cell itself has "TASKS" as prominent text
      const cellText = firstCell.textContent.trim().toUpperCase();
      if (cellText.startsWith('TASKS') && firstCell.querySelector('.font-bold')) {
        return row;
      }
    }

    return null;
  }

  /**
   * Find all rows that belong to the TASKS section (the TASKS header row
   * plus any continuation rows before the first assignee row)
   */
  function findTasksSectionRows() {
    const tasksRow = findTasksRow();
    if (!tasksRow) return [];

    const rows = [tasksRow];
    let sibling = tasksRow.nextElementSibling;

    // Collect continuation rows that are part of the TASKS section
    // Stop when we hit a row that has an assignee card (name with avatar) or another category header
    while (sibling) {
      const firstCell = sibling.querySelector('td:first-child');
      if (!firstCell) break;

      // Check for category header (INTERNAL, VENDOR, etc.) — means TASKS section ended
      const categoryHeader = firstCell.querySelector('.text-jtOrange, [class*="text-jtOrange"]');
      if (categoryHeader) {
        const text = categoryHeader.textContent.trim().toUpperCase();
        if (text !== 'TASKS') break;
      }

      // Check for assignee card (has avatar + name) — means we've hit the assignments
      const assigneeCard = firstCell.querySelector('div.p-1.flex.items-center.space-x-1');
      if (assigneeCard) {
        // Could be an assignee row or a task continuation — check for avatar/image
        const hasAvatar = assigneeCard.querySelector('div.bg-cover, div.bg-center, img, [class*="avatar"]');
        const hasNameLink = assigneeCard.querySelector('a[href*="/team"], a.text-cyan-500');
        if (hasAvatar || hasNameLink) break;
      }

      rows.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    return rows;
  }

  /**
   * Insert the filter UI into the DOM
   * Primary target: between the TASKS row and the first assignee row
   * This places the filter bar right below the task pool and above assignments
   */
  function insertFilterUI() {
    if (!filterContainer) return;

    // Remove duplicate if exists
    const existing = document.getElementById('jt-task-type-filter');
    if (existing && existing !== filterContainer) {
      existing.remove();
    }

    // Option 1: Insert as a table row after the TASKS section rows
    // This keeps it inside the table for proper column alignment
    const tasksSectionRows = findTasksSectionRows();
    if (tasksSectionRows.length > 0) {
      const lastTasksRow = tasksSectionRows[tasksSectionRows.length - 1];
      const tbody = lastTasksRow.closest('tbody');

      if (tbody) {
        // Create a special table row to hold our filter bar
        let filterRow = document.getElementById('jt-task-type-filter-row');
        if (!filterRow) {
          filterRow = document.createElement('tr');
          filterRow.id = 'jt-task-type-filter-row';
          filterRow.className = 'jt-ttf-row';
        }

        // Create a cell that spans all columns
        const table = tbody.closest('table');
        const colCount = table ? (table.querySelector('thead tr')?.children.length || 8) : 8;

        filterRow.innerHTML = '';
        const td = document.createElement('td');
        td.setAttribute('colspan', colCount);
        td.className = 'jt-ttf-cell';
        td.appendChild(filterContainer);
        filterRow.appendChild(td);

        // Insert after the last TASKS row
        if (lastTasksRow.nextSibling) {
          tbody.insertBefore(filterRow, lastTasksRow.nextSibling);
        } else {
          tbody.appendChild(filterRow);
        }

        console.log('TaskTypeFilter: Inserted after TASKS row in table');
        return;
      }
    }

    // Option 2: Insert after availability filter if present
    const availFilter = document.getElementById('jt-availability-filter');
    if (availFilter && availFilter.parentElement) {
      availFilter.parentElement.insertBefore(filterContainer, availFilter.nextSibling);
      console.log('TaskTypeFilter: Inserted after availability filter');
      return;
    }

    // Option 3: Before the availability table
    const table = document.querySelector('table');
    if (table) {
      const tableContainer = table.closest('div.overflow-auto') ||
                            table.closest('div.relative') ||
                            table.parentElement;
      if (tableContainer && tableContainer.parentElement) {
        tableContainer.parentElement.insertBefore(filterContainer, tableContainer);
        console.log('TaskTypeFilter: Inserted before table');
        return;
      }
    }

    // Fallback
    const main = document.querySelector('main');
    if (main) {
      main.insertBefore(filterContainer, main.firstChild);
      console.log('TaskTypeFilter: Inserted at main start');
    }
  }

  // ─── FILTERING ──────────────────────────────────────────────

  /**
   * Apply task type filters to the DOM
   *
   * Strategy:
   * 1. Find the TASKS section rows in the table
   * 2. Find task cards within those rows (colored divs with task name + job name)
   * 3. Match each card to API task data by name
   * 4. Hide cards whose task type is deselected
   *
   * From the screenshot, task cards look like:
   *   [colored background div]
   *     "Framing"                    ← task name (bold)
   *     "Draper Addition 25-1001"    ← job name (subtitle)
   */
  function applyFilters() {
    if (allTasks.length === 0 && !lastError) return;

    // Build a lookup: task name (lowercase) → task type ID
    // Also build a secondary lookup using "taskName + jobName" for better matching
    const taskNameToType = {};
    const taskFullToType = {};
    allTasks.forEach(task => {
      const nameKey = task.name.toLowerCase().trim();
      taskNameToType[nameKey] = task.taskType ? task.taskType.id : '_untyped';
      if (task.job && task.job.name) {
        const fullKey = (task.name + ' ' + task.job.name).toLowerCase().trim();
        taskFullToType[fullKey] = task.taskType ? task.taskType.id : '_untyped';
      }
    });

    // Check if all types are selected (no filtering needed)
    const allSelected = Object.values(selectedTypes).every(v => v !== false);

    // Get the TASKS section rows
    const tasksSectionRows = findTasksSectionRows();

    // Also apply to all table rows for full coverage
    const table = document.querySelector('table');
    if (!table) return;

    const allRows = table.querySelectorAll('tbody tr');
    allRows.forEach(row => {
      // Skip our own filter row
      if (row.id === 'jt-task-type-filter-row') return;

      const cells = row.querySelectorAll('td');
      cells.forEach((cell, index) => {
        // Skip the first column (assignee/label names)
        if (index === 0) return;

        // Find task card divs — cards with inline background-color or colored backgrounds
        const taskCards = cell.querySelectorAll(
          'div[style*="background"], div[class*="cursor-pointer"], div[class*="cursor-grab"]'
        );

        taskCards.forEach(card => {
          if (allSelected) {
            card.style.display = '';
            card.classList.remove('jt-ttf-hidden');
            return;
          }

          // Extract text from the card for matching
          const cardText = card.textContent.toLowerCase().trim();
          let typeId = null;

          // Try full text match first (task name + job name)
          for (const [fullKey, tId] of Object.entries(taskFullToType)) {
            if (cardText.includes(fullKey) || fullKey.includes(cardText)) {
              typeId = tId;
              break;
            }
          }

          // Fall back to task name only match
          if (typeId === null) {
            for (const [nameKey, tId] of Object.entries(taskNameToType)) {
              if (cardText.includes(nameKey) || nameKey.includes(cardText)) {
                typeId = tId;
                break;
              }
            }
          }

          // Default to untyped if no match
          if (typeId === null) typeId = '_untyped';

          if (selectedTypes[typeId] === false) {
            card.style.display = 'none';
            card.classList.add('jt-ttf-hidden');
          } else {
            card.style.display = '';
            card.classList.remove('jt-ttf-hidden');
          }
        });
      });
    });

    console.log('TaskTypeFilter: Filters applied');
  }

  /**
   * Reset all card visibility
   */
  function resetFilters() {
    const table = document.querySelector('table');
    if (!table) return;

    table.querySelectorAll('.jt-ttf-hidden').forEach(card => {
      card.style.display = '';
      card.classList.remove('jt-ttf-hidden');
    });
  }

  // ─── STYLES ─────────────────────────────────────────────────

  function injectStyles() {
    if (styleElement) return;
    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = chrome.runtime.getURL('styles/task-type-filter.css');
    styleElement.id = 'jt-task-type-filter-styles';
    document.head.appendChild(styleElement);
  }

  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────

  /**
   * Main scan and build routine
   */
  function scanAndBuild() {
    if (!isActiveState) return;

    if (!isAvailabilityView()) {
      // Not on availability view - hide filter if visible
      if (filterContainer) {
        filterContainer.style.display = 'none';
      }
      return;
    }

    // Show filter if hidden
    if (filterContainer) {
      filterContainer.style.display = '';
      // Re-insert if it was removed from DOM
      if (!document.contains(filterContainer)) {
        insertFilterUI();
      }
      return;
    }

    // First time on this view — load data and build UI
    loadData();
  }

  async function init() {
    if (isActiveState) {
      console.log('TaskTypeFilter: Already active');
      return;
    }

    isActiveState = true;
    console.log('TaskTypeFilter: Initializing...');

    injectStyles();

    // Create debounced scanner
    if (typeof TimingUtils !== 'undefined' && TimingUtils.debounce) {
      debouncedScanAndBuild = TimingUtils.debounce(scanAndBuild, 300);
    } else {
      let debounceTimer = null;
      debouncedScanAndBuild = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanAndBuild, 300);
      };
    }

    // Initial check
    scanAndBuild();

    // Watch for DOM changes (navigation, re-renders)
    observer = new MutationObserver(() => {
      if (!isActiveState) return;
      debouncedScanAndBuild();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });

    // Also check on URL changes (SPA navigation)
    let lastUrl = window.location.href;
    urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        // Reset state on navigation
        if (filterContainer) {
          filterContainer.remove();
          filterContainer = null;
        }
        allTasks = [];
        tasksByType = {};
        scanAndBuild();
      }
    }, 1000);

    console.log('TaskTypeFilter: Initialized');
  }

  function cleanup() {
    if (!isActiveState) return;

    isActiveState = false;
    console.log('TaskTypeFilter: Cleaning up...');

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (urlCheckInterval) {
      clearInterval(urlCheckInterval);
      urlCheckInterval = null;
    }

    resetFilters();

    if (filterContainer) {
      filterContainer.remove();
      filterContainer = null;
    }

    removeStyles();

    // Clear state
    taskTypes = [];
    allTasks = [];
    tasksByType = {};
    selectedTypes = {};
    lastError = null;

    console.log('TaskTypeFilter: Cleaned up');
  }

  return {
    init,
    cleanup,
    isActive: () => isActiveState,
    refresh: () => {
      if (filterContainer) {
        filterContainer.remove();
        filterContainer = null;
      }
      allTasks = [];
      tasksByType = {};
      chrome.storage.local.remove([CACHE_KEY]).catch(() => {});
      scanAndBuild();
    }
  };
})();

// Export to window for content.js orchestration
if (typeof window !== 'undefined') {
  window.TaskTypeFilterFeature = TaskTypeFilterFeature;
}
