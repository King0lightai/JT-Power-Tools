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

    // The header row is the FIRST .flex.min-w-max child - it contains the column headers
    // and has sticky cells for the checkbox and Name columns
    const firstRow = scrollContainer.querySelector('.flex.min-w-max');
    if (!firstRow) return null;

    // Verify this row has header indicators: bg-gray-100 font-bold cells
    const headerCells = firstRow.querySelectorAll('.bg-gray-100.font-bold');
    if (headerCells.length > 0) {
      return firstRow;
    }

    return null;
  }

  /**
   * Find the Description header cell in the header row
   * @param {HTMLElement} headerRow
   * @returns {HTMLElement|null}
   */
  function findDescriptionHeaderCell(headerRow) {
    // Look through all direct children for the Description cell
    for (const cell of headerRow.children) {
      // Check if this cell contains "Description" text (but not description content)
      const innerText = cell.textContent.trim();
      // The header cell will just say "Description" at the start, not have long content
      if (innerText.startsWith('Description') && innerText.length < 50) {
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
   * Position toolbar in the budget header cell (sticky header mode)
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

    const toolbarHeight = 32; // Slightly smaller for header
    const padding = 8;

    // Position toolbar at the right side of the header cell
    // Leave room for the "Description" label on the left
    const toolbarWidth = toolbar.offsetWidth || 400;

    // Calculate left position - align to right side of visible area
    let left = Math.min(cellRect.right, containerRect.right) - toolbarWidth - padding;

    // Don't go past the left edge of the cell
    left = Math.max(cellRect.left + 100, left); // Leave 100px for "Description" label

    // Clamp to container bounds
    left = Math.max(containerRect.left + padding, left);

    // Center vertically in header cell
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
   * Find the bottom edge of sticky headers that are above the field
   * @param {HTMLTextAreaElement} field - The field we're positioning toolbar for
   * @returns {number} The bottom edge of the lowest sticky header above the field (in viewport coords)
   */
  function getStickyHeaderOffset(field) {
    const fieldRect = field.getBoundingClientRect();
    let maxOffset = 0;

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
    const stickyClassElements = document.querySelectorAll('.sticky');
    stickyClassElements.forEach(el => {
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
    stickyClassElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'sticky') {
        const parent = el.parentElement;
        if (parent) {
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
    // Check if this is a budget Description field - use header docked mode
    if (isBudgetDescriptionField(field)) {
      const scrollContainer = field.closest('.overflow-auto');
      const headerRow = findBudgetHeaderRow(field);

      if (headerRow && scrollContainer) {
        const headerCell = findDescriptionHeaderCell(headerRow);
        if (headerCell) {
          const success = positionToolbarInHeader(toolbar, headerCell, scrollContainer);
          if (success) {
            return;
          }
        }
      }
      // Fall through to floating mode if header docking fails
    }

    // Remove docked classes if not docking
    toolbar.classList.remove('jt-toolbar-docked');
    toolbar.classList.remove('jt-toolbar-header-docked');
    toolbar.style.position = 'absolute';

    const rect = field.getBoundingClientRect();
    const toolbarHeight = 44;
    const padding = 8;
    const viewportHeight = window.innerHeight;
    const stickyHeaderOffset = getStickyHeaderOffset(field);

    // Calculate usable viewport area (accounting for sticky headers)
    const viewportTop = stickyHeaderOffset || 0;
    const viewportBottom = viewportHeight - padding;

    // Determine if field is partially or fully visible
    const fieldVisibleTop = Math.max(rect.top, viewportTop);
    const fieldVisibleBottom = Math.min(rect.bottom, viewportBottom);
    const fieldVisibleHeight = fieldVisibleBottom - fieldVisibleTop;

    let topPosition;
    let isSticky = false;

    // Always favor positioning above/at the top of the field
    // Calculate where the toolbar would be if placed above the field
    const normalTopAbove = rect.top + window.scrollY - toolbarHeight - padding;
    const normalTopAboveViewport = rect.top - toolbarHeight - padding;

    // Check if there's room above the field (between sticky header and field top)
    const roomAbove = rect.top - viewportTop;

    if (roomAbove >= toolbarHeight + padding) {
      // Enough room above - place toolbar above the field
      topPosition = normalTopAbove;
    } else if (normalTopAboveViewport < viewportTop) {
      // Not enough room above - make toolbar sticky at top of visible area
      isSticky = true;
      topPosition = viewportTop + window.scrollY + padding;

      // But don't position it past the bottom of the field
      const maxTop = rect.bottom + window.scrollY - toolbarHeight - padding;
      if (topPosition > maxTop) {
        topPosition = maxTop;
      }
    } else {
      // Edge case: place above
      topPosition = normalTopAbove;
    }

    // Hide toolbar if field is not visible enough (less than 30px visible)
    if (fieldVisibleHeight < 30) {
      toolbar.style.visibility = 'hidden';
      toolbar.style.opacity = '0';
      return;
    } else {
      toolbar.style.visibility = 'visible';
      toolbar.style.opacity = '1';
    }

    toolbar.style.top = `${topPosition}px`;
    toolbar.style.width = `auto`;

    // Toggle sticky class for potential styling differences
    toolbar.classList.toggle('jt-toolbar-sticky', isSticky);

    // Calculate left position with right-side overflow prevention
    let leftPosition = rect.left + window.scrollX;

    // Get the toolbar's actual width
    const toolbarWidth = toolbar.offsetWidth || toolbar.getBoundingClientRect().width;
    const viewportWidth = window.innerWidth;
    const rightEdgePadding = 8;

    // Check if toolbar would overflow on the right side
    if (leftPosition + toolbarWidth > viewportWidth - rightEdgePadding) {
      leftPosition = Math.max(rightEdgePadding, viewportWidth - toolbarWidth - rightEdgePadding);
    }

    toolbar.style.left = `${leftPosition}px`;
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
   * @returns {HTMLElement}
   */
  function createToolbar(field) {
    const toolbar = document.createElement('div');
    toolbar.className = 'jt-formatter-toolbar jt-formatter-compact';

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

    toolbar.innerHTML = toolbarHTML;

    // Setup handlers
    setupDropdowns(toolbar);
    setupColorPicker(toolbar);
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

    if (activeToolbar && !document.body.contains(activeToolbar)) {
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
      const toolbar = createToolbar(field);
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
