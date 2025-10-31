// JobTread Budget Formatter Feature Module - COMPLETE VERSION
// Add formatting toolbar to budget description fields

const FormatterFeature = (() => {
  let activeToolbar = null;
  let activeField = null;
  let hideTimeout = null;
  let scrollTimeout = null;
  let observer = null;
  let isActive = false;
  let styleElement = null;

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
    document.addEventListener('keydown', handleKeydown);

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
    document.removeEventListener('keydown', handleKeydown);

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    // Remove formatter markers from fields
    const fields = document.querySelectorAll('textarea[data-formatter-ready="true"]');
    fields.forEach(field => {
      delete field.dataset.formatterReady;
    });

    console.log('Formatter: Cleanup complete');
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
        const textarea = label.querySelector('textarea');
        if (textarea && !fields.includes(textarea)) {
          fields.push(textarea);
        }
      }
    });

    console.log('Formatter: Found', fields.length, 'fields (Description + Daily Log)');

    fields.forEach((field) => {
      if (!field.dataset.formatterReady && document.body.contains(field)) {
        field.dataset.formatterReady = 'true';

        field.addEventListener('focus', (e) => handleFieldFocus(e, field));
        field.addEventListener('mousedown', (e) => handleFieldMousedown(e, field));
        field.addEventListener('blur', (e) => handleFieldBlur(e, field));
        field.addEventListener('input', () => handleFieldInput(field));
        field.addEventListener('click', () => handleFieldClick(field));
        field.addEventListener('keyup', () => handleFieldKeyup(field));
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

      // Trigger change events
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(field, field.value);
      field.dispatchEvent(new Event('input', { bubbles: true }));

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

      // Trigger change events
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(field, field.value);
      field.dispatchEvent(new Event('input', { bubbles: true }));

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
        const format = btn.dataset.format;
        const color = btn.dataset.color;

        if (format === 'color') {
          applyFormat(activeField, format, { color });
          toolbar.querySelector('.jt-color-dropdown').classList.remove('jt-color-dropdown-visible');
        } else if (format && format !== 'color-picker') {
          applyFormat(activeField, format);
          toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
            menu.classList.remove('jt-dropdown-visible');
          });
        }

        activeField.focus();
        setTimeout(() => updateToolbarState(activeField, toolbar), 10);
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

      // Check for color
      const colorMatch = before.match(/\[!color:(\w+)\]\s*$/);
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

      // Check for color at line start
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineText = text.substring(lineStart, start);
      const colorMatch = lineText.match(/\[!color:(\w+)\]/);
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

        const colorMatch = fullLine.match(/^\[!color:\w+\]\s*/);
        if (colorMatch) {
          const beforeLine = text.substring(0, lineStart);
          const afterMatch = text.substring(lineStart + colorMatch[0].length);
          newText = beforeLine + afterMatch;
          newCursorPos = lineStart;
        } else {
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

    // Update field value
    field.value = newText;
    field.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger change events
    field.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(field, field.value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
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
        const url = prompt('Enter URL:', 'https://');
        if (!url) return;
        replacement = `[${hasSelection ? selection : 'link text'}](${url})`;
        cursorPos = hasSelection ? start + replacement.length : start + 1;
        break;

      case 'color':
        const color = options.color;
        const cLineStart = before.lastIndexOf('\n') + 1;
        const cLineBefore = text.substring(cLineStart, start);
        const existingColorMatch = cLineBefore.match(/\[!color:\w+\]\s*/);

        if (existingColorMatch) {
          // Found existing color formatting on this line
          const colorTagStart = cLineStart + cLineBefore.indexOf(existingColorMatch[0]);
          const colorTagEnd = colorTagStart + existingColorMatch[0].length;

          // Extract the existing text after the color tag (up to end of line or selection end)
          const lineEnd = text.indexOf('\n', colorTagEnd);
          const existingTextEnd = lineEnd === -1 ? text.length : lineEnd;
          const existingText = text.substring(colorTagEnd, hasSelection ? end : existingTextEnd).trim();

          // Determine what text to use
          let textToUse;
          if (hasSelection) {
            // User has selection, use that
            textToUse = selection;
          } else if (existingText && existingText !== 'Your text here') {
            // Reuse existing meaningful content (not placeholder)
            textToUse = existingText;
          } else {
            // No meaningful content, use minimal placeholder
            textToUse = 'text';
          }

          // Replace the color tag and content
          before = text.substring(0, colorTagStart);
          replacement = `[!color:${color}] ${textToUse}`;
          after = text.substring(hasSelection ? end : existingTextEnd);
        } else {
          // No existing color on this line
          if (hasSelection) {
            replacement = `[!color:${color}] ${selection}`;
          } else {
            // Check if cursor is on a line with content
            const lineEnd = text.indexOf('\n', start);
            const lineText = text.substring(cLineStart, lineEnd === -1 ? text.length : lineEnd).trim();

            if (lineText.length > 0) {
              // There's content on this line, just add color tag at start
              replacement = `[!color:${color}] ${lineText}`;
              before = text.substring(0, cLineStart);
              after = text.substring(lineEnd === -1 ? text.length : lineEnd);
            } else {
              // Empty line, use minimal placeholder
              replacement = `[!color:${color}] text`;
            }
          }
        }
        cursorPos = before.length + `[!color:${color}] `.length;
        break;

      case 'alert':
        const alertColor = prompt('Alert color (red, yellow, blue, green, orange, purple):', 'red');
        if (!alertColor) return;

        const alertIcon = prompt('Alert icon (octogonAlert, exclamationTriangle, infoCircle, checkCircle):', 'octogonAlert');
        if (!alertIcon) return;

        const alertSubject = prompt('Alert subject:', 'Important');
        if (!alertSubject) return;

        const alertBody = prompt('Alert body text:', 'Your alert message here.');
        if (!alertBody) return;

        replacement = `> [!color:${alertColor}] #### [!icon:${alertIcon}] ${alertSubject}\n> ${alertBody}`;
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

    // Update field value
    field.value = before + replacement + after;

    // Set cursor position
    field.setSelectionRange(cursorPos, cursorPos);

    // Trigger change events
    field.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(field, field.value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
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
