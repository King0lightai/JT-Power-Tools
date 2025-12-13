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
   * Check if a field is a budget table Description field
   * @param {HTMLTextAreaElement} field
   * @returns {boolean}
   */
  function isBudgetDescriptionField(field) {
    if (!field || field.getAttribute('placeholder') !== 'Description') {
      return false;
    }
    // Check if it's inside a budget table (has the characteristic row structure)
    const row = field.closest('.flex.min-w-max');
    if (!row) return false;

    // Check for budget table indicators - parent should have overflow-auto
    const scrollContainer = row.closest('.overflow-auto');
    return scrollContainer !== null;
  }

  /**
   * Check if a field is inside a sidebar/panel
   * @param {HTMLTextAreaElement} field
   * @returns {boolean}
   */
  function isSidebarField(field) {
    if (!field) return false;

    // Check for JobTread's drag-scroll-boundary (sidebars use this)
    const dragScrollContainer = field.closest('[data-is-drag-scroll-boundary="true"]');
    if (dragScrollContainer) return true;

    // Check for common sidebar/panel patterns
    const sidebar = field.closest('[class*="sidebar"], [class*="panel"], [class*="drawer"], [class*="modal"], [class*="dialog"]');
    if (sidebar) return true;

    // Check if inside a fixed/absolute positioned container that looks like a sidebar
    let parent = field.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const rect = parent.getBoundingClientRect();
        // Sidebars are typically narrow (< 600px) and tall
        if (rect.width < 600 && rect.height > 200) {
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

    // Try common sidebar patterns
    const sidebar = field.closest('[class*="sidebar"], [class*="panel"], [class*="drawer"], [class*="modal"], [class*="dialog"]');
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
   * Check if a toolbar is already embedded for this field
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function findEmbeddedToolbar(field) {
    // Check if there's already an embedded toolbar before this field
    let sibling = field.previousElementSibling;
    while (sibling) {
      if (sibling.classList.contains('jt-formatter-toolbar-embedded')) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }

    // Also check parent's children
    const parent = field.parentElement;
    if (parent) {
      const embedded = parent.querySelector('.jt-formatter-toolbar-embedded');
      if (embedded) return embedded;

      // Also check before the parent (for JobTread's relative/absolute container)
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === 'relative') {
        let parentSibling = parent.previousElementSibling;
        while (parentSibling) {
          if (parentSibling.classList.contains('jt-formatter-toolbar-embedded')) {
            return parentSibling;
          }
          parentSibling = parentSibling.previousElementSibling;
        }
      }
    }

    return null;
  }

  /**
   * Create and embed toolbar between label and field for sidebar fields
   * @param {HTMLTextAreaElement} field
   * @returns {HTMLElement|null}
   */
  function embedToolbarForField(field) {
    // Check if already embedded
    let toolbar = findEmbeddedToolbar(field);
    if (toolbar) {
      toolbar.style.display = 'flex';
      return toolbar;
    }

    // Create the toolbar
    toolbar = document.createElement('div');
    toolbar.className = 'jt-formatter-toolbar jt-formatter-toolbar-embedded jt-formatter-compact';

    // Check if PreviewModeFeature is available and active
    const hasPreviewMode = window.PreviewModeFeature && window.PreviewModeFeature.isActive();

    // Build toolbar HTML (compact with dropdowns for sidebar)
    let toolbarHTML = '';

    if (hasPreviewMode) {
      toolbarHTML += `
      <button class="jt-preview-toggle" data-action="preview" title="Preview">
        <span>Preview</span>
      </button>
      <div class="jt-toolbar-divider"></div>
      `;
    }

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

    <div class="jt-toolbar-group jt-dropdown-group">
      <button class="jt-dropdown-btn" title="More">
        <span>+</span>
      </button>
      <div class="jt-dropdown-menu jt-dropdown-menu-up">
        <button data-format="bullet" title="Bullet List">• List</button>
        <button data-format="numbered" title="Numbered List">1. List</button>
        <button data-format="link" title="Insert Link">🔗 Link</button>
        <button data-format="quote" title="Quote">❝ Quote</button>
        <button data-format="table" title="Insert Table">⊞ Table</button>
      </div>
    </div>

    <div class="jt-toolbar-divider"></div>

    <div class="jt-toolbar-group jt-color-group">
      <button data-format="color-picker" title="Text Color" class="jt-color-btn">
        <span class="jt-color-icon">A</span>
      </button>
      <div class="jt-color-dropdown jt-dropdown-menu-up">
        <button data-format="color" data-color="green" title="Green" class="jt-color-option jt-color-green">A</button>
        <button data-format="color" data-color="yellow" title="Yellow" class="jt-color-option jt-color-yellow">A</button>
        <button data-format="color" data-color="blue" title="Blue" class="jt-color-option jt-color-blue">A</button>
        <button data-format="color" data-color="red" title="Red" class="jt-color-option jt-color-red">A</button>
      </div>
    </div>

    <div class="jt-toolbar-divider"></div>

    <div class="jt-toolbar-group">
      <button data-format="alert" title="Insert Alert" class="jt-alert-btn">⚠️</button>
    </div>
  `;

    toolbar.innerHTML = toolbarHTML;

    // Setup handlers
    setupDropdowns(toolbar);
    setupColorPicker(toolbar);
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
   * Position toolbar relative to field with sticky behavior
   * For budget Description fields, docks in the sticky header row
   * @param {HTMLElement} toolbar
   * @param {HTMLTextAreaElement} field
   */
  function positionToolbar(toolbar, field) {
    const rect = field.getBoundingClientRect();
    const toolbarHeight = toolbar.offsetHeight || 36;
    const padding = 8;
    const viewportHeight = window.innerHeight;

    // Check if this is a budget Description field - use bottom positioning
    const isBudgetField = isBudgetDescriptionField(field);

    if (isBudgetField) {
      // For budget Description fields, position toolbar aligned with the footer bar
      // This prevents the toolbar from covering the text being edited
      const scrollContainer = field.closest('.overflow-auto');
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const toolbarWidth = toolbar.offsetWidth || 300;

        // Find the footer bar (+ Item / + Group row) to align with
        const footerBar = findBudgetFooterBar(field);
        let top;

        if (footerBar) {
          // Position ABOVE the footer bar (not covering scrollbar)
          const footerRect = footerBar.getBoundingClientRect();
          top = footerRect.top - toolbarHeight - 8;
        } else {
          // Fallback: position above the bottom of container (leave room for scrollbar)
          const bottomPadding = 50;
          top = containerRect.bottom - toolbarHeight - bottomPadding;
        }

        // Position horizontally: align with the Description column (field's left edge)
        // But offset past the frozen Name column
        let left = rect.left;

        // Ensure toolbar doesn't go off-screen
        const viewportWidth = window.innerWidth;
        if (left + toolbarWidth > viewportWidth - padding) {
          left = Math.max(padding, viewportWidth - toolbarWidth - padding);
        }

        // Make sure it's not below the viewport
        if (top + toolbarHeight > viewportHeight - padding) {
          top = viewportHeight - toolbarHeight - padding;
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
      : 'jt-formatter-toolbar jt-formatter-compact';

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
        <button data-format="bullet" title="Bullet List">•</button>
        <button data-format="numbered" title="Numbered List">1.</button>
        <button data-format="link" title="Insert Link">🔗</button>
        <button data-format="quote" title="Quote">❝</button>
        <button data-format="table" title="Insert Table">⊞</button>
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
        <button data-format="alert" title="Insert Alert" class="jt-alert-btn">⚠️</button>
      </div>
    `;
    } else {
      // Compact layout with dropdowns (default)
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

      <div class="jt-toolbar-group jt-dropdown-group">
        <button class="jt-dropdown-btn" title="Headings">
          <span>H</span><span class="jt-dropdown-arrow">▾</span>
        </button>
        <div class="jt-dropdown-menu">
          <button data-format="h1" title="Heading 1">H1</button>
          <button data-format="h2" title="Heading 2">H2</button>
          <button data-format="h3" title="Heading 3">H3</button>
        </div>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group jt-dropdown-group">
        <button class="jt-dropdown-btn" title="More">
          <span>+</span>
        </button>
        <div class="jt-dropdown-menu">
          <button data-format="bullet" title="Bullet List">• List</button>
          <button data-format="numbered" title="Numbered List">1. List</button>
          <button data-format="link" title="Insert Link">🔗 Link</button>
          <button data-format="quote" title="Quote">❝ Quote</button>
          <button data-format="table" title="Insert Table">⊞ Table</button>
        </div>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group jt-color-group">
        <button data-format="color-picker" title="Text Color" class="jt-color-btn">
          <span class="jt-color-icon">A</span>
        </button>
        <div class="jt-color-dropdown">
          <button data-format="color" data-color="green" title="Green" class="jt-color-option jt-color-green">A</button>
          <button data-format="color" data-color="yellow" title="Yellow" class="jt-color-option jt-color-yellow">A</button>
          <button data-format="color" data-color="blue" title="Blue" class="jt-color-option jt-color-blue">A</button>
          <button data-format="color" data-color="red" title="Red" class="jt-color-option jt-color-red">A</button>
        </div>
      </div>

      <div class="jt-toolbar-divider"></div>

      <div class="jt-toolbar-group">
        <button data-format="alert" title="Insert Alert" class="jt-alert-btn">⚠️</button>
      </div>
    `;
    }

    toolbar.innerHTML = toolbarHTML;

    // Setup handlers
    if (!expanded) {
      setupDropdowns(toolbar);
      setupColorPicker(toolbar);
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
   * Show the toolbar for a field
   * @param {HTMLTextAreaElement} field
   */
  function showToolbar(field) {
    if (!field || !document.body.contains(field)) return;

    clearHideTimeout();

    // Check if this is a sidebar field - use embedded toolbar
    const isSidebar = isSidebarField(field) && !isBudgetDescriptionField(field);
    if (isSidebar) {
      // For sidebar fields, embed the toolbar in the DOM (not floating)
      const embeddedToolbar = embedToolbarForField(field);
      if (embeddedToolbar) {
        // Hide any active floating toolbar
        if (activeToolbar && !activeToolbar.classList.contains('jt-formatter-toolbar-embedded')) {
          activeToolbar.style.display = 'none';
        }
        activeField = field;
        updateToolbarState(field, embeddedToolbar);
        return;
      }
    }

    // For non-sidebar fields, use floating toolbar
    if (activeToolbar && !document.body.contains(activeToolbar)) {
      activeToolbar = null;
    }

    // Check if this is a budget Description field (needs expanded toolbar)
    const needsExpanded = isBudgetDescriptionField(field);
    const hasExpanded = activeToolbar && activeToolbar.classList.contains('jt-formatter-expanded');

    // If toolbar type doesn't match what we need, recreate it
    if (activeToolbar && needsExpanded !== hasExpanded) {
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
      const toolbar = createToolbar(field, { expanded: needsExpanded });
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

    if (activeToolbar) {
      activeToolbar.remove();
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
