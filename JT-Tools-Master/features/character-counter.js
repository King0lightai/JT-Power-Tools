// JT Power Tools - Character Counter Feature
// Shows character countdown on text fields to prevent hitting limits
// Includes message signature functionality

const CharacterCounterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let debounceTimer = null;
  let cachedSignature = '';
  const processedFields = new WeakSet();
  const fieldToContainerMap = new WeakMap();

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

    /* Position counter for message dialogs - in toolbar next to writing assistant */
    .jt-char-counter-message {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      color: #6b7280;
      padding: 4px 8px;
      margin-left: 8px;
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
      color: #9ca3af;
    }

    /* Counter wrapper to keep it aligned */
    .jt-char-counter-wrapper {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }

    /* Signature container - wraps counter and signature buttons */
    .jt-signature-container {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 6px;
      border: 1px solid rgba(128, 128, 128, 0.25);
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.02);
      margin-left: auto;
      flex-shrink: 0;
    }

    /* When in sidebar (narrower container), stack vertically */
    .jt-signature-container-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 100%;
      margin-top: 8px;
    }

    .jt-signature-container-row .jt-signature-container {
      margin-left: 0;
    }

    .jt-dark-mode .jt-signature-container,
    #jt-dark-mode-styles ~ * .jt-signature-container {
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.05);
    }

    /* Signature buttons */
    .jt-signature-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 3px;
      font-size: 11px;
      color: #6b7280;
      transition: background-color 0.15s ease, color 0.15s ease;
      white-space: nowrap;
    }

    .jt-signature-btn:hover {
      background: rgba(0, 0, 0, 0.08);
      color: #374151;
    }

    .jt-signature-btn:active {
      background: rgba(0, 0, 0, 0.12);
    }

    .jt-dark-mode .jt-signature-btn,
    #jt-dark-mode-styles ~ * .jt-signature-btn {
      color: #9ca3af;
    }

    .jt-dark-mode .jt-signature-btn:hover,
    #jt-dark-mode-styles ~ * .jt-signature-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #d1d5db;
    }

    .jt-signature-btn-icon {
      font-size: 12px;
    }

    /* Separator between buttons and counter */
    .jt-signature-separator {
      width: 1px;
      height: 16px;
      background: rgba(128, 128, 128, 0.3);
      margin: 0 2px;
    }

    .jt-dark-mode .jt-signature-separator,
    #jt-dark-mode-styles ~ * .jt-signature-separator {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Modal overlay */
    .jt-signature-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: jt-sig-fade-in 0.15s ease;
    }

    @keyframes jt-sig-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Modal container */
    .jt-signature-modal {
      background: white;
      border-radius: 8px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      width: 90%;
      max-width: 450px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      animation: jt-sig-slide-up 0.2s ease;
    }

    @keyframes jt-sig-slide-up {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .jt-dark-mode .jt-signature-modal,
    #jt-dark-mode-styles ~ * .jt-signature-modal {
      background: #1f2937;
      color: #f3f4f6;
    }

    /* Modal header */
    .jt-signature-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .jt-dark-mode .jt-signature-modal-header,
    #jt-dark-mode-styles ~ * .jt-signature-modal-header {
      border-color: #374151;
    }

    .jt-signature-modal-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .jt-dark-mode .jt-signature-modal-title,
    #jt-dark-mode-styles ~ * .jt-signature-modal-title {
      color: #f3f4f6;
    }

    .jt-signature-modal-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #6b7280;
      font-size: 20px;
      line-height: 1;
      border-radius: 4px;
      transition: background-color 0.15s ease;
    }

    .jt-signature-modal-close:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #374151;
    }

    .jt-dark-mode .jt-signature-modal-close:hover,
    #jt-dark-mode-styles ~ * .jt-signature-modal-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #d1d5db;
    }

    /* Modal body */
    .jt-signature-modal-body {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }

    .jt-signature-modal-description {
      font-size: 13px;
      color: #6b7280;
      margin: 0 0 12px 0;
    }

    .jt-dark-mode .jt-signature-modal-description,
    #jt-dark-mode-styles ~ * .jt-signature-modal-description {
      color: #9ca3af;
    }

    .jt-signature-textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .jt-signature-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .jt-dark-mode .jt-signature-textarea,
    #jt-dark-mode-styles ~ * .jt-signature-textarea {
      background: #111827;
      border-color: #4b5563;
      color: #f3f4f6;
    }

    .jt-dark-mode .jt-signature-textarea:focus,
    #jt-dark-mode-styles ~ * .jt-signature-textarea:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
    }

    /* Modal footer */
    .jt-signature-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid #e5e7eb;
    }

    .jt-dark-mode .jt-signature-modal-footer,
    #jt-dark-mode-styles ~ * .jt-signature-modal-footer {
      border-color: #374151;
    }

    .jt-signature-modal-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.1s ease;
    }

    .jt-signature-modal-btn:active {
      transform: scale(0.98);
    }

    .jt-signature-modal-btn-cancel {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      color: #374151;
    }

    .jt-signature-modal-btn-cancel:hover {
      background: #e5e7eb;
    }

    .jt-dark-mode .jt-signature-modal-btn-cancel,
    #jt-dark-mode-styles ~ * .jt-signature-modal-btn-cancel {
      background: #374151;
      border-color: #4b5563;
      color: #f3f4f6;
    }

    .jt-dark-mode .jt-signature-modal-btn-cancel:hover,
    #jt-dark-mode-styles ~ * .jt-signature-modal-btn-cancel:hover {
      background: #4b5563;
    }

    .jt-signature-modal-btn-save {
      background: #3b82f6;
      border: none;
      color: white;
    }

    .jt-signature-modal-btn-save:hover {
      background: #2563eb;
    }

    .jt-signature-modal-btn-save:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
  }

  /**
   * Remove injected styles
   */
  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }
  }

  /**
   * Load signature from Chrome storage
   * @returns {Promise<string>}
   */
  async function loadSignature() {
    try {
      const result = await chrome.storage.sync.get('messageSignature');
      cachedSignature = result.messageSignature || '';
      return cachedSignature;
    } catch (error) {
      console.error('CharacterCounter: Failed to load signature', error);
      return '';
    }
  }

  /**
   * Save signature to Chrome storage
   * @param {string} text - The signature text
   * @returns {Promise<void>}
   */
  async function saveSignature(text) {
    try {
      cachedSignature = text;
      await chrome.storage.sync.set({ messageSignature: text });
      console.log('CharacterCounter: Signature saved');
    } catch (error) {
      console.error('CharacterCounter: Failed to save signature', error);
    }
  }

  /**
   * Open the signature editor modal
   * @param {string} currentSignature - Current signature text
   * @returns {Promise<string|null>} - New signature text or null if cancelled
   */
  function openSignatureModal(currentSignature) {
    return new Promise((resolve) => {
      const abortController = new AbortController();
      const { signal } = abortController;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'jt-signature-modal-overlay';

      // Create modal
      const modal = document.createElement('div');
      modal.className = 'jt-signature-modal';

      // Header
      const header = document.createElement('div');
      header.className = 'jt-signature-modal-header';

      const title = document.createElement('h3');
      title.className = 'jt-signature-modal-title';
      title.textContent = 'Message Signature';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'jt-signature-modal-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close');

      header.appendChild(title);
      header.appendChild(closeBtn);

      // Body
      const body = document.createElement('div');
      body.className = 'jt-signature-modal-body';

      const description = document.createElement('p');
      description.className = 'jt-signature-modal-description';
      description.textContent = 'Create a signature to quickly insert into your messages. This will be saved and synced across your devices.';

      const textarea = document.createElement('textarea');
      textarea.className = 'jt-signature-textarea';
      textarea.placeholder = 'Enter your signature here...\n\nExample:\n--\nBest regards,\nJohn Smith\nProject Manager';
      textarea.value = currentSignature;

      body.appendChild(description);
      body.appendChild(textarea);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'jt-signature-modal-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'jt-signature-modal-btn jt-signature-modal-btn-cancel';
      cancelBtn.textContent = 'Cancel';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'jt-signature-modal-btn jt-signature-modal-btn-save';
      saveBtn.textContent = 'Save Signature';

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);

      // Close function
      function closeModal(result) {
        abortController.abort();
        overlay.remove();
        resolve(result);
      }

      // Event listeners
      closeBtn.addEventListener('click', () => closeModal(null), { signal });
      cancelBtn.addEventListener('click', () => closeModal(null), { signal });
      saveBtn.addEventListener('click', () => closeModal(textarea.value), { signal });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(null);
        }
      }, { signal });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeModal(null);
        }
      }, { signal });

      // Submit on Ctrl+Enter
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          closeModal(textarea.value);
        }
      }, { signal });

      // Add to page
      document.body.appendChild(overlay);

      // Focus textarea
      setTimeout(() => textarea.focus(), 50);
    });
  }

  /**
   * Insert signature into a message field
   * @param {HTMLTextAreaElement} field - The textarea element
   * @param {string} signature - The signature text
   */
  function insertSignature(field, signature) {
    if (!field || !signature) return;

    // Get current cursor position
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const currentValue = field.value;

    // Add newlines before signature if there's existing content and no trailing newlines
    let prefix = '';
    if (currentValue.length > 0 && start === currentValue.length) {
      // Cursor at end - add line breaks before signature
      if (!currentValue.endsWith('\n\n')) {
        prefix = currentValue.endsWith('\n') ? '\n' : '\n\n';
      }
    }

    // Insert at cursor position
    const newValue = currentValue.slice(0, start) + prefix + signature + currentValue.slice(end);
    field.value = newValue;

    // Move cursor to end of inserted signature
    const newPosition = start + prefix.length + signature.length;
    field.setSelectionRange(newPosition, newPosition);

    // Trigger React-compatible events
    const inputEvent = new Event('input', { bubbles: true });
    inputEvent.simulated = true;
    field.dispatchEvent(inputEvent);

    const changeEvent = new Event('change', { bubbles: true });
    changeEvent.simulated = true;
    field.dispatchEvent(changeEvent);

    // Focus the field
    field.focus();
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

    // Only show counter on message textareas
    if (!isMessageTextarea(field)) {
      return;
    }

    const maxLength = getFieldLimit(field);
    const isMessage = true; // Always true now since we only process messages

    // Create signature container (wraps buttons and counter)
    const container = document.createElement('div');
    container.className = 'jt-signature-container';

    // Create Edit Signature button
    const editBtn = document.createElement('button');
    editBtn.className = 'jt-signature-btn';
    editBtn.type = 'button';
    editBtn.innerHTML = '<span class="jt-signature-btn-icon">&#9998;</span> Signature';
    editBtn.title = 'Edit message signature';

    // Create Insert button
    const insertBtn = document.createElement('button');
    insertBtn.className = 'jt-signature-btn';
    insertBtn.type = 'button';
    insertBtn.innerHTML = '<span class="jt-signature-btn-icon">&#8629;</span> Insert';
    insertBtn.title = 'Insert signature into message';

    // Create separator
    const separator = document.createElement('div');
    separator.className = 'jt-signature-separator';

    // Create counter element
    const counter = document.createElement('div');
    counter.className = 'jt-char-counter safe jt-char-counter-message';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    counter.style.margin = '0'; // Remove margin since it's in container

    // Assemble container
    container.appendChild(editBtn);
    container.appendChild(insertBtn);
    container.appendChild(separator);
    container.appendChild(counter);

    // Store reference to container for this field
    fieldToContainerMap.set(field, container);

    // Handle Edit button click
    editBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const currentSignature = cachedSignature || await loadSignature();
      const newSignature = await openSignatureModal(currentSignature);

      if (newSignature !== null) {
        await saveSignature(newSignature);
      }
    });

    // Handle Insert button click
    insertBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const signature = cachedSignature || await loadSignature();

      if (!signature) {
        // No signature saved - open modal to create one
        const newSignature = await openSignatureModal('');
        if (newSignature !== null && newSignature.trim()) {
          await saveSignature(newSignature);
          insertSignature(field, newSignature);
        }
      } else {
        insertSignature(field, signature);
      }

      // Update counter after inserting
      updateCounter();
    });

    /**
     * Update the counter display
     */
    function updateCounter() {
      const currentLength = field.value.length;
      const remaining = maxLength - currentLength;

      // Update text
      if (remaining < 0) {
        counter.textContent = `${Math.abs(remaining)} over limit`;
        counter.className = 'jt-char-counter over-limit jt-char-counter-message';
      } else if (remaining === 0) {
        counter.textContent = 'Limit reached';
        counter.className = 'jt-char-counter danger jt-char-counter-message';
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
        counter.className = 'jt-char-counter ' + colorClass + ' jt-char-counter-message';
      }
      counter.style.margin = '0'; // Keep margin reset
    }

    // Attach event listeners
    field.addEventListener('input', updateCounter);
    field.addEventListener('keyup', updateCounter);
    field.addEventListener('paste', () => setTimeout(updateCounter, 0));

    // Show/hide counter on focus/blur (except for message dialogs which are always visible)
    if (!isMessage) {
      // Track focus state
      let isFocused = false;
      let hideTimeout = null;

      const showCounter = () => {
        isFocused = true;
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        counter.classList.add('visible');
      };

      const hideCounter = () => {
        isFocused = false;
        // Longer delay to handle JobTread's UI interactions
        hideTimeout = setTimeout(() => {
          if (!isFocused) {
            counter.classList.remove('visible');
          }
        }, 300);
      };

      field.addEventListener('focus', showCounter);
      field.addEventListener('blur', hideCounter);
      // Also show on click in case focus event doesn't fire properly
      field.addEventListener('click', showCounter);
      // Keep visible while typing
      field.addEventListener('input', showCounter);
    }

    // Find the best insertion point for the container (replaces counter-only insertion)
    const parent = field.parentElement;
    if (parent) {
      if (isMessage) {
        // For message textareas, find the toolbar below the textarea
        // Structure: div.flex.justify-between containing buttons and Send button
        // We want to insert the container next to the writing assistant buttons
        const dialog = field.closest('.shadow-lg, [role="dialog"], .modal, form');
        let toolbar = null;

        // Detect if we're in a sidebar (narrower container)
        const isSidebar = field.closest('.space-y-2, .space-y-3') !== null &&
                          !field.closest('[role="dialog"]');

        if (dialog) {
          // Find the toolbar with Send button - it's a div.flex.justify-between
          const toolbars = dialog.querySelectorAll('div.flex.justify-between');
          for (const t of toolbars) {
            // Look for the one with a Send button
            const sendButton = t.querySelector('button[type="submit"]') ||
                               Array.from(t.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send');
            if (sendButton) {
              toolbar = t;
              break;
            }
          }
        }

        if (toolbar) {
          if (isSidebar) {
            // In sidebar: add container as a new row below the toolbar
            const containerRow = document.createElement('div');
            containerRow.className = 'jt-signature-container-row';
            containerRow.appendChild(container);
            toolbar.parentElement.insertBefore(containerRow, toolbar.nextSibling);
          } else {
            // In dialog/modal: add inline with the toolbar buttons
            const leftSide = toolbar.querySelector('div.flex.gap-1');
            if (leftSide) {
              // Insert signature container after the left side buttons
              leftSide.appendChild(container);
            } else {
              // Fallback: insert as second child of toolbar (between left and right)
              const rightSide = toolbar.querySelector('div.shrink-0');
              if (rightSide) {
                toolbar.insertBefore(container, rightSide);
              } else {
                toolbar.appendChild(container);
              }
            }
          }
        } else {
          // Fallback: add after the textarea's container
          const textareaContainer = field.closest('.border.rounded-b-sm') || parent;
          textareaContainer.parentElement?.appendChild(container);
        }
      } else {
        // Standard positioning: after the field
        if (field.nextSibling) {
          parent.insertBefore(container, field.nextSibling);
        } else {
          parent.appendChild(container);
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
      // Remove the entire container (which includes buttons, separator, and counter)
      container.remove();
    };

    // If field is already focused, show the counter immediately
    if (document.activeElement === field && !isMessage) {
      counter.classList.add('visible');
    }
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
  async function init() {
    if (isActiveState) return;

    isActiveState = true;
    console.log('CharacterCounter: Activated');

    // Inject styles
    injectStyles();

    // Load signature from storage
    await loadSignature();

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
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActiveState) return;

    isActiveState = false;
    console.log('CharacterCounter: Deactivated');

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

    // Remove any open signature modals
    document.querySelectorAll('.jt-signature-modal-overlay').forEach(modal => {
      modal.remove();
    });

    // Remove all signature container rows (for sidebar layout)
    document.querySelectorAll('.jt-signature-container-row').forEach(row => {
      row.remove();
    });

    // Remove all signature containers (which include counters)
    document.querySelectorAll('.jt-signature-container').forEach(container => {
      container.remove();
    });

    // Remove any standalone counters (fallback)
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

    // Clear cached signature
    cachedSignature = '';

    // Remove styles
    removeStyles();
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
