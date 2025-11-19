// JobTread Preview Mode (Premium Feature)
// Shows a live preview of formatted text with a floating preview panel

const PreviewModeFeature = (() => {
  let observer = null;
  let isActive = false;
  let styleElement = null;
  let activePreview = null;
  let activeButton = null;

  // Store button and preview references for each textarea
  const buttonMap = new WeakMap();
  const previewMap = new WeakMap();

  // Handle settings changes from other tabs
  function handleSettingsChange(message) {
    if (message.type === 'SETTINGS_CHANGED') {
      // Re-apply theme to all buttons
      const buttons = document.querySelectorAll('.jt-preview-btn');
      buttons.forEach(btn => detectAndApplyTheme(btn));

      // Re-apply theme to active preview if exists
      if (activePreview) {
        detectAndApplyTheme(activePreview);
      }
    }
  }

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('Preview Mode: Already initialized');
      return;
    }

    console.log('Preview Mode: Initializing...');
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

    // Handle clicks outside preview to close it
    document.addEventListener('click', handleGlobalClick, true);

    // Listen for settings changes
    chrome.runtime.onMessage.addListener(handleSettingsChange);

    console.log('Preview Mode: Feature loaded');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('Preview Mode: Not active, nothing to cleanup');
      return;
    }

    console.log('Preview Mode: Cleaning up...');
    isActive = false;

    // Close any open preview
    closePreview();

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove event listeners
    document.removeEventListener('click', handleGlobalClick, true);

    // Remove settings change listener
    chrome.runtime.onMessage.removeListener(handleSettingsChange);

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    // Remove all preview buttons
    const buttons = document.querySelectorAll('.jt-preview-btn');
    buttons.forEach(btn => btn.remove());

    // Remove all preview panels
    const previews = document.querySelectorAll('.jt-preview-panel');
    previews.forEach(panel => panel.remove());

    console.log('Preview Mode: Cleanup complete');
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
    styleElement.href = chrome.runtime.getURL('styles/preview-mode.css');
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

    // Skip if on excluded paths
    const path = window.location.pathname;
    if (path.includes('/files') || path.includes('/vendors') || path.includes('/customers')) {
      console.log('Preview Mode: Skipping excluded path:', path);
      return;
    }

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

    // Filter out time entry notes fields and Time Clock notes fields
    const filteredFields = fields.filter(field => {
      const placeholder = field.getAttribute('placeholder');
      if (placeholder === 'Set notes') {
        return false; // Exclude time entry notes
      }

      // Exclude Notes field in Time Clock sidebar
      const label = field.closest('label');
      if (label) {
        const heading = label.querySelector('div.font-bold');
        if (heading && heading.textContent.trim() === 'Notes') {
          // Check if this is within a Time Clock sidebar
          const sidebar = field.closest('div.overflow-y-auto, form');
          if (sidebar) {
            const timeClockHeader = sidebar.querySelector('div.font-bold.text-jtOrange.uppercase');
            if (timeClockHeader && timeClockHeader.textContent.trim() === 'Time Clock') {
              return false; // Exclude Time Clock Notes field
            }
          }
        }
      }

      return true;
    });

    console.log('Preview Mode: Found', filteredFields.length, 'fields');

    filteredFields.forEach((field) => {
      if (!field.dataset.previewModeReady && document.body.contains(field)) {
        field.dataset.previewModeReady = 'true';
        // Standalone preview button removed - preview is now only accessible via formatter toolbar
        // addPreviewButton(field);
      }
    });
  }

  // Add preview button next to textarea
  function addPreviewButton(textarea) {
    // Find the container that holds the textarea
    const container = textarea.closest('div');
    if (!container) return;

    // Create preview button
    const button = document.createElement('button');
    button.className = 'jt-preview-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 3C4.5 3 1.73 5.61 1 9c.73 3.39 3.5 6 7 6s6.27-2.61 7-6c-.73-3.39-3.5-6-7-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z" fill="currentColor"/>
      </svg>
    `;
    button.title = 'Preview formatting';
    button.type = 'button';

    // Position button absolutely relative to container
    button.style.position = 'absolute';
    button.style.top = '4px';
    button.style.right = '4px';
    button.style.zIndex = '100';
    button.style.opacity = '0';
    button.style.pointerEvents = 'none';
    button.style.transition = 'opacity 0.15s ease';

    // Apply theme to button
    detectAndApplyTheme(button);

    // Track hide timeout for this specific button
    let hideTimeout = null;

    // Show button helper
    const showButton = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
    };

    // Hide button helper
    const hideButton = () => {
      // Don't hide if preview is open
      const preview = previewMap.get(textarea);
      if (preview && document.body.contains(preview)) {
        return;
      }
      button.style.opacity = '0';
      button.style.pointerEvents = 'none';
    };

    // Click handler for button
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePreview(textarea, button);
    });

    // Focus event - show button (matches formatter pattern)
    textarea.addEventListener('focus', () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      showButton();
    });

    // Mousedown event - show button (matches formatter pattern)
    textarea.addEventListener('mousedown', () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      // Small delay to ensure it appears smoothly
      setTimeout(() => {
        if (document.body.contains(textarea)) {
          showButton();
        }
      }, 10);
    });

    // Blur event - hide button with delay (matches formatter pattern)
    textarea.addEventListener('blur', () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      hideTimeout = setTimeout(() => {
        const newFocus = document.activeElement;
        const preview = previewMap.get(textarea);

        // Don't hide if focus went to the button or preview is open
        if (!newFocus?.closest('.jt-preview-btn') &&
            (!preview || !document.body.contains(preview))) {
          hideButton();
        }
        hideTimeout = null;
      }, 200);
    });

    // Store reference
    buttonMap.set(textarea, button);
    button._textarea = textarea; // Store textarea reference on button for closePreview

    // Insert button into the container
    container.style.position = 'relative';
    container.appendChild(button);

    // If textarea is already focused, show button immediately
    if (document.activeElement === textarea) {
      showButton();
    }

    console.log('Premium Formatter: Preview button added');
  }

  // Toggle preview panel
  function togglePreview(textarea, button) {
    // Check if this textarea already has an open preview
    const existingPreview = previewMap.get(textarea);

    // If this preview is already open, close it and remove active state from button
    if (existingPreview && document.body.contains(existingPreview)) {
      closePreview();
      // Ensure the button's active class is removed
      if (button) {
        button.classList.remove('active');
      }
      return;
    }

    // Close any other open preview
    closePreview();

    // Create and show preview
    showPreview(textarea, button);
  }

  // Detect and apply theme
  function detectAndApplyTheme(element) {
    if (!element) return;

    // Get current settings
    chrome.storage.sync.get(['jtToolsSettings'], (result) => {
      const settings = result.jtToolsSettings || {};

      // Remove existing theme classes
      element.classList.remove('dark-theme', 'custom-theme');

      // Check if dark mode is enabled
      if (settings.darkMode) {
        element.classList.add('dark-theme');
        return;
      }

      // Check if custom RGB theme is enabled
      if (settings.rgbTheme && settings.themeColors) {
        element.classList.add('custom-theme');
        const { primary, background, text } = settings.themeColors;

        // Calculate lighter background for inputs
        const lighterBg = adjustColorBrightness(background, 10);
        const borderColor = adjustColorBrightness(background, -20);

        // Set CSS variables for custom theme
        element.style.setProperty('--jt-preview-bg', background);
        element.style.setProperty('--jt-preview-text', text);
        element.style.setProperty('--jt-preview-primary', primary);
        element.style.setProperty('--jt-preview-text-muted', adjustColorBrightness(text, 30));
        element.style.setProperty('--jt-preview-border', borderColor);
        element.style.setProperty('--jt-preview-btn-bg', lighterBg);
        element.style.setProperty('--jt-preview-btn-text', text);
        element.style.setProperty('--jt-preview-btn-border', borderColor);
        element.style.setProperty('--jt-preview-btn-hover-bg', adjustColorBrightness(lighterBg, 5));
        element.style.setProperty('--jt-preview-btn-hover-text', text);
        element.style.setProperty('--jt-preview-btn-hover-border', adjustColorBrightness(borderColor, -10));
        element.style.setProperty('--jt-preview-scrollbar-track', adjustColorBrightness(background, 5));
        element.style.setProperty('--jt-preview-scrollbar-thumb', borderColor);
        element.style.setProperty('--jt-preview-scrollbar-thumb-hover', adjustColorBrightness(borderColor, -10));
      }
    });
  }

  // Adjust color brightness (simple HSL adjustment)
  function adjustColorBrightness(hex, percent) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Adjust brightness
    const adjust = (color) => {
      const adjusted = color + (color * percent / 100);
      return Math.min(255, Math.max(0, Math.round(adjusted)));
    };

    const newR = adjust(r);
    const newG = adjust(g);
    const newB = adjust(b);

    // Convert back to hex
    return '#' + [newR, newG, newB]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }

  // Show preview panel
  function showPreview(textarea, button) {
    const preview = document.createElement('div');
    preview.className = 'jt-preview-panel';

    // Apply theme
    detectAndApplyTheme(preview);
    detectAndApplyTheme(button);

    // Add header
    const header = document.createElement('div');
    header.className = 'jt-preview-header';
    header.innerHTML = `
      <span class="jt-preview-title">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 3C4.5 3 1.73 5.61 1 9c.73 3.39 3.5 6 7 6s6.27-2.61 7-6c-.73-3.39-3.5-6-7-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z" fill="currentColor"/>
        </svg>
        Format Preview
      </span>
    `;
    preview.appendChild(header);

    // Add content area
    const content = document.createElement('div');
    content.className = 'jt-preview-content';

    // Convert markdown to HTML
    const markdown = textarea.value;
    if (markdown) {
      content.innerHTML = markdownToHTML(markdown);
    } else {
      content.innerHTML = '<p class="jt-preview-empty">No content to preview</p>';
    }

    preview.appendChild(content);

    // Add to document
    document.body.appendChild(preview);

    // Position preview
    positionPreview(preview, textarea, button);

    // Remove active class from previous button if any
    if (activeButton && activeButton !== button) {
      activeButton.classList.remove('active');
    }

    // Mark new button as active
    if (button) {
      button.classList.add('active');
    }

    // Store references
    activePreview = preview;
    activeButton = button;
    previewMap.set(textarea, preview);

    // Update preview on textarea input
    const updatePreview = () => {
      const markdown = textarea.value;
      if (markdown) {
        content.innerHTML = markdownToHTML(markdown);
      } else {
        content.innerHTML = '<p class="jt-preview-empty">No content to preview</p>';
      }
    };

    textarea.addEventListener('input', updatePreview);
    preview._updateHandler = updatePreview;
    preview._textarea = textarea;

    console.log('Premium Formatter: Preview shown');
  }

  // Position preview panel intelligently
  function positionPreview(preview, textarea, button) {
    const textareaRect = textarea.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const previewWidth = 400;
    const previewMaxHeight = 300;

    // Try to position to the right of the textarea
    let left = textareaRect.right + 12;
    let top = textareaRect.top;

    // If not enough space on the right, position to the left
    if (left + previewWidth > viewportWidth - 20) {
      left = textareaRect.left - previewWidth - 12;
    }

    // If still not enough space, position below
    if (left < 20) {
      left = textareaRect.left;
      top = textareaRect.bottom + 12;
    }

    // If would go off bottom, position above
    if (top + previewMaxHeight > viewportHeight - 20) {
      top = Math.max(20, textareaRect.top - previewMaxHeight - 12);
    }

    // Apply position
    preview.style.left = `${left + window.scrollX}px`;
    preview.style.top = `${top + window.scrollY}px`;
    preview.style.width = `${previewWidth}px`;
    preview.style.maxHeight = `${previewMaxHeight}px`;

    // Add show class for animation
    setTimeout(() => {
      preview.classList.add('show');
    }, 10);
  }

  // Close preview panel
  function closePreview() {
    if (activePreview) {
      // Remove input listener
      if (activePreview._updateHandler && activePreview._textarea) {
        activePreview._textarea.removeEventListener('input', activePreview._updateHandler);
        // Clear the preview from the map
        previewMap.delete(activePreview._textarea);
      }

      activePreview.classList.remove('show');
      setTimeout(() => {
        if (activePreview && activePreview.parentNode) {
          activePreview.remove();
        }
      }, 200);
    }

    // Always remove active class from button
    if (activeButton) {
      activeButton.classList.remove('active');

      // Hide standalone button if textarea is not focused (toolbar buttons don't have _textarea)
      const textarea = activeButton._textarea;
      if (textarea && document.activeElement !== textarea) {
        activeButton.style.opacity = '0';
        activeButton.style.pointerEvents = 'none';
      }
    }

    // Also check for any other buttons that might have the active class (cleanup)
    const allActiveButtons = document.querySelectorAll('.jt-preview-btn.active, .jt-preview-toggle.active');
    allActiveButtons.forEach(btn => {
      btn.classList.remove('active');
    });

    activePreview = null;
    activeButton = null;
  }

  // Handle global clicks to close preview and hide buttons
  function handleGlobalClick(e) {
    const clickedElement = e.target;

    // Handle preview panel closing
    if (activePreview) {
      // Don't close if clicking inside the preview or the button
      if (!clickedElement.closest('.jt-preview-panel') &&
          !clickedElement.closest('.jt-preview-btn')) {
        closePreview();
      }
    }

    // Handle button hiding when clicking outside (matches formatter pattern)
    if (!clickedElement.closest('textarea[data-preview-mode-ready="true"]') &&
        !clickedElement.closest('.jt-preview-btn') &&
        !clickedElement.closest('.jt-preview-panel')) {

      // Hide all visible buttons that don't have an active preview
      const allButtons = document.querySelectorAll('.jt-preview-btn');
      allButtons.forEach(btn => {
        const textarea = btn._textarea;
        if (textarea) {
          const preview = previewMap.get(textarea);
          // Only hide if no preview is open and textarea doesn't have focus
          if ((!preview || !document.body.contains(preview)) &&
              document.activeElement !== textarea) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
          }
        }
      });
    }
  }

  // Parse markdown tables and convert to HTML
  function parseMarkdownTables(text) {
    // Split text into lines
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Check if this line starts a table (contains pipes)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Collect all table rows
        const tableRows = [];
        let j = i;

        while (j < lines.length) {
          const tableLine = lines[j].trim();
          if (tableLine.startsWith('|') && tableLine.endsWith('|')) {
            tableRows.push(tableLine);
            j++;
          } else {
            break;
          }
        }

        // Parse table if we have at least one row
        if (tableRows.length > 0) {
          const tableHTML = convertTableToHTML(tableRows);
          result.push(tableHTML);
          i = j;
          continue;
        }
      }

      result.push(line);
      i++;
    }

    return result.join('\n');
  }

  // Convert markdown table rows to HTML table
  function convertTableToHTML(rows) {
    if (rows.length === 0) return '';

    let html = '<table class="jt-markdown-table">\n';

    // Check if second row is separator (contains only |, -, :, and spaces)
    const hasSeparator = rows.length > 1 && /^[\|\-\s:]+$/.test(rows[1]);

    // Determine header row index
    const headerIndex = 0;
    const dataStartIndex = hasSeparator ? 2 : 1;

    // Parse header row
    if (rows[headerIndex]) {
      const headerCells = rows[headerIndex]
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);

      if (headerCells.length > 0) {
        html += '  <thead>\n    <tr>\n';
        headerCells.forEach(cell => {
          html += `      <th>${escapeHTML(cell)}</th>\n`;
        });
        html += '    </tr>\n  </thead>\n';
      }
    }

    // Parse data rows
    if (dataStartIndex < rows.length) {
      html += '  <tbody>\n';
      for (let i = dataStartIndex; i < rows.length; i++) {
        const cells = rows[i]
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0);

        if (cells.length > 0) {
          html += '    <tr>\n';
          cells.forEach(cell => {
            html += `      <td>${escapeHTML(cell)}</td>\n`;
          });
          html += '    </tr>\n';
        }
      }
      html += '  </tbody>\n';
    }

    html += '</table>';
    return html;
  }

  // Escape HTML characters
  function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Process inline formatting (can be nested inside block elements)
  function processInlineFormatting(text) {
    let result = text;

    // Icons [!icon:name] - process before inline formatting
    result = result.replace(/\[!icon:(\w+)\]/g, '<span class="jt-icon jt-icon-$1">⚠</span>');

    // Inline colors [!color:green] text - process before other formatting
    result = result.replace(/\[!color:(\w+)\]\s*(.+?)(?=\[!color:|$)/g, '<span class="jt-color-$1">$2</span>');

    // Links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Inline formatting (bold, italic, underline, strikethrough)
    result = result.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    result = result.replace(/\^([^^]+)\^/g, '<em>$1</em>');
    result = result.replace(/_([^_]+)_/g, '<u>$1</u>');
    result = result.replace(/~([^~]+)~/g, '<s>$1</s>');

    return result;
  }

  // Convert markdown to HTML for preview
  function markdownToHTML(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Parse tables first (before line-by-line processing)
    html = parseMarkdownTables(html);

    // Process line by line to handle block-level formatting
    const lines = html.split('\n');
    const processedLines = lines.map(line => {
      let processedLine = line.trim();
      let isBlockQuote = false;
      let isColored = false;
      let colorClass = '';

      // Check for blockquote
      if (processedLine.startsWith('> ')) {
        processedLine = processedLine.substring(2);
        isBlockQuote = true;
      }

      // Check for color tags [!color:red]
      const colorMatch = processedLine.match(/^\[!color:(\w+)\]\s*/);
      if (colorMatch) {
        colorClass = `jt-color-${colorMatch[1]}`;
        processedLine = processedLine.substring(colorMatch[0].length);
        isColored = true;
      }

      // Check for headings (now that blockquote/color are stripped)
      let headingLevel = 0;
      if (processedLine.startsWith('### ')) {
        headingLevel = 3;
        processedLine = processedLine.substring(4);
      } else if (processedLine.startsWith('## ')) {
        headingLevel = 2;
        processedLine = processedLine.substring(3);
      } else if (processedLine.startsWith('# ')) {
        headingLevel = 1;
        processedLine = processedLine.substring(2);
      }

      // Check for text alignment
      let alignment = '';
      if (processedLine.startsWith('---: ')) {
        alignment = 'right';
        processedLine = processedLine.substring(5);
      } else if (processedLine.startsWith('--: ')) {
        alignment = 'center';
        processedLine = processedLine.substring(4);
      }

      // Check for lists
      let isBulletList = false;
      let isNumberedList = false;
      let listValue = '';

      if (processedLine.startsWith('- ')) {
        processedLine = processedLine.substring(2);
        isBulletList = true;
      } else {
        const numberedMatch = processedLine.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          listValue = numberedMatch[1];
          processedLine = numberedMatch[2];
          isNumberedList = true;
        }
      }

      // Process inline formatting
      processedLine = processInlineFormatting(processedLine);

      // Build the HTML from inside out
      let result = processedLine;

      // Wrap in heading if needed
      if (headingLevel > 0) {
        result = `<h${headingLevel}>${result}</h${headingLevel}>`;
      }

      // Wrap in color if needed
      if (isColored) {
        result = `<span class="${colorClass}">${result}</span>`;
      }

      // Wrap in alignment if needed
      if (alignment) {
        result = `<div class="jt-align-${alignment}">${result}</div>`;
      }

      // Wrap in list item if needed
      if (isBulletList) {
        result = `<li>${result}</li>`;
      } else if (isNumberedList) {
        result = `<li value="${listValue}">${result}</li>`;
      }

      // Wrap in blockquote if needed
      if (isBlockQuote) {
        result = `<blockquote>${result}</blockquote>`;
      }

      return result;
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
    result = result.replace(/<\/(h[123]|blockquote|div|li|table|thead|tbody|tr|th|td)><br>/g, '</$1>');
    result = result.replace(/<br><(h[123]|blockquote|div|li|ul|ol|table|thead|tbody|tr|th|td)/g, '<$1');

    return result;
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActive,
    togglePreview: (textarea, button) => {
      if (!isActive) return;
      togglePreview(textarea, button);
    }
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.PreviewModeFeature = PreviewModeFeature;
}
