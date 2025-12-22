/**
 * Formatter Toolbar Module
 * Handles toolbar creation, positioning, and management
 *
 * Dependencies:
 * - formatter-modules/detection.js (FormatterDetection)
 * - formatter-modules/formats.js (FormatterFormats)
 */

const FormatterToolbar = (() => {
  // Module state
  let activeToolbar = null;
  let activeField = null;
  let hideTimeout = null;

  /**
   * Get the active toolbar
   * @returns {HTMLElement|null}
   */
  function getActiveToolbar() {
    return activeToolbar;
  }

  /**
   * Get the active field
   * @returns {HTMLTextAreaElement|null}
   */
  function getActiveField() {
    return activeField;
  }

  /**
   * Set the active field
   * @param {HTMLTextAreaElement|null} field
   */
  function setActiveField(field) {
    activeField = field;
  }

  /**
   * Clear hide timeout
   */
  function clearHideTimeout() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  /**
   * Check if a field is inside the budget table (ANY field - Name, Description, etc.)
   * ALL budget table fields should use the floating expanded toolbar, not embedded
   * @param {HTMLTextAreaElement} field
   * @returns {boolean}
   */
  function isBudgetTableField(field) {
    if (!field) return false;

    // Check if it's inside a budget table (has the characteristic row structure)
    const row = field.closest('.flex.min-w-max');
    if (!row) return false;

    // Check for budget table indicators - parent should have overflow-auto
    const scrollContainer = row.closest('.overflow-auto');
    return scrollContainer !== null;
  }

  /**
   * Check if a field is a budget table Description field (for positioning logic)
   * @param {HTMLTextAreaElement} field
   * @returns {boolean}
   */
  function isBudgetDescriptionField(field) {
    if (!field || field.getAttribute('placeholder') !== 'Description') {
      return false;
    }
    return isBudgetTableField(field);
  }

  /**
   * Check if a field is inside a sidebar/panel (NOT a modal)
   * @param {HTMLTextAreaElement} field
   * @returns {boolean}
   */
  function isSidebarField(field) {
    if (!field) return false;

    // First, exclude modals/popups - they use centered auto-margin layout
    // This catches NEW JOB MESSAGE popup and similar
    const modalContainer = field.closest('.m-auto');
    if (modalContainer) {
      return false;
    }

    // Check for JobTread's drag-scroll-boundary (sidebars use this)
    // This is the primary and most reliable sidebar indicator
    const dragScrollContainer = field.closest('[data-is-drag-scroll-boundary="true"]');
    if (dragScrollContainer) return true;

    // Check for common sidebar/panel patterns (but NOT modals/dialogs)
    const sidebar = field.closest('[class*="sidebar"], [class*="panel"], [class*="drawer"]');
    if (sidebar) return true;

    // Check if inside a fixed/absolute positioned container on the RIGHT side of screen
    // (sidebars in JobTread typically appear on the right)
    let parent = field.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const rect = parent.getBoundingClientRect();
        // Sidebars are typically narrow (< 600px), tall, and positioned on the right
        const isOnRight = rect.left > window.innerWidth * 0.5;
        if (rect.width < 600 && rect.height > 200 && isOnRight) {
          return true;
        }
      }
      parent = parent.parentElement;
    }

    return false;
  }

  /**
   * Find the sidebar container for a field
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function findSidebarContainer(field) {
    // Try drag-scroll-boundary first
    const dragScrollContainer = field.closest('[data-is-drag-scroll-boundary="true"]');
    if (dragScrollContainer) return dragScrollContainer;

    // Try common sidebar patterns (but NOT modals/dialogs)
    const sidebar = field.closest('[class*="sidebar"], [class*="panel"], [class*="drawer"]');
    if (sidebar) return sidebar;

    // Find fixed/absolute container
    let parent = field.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const rect = parent.getBoundingClientRect();
        if (rect.width < 600 && rect.height > 200) {
          return parent;
        }
      }
      parent = parent.parentElement;
    }

    return null;
  }

  /**
   * Find the label element for a field (to embed toolbar after it)
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function findFieldLabel(field) {
    // Check for associated label via id
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label;
    }

    // Look for label as previous sibling or parent's previous sibling
    let element = field.previousElementSibling;
    while (element) {
      if (element.tagName === 'LABEL' || element.classList.contains('label') ||
          element.textContent.includes('Description') || element.textContent.includes('Notes')) {
        return element;
      }
      element = element.previousElementSibling;
    }

    // Check parent for label
    const parent = field.parentElement;
    if (parent) {
      element = parent.previousElementSibling;
      while (element) {
        if (element.tagName === 'LABEL' || element.classList.contains('label') ||
            element.textContent.includes('Description') || element.textContent.includes('Notes')) {
          return element;
        }
        // Also check if it's a wrapper containing a label
        const innerLabel = element.querySelector('label, .label');
        if (innerLabel) return innerLabel;
        element = element.previousElementSibling;
      }
    }

    return null;
  }

  /**
   * Find an embedded toolbar for a specific field (if it exists)
   * Uses data-for-field attribute to ensure we only find the toolbar for THIS field
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function findEmbeddedToolbar(field) {
    // Generate a unique ID for this field if it doesn't have one
    if (!field.dataset.formatterId) {
      field.dataset.formatterId = 'fmt-' + Math.random().toString(36).substr(2, 9);
    }
    const fieldId = field.dataset.formatterId;

    // First, look for a toolbar with matching field ID (most reliable)
    const matchingToolbar = document.querySelector(`.jt-formatter-toolbar-embedded[data-for-field="${fieldId}"]`);
    if (matchingToolbar) {
      return matchingToolbar;
    }

    // Check if there's an embedded toolbar immediately before this field (direct sibling only)
    const sibling = field.previousElementSibling;
    if (sibling && sibling.classList.contains('jt-formatter-toolbar-embedded') && !sibling.dataset.forField) {
      // Associate this unassociated toolbar with this field
      sibling.dataset.forField = fieldId;
      return sibling;
    }

    return null;
  }

  /**
   * Create and embed toolbar between label and field for sidebar fields
   * Uses responsive overflow - buttons that don't fit go into the ... menu
   * NOTE: This should NEVER be called for budget description fields
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function embedToolbarForField(field) {
    // CRITICAL: Never create embedded toolbar for ANY budget table field
    // Budget table uses the floating expanded toolbar exclusively
    if (isBudgetTableField(field)) {
      console.log('Formatter: Blocked embedded toolbar creation for budget table field');
      return null;
    }

    // Check if already embedded for THIS specific field
    let toolbar = findEmbeddedToolbar(field);
    if (toolbar) {
      // Re-run overflow check in case width changed
      requestAnimationFrame(() => updateToolbarOverflow(toolbar));
      return toolbar;
    }

    // Create the toolbar
    toolbar = document.createElement('div');
    toolbar.className = 'jt-formatter-toolbar jt-formatter-toolbar-embedded jt-responsive-toolbar';

    // Note: Previously added jt-sidebar-sticky for sticky positioning, but this caused
    // overlap issues with textarea fields like Message. Now the toolbar flows naturally
    // in the document, pushing content down rather than overlapping it.

    // Check if PreviewModeFeature is available and active
    const hasPreviewMode = window.PreviewModeFeature && window.PreviewModeFeature.isActive();

    // SVG icons for cleaner look
    const icons = {
      bullet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="3" cy="6" r="1" fill="currentColor"></circle><circle cx="3" cy="12" r="1" fill="currentColor"></circle><circle cx="3" cy="18" r="1" fill="currentColor"></circle></svg>',
      numbered: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><text x="3" y="7" font-size="6" fill="currentColor" stroke="none" font-weight="600">1</text><text x="3" y="13" font-size="6" fill="currentColor" stroke="none" font-weight="600">2</text><text x="3" y="19" font-size="6" fill="currentColor" stroke="none" font-weight="600">3</text></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
      quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path></svg>',
      table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>',
      alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      color: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5" fill="#ef4444" stroke="none"></circle><circle cx="17.5" cy="10.5" r="2.5" fill="#f59e0b" stroke="none"></circle><circle cx="8.5" cy="7.5" r="2.5" fill="#3b82f6" stroke="none"></circle><circle cx="6.5" cy="12.5" r="2.5" fill="#10b981" stroke="none"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"></path></svg>',
      alignLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="18" y2="18"></line></svg>',
      alignCenter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="6" y1="12" x2="18" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>',
      alignRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="9" y1="12" x2="21" y2="12"></line><line x1="6" y1="18" x2="21" y2="18"></line></svg>',
      hr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg>'
    };

    // SVG for more icon (three dots)
    const moreIcon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>';

    // Build toolbar with all buttons inline (will be managed by overflow logic)
    let toolbarHTML = '';

    if (hasPreviewMode) {
      toolbarHTML += `<button class="jt-preview-toggle jt-toolbar-item" data-action="preview" data-priority="0" title="Preview"><span>Preview</span></button>`;
    }

    // All buttons in priority order (lower = more important, shown first)
    toolbarHTML += `
      <button class="jt-toolbar-item" data-format="bold" data-priority="1" title="Bold (*text*) - Ctrl/Cmd+B"><strong>B</strong></button>
      <button class="jt-toolbar-item" data-format="italic" data-priority="2" title="Italic (^text^) - Ctrl/Cmd+I"><em>I</em></button>
      <button class="jt-toolbar-item" data-format="underline" data-priority="3" title="Underline (_text_) - Ctrl/Cmd+U"><u>U</u></button>
      <button class="jt-toolbar-item" data-format="strikethrough" data-priority="4" title="Strikethrough (~text~)"><s>S</s></button>
      <button class="jt-toolbar-item" data-format="h1" data-priority="5" title="Heading 1">H<sub>1</sub></button>
      <button class="jt-toolbar-item" data-format="h2" data-priority="6" title="Heading 2">H<sub>2</sub></button>
      <button class="jt-toolbar-item" data-format="h3" data-priority="7" title="Heading 3">H<sub>3</sub></button>
      <button class="jt-toolbar-item" data-format="justify-left" data-priority="8" title="Align Left (:--)">${icons.alignLeft}</button>
      <button class="jt-toolbar-item" data-format="justify-center" data-priority="9" title="Align Center (-:-)">${icons.alignCenter}</button>
      <button class="jt-toolbar-item" data-format="justify-right" data-priority="10" title="Align Right (--:)">${icons.alignRight}</button>
      <button class="jt-toolbar-item" data-format="bullet" data-priority="11" title="Bullet List">${icons.bullet}</button>
      <button class="jt-toolbar-item" data-format="numbered" data-priority="12" title="Numbered List">${icons.numbered}</button>
      <button class="jt-toolbar-item" data-format="link" data-priority="13" title="Insert Link">${icons.link}</button>
      <button class="jt-toolbar-item" data-format="quote" data-priority="14" title="Quote">${icons.quote}</button>
      <button class="jt-toolbar-item" data-format="table" data-priority="15" title="Insert Table">${icons.table}</button>
      <button class="jt-toolbar-item" data-format="hr" data-priority="16" title="Horizontal Rule (---)">${icons.hr}</button>
      <button class="jt-toolbar-item jt-color-green" data-format="color" data-color="green" data-priority="17" title="Green">A</button>
      <button class="jt-toolbar-item jt-color-yellow" data-format="color" data-color="yellow" data-priority="18" title="Yellow">A</button>
      <button class="jt-toolbar-item jt-color-blue" data-format="color" data-color="blue" data-priority="19" title="Blue">A</button>
      <button class="jt-toolbar-item jt-color-red" data-format="color" data-color="red" data-priority="20" title="Red">A</button>
      <button class="jt-toolbar-item jt-alert-btn" data-format="alert" data-priority="21" title="Insert Alert">${icons.alert}</button>
    `;

    // More menu (always visible, contains overflow items)
    toolbarHTML += `
      <div class="jt-overflow-menu">
        <button class="jt-overflow-btn" title="More options">${moreIcon}</button>
        <div class="jt-overflow-dropdown"></div>
      </div>
    `;

    toolbar.innerHTML = toolbarHTML;

    // Setup handlers
    setupResponsiveToolbar(toolbar);
    setupFormatButtons(toolbar, field);
    setupCustomTooltips(toolbar);

    if (hasPreviewMode) {
      setupPreviewButton(toolbar, field);
    }

    // Find the right insertion point - need to insert OUTSIDE any relative/absolute container
    // JobTread uses a relative container with absolute textarea + preview div overlay
    let insertTarget = field;
    let insertParent = field.parentElement;

    // Check if parent is a relative container with absolute-positioned children (JobTread's preview system)
    if (insertParent) {
      const parentStyle = window.getComputedStyle(insertParent);
      if (parentStyle.position === 'relative') {
        // Check if the field is absolute positioned inside
        const fieldStyle = window.getComputedStyle(field);
        if (fieldStyle.position === 'absolute') {
          // Insert before the relative container, not inside it
          insertTarget = insertParent;
          insertParent = insertParent.parentElement;
        }
      }
    }

    // Associate toolbar with this specific field using data attribute
    // This ensures findEmbeddedToolbar returns the correct toolbar for this field
    toolbar.dataset.forField = field.dataset.formatterId;

    // Insert toolbar before the target
    if (insertParent) {
      insertParent.insertBefore(toolbar, insertTarget);
    } else {
      // Fallback: insert before the field
      field.parentElement.insertBefore(toolbar, field);
    }

    return toolbar;
  }

  /**
   * Find the budget table footer bar
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function findBudgetFooterBar(field) {
    // Find the scroll container
    const scrollContainer = field.closest('.overflow-auto');
    if (!scrollContainer) return null;

    // The footer bar is a sibling flex row that contains buttons (+ Item, + Group)
    // It's typically the last .flex.min-w-max that has buttons inside
    const allRows = scrollContainer.querySelectorAll('.flex.min-w-max');
    for (const row of allRows) {
      // Look for the row with "+ Item" button
      const hasAddButtons = row.querySelector('button, [role="button"]');
      const hasItemText = row.textContent.includes('Item') && row.textContent.includes('Group');
      if (hasAddButtons && hasItemText) {
        return row;
      }
    }
    return null;
  }

  /**
   * Find the budget table header row (sticky row with column names)
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function findBudgetHeaderRow(field) {
    // Find the scroll container
    const scrollContainer = field.closest('.overflow-auto');
    if (!scrollContainer) return null;

    // Strategy 1: Look for sticky elements that contain header text
    const stickyElements = scrollContainer.querySelectorAll('.sticky');
    for (const sticky of stickyElements) {
      const text = sticky.textContent;
      // Header should have column names like "Name" and "Description"
      if (text.includes('Name') && text.includes('Description')) {
        // Return the sticky element's parent row if it's a flex container
        const parent = sticky.parentElement;
        if (parent && (parent.classList.contains('flex') || parent.style.display === 'flex')) {
          return parent;
        }
        return sticky;
      }
    }

    // Strategy 2: Look through all flex rows for header-like rows
    const allRows = scrollContainer.querySelectorAll('.flex.min-w-max, .flex[style*="min-width"]');
    for (const row of allRows) {
      // Skip rows that have textareas (those are data rows)
      if (row.querySelector('textarea')) continue;

      // Skip footer rows (have "+ Item" or "Item" and "Group" buttons)
      const rowText = row.textContent;
      if (rowText.includes('+ Item') || (rowText.includes('Item') && rowText.includes('Group') && row.querySelector('.bg-gray-700'))) continue;

      // Check if this row contains both "Name" and "Description" text (header indicators)
      const hasName = rowText.includes('Name');
      const hasDescription = rowText.includes('Description');

      if (hasName && hasDescription) {
        // This is the header row
        return row;
      }
    }

    // Strategy 3: Look for the jt-budget-header-container if freeze-header created one
    const budgetHeader = scrollContainer.querySelector('.jt-budget-header-container');
    if (budgetHeader) {
      return budgetHeader;
    }

    return null;
  }

  /**
   * Find the Description header cell in the header row
   * @param {HTMLElement} headerRow
   * @returns {HTMLElement|null}
   */
  function findDescriptionHeaderCell(headerRow) {
    // Look through direct children of the header row
    for (const cell of headerRow.children) {
      // Skip if not a header-styled cell
      if (!cell.classList.contains('bg-gray-100')) continue;

      // Check if this cell contains "Description" text anywhere
      if (cell.textContent.includes('Description')) {
        return cell;
      }
    }
    return null;
  }

  /**
   * Find the column index of the field's cell in the budget table
   * @param {HTMLTextAreaElement} field
   * @returns {number} Column index, or -1 if not found
   */
  function getFieldColumnIndex(field) {
    // Find the cell containing this field (div with width style in the row)
    let cell = field.parentElement;
    while (cell && !cell.style.width && cell.parentElement) {
      cell = cell.parentElement;
      // Stop if we've gone too far up
      if (cell.classList.contains('overflow-auto')) return -1;
    }

    if (!cell || !cell.style.width) return -1;

    // Get the row (parent of the cell)
    const row = cell.parentElement;
    if (!row) return -1;

    // Find the index of this cell among siblings with width styles
    const siblings = Array.from(row.children).filter(el => el.style.width);
    return siblings.indexOf(cell);
  }

  /**
   * Find the footer cell at the given column index
   * @param {HTMLElement} footerBar
   * @param {number} columnIndex
   * @returns {HTMLElement|null}
   */
  function getFooterCellAtIndex(footerBar, columnIndex) {
    const cells = Array.from(footerBar.children).filter(el => el.style.width);
    return cells[columnIndex] || null;
  }

  /**
   * Check if the footer cell is visible in the horizontal scroll
   * @param {HTMLElement} footerCell
   * @param {HTMLElement} scrollContainer
   * @returns {boolean}
   */
  function isFooterCellVisible(footerCell, scrollContainer) {
    const cellRect = footerCell.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    // Check if cell is within the visible horizontal bounds of the container
    // Allow some tolerance (at least 100px of the cell visible)
    const visibleWidth = Math.min(cellRect.right, containerRect.right) - Math.max(cellRect.left, containerRect.left);
    return visibleWidth >= 100;
  }

  /**
   * Position toolbar in the budget footer cell (docked mode)
   * @param {HTMLElement} toolbar
   * @param {HTMLElement} footerCell
   * @param {HTMLElement} scrollContainer
   * @returns {boolean} True if positioned successfully, false if should hide
   */
  function positionToolbarInFooter(toolbar, footerCell, scrollContainer) {
    // Check if footer cell is visible
    if (!isFooterCellVisible(footerCell, scrollContainer)) {
      toolbar.style.visibility = 'hidden';
      toolbar.style.opacity = '0';
      return false;
    }

    const cellRect = footerCell.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    // Position toolbar inside the footer cell
    // Center it vertically in the cell, align to left edge
    const toolbarHeight = 44;
    const padding = 4;

    let left = cellRect.left + padding;
    let top = cellRect.top + (cellRect.height - toolbarHeight) / 2;

    // Clamp left position to container bounds
    const maxLeft = containerRect.right - toolbar.offsetWidth - padding;
    left = Math.max(containerRect.left + padding, Math.min(left, maxLeft));

    toolbar.style.position = 'fixed';
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.visibility = 'visible';
    toolbar.style.opacity = '1';
    toolbar.classList.add('jt-toolbar-docked');
    toolbar.classList.remove('jt-toolbar-sticky');

    return true;
  }

  /**
   * Position toolbar below the budget header cell (between header and content)
   * @param {HTMLElement} toolbar
   * @param {HTMLElement} headerCell
   * @param {HTMLElement} scrollContainer
   * @returns {boolean} True if positioned successfully, false if should hide
   */
  function positionToolbarInHeader(toolbar, headerCell, scrollContainer) {
    const cellRect = headerCell.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    // Check if header cell is at least partially visible horizontally
    const visibleWidth = Math.min(cellRect.right, containerRect.right) - Math.max(cellRect.left, containerRect.left);
    if (visibleWidth < 100) {
      toolbar.style.visibility = 'hidden';
      toolbar.style.opacity = '0';
      return false;
    }

    const padding = 8;
    const toolbarHeight = toolbar.offsetHeight || 32;

    // Position toolbar INSIDE the header cell, vertically centered
    // Place it after the "Description" text, with some left offset
    let left = Math.max(cellRect.left, containerRect.left) + 120; // Offset past "Description" text

    // Vertically center in the header cell
    let top = cellRect.top + (cellRect.height - toolbarHeight) / 2;

    toolbar.style.position = 'fixed';
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.visibility = 'visible';
    toolbar.style.opacity = '1';
    toolbar.classList.add('jt-toolbar-header-docked');
    toolbar.classList.remove('jt-toolbar-docked');
    toolbar.classList.remove('jt-toolbar-sticky');

    return true;
  }

  /**
   * Fallback: Position toolbar below the entire header row when specific cell isn't found
   * @param {HTMLElement} toolbar - The toolbar element
   * @param {HTMLElement} headerRow - The header row element
   * @param {HTMLElement} scrollContainer - The scroll container
   * @returns {boolean} True if successfully positioned
   */
  function positionToolbarBelowHeaderRow(toolbar, headerRow, scrollContainer) {
    const rowRect = headerRow.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    // Only show if header row is visible
    if (rowRect.bottom < containerRect.top || rowRect.top > containerRect.bottom) {
      toolbar.style.visibility = 'hidden';
      toolbar.style.opacity = '0';
      return false;
    }

    const padding = 4;

    // Position toolbar below the header row, aligned to left of container
    let left = containerRect.left + padding;
    let top = rowRect.bottom + padding;

    toolbar.style.position = 'fixed';
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.visibility = 'visible';
    toolbar.style.opacity = '1';
    toolbar.classList.add('jt-toolbar-header-docked');
    toolbar.classList.remove('jt-toolbar-docked');
    toolbar.classList.remove('jt-toolbar-sticky');

    return true;
  }

  /**
   * Find the bottom edge of sticky headers that are above the field
   * @param {HTMLTextAreaElement} field - The field we're positioning toolbar for
   * @returns {number} The bottom edge of the lowest sticky header above the field (in viewport coords)
   */
  function getStickyHeaderOffset(field) {
    const fieldRect = field.getBoundingClientRect();
    let maxOffset = 0;

    // Helper to check if element is a table header (should be excluded)
    const isTableHeader = (el) => {
      const tagName = el.tagName.toLowerCase();
      // Exclude thead, th, and elements inside tables that aren't page-level headers
      if (tagName === 'thead' || tagName === 'th') {
        return true;
      }
      // Also exclude if element is inside a table
      if (el.closest('table')) {
        return true;
      }
      return false;
    };

    // Check semantic header/nav elements
    const semanticHeaders = document.querySelectorAll('header, nav');
    semanticHeaders.forEach(el => {
      const style = window.getComputedStyle(el);
      const position = style.position;
      const top = parseFloat(style.top) || 0;

      if ((position === 'sticky' || position === 'fixed') && top >= 0 && top < 20) {
        const rect = el.getBoundingClientRect();
        // Element should be above the field and reasonably sized
        if (rect.bottom < fieldRect.top + 50 && rect.height < 150) {
          if (rect.bottom > maxOffset) {
            maxOffset = rect.bottom;
          }
        }
      }
    });

    // Check elements with sticky class (JobTread budget table headers, sidebar headers)
    // Exclude table headers (thead, th) - these are data tables, not page-level headers
    const stickyClassElements = document.querySelectorAll('.sticky');
    stickyClassElements.forEach(el => {
      // Skip table header elements - they're not page-level navigation headers
      if (isTableHeader(el)) {
        return;
      }

      const style = window.getComputedStyle(el);
      const position = style.position;

      if (position === 'sticky') {
        const rect = el.getBoundingClientRect();
        // Element should be above or overlapping the field's top area, and reasonably sized
        if (rect.bottom <= fieldRect.top + 50 && rect.height > 15 && rect.height < 150) {
          if (rect.bottom > maxOffset) {
            maxOffset = rect.bottom;
          }
        }
      }
    });

    // Also check parent rows of sticky elements (for table header rows like JobTread budget)
    // But skip if the parent is inside a table element
    stickyClassElements.forEach(el => {
      // Skip table header elements
      if (isTableHeader(el)) {
        return;
      }

      const style = window.getComputedStyle(el);
      if (style.position === 'sticky') {
        const parent = el.parentElement;
        if (parent && !parent.closest('table')) {
          const parentRect = parent.getBoundingClientRect();
          // Parent row should be above the field and look like a header row
          if (parentRect.bottom <= fieldRect.top + 50 && parentRect.height > 15 && parentRect.height < 100) {
            if (parentRect.bottom > maxOffset) {
              maxOffset = parentRect.bottom;
            }
          }
        }
      }
    });

    return maxOffset;
  }

  /**
   * Position embedded toolbar with sticky behavior
   * The toolbar starts in document flow above the textarea, becomes sticky when
   * it would scroll out of view, and stops at the bottom of the textarea.
   * Note: Embedded toolbars are always visible
   * @param {HTMLElement} toolbar
   * @param {HTMLTextAreaElement} field
   */
  function positionEmbeddedToolbar(toolbar, field) {
    if (!toolbar || !field) return;

    // Check if this is a modal/popup field (but NOT Message fields - they get special handling)
    // Modals have .m-auto.shadow-lg pattern or are inside fixed overlays
    const isInModal = field.closest('.m-auto.shadow-lg') !== null ||
                      field.closest('[class*="modal"]') !== null;

    if (isInModal) {
      // For modals/popups, just keep toolbar in normal document flow - no sticky behavior
      toolbar.style.position = 'relative';
      toolbar.style.top = 'auto';
      toolbar.style.left = 'auto';
      toolbar.style.width = '100%';
      toolbar.classList.remove('jt-toolbar-sticky-active');
      return;
    }

    // Check if this is a Message field - these have their own scroll container
    const isMessageField = field.getAttribute('placeholder') === 'Message';

    // Find the scrollable container
    // For Message fields, look for the immediate scrollable parent (the message input area)
    // For other fields, look for the sidebar/form scroll container
    let scrollContainer;
    if (isMessageField) {
      // Message fields: find the closest scrollable ancestor (could be the textarea wrapper)
      scrollContainer = field.closest('.overflow-y-auto, .overflow-auto, .overflow-y-scroll, .overflow-scroll') ||
                        field.parentElement?.closest('.overflow-y-auto, .overflow-auto');
    } else {
      scrollContainer = field.closest('.overflow-y-auto, .overflow-auto, .overflow-y-scroll, .overflow-scroll');
    }

    if (!scrollContainer) {
      // No scroll container - just keep toolbar in normal flow
      toolbar.style.position = 'relative';
      toolbar.style.top = 'auto';
      toolbar.style.left = 'auto';
      toolbar.style.width = '100%';
      return;
    }

    const toolbarHeight = toolbar.offsetHeight || 36;
    const padding = 8;

    // Get positions relative to viewport
    const fieldRect = field.getBoundingClientRect();
    const scrollRect = scrollContainer.getBoundingClientRect();

    // Find any sticky headers within the scroll container and account for their height
    // Look for common sticky header patterns in JobTread
    let stickyHeaderHeight = 0;
    const stickyHeaders = scrollContainer.querySelectorAll('.sticky, [class*="sticky"]');
    stickyHeaders.forEach(header => {
      const headerStyle = window.getComputedStyle(header);
      if (headerStyle.position === 'sticky' || header.classList.contains('sticky')) {
        const headerRect = header.getBoundingClientRect();
        // Only count headers that are at the top of the scroll container
        if (headerRect.top <= scrollRect.top + 50) {
          stickyHeaderHeight = Math.max(stickyHeaderHeight, headerRect.height);
        }
      }
    });

    // The sticky position should be below any sticky headers
    const stickyTop = scrollRect.top + padding + stickyHeaderHeight;

    // Calculate where the top of the toolbar would be if it were in normal flow
    // When in relative position, the toolbar sits right above the field
    const naturalToolbarTop = fieldRect.top - toolbarHeight - 8; // 8px is margin-bottom

    // Calculate the bottom boundary - toolbar shouldn't go past the bottom of the textarea
    const maxToolbarTop = fieldRect.bottom - toolbarHeight - padding;

    if (naturalToolbarTop >= stickyTop) {
      // Toolbar is visible in its natural position - use relative positioning
      toolbar.style.position = 'relative';
      toolbar.style.top = 'auto';
      toolbar.style.left = 'auto';
      toolbar.style.width = '100%';
      toolbar.classList.remove('jt-toolbar-sticky-active');
    } else if (stickyTop <= maxToolbarTop) {
      // Toolbar would scroll out of view but field is still visible - make it sticky
      // Position below any sticky headers
      toolbar.style.position = 'fixed';
      toolbar.style.top = `${stickyTop}px`;
      toolbar.style.left = `${scrollRect.left + padding}px`;
      toolbar.style.width = `${scrollRect.width - (padding * 2)}px`;
      toolbar.classList.add('jt-toolbar-sticky-active');
    } else {
      // Field is mostly scrolled out - position toolbar at bottom of field
      toolbar.style.position = 'fixed';
      toolbar.style.top = `${maxToolbarTop}px`;
      toolbar.style.left = `${scrollRect.left + padding}px`;
      toolbar.style.width = `${scrollRect.width - (padding * 2)}px`;
      toolbar.classList.add('jt-toolbar-sticky-active');
    }
  }

  /**
   * Position toolbar relative to field with sticky behavior
   * For budget Description fields, docks in the sticky header row
   * @param {HTMLElement} toolbar
   * @param {HTMLTextAreaElement} field
   */
  function positionToolbar(toolbar, field) {
    // Handle embedded toolbar sticky positioning
    if (toolbar.classList.contains('jt-formatter-toolbar-embedded')) {
      positionEmbeddedToolbar(toolbar, field);
      return;
    }

    const rect = field.getBoundingClientRect();
    const toolbarHeight = toolbar.offsetHeight || 36;
    const padding = 8;
    const viewportHeight = window.innerHeight;

    // Check if this is a budget table field - use footer bar docking for positioning
    const isBudgetField = isBudgetTableField(field);

    if (isBudgetField) {
      // For budget table fields, dock toolbar inside the footer bar row
      // The footer bar with + Item / + Group is always visible at the bottom
      const scrollContainer = field.closest('.overflow-auto');
      if (scrollContainer) {
        // Find the footer bar (+ Item / + Group row) - it's OUTSIDE the scroll container
        // The footer bar is a sibling of the scroll container's parent
        let footerBar = findBudgetFooterBar(field);

        // If not found inside, look for it as the last visible row with the buttons
        if (!footerBar) {
          // Try finding the footer bar by looking for the bg-gray-700 buttons
          const allButtons = document.querySelectorAll('[role="button"].bg-gray-700');
          for (const btn of allButtons) {
            if (btn.textContent.includes('Item') || btn.textContent.includes('Group')) {
              footerBar = btn.closest('.flex.min-w-max');
              break;
            }
          }
        }

        if (footerBar) {
          const footerRect = footerBar.getBoundingClientRect();

          // Position toolbar INSIDE the footer bar row, vertically centered
          const top = footerRect.top + (footerRect.height - toolbarHeight) / 2;

          // Position horizontally: after the + Item / + Group buttons
          // Find the container with the buttons (usually the second cell with width 300px)
          const buttonContainer = footerBar.querySelector('.shrink-0.sticky[style*="width: 300px"]') ||
                                  footerBar.querySelector('.shrink-0.sticky:nth-child(2)');
          let left;

          if (buttonContainer) {
            const containerRect = buttonContainer.getBoundingClientRect();
            left = containerRect.right + 16; // Position after the button container
          } else {
            // Fallback: find the last button and position after it
            const footerButtons = footerBar.querySelectorAll('button, [role="button"]');
            if (footerButtons.length > 0) {
              const lastButton = footerButtons[footerButtons.length - 1];
              const lastButtonRect = lastButton.getBoundingClientRect();
              left = lastButtonRect.right + 16;
            } else {
              left = footerRect.left + 350; // Approximate position after Name column
            }
          }

          // Ensure toolbar doesn't go off-screen
          const toolbarWidth = toolbar.offsetWidth || 500;
          const viewportWidth = window.innerWidth;
          if (left + toolbarWidth > viewportWidth - padding) {
            left = Math.max(padding, viewportWidth - toolbarWidth - padding);
          }

          toolbar.style.position = 'fixed';
          toolbar.style.top = `${top}px`;
          toolbar.style.left = `${left}px`;
          toolbar.style.visibility = 'visible';
          toolbar.style.opacity = '1';
          toolbar.classList.add('jt-toolbar-docked');
          toolbar.classList.remove('jt-toolbar-sticky');
          toolbar.classList.remove('jt-toolbar-budget-bottom');
          return;
        } else {
          // Fallback: position at bottom of viewport above scroll area
          const containerRect = scrollContainer.getBoundingClientRect();
          const top = containerRect.bottom - toolbarHeight - 8;
          let left = rect.left;

          // Ensure toolbar doesn't go off-screen
          const toolbarWidth = toolbar.offsetWidth || 500;
          const viewportWidth = window.innerWidth;
          if (left + toolbarWidth > viewportWidth - padding) {
            left = Math.max(padding, viewportWidth - toolbarWidth - padding);
          }

          toolbar.style.position = 'fixed';
          toolbar.style.top = `${top}px`;
          toolbar.style.left = `${left}px`;
          toolbar.style.visibility = 'visible';
          toolbar.style.opacity = '1';
          toolbar.classList.add('jt-toolbar-budget-bottom');
          toolbar.classList.remove('jt-toolbar-sticky');
          return;
        }
      }
    }

    // Check if this is a sidebar field - position at bottom of visible viewport
    const isSidebar = isSidebarField(field);
    if (isSidebar) {
      const sidebarContainer = findSidebarContainer(field);
      if (sidebarContainer) {
        const sidebarRect = sidebarContainer.getBoundingClientRect();
        const toolbarWidth = toolbar.offsetWidth || 300;
        const bottomPadding = 12;
        const sidePadding = 12;

        // Position at bottom of the VISIBLE area (viewport), not the sidebar
        // This ensures toolbar is always visible regardless of scroll position
        let top = viewportHeight - toolbarHeight - bottomPadding;

        // But constrain to within the sidebar's horizontal bounds
        let left = sidebarRect.left + sidePadding;

        // Make sure toolbar fits within sidebar width
        if (left + toolbarWidth > sidebarRect.right - sidePadding) {
          left = sidebarRect.right - toolbarWidth - sidePadding;
        }

        // Don't position below the sidebar's visible bottom
        if (top > sidebarRect.bottom - toolbarHeight - bottomPadding) {
          top = sidebarRect.bottom - toolbarHeight - bottomPadding;
        }

        toolbar.style.position = 'fixed';
        toolbar.style.top = `${top}px`;
        toolbar.style.left = `${left}px`;
        toolbar.style.visibility = 'visible';
        toolbar.style.opacity = '1';
        toolbar.classList.add('jt-toolbar-sidebar-bottom');
        toolbar.classList.remove('jt-toolbar-sticky');
        return;
      }
    }

    // Find the top offset (below any fixed/sticky headers)
    const stickyHeaderOffset = getStickyHeaderOffset(field) || 60; // Default 60px for JobTread header

    // Calculate visible area of the field
    const fieldVisibleTop = Math.max(rect.top, stickyHeaderOffset);
    const fieldVisibleBottom = Math.min(rect.bottom, viewportHeight - padding);
    const fieldVisibleHeight = fieldVisibleBottom - fieldVisibleTop;

    // Hide toolbar if field is not visible enough
    if (fieldVisibleHeight < 30) {
      toolbar.style.visibility = 'hidden';
      toolbar.style.opacity = '0';
      return;
    }

    toolbar.style.visibility = 'visible';
    toolbar.style.opacity = '1';
    toolbar.style.position = 'fixed';
    toolbar.classList.remove('jt-toolbar-docked');

    // Determine vertical position
    let top;
    const roomAboveField = rect.top - stickyHeaderOffset;

    if (roomAboveField >= toolbarHeight + padding) {
      // Enough room above the field - position just above it
      top = rect.top - toolbarHeight - padding;
      toolbar.classList.remove('jt-toolbar-sticky');
    } else {
      // Not enough room above - stick to top of viewport (below headers)
      top = stickyHeaderOffset + padding;
      toolbar.classList.add('jt-toolbar-sticky');

      // But don't go past the bottom of the field
      const maxTop = rect.bottom - toolbarHeight - padding;
      if (top > maxTop) {
        top = maxTop;
      }
    }

    toolbar.style.top = `${top}px`;

    // Horizontal position - align with field, prevent overflow
    let left = rect.left;
    const toolbarWidth = toolbar.offsetWidth || 300;
    const viewportWidth = window.innerWidth;

    if (left + toolbarWidth > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - toolbarWidth - padding);
    }

    toolbar.style.left = `${left}px`;
    toolbar.style.width = 'auto';
  }

  /**
   * Update toolbar button states based on current formatting
   * @param {HTMLTextAreaElement} field
   * @param {HTMLElement} toolbar
   */
  function updateToolbarState(field, toolbar) {
    const activeFormats = window.FormatterDetection.detectActiveFormats(field);

    // Update basic format buttons
    const boldBtn = toolbar.querySelector('[data-format="bold"]');
    const italicBtn = toolbar.querySelector('[data-format="italic"]');
    const underlineBtn = toolbar.querySelector('[data-format="underline"]');
    const strikeBtn = toolbar.querySelector('[data-format="strikethrough"]');

    boldBtn?.classList.toggle('active', activeFormats.bold);
    italicBtn?.classList.toggle('active', activeFormats.italic);
    underlineBtn?.classList.toggle('active', activeFormats.underline);
    strikeBtn?.classList.toggle('active', activeFormats.strikethrough);

    // Update justify buttons
    const justifyLeft = toolbar.querySelector('[data-format="justify-left"]');
    const justifyCenter = toolbar.querySelector('[data-format="justify-center"]');
    const justifyRight = toolbar.querySelector('[data-format="justify-right"]');

    justifyLeft?.classList.toggle('active', !activeFormats['justify-center'] && !activeFormats['justify-right']);
    justifyCenter?.classList.toggle('active', activeFormats['justify-center']);
    justifyRight?.classList.toggle('active', activeFormats['justify-right']);

    // Update color button
    const colorBtn = toolbar.querySelector('.jt-color-btn');
    if (activeFormats.color) {
      colorBtn?.classList.add('active');
      colorBtn?.setAttribute('title', `Current: ${activeFormats.color}`);
    } else {
      colorBtn?.classList.remove('active');
      colorBtn?.setAttribute('title', 'Text Color');
    }

    // Update color options
    toolbar.querySelectorAll('[data-format="color"]').forEach(btn => {
      const color = btn.dataset.color;
      btn.classList.toggle('active', color === activeFormats.color);
    });
  }

  /**
   * Setup dropdown handlers
   * @param {HTMLElement} toolbar
   */
  function setupDropdowns(toolbar) {
    const dropdownGroups = toolbar.querySelectorAll('.jt-dropdown-group');
    dropdownGroups.forEach(group => {
      const btn = group.querySelector('.jt-dropdown-btn');
      const menu = group.querySelector('.jt-dropdown-menu');

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        toolbar.querySelectorAll('.jt-dropdown-menu').forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.remove('jt-dropdown-visible');
          }
        });

        // Also close color dropdown when opening regular dropdowns
        const colorDropdown = toolbar.querySelector('.jt-color-dropdown');
        if (colorDropdown) {
          colorDropdown.classList.remove('jt-color-dropdown-visible');
        }

        menu.classList.toggle('jt-dropdown-visible');
      });
    });
  }

  /**
   * Setup color picker handlers
   * @param {HTMLElement} toolbar
   */
  function setupColorPicker(toolbar) {
    const colorBtn = toolbar.querySelector('[data-format="color-picker"]');
    const colorDropdown = toolbar.querySelector('.jt-color-dropdown');

    colorBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
        menu.classList.remove('jt-dropdown-visible');
      });

      colorDropdown.classList.toggle('jt-color-dropdown-visible');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.jt-formatter-toolbar')) {
        toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
          menu.classList.remove('jt-dropdown-visible');
        });
        colorDropdown.classList.remove('jt-color-dropdown-visible');
      }
    });
  }

  /**
   * Setup more dropdown handlers (for embedded toolbar - legacy)
   * @param {HTMLElement} toolbar
   */
  function setupMoreDropdown(toolbar) {
    const moreGroup = toolbar.querySelector('.jt-more-group');
    if (!moreGroup) return;

    const moreBtn = moreGroup.querySelector('.jt-more-btn');
    const moreDropdown = moreGroup.querySelector('.jt-more-dropdown');

    if (!moreBtn || !moreDropdown) return;

    moreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Close other dropdowns
      toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
        menu.classList.remove('jt-dropdown-visible');
      });
      const colorDropdown = toolbar.querySelector('.jt-color-dropdown');
      if (colorDropdown) {
        colorDropdown.classList.remove('jt-color-dropdown-visible');
      }

      moreDropdown.classList.toggle('jt-more-dropdown-visible');
    });

    // Close more dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.jt-more-group')) {
        moreDropdown.classList.remove('jt-more-dropdown-visible');
      }
    });

    // Close more dropdown after clicking a button inside it
    moreDropdown.querySelectorAll('button[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        // Small delay to allow the format to be applied first
        setTimeout(() => {
          moreDropdown.classList.remove('jt-more-dropdown-visible');
        }, 50);
      });
    });
  }

  /**
   * Update toolbar overflow - move buttons that don't fit into the overflow menu
   * @param {HTMLElement} toolbar
   */
  function updateToolbarOverflow(toolbar) {
    if (!toolbar || !toolbar.classList.contains('jt-responsive-toolbar')) return;

    const overflowMenu = toolbar.querySelector('.jt-overflow-menu');
    const overflowDropdown = toolbar.querySelector('.jt-overflow-dropdown');
    const overflowBtn = toolbar.querySelector('.jt-overflow-btn');

    if (!overflowMenu || !overflowDropdown) return;

    // Get all toolbar items (buttons with data-priority)
    const allItems = Array.from(toolbar.querySelectorAll('.jt-toolbar-item'));

    // Reset - move all items back to toolbar (before overflow menu)
    allItems.forEach(item => {
      item.style.display = '';
      item.classList.remove('jt-in-overflow');
      if (item.parentElement === overflowDropdown) {
        toolbar.insertBefore(item, overflowMenu);
      }
    });

    // Get available width (toolbar width minus overflow button width and padding)
    const toolbarRect = toolbar.getBoundingClientRect();
    const overflowBtnWidth = 36; // Approximate width of overflow button
    const padding = 16; // Toolbar padding
    const availableWidth = toolbarRect.width - overflowBtnWidth - padding;

    // Calculate cumulative width of visible items
    let currentWidth = 0;
    let hasOverflow = false;

    // Sort items by priority
    const sortedItems = [...allItems].sort((a, b) => {
      return parseInt(a.dataset.priority || '999') - parseInt(b.dataset.priority || '999');
    });

    sortedItems.forEach(item => {
      // Temporarily show to measure
      item.style.display = '';
      const itemWidth = item.offsetWidth + 2; // 2px gap

      if (currentWidth + itemWidth <= availableWidth) {
        currentWidth += itemWidth;
        item.classList.remove('jt-in-overflow');
      } else {
        // Move to overflow dropdown
        hasOverflow = true;
        item.classList.add('jt-in-overflow');
        overflowDropdown.appendChild(item);
      }
    });

    // Show/hide overflow button based on whether there are overflow items
    overflowMenu.style.display = hasOverflow ? '' : 'none';
  }

  /**
   * Setup responsive toolbar with overflow behavior
   * @param {HTMLElement} toolbar
   */
  function setupResponsiveToolbar(toolbar) {
    const overflowMenu = toolbar.querySelector('.jt-overflow-menu');
    const overflowDropdown = toolbar.querySelector('.jt-overflow-dropdown');
    const overflowBtn = toolbar.querySelector('.jt-overflow-btn');

    if (!overflowMenu || !overflowDropdown || !overflowBtn) return;

    // Position dropdown using fixed positioning to escape stacking contexts
    function positionDropdown() {
      const btnRect = overflowBtn.getBoundingClientRect();
      const dropdownWidth = overflowDropdown.offsetWidth || 160;

      // Position below button, aligned to right edge
      let top = btnRect.bottom + 4;
      let left = btnRect.right - dropdownWidth;

      // Ensure dropdown doesn't go off screen
      if (left < 8) left = 8;
      if (top + 200 > window.innerHeight) {
        // Position above button if not enough space below
        top = btnRect.top - overflowDropdown.offsetHeight - 4;
      }

      overflowDropdown.style.position = 'fixed';
      overflowDropdown.style.top = `${top}px`;
      overflowDropdown.style.left = `${left}px`;
      overflowDropdown.style.right = 'auto';
    }

    // Toggle overflow dropdown
    overflowBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = overflowDropdown.classList.contains('jt-overflow-dropdown-visible');
      overflowDropdown.classList.toggle('jt-overflow-dropdown-visible');

      // Position dropdown when opening
      if (!isVisible) {
        requestAnimationFrame(positionDropdown);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.jt-overflow-menu')) {
        overflowDropdown.classList.remove('jt-overflow-dropdown-visible');
      }
    });

    // Close dropdown after clicking a button inside it
    overflowDropdown.addEventListener('click', (e) => {
      if (e.target.closest('button[data-format]') || e.target.closest('button[data-action]')) {
        setTimeout(() => {
          overflowDropdown.classList.remove('jt-overflow-dropdown-visible');
        }, 50);
      }
    });

    // Initial overflow calculation (after render)
    requestAnimationFrame(() => {
      updateToolbarOverflow(toolbar);
    });

    // Watch for resize
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        updateToolbarOverflow(toolbar);
      });
      resizeObserver.observe(toolbar);

      // Store reference for cleanup
      toolbar._resizeObserver = resizeObserver;
    }
  }

  /**
   * Setup format button handlers
   * @param {HTMLElement} toolbar
   * @param {HTMLTextAreaElement} field
   */
  function setupFormatButtons(toolbar, field) {
    toolbar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const format = btn.dataset.format;
        const color = btn.dataset.color;

        // Store field reference
        const targetField = activeField;

        if (format === 'color') {
          window.FormatterFormats.applyFormat(targetField, format, { color });
          toolbar.querySelector('.jt-color-dropdown').classList.remove('jt-color-dropdown-visible');
        } else if (format && format !== 'color-picker') {
          window.FormatterFormats.applyFormat(targetField, format);
          toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
            menu.classList.remove('jt-dropdown-visible');
          });
        }

        // Restore focus and update toolbar state
        if (targetField && document.body.contains(targetField)) {
          targetField.focus();
          activeField = targetField;
          setTimeout(() => {
            if (document.body.contains(toolbar) && document.body.contains(targetField)) {
              updateToolbarState(targetField, toolbar);
            }
          }, 10);
        }
      });
    });
  }

  /**
   * Setup preview button handler
   * @param {HTMLElement} toolbar
   * @param {HTMLTextAreaElement} field
   */
  function setupPreviewButton(toolbar, field) {
    const previewBtn = toolbar.querySelector('[data-action="preview"]');
    if (!previewBtn) return;

    previewBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const currentField = activeField;
      if (window.PreviewModeFeature && window.PreviewModeFeature.togglePreview && currentField) {
        window.PreviewModeFeature.togglePreview(currentField, previewBtn);
      }

      if (currentField && document.body.contains(currentField)) {
        currentField.focus();
      }
    });
  }

  /**
   * Setup custom tooltips
   * @param {HTMLElement} toolbar
   */
  function setupCustomTooltips(toolbar) {
    let currentTooltip = null;
    let tooltipTimeout = null;

    toolbar.querySelectorAll('button[title]').forEach(btn => {
      const title = btn.getAttribute('title');
      btn.setAttribute('data-tooltip', title);
      btn.removeAttribute('title');

      btn.addEventListener('mouseenter', (e) => {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
        }

        tooltipTimeout = setTimeout(() => {
          const tooltipText = btn.getAttribute('data-tooltip');
          if (!tooltipText) return;

          if (currentTooltip && document.body.contains(currentTooltip)) {
            document.body.removeChild(currentTooltip);
          }

          const tooltip = document.createElement('div');
          tooltip.className = 'jt-custom-tooltip';
          tooltip.textContent = tooltipText;
          document.body.appendChild(tooltip);

          const btnRect = btn.getBoundingClientRect();
          const tooltipRect = tooltip.getBoundingClientRect();

          const left = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);
          const top = btnRect.top - tooltipRect.height - 10;

          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;

          setTimeout(() => {
            tooltip.classList.add('visible');
          }, 10);

          currentTooltip = tooltip;
        }, 500);
      });

      btn.addEventListener('mouseleave', () => {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
        }

        if (currentTooltip && document.body.contains(currentTooltip)) {
          currentTooltip.classList.remove('visible');
          setTimeout(() => {
            if (currentTooltip && document.body.contains(currentTooltip)) {
              document.body.removeChild(currentTooltip);
            }
            currentTooltip = null;
          }, 200);
        }
      });
    });
  }

  /**
   * Create the toolbar element
   * @param {HTMLTextAreaElement} field
   * @param {Object} options - Options for toolbar creation
   * @param {boolean} options.expanded - If true, show all buttons inline (no dropdowns)
   * @returns {HTMLElement}
   */
  function createToolbar(field, options = {}) {
    const { expanded = false } = options;
    const toolbar = document.createElement('div');
    toolbar.className = expanded
      ? 'jt-formatter-toolbar jt-formatter-expanded'
      : 'jt-formatter-toolbar jt-responsive-toolbar';

    // Check if PreviewModeFeature is available and active
    const hasPreviewMode = window.PreviewModeFeature && window.PreviewModeFeature.isActive();

    // Build toolbar HTML
    let toolbarHTML = '';

    if (hasPreviewMode) {
      toolbarHTML += `
      <button class="jt-preview-toggle" data-action="preview" title="Preview">
        <span>Preview</span>
      </button>
      <div class="jt-toolbar-divider"></div>
      `;
    }

    // SVG icons for cleaner look (used in both expanded and compact modes)
    const icons = {
      bullet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="3" cy="6" r="1" fill="currentColor"></circle><circle cx="3" cy="12" r="1" fill="currentColor"></circle><circle cx="3" cy="18" r="1" fill="currentColor"></circle></svg>',
      numbered: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><text x="3" y="7" font-size="6" fill="currentColor" stroke="none" font-weight="600">1</text><text x="3" y="13" font-size="6" fill="currentColor" stroke="none" font-weight="600">2</text><text x="3" y="19" font-size="6" fill="currentColor" stroke="none" font-weight="600">3</text></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
      quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path></svg>',
      table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>',
      alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      alignLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="18" y2="18"></line></svg>',
      alignCenter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="6" y1="12" x2="18" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>',
      alignRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="9" y1="12" x2="21" y2="12"></line><line x1="6" y1="18" x2="21" y2="18"></line></svg>',
      hr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg>'
    };

    if (expanded) {
      // Expanded layout - all buttons visible inline (for budget view)
      toolbarHTML += `
      <div class="jt-toolbar-group">
        <button data-format="bold" title="Bold (*text*) - Ctrl/Cmd+B">
          <strong>B</strong>
        </button>
        <button data-format="italic" title="Italic (^text^) - Ctrl/Cmd+I">
          <em>I</em>
        </button>
        <button data-format="underline" title="Underline (_text_) - Ctrl/Cmd+U">
          <u>U</u>
        </button>
        <button data-format="strikethrough" title="Strikethrough (~text~)">
          <s>S</s>
        </button>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group">
        <button data-format="h1" title="Heading 1">H1</button>
        <button data-format="h2" title="Heading 2">H2</button>
        <button data-format="h3" title="Heading 3">H3</button>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group">
        <button data-format="bullet" title="Bullet List">${icons.bullet}</button>
        <button data-format="numbered" title="Numbered List">${icons.numbered}</button>
        <button data-format="link" title="Insert Link">${icons.link}</button>
        <button data-format="quote" title="Quote">${icons.quote}</button>
        <button data-format="table" title="Insert Table">${icons.table}</button>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group">
        <button data-format="justify-left" title="Align Left (:--)">${icons.alignLeft}</button>
        <button data-format="justify-center" title="Align Center (-:-)">${icons.alignCenter}</button>
        <button data-format="justify-right" title="Align Right (--:)">${icons.alignRight}</button>
        <button data-format="hr" title="Horizontal Rule (---)">${icons.hr}</button>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group">
        <button data-format="color" data-color="green" title="Green" class="jt-color-option jt-color-green">A</button>
        <button data-format="color" data-color="yellow" title="Yellow" class="jt-color-option jt-color-yellow">A</button>
        <button data-format="color" data-color="blue" title="Blue" class="jt-color-option jt-color-blue">A</button>
        <button data-format="color" data-color="red" title="Red" class="jt-color-option jt-color-red">A</button>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group">
        <button data-format="alert" title="Insert Alert" class="jt-alert-btn">${icons.alert}</button>
      </div>
    `;
    } else {
      // Responsive layout with overflow menu (same as embedded toolbar)
      // Note: Preview button is added above (before if/else) for all modes

      // All buttons in priority order (lower = more important, shown first)
      toolbarHTML += `
        <button class="jt-toolbar-item" data-format="bold" data-priority="1" title="Bold (*text*) - Ctrl/Cmd+B"><strong>B</strong></button>
        <button class="jt-toolbar-item" data-format="italic" data-priority="2" title="Italic (^text^) - Ctrl/Cmd+I"><em>I</em></button>
        <button class="jt-toolbar-item" data-format="underline" data-priority="3" title="Underline (_text_) - Ctrl/Cmd+U"><u>U</u></button>
        <button class="jt-toolbar-item" data-format="strikethrough" data-priority="4" title="Strikethrough (~text~)"><s>S</s></button>
        <button class="jt-toolbar-item" data-format="h1" data-priority="5" title="Heading 1">H<sub>1</sub></button>
        <button class="jt-toolbar-item" data-format="h2" data-priority="6" title="Heading 2">H<sub>2</sub></button>
        <button class="jt-toolbar-item" data-format="h3" data-priority="7" title="Heading 3">H<sub>3</sub></button>
        <button class="jt-toolbar-item" data-format="justify-left" data-priority="8" title="Align Left (:--)">${icons.alignLeft}</button>
        <button class="jt-toolbar-item" data-format="justify-center" data-priority="9" title="Align Center (-:-)">${icons.alignCenter}</button>
        <button class="jt-toolbar-item" data-format="justify-right" data-priority="10" title="Align Right (--:)">${icons.alignRight}</button>
        <button class="jt-toolbar-item" data-format="bullet" data-priority="11" title="Bullet List">${icons.bullet}</button>
        <button class="jt-toolbar-item" data-format="numbered" data-priority="12" title="Numbered List">${icons.numbered}</button>
        <button class="jt-toolbar-item" data-format="link" data-priority="13" title="Insert Link">${icons.link}</button>
        <button class="jt-toolbar-item" data-format="quote" data-priority="14" title="Quote">${icons.quote}</button>
        <button class="jt-toolbar-item" data-format="table" data-priority="15" title="Insert Table">${icons.table}</button>
        <button class="jt-toolbar-item" data-format="hr" data-priority="16" title="Horizontal Rule (---)">${icons.hr}</button>
        <button class="jt-toolbar-item jt-color-green" data-format="color" data-color="green" data-priority="17" title="Green">A</button>
        <button class="jt-toolbar-item jt-color-yellow" data-format="color" data-color="yellow" data-priority="18" title="Yellow">A</button>
        <button class="jt-toolbar-item jt-color-blue" data-format="color" data-color="blue" data-priority="19" title="Blue">A</button>
        <button class="jt-toolbar-item jt-color-red" data-format="color" data-color="red" data-priority="20" title="Red">A</button>
        <button class="jt-toolbar-item jt-alert-btn" data-format="alert" data-priority="21" title="Insert Alert">${icons.alert}</button>
      `;

      // More menu (always visible, contains overflow items)
      const moreIcon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>';
      toolbarHTML += `
        <div class="jt-overflow-menu">
          <button class="jt-overflow-btn" title="More options">${moreIcon}</button>
          <div class="jt-overflow-dropdown"></div>
        </div>
      `;
    }

    toolbar.innerHTML = toolbarHTML;

    // Setup handlers
    if (!expanded) {
      // Responsive toolbar with overflow menu
      setupResponsiveToolbar(toolbar);
    }
    setupFormatButtons(toolbar, field);
    setupCustomTooltips(toolbar);

    if (hasPreviewMode) {
      setupPreviewButton(toolbar, field);
    }

    document.body.appendChild(toolbar);
    return toolbar;
  }

  /**
   * Check if a field is inside a modal that should NOT show the floating toolbar
   * (because the floating toolbar would appear on top of the modal awkwardly)
   * This does NOT prevent embedded toolbars - only the floating one
   * @param {HTMLTextAreaElement} field
   * @returns {boolean}
   */
  function isModalField(field) {
    if (!field) return false;

    // Check if field is inside our custom Alert modal
    if (field.closest('.jt-alert-modal-overlay') !== null ||
        field.closest('.jt-alert-modal') !== null ||
        field.classList.contains('jt-alert-message')) {
      return true;
    }

    // Check for JobTread native modals/popups - these are centered dialogs
    // They use .m-auto.shadow-lg styling pattern for popup dialogs
    // This includes both full-screen modals and nested popups (like NEW JOB MESSAGE)
    const modalContainer = field.closest('.m-auto.shadow-lg');
    if (modalContainer) {
      // The .m-auto.shadow-lg pattern is sufficient to identify JobTread popups
      // These popups can be either:
      // 1. Full-screen modals with fixed backdrop (e.g., main dialogs)
      // 2. Nested popups within sidebars (e.g., NEW JOB MESSAGE in task panel)
      // Both should use embedded toolbar instead of floating
      return true;
    }

    return false;
  }

  /**
   * Close overflow dropdowns on all embedded toolbars except one
   * Note: Embedded toolbars are always visible, we just close their dropdowns
   * @param {HTMLElement|null} exceptToolbar - Toolbar to skip (or null to close all)
   * @param {boolean} actuallyHide - If true, actually hide the toolbars (for budget field focus)
   */
  function hideAllEmbeddedToolbars(exceptToolbar = null, actuallyHide = false) {
    const embeddedToolbars = document.querySelectorAll('.jt-formatter-toolbar-embedded');
    embeddedToolbars.forEach(toolbar => {
      if (toolbar !== exceptToolbar) {
        // Close any open overflow dropdowns
        const overflowDropdown = toolbar.querySelector('.jt-overflow-dropdown');
        if (overflowDropdown) {
          overflowDropdown.classList.remove('jt-overflow-dropdown-visible');
        }
        // If actuallyHide is true, hide the toolbar (used when budget field is focused)
        if (actuallyHide) {
          toolbar.classList.add('jt-toolbar-hidden');
        }
      }
    });
  }

  /**
   * Show the toolbar for a field
   * @param {HTMLTextAreaElement} field
   */
  function showToolbar(field) {
    if (!field || !document.body.contains(field)) return;

    clearHideTimeout();

    // Budget table fields (ALL fields, not just Description) get the EXPANDED FLOATING toolbar
    // ALL OTHER fields get the EMBEDDED toolbar (compact with overflow menu)
    const isBudgetField = isBudgetTableField(field);

    if (!isBudgetField) {
      // For ALL non-budget fields, use embedded toolbar for consistent compact styling
      // This includes: sidebar fields, modal fields, Message fields, custom fields, etc.
      const embeddedToolbar = embedToolbarForField(field);
      if (embeddedToolbar) {
        // Hide any active floating toolbar
        if (activeToolbar && !activeToolbar.classList.contains('jt-formatter-toolbar-embedded')) {
          activeToolbar.remove();
          activeToolbar = null;
        }
        // Close overflow dropdowns on other embedded toolbars
        hideAllEmbeddedToolbars(embeddedToolbar);
        // Ensure this toolbar is visible (may have been hidden when budget field was focused)
        embeddedToolbar.classList.remove('jt-toolbar-hidden');
        // Set activeToolbar to embedded toolbar so state updates work
        activeToolbar = embeddedToolbar;
        activeField = field;
        updateToolbarState(field, embeddedToolbar);
        return;
      }
    }

    // For Budget Description fields ONLY - use floating EXPANDED toolbar
    // Hide all embedded toolbars when budget field is focused
    hideAllEmbeddedToolbars(null, true);
    if (activeToolbar && !document.body.contains(activeToolbar)) {
      activeToolbar = null;
    }

    // Budget fields always need expanded toolbar
    const hasExpanded = activeToolbar && activeToolbar.classList.contains('jt-formatter-expanded');

    // If we have a non-expanded toolbar, recreate it as expanded
    if (activeToolbar && !hasExpanded) {
      activeToolbar.remove();
      activeToolbar = null;
    }

    if (activeToolbar) {
      activeField = field;
      activeToolbar.style.display = 'flex';
      activeToolbar.style.visibility = 'visible';
      activeToolbar.style.opacity = '1';
      positionToolbar(activeToolbar, field);
      updateToolbarState(field, activeToolbar);
    } else {
      // Always create expanded toolbar for budget fields
      const toolbar = createToolbar(field, { expanded: true });
      positionToolbar(toolbar, field);
      updateToolbarState(field, toolbar);
      activeToolbar = toolbar;
      activeField = field;
    }
  }

  /**
   * Hide the toolbar
   */
  function hideToolbar() {
    clearHideTimeout();

    // Close overflow dropdowns on all embedded toolbars
    hideAllEmbeddedToolbars(null);

    if (activeToolbar) {
      // Close any open overflow dropdown in the active toolbar
      const overflowDropdown = activeToolbar.querySelector('.jt-overflow-dropdown');
      if (overflowDropdown) {
        overflowDropdown.classList.remove('jt-overflow-dropdown-visible');
      }

      // Embedded toolbars stay visible, only floating toolbars are removed
      if (!activeToolbar.classList.contains('jt-formatter-toolbar-embedded')) {
        // For floating toolbars, remove from DOM
        activeToolbar.remove();
      }
      activeToolbar = null;
      activeField = null;
    }
  }

  /**
   * Schedule hiding the toolbar with delay
   * @param {number} delay - Delay in milliseconds
   */
  function scheduleHide(delay = 200) {
    clearHideTimeout();
    hideTimeout = setTimeout(() => {
      const newFocus = document.activeElement;
      // Keep toolbar open if focus is on toolbar or any formatter-enabled textarea
      if (!newFocus?.closest('.jt-formatter-toolbar') && !newFocus?.dataset?.formatterReady) {
        hideToolbar();
      }
      hideTimeout = null;
    }, delay);
  }

  // Public API
  return {
    getActiveToolbar,
    getActiveField,
    setActiveField,
    clearHideTimeout,
    positionToolbar,
    updateToolbarState,
    createToolbar,
    showToolbar,
    hideToolbar,
    scheduleHide
  };
})();

// Export to window
if (typeof window !== 'undefined') {
  window.FormatterToolbar = FormatterToolbar;
}
