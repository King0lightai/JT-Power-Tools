console.log('JobTread Formatter: Script loaded! (v2.5.0 - Navigation & Toolbar Visibility Fixes)');

let activeToolbar = null;
let activeField = null;
let hideTimeout = null; // Track the hide timer
let scrollTimeout = null; // Track scroll repositioning

// Watch for budget textareas
const observer = new MutationObserver(() => {
  console.log('JobTread Formatter: DOM changed, checking for fields...');
  initializeFields();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function initializeFields() {
  // Clean up stale references first
  if (activeField && !document.body.contains(activeField)) {
    console.log('JobTread Formatter: Cleaning up stale field reference');
    activeField = null;
  }
  if (activeToolbar && !document.body.contains(activeToolbar)) {
    console.log('JobTread Formatter: Cleaning up stale toolbar reference');
    activeToolbar = null;
  }

  // Target only description textareas with placeholder="Description"
  const fields = document.querySelectorAll('textarea[placeholder="Description"]');

  console.log('JobTread Formatter: Found', fields.length, 'description textareas');

  fields.forEach((field, index) => {
    console.log(`Description textarea ${index}:`, field.className);

    // Check if field is actually in the DOM and not already initialized
    if (!field.dataset.formatterReady && document.body.contains(field)) {
      field.dataset.formatterReady = 'true';

      console.log('JobTread Formatter: Initialized description field', index);
      
      field.addEventListener('focus', (e) => {
        console.log('JobTread Formatter: Description field focused!');
        
        // Clear any pending hide timer
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        
        activeField = field;
        showToolbar(field);
        
        // Force reposition after a brief delay to ensure layout is complete
        // This helps when switching between fields during scroll
        setTimeout(() => {
          if (activeField === field && activeToolbar) {
            positionToolbar(activeToolbar, field);
            console.log('JobTread Formatter: Toolbar repositioned after delay');
          }
        }, 50);
      });
      
      // Also handle mousedown to catch field switches that might not fire focus
      field.addEventListener('mousedown', (e) => {
        console.log('JobTread Formatter: Description field clicked!');
        
        // If this is a different field than the current active field
        if (activeField !== field) {
          console.log('JobTread Formatter: Switching to new field via click');
          
          // Clear any pending hide timer
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
          }
          
          activeField = field;
          
          // Small delay to let focus event fire first, then ensure toolbar is shown
          setTimeout(() => {
            if (activeField === field) {
              showToolbar(field);
            }
          }, 10);
        }
      });
      
      field.addEventListener('blur', (e) => {
        // Clear any existing hide timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
        
        // Set new hide timeout
        hideTimeout = setTimeout(() => {
          const newFocus = document.activeElement;
          // Don't hide if moving to toolbar or another textarea
          if (!newFocus?.closest('.jt-formatter-toolbar') && !newFocus?.matches('textarea[placeholder="Description"]')) {
            hideToolbar();
          }
          hideTimeout = null; // Clear the timeout reference
        }, 200); // Increased from 150ms to 200ms for better reliability
      });
      
      // Update toolbar position and state on input
      field.addEventListener('input', () => {
        if (activeToolbar && activeField === field) {
          positionToolbar(activeToolbar, field);
          updateToolbarState(field, activeToolbar);
        }
      });
      
      // Update toolbar state when cursor moves
      field.addEventListener('click', () => {
        if (activeToolbar && activeField === field) {
          updateToolbarState(field, activeToolbar);
        }
      });
      
      field.addEventListener('keyup', () => {
        if (activeToolbar && activeField === field) {
          updateToolbarState(field, activeToolbar);
        }
      });
    }
  });
}

function showToolbar(field) {
  console.log('JobTread Formatter: showToolbar called');

  // Validate that the field is still in the DOM
  if (!field || !document.body.contains(field)) {
    console.log('JobTread Formatter: Field is not in DOM, aborting showToolbar');
    return;
  }

  // Clear any pending hide timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // If toolbar exists but is not in DOM, clean it up
  if (activeToolbar && !document.body.contains(activeToolbar)) {
    console.log('JobTread Formatter: Active toolbar not in DOM, cleaning up');
    activeToolbar = null;
  }

  // If toolbar already exists, just reposition it
  if (activeToolbar) {
    activeField = field;
    
    // Ensure toolbar is visible (not hidden by any CSS)
    activeToolbar.style.display = 'flex';
    activeToolbar.style.visibility = 'visible';
    activeToolbar.style.opacity = '1';
    
    positionToolbar(activeToolbar, field);
    updateToolbarState(field, activeToolbar);
    console.log('JobTread Formatter: Toolbar repositioned!');
  } else {
    // Create new toolbar
    const toolbar = createToolbar(field);
    positionToolbar(toolbar, field);
    updateToolbarState(field, toolbar);
    activeToolbar = toolbar;
    activeField = field;
    console.log('JobTread Formatter: Toolbar created and displayed!');
  }
}

function hideToolbar() {
  // Clear any pending hide timeout
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
  toolbar.className = 'jt-formatter-toolbar';
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
      <button class="jt-dropdown-btn" title="Insert">
        <span>Insert</span><span class="jt-dropdown-arrow">▾</span>
      </button>
      <div class="jt-dropdown-menu">
        <button data-format="bullet" title="Bullet List">• Bullet List</button>
        <button data-format="numbered" title="Numbered List">1. Numbered List</button>
        <button data-format="quote" title="Quote">❝ Quote</button>
        <button data-format="link" title="Insert Link">🔗 Link</button>
        <button data-format="table" title="Insert Table">⊞ Table</button>
        <button data-format="hr" title="Horizontal Line">─ Horizontal Rule</button>
      </div>
    </div>
    
    <div class="jt-toolbar-divider"></div>
    
    <div class="jt-toolbar-group jt-dropdown-group">
      <button class="jt-dropdown-btn" title="Text Alignment">
        <span>Align</span><span class="jt-dropdown-arrow">▾</span>
      </button>
      <div class="jt-dropdown-menu">
        <button data-format="justify-left" title="Left Justify">⬅ Left</button>
        <button data-format="justify-center" title="Center Justify">↔ Center</button>
        <button data-format="justify-right" title="Right Justify">➡ Right</button>
      </div>
    </div>
    
    <div class="jt-toolbar-divider"></div>
    
    <div class="jt-toolbar-group jt-color-group">
      <button data-format="color-picker" title="Text Color" class="jt-color-btn">
        <span class="jt-color-icon">A</span>
      </button>
      <div class="jt-color-dropdown">
        <button data-format="color" data-color="green" title="Green Text" class="jt-color-option jt-color-green">A</button>
        <button data-format="color" data-color="yellow" title="Yellow Text" class="jt-color-option jt-color-yellow">A</button>
        <button data-format="color" data-color="blue" title="Blue Text" class="jt-color-option jt-color-blue">A</button>
        <button data-format="color" data-color="red" title="Red Text" class="jt-color-option jt-color-red">A</button>
        <button data-format="color" data-color="orange" title="Orange Text" class="jt-color-option jt-color-orange">A</button>
        <button data-format="color" data-color="purple" title="Purple Text" class="jt-color-option jt-color-purple">A</button>
      </div>
    </div>
    
    <div class="jt-toolbar-divider"></div>
    
    <div class="jt-toolbar-group">
      <button data-format="alert" title="Insert Alert" class="jt-alert-btn">⚠️</button>
    </div>
  `;
  
  // Handle dropdown toggles
  const dropdownGroups = toolbar.querySelectorAll('.jt-dropdown-group');
  dropdownGroups.forEach(group => {
    const btn = group.querySelector('.jt-dropdown-btn');
    const menu = group.querySelector('.jt-dropdown-menu');
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close other dropdowns
      toolbar.querySelectorAll('.jt-dropdown-menu').forEach(otherMenu => {
        if (otherMenu !== menu) {
          otherMenu.classList.remove('jt-dropdown-visible');
        }
      });
      
      menu.classList.toggle('jt-dropdown-visible');
    });
  });
  
  // Handle color picker toggle
  const colorBtn = toolbar.querySelector('[data-format="color-picker"]');
  const colorDropdown = toolbar.querySelector('.jt-color-dropdown');
  
  colorBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Close other dropdowns
    toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
      menu.classList.remove('jt-dropdown-visible');
    });
    
    colorDropdown.classList.toggle('jt-color-dropdown-visible');
  });
  
  // Close all dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.jt-formatter-toolbar')) {
      toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
        menu.classList.remove('jt-dropdown-visible');
      });
      colorDropdown.classList.remove('jt-color-dropdown-visible');
    }
  });
  
  toolbar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent field blur
    });
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const format = btn.dataset.format;
      const color = btn.dataset.color;
      
      if (format === 'color') {
        applyFormat(activeField, format, { color });
        colorDropdown.classList.remove('jt-color-dropdown-visible');
      } else if (format && format !== 'color-picker') {
        applyFormat(activeField, format);
        // Close dropdown after selection
        toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
          menu.classList.remove('jt-dropdown-visible');
        });
      }
      
      activeField.focus();
      // Update toolbar state after applying format
      setTimeout(() => updateToolbarState(activeField, toolbar), 10);
    });
  });
  
  document.body.appendChild(toolbar);
  return toolbar;
}

function positionToolbar(toolbar, field) {
  const rect = field.getBoundingClientRect();
  const toolbarHeight = 44;
  const padding = 8;
  
  // Check if enough space above
  if (rect.top > toolbarHeight + padding + 10) {
    toolbar.style.top = `${rect.top + window.scrollY - toolbarHeight - padding}px`;
  } else {
    // Position below
    toolbar.style.top = `${rect.bottom + window.scrollY + padding}px`;
  }
  
  toolbar.style.left = `${rect.left + window.scrollX}px`;
  toolbar.style.width = `auto`;
}

// NEW: Detect which formats are active at cursor position
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
    
    // Check for color - look for [!color:xxx] before selection
    const colorMatch = before.match(/\[!color:(\w+)\]\s*$/);
    if (colorMatch) {
      activeFormats.color = colorMatch[1];
    }
  } else {
    // For cursor position, check what we're inside of
    // Look backwards and forwards for format markers
    
    // Find the current "word" or formatted segment
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

// NEW: Update toolbar button states based on active formats
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
  
  // Update color button if color is active
  const colorBtn = toolbar.querySelector('.jt-color-btn');
  if (activeFormats.color) {
    colorBtn?.classList.add('active');
    colorBtn?.setAttribute('title', `Current: ${activeFormats.color}`);
  } else {
    colorBtn?.classList.remove('active');
    colorBtn?.setAttribute('title', 'Text Color');
  }
  
  // Update color options to show which is active
  toolbar.querySelectorAll('[data-format="color"]').forEach(btn => {
    const color = btn.dataset.color;
    btn.classList.toggle('active', color === activeFormats.color);
  });
}

// NEW: Remove formatting from selected text
function removeFormat(field, format, options = {}) {
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const text = field.value;
  const hasSelection = start !== end;
  
  let newText;
  let newCursorPos;
  
  // Helper function to find matching markers around a position
  function findMarkerPositions(text, pos, marker) {
    // Search backwards for opening marker
    let openPos = -1;
    let closePos = -1;
    
    // Look backwards from cursor for opening marker
    for (let i = pos - 1; i >= 0; i--) {
      if (text[i] === marker) {
        openPos = i;
        break;
      }
      // Stop at newline or other marker types
      if (text[i] === '\n' || '*^_~'.includes(text[i])) {
        break;
      }
    }
    
    // Look forwards from cursor for closing marker
    for (let i = pos; i < text.length; i++) {
      if (text[i] === marker) {
        closePos = i;
        break;
      }
      // Stop at newline or other marker types
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
        // Check if selection is wrapped by markers
        const before = text.substring(0, start);
        const after = text.substring(end);
        const selection = text.substring(start, end);
        
        if (before.endsWith(marker) && after.startsWith(marker)) {
          // Remove markers around selection
          newText = before.slice(0, -1) + selection + after.slice(1);
          newCursorPos = start - 1;
        } else {
          // Just remove markers from selection itself
          const cleaned = selection.replace(new RegExp(`\\${marker}`, 'g'), '');
          newText = before + cleaned + after;
          newCursorPos = start;
        }
      } else {
        // No selection - find markers around cursor
        const { openPos, closePos } = findMarkerPositions(text, start, marker);
        
        if (openPos !== -1 && closePos !== -1) {
          // Found both markers - remove them
          const before = text.substring(0, openPos);
          const middle = text.substring(openPos + 1, closePos);
          const after = text.substring(closePos + 1);
          newText = before + middle + after;
          newCursorPos = start - 1; // Adjust for removed opening marker
        } else {
          return; // No markers found
        }
      }
      break;
      
    case 'color':
      // Remove color prefix from current line
      const before = text.substring(0, start);
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineText = text.substring(lineStart);
      const lineEnd = lineText.indexOf('\n');
      const fullLine = lineEnd === -1 ? lineText : lineText.substring(0, lineEnd);
      
      // Match color at start of line
      const colorMatch = fullLine.match(/^\[!color:\w+\]\s*/);
      if (colorMatch) {
        const beforeLine = text.substring(0, lineStart);
        const afterMatch = text.substring(lineStart + colorMatch[0].length);
        newText = beforeLine + afterMatch;
        newCursorPos = lineStart;
      } else {
        return; // No color to remove
      }
      break;
      
    case 'justify-center':
    case 'justify-right':
      // Remove justify prefix
      const before2 = text.substring(0, start);
      const jLineStart = before2.lastIndexOf('\n') + 1;
      const beforeLine2 = text.substring(0, jLineStart);
      const afterLine = text.substring(jLineStart);
      
      // Remove justify prefix
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
  
  // Force update if JobTread uses framework reactivity
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
  
  // Check if format is already active - if so, remove it instead
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
  
  // Original apply logic (for adding formats)
  let before = text.substring(0, start);
  let after = text.substring(end);
  let replacement;
  let cursorPos;
  
  switch(format) {
    case 'bold':
      replacement = hasSelection ? `*${selection}*` : '*text*';
      cursorPos = hasSelection ? start + replacement.length : start + 1;
      break;
      
    case 'italic':
      replacement = hasSelection ? `^${selection}^` : '^text^';
      cursorPos = hasSelection ? start + replacement.length : start + 1;
      break;
      
    case 'underline':
      replacement = hasSelection ? `_${selection}_` : '_text_';
      cursorPos = hasSelection ? start + replacement.length : start + 1;
      break;
      
    case 'strikethrough':
      replacement = hasSelection ? `~${selection}~` : '~text~';
      cursorPos = hasSelection ? start + replacement.length : start + 1;
      break;
      
    case 'h1':
      // Insert at beginning of line
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
        replacement = '- Item';
      }
      cursorPos = hasSelection ? start + replacement.length : start + 2;
      break;
      
    case 'numbered':
      if (hasSelection) {
        replacement = selection.split('\n').map((line, i) => `${i+1}. ${line}`).join('\n');
      } else {
        replacement = '1. Item';
      }
      cursorPos = hasSelection ? start + replacement.length : start + 3;
      break;
      
    case 'quote':
      // Insert at beginning of line
      const quoteLineStart = before.lastIndexOf('\n') + 1;
      before = text.substring(0, quoteLineStart);
      const afterQuote = text.substring(quoteLineStart);
      replacement = `> ${afterQuote}`;
      cursorPos = quoteLineStart + 2;
      after = '';
      break;
      
    case 'justify-left':
      // Left is default, so just remove any justify prefixes if present
      const leftLineStart = before.lastIndexOf('\n') + 1;
      before = text.substring(0, leftLineStart);
      let afterLeft = text.substring(leftLineStart);
      // Remove center or right justify prefixes if present
      afterLeft = afterLeft.replace(/^(--:|---:)\s*/, '');
      replacement = afterLeft;
      cursorPos = leftLineStart;
      after = '';
      break;
      
    case 'justify-center':
      const centerLineStart = before.lastIndexOf('\n') + 1;
      before = text.substring(0, centerLineStart);
      let afterCenter = text.substring(centerLineStart);
      // Remove any existing justify prefix first
      afterCenter = afterCenter.replace(/^(--:|---:)\s*/, '');
      replacement = `--: ${afterCenter}`;
      cursorPos = centerLineStart + 4;
      after = '';
      break;
      
    case 'justify-right':
      const rightLineStart = before.lastIndexOf('\n') + 1;
      before = text.substring(0, rightLineStart);
      let afterRight = text.substring(rightLineStart);
      // Remove any existing justify prefix first
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
      // If there's already a color on this line, replace it
      const cLineStart = before.lastIndexOf('\n') + 1;
      const cLineBefore = text.substring(cLineStart, start);
      const existingColorMatch = cLineBefore.match(/\[!color:\w+\]\s*/);
      
      if (existingColorMatch) {
        // Replace existing color
        before = text.substring(0, cLineStart + cLineBefore.indexOf(existingColorMatch[0]));
        replacement = `[!color:${color}] ${hasSelection ? selection : 'Your text here'}`;
        const afterColorStart = cLineStart + cLineBefore.indexOf(existingColorMatch[0]) + existingColorMatch[0].length;
        after = text.substring(hasSelection ? end : afterColorStart);
      } else {
        // Add new color
        replacement = hasSelection ? `[!color:${color}] ${selection}` : `[!color:${color}] Your text here`;
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
      cursorPos = start + 2; // Position in first cell
      break;
      
    default:
      return;
  }
  
  // Update field value
  field.value = before + replacement + after;
  
  // Set cursor position
  field.setSelectionRange(cursorPos, cursorPos);
  
  // Trigger JobTread's change detection
  field.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Force update if JobTread uses framework reactivity
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  nativeInputValueSetter.call(field, field.value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const field = e.target;
  
  // Only apply to description textareas
  if (!field.matches('textarea[placeholder="Description"]')) return;
  
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
});

// Handle window resize/scroll with better repositioning
window.addEventListener('scroll', () => {
  // Validate elements are still in DOM
  if (activeToolbar && !document.body.contains(activeToolbar)) {
    console.log('JobTread Formatter: Toolbar not in DOM during scroll, cleaning up');
    activeToolbar = null;
    activeField = null;
    return;
  }
  if (activeField && !document.body.contains(activeField)) {
    console.log('JobTread Formatter: Field not in DOM during scroll, cleaning up');
    hideToolbar();
    return;
  }

  if (activeToolbar && activeField) {
    // Immediate reposition
    positionToolbar(activeToolbar, activeField);

    // Also reposition after scroll settles (for smooth scrolling)
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(() => {
      // Re-validate before repositioning
      if (activeToolbar && activeField &&
          document.body.contains(activeToolbar) &&
          document.body.contains(activeField)) {
        positionToolbar(activeToolbar, activeField);
        // Ensure visibility
        activeToolbar.style.display = 'flex';
        activeToolbar.style.visibility = 'visible';
      }
    }, 100);
  }
}, true);

window.addEventListener('resize', () => {
  // Validate elements are still in DOM
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
});

// Global click handler to hide toolbar when clicking outside description fields
document.addEventListener('click', (e) => {
  const clickedElement = e.target;

  // Don't hide if clicking on:
  // 1. A description textarea
  // 2. The toolbar itself or any of its children
  if (clickedElement.matches('textarea[placeholder="Description"]') ||
      clickedElement.closest('.jt-formatter-toolbar')) {
    return;
  }

  // Hide toolbar if clicking anywhere else
  if (activeToolbar && activeField) {
    console.log('JobTread Formatter: Clicked outside description field, hiding toolbar');
    hideToolbar();
  }
}, true); // Use capture phase to ensure we catch the click first

// Initialize
console.log('JobTread Formatter: Running initial field check...');
initializeFields();
console.log('JobTread Formatter: Initial check complete!');
