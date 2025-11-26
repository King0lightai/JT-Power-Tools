// JT Power Tools - Character Counter Feature
// Shows character countdown on text fields to prevent hitting limits

const CharacterCounterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let debounceTimer = null;
  const processedFields = new WeakSet();

  // Character limits for JobTread fields
  // Comments and messages have a 4096 character limit
  const FIELD_LIMITS = {
    // Message and comment fields - 4096 limit
    'message': 4096,
    'comment': 4096,
    'comments': 4096,
    // Notes and description fields
    'notes': 5000,
    'note': 5000,
    'description': 5000,
    'details': 5000,
    // Shorter fields
    'name': 255,
    'title': 255,
    'subject': 255,
    'address': 500,
    'email': 255,
    'phone': 50,
    // Default for unknown textareas
    'default': 4096
  };

  // CSS for counter styling
  const COUNTER_STYLES = `
    .jt-char-counter {
      font-size: 11px;
      text-align: right;
      margin-top: 4px;
      padding-right: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: color 0.2s ease, opacity 0.2s ease;
      pointer-events: none;
      opacity: 0;
      height: 0;
      overflow: hidden;
    }

    /* Show counter when textarea is focused */
    .jt-char-counter.visible {
      opacity: 1;
      height: auto;
      overflow: visible;
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

    /* Position counter for message dialogs - always visible */
    .jt-char-counter-message {
      position: absolute;
      bottom: 2px;
      right: 8px;
      background: rgba(255, 255, 255, 0.9);
      padding: 2px 6px;
      border-radius: 3px;
      z-index: 10;
      opacity: 1;
      height: auto;
      overflow: visible;
    }

    /* Dark mode compatibility */
    .jt-dark-mode .jt-char-counter.safe,
    #jt-dark-mode-styles ~ * .jt-char-counter.safe,
    [data-theme="dark"] .jt-char-counter.safe {
      color: #9ca3af;
    }

    .jt-dark-mode .jt-char-counter-message,
    #jt-dark-mode-styles ~ * .jt-char-counter-message {
      background: rgba(31, 41, 55, 0.9);
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
   * Check if this is a message textarea (Direct Message, Customer Message, etc.)
   * @param {HTMLElement} field - The textarea element
   * @returns {boolean}
   */
  function isMessageTextarea(field) {
    // Check placeholder
    const placeholder = (field.placeholder || '').toLowerCase();
    if (placeholder === 'message') return true;

    // Check if inside a message dialog (has "Message" in header)
    const dialog = field.closest('.shadow-lg, [role="dialog"], .modal');
    if (dialog) {
      const header = dialog.querySelector('.font-bold, h1, h2, h3');
      if (header && header.textContent.toLowerCase().includes('message')) {
        return true;
      }
    }

    return false;
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

    // Check if this is a message textarea - 4096 limit
    if (isMessageTextarea(field)) {
      return FIELD_LIMITS.message;
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

    // Return default limit for textareas
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

    // Skip inputs that are too short to need a counter
    if (field.tagName === 'INPUT') {
      const placeholder = (field.placeholder || '').toLowerCase();
      // Skip recipient/to fields, search fields
      if (placeholder === 'recipients' ||
          placeholder === 'search' ||
          placeholder === 'optional') {
        return;
      }
    }

    const maxLength = getFieldLimit(field);
    const isMessage = isMessageTextarea(field);

    // Create counter element
    const counter = document.createElement('div');
    counter.className = 'jt-char-counter safe' + (isMessage ? ' jt-char-counter-message' : '');
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
        counter.textContent = `${Math.abs(remaining)} over limit`;
        counter.className = 'jt-char-counter over-limit' + (isMessage ? ' jt-char-counter-message' : '');
      } else if (remaining === 0) {
        counter.textContent = 'Limit reached';
        counter.className = 'jt-char-counter danger' + (isMessage ? ' jt-char-counter-message' : '');
      } else {
        // Show compact format for messages
        counter.textContent = `${currentLength.toLocaleString()} / ${maxLength.toLocaleString()}`;

        // Color coding based on remaining percentage
        const percentRemaining = (remaining / maxLength) * 100;
        let colorClass = 'safe';
        if (percentRemaining <= 5) {
          colorClass = 'danger';
        } else if (percentRemaining <= 15) {
          colorClass = 'warning';
        }
        counter.className = 'jt-char-counter ' + colorClass + (isMessage ? ' jt-char-counter-message' : '');
      }
    }

    // Attach event listeners
    field.addEventListener('input', updateCounter);
    field.addEventListener('keyup', updateCounter);
    field.addEventListener('paste', () => setTimeout(updateCounter, 0));

    // Show/hide counter on focus/blur (except for message dialogs which are always visible)
    if (!isMessage) {
      field.addEventListener('focus', () => {
        counter.classList.add('visible');
      });
      field.addEventListener('blur', () => {
        // Small delay to allow clicking on counter area
        setTimeout(() => {
          if (document.activeElement !== field) {
            counter.classList.remove('visible');
          }
        }, 150);
      });
    }

    // Find the best insertion point for the counter
    const parent = field.parentElement;
    if (parent) {
      if (isMessage) {
        // For message textareas, position relative to the scrollable container
        // The textarea is inside: div.border.rounded-b-sm > div.space-y-1 > div.relative
        const scrollContainer = field.closest('.border.rounded-b-sm');
        if (scrollContainer) {
          scrollContainer.style.position = 'relative';
          scrollContainer.appendChild(counter);
        } else {
          // Fallback: add to parent
          parent.style.position = 'relative';
          parent.appendChild(counter);
        }
      } else {
        // Standard positioning: after the field
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
      // Focus/blur listeners are anonymous so they'll be garbage collected
      counter.remove();
    };

    // If field is already focused, show the counter immediately
    if (document.activeElement === field && !isMessage) {
      counter.classList.add('visible');
    }

    console.log('CharCounter: Counter attached to', isMessage ? 'message field' : (field.placeholder || field.name || 'field'), '- limit:', maxLength);
  }

  /**
   * Find and process all text fields on the page
   */
  function processAllFields() {
    // Find all textareas - these are the main target
    const textareas = document.querySelectorAll('textarea:not([data-jt-no-counter])');
    textareas.forEach(attachCounter);
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

    // Watch for new fields being added (dialogs opening, etc.)
    observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node contains textareas
              if (node.tagName === 'TEXTAREA' ||
                  (node.querySelector && node.querySelector('textarea'))) {
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
