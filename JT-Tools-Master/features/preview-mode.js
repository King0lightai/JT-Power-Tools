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

    console.log('Preview Mode: Found', fields.length, 'fields');

    fields.forEach((field) => {
      if (!field.dataset.previewModeReady && document.body.contains(field)) {
        field.dataset.previewModeReady = 'true';
        addPreviewButton(field);
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

    // Apply theme to button
    detectAndApplyTheme(button);

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePreview(textarea, button);
    });

    // Store reference
    buttonMap.set(textarea, button);

    // Insert button into the container
    container.style.position = 'relative';
    container.appendChild(button);

    console.log('Premium Formatter: Preview button added');
  }

  // Toggle preview panel
  function togglePreview(textarea, button) {
    // If this preview is already open, close it
    if (activePreview && previewMap.get(textarea) === activePreview) {
      closePreview();
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

    // Mark button as active
    button.classList.add('active');

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
      }

      activePreview.classList.remove('show');
      setTimeout(() => {
        if (activePreview && activePreview.parentNode) {
          activePreview.remove();
        }
      }, 200);
    }

    if (activeButton) {
      activeButton.classList.remove('active');
    }

    activePreview = null;
    activeButton = null;
  }

  // Handle global clicks to close preview
  function handleGlobalClick(e) {
    if (!activePreview) return;

    // Don't close if clicking inside the preview or the button
    if (e.target.closest('.jt-preview-panel') ||
        e.target.closest('.jt-preview-btn')) {
      return;
    }

    closePreview();
  }

  // Convert markdown to HTML for preview
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

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.PreviewModeFeature = PreviewModeFeature;
}
