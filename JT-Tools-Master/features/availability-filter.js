/**
 * JT Power Tools - Availability Filter Feature
 * Filters assignees in the Schedule Availability view by role/department or category (Internal/Vendor)
 *
 * @module AvailabilityFilterFeature
 * @version 1.0.0
 * @requires TimingUtils
 */

const AvailabilityFilterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let urlCheckInterval = null;
  let styleElement = null;
  let filterContainer = null;
  let debouncedScanAndBuild = null;

  // Storage keys for persisting filter selections and saved views
  const STORAGE_KEY = 'jtAvailabilityFilterSelections';
  const SAVED_VIEWS_KEY = 'jtAvailabilityFilterSavedViews';

  // Track current filters
  // Structure: { categories: { 'INTERNAL': true }, assignees: { 'INTERNAL': { '01 Field': true } } }
  let currentFilters = {
    categories: {},
    assignees: {}
  };

  // Track detected assignee data - per category
  let detectedCategories = new Set();
  let detectedAssigneesByCategory = {}; // e.g., { 'INTERNAL': Set(['01 Field', ...]), 'VENDOR': Set(['ABC Co', ...]) }

  // Track collapsed state (hidden rows are collapsed to minimal height instead of display:none)
  let useCollapseMode = true;

  /**
   * Check if we're on the Schedule Availability view
   */
  function isAvailabilityView() {
    // Must be on schedule page
    if (!window.location.pathname.includes('/schedule')) {
      return false;
    }

    // Check for Availability view indicator - the button/dropdown that says "Availability"
    const availabilityBtn = document.querySelector('button[class*="flex"][class*="items-center"]');
    if (availabilityBtn && availabilityBtn.textContent.includes('Availability')) {
      return true;
    }

    // Alternative check: look for the assignee sidebar structure
    const assigneeSidebar = document.querySelector('div.text-xs.uppercase.truncate.p-1.border-b.font-bold.text-jtOrange');
    if (assigneeSidebar) {
      return true;
    }

    // Check for the availability table structure with assignee rows
    const assigneeRows = document.querySelectorAll('tr[class*="group"]');
    for (const row of assigneeRows) {
      const roleCell = row.querySelector('div.truncate');
      if (roleCell && /^\d{2}\s/.test(roleCell.textContent.trim())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scan the page for categories and their assignees
   *
   * Structure:
   * - Each category (INTERNAL, VENDOR, ZZ ASSIGNEE PLACEHOLDER, etc.) has assignees under it
   * - For INTERNAL: we use the ROLE as the child identifier (01 Field, 02 Project Supervisor, etc.)
   * - For all other categories: we use the assignee NAME as the child identifier
   *
   * IMPORTANT: The first assignee can be in the SAME row as the category header!
   * We need to check for assignee cards in header rows too.
   */
  function scanForFilters() {
    detectedCategories.clear();
    detectedAssigneesByCategory = {};

    // Find all orange category headers
    const categoryHeaders = document.querySelectorAll('div.text-xs.uppercase.truncate.p-1.border-b.font-bold');

    categoryHeaders.forEach(header => {
      const text = header.textContent.trim().toUpperCase();
      if (text && text.length > 0 && text.length < 50) {
        detectedCategories.add(text);
        detectedAssigneesByCategory[text] = new Set();
      }
    });

    // Now scan table rows to collect assignees per category
    // We need to track which section we're in as we iterate
    let currentCategory = null;

    const tableRows = document.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
      const firstCell = row.querySelector('td:first-child');
      if (!firstCell) return;

      // Check if this row contains a category header (orange text)
      const categoryHeader = firstCell.querySelector('.text-jtOrange') ||
                            firstCell.querySelector('[class*="text-jtOrange"]');

      if (categoryHeader) {
        // This is a category header row - update current section
        currentCategory = categoryHeader.textContent.trim().toUpperCase();

        // Ensure the category exists in our tracking
        if (!detectedAssigneesByCategory[currentCategory]) {
          detectedAssigneesByCategory[currentCategory] = new Set();
        }

        // IMPORTANT: The first assignee might be in this same row!
        // Check for assignee cards in this row
        const assigneeCards = firstCell.querySelectorAll('div.p-1.flex.items-center.space-x-1');
        assigneeCards.forEach(card => {
          const childIdentifier = getAssigneeIdentifier(card, currentCategory);
          if (childIdentifier) {
            detectedAssigneesByCategory[currentCategory].add(childIdentifier);
          }
        });
        return;
      }

      // Collect from pure assignee rows (no header)
      if (currentCategory && detectedAssigneesByCategory[currentCategory]) {
        const assigneeCards = firstCell.querySelectorAll('div.p-1.flex.items-center.space-x-1');
        assigneeCards.forEach(card => {
          const childIdentifier = getAssigneeIdentifier(card, currentCategory);
          if (childIdentifier) {
            detectedAssigneesByCategory[currentCategory].add(childIdentifier);
          }
        });
      }
    });

    console.log('AvailabilityFilter: Detected categories:', Array.from(detectedCategories));
    console.log('AvailabilityFilter: Detected assignees by category:',
      Object.fromEntries(
        Object.entries(detectedAssigneesByCategory).map(([k, v]) => [k, Array.from(v)])
      )
    );

    return {
      categories: Array.from(detectedCategories).sort(),
      assigneesByCategory: Object.fromEntries(
        Object.entries(detectedAssigneesByCategory).map(([k, v]) => [k, Array.from(v).sort()])
      )
    };
  }

  /**
   * Get the identifier for an assignee card based on category
   * - For INTERNAL: use role (e.g., "01 Field") - the non-bold text below the name
   * - For VENDOR: use vendor company name (the link text below the contact name)
   * - For all others: use the name (bold text)
   *
   * Card structure:
   * - INTERNAL: [Avatar] [Name (bold)] [Role (non-bold truncate)]
   * - VENDOR: [Avatar] [Contact Name (bold)] [Vendor Company (link)]
   * - Others: [Avatar] [Name (bold)] [optional subtitle]
   */
  function getAssigneeIdentifier(card, category) {
    if (category === 'INTERNAL') {
      // For internal, use the role (non-bold truncate div)
      const roleDiv = card.querySelector('div.truncate:not(.font-bold)');
      if (roleDiv) {
        const roleText = roleDiv.textContent.trim();
        if (roleText && roleText.length > 0) {
          return roleText;
        }
      }
    } else {
      // For vendors and other categories, check for a link first (vendor company name)
      // Structure: <div class="truncate"><a href="/vendors/..." class="text-cyan-500">Vendor Name</a></div>
      const linkElement = card.querySelector('a[href*="/vendors"], a.text-cyan-500');
      if (linkElement) {
        const linkText = linkElement.textContent.trim();
        if (linkText && linkText.length > 0) {
          return linkText;
        }
      }

      // Fallback: use the name (bold truncate div) for categories without vendor links
      const nameDiv = card.querySelector('div.font-bold.truncate');
      if (nameDiv) {
        const nameText = nameDiv.textContent.trim();
        if (nameText && nameText.length > 0) {
          return nameText;
        }
      }
    }
    return null;
  }

  /**
   * Load saved filter selections from storage
   */
  async function loadFilterSelections() {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        const saved = result[STORAGE_KEY];
        currentFilters = {
          categories: saved.categories || {},
          assignees: saved.assignees || {}
        };

        // Migrate from old format (roles/vendors) to new format (assignees)
        if (saved.roles && Object.keys(saved.roles).length > 0) {
          if (!currentFilters.assignees['INTERNAL']) {
            currentFilters.assignees['INTERNAL'] = {};
          }
          Object.assign(currentFilters.assignees['INTERNAL'], saved.roles);
        }
        if (saved.vendors && Object.keys(saved.vendors).length > 0) {
          if (!currentFilters.assignees['VENDOR']) {
            currentFilters.assignees['VENDOR'] = {};
          }
          Object.assign(currentFilters.assignees['VENDOR'], saved.vendors);
        }

        console.log('AvailabilityFilter: Loaded saved filters:', currentFilters);
      }
    } catch (error) {
      console.error('AvailabilityFilter: Error loading filter selections:', error);
    }
  }

  /**
   * Save filter selections to storage
   */
  async function saveFilterSelections() {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: currentFilters });
      console.log('AvailabilityFilter: Saved filter selections');
    } catch (error) {
      console.error('AvailabilityFilter: Error saving filter selections:', error);
    }
  }

  /**
   * Load saved views from storage
   */
  async function loadSavedViews() {
    try {
      const result = await chrome.storage.sync.get([SAVED_VIEWS_KEY]);
      return result[SAVED_VIEWS_KEY] || [];
    } catch (error) {
      console.error('AvailabilityFilter: Error loading saved views:', error);
      return [];
    }
  }

  /**
   * Save a new view to storage
   */
  async function saveNewView(viewName) {
    try {
      const views = await loadSavedViews();
      const newView = {
        id: Date.now().toString(),
        name: viewName,
        filters: JSON.parse(JSON.stringify(currentFilters)), // Deep copy
        createdAt: new Date().toISOString()
      };
      views.push(newView);
      await chrome.storage.sync.set({ [SAVED_VIEWS_KEY]: views });
      console.log('AvailabilityFilter: Saved new view:', viewName);
      return newView;
    } catch (error) {
      console.error('AvailabilityFilter: Error saving view:', error);
      return null;
    }
  }

  /**
   * Delete a saved view
   */
  async function deleteSavedView(viewId) {
    try {
      const views = await loadSavedViews();
      const filteredViews = views.filter(v => v.id !== viewId);
      await chrome.storage.sync.set({ [SAVED_VIEWS_KEY]: filteredViews });
      console.log('AvailabilityFilter: Deleted view:', viewId);
      return true;
    } catch (error) {
      console.error('AvailabilityFilter: Error deleting view:', error);
      return false;
    }
  }

  /**
   * Apply a saved view
   */
  function applySavedView(view) {
    // Deep copy the saved filters
    currentFilters = JSON.parse(JSON.stringify(view.filters));
    updateChipStates();
    applyFilters();
    saveFilterSelections();
    console.log('AvailabilityFilter: Applied view:', view.name);
  }

  /**
   * Setup saved views event listeners
   */
  function setupSavedViewsListeners() {
    if (!filterContainer) return;

    const viewsBtn = filterContainer.querySelector('.jt-avail-saved-views-btn');
    const viewsDropdown = filterContainer.querySelector('.jt-avail-saved-views-dropdown');
    const saveBtn = filterContainer.querySelector('.jt-avail-save-view-btn');

    if (!viewsBtn || !viewsDropdown) return;

    // Toggle dropdown on button click
    viewsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isOpen = viewsDropdown.classList.contains('open');

      // Close dropdown if open
      if (isOpen) {
        viewsDropdown.classList.remove('open');
        return;
      }

      // Position the dropdown below the button (using fixed positioning)
      const btnRect = viewsBtn.getBoundingClientRect();
      viewsDropdown.style.top = (btnRect.bottom + 4) + 'px';
      viewsDropdown.style.right = (window.innerWidth - btnRect.right) + 'px';

      // Load and display saved views
      const views = await loadSavedViews();
      const listContainer = viewsDropdown.querySelector('.jt-avail-saved-views-list');

      if (views.length === 0) {
        listContainer.innerHTML = '<div class="jt-avail-saved-views-empty">No saved views yet</div>';
      } else {
        listContainer.innerHTML = views.map(view => `
          <div class="jt-avail-saved-view-item" data-view-id="${escapeHtml(view.id)}">
            <span class="jt-avail-saved-view-name" title="Click to apply">${escapeHtml(view.name)}</span>
            <button class="jt-avail-saved-view-delete" title="Delete view" data-view-id="${escapeHtml(view.id)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `).join('');

        // Add click listeners to view items
        listContainer.querySelectorAll('.jt-avail-saved-view-name').forEach(item => {
          item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const viewId = item.closest('.jt-avail-saved-view-item').dataset.viewId;
            const views = await loadSavedViews();
            const view = views.find(v => v.id === viewId);
            if (view) {
              applySavedView(view);
              viewsDropdown.classList.remove('open');
            }
          });
        });

        // Add click listeners to delete buttons
        listContainer.querySelectorAll('.jt-avail-saved-view-delete').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const viewId = btn.dataset.viewId;
            if (confirm('Delete this saved view?')) {
              await deleteSavedView(viewId);
              // Refresh the list
              viewsBtn.click();
              viewsBtn.click();
            }
          });
        });
      }

      viewsDropdown.classList.add('open');
    });

    // Save current view button
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const viewName = prompt('Enter a name for this view:');
        if (viewName && viewName.trim()) {
          await saveNewView(viewName.trim());
          // Close and reopen to refresh
          viewsDropdown.classList.remove('open');
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.jt-avail-saved-views-container')) {
        viewsDropdown.classList.remove('open');
      }
    });
  }

  /**
   * Initialize filter states for newly detected items
   */
  function initializeFilterStates(categories, assigneesByCategory) {
    // Initialize categories (default to visible)
    categories.forEach(cat => {
      if (currentFilters.categories[cat] === undefined) {
        currentFilters.categories[cat] = true;
      }
      // Initialize assignees object for this category
      if (!currentFilters.assignees[cat]) {
        currentFilters.assignees[cat] = {};
      }
    });

    // Initialize assignees per category (default to visible)
    Object.entries(assigneesByCategory).forEach(([category, assignees]) => {
      if (!currentFilters.assignees[category]) {
        currentFilters.assignees[category] = {};
      }
      assignees.forEach(assignee => {
        if (currentFilters.assignees[category][assignee] === undefined) {
          currentFilters.assignees[category][assignee] = true;
        }
      });
    });
  }

  /**
   * Create the filter UI container
   */
  function createFilterUI(categories, assigneesByCategory) {
    // Remove existing container if present
    if (filterContainer) {
      filterContainer.remove();
    }

    filterContainer = document.createElement('div');
    filterContainer.id = 'jt-availability-filter';
    filterContainer.className = 'jt-availability-filter-container collapsed';

    // Build the filter HTML
    let html = `
      <div class="jt-avail-filter-header" title="Click to collapse/expand">
        <span class="jt-avail-filter-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        </span>
        <span class="jt-avail-filter-title">Filter Assignees</span>
        <div class="jt-avail-filter-header-actions">
          <div class="jt-avail-saved-views-container">
            <button class="jt-avail-saved-views-btn" title="Saved filter views">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              <span>Views</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="jt-avail-saved-views-dropdown">
              <div class="jt-avail-saved-views-header">Saved Views</div>
              <div class="jt-avail-saved-views-list"></div>
              <div class="jt-avail-saved-views-actions">
                <button class="jt-avail-save-view-btn" title="Save current filter as a view">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Save Current View
                </button>
              </div>
            </div>
          </div>
          <span class="jt-avail-filter-toggle" title="Toggle filter panel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>
      <div class="jt-avail-filter-content">
    `;

    // Build hierarchical category structure
    categories.forEach(cat => {
      const isCatActive = currentFilters.categories[cat] !== false;
      const categoryAssignees = assigneesByCategory[cat] || [];
      const hasChildren = categoryAssignees.length > 0;

      // Count active children
      const catAssigneeFilters = currentFilters.assignees[cat] || {};
      const activeChildCount = categoryAssignees.filter(assignee =>
        catAssigneeFilters[assignee] !== false
      ).length;
      const someChildrenActive = activeChildCount > 0 && activeChildCount < categoryAssignees.length;

      html += `
        <div class="jt-avail-filter-category ${hasChildren ? 'has-children' : ''}">
          <div class="jt-avail-filter-category-header">
            ${hasChildren ? `
              <button class="jt-avail-filter-expand" data-category="${escapeHtml(cat)}" title="Expand/collapse">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            ` : '<span class="jt-avail-filter-expand-spacer"></span>'}
            <button class="jt-avail-filter-chip category-chip ${isCatActive ? 'active' : ''} ${someChildrenActive ? 'partial' : ''}"
                    data-type="category"
                    data-value="${escapeHtml(cat)}"
                    title="Toggle all ${escapeHtml(cat)}">
              ${escapeHtml(cat)}
              ${hasChildren ? `<span class="jt-avail-role-count">${activeChildCount}/${categoryAssignees.length}</span>` : ''}
            </button>
          </div>
      `;

      // Add children dropdown
      if (hasChildren) {
        html += `
          <div class="jt-avail-filter-roles collapsed" data-category="${escapeHtml(cat)}">
        `;

        categoryAssignees.forEach(assignee => {
          const isChildActive = catAssigneeFilters[assignee] !== false;
          html += `
            <button class="jt-avail-filter-chip assignee-chip ${isChildActive ? 'active' : ''}"
                    data-type="assignee"
                    data-category="${escapeHtml(cat)}"
                    data-value="${escapeHtml(assignee)}"
                    title="Toggle ${escapeHtml(assignee)}">
              ${escapeHtml(assignee)}
            </button>
          `;
        });

        html += `
          </div>
        `;
      }

      html += `</div>`;
    });

    // Quick actions
    html += `
      <div class="jt-avail-filter-actions">
        <button class="jt-avail-filter-action" data-action="all" title="Show all assignees">
          Show All
        </button>
        <button class="jt-avail-filter-action" data-action="none" title="Hide all assignees">
          Hide All
        </button>
      </div>
    `;

    html += `</div>`; // Close content

    filterContainer.innerHTML = html;

    // Add event listeners
    setupFilterEventListeners();

    // Insert into the page
    insertFilterUI();

    return filterContainer;
  }

  /**
   * Escape HTML to prevent XSS - delegates to shared Sanitizer utility
   */
  const escapeHtml = (text) => Sanitizer.escapeHTML(text);

  /**
   * Setup event listeners for filter UI
   */
  function setupFilterEventListeners() {
    if (!filterContainer) return;

    // Click anywhere on header to toggle collapse (except on buttons)
    const header = filterContainer.querySelector('.jt-avail-filter-header');
    if (header) {
      header.addEventListener('click', (e) => {
        // Don't toggle if clicking on the saved views button/dropdown
        if (e.target.closest('.jt-avail-saved-views-container')) {
          return;
        }
        filterContainer.classList.toggle('collapsed');
      });
    }

    // Setup saved views functionality
    setupSavedViewsListeners();

    // Expand/collapse button clicks
    const expandBtns = filterContainer.querySelectorAll('.jt-avail-filter-expand');
    expandBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = btn.dataset.category;
        const rolesContainer = filterContainer.querySelector(`.jt-avail-filter-roles[data-category="${category}"]`);
        if (rolesContainer) {
          rolesContainer.classList.toggle('collapsed');
          btn.classList.toggle('expanded');
        }
      });
    });

    // Category chip clicks - toggle all children in that category
    const categoryChips = filterContainer.querySelectorAll('.jt-avail-filter-chip.category-chip');
    categoryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const category = chip.dataset.value;

        // Toggle category state
        const newState = !currentFilters.categories[category];
        currentFilters.categories[category] = newState;

        // Also toggle all children to match
        if (currentFilters.assignees[category]) {
          Object.keys(currentFilters.assignees[category]).forEach(assignee => {
            currentFilters.assignees[category][assignee] = newState;
          });
        }

        // Update all chip visuals
        updateChipStates();
        applyFilters();
        saveFilterSelections();
      });
    });

    // Assignee chip clicks - toggle individual assignee
    const assigneeChips = filterContainer.querySelectorAll('.jt-avail-filter-chip.assignee-chip');
    assigneeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const category = chip.dataset.category;
        const assignee = chip.dataset.value;

        // Ensure the category's assignees object exists
        if (!currentFilters.assignees[category]) {
          currentFilters.assignees[category] = {};
        }

        // Toggle assignee state
        currentFilters.assignees[category][assignee] = !currentFilters.assignees[category][assignee];

        // Update category state based on children
        const anyAssigneeActive = Object.values(currentFilters.assignees[category]).some(v => v === true);
        currentFilters.categories[category] = anyAssigneeActive;

        // Update all chip visuals
        updateChipStates();
        applyFilters();
        saveFilterSelections();
      });
    });

    // Quick action buttons
    const actionBtns = filterContainer.querySelectorAll('.jt-avail-filter-action');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;

        if (action === 'all') {
          // Show all
          Object.keys(currentFilters.categories).forEach(key => {
            currentFilters.categories[key] = true;
          });
          Object.keys(currentFilters.assignees).forEach(category => {
            Object.keys(currentFilters.assignees[category]).forEach(assignee => {
              currentFilters.assignees[category][assignee] = true;
            });
          });
          // Update UI
          updateChipStates();
          applyFilters();
          saveFilterSelections();
        } else if (action === 'none') {
          // Hide all
          Object.keys(currentFilters.categories).forEach(key => {
            currentFilters.categories[key] = false;
          });
          Object.keys(currentFilters.assignees).forEach(category => {
            Object.keys(currentFilters.assignees[category]).forEach(assignee => {
              currentFilters.assignees[category][assignee] = false;
            });
          });
          // Update UI
          updateChipStates();
          applyFilters();
          saveFilterSelections();
        }
      });
    });
  }

  /**
   * Update chip visual states to match currentFilters
   */
  function updateChipStates() {
    if (!filterContainer) return;

    // Update assignee chips
    const assigneeChips = filterContainer.querySelectorAll('.jt-avail-filter-chip.assignee-chip');
    assigneeChips.forEach(chip => {
      const category = chip.dataset.category;
      const assignee = chip.dataset.value;
      const catAssignees = currentFilters.assignees[category] || {};
      const isActive = catAssignees[assignee] !== false;
      chip.classList.toggle('active', isActive);
    });

    // Update category chips with partial state
    const categoryChips = filterContainer.querySelectorAll('.jt-avail-filter-chip.category-chip');
    categoryChips.forEach(chip => {
      const category = chip.dataset.value;
      const isCatActive = currentFilters.categories[category] !== false;

      chip.classList.toggle('active', isCatActive);

      // Check partial state - use detected assignees for accurate count
      const detectedAssignees = detectedAssigneesByCategory[category];
      if (detectedAssignees && detectedAssignees.size > 0) {
        const detectedArray = Array.from(detectedAssignees);
        const catAssigneeFilters = currentFilters.assignees[category] || {};
        const activeCount = detectedArray.filter(a => catAssigneeFilters[a] !== false).length;
        const totalCount = detectedArray.length;
        const isPartial = activeCount > 0 && activeCount < totalCount;

        chip.classList.toggle('partial', isPartial);

        const countSpan = chip.querySelector('.jt-avail-role-count');
        if (countSpan) {
          countSpan.textContent = `${activeCount}/${totalCount}`;
        }
      }
    });
  }

  /**
   * Insert filter UI into the page
   */
  function insertFilterUI() {
    if (!filterContainer) return;

    // Remove from previous location if it exists
    const existingFilter = document.getElementById('jt-availability-filter');
    if (existingFilter && existingFilter !== filterContainer) {
      existingFilter.remove();
    }

    // Try to find the best insertion point
    // Option 1: After the schedule header/toolbar area (below "My Incomplete Tasks" dropdown row)
    // Look for the filter bar that contains "My Incomplete Tasks", gear icon, "Availability", etc.
    const filterBar = document.querySelector('div.flex.items-center.space-x-2.p-2') ||
                      document.querySelector('div.flex.items-center.gap-2');

    if (filterBar && filterBar.closest('main, [class*="schedule"]')) {
      // Insert after the filter bar's parent row
      const filterBarParent = filterBar.closest('div.flex') || filterBar.parentElement;
      if (filterBarParent && filterBarParent.parentElement) {
        filterBarParent.parentElement.insertBefore(filterContainer, filterBarParent.nextSibling);
        console.log('AvailabilityFilter: Inserted after filter bar');
        return;
      }
    }

    // Option 2: Before the table that contains the availability grid
    const availabilityTable = document.querySelector('table');
    if (availabilityTable) {
      // Find a parent div that's a good container
      const tableContainer = availabilityTable.closest('div.overflow-auto') ||
                            availabilityTable.closest('div.relative') ||
                            availabilityTable.parentElement;

      if (tableContainer && tableContainer.parentElement) {
        tableContainer.parentElement.insertBefore(filterContainer, tableContainer);
        console.log('AvailabilityFilter: Inserted before table container');
        return;
      }
    }

    // Option 3: Find the schedule header with org name and "Schedule" title
    const scheduleHeader = document.querySelector('div.font-bold.text-2xl');
    if (scheduleHeader && scheduleHeader.textContent.includes('Schedule')) {
      const headerContainer = scheduleHeader.closest('div.flex');
      if (headerContainer && headerContainer.parentElement) {
        // Insert after the header section
        headerContainer.parentElement.insertBefore(filterContainer, headerContainer.nextSibling);
        console.log('AvailabilityFilter: Inserted after schedule header');
        return;
      }
    }

    // Fallback: Look for any main content area
    const scheduleContainer = document.querySelector('main') ||
                              document.querySelector('div[class*="schedule"]') ||
                              document.querySelector('div.overflow-auto');

    if (scheduleContainer) {
      // Insert at the beginning of the container
      scheduleContainer.insertBefore(filterContainer, scheduleContainer.firstChild);
      console.log('AvailabilityFilter: Filter UI inserted at container start');
    } else {
      // Last resort: append to body as fixed/floating element
      document.body.appendChild(filterContainer);
      filterContainer.classList.add('floating');
      console.log('AvailabilityFilter: Filter UI appended as floating element');
    }
  }

  /**
   * Apply filters to hide/show assignee rows
   *
   * IMPORTANT: The DOM structure has category headers AND the first assignee in the SAME <tr>!
   * Example structure from user:
   * <tr>
   *   <td class="border-r">
   *     <div>
   *       <div class="text-xs uppercase truncate p-1 border-b font-bold text-jtOrange">Internal</div>
   *       <div class="p-1 flex items-center space-x-1">...assignee card...</div>
   *     </div>
   *   </td>
   *   <td>...task cells for this assignee...</td>
   * </tr>
   *
   * ADDITIONAL COMPLEXITY: Some rows have empty first cells but contain task data in other cells.
   * These "continuation" rows belong to the previous assignee and should follow the same visibility.
   *
   * Strategy:
   * 1. Track the current assignee's visibility as we iterate
   * 2. Apply that visibility to continuation rows (empty first cell)
   */
  function applyFilters() {
    if (!isActiveState) return;

    let hiddenCount = 0;
    let shownCount = 0;

    // Build sets of what should be hidden per category
    const hiddenCategories = new Set();
    const hiddenAssignees = {}; // { 'INTERNAL': Set(['01 Field']), 'VENDOR': Set(['ABC Co']) }

    Object.entries(currentFilters.categories).forEach(([cat, visible]) => {
      if (!visible) hiddenCategories.add(cat.toUpperCase());
    });

    Object.entries(currentFilters.assignees).forEach(([category, assignees]) => {
      hiddenAssignees[category] = new Set();
      Object.entries(assignees).forEach(([assignee, visible]) => {
        if (!visible) hiddenAssignees[category].add(assignee);
      });
    });

    // Track current section as we iterate through rows
    let currentCategory = null;
    let currentAssigneeHidden = false; // Track if current assignee should be hidden

    // Process ALL table rows (tbody tr)
    const tableRows = document.querySelectorAll('tbody tr');

    tableRows.forEach((row, index) => {
      const firstCell = row.querySelector('td:first-child') || row.querySelector('th:first-child');
      if (!firstCell) return;

      // Check if first cell has any meaningful content
      const hasContent = firstCell.textContent.trim().length > 0;

      // Check if this row contains a category header (orange text)
      const categoryHeader = firstCell.querySelector('.text-jtOrange') ||
                            firstCell.querySelector('[class*="text-jtOrange"]');

      if (categoryHeader) {
        // This row has a category header - update current section
        currentCategory = categoryHeader.textContent.trim().toUpperCase();

        // Check if this header row ALSO contains an assignee (first assignee after header)
        const assigneeCard = firstCell.querySelector('div.p-1.flex.items-center.space-x-1');

        if (assigneeCard) {
          // This row has both a header AND an assignee
          const identifier = getAssigneeIdentifier(assigneeCard, currentCategory);

          currentAssigneeHidden = false;

          // Check if this specific assignee is hidden
          if (identifier && hiddenAssignees[currentCategory]) {
            currentAssigneeHidden = hiddenAssignees[currentCategory].has(identifier);
          } else if (hiddenCategories.has(currentCategory)) {
            currentAssigneeHidden = true;
          }

          if (currentAssigneeHidden) {
            row.classList.add('jt-avail-collapsed');
            row.classList.remove('jt-avail-visible');
            hiddenCount++;
          } else {
            row.classList.remove('jt-avail-collapsed');
            row.classList.add('jt-avail-visible');
            shownCount++;
          }
        } else {
          // This is just a header row with no assignee
          // Show header if any child in category is visible
          const catAssigneeFilters = currentFilters.assignees[currentCategory] || {};
          const anyChildVisible = Object.values(catAssigneeFilters).some(v => v === true);

          currentAssigneeHidden = !anyChildVisible && hiddenCategories.has(currentCategory);

          if (currentAssigneeHidden) {
            row.classList.add('jt-avail-collapsed');
            row.classList.remove('jt-avail-visible');
            hiddenCount++;
          } else {
            row.classList.remove('jt-avail-collapsed');
            row.classList.add('jt-avail-visible');
            shownCount++;
          }
        }
        return;
      }

      // Check for assignee card in first cell
      const assigneeCard = firstCell.querySelector('div.p-1.flex.items-center.space-x-1');

      if (assigneeCard) {
        // This is an assignee row - determine visibility
        const identifier = getAssigneeIdentifier(assigneeCard, currentCategory);

        currentAssigneeHidden = false;

        // Check if this specific assignee is hidden
        if (identifier && currentCategory && hiddenAssignees[currentCategory]) {
          currentAssigneeHidden = hiddenAssignees[currentCategory].has(identifier);
        } else if (currentCategory && hiddenCategories.has(currentCategory)) {
          currentAssigneeHidden = true;
        }

        if (currentAssigneeHidden) {
          row.classList.add('jt-avail-collapsed');
          row.classList.remove('jt-avail-visible');
          hiddenCount++;
        } else {
          row.classList.remove('jt-avail-collapsed');
          row.classList.add('jt-avail-visible');
          shownCount++;
        }
      } else if (!hasContent) {
        // This is a continuation row (empty first cell) - follow previous assignee's visibility
        // This handles rows that have tasks in later cells but empty first cell
        if (currentAssigneeHidden) {
          row.classList.add('jt-avail-collapsed');
          row.classList.remove('jt-avail-visible');
          hiddenCount++;
        } else {
          row.classList.remove('jt-avail-collapsed');
          row.classList.add('jt-avail-visible');
          shownCount++;
        }
      }
    });

    console.log(`AvailabilityFilter: Applied filters - ${shownCount} shown, ${hiddenCount} hidden`);

    return { shownCount, hiddenCount };
  }

  /**
   * Remove all filter markers
   */
  function removeFilters() {
    document.querySelectorAll('.jt-avail-collapsed').forEach(el => {
      el.classList.remove('jt-avail-collapsed');
    });
    document.querySelectorAll('.jt-avail-visible').forEach(el => {
      el.classList.remove('jt-avail-visible');
    });
  }

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = chrome.runtime.getURL('styles/availability-filter.css');
    styleElement.id = 'jt-availability-filter-styles';
    document.head.appendChild(styleElement);
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }
  }

  /**
   * Main function to scan page and build/update filter UI
   */
  function scanAndBuildFilter() {
    if (!isActiveState) return;
    if (!isAvailabilityView()) {
      // Not on availability view, hide filter UI if present
      if (filterContainer) {
        filterContainer.style.display = 'none';
      }
      return;
    }

    // Show filter UI if hidden
    if (filterContainer) {
      filterContainer.style.display = '';
    }

    // Scan for categories and assignees
    const { categories, assigneesByCategory } = scanForFilters();

    // If no filters detected, don't show UI
    if (categories.length === 0) {
      console.log('AvailabilityFilter: No categories detected');
      return;
    }

    // Initialize filter states for new items
    initializeFilterStates(categories, assigneesByCategory);

    // Create or update the filter UI
    createFilterUI(categories, assigneesByCategory);

    // Apply current filters
    applyFilters();
  }

  /**
   * Initialize the feature
   */
  async function init() {
    if (isActiveState) {
      console.log('AvailabilityFilter: Already active');
      return;
    }

    isActiveState = true;
    console.log('AvailabilityFilter: Initializing...');

    // Load saved filter selections
    await loadFilterSelections();

    // Inject styles
    injectStyles();

    // Create debounced scan function
    if (window.TimingUtils && typeof window.TimingUtils.debounce === 'function') {
      debouncedScanAndBuild = window.TimingUtils.debounce(scanAndBuildFilter, 300);
    } else {
      // Fallback debounce
      let timeout = null;
      debouncedScanAndBuild = function() {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(scanAndBuildFilter, 300);
      };
      debouncedScanAndBuild.cancel = function() {
        if (timeout) clearTimeout(timeout);
      };
    }

    // Initial scan
    scanAndBuildFilter();

    // Watch for DOM changes
    observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        // Check for relevant changes
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
          for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the change might affect our filter targets
              if (node.classList && (
                node.classList.contains('p-1') ||
                node.classList.contains('truncate') ||
                node.classList.contains('font-bold') ||
                node.tagName === 'TR' ||
                node.tagName === 'TBODY'
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
        debouncedScanAndBuild();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    urlCheckInterval = setInterval(() => {
      if (!isActiveState) {
        clearInterval(urlCheckInterval);
        return;
      }

      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('AvailabilityFilter: URL changed, rescanning...');

        // Remove existing UI when navigating away
        if (filterContainer) {
          filterContainer.remove();
          filterContainer = null;
        }

        // Small delay to let page content load
        setTimeout(scanAndBuildFilter, 500);
      }
    }, 500);

    console.log('AvailabilityFilter: Initialized');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) {
      console.log('AvailabilityFilter: Not active, skipping cleanup');
      return;
    }

    isActiveState = false;
    console.log('AvailabilityFilter: Cleaning up...');

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

    // Cancel debounced function
    if (debouncedScanAndBuild && typeof debouncedScanAndBuild.cancel === 'function') {
      debouncedScanAndBuild.cancel();
    }
    debouncedScanAndBuild = null;

    // Remove filter UI
    if (filterContainer) {
      filterContainer.remove();
      filterContainer = null;
    }

    // Remove filters from DOM
    removeFilters();

    // Remove styles
    removeStyles();

    console.log('AvailabilityFilter: Cleaned up');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActiveState,
    refresh: scanAndBuildFilter
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.AvailabilityFilterFeature = AvailabilityFilterFeature;
}
