/**
 * JT Power Tools - Task Type Filter Feature
 * Injects a "TASKS" row into the Schedule Availability table showing unassigned tasks
 * from the JT API, with a filter bar to filter by task type (Labor, Material, etc.)
 *
 * What this builds (injected into the existing schedule table):
 *   [Header: "As of: date" | "2-Mar Monday" | "3-Mar Tuesday" ...]
 *   [TASKS row: "TASKS" label + filter chips | task cards per day column] ← WE BUILD THIS
 *   [Assignee rows: Warren, Tommy, Ben, Ethan, Jose...] ← already in JobTread
 *
 * API calls (Pave):
 *   1. organization.taskTypes.nodes { id, name }
 *   2. organization.tasks (unassigned, by date range) with taskType, job info
 *
 * @module TaskTypeFilterFeature
 * @version 2.0.0
 * @requires JobTreadAPI, TimingUtils, Sanitizer
 */

const TaskTypeFilterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let urlCheckInterval = null;
  let styleElement = null;
  let debouncedScanAndBuild = null;

  // Storage keys
  const STORAGE_KEY = 'jtTaskTypeFilterSelections';
  const CACHE_KEY = 'jtTaskTypeFilterCache';
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // State
  let taskTypes = [];            // Array of { id, name } from API
  let selectedTypes = {};        // { typeId: true/false }
  let tasksByType = {};          // { typeId: [...tasks] }
  let unassignedTasks = [];      // Filtered to unassigned only
  let isLoading = false;
  let lastError = null;
  let _isCollapsed = false;

  // Injected DOM elements
  let tasksRow = null;           // The <tr> we inject
  let filterBarRow = null;       // The filter bar <tr>

  // Date range + column mapping
  let visibleDates = [];         // Array of 'YYYY-MM-DD' strings matching table columns
  let colCount = 0;

  // ─── VIEW DETECTION ───────────────────────────────────────

  function isAvailabilityView() {
    if (!window.location.pathname.includes('/schedule')) return false;

    const availabilityBtn = document.querySelector('button[class*="flex"][class*="items-center"]');
    if (availabilityBtn && availabilityBtn.textContent.includes('Availability')) return true;

    const assigneeSidebar = document.querySelector('div.text-xs.uppercase.truncate.p-1.border-b.font-bold.text-jtOrange');
    if (assigneeSidebar) return true;

    return false;
  }

  // ─── DATE PARSING ─────────────────────────────────────────

  /**
   * Parse visible dates from the schedule table header.
   * Returns an array of date strings (YYYY-MM-DD) matching each column after the first (label) column.
   *
   * Header structure:
   *   Row 1: [empty th] [day-of-week abbrevs: SUN, MON, TUE...]
   *   Row 2: [empty th] [date numbers: 2, 3, 4...]
   *
   * We also extract the date from "2-Mar" style headers (e.g. "2-Mar\nMonday")
   */
  function parseVisibleDates() {
    const table = document.querySelector('table');
    if (!table) return [];

    const thead = table.querySelector('thead');
    if (!thead) return [];

    const headerRows = thead.querySelectorAll('tr');

    // Try to get dates from the first header row which may have "2-Mar\nMonday" format
    const firstRow = headerRows[0];
    if (!firstRow) return [];

    const thCells = firstRow.querySelectorAll('th');
    const dates = [];
    const dateContext = findDateContext();
    const year = dateContext.year || new Date().getFullYear();

    // Month abbreviation map
    const monthAbbrevs = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    // Try parsing "2-Mar" format from first header row
    thCells.forEach((th, index) => {
      if (index === 0) return; // Skip label column
      const text = th.textContent.trim();

      // Match "2-Mar", "15-Jan", etc.
      const match = text.match(/(\d{1,2})-([A-Za-z]{3})/);
      if (match) {
        const day = parseInt(match[1], 10);
        const monthStr = match[2].toLowerCase();
        const month = monthAbbrevs[monthStr];
        if (month !== undefined) {
          dates.push(formatDate(new Date(year, month, day)));
          return;
        }
      }

      // Fallback: just a number (date) — need month from context
      const num = parseInt(text, 10);
      if (!isNaN(num) && num >= 1 && num <= 31 && dateContext.month !== null) {
        dates.push(formatDate(new Date(year, dateContext.month, num)));
      }
    });

    // If first row didn't work, try second row (pure date numbers)
    if (dates.length === 0 && headerRows.length >= 2) {
      const secondRow = headerRows[1];
      const cells = secondRow.querySelectorAll('th');
      const month = dateContext.month !== null ? dateContext.month : new Date().getMonth();

      cells.forEach((cell, index) => {
        if (index === 0) return;
        const text = cell.textContent.trim();
        const num = parseInt(text, 10);
        if (!isNaN(num) && num >= 1 && num <= 31) {
          dates.push(formatDate(new Date(year, month, num)));
        }
      });
    }

    return dates;
  }

  function findDateContext() {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];

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

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── API CALLS ──────────────────────────────────────────────

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
   * Fetch tasks for a date range — we get ALL tasks, then filter to unassigned client-side
   * (Pave doesn't support filtering by empty assignedMemberships)
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
            job: { id: {}, name: {}, number: {} }
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

  async function getOrgId() {
    try {
      const local = await chrome.storage.local.get(['jtpro_org_id']);
      if (local.jtpro_org_id) return local.jtpro_org_id;
      const sync = await chrome.storage.sync.get(['jtToolsOrgId']);
      return sync.jtToolsOrgId || null;
    } catch (e) {
      console.error('TaskTypeFilter: Error getting org ID:', e);
      return null;
    }
  }

  async function executePaveQuery(query) {
    if (typeof window.JobTreadAPI !== 'undefined' && window.JobTreadAPI.paveQuery) {
      return await window.JobTreadAPI.paveQuery(query);
    }

    const apiKey = await getGrantKey();
    if (!apiKey) throw new Error('No API key available');

    const wrappedQuery = {
      query: { $: { grantKey: apiKey }, ...query }
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

    if (!result.success) throw new Error(result.error || 'API request failed');
    return result.data;
  }

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

  async function loadData() {
    if (isLoading) return;
    isLoading = true;
    lastError = null;
    renderInjectedRows(); // Show loading state

    try {
      // Parse dates from table header
      visibleDates = parseVisibleDates();
      if (visibleDates.length === 0) {
        throw new Error('Could not determine visible date range');
      }

      const startDate = visibleDates[0];
      const endDate = visibleDates[visibleDates.length - 1];

      // Check cache
      const cached = await getCachedData();
      let allTasks;
      if (cached && cached.startDate === startDate && cached.endDate === endDate) {
        taskTypes = cached.taskTypes;
        allTasks = cached.tasks;
        console.log('TaskTypeFilter: Using cached data');
      } else {
        const [types, tasks] = await Promise.all([
          fetchTaskTypes(),
          fetchTasksForDateRange(startDate, endDate)
        ]);
        taskTypes = types;
        allTasks = tasks;

        await setCachedData({
          startDate, endDate, taskTypes: types, tasks, timestamp: Date.now()
        });
        console.log(`TaskTypeFilter: Loaded ${types.length} task types, ${tasks.length} tasks`);
      }

      // Filter to unassigned tasks only
      unassignedTasks = allTasks.filter(task => {
        const assignees = task.assignedMemberships?.nodes || [];
        return assignees.length === 0;
      });

      console.log(`TaskTypeFilter: ${unassignedTasks.length} unassigned tasks out of ${allTasks.length} total`);

      // Index by type
      tasksByType = {};
      taskTypes.forEach(t => { tasksByType[t.id] = []; });
      tasksByType['_untyped'] = [];

      unassignedTasks.forEach(task => {
        const typeId = task.taskType ? task.taskType.id : '_untyped';
        if (!tasksByType[typeId]) tasksByType[typeId] = [];
        tasksByType[typeId].push(task);
      });

      // Load saved type selections
      await loadSelections();
      taskTypes.forEach(t => {
        if (selectedTypes[t.id] === undefined) selectedTypes[t.id] = true;
      });
      if (tasksByType['_untyped'].length > 0 && selectedTypes['_untyped'] === undefined) {
        selectedTypes['_untyped'] = true;
      }

    } catch (error) {
      console.error('TaskTypeFilter: Error loading data:', error);
      lastError = error.message;
    } finally {
      isLoading = false;
      renderInjectedRows();
    }
  }

  async function getCachedData() {
    try {
      const result = await chrome.storage.local.get([CACHE_KEY]);
      const cached = result[CACHE_KEY];
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached;
      return null;
    } catch (e) { return null; }
  }

  async function setCachedData(data) {
    try { await chrome.storage.local.set({ [CACHE_KEY]: data }); }
    catch (e) { console.error('TaskTypeFilter: Cache write error:', e); }
  }

  async function loadSelections() {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEY]);
      if (result[STORAGE_KEY]) selectedTypes = result[STORAGE_KEY];
    } catch (e) { /* ignore */ }
  }

  async function saveSelections() {
    try { await chrome.storage.sync.set({ [STORAGE_KEY]: selectedTypes }); }
    catch (e) { /* ignore */ }
  }

  // ─── TASK CARD COLOR ───────────────────────────────────────

  // Assign consistent colors to task types for visual distinction
  const TYPE_COLORS = [
    '#FDE68A', '#BFDBFE', '#BBF7D0', '#FECACA', '#DDD6FE',
    '#FED7AA', '#A5F3FC', '#FBCFE8', '#D9F99D', '#E9D5FF'
  ];

  function getTypeColor(typeId) {
    if (typeId === '_untyped') return '#E5E7EB';
    const idx = taskTypes.findIndex(t => t.id === typeId);
    return TYPE_COLORS[idx % TYPE_COLORS.length] || '#FDE68A';
  }

  // ─── DOM INJECTION ─────────────────────────────────────────

  /**
   * Get the column count and tbody reference from the schedule table
   */
  function getTableInfo() {
    const table = document.querySelector('table');
    if (!table) return null;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return null;

    const firstHeaderRow = thead.querySelector('tr');
    const cols = firstHeaderRow ? firstHeaderRow.querySelectorAll('th').length : 0;

    return { table, thead, tbody, colCount: cols };
  }

  /**
   * Find the first row in tbody — we insert our rows BEFORE it
   * (above all assignee rows like INTERNAL, Warren, etc.)
   */
  function getFirstBodyRow() {
    const info = getTableInfo();
    if (!info) return null;
    return info.tbody.querySelector('tr');
  }

  /**
   * Build and render the injected TASKS row and filter bar row
   */
  function renderInjectedRows() {
    const info = getTableInfo();
    if (!info) return;

    colCount = info.colCount;
    const { tbody } = info;

    // Remove old rows if they exist
    removeInjectedRows();

    // === FILTER BAR ROW ===
    filterBarRow = document.createElement('tr');
    filterBarRow.id = 'jt-ttf-filter-row';
    filterBarRow.className = 'jt-ttf-injected-row';

    const filterTd = document.createElement('td');
    filterTd.setAttribute('colspan', colCount);
    filterTd.className = 'jt-ttf-filter-cell';
    filterTd.innerHTML = buildFilterBarHTML();
    filterBarRow.appendChild(filterTd);

    // === TASKS ROW ===
    tasksRow = document.createElement('tr');
    tasksRow.id = 'jt-ttf-tasks-row';
    tasksRow.className = 'jt-ttf-injected-row';

    // First cell: "TASKS" label
    const labelTd = document.createElement('td');
    labelTd.className = 'jt-ttf-label-cell border-r';
    labelTd.innerHTML = `
      <div>
        <div class="jt-ttf-tasks-label">TASKS</div>
        <div class="jt-ttf-task-count">${unassignedTasks.length} unassigned</div>
      </div>
    `;
    tasksRow.appendChild(labelTd);

    // Day columns — one <td> per visible date
    if (isLoading) {
      const loadingTd = document.createElement('td');
      loadingTd.setAttribute('colspan', colCount - 1);
      loadingTd.className = 'jt-ttf-day-cell';
      loadingTd.innerHTML = '<div class="jt-ttf-loading-msg">Loading unassigned tasks...</div>';
      tasksRow.appendChild(loadingTd);
    } else if (lastError) {
      const errorTd = document.createElement('td');
      errorTd.setAttribute('colspan', colCount - 1);
      errorTd.className = 'jt-ttf-day-cell';
      errorTd.innerHTML = `<div class="jt-ttf-error-msg">${Sanitizer.escapeHTML(lastError)}</div>`;
      tasksRow.appendChild(errorTd);
    } else {
      // Get filtered tasks (by selected types)
      const filteredTasks = getFilteredTasks();

      // Group tasks by startDate
      const tasksByDate = {};
      filteredTasks.forEach(task => {
        const date = task.startDate;
        if (!tasksByDate[date]) tasksByDate[date] = [];
        tasksByDate[date].push(task);
      });

      // Build one <td> per column date
      for (let i = 0; i < visibleDates.length; i++) {
        const date = visibleDates[i];
        const td = document.createElement('td');
        td.className = 'jt-ttf-day-cell border-r';

        const dayTasks = tasksByDate[date] || [];
        if (dayTasks.length > 0) {
          dayTasks.forEach(task => {
            td.appendChild(buildTaskCard(task));
          });

          // "+ Add" link at the bottom, like native JT
          const addLink = document.createElement('div');
          addLink.className = 'jt-ttf-add-link';
          addLink.textContent = `+ ${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}`;
          td.appendChild(addLink);
        }

        tasksRow.appendChild(td);
      }

      // If colCount > visibleDates + 1 (label col), fill remaining columns
      const remaining = colCount - 1 - visibleDates.length;
      for (let i = 0; i < remaining; i++) {
        const emptyTd = document.createElement('td');
        emptyTd.className = 'jt-ttf-day-cell border-r';
        tasksRow.appendChild(emptyTd);
      }
    }

    // Insert into tbody — filter bar first, then tasks row, both before all other rows
    const firstRow = tbody.querySelector('tr');
    if (firstRow) {
      tbody.insertBefore(tasksRow, firstRow);
      tbody.insertBefore(filterBarRow, tasksRow);
    } else {
      tbody.appendChild(filterBarRow);
      tbody.appendChild(tasksRow);
    }

    // Attach filter event listeners
    attachFilterListeners(filterBarRow);

    console.log('TaskTypeFilter: Injected TASKS row and filter bar');
  }

  /**
   * Build a single task card element
   */
  function buildTaskCard(task) {
    const typeId = task.taskType ? task.taskType.id : '_untyped';
    const bgColor = getTypeColor(typeId);
    const typeName = task.taskType ? task.taskType.name : '';
    const jobName = task.job ? (task.job.name || '') : '';
    const jobNumber = task.job ? (task.job.number || '') : '';
    const jobLabel = jobNumber ? `${jobName} ${jobNumber}` : jobName;

    const card = document.createElement('div');
    card.className = 'jt-ttf-task-card cursor-pointer';
    card.style.backgroundColor = bgColor;
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('title', `${task.name}\n${jobLabel}${typeName ? '\nType: ' + typeName : ''}`);

    card.innerHTML = `
      <div class="jt-ttf-task-name">${Sanitizer.escapeHTML(task.name)}</div>
      <div class="jt-ttf-task-job">${Sanitizer.escapeHTML(jobLabel)}</div>
    `;

    // Click to open task sidebar (stays on current page)
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskSidebar(task.id);
    });

    return card;
  }

  /**
   * Get the org slug from the current URL path
   * URL pattern: /ORG_SLUG/schedule
   */
  function getOrgSlug() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] || '';
  }

  /**
   * Open the task sidebar by navigating to the current schedule URL with ?taskId=
   * JT's SPA router picks up the taskId param and opens the sidebar automatically.
   * We use a hidden <a> element to trigger JT's client-side navigation
   * (pushState alone won't trigger the React router).
   */
  function openTaskSidebar(taskId) {
    if (!taskId) return;

    const orgSlug = getOrgSlug();
    const sidebarUrl = `/${orgSlug}/schedule?taskId=${taskId}`;

    // Create a temporary anchor and click it to trigger JT's SPA router
    const link = document.createElement('a');
    link.href = sidebarUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  /**
   * Get tasks filtered by the currently selected types
   */
  function getFilteredTasks() {
    return unassignedTasks.filter(task => {
      const typeId = task.taskType ? task.taskType.id : '_untyped';
      return selectedTypes[typeId] !== false;
    });
  }

  /**
   * Remove our injected rows from the DOM
   */
  function removeInjectedRows() {
    const existing1 = document.getElementById('jt-ttf-filter-row');
    const existing2 = document.getElementById('jt-ttf-tasks-row');
    if (existing1) existing1.remove();
    if (existing2) existing2.remove();
    filterBarRow = null;
    tasksRow = null;
  }

  // ─── FILTER BAR ────────────────────────────────────────────

  function buildFilterBarHTML() {
    let chipsHtml = '';
    if (taskTypes.length > 0) {
      taskTypes.forEach((type, idx) => {
        const isActive = selectedTypes[type.id] !== false;
        const count = (tasksByType[type.id] || []).length;
        const color = TYPE_COLORS[idx % TYPE_COLORS.length];
        chipsHtml += `
          <button class="jt-ttf-chip ${isActive ? 'active' : ''}"
                  data-type-id="${Sanitizer.escapeHTML(type.id)}"
                  style="--chip-color: ${color}"
                  title="${Sanitizer.escapeHTML(type.name)}: ${count} task${count !== 1 ? 's' : ''}">
            <span class="jt-ttf-chip-dot" style="background: ${color}"></span>
            <span class="jt-ttf-chip-label">${Sanitizer.escapeHTML(type.name)}</span>
            <span class="jt-ttf-chip-count">${count}</span>
          </button>`;
      });

      const untypedCount = (tasksByType['_untyped'] || []).length;
      if (untypedCount > 0) {
        const isActive = selectedTypes['_untyped'] !== false;
        chipsHtml += `
          <button class="jt-ttf-chip untyped ${isActive ? 'active' : ''}"
                  data-type-id="_untyped"
                  title="No Type: ${untypedCount} task${untypedCount !== 1 ? 's' : ''}">
            <span class="jt-ttf-chip-dot" style="background: #E5E7EB"></span>
            <span class="jt-ttf-chip-label">No Type</span>
            <span class="jt-ttf-chip-count">${untypedCount}</span>
          </button>`;
      }
    }

    const activeCount = Object.values(selectedTypes).filter(v => v !== false).length;
    const totalTypes = taskTypes.length + ((tasksByType['_untyped'] || []).length > 0 ? 1 : 0);

    return `
      <div class="jt-ttf-filter-bar ${_isCollapsed ? 'collapsed' : ''}">
        <div class="jt-ttf-bar-header">
          <span class="jt-ttf-bar-title">Filter by Type</span>
          <span class="jt-ttf-badge">${activeCount}/${totalTypes}</span>
          <div class="jt-ttf-actions">
            <button class="jt-ttf-action" data-action="all" title="Show all">All</button>
            <button class="jt-ttf-action" data-action="none" title="Hide all">None</button>
            <button class="jt-ttf-action" data-action="refresh" title="Refresh">↻</button>
          </div>
          <button class="jt-ttf-toggle" title="Collapse">▾</button>
        </div>
        <div class="jt-ttf-chips-wrap">
          ${chipsHtml || '<span class="jt-ttf-empty">No task types found</span>'}
        </div>
        ${lastError ? `<div class="jt-ttf-error-inline">${Sanitizer.escapeHTML(lastError)}</div>` : ''}
        ${isLoading ? '<div class="jt-ttf-loading-inline">Loading...</div>' : ''}
      </div>
    `;
  }

  function attachFilterListeners(row) {
    if (!row) return;

    // Toggle collapse
    const toggleBtn = row.querySelector('.jt-ttf-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const bar = row.querySelector('.jt-ttf-filter-bar');
        if (bar) {
          bar.classList.toggle('collapsed');
          _isCollapsed = bar.classList.contains('collapsed');
        }
      });
    }

    // Header click collapse
    const header = row.querySelector('.jt-ttf-bar-header');
    if (header) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.jt-ttf-action') || e.target.closest('.jt-ttf-toggle')) return;
        const bar = row.querySelector('.jt-ttf-filter-bar');
        if (bar) {
          bar.classList.toggle('collapsed');
          _isCollapsed = bar.classList.contains('collapsed');
        }
      });
    }

    // Chip toggles
    row.querySelectorAll('.jt-ttf-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const typeId = chip.getAttribute('data-type-id');
        selectedTypes[typeId] = !chip.classList.contains('active');
        chip.classList.toggle('active');
        updateBadge(row);
        saveSelections();
        renderInjectedRows(); // Re-render task cards with new filter
      });
    });

    // All / None / Refresh
    row.querySelectorAll('.jt-ttf-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        if (action === 'all') {
          Object.keys(selectedTypes).forEach(k => { selectedTypes[k] = true; });
          saveSelections();
          renderInjectedRows();
        } else if (action === 'none') {
          Object.keys(selectedTypes).forEach(k => { selectedTypes[k] = false; });
          saveSelections();
          renderInjectedRows();
        } else if (action === 'refresh') {
          try { await chrome.storage.local.remove([CACHE_KEY]); } catch (e) { /* */ }
          loadData();
        }
      });
    });
  }

  function updateBadge(row) {
    if (!row) return;
    const badge = row.querySelector('.jt-ttf-badge');
    if (!badge) return;
    const activeCount = Object.values(selectedTypes).filter(v => v !== false).length;
    const totalTypes = taskTypes.length + ((tasksByType['_untyped'] || []).length > 0 ? 1 : 0);
    badge.textContent = `${activeCount}/${totalTypes}`;
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
    if (styleElement) { styleElement.remove(); styleElement = null; }
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────

  function scanAndBuild() {
    if (!isActiveState) return;

    if (!isAvailabilityView()) {
      removeInjectedRows();
      return;
    }

    // Check if our rows are still in the DOM (JT may have re-rendered)
    const existingTasksRow = document.getElementById('jt-ttf-tasks-row');
    if (existingTasksRow) return; // Already injected and present

    // If we have data, just re-render; otherwise load fresh
    if (unassignedTasks.length > 0 || taskTypes.length > 0) {
      renderInjectedRows();
    } else {
      loadData();
    }
  }

  async function init() {
    if (isActiveState) {
      console.log('TaskTypeFilter: Already active');
      return;
    }

    isActiveState = true;
    console.log('TaskTypeFilter: Initializing...');

    injectStyles();

    if (typeof TimingUtils !== 'undefined' && TimingUtils.debounce) {
      debouncedScanAndBuild = TimingUtils.debounce(scanAndBuild, 300);
    } else {
      let debounceTimer = null;
      debouncedScanAndBuild = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanAndBuild, 300);
      };
    }

    scanAndBuild();

    observer = new MutationObserver(() => {
      if (!isActiveState) return;
      debouncedScanAndBuild();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });

    let lastUrl = window.location.href;
    urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        removeInjectedRows();
        unassignedTasks = [];
        tasksByType = {};
        taskTypes = [];
        scanAndBuild();
      }
    }, 1000);

    console.log('TaskTypeFilter: Initialized');
  }

  function cleanup() {
    if (!isActiveState) return;
    isActiveState = false;
    console.log('TaskTypeFilter: Cleaning up...');

    if (observer) { observer.disconnect(); observer = null; }
    if (urlCheckInterval) { clearInterval(urlCheckInterval); urlCheckInterval = null; }

    removeInjectedRows();
    removeStyles();

    taskTypes = [];
    unassignedTasks = [];
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
      removeInjectedRows();
      unassignedTasks = [];
      tasksByType = {};
      chrome.storage.local.remove([CACHE_KEY]).catch(() => {});
      scanAndBuild();
    }
  };
})();

if (typeof window !== 'undefined') {
  window.TaskTypeFilterFeature = TaskTypeFilterFeature;
}
