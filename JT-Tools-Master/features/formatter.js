/**
 * JobTread Text Formatter Feature Module
 * Add formatting toolbar to budget description fields
 *
 * Dependencies:
 * - formatter-modules/detection.js (FormatterDetection)
 * - formatter-modules/formats.js (FormatterFormats)
 * - formatter-modules/toolbar.js (FormatterToolbar)
 */

const FormatterFeature = (() => {
  // Module references
  const Detection = () => window.FormatterDetection || {};
  const Formats = () => window.FormatterFormats || {};
  const Toolbar = () => window.FormatterToolbar || {};

  // Local state (minimal - most moved to modules)
  let scrollTimeout = null;
  let observer = null;
  let isActive = false;
  let styleElement = null;

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

    try {
      // Inject CSS
      injectCSS();
      console.log('Formatter: CSS injected');

      // Initialize fields
      initializeFields();
      console.log('Formatter: Fields initialized');

      // Watch for budget textareas (with error handling)
      observer = new MutationObserver(() => {
        try {
          initializeFields();
        } catch (error) {
          console.error('Formatter: Error in MutationObserver callback:', error);
        }
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

      console.log('Formatter: Feature loaded successfully');
    } catch (error) {
      console.error('Formatter: Error during initialization:', error);
      isActive = false;
      throw error;
    }
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('Formatter: Not active, nothing to cleanup');
      return;
    }

    console.log('Formatter: Cleaning up...');
    isActive = false;

    // Remove toolbar if exists (using module)
    Toolbar().hideToolbar();

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

  // Initialize fields
  function initializeFields() {
    if (!isActive) return;

    // Skip if on excluded paths
    const path = window.location.pathname;
    if (path.includes('/files') || path.includes('/vendors') || path.includes('/customers') || path.includes('/settings')) {
      console.log('Formatter: Skipping excluded path:', path);
      return;
    }

    // Don't re-initialize while we're inserting text - prevents interference
    if (Formats().isInserting && Formats().isInserting()) {
      console.log('Formatter: Skipping initializeFields - text insertion in progress');
      return;
    }

    // Clean up stale references (using Toolbar module)
    const activeField = Toolbar().getActiveField();
    const activeToolbar = Toolbar().getActiveToolbar();
    if (activeField && !document.body.contains(activeField)) {
      Toolbar().setActiveField(null);
    }
    if (activeToolbar && !document.body.contains(activeToolbar)) {
      Toolbar().hideToolbar();
    }

    // Find all textareas that should have the formatter
    const fields = [];

    // 1. Budget Description fields
    const descriptionFields = document.querySelectorAll('textarea[placeholder="Description"]');
    fields.push(...descriptionFields);

    // 2. Message fields
    const messageFields = document.querySelectorAll('textarea[placeholder="Message"]');
    fields.push(...messageFields);

    // 3. ALL Daily Log fields, Todo descriptions, Task descriptions
    // (any textarea inside label with bold heading)
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

    // 4. Daily Log EDIT fields (textareas with transparent color and formatting overlay)
    const allTextareas = document.querySelectorAll('textarea');
    allTextareas.forEach(textarea => {
      if (!fields.includes(textarea)) {
        const hasTransparentColor = textarea.style.color === 'transparent';
        if (hasTransparentColor) {
          const parent = textarea.parentElement;
          if (parent) {
            // Look for a sibling div with pointer-events-none (the formatting overlay)
            const siblings = parent.querySelectorAll('div');
            for (const sibling of siblings) {
              const styles = window.getComputedStyle(sibling);
              if (styles.pointerEvents === 'none' && sibling !== textarea) {
                fields.push(textarea);
                break;
              }
            }
          }
        }
      }
    });

    // Filter out time entry notes fields, Time Clock notes fields, and subtask fields
    const filteredFields = fields.filter(field => {
      const placeholder = field.getAttribute('placeholder');
      if (placeholder === 'Set notes') {
        return false; // Exclude time entry notes
      }

      // Exclude subtask/checklist fields
      if (placeholder === 'Add an item...' || placeholder === 'Add an item') {
        return false;
      }

      // Check if textarea is inside a checklist/subtask container
      let ancestor = field.closest('div');
      for (let i = 0; i < 10 && ancestor; i++) {
        const heading = ancestor.querySelector(':scope > div > .font-bold');
        if (heading && heading.textContent.trim() === 'Checklist') {
          return false; // This is a subtask field
        }
        ancestor = ancestor.parentElement;
      }

      // Exclude subtask fields by small padding (p-1 without p-2)
      if (field.classList.contains('p-1') && !field.classList.contains('p-2') && field.style.color === 'transparent') {
        return false;
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

      // Extra guard: ensure no native formatter exists (using Detection module)
      return !Detection().hasNativeFormatter(field);
    });

    console.log('Formatter: Found', filteredFields.length, 'fields (Budget Description + Daily Log + Todo + Task + Edit)');

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

  // Event handlers (using modules)
  function handleFieldFocus(e, field) {
    Toolbar().clearHideTimeout();
    Toolbar().setActiveField(field);
    Toolbar().showToolbar(field);

    setTimeout(() => {
      const activeField = Toolbar().getActiveField();
      const activeToolbar = Toolbar().getActiveToolbar();
      if (activeField === field && activeToolbar) {
        Toolbar().positionToolbar(activeToolbar, field);
      }
    }, 50);
  }

  function handleFieldMousedown(e, field) {
    const activeField = Toolbar().getActiveField();
    if (activeField !== field) {
      Toolbar().clearHideTimeout();
      Toolbar().setActiveField(field);

      setTimeout(() => {
        if (Toolbar().getActiveField() === field) {
          Toolbar().showToolbar(field);
        }
      }, 10);
    }
  }

  function handleFieldBlur(e, field) {
    // Don't hide toolbar if we're prompting user
    if (Formats().isPrompting()) {
      console.log('Formatter: Skipping blur handler - user is being prompted');
      return;
    }

    Toolbar().scheduleHide(200);
  }

  function handleFieldInput(field) {
    const activeToolbar = Toolbar().getActiveToolbar();
    const activeField = Toolbar().getActiveField();
    if (activeToolbar && activeField === field) {
      Toolbar().positionToolbar(activeToolbar, field);
      Toolbar().updateToolbarState(field, activeToolbar);
    }
  }

  function handleFieldClick(field) {
    const activeToolbar = Toolbar().getActiveToolbar();
    const activeField = Toolbar().getActiveField();
    if (activeToolbar && activeField === field) {
      Toolbar().updateToolbarState(field, activeToolbar);
    }
  }

  function handleFieldKeyup(field) {
    const activeToolbar = Toolbar().getActiveToolbar();
    const activeField = Toolbar().getActiveField();
    if (activeToolbar && activeField === field) {
      Toolbar().updateToolbarState(field, activeToolbar);
    }
  }

  function handleScroll() {
    const activeToolbar = Toolbar().getActiveToolbar();
    const activeField = Toolbar().getActiveField();

    if (activeToolbar && !document.body.contains(activeToolbar)) {
      Toolbar().hideToolbar();
      return;
    }
    if (activeField && !document.body.contains(activeField)) {
      Toolbar().hideToolbar();
      return;
    }

    if (activeToolbar && activeField) {
      Toolbar().positionToolbar(activeToolbar, activeField);

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        const toolbar = Toolbar().getActiveToolbar();
        const field = Toolbar().getActiveField();
        if (toolbar && field &&
            document.body.contains(toolbar) &&
            document.body.contains(field)) {
          Toolbar().positionToolbar(toolbar, field);
          toolbar.style.display = 'flex';
          toolbar.style.visibility = 'visible';
        }
      }, 100);
    }
  }

  function handleResize() {
    const activeToolbar = Toolbar().getActiveToolbar();
    const activeField = Toolbar().getActiveField();

    if (activeToolbar && !document.body.contains(activeToolbar)) {
      Toolbar().hideToolbar();
      return;
    }
    if (activeField && !document.body.contains(activeField)) {
      Toolbar().hideToolbar();
      return;
    }

    if (activeToolbar && activeField) {
      Toolbar().positionToolbar(activeToolbar, activeField);
    }
  }

  function handleGlobalClick(e) {
    const clickedElement = e.target;

    // Don't hide if clicking on a formatter field or the toolbar
    if (Detection().isFormatterField(clickedElement) ||
        clickedElement.closest('.jt-formatter-toolbar')) {
      return;
    }

    const activeToolbar = Toolbar().getActiveToolbar();
    const activeField = Toolbar().getActiveField();
    if (activeToolbar && activeField) {
      Toolbar().hideToolbar();
    }
  }

  function handleKeydown(e) {
    const field = e.target;

    // Only apply to formatter fields (using Detection module)
    if (!Detection().isFormatterField(field)) return;

    // Handle Enter key for auto-numbering (using Formats module)
    if (e.key === 'Enter') {
      const handled = Formats().handleEnterKey(field, e);
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
      Formats().applyFormat(field, format);
      const activeToolbar = Toolbar().getActiveToolbar();
      if (activeToolbar) {
        Toolbar().updateToolbarState(field, activeToolbar);
      }
    }
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
