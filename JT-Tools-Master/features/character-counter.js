// JT Power Tools - Character Counter Feature
// Shows character countdown on text fields to prevent hitting limits

const CharacterCounterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let debounceTimer = null;
  const processedFields = new WeakSet();

  // Default character limits for different field types
  // These may need adjustment based on actual JobTread limits
  const FIELD_LIMITS = {
    // Notes and description fields
    'notes': 5000,
    'note': 5000,
    'description': 5000,
    'details': 5000,
    'comment': 2000,
    'comments': 2000,
    'message': 2000,
    // Shorter fields
    'name': 255,
    'title': 255,
    'subject': 255,
    'address': 500,
    'email': 255,
    'phone': 50,
    // Default for unknown fields
    'default': 2000
  };

  // CSS for counter styling
  const COUNTER_STYLES = `
    .jt-char-counter {
      font-size: 11px;
      text-align: right;
      margin-top: 4px;
      padding-right: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: color 0.2s ease;
    }

    .jt-char-counter.safe {
      color: #6b7280;
    }

    .jt-char-counter.warning {
      color: #f59e0b;
      font-weight: 500;
    }

    .jt-char-counter.danger {
      color: #ef4444;
      font-weight: 600;
    }

    .jt-char-counter.over-limit {
      color: #dc2626;
      font-weight: 700;
    }

    /* Dark mode compatibility */
    .jt-dark-mode .jt-char-counter.safe,
    [data-theme="dark"] .jt-char-counter.safe {
      color: #9ca3af;
    }

    /* Counter wrapper to keep it aligned */
    .jt-char-counter-wrapper {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }
  `;

  let styleElement = null;

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = 'jt-char-counter-styles';
    styleElement.textContent = COUNTER_STYLES;
    document.head.appendChild(styleElement);
    console.log('CharCounter: Styles injected');
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
      console.log('CharCounter: Styles removed');
    }
  }

  /**
   * Determine the character limit for a field
   * @param {HTMLElement} field - The textarea or input element
   * @returns {number} The character limit
   */
  function getFieldLimit(field) {
    // First, check for explicit maxlength attribute
    const maxLength = field.getAttribute('maxlength');
    if (maxLength) {
      return parseInt(maxLength, 10);
    }

    // Check for data attribute
    const dataLimit = field.getAttribute('data-char-limit');
    if (dataLimit) {
      return parseInt(dataLimit, 10);
    }

    // Try to infer from field name, id, placeholder, or aria-label
    const identifiers = [
      field.name,
      field.id,
      field.placeholder,
      field.getAttribute('aria-label'),
      field.getAttribute('data-field'),
      field.getAttribute('data-testid')
    ].filter(Boolean).map(s => s.toLowerCase());

    // Check each identifier against known field types
    for (const identifier of identifiers) {
      for (const [fieldType, limit] of Object.entries(FIELD_LIMITS)) {
        if (fieldType !== 'default' && identifier.includes(fieldType)) {
          return limit;
        }
      }
    }

    // Check parent labels for hints
    const label = field.closest('label') ||
                  document.querySelector(`label[for="${field.id}"]`);
    if (label) {
      const labelText = label.textContent.toLowerCase();
      for (const [fieldType, limit] of Object.entries(FIELD_LIMITS)) {
        if (fieldType !== 'default' && labelText.includes(fieldType)) {
          return limit;
        }
      }
    }

    // Return default limit
    return FIELD_LIMITS.default;
  }

  /**
   * Create and attach a counter to a field
   * @param {HTMLElement} field - The textarea or input element
   */
  function attachCounter(field) {
    // Skip if already processed
    if (processedFields.has(field)) return;

    // Skip if it's a search field, password field, or hidden
    if (field.type === 'password' ||
        field.type === 'hidden' ||
        field.type === 'search' ||
        field.getAttribute('role') === 'search' ||
        field.classList.contains('jt-search-input')) {
      return;
    }

    // Skip very short input fields (likely not for text content)
    if (field.tagName === 'INPUT' &&
        !['text', 'email', 'url', 'tel'].includes(field.type)) {
      return;
    }

    const maxLength = getFieldLimit(field);

    // Create counter element
    const counter = document.createElement('div');
    counter.className = 'jt-char-counter safe';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');

    /**
     * Update the counter display
     */
    function updateCounter() {
      const currentLength = field.value.length;
      const remaining = maxLength - currentLength;

      // Update text
      if (remaining < 0) {
        counter.textContent = `${Math.abs(remaining)} characters over limit`;
        counter.className = 'jt-char-counter over-limit';
      } else if (remaining === 0) {
        counter.textContent = 'Character limit reached';
        counter.className = 'jt-char-counter danger';
      } else {
        counter.textContent = `${remaining.toLocaleString()} / ${maxLength.toLocaleString()} characters remaining`;

        // Color coding based on remaining percentage
        const percentRemaining = (remaining / maxLength) * 100;
        if (percentRemaining <= 5) {
          counter.className = 'jt-char-counter danger';
        } else if (percentRemaining <= 15) {
          counter.className = 'jt-char-counter warning';
        } else {
          counter.className = 'jt-char-counter safe';
        }
      }
    }

    // Attach event listeners
    field.addEventListener('input', updateCounter);
    field.addEventListener('keyup', updateCounter);
    field.addEventListener('paste', () => setTimeout(updateCounter, 0));

    // Insert counter after the field
    // Try to find the best insertion point
    const parent = field.parentElement;
    if (parent) {
      // Check if there's already a wrapper we should use
      const existingWrapper = parent.querySelector('.jt-char-counter-wrapper');
      if (existingWrapper) {
        existingWrapper.appendChild(counter);
      } else {
        // Insert after the field
        if (field.nextSibling) {
          parent.insertBefore(counter, field.nextSibling);
        } else {
          parent.appendChild(counter);
        }
      }
    }

    // Mark as processed
    processedFields.add(field);

    // Initial update
    updateCounter();

    // Store cleanup function on the element
    field._jtCounterCleanup = () => {
      field.removeEventListener('input', updateCounter);
      field.removeEventListener('keyup', updateCounter);
      field.removeEventListener('paste', updateCounter);
      counter.remove();
    };

    console.log('CharCounter: Counter attached to field:', field.name || field.id || 'unnamed');
  }

  /**
   * Find and process all text fields on the page
   */
  function processAllFields() {
    // Find all textareas
    const textareas = document.querySelectorAll('textarea:not([data-jt-no-counter])');
    textareas.forEach(attachCounter);

    // Find text inputs that might benefit from a counter
    const textInputs = document.querySelectorAll(
      'input[type="text"]:not([data-jt-no-counter]), ' +
      'input:not([type]):not([data-jt-no-counter])'
    );

    textInputs.forEach(input => {
      // Only attach to inputs that seem like they could have substantial text
      // Skip search boxes, short fields, etc.
      const placeholder = (input.placeholder || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();

      const isLikelyTextContent =
        placeholder.includes('note') ||
        placeholder.includes('description') ||
        placeholder.includes('comment') ||
        placeholder.includes('message') ||
        name.includes('note') ||
        name.includes('description') ||
        name.includes('comment') ||
        id.includes('note') ||
        id.includes('description') ||
        id.includes('comment') ||
        input.classList.contains('description') ||
        input.classList.contains('notes');

      if (isLikelyTextContent) {
        attachCounter(input);
      }
    });
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActiveState) {
      console.log('CharCounter: Already initialized');
      return;
    }

    console.log('CharCounter: Initializing...');
    isActiveState = true;

    // Inject styles
    injectStyles();

    // Process existing fields
    processAllFields();

    // Watch for new fields being added
    observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node contains textareas or inputs
              if (node.tagName === 'TEXTAREA' ||
                  node.tagName === 'INPUT' ||
                  (node.querySelector && (
                    node.querySelector('textarea') ||
                    node.querySelector('input[type="text"]')
                  ))) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (shouldProcess) break;
      }

      if (shouldProcess) {
        // Debounce processing
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          processAllFields();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('CharCounter: Feature loaded');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) {
      console.log('CharCounter: Not active, nothing to cleanup');
      return;
    }

    console.log('CharCounter: Cleaning up...');
    isActiveState = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Remove all counters
    document.querySelectorAll('.jt-char-counter').forEach(counter => {
      counter.remove();
    });

    // Clean up event listeners from processed fields
    document.querySelectorAll('textarea, input').forEach(field => {
      if (field._jtCounterCleanup) {
        field._jtCounterCleanup();
        delete field._jtCounterCleanup;
      }
    });

    // Remove styles
    removeStyles();

    console.log('CharCounter: Cleanup complete');
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActiveState,
    // Expose for potential customization
    setFieldLimit: (fieldName, limit) => {
      FIELD_LIMITS[fieldName.toLowerCase()] = limit;
    }
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.CharacterCounterFeature = CharacterCounterFeature;
}
