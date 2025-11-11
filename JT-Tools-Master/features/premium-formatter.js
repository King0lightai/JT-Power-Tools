// JobTread Premium Text Formatter - WYSIWYG Edition
// Live rendering of formatted text while maintaining markdown storage

const PremiumFormatterFeature = (() => {
  let activeToolbar = null;
  let activeField = null;
  let activeEditor = null;
  let hideTimeout = null;
  let scrollTimeout = null;
  let observer = null;
  let isActive = false;
  let styleElement = null;
  let isPromptingUser = false;
  let isSyncing = false; // Prevent infinite sync loops

  // Store editor instances and their corresponding textareas
  const editorMap = new WeakMap();
  const textareaMap = new WeakMap();

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('Premium Formatter: Already initialized');
      return;
    }

    console.log('Premium Formatter: Initializing WYSIWYG mode...');
    isActive = true;

    // Inject CSS
    injectCSS();

    // Initialize fields
    initializeFields();

    // Watch for new textareas
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
    document.addEventListener('keydown', handleKeydown, true);

    console.log('Premium Formatter: WYSIWYG mode loaded');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('Premium Formatter: Not active, nothing to cleanup');
      return;
    }

    console.log('Premium Formatter: Cleaning up...');
    isActive = false;

    // Remove toolbar
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

    // Remove all WYSIWYG editors and restore textareas
    const editors = document.querySelectorAll('.jt-wysiwyg-editor');
    editors.forEach(editor => {
      const textarea = textareaMap.get(editor);
      if (textarea) {
        textarea.style.display = '';
        editor.remove();
      }
    });

    console.log('Premium Formatter: Cleanup complete');
  }

  // Inject CSS
  function injectCSS() {
    if (styleElement) return;

    const formatterCSS = document.createElement('link');
    formatterCSS.rel = 'stylesheet';
    formatterCSS.href = chrome.runtime.getURL('styles/formatter-toolbar.css');
    document.head.appendChild(formatterCSS);

    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = chrome.runtime.getURL('styles/premium-formatter.css');
    document.head.appendChild(styleElement);
  }

  // Helper function to check if a textarea should have the formatter
  function isFormatterField(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') return false;

    // Check if it's a Budget Description field
    if (textarea.getAttribute('placeholder') === 'Description') {
      return true;
    }

    // Check if it's ANY Daily Log field
    const label = textarea.closest('label');
    if (label) {
      const heading = label.querySelector('div.font-bold');
      if (heading && heading.textContent.trim().length > 0) {
        return true;
      }
    }

    return false;
  }

  // Initialize fields
  function initializeFields() {
    if (!isActive) return;

    // Find all textareas that should have the formatter
    const fields = [];

    // 1. Budget Description fields
    const descriptionFields = document.querySelectorAll('textarea[placeholder="Description"]');
    fields.push(...descriptionFields);

    // 2. ALL Daily Log fields
    const labels = document.querySelectorAll('label');
    labels.forEach(label => {
      const heading = label.querySelector('div.font-bold');
      if (heading && heading.textContent.trim().length > 0) {
        const textareas = label.querySelectorAll('textarea');
        textareas.forEach(textarea => {
          if (textarea && !fields.includes(textarea)) {
            fields.push(textarea);
          }
        });
      }
    });

    console.log('Premium Formatter: Found', fields.length, 'fields');

    fields.forEach((field) => {
      if (!field.dataset.premiumFormatterReady && document.body.contains(field)) {
        field.dataset.premiumFormatterReady = 'true';
        createWYSIWYGEditor(field);
      }
    });
  }

  // Create WYSIWYG editor for a textarea
  function createWYSIWYGEditor(textarea) {
    // Create editor container
    const editor = document.createElement('div');
    editor.className = 'jt-wysiwyg-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('data-placeholder', textarea.placeholder || 'Start typing...');

    // Copy initial content and convert markdown to HTML
    const initialMarkdown = textarea.value;
    editor.innerHTML = markdownToHTML(initialMarkdown);

    // Copy styles from textarea
    const computedStyle = window.getComputedStyle(textarea);
    editor.style.minHeight = computedStyle.height;
    editor.style.width = computedStyle.width;
    editor.style.padding = computedStyle.padding;
    editor.style.fontFamily = computedStyle.fontFamily;
    editor.style.fontSize = computedStyle.fontSize;

    // Insert editor after textarea and hide textarea
    textarea.parentNode.insertBefore(editor, textarea.nextSibling);
    textarea.style.display = 'none';

    // Store references
    editorMap.set(textarea, editor);
    textareaMap.set(editor, textarea);

    // Add event listeners
    editor.addEventListener('focus', () => handleEditorFocus(editor, textarea));
    editor.addEventListener('blur', () => handleEditorBlur(editor, textarea));
    editor.addEventListener('input', (e) => handleEditorInput(editor, textarea, e));
    editor.addEventListener('keydown', (e) => handleEditorKeydown(editor, textarea, e));
    editor.addEventListener('mouseup', () => handleEditorSelection(editor, textarea));
    editor.addEventListener('keyup', () => handleEditorSelection(editor, textarea));

    console.log('Premium Formatter: WYSIWYG editor created');
  }

  // Convert markdown to HTML for display
  function markdownToHTML(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Process line by line to handle block-level formatting
    const lines = html.split('\n');
    const processedLines = lines.map(line => {
      let processedLine = line;

      // Headings (must be at start of line)
      if (processedLine.startsWith('### ')) {
        processedLine = `<h3>${processedLine.substring(4)}</h3>`;
        return processedLine;
      } else if (processedLine.startsWith('## ')) {
        processedLine = `<h2>${processedLine.substring(3)}</h2>`;
        return processedLine;
      } else if (processedLine.startsWith('# ')) {
        processedLine = `<h1>${processedLine.substring(2)}</h1>`;
        return processedLine;
      }

      // Quotes
      if (processedLine.startsWith('> ')) {
        processedLine = `<blockquote>${processedLine.substring(2)}</blockquote>`;
      }

      // Color tags [!color:red]
      processedLine = processedLine.replace(/\[!color:(\w+)\]\s*/g, '<span class="jt-color-$1">');
      if (processedLine.includes('jt-color-')) {
        processedLine += '</span>';
      }

      // Text alignment
      if (processedLine.startsWith('---: ')) {
        processedLine = `<div class="jt-align-right">${processedLine.substring(5)}</div>`;
        return processedLine;
      } else if (processedLine.startsWith('--: ')) {
        processedLine = `<div class="jt-align-center">${processedLine.substring(4)}</div>`;
        return processedLine;
      }

      // Bullet lists
      if (processedLine.startsWith('- ')) {
        processedLine = `<li>${processedLine.substring(2)}</li>`;
      }

      // Numbered lists
      const numberedMatch = processedLine.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        processedLine = `<li value="${numberedMatch[1]}">${numberedMatch[2]}</li>`;
      }

      // Inline formatting (bold, italic, underline, strikethrough)
      processedLine = processedLine.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      processedLine = processedLine.replace(/\^([^^]+)\^/g, '<em>$1</em>');
      processedLine = processedLine.replace(/_([^_]+)_/g, '<u>$1</u>');
      processedLine = processedLine.replace(/~([^~]+)~/g, '<s>$1</s>');

      // Links [text](url)
      processedLine = processedLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

      // Icons [!icon:name]
      processedLine = processedLine.replace(/\[!icon:(\w+)\]/g, '<span class="jt-icon jt-icon-$1">⚠</span>');

      return processedLine;
    });

    // Wrap consecutive list items
    let result = processedLines.join('\n');
    result = result.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      if (match.includes('value=')) {
        return `<ol>${match}</ol>`;
      } else {
        return `<ul>${match}</ul>`;
      }
    });

    // Preserve line breaks
    result = result.replace(/\n/g, '<br>');
    // But remove breaks inside block elements
    result = result.replace(/<\/(h[123]|blockquote|div|li)><br>/g, '</$1>');
    result = result.replace(/<br><(h[123]|blockquote|div|li|ul|ol)/g, '<$1');

    return result;
  }

  // Convert HTML back to markdown for storage
  function htmlToMarkdown(html, editor) {
    if (!html) return '';

    // Create temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let markdown = '';

    // Process each child node
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        let content = '';

        // Process children first
        node.childNodes.forEach(child => {
          content += processNode(child);
        });

        switch (tag) {
          case 'strong':
          case 'b':
            return `*${content}*`;
          case 'em':
          case 'i':
            return `^${content}^`;
          case 'u':
            return `_${content}_`;
          case 's':
          case 'strike':
            return `~${content}~`;
          case 'h1':
            return `# ${content}`;
          case 'h2':
            return `## ${content}`;
          case 'h3':
            return `### ${content}`;
          case 'blockquote':
            return `> ${content}`;
          case 'a':
            return `[${content}](${node.href})`;
          case 'li':
            const value = node.getAttribute('value');
            if (value) {
              return `${value}. ${content}`;
            } else {
              return `- ${content}`;
            }
          case 'ul':
          case 'ol':
            return content;
          case 'div':
            if (node.classList.contains('jt-align-center')) {
              return `--: ${content}`;
            } else if (node.classList.contains('jt-align-right')) {
              return `---: ${content}`;
            }
            return content;
          case 'span':
            // Handle color spans
            const colorClass = Array.from(node.classList).find(c => c.startsWith('jt-color-'));
            if (colorClass) {
              const color = colorClass.replace('jt-color-', '');
              return `[!color:${color}] ${content}`;
            }
            return content;
          case 'br':
            return '\n';
          default:
            return content;
        }
      }

      return '';
    };

    markdown = processNode(temp);

    // Clean up extra newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown;
  }

  // Event handlers
  function handleEditorFocus(editor, textarea) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    activeEditor = editor;
    activeField = textarea;
    showToolbar(editor, textarea);

    setTimeout(() => {
      if (activeEditor === editor && activeToolbar) {
        positionToolbar(activeToolbar, editor);
      }
    }, 50);
  }

  function handleEditorBlur(editor, textarea) {
    if (isPromptingUser) {
      console.log('Premium Formatter: Skipping blur - user is being prompted');
      return;
    }

    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }

    hideTimeout = setTimeout(() => {
      const newFocus = document.activeElement;
      if (!newFocus?.closest('.jt-formatter-toolbar') && !newFocus?.classList.contains('jt-wysiwyg-editor')) {
        hideToolbar();
      }
      hideTimeout = null;
    }, 200);
  }

  function handleEditorInput(editor, textarea, e) {
    if (isSyncing) return;

    isSyncing = true;

    // Auto-convert markdown patterns as user types
    autoConvertMarkdown(editor);

    // Convert HTML to markdown and update textarea
    const markdown = htmlToMarkdown(editor.innerHTML, editor);

    // Update textarea value
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(textarea, markdown);

    // Dispatch input event for React
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);

    // Update toolbar state
    if (activeToolbar && activeEditor === editor) {
      positionToolbar(activeToolbar, editor);
      updateToolbarState(editor, activeToolbar);
    }

    isSyncing = false;
  }

  // Auto-convert markdown patterns to HTML as user types
  function autoConvertMarkdown(editor) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.startContainer;

    // Only process text nodes
    if (currentNode.nodeType !== Node.TEXT_NODE) return;

    const text = currentNode.textContent;
    const cursorPos = range.startOffset;

    // Store cursor position relative to editor
    const saveCursorPosition = () => {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editor);
      range.setEnd(sel.focusNode, sel.focusOffset);
      return range.toString().length;
    };

    const restoreCursorPosition = (pos) => {
      const range = document.createRange();
      const sel = window.getSelection();
      let charCount = 0;
      let nodeStack = [editor];
      let node;
      let foundStart = false;

      while (node = nodeStack.pop()) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharCount = charCount + node.length;
          if (!foundStart && pos >= charCount && pos <= nextCharCount) {
            range.setStart(node, pos - charCount);
            range.setEnd(node, pos - charCount);
            foundStart = true;
            break;
          }
          charCount = nextCharCount;
        } else {
          for (let i = node.childNodes.length - 1; i >= 0; i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      if (foundStart) {
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    };

    let converted = false;
    let newCursorPos = cursorPos;

    // Check for bold: *text* (with space or punctuation after)
    const boldPattern = /\*([^\*\n]+)\*(\s|$|[.,!?;:])/g;
    if (boldPattern.test(text)) {
      const savedPos = saveCursorPosition();
      const beforeCursor = text.substring(0, cursorPos);
      const match = beforeCursor.match(/\*([^\*\n]+)\*$/);

      if (match && (cursorPos === text.length || /[\s.,!?;:]/.test(text[cursorPos]))) {
        const matchText = match[1];
        const matchStart = cursorPos - match[0].length;

        // Create bold element
        const bold = document.createElement('strong');
        bold.textContent = matchText;

        // Replace text with bold element
        const before = text.substring(0, matchStart);
        const after = text.substring(cursorPos);

        currentNode.textContent = before;
        if (currentNode.nextSibling) {
          currentNode.parentNode.insertBefore(bold, currentNode.nextSibling);
          const afterNode = document.createTextNode(after);
          currentNode.parentNode.insertBefore(afterNode, bold.nextSibling);
        } else {
          currentNode.parentNode.appendChild(bold);
          const afterNode = document.createTextNode(after);
          currentNode.parentNode.appendChild(afterNode);
        }

        // Position cursor after bold element
        const newRange = document.createRange();
        const sel = window.getSelection();
        newRange.setStartAfter(bold);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        converted = true;
      }
    }

    // Check for italic: ^text^ (with space or punctuation after)
    if (!converted) {
      const italicPattern = /\^([^\^\n]+)\^(\s|$|[.,!?;:])/g;
      if (italicPattern.test(text)) {
        const beforeCursor = text.substring(0, cursorPos);
        const match = beforeCursor.match(/\^([^\^\n]+)\^$/);

        if (match && (cursorPos === text.length || /[\s.,!?;:]/.test(text[cursorPos]))) {
          const matchText = match[1];
          const matchStart = cursorPos - match[0].length;

          // Create italic element
          const italic = document.createElement('em');
          italic.textContent = matchText;

          // Replace text with italic element
          const before = text.substring(0, matchStart);
          const after = text.substring(cursorPos);

          currentNode.textContent = before;
          if (currentNode.nextSibling) {
            currentNode.parentNode.insertBefore(italic, currentNode.nextSibling);
            const afterNode = document.createTextNode(after);
            currentNode.parentNode.insertBefore(afterNode, italic.nextSibling);
          } else {
            currentNode.parentNode.appendChild(italic);
            const afterNode = document.createTextNode(after);
            currentNode.parentNode.appendChild(afterNode);
          }

          // Position cursor after italic element
          const newRange = document.createRange();
          const sel = window.getSelection();
          newRange.setStartAfter(italic);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          converted = true;
        }
      }
    }

    // Check for underline: _text_ (with space or punctuation after)
    if (!converted) {
      const underlinePattern = /_([^_\n]+)_(\s|$|[.,!?;:])/g;
      if (underlinePattern.test(text)) {
        const beforeCursor = text.substring(0, cursorPos);
        const match = beforeCursor.match(/_([^_\n]+)_$/);

        if (match && (cursorPos === text.length || /[\s.,!?;:]/.test(text[cursorPos]))) {
          const matchText = match[1];
          const matchStart = cursorPos - match[0].length;

          // Create underline element
          const underline = document.createElement('u');
          underline.textContent = matchText;

          // Replace text with underline element
          const before = text.substring(0, matchStart);
          const after = text.substring(cursorPos);

          currentNode.textContent = before;
          if (currentNode.nextSibling) {
            currentNode.parentNode.insertBefore(underline, currentNode.nextSibling);
            const afterNode = document.createTextNode(after);
            currentNode.parentNode.insertBefore(afterNode, underline.nextSibling);
          } else {
            currentNode.parentNode.appendChild(underline);
            const afterNode = document.createTextNode(after);
            currentNode.parentNode.appendChild(afterNode);
          }

          // Position cursor after underline element
          const newRange = document.createRange();
          const sel = window.getSelection();
          newRange.setStartAfter(underline);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          converted = true;
        }
      }
    }

    return converted;
  }

  function handleEditorKeydown(editor, textarea, e) {
    // Handle keyboard shortcuts
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
      applyWYSIWYGFormat(editor, textarea, format);
      if (activeToolbar) {
        updateToolbarState(editor, activeToolbar);
      }
    }
  }

  function handleEditorSelection(editor, textarea) {
    if (activeToolbar && activeEditor === editor) {
      updateToolbarState(editor, activeToolbar);
    }
  }

  function handleScroll() {
    if (activeToolbar && activeEditor) {
      positionToolbar(activeToolbar, activeEditor);

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        if (activeToolbar && activeEditor &&
            document.body.contains(activeToolbar) &&
            document.body.contains(activeEditor)) {
          positionToolbar(activeToolbar, activeEditor);
          activeToolbar.style.display = 'flex';
          activeToolbar.style.visibility = 'visible';
        }
      }, 100);
    }
  }

  function handleResize() {
    if (activeToolbar && activeEditor) {
      positionToolbar(activeToolbar, activeEditor);
    }
  }

  function handleGlobalClick(e) {
    const clickedElement = e.target;

    if (clickedElement.classList.contains('jt-wysiwyg-editor') ||
        clickedElement.closest('.jt-formatter-toolbar')) {
      return;
    }

    if (activeToolbar && activeEditor) {
      hideToolbar();
    }
  }

  function handleKeydown(e) {
    // Global keydown handler if needed
  }

  // Show/hide toolbar
  function showToolbar(editor, textarea) {
    if (!editor || !document.body.contains(editor)) return;

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    if (activeToolbar && !document.body.contains(activeToolbar)) {
      activeToolbar = null;
    }

    if (activeToolbar) {
      activeEditor = editor;
      activeField = textarea;
      activeToolbar.style.display = 'flex';
      activeToolbar.style.visibility = 'visible';
      activeToolbar.style.opacity = '1';
      positionToolbar(activeToolbar, editor);
      updateToolbarState(editor, activeToolbar);
    } else {
      const toolbar = createToolbar(editor, textarea);
      positionToolbar(toolbar, editor);
      updateToolbarState(editor, toolbar);
      activeToolbar = toolbar;
      activeEditor = editor;
      activeField = textarea;
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
      activeEditor = null;
      activeField = null;
    }
  }

  function createToolbar(editor, textarea) {
    const toolbar = document.createElement('div');
    toolbar.className = 'jt-formatter-toolbar jt-formatter-compact jt-premium-toolbar';

    toolbar.innerHTML = `
    <div class="jt-premium-badge">PREMIUM</div>

    <div class="jt-toolbar-divider"></div>

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

    setupDropdowns(toolbar);
    setupColorPicker(toolbar);
    setupFormatButtons(toolbar, editor, textarea);

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

  function setupFormatButtons(toolbar, editor, textarea) {
    toolbar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const format = btn.dataset.format;
        const color = btn.dataset.color;

        if (format === 'color') {
          applyWYSIWYGFormat(editor, textarea, format, { color });
          toolbar.querySelector('.jt-color-dropdown').classList.remove('jt-color-dropdown-visible');
        } else if (format && format !== 'color-picker') {
          applyWYSIWYGFormat(editor, textarea, format);
          toolbar.querySelectorAll('.jt-dropdown-menu').forEach(menu => {
            menu.classList.remove('jt-dropdown-visible');
          });
        }

        editor.focus();
        setTimeout(() => {
          if (document.body.contains(toolbar) && document.body.contains(editor)) {
            updateToolbarState(editor, toolbar);
          }
        }, 10);
      });
    });
  }

  function positionToolbar(toolbar, editor) {
    const rect = editor.getBoundingClientRect();
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

  function updateToolbarState(editor, toolbar) {
    // Detect active formats based on current selection
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    // Check for active formats
    const activeFormats = {
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false
    };

    let current = element;
    while (current && current !== editor) {
      const tag = current.tagName?.toLowerCase();
      if (tag === 'strong' || tag === 'b') activeFormats.bold = true;
      if (tag === 'em' || tag === 'i') activeFormats.italic = true;
      if (tag === 'u') activeFormats.underline = true;
      if (tag === 's' || tag === 'strike') activeFormats.strikethrough = true;
      current = current.parentElement;
    }

    // Update button states
    toolbar.querySelector('[data-format="bold"]')?.classList.toggle('active', activeFormats.bold);
    toolbar.querySelector('[data-format="italic"]')?.classList.toggle('active', activeFormats.italic);
    toolbar.querySelector('[data-format="underline"]')?.classList.toggle('active', activeFormats.underline);
    toolbar.querySelector('[data-format="strikethrough"]')?.classList.toggle('active', activeFormats.strikethrough);
  }

  // Apply WYSIWYG formatting
  function applyWYSIWYGFormat(editor, textarea, format, options = {}) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    editor.focus();

    switch(format) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'underline':
        document.execCommand('underline', false, null);
        break;
      case 'strikethrough':
        document.execCommand('strikeThrough', false, null);
        break;
      case 'h1':
        document.execCommand('formatBlock', false, 'h1');
        break;
      case 'h2':
        document.execCommand('formatBlock', false, 'h2');
        break;
      case 'h3':
        document.execCommand('formatBlock', false, 'h3');
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList', false, null);
        break;
      case 'numbered':
        document.execCommand('insertOrderedList', false, null);
        break;
      case 'link':
        isPromptingUser = true;
        const url = prompt('Enter URL:', 'https://');
        isPromptingUser = false;
        if (url) {
          document.execCommand('createLink', false, url);
        }
        break;
      case 'color':
        const color = options.color;
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.className = `jt-color-${color}`;
        range.surroundContents(span);
        break;
    }

    // Sync changes to textarea
    handleEditorInput(editor, textarea);
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
  window.PremiumFormatterFeature = PremiumFormatterFeature;
}
