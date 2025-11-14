// JobTread Text Formatter Feature Module - COMPLETE VERSION
// Add formatting toolbar to budget description fields

const FormatterFeature = (() => {
  let activeToolbar = null;
  let activeField = null;
  let hideTimeout = null;
  let scrollTimeout = null;
  let observer = null;
  let isActive = false;
  let styleElement = null;
  let isPromptingUser = false; // Prevent blur handlers from hiding toolbar during prompts
  let isInsertingText = false; // Prevent MutationObserver from interfering during text insertion

  // Store AbortControllers for event listeners (for proper cleanup)
  const fieldControllers = new WeakMap();

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('Formatter: Already initialized');
      return;
    }

    console.log('Formatter: Initializing...');
    isActive = true;

    // Inject CSS
    injectCSS();

    // Initialize fields
    initializeFields();

    // Watch for budget textareas
    observer = new MutationObserver(() => {
      initializeFields();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Handle window scroll and resize
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('click', handleGlobalClick, true);
    // Use capture phase to catch Enter before React's handlers
    document.addEventListener('keydown', handleKeydown, true);

    console.log('Formatter: Feature loaded');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('Formatter: Not active, nothing to cleanup');
      return;
    }

    console.log('Formatter: Cleaning up...');
    isActive = false;

    // Remove toolbar if exists
    hideToolbar();

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove event listeners
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('click', handleGlobalClick, true);
    document.removeEventListener('keydown', handleKeydown, true);

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    // Remove event listeners and formatter markers from fields
    const fields = document.querySelectorAll('textarea[data-formatter-ready="true"]');
    fields.forEach(field => {
      // Abort all event listeners for this field
      const controller = fieldControllers.get(field);
      if (controller) {
        controller.abort();
        fieldControllers.delete(field);
      }
      delete field.dataset.formatterReady;
    });

    console.log('Formatter: Cleanup complete (all event listeners removed)');
  }

  // Inject CSS dynamically
  function injectCSS() {
    if (styleElement) return;

    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = chrome.runtime.getURL('styles/formatter-toolbar.css');
    document.head.appendChild(styleElement);
  }

  // Helper function to check if a textarea should have the formatter
  function isFormatterField(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') return false;

    // Check if it's a Budget Description field
    if (textarea.getAttribute('placeholder') === 'Description') {
      return true;
    }

    // Check if it's ANY Daily Log field (textarea inside label with bold heading)
    const label = textarea.closest('label');
    if (label) {
      const heading = label.querySelector('div.font-bold');
      // If there's a bold heading in the label, this is a Daily Log field
      if (heading && heading.textContent.trim().length > 0) {
        return true;
      }
    }

    return false;
  }

  // Initialize fields
  function initializeFields() {
    if (!isActive) return;

    // Skip if on excluded paths
    const path = window.location.pathname;
    if (path.includes('/files') || path.includes('/vendors') || path.includes('/customers')) {
      console.log('Formatter: Skipping excluded path:', path);
      return;
    }

    // Don't re-initialize while we're inserting text - prevents interference
    if (isInsertingText) {
      console.log('Formatter: Skipping initializeFields - text insertion in progress');
      return;
    }

    // Clean up stale references
    if (activeField && !document.body.contains(activeField)) {
      activeField = null;
    }
    if (activeToolbar && !document.body.contains(activeToolbar)) {
      activeToolbar = null;
    }

    // Find all textareas that should have the formatter
    const fields = [];

    // 1. Budget Description fields
    const descriptionFields = document.querySelectorAll('textarea[placeholder="Description"]');
    fields.push(...descriptionFields);

    // 2. ALL Daily Log fields (any textarea inside label with bold heading)
    const labels = document.querySelectorAll('label');
    labels.forEach(label => {
      // Check if this label has any bold heading
      const heading = label.querySelector('div.font-bold');
      if (heading && heading.textContent.trim().length > 0) {
        // Find ALL textareas in this label (for multi-text custom fields)
        const textareas = label.querySelectorAll('textarea');
        textareas.forEach(textarea => {
          if (textarea && !fields.includes(textarea)) {
            fields.push(textarea);
          }
        });
      }
    });

    // Filter out time entry notes fields
    const filteredFields = fields.filter(field => {
      const placeholder = field.getAttribute('placeholder');
      return placeholder !== 'Set notes'; // Exclude time entry notes
    });

    console.log('Formatter: Found', filteredFields.length, 'fields (Description + Daily Log)');

    filteredFields.forEach((field) => {
      if (!field.dataset.formatterReady && document.body.contains(field)) {
        field.dataset.formatterReady = 'true';

        // Create AbortController for this field's event listeners
        const controller = new AbortController();
        const signal = controller.signal;
        fieldControllers.set(field, controller);

        // Add event listeners with AbortSignal for automatic cleanup
        field.addEventListener('focus', (e) => handleFieldFocus(e, field), { signal });
        field.addEventListener('mousedown', (e) => handleFieldMousedown(e, field), { signal });
        field.addEventListener('blur', (e) => handleFieldBlur(e, field), { signal });
        field.addEventListener('input', () => handleFieldInput(field), { signal });
        field.addEventListener('click', () => handleFieldClick(field), { signal });
        field.addEventListener('keyup', () => handleFieldKeyup(field), { signal });
      }
    });
  }

  // Event handlers
  function handleFieldFocus(e, field) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    activeField = field;
    showToolbar(field);

    setTimeout(() => {
      if (activeField === field && activeToolbar) {
        positionToolbar(activeToolbar, field);
      }
    }, 50);
  }

  function handleFieldMousedown(e, field) {
    if (activeField !== field) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      activeField = field;

      setTimeout(() => {
        if (activeField === field) {
          showToolbar(field);
        }
      }, 10);
    }
  }

  function handleFieldBlur(e, field) {
    // Don't hide toolbar if we're prompting user (e.g., for alert data)
    if (isPromptingUser) {
      console.log('Formatter: Skipping blur handler - user is being prompted');
      return;
    }

    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }

    hideTimeout = setTimeout(() => {
      const newFocus = document.activeElement;
      if (!newFocus?.closest('.jt-formatter-toolbar') && !newFocus?.matches('textarea[placeholder="Description"]')) {
        hideToolbar();
      }
      hideTimeout = null;
    }, 200);
  }

  function handleFieldInput(field) {
    if (activeToolbar && activeField === field) {
      positionToolbar(activeToolbar, field);
      updateToolbarState(field, activeToolbar);
    }
  }

  function handleFieldClick(field) {
    if (activeToolbar && activeField === field) {
      updateToolbarState(field, activeToolbar);
    }
  }

  function handleFieldKeyup(field) {
    if (activeToolbar && activeField === field) {
      updateToolbarState(field, activeToolbar);
    }
  }

  function handleScroll() {
    if (activeToolbar && !document.body.contains(activeToolbar)) {
      activeToolbar = null;
      activeField = null;
      return;
    }
    if (activeField && !document.body.contains(activeField)) {
      hideToolbar();
      return;
    }

    if (activeToolbar && activeField) {
      positionToolbar(activeToolbar, activeField);

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        if (activeToolbar && activeField &&
            document.body.contains(activeToolbar) &&
            document.body.contains(activeField)) {
          positionToolbar(activeToolbar, activeField);
          activeToolbar.style.display = 'flex';
          activeToolbar.style.visibility = 'visible';
        }
      }, 100);
    }
  }

  function handleResize() {
    if (activeToolbar && !document.body.contains(activeToolbar)) {
      activeToolbar = null;
      activeField = null;
      return;
    }
    if (activeField && !document.body.contains(activeField)) {
      hideToolbar();
      return;
    }

    if (activeToolbar && activeField) {
      positionToolbar(activeToolbar, activeField);
    }
  }

  function handleGlobalClick(e) {
    const clickedElement = e.target;

    // Don't hide if clicking on a formatter field or the toolbar
    if (isFormatterField(clickedElement) ||
        clickedElement.closest('.jt-formatter-toolbar')) {
      return;
    }

    if (activeToolbar && activeField) {
      hideToolbar();
    }
  }

  function handleKeydown(e) {
    const field = e.target;

    // Only apply to formatter fields (Description or Notes)
    if (!isFormatterField(field)) return;

    // Handle Enter key for auto-numbering
    if (e.key === 'Enter') {
      const handled = handleEnterKey(field, e);
      if (handled) return;
    }

    // Handle keyboard shortcuts (Ctrl/Cmd + B/I/U)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (!modifier) return;

    let format = null;

    switch(e.key.toLowerCase()) {
      case 'b':
        format = 'bold';
        break;
      case 'i':
        format = 'italic';
        break;
      case 'u':
        format = 'underline';
        break;
    }

    if (format) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      applyFormat(field, format);
      if (activeToolbar) {
        updateToolbarState(field, activeToolbar);
      }
    }
  }

  // Handle Enter key for smart auto-numbering
  function handleEnterKey(field, e) {
    const start = field.selectionStart;
    const text = field.value;

    // Find the current line
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

    console.log('Formatter: Enter pressed, current line:', `"${currentLine}"`);

    // Check if current line is a numbered list item (e.g., "1. ", "2. Some text")
    const numberedListMatch = currentLine.match(/^(\d+)\.\s+(.*)$/);

    if (numberedListMatch) {
      console.log('Formatter: Matched numbered list:', numberedListMatch);
      e.preventDefault();

      const currentNumber = parseInt(numberedListMatch[1]);
      const lineContent = numberedListMatch[2];

      // If the line is empty (just the number), exit list mode
      if (lineContent.trim() === '') {
        console.log('Formatter: Empty list item, exiting list mode');
        // Remove the empty list item and exit
        const before = text.substring(0, lineStart);
        const after = text.substring(lineEnd === -1 ? text.length : lineEnd);

        field.value = before + after;
        field.setSelectionRange(lineStart, lineStart);
      } else {
        // Insert next number on new line
        const nextNumber = currentNumber + 1;
        const before = text.substring(0, start);
        const after = text.substring(start);

        const newText = `\n${nextNumber}. `;
        console.log('Formatter: Adding next number:', nextNumber);
        field.value = before + newText + after;

        // Position cursor after the new number
        const newCursorPos = start + newText.length;
        field.setSelectionRange(newCursorPos, newCursorPos);
      }

      // Trigger change events using native setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(field, field.value);

      // Dispatch only input event (not change to avoid breaking React state)
      const inputEvent = new Event('input', { bubbles: true });
      field.dispatchEvent(inputEvent);

      return true; // Handled
    }

    // Check for bullet lists too
    const bulletListMatch = currentLine.match(/^-\s+(.*)$/);

    if (bulletListMatch) {
      console.log('Formatter: Matched bullet list:', bulletListMatch);
      e.preventDefault();

      const lineContent = bulletListMatch[1];

      // If the line is empty (just the bullet), exit list mode
      if (lineContent.trim() === '') {
        console.log('Formatter: Empty bullet item, exiting list mode');
        // Remove the empty list item and exit
        const before = text.substring(0, lineStart);
        const after = text.substring(lineEnd === -1 ? text.length : lineEnd);

        field.value = before + after;
        field.setSelectionRange(lineStart, lineStart);
      } else {
        // Insert new bullet on new line
        const before = text.substring(0, start);
        const after = text.substring(start);

        const newText = `\n- `;
        console.log('Formatter: Adding new bullet');
        field.value = before + newText + after;

        // Position cursor after the new bullet
        const newCursorPos = start + newText.length;
        field.setSelectionRange(newCursorPos, newCursorPos);
      }

      // Trigger change events using native setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(field, field.value);

      // Dispatch only input event (not change to avoid breaking React state)
      const inputEvent = new Event('input', { bubbles: true });
      field.dispatchEvent(inputEvent);

      return true; // Handled
    }

    console.log('Formatter: No list pattern matched');
    return false; // Not handled, allow default Enter behavior
  }

  // Show/hide toolbar
  function showToolbar(field) {
    if (!field || !document.body.contains(field)) return;

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

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
      // Always use compact toolbar
      const toolbar = createToolbar(field);
      positionToolbar(toolbar, field);
      updateToolbarState(field, toolbar);
      activeToolbar = toolbar;
      activeField = field;
    }
  }

  function hideToolbar() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    if (activeToolbar) {
      activeToolbar.remove();
      activeToolbar = null;
      activeField = null;
    }
  }

  function createToolbar(field) {
    const toolbar = document.createElement('div');
    toolbar.className = 'jt-formatter-toolbar jt-formatter-compact';

    // Compact toolbar - optimized for all contexts including sidebars
    toolbar.innerHTML = `
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

    // Setup dropdown handlers
    setupDropdowns(toolbar);
    setupColorPicker(toolbar);
    setupFormatButtons(toolbar, field);
    setupCustomTooltips(toolbar);

    document.body.appendChild(toolbar);
    return toolbar;
  }

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

        menu.classList.toggle('jt-dropdown-visible');
      });
    });
  }

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

        // Store field reference (defensive, in case activeField changes)
        const targetField = activeField;

        if (format === 'color') {
          applyFormat(targetField, format, { color });
          toolbar.querySelector('.jt-color-dropdown').classList.remove('jt-color-dropdown-visible');
        } else if (format && format !== 'color-picker') {
          applyFormat(targetField, format);
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

  function setupCustomTooltips(toolbar) {
    let currentTooltip = null;
    let tooltipTimeout = null;

    toolbar.querySelectorAll('button[title]').forEach(btn => {
      // Store title in data attribute and remove the title to prevent native tooltip
      const title = btn.getAttribute('title');
      btn.setAttribute('data-tooltip', title);
      btn.removeAttribute('title');

      btn.addEventListener('mouseenter', (e) => {
        // Clear any existing timeout
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
        }

        // Show tooltip after a short delay
        tooltipTimeout = setTimeout(() => {
          const tooltipText = btn.getAttribute('data-tooltip');
          if (!tooltipText) return;

          // Remove any existing tooltip
          if (currentTooltip && document.body.contains(currentTooltip)) {
            document.body.removeChild(currentTooltip);
          }

          // Create tooltip element
          const tooltip = document.createElement('div');
          tooltip.className = 'jt-custom-tooltip';
          tooltip.textContent = tooltipText;
          document.body.appendChild(tooltip);

          // Position tooltip above the button
          const btnRect = btn.getBoundingClientRect();
          const tooltipRect = tooltip.getBoundingClientRect();

          const left = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);
          const top = btnRect.top - tooltipRect.height - 10;

          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;

          // Show tooltip with fade-in
          setTimeout(() => {
            tooltip.classList.add('visible');
          }, 10);

          currentTooltip = tooltip;
        }, 500); // 500ms delay before showing tooltip
      });

      btn.addEventListener('mouseleave', () => {
        // Clear timeout if mouse leaves before tooltip shows
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
        }

        // Remove tooltip
        if (currentTooltip && document.body.contains(currentTooltip)) {
          currentTooltip.classList.remove('visible');
          setTimeout(() => {
            if (currentTooltip && document.body.contains(currentTooltip)) {
              document.body.removeChild(currentTooltip);
            }
            currentTooltip = null;
          }, 200); // Match transition duration
        }
      });
    });
  }

  function positionToolbar(toolbar, field) {
    const rect = field.getBoundingClientRect();
    const toolbarHeight = 44;
    const padding = 8;

    if (rect.top > toolbarHeight + padding + 10) {
      toolbar.style.top = `${rect.top + window.scrollY - toolbarHeight - padding}px`;
    } else {
      toolbar.style.top = `${rect.bottom + window.scrollY + padding}px`;
    }

    toolbar.style.left = `${rect.left + window.scrollX}px`;
    toolbar.style.width = `auto`;
  }

  // Collect alert data from user with proper prompt locking
  function collectAlertData() {
    isPromptingUser = true;

    try {
      const alertColor = prompt('Alert color (red, yellow, blue, green, orange, purple):', 'red');
      if (!alertColor) return null;

      const alertIcon = prompt('Alert icon (octogonAlert, exclamationTriangle, infoCircle, checkCircle):', 'octogonAlert');
      if (!alertIcon) return null;

      const alertSubject = prompt('Alert subject:', 'Important');
      if (!alertSubject) return null;

      const alertBody = prompt('Alert body text:', 'Your alert message here.');
      if (!alertBody) return null;

      return { alertColor, alertIcon, alertSubject, alertBody };
    } finally {
      // Always unlock prompting, even if user cancels
      isPromptingUser = false;
    }
  }

  // Format detection
  function detectActiveFormats(field) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;

    const activeFormats = {
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      color: null,
      'justify-center': false,
      'justify-right': false
    };

    // For selections, check if entire selection is wrapped
    if (start !== end) {
      const selection = text.substring(start, end);
      const before = text.substring(0, start);
      const after = text.substring(end);

      // Check inline formats
      if (before.endsWith('*') && after.startsWith('*')) {
        activeFormats.bold = true;
      }
      if (before.endsWith('^') && after.startsWith('^')) {
        activeFormats.italic = true;
      }
      if (before.endsWith('_') && after.startsWith('_')) {
        activeFormats.underline = true;
      }
      if (before.endsWith('~') && after.startsWith('~')) {
        activeFormats.strikethrough = true;
      }

      // Check for color (look for color tag at start of line)
      const selLineStart = before.lastIndexOf('\n') + 1;
      const beforeSelection = text.substring(selLineStart, start);
      const colorMatch = beforeSelection.match(/^\[!color:(\w+)\]/);
      if (colorMatch) {
        activeFormats.color = colorMatch[1];
      }
    } else {
      // For cursor position, check what we're inside of
      let checkStart = start;
      let checkEnd = start;

      // Expand to find format boundaries
      while (checkStart > 0 && !'*^_~\n'.includes(text[checkStart - 1])) {
        checkStart--;
      }
      while (checkEnd < text.length && !'*^_~\n'.includes(text[checkEnd])) {
        checkEnd++;
      }

      // Check if we're between format markers
      if (checkStart > 0 && checkEnd < text.length) {
        const charBefore = text[checkStart - 1];
        const charAfter = text[checkEnd];

        if (charBefore === '*' && charAfter === '*') {
          activeFormats.bold = true;
        }
        if (charBefore === '^' && charAfter === '^') {
          activeFormats.italic = true;
        }
        if (charBefore === '_' && charAfter === '_') {
          activeFormats.underline = true;
        }
        if (charBefore === '~' && charAfter === '~') {
          activeFormats.strikethrough = true;
        }
      }

      // Check for color at line start (check full line, not just up to cursor)
      const curLineStart = text.lastIndexOf('\n', start - 1) + 1;
      const curLineEnd = text.indexOf('\n', start);
      const fullLineText = text.substring(curLineStart, curLineEnd === -1 ? text.length : curLineEnd);
      const colorMatch = fullLineText.match(/^\[!color:(\w+)\]/);
      if (colorMatch) {
        activeFormats.color = colorMatch[1];
      }
    }

    // Check line-level formats (justify)
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

    if (currentLine.trim().startsWith('--:')) {
      activeFormats['justify-center'] = true;
    } else if (currentLine.trim().startsWith('---:')) {
      activeFormats['justify-right'] = true;
    }

    return activeFormats;
  }

  function updateToolbarState(field, toolbar) {
    const activeFormats = detectActiveFormats(field);

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

  // Format application
  function removeFormat(field, format, options = {}) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;
    const hasSelection = start !== end;

    let newText;
    let newCursorPos;

    function findMarkerPositions(text, pos, marker) {
      let openPos = -1;
      let closePos = -1;

      for (let i = pos - 1; i >= 0; i--) {
        if (text[i] === marker) {
          openPos = i;
          break;
        }
        if (text[i] === '\n' || '*^_~'.includes(text[i])) {
          break;
        }
      }

      for (let i = pos; i < text.length; i++) {
        if (text[i] === marker) {
          closePos = i;
          break;
        }
        if (text[i] === '\n' || '*^_~'.includes(text[i])) {
          break;
        }
      }

      return { openPos, closePos };
    }

    switch(format) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
        const markerMap = {
          'bold': '*',
          'italic': '^',
          'underline': '_',
          'strikethrough': '~'
        };
        const marker = markerMap[format];

        if (hasSelection) {
          const before = text.substring(0, start);
          const after = text.substring(end);
          const selection = text.substring(start, end);

          if (before.endsWith(marker) && after.startsWith(marker)) {
            newText = before.slice(0, -1) + selection + after.slice(1);
            newCursorPos = start - 1;
          } else {
            const cleaned = selection.replace(new RegExp(`\\${marker}`, 'g'), '');
            newText = before + cleaned + after;
            newCursorPos = start;
          }
        } else {
          const { openPos, closePos } = findMarkerPositions(text, start, marker);

          if (openPos !== -1 && closePos !== -1) {
            const before = text.substring(0, openPos);
            const middle = text.substring(openPos + 1, closePos);
            const after = text.substring(closePos + 1);
            newText = before + middle + after;
            newCursorPos = start - 1;
          } else {
            return;
          }
        }
        break;

      case 'color':
        const before = text.substring(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const lineText = text.substring(lineStart);
        const lineEnd = lineText.indexOf('\n');
        const fullLine = lineEnd === -1 ? lineText : lineText.substring(0, lineEnd);

        // Match color tag at the beginning of the line
        const colorMatch = fullLine.match(/^\[!color:\w+\]\s*/);
        if (colorMatch) {
          const beforeLine = text.substring(0, lineStart);
          const afterMatch = text.substring(lineStart + colorMatch[0].length);
          newText = beforeLine + afterMatch;
          newCursorPos = lineStart;
        } else {
          // No color tag found on this line, nothing to remove
          return;
        }
        break;

      case 'justify-center':
      case 'justify-right':
        const before2 = text.substring(0, start);
        const jLineStart = before2.lastIndexOf('\n') + 1;
        const beforeLine2 = text.substring(0, jLineStart);
        const afterLine = text.substring(jLineStart);

        const cleaned = afterLine.replace(/^(--:|---:)\s*/, '');
        newText = beforeLine2 + cleaned;
        newCursorPos = jLineStart;
        break;

      default:
        return;
    }

    // Update field value using native setter to avoid React state issues
    isInsertingText = true; // Lock to prevent MutationObserver interference
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(field, newText);

    // Dispatch events immediately - React will clear value if we delay
    dispatchReactSafeEventImmediate(field, newCursorPos);
  }

  function applyFormat(field, format, options = {}) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;
    const selection = text.substring(start, end);
    const hasSelection = selection.length > 0;

    // Check if format is already active
    const activeFormats = detectActiveFormats(field);

    // Toggle logic for inline formats
    if (['bold', 'italic', 'underline', 'strikethrough'].includes(format)) {
      if (activeFormats[format]) {
        removeFormat(field, format);
        return;
      }
    }

    // Toggle logic for colors
    if (format === 'color' && activeFormats.color === options.color) {
      removeFormat(field, 'color');
      return;
    }

    // Toggle logic for justify
    if (format === 'justify-center' && activeFormats['justify-center']) {
      removeFormat(field, format);
      return;
    }
    if (format === 'justify-right' && activeFormats['justify-right']) {
      removeFormat(field, format);
      return;
    }

    // Apply format logic
    let before = text.substring(0, start);
    let after = text.substring(end);
    let replacement;
    let cursorPos;

    switch(format) {
      case 'bold':
        replacement = hasSelection ? `*${selection}*` : '**';
        cursorPos = hasSelection ? start + replacement.length : start + 1;
        break;

      case 'italic':
        replacement = hasSelection ? `^${selection}^` : '^^';
        cursorPos = hasSelection ? start + replacement.length : start + 1;
        break;

      case 'underline':
        replacement = hasSelection ? `_${selection}_` : '__';
        cursorPos = hasSelection ? start + replacement.length : start + 1;
        break;

      case 'strikethrough':
        replacement = hasSelection ? `~${selection}~` : '~~';
        cursorPos = hasSelection ? start + replacement.length : start + 1;
        break;

      case 'h1':
        const lineStart = before.lastIndexOf('\n') + 1;
        before = text.substring(0, lineStart);
        after = text.substring(lineStart);
        replacement = `# ${after}`;
        cursorPos = lineStart + 2;
        after = '';
        break;

      case 'h2':
        const lineStart2 = before.lastIndexOf('\n') + 1;
        before = text.substring(0, lineStart2);
        after = text.substring(lineStart2);
        replacement = `## ${after}`;
        cursorPos = lineStart2 + 3;
        after = '';
        break;

      case 'h3':
        const lineStart3 = before.lastIndexOf('\n') + 1;
        before = text.substring(0, lineStart3);
        after = text.substring(lineStart3);
        replacement = `### ${after}`;
        cursorPos = lineStart3 + 4;
        after = '';
        break;

      case 'bullet':
        if (hasSelection) {
          replacement = selection.split('\n').map(line => `- ${line}`).join('\n');
        } else {
          replacement = '- ';
        }
        cursorPos = hasSelection ? start + replacement.length : start + 2;
        break;

      case 'numbered':
        if (hasSelection) {
          replacement = selection.split('\n').map((line, i) => `${i+1}. ${line}`).join('\n');
        } else {
          replacement = '1. ';
        }
        cursorPos = hasSelection ? start + replacement.length : start + 3;
        break;

      case 'quote':
        const quoteLineStart = before.lastIndexOf('\n') + 1;
        before = text.substring(0, quoteLineStart);
        const afterQuote = text.substring(quoteLineStart);
        replacement = `> ${afterQuote}`;
        cursorPos = quoteLineStart + 2;
        after = '';
        break;

      case 'table':
        isPromptingUser = true;
        const cols = prompt('Number of columns:', '3');
        if (!cols || isNaN(cols) || cols < 1) {
          isPromptingUser = false;
          return;
        }
        const rows = prompt('Number of rows (including header):', '3');
        isPromptingUser = false;

        if (!rows || isNaN(rows) || rows < 2) {
          return;
        }

        const numCols = parseInt(cols);
        const numRows = parseInt(rows);

        // Create table
        let table = [];

        // Header row
        const headers = Array(numCols).fill('Header').map((h, i) => i === 0 ? h : h + (i + 1));
        table.push('| ' + headers.join(' | ') + ' |');

        // Separator row
        table.push('| ' + Array(numCols).fill('---').join(' | ') + ' |');

        // Data rows
        for (let i = 1; i < numRows; i++) {
          const cells = Array(numCols).fill('Data');
          table.push('| ' + cells.join(' | ') + ' |');
        }

        replacement = '\n' + table.join('\n') + '\n';
        cursorPos = start + 3; // Position cursor in first header cell
        break;

      case 'justify-left':
        const leftLineStart = before.lastIndexOf('\n') + 1;
        before = text.substring(0, leftLineStart);
        let afterLeft = text.substring(leftLineStart);
        afterLeft = afterLeft.replace(/^(--:|---:)\s*/, '');
        replacement = afterLeft;
        cursorPos = leftLineStart;
        after = '';
        break;

      case 'justify-center':
        const centerLineStart = before.lastIndexOf('\n') + 1;
        before = text.substring(0, centerLineStart);
        let afterCenter = text.substring(centerLineStart);
        afterCenter = afterCenter.replace(/^(--:|---:)\s*/, '');
        replacement = `--: ${afterCenter}`;
        cursorPos = centerLineStart + 4;
        after = '';
        break;

      case 'justify-right':
        const rightLineStart = before.lastIndexOf('\n') + 1;
        before = text.substring(0, rightLineStart);
        let afterRight = text.substring(rightLineStart);
        afterRight = afterRight.replace(/^(--:|---:)\s*/, '');
        replacement = `---: ${afterRight}`;
        cursorPos = rightLineStart + 5;
        after = '';
        break;

      case 'link':
        isPromptingUser = true;
        const url = prompt('Enter URL:', 'https://');
        isPromptingUser = false;

        if (!url) {
          return;
        }

        replacement = `[${hasSelection ? selection : 'link text'}](${url})`;
        cursorPos = hasSelection ? start + replacement.length : start + 1;
        break;

      case 'color':
        const color = options.color;
        const cLineStart = before.lastIndexOf('\n') + 1;
        const cLineEnd = text.indexOf('\n', start);
        const lineEndPos = cLineEnd === -1 ? text.length : cLineEnd;

        // Check the FULL line for existing color (not just before cursor)
        const fullLine = text.substring(cLineStart, lineEndPos);
        const existingColorMatch = fullLine.match(/^\[!color:(\w+)\]\s*/);

        if (existingColorMatch) {
          // Found existing color formatting on this line
          const existingColor = existingColorMatch[1];
          const colorTagEnd = cLineStart + existingColorMatch[0].length;

          // Extract the text after the color tag (excluding the tag itself)
          const existingText = text.substring(colorTagEnd, lineEndPos).trim();

          // Determine what text to use
          let textToUse;
          if (hasSelection) {
            // User has selection, use that
            textToUse = selection;
          } else if (existingText) {
            // Reuse existing content
            textToUse = existingText;
          } else {
            // No content, use placeholder
            textToUse = 'text';
          }

          // Replace the entire line with new color (or remove if same color being toggled)
          before = text.substring(0, cLineStart);
          replacement = `[!color:${color}] ${textToUse}`;
          after = text.substring(lineEndPos);
        } else {
          // No existing color on this line - add new color
          if (hasSelection) {
            replacement = `[!color:${color}] ${selection}`;
          } else {
            // Check if cursor is on a line with content
            const lineText = fullLine.trim();

            if (lineText.length > 0) {
              // There's content on this line, add color tag at start
              replacement = `[!color:${color}] ${lineText}`;
              before = text.substring(0, cLineStart);
              after = text.substring(lineEndPos);
            } else {
              // Empty line, use placeholder
              replacement = `[!color:${color}] text`;
            }
          }
        }
        cursorPos = before.length + `[!color:${color}] `.length;
        break;

      case 'alert':
        const alertData = collectAlertData();
        if (!alertData) {
          return;
        }

        // Restore focus immediately after prompts complete
        if (field && document.body.contains(field)) {
          field.focus();
        } else {
          console.error('Formatter: Field is not in DOM after alert prompts!');
          return;
        }

        replacement = `> [!color:${alertData.alertColor}] #### [!icon:${alertData.alertIcon}] ${alertData.alertSubject}\n> ${alertData.alertBody}`;
        cursorPos = start + replacement.length;
        break;

      case 'hr':
        replacement = '\n---\n';
        cursorPos = start + replacement.length;
        break;

      case 'table':
        replacement = `| Column 1 | Column 2 | Column 3 |\n| Item 1 | Item 2 | Item 3 |\n| Item 4 | Item 5 | Item 6 |`;
        cursorPos = start + 2;
        break;

      default:
        return;
    }

    // Update field value using native setter to avoid React state issues
    // Lock to prevent MutationObserver from interfering
    isInsertingText = true;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    const newValue = before + replacement + after;
    nativeInputValueSetter.call(field, newValue);

    // Dispatch events IMMEDIATELY - React will clear value if we delay!
    dispatchReactSafeEventImmediate(field, cursorPos);
  }

  // Immediate event dispatch - for cases where React clears value during delays
  function dispatchReactSafeEventImmediate(field, cursorPos = null) {
    try {
      // Set cursor position first
      if (cursorPos !== null) {
        field.setSelectionRange(cursorPos, cursorPos);
      }

      // Dispatch input event IMMEDIATELY (synchronously)
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        composed: true,
        data: null,
        dataTransfer: null,
        inputType: 'insertText',
        isComposing: false
      });

      field.dispatchEvent(inputEvent);

      // Dispatch change event immediately too
      const changeEvent = new Event('change', {
        bubbles: true,
        cancelable: false
      });
      field.dispatchEvent(changeEvent);

      // Unlock after a small delay to ensure React has processed the events
      setTimeout(() => {
        isInsertingText = false;
      }, 100);
    } catch (error) {
      console.error('Formatter: Event dispatch error:', error);
      isInsertingText = false;
    }
  }

  // Helper function to dispatch events in a React-safe way (with delay)
  // Note: This delayed version is kept for backwards compatibility but may not be used
  // for all formatting operations. See dispatchReactSafeEventImmediate for the preferred approach.
  function dispatchReactSafeEvent(field, cursorPos = null) {
    // Use multiple animation frames + setTimeout to ensure React has fully settled
    // This gives React time to complete its internal state updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Add a small additional delay to be extra safe with React's update cycle
        setTimeout(() => {
          try {
            // Verify field still exists in DOM
            if (!document.body.contains(field)) {
              isInsertingText = false; // Unlock even if field is gone
              return;
            }

            // Set cursor position now that React has settled
            if (cursorPos !== null) {
              field.setSelectionRange(cursorPos, cursorPos);
            }

            // Create a more complete InputEvent for better React compatibility
            const inputEvent = new InputEvent('input', {
              bubbles: true,
              cancelable: false,
              composed: true,
              data: null,
              dataTransfer: null,
              inputType: 'insertText',
              isComposing: false
            });

            field.dispatchEvent(inputEvent);

            // Also dispatch a change event after a tiny delay
            setTimeout(() => {
              if (document.body.contains(field)) {
                const changeEvent = new Event('change', {
                  bubbles: true,
                  cancelable: false
                });
                field.dispatchEvent(changeEvent);
              }

              // Unlock after all events are dispatched
              isInsertingText = false;
            }, 10);
          } catch (error) {
            // If dispatching fails, silently log and continue
            console.warn('Formatter: Event dispatch warning (non-critical):', error.message);
            isInsertingText = false; // Unlock even on error
          }
        }, 50); // 50ms delay to let React settle
      });
    });
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
  window.FormatterFeature = FormatterFeature;
}
