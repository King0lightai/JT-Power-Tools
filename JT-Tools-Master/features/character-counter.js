// JT Power Tools - Character Counter Feature
// Shows character countdown on text fields to prevent hitting limits
// Includes message signature functionality

const CharacterCounterFeature = (() => {
  let isActiveState = false;
  let observer = null;
  let debounceTimer = null;
  let cachedTemplates = { templates: [], defaultTemplateId: null };
  const processedFields = new WeakSet();
  const fieldToContainerMap = new WeakMap();

  // Storage key for templates
  const TEMPLATES_STORAGE_KEY = 'messageTemplates';

  /**
   * Generate a unique ID for templates
   * @returns {string}
   */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

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
      position: relative;
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
      background: #252525;
      color: #e5e5e5;
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
      border-color: #404040;
    }

    .jt-signature-modal-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .jt-dark-mode .jt-signature-modal-title,
    #jt-dark-mode-styles ~ * .jt-signature-modal-title {
      color: #e5e5e5;
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
      background: #1a1a1a;
      border-color: #404040;
      color: #e5e5e5;
    }

    .jt-dark-mode .jt-signature-textarea:focus,
    #jt-dark-mode-styles ~ * .jt-signature-textarea:focus {
      border-color: #525252;
      box-shadow: 0 0 0 3px rgba(82, 82, 82, 0.3);
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
      border-color: #404040;
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
      background: #333333;
      border-color: #404040;
      color: #e5e5e5;
    }

    .jt-dark-mode .jt-signature-modal-btn-cancel:hover,
    #jt-dark-mode-styles ~ * .jt-signature-modal-btn-cancel:hover {
      background: #404040;
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

    /* Dropdown button */
    .jt-template-dropdown-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .jt-dropdown-arrow {
      font-size: 8px;
      opacity: 0.7;
    }

    /* Dropdown menu */
    .jt-template-dropdown {
      position: absolute;
      bottom: 100%;
      left: 0;
      margin-bottom: 4px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 220px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
    }

    .jt-template-dropdown-item {
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
    }

    .jt-template-dropdown-item:last-child {
      border-bottom: none;
    }

    .jt-template-dropdown-item:hover {
      background: #f9fafb;
    }

    .jt-template-dropdown-name {
      font-weight: 500;
      font-size: 13px;
      color: #111827;
    }

    .jt-template-dropdown-preview {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }

    .jt-template-dropdown-separator {
      height: 1px;
      background: #e5e7eb;
      margin: 4px 0;
    }

    .jt-template-dropdown-add {
      color: #3b82f6;
      font-weight: 500;
    }

    .jt-template-add-icon {
      margin-right: 4px;
    }

    /* Template manager list */
    .jt-template-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .jt-template-list-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fafafa;
    }

    .jt-template-list-item:hover {
      border-color: #d1d5db;
    }

    .jt-template-item-info {
      flex: 1;
      min-width: 0;
    }

    .jt-template-item-header {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .jt-template-star {
      color: #f59e0b;
    }

    .jt-template-item-name {
      font-weight: 500;
      font-size: 14px;
    }

    .jt-template-item-preview {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .jt-template-item-actions {
      display: flex;
      gap: 4px;
      margin-left: 12px;
      flex-shrink: 0;
    }

    .jt-template-action-btn {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.15s ease;
    }

    .jt-template-action-btn:hover {
      background: #f3f4f6;
    }

    .jt-template-action-delete:hover {
      background: #fee2e2;
      border-color: #fecaca;
    }

    /* Empty state */
    .jt-template-empty {
      text-align: center;
      padding: 32px 16px;
      color: #6b7280;
    }

    .jt-template-empty-hint {
      font-size: 12px;
      margin-top: 4px;
      color: #9ca3af;
    }

    /* Form elements */
    .jt-template-form-group {
      margin-bottom: 16px;
    }

    .jt-template-label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
      font-size: 13px;
      color: #374151;
    }

    .jt-template-name-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .jt-template-name-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .jt-template-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      cursor: pointer;
      color: #374151;
    }

    /* Dark mode - using dark grays (not blues) */
    .jt-dark-mode .jt-template-dropdown,
    #jt-dark-mode-styles ~ * .jt-template-dropdown {
      background: #252525;
      border-color: #404040;
    }

    .jt-dark-mode .jt-template-dropdown-item,
    #jt-dark-mode-styles ~ * .jt-template-dropdown-item {
      border-color: #333333;
    }

    .jt-dark-mode .jt-template-dropdown-item:hover,
    #jt-dark-mode-styles ~ * .jt-template-dropdown-item:hover {
      background: #333333;
    }

    .jt-dark-mode .jt-template-dropdown-name,
    #jt-dark-mode-styles ~ * .jt-template-dropdown-name {
      color: #e5e5e5;
    }

    .jt-dark-mode .jt-template-dropdown-preview,
    #jt-dark-mode-styles ~ * .jt-template-dropdown-preview {
      color: #a3a3a3;
    }

    .jt-dark-mode .jt-template-dropdown-separator,
    #jt-dark-mode-styles ~ * .jt-template-dropdown-separator {
      background: #404040;
    }

    .jt-dark-mode .jt-template-list-item,
    #jt-dark-mode-styles ~ * .jt-template-list-item {
      background: #1a1a1a;
      border-color: #404040;
    }

    .jt-dark-mode .jt-template-list-item:hover,
    #jt-dark-mode-styles ~ * .jt-template-list-item:hover {
      border-color: #525252;
    }

    .jt-dark-mode .jt-template-item-name,
    #jt-dark-mode-styles ~ * .jt-template-item-name {
      color: #e5e5e5;
    }

    .jt-dark-mode .jt-template-item-preview,
    #jt-dark-mode-styles ~ * .jt-template-item-preview {
      color: #a3a3a3;
    }

    .jt-dark-mode .jt-template-name-input,
    #jt-dark-mode-styles ~ * .jt-template-name-input {
      background: #1a1a1a;
      border-color: #404040;
      color: #e5e5e5;
    }

    .jt-dark-mode .jt-template-name-input:focus,
    #jt-dark-mode-styles ~ * .jt-template-name-input:focus {
      border-color: #525252;
      box-shadow: 0 0 0 3px rgba(82, 82, 82, 0.3);
    }

    .jt-dark-mode .jt-template-label,
    .jt-dark-mode .jt-template-checkbox-label,
    #jt-dark-mode-styles ~ * .jt-template-label,
    #jt-dark-mode-styles ~ * .jt-template-checkbox-label {
      color: #d4d4d4;
    }

    .jt-dark-mode .jt-template-action-btn,
    #jt-dark-mode-styles ~ * .jt-template-action-btn {
      background: #2a2a2a;
      border-color: #404040;
      color: #d4d4d4;
    }

    .jt-dark-mode .jt-template-action-btn:hover,
    #jt-dark-mode-styles ~ * .jt-template-action-btn:hover {
      background: #333333;
    }

    .jt-dark-mode .jt-template-action-delete:hover,
    #jt-dark-mode-styles ~ * .jt-template-action-delete:hover {
      background: #3d1f1f;
      border-color: #5c2929;
    }

    .jt-dark-mode .jt-template-empty,
    #jt-dark-mode-styles ~ * .jt-template-empty {
      color: #a3a3a3;
    }

    .jt-dark-mode .jt-template-empty-hint,
    #jt-dark-mode-styles ~ * .jt-template-empty-hint {
      color: #737373;
    }

    /* ===========================================
       RGB THEME (Custom Theme) Support
       Uses CSS custom properties from rgb-theme.js
       Body has .jt-custom-theme class when active
       =========================================== */

    /* Signature Container - RGB Theme */
    .jt-custom-theme .jt-signature-container {
      border-color: var(--jt-theme-border, rgba(128, 128, 128, 0.25));
      background: var(--jt-theme-background-subtle, rgba(0, 0, 0, 0.02));
    }

    .jt-custom-theme .jt-signature-btn {
      background: var(--jt-theme-background, #ffffff);
      border-color: var(--jt-theme-border, #e5e7eb);
      color: var(--jt-theme-text, #374151);
    }

    .jt-custom-theme .jt-signature-btn:hover {
      background: var(--jt-theme-background-muted, #f3f4f6);
      border-color: var(--jt-theme-border-strong, #d1d5db);
    }

    .jt-custom-theme .jt-signature-separator {
      background: var(--jt-theme-border, #e5e7eb);
    }

    /* Signature/Template Modal - RGB Theme */
    .jt-custom-theme .jt-signature-modal {
      background: var(--jt-theme-background-elevated, #ffffff);
      color: var(--jt-theme-text, #1f2937);
    }

    .jt-custom-theme .jt-signature-modal-header {
      border-color: var(--jt-theme-border, #e5e7eb);
    }

    .jt-custom-theme .jt-signature-modal-title {
      color: var(--jt-theme-text, #111827);
    }

    .jt-custom-theme .jt-signature-modal-close {
      color: var(--jt-theme-text-secondary, #6b7280);
    }

    .jt-custom-theme .jt-signature-modal-close:hover {
      color: var(--jt-theme-text, #111827);
      background: var(--jt-theme-background-muted, #f3f4f6);
    }

    .jt-custom-theme .jt-signature-modal-description {
      color: var(--jt-theme-text-secondary, #6b7280);
    }

    .jt-custom-theme .jt-signature-textarea {
      background: var(--jt-theme-background, #ffffff);
      border-color: var(--jt-theme-border, #d1d5db);
      color: var(--jt-theme-text, #1f2937);
    }

    .jt-custom-theme .jt-signature-textarea:focus {
      border-color: var(--jt-theme-primary, #3b82f6);
    }

    .jt-custom-theme .jt-signature-modal-footer {
      border-color: var(--jt-theme-border, #e5e7eb);
    }

    .jt-custom-theme .jt-signature-modal-btn-cancel {
      background: var(--jt-theme-background, #ffffff);
      border-color: var(--jt-theme-border, #d1d5db);
      color: var(--jt-theme-text, #374151);
    }

    .jt-custom-theme .jt-signature-modal-btn-cancel:hover {
      background: var(--jt-theme-background-muted, #f3f4f6);
    }

    .jt-custom-theme .jt-signature-modal-btn-save {
      background: var(--jt-theme-primary, #3b82f6);
      color: #ffffff;
    }

    .jt-custom-theme .jt-signature-modal-btn-save:hover {
      background: var(--jt-theme-primary-hover, #2563eb);
    }

    /* Template Dropdown - RGB Theme */
    .jt-custom-theme .jt-template-dropdown {
      background: var(--jt-theme-background-elevated, #ffffff);
      border-color: var(--jt-theme-border, #e5e7eb);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .jt-custom-theme .jt-template-dropdown-item {
      border-color: var(--jt-theme-border-subtle, #f3f4f6);
    }

    .jt-custom-theme .jt-template-dropdown-item:hover {
      background: var(--jt-theme-background-muted, #f9fafb);
    }

    .jt-custom-theme .jt-template-dropdown-name {
      color: var(--jt-theme-text, #111827);
    }

    .jt-custom-theme .jt-template-dropdown-preview {
      color: var(--jt-theme-text-secondary, #6b7280);
    }

    .jt-custom-theme .jt-template-dropdown-separator {
      background: var(--jt-theme-border, #e5e7eb);
    }

    .jt-custom-theme .jt-template-dropdown-add {
      color: var(--jt-theme-primary, #3b82f6);
    }

    /* Template Manager List - RGB Theme */
    .jt-custom-theme .jt-template-list-item {
      background: var(--jt-theme-background-subtle, #fafafa);
      border-color: var(--jt-theme-border, #e5e7eb);
    }

    .jt-custom-theme .jt-template-list-item:hover {
      border-color: var(--jt-theme-border-strong, #d1d5db);
    }

    .jt-custom-theme .jt-template-item-name {
      color: var(--jt-theme-text, #111827);
    }

    .jt-custom-theme .jt-template-item-preview {
      color: var(--jt-theme-text-secondary, #6b7280);
    }

    .jt-custom-theme .jt-template-star {
      color: #f59e0b;
    }

    .jt-custom-theme .jt-template-name-input {
      background: var(--jt-theme-background, #ffffff);
      border-color: var(--jt-theme-border, #d1d5db);
      color: var(--jt-theme-text, #1f2937);
    }

    .jt-custom-theme .jt-template-name-input:focus {
      border-color: var(--jt-theme-primary, #3b82f6);
    }

    .jt-custom-theme .jt-template-label,
    .jt-custom-theme .jt-template-checkbox-label {
      color: var(--jt-theme-text, #374151);
    }

    .jt-custom-theme .jt-template-action-btn {
      background: var(--jt-theme-background, #ffffff);
      border-color: var(--jt-theme-border, #e5e7eb);
      color: var(--jt-theme-text, #374151);
    }

    .jt-custom-theme .jt-template-action-btn:hover {
      background: var(--jt-theme-background-muted, #f3f4f6);
    }

    .jt-custom-theme .jt-template-action-delete:hover {
      background: #fee2e2;
      border-color: #fecaca;
    }

    .jt-custom-theme .jt-template-empty {
      color: var(--jt-theme-text-secondary, #6b7280);
    }

    .jt-custom-theme .jt-template-empty-hint {
      color: var(--jt-theme-text-muted, #9ca3af);
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
   * Load templates from Chrome storage
   * Includes migration from old messageSignature format
   * @returns {Promise<Object>}
   */
  async function loadTemplates() {
    try {
      const result = await chrome.storage.sync.get([TEMPLATES_STORAGE_KEY, 'messageSignature']);

      // Migration: Convert old signature to template if needed
      if (!result[TEMPLATES_STORAGE_KEY] && result.messageSignature) {
        const migrated = {
          templates: [{
            id: generateId(),
            name: 'My Signature',
            content: result.messageSignature,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }],
          defaultTemplateId: null
        };
        migrated.defaultTemplateId = migrated.templates[0].id;
        await chrome.storage.sync.set({ [TEMPLATES_STORAGE_KEY]: migrated });
        await chrome.storage.sync.remove('messageSignature');
        cachedTemplates = migrated;
        console.log('CharacterCounter: Migrated signature to templates');
        return migrated;
      }

      cachedTemplates = result[TEMPLATES_STORAGE_KEY] || { templates: [], defaultTemplateId: null };
      return cachedTemplates;
    } catch (error) {
      console.error('CharacterCounter: Failed to load templates', error);
      return { templates: [], defaultTemplateId: null };
    }
  }

  /**
   * Save templates to Chrome storage
   * @param {Object} data - The templates data object
   * @returns {Promise<void>}
   */
  async function saveTemplates(data) {
    try {
      cachedTemplates = data;
      await chrome.storage.sync.set({ [TEMPLATES_STORAGE_KEY]: data });
    } catch (error) {
      console.error('CharacterCounter: Failed to save templates', error);
    }
  }

  /**
   * Create a new template
   * @param {string} name - Template name
   * @param {string} content - Template content
   * @param {boolean} setAsDefault - Whether to set as default
   * @returns {Promise<Object>} The created template
   */
  async function createTemplate(name, content, setAsDefault = false) {
    const data = await loadTemplates();
    const newTemplate = {
      id: generateId(),
      name: name.trim(),
      content: content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    data.templates.push(newTemplate);
    if (setAsDefault || data.templates.length === 1) {
      data.defaultTemplateId = newTemplate.id;
    }
    await saveTemplates(data);
    return newTemplate;
  }

  /**
   * Update an existing template
   * @param {string} id - Template ID
   * @param {Object} updates - Fields to update (name, content)
   * @returns {Promise<Object|null>} The updated template or null
   */
  async function updateTemplate(id, updates) {
    const data = await loadTemplates();
    const index = data.templates.findIndex(t => t.id === id);
    if (index !== -1) {
      data.templates[index] = { ...data.templates[index], ...updates, updatedAt: Date.now() };
      await saveTemplates(data);
      return data.templates[index];
    }
    return null;
  }

  /**
   * Delete a template
   * @param {string} id - Template ID
   * @returns {Promise<void>}
   */
  async function deleteTemplate(id) {
    const data = await loadTemplates();
    data.templates = data.templates.filter(t => t.id !== id);
    if (data.defaultTemplateId === id) {
      data.defaultTemplateId = data.templates[0]?.id || null;
    }
    await saveTemplates(data);
  }

  /**
   * Set a template as the default
   * @param {string} id - Template ID
   * @returns {Promise<void>}
   */
  async function setDefaultTemplate(id) {
    const data = await loadTemplates();
    if (data.templates.some(t => t.id === id)) {
      data.defaultTemplateId = id;
      await saveTemplates(data);
    }
  }

  /**
   * Get the default template
   * @returns {Object|null}
   */
  function getDefaultTemplate() {
    if (!cachedTemplates.defaultTemplateId) return null;
    return cachedTemplates.templates.find(t => t.id === cachedTemplates.defaultTemplateId) || null;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string}
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Open the template edit/create modal
   * @param {Object|null} template - Existing template to edit, or null to create new
   * @returns {Promise<Object|null>} - { name, content, setAsDefault } or null if cancelled
   */
  function openTemplateEditModal(template = null) {
    const isNew = !template;
    return new Promise((resolve) => {
      const abortController = new AbortController();
      const { signal } = abortController;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'jt-signature-modal-overlay';
      overlay.style.zIndex = '10001'; // Above manager modal if open

      // Create modal
      const modal = document.createElement('div');
      modal.className = 'jt-signature-modal';

      // Header
      const header = document.createElement('div');
      header.className = 'jt-signature-modal-header';

      const title = document.createElement('h3');
      title.className = 'jt-signature-modal-title';
      title.textContent = isNew ? 'New Template' : 'Edit Template';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'jt-signature-modal-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close');

      header.appendChild(title);
      header.appendChild(closeBtn);

      // Body with name input and content textarea
      const body = document.createElement('div');
      body.className = 'jt-signature-modal-body';

      // Template name input
      const nameGroup = document.createElement('div');
      nameGroup.className = 'jt-template-form-group';

      const nameLabel = document.createElement('label');
      nameLabel.className = 'jt-template-label';
      nameLabel.textContent = 'Template Name';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'jt-template-name-input';
      nameInput.placeholder = 'e.g., Professional, Quick Thanks';
      nameInput.value = template ? template.name : '';

      nameGroup.appendChild(nameLabel);
      nameGroup.appendChild(nameInput);

      // Template content textarea
      const contentGroup = document.createElement('div');
      contentGroup.className = 'jt-template-form-group';

      const contentLabel = document.createElement('label');
      contentLabel.className = 'jt-template-label';
      contentLabel.textContent = 'Template Content';

      const textarea = document.createElement('textarea');
      textarea.className = 'jt-signature-textarea';
      textarea.placeholder = 'Enter your template text...\n\nExample:\n--\nBest regards,\nJohn Smith\nProject Manager';
      textarea.value = template ? template.content : '';

      contentGroup.appendChild(contentLabel);
      contentGroup.appendChild(textarea);

      // Default checkbox
      const checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'jt-template-checkbox-label';

      const defaultCheckbox = document.createElement('input');
      defaultCheckbox.type = 'checkbox';
      defaultCheckbox.className = 'jt-template-default-checkbox';

      checkboxLabel.appendChild(defaultCheckbox);
      checkboxLabel.appendChild(document.createTextNode(' Set as default template'));

      body.appendChild(nameGroup);
      body.appendChild(contentGroup);
      body.appendChild(checkboxLabel);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'jt-signature-modal-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'jt-signature-modal-btn jt-signature-modal-btn-cancel';
      cancelBtn.textContent = 'Cancel';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'jt-signature-modal-btn jt-signature-modal-btn-save';
      saveBtn.textContent = isNew ? 'Create Template' : 'Save Changes';

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);

      // Close function
      function closeModal(result = null) {
        abortController.abort();
        overlay.remove();
        resolve(result);
      }

      // Save function
      function saveTemplate() {
        const name = nameInput.value.trim();
        const content = textarea.value;
        if (!name) {
          nameInput.focus();
          nameInput.style.borderColor = '#ef4444';
          return;
        }
        closeModal({ name, content, setAsDefault: defaultCheckbox.checked });
      }

      // Event listeners
      closeBtn.addEventListener('click', () => closeModal(), { signal });
      cancelBtn.addEventListener('click', () => closeModal(), { signal });
      saveBtn.addEventListener('click', saveTemplate, { signal });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      }, { signal });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeModal();
        }
      }, { signal });

      // Submit on Ctrl+Enter in textarea
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveTemplate();
        }
      }, { signal });

      // Clear error styling on input
      nameInput.addEventListener('input', () => {
        nameInput.style.borderColor = '';
      }, { signal });

      // Add to page
      document.body.appendChild(overlay);

      // Focus name input for new templates, content for editing
      setTimeout(() => {
        if (isNew) {
          nameInput.focus();
        } else {
          textarea.focus();
        }
      }, 50);
    });
  }

  /**
   * Open the template manager modal
   * @returns {Promise<void>}
   */
  function openTemplateManagerModal() {
    return new Promise((resolve) => {
      const abortController = new AbortController();
      const { signal } = abortController;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'jt-signature-modal-overlay';

      // Create modal
      const modal = document.createElement('div');
      modal.className = 'jt-signature-modal jt-template-manager';
      modal.style.maxWidth = '500px';

      // Header
      const header = document.createElement('div');
      header.className = 'jt-signature-modal-header';

      const title = document.createElement('h3');
      title.className = 'jt-signature-modal-title';
      title.textContent = 'Message Templates';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'jt-signature-modal-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close');

      header.appendChild(title);
      header.appendChild(closeBtn);

      // Body - will contain template list
      const body = document.createElement('div');
      body.className = 'jt-signature-modal-body jt-template-list-container';

      // Footer with Add button
      const footer = document.createElement('div');
      footer.className = 'jt-signature-modal-footer';
      footer.style.justifyContent = 'center';

      const addBtn = document.createElement('button');
      addBtn.className = 'jt-signature-modal-btn jt-signature-modal-btn-save';
      addBtn.textContent = '+ Add New Template';

      footer.appendChild(addBtn);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);

      /**
       * Render the template list
       */
      async function renderList() {
        const data = await loadTemplates();
        body.innerHTML = '';

        if (data.templates.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'jt-template-empty';
          empty.innerHTML = `
            <p>No templates yet</p>
            <p class="jt-template-empty-hint">Create your first template to get started</p>
          `;
          body.appendChild(empty);
          return;
        }

        const list = document.createElement('div');
        list.className = 'jt-template-list';

        data.templates.forEach(template => {
          const isDefault = template.id === data.defaultTemplateId;
          const item = document.createElement('div');
          item.className = 'jt-template-list-item';

          const preview = template.content.substring(0, 50).replace(/\n/g, ' ');

          // Info section
          const info = document.createElement('div');
          info.className = 'jt-template-item-info';

          const itemHeader = document.createElement('div');
          itemHeader.className = 'jt-template-item-header';
          if (isDefault) {
            const star = document.createElement('span');
            star.className = 'jt-template-star';
            star.textContent = '★';
            itemHeader.appendChild(star);
          }
          const nameSpan = document.createElement('span');
          nameSpan.className = 'jt-template-item-name';
          nameSpan.textContent = template.name;
          itemHeader.appendChild(nameSpan);

          const previewDiv = document.createElement('div');
          previewDiv.className = 'jt-template-item-preview';
          previewDiv.textContent = preview + (template.content.length > 50 ? '...' : '');

          info.appendChild(itemHeader);
          info.appendChild(previewDiv);

          // Actions section
          const actions = document.createElement('div');
          actions.className = 'jt-template-item-actions';

          // Set as default button (only if not already default)
          if (!isDefault) {
            const defaultBtn = document.createElement('button');
            defaultBtn.className = 'jt-template-action-btn';
            defaultBtn.title = 'Set as default';
            defaultBtn.textContent = '☆';
            defaultBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await setDefaultTemplate(template.id);
              renderList();
            }, { signal });
            actions.appendChild(defaultBtn);
          }

          // Edit button
          const editBtn = document.createElement('button');
          editBtn.className = 'jt-template-action-btn';
          editBtn.title = 'Edit';
          editBtn.textContent = '✎';
          editBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const result = await openTemplateEditModal(template);
            if (result) {
              await updateTemplate(template.id, { name: result.name, content: result.content });
              if (result.setAsDefault) await setDefaultTemplate(template.id);
              renderList();
            }
          }, { signal });
          actions.appendChild(editBtn);

          // Delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'jt-template-action-btn jt-template-action-delete';
          deleteBtn.title = 'Delete';
          deleteBtn.textContent = '🗑';
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${template.name}"?`)) {
              await deleteTemplate(template.id);
              renderList();
            }
          }, { signal });
          actions.appendChild(deleteBtn);

          item.appendChild(info);
          item.appendChild(actions);
          list.appendChild(item);
        });

        body.appendChild(list);
      }

      // Close function
      function closeModal() {
        abortController.abort();
        overlay.remove();
        resolve();
      }

      // Event listeners
      closeBtn.addEventListener('click', closeModal, { signal });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      }, { signal });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeModal();
        }
      }, { signal });

      // Add new template button
      addBtn.addEventListener('click', async () => {
        const result = await openTemplateEditModal(null);
        if (result) {
          await createTemplate(result.name, result.content, result.setAsDefault);
          renderList();
        }
      }, { signal });

      // Add to page and render
      document.body.appendChild(overlay);
      renderList();
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
   * Create a dropdown component for template selection
   * @param {HTMLElement} container - The parent container
   * @param {HTMLTextAreaElement} field - The message field
   * @param {Function} updateCounter - Function to update the character counter
   * @returns {Object} Dropdown control object
   */
  function createTemplateDropdown(container, field, updateCounter) {
    const dropdown = document.createElement('div');
    dropdown.className = 'jt-template-dropdown';
    dropdown.style.display = 'none';

    // Store the outside click handler so we can remove it
    let outsideClickHandler = null;

    /**
     * Populate the dropdown with templates
     */
    async function populate() {
      const data = await loadTemplates();
      dropdown.innerHTML = '';

      // Template items
      data.templates.forEach(template => {
        const isDefault = template.id === data.defaultTemplateId;
        const item = document.createElement('div');
        item.className = 'jt-template-dropdown-item';

        const preview = template.content.substring(0, 30).replace(/\n/g, ' ');

        const nameDiv = document.createElement('div');
        nameDiv.className = 'jt-template-dropdown-name';
        nameDiv.textContent = (isDefault ? '★ ' : '') + template.name;

        const previewDiv = document.createElement('div');
        previewDiv.className = 'jt-template-dropdown-preview';
        previewDiv.textContent = preview + (template.content.length > 30 ? '...' : '');

        item.appendChild(nameDiv);
        item.appendChild(previewDiv);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          insertSignature(field, template.content);
          updateCounter();
          hide();
        });

        dropdown.appendChild(item);
      });

      // Separator (if templates exist)
      if (data.templates.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'jt-template-dropdown-separator';
        dropdown.appendChild(sep);
      }

      // Add new option
      const addNew = document.createElement('div');
      addNew.className = 'jt-template-dropdown-item jt-template-dropdown-add';

      const addIcon = document.createElement('span');
      addIcon.className = 'jt-template-add-icon';
      addIcon.textContent = '+';

      addNew.appendChild(addIcon);
      addNew.appendChild(document.createTextNode(' New Template'));

      addNew.addEventListener('click', async (e) => {
        e.stopPropagation();
        hide();
        const result = await openTemplateEditModal(null);
        if (result) {
          const newTemplate = await createTemplate(result.name, result.content, result.setAsDefault);
          insertSignature(field, newTemplate.content);
          updateCounter();
        }
      });

      dropdown.appendChild(addNew);
    }

    function show() {
      populate();
      dropdown.style.display = 'block';

      // Add outside click handler
      outsideClickHandler = (e) => {
        if (!container.contains(e.target)) {
          hide();
        }
      };
      // Delay adding the listener to avoid immediate trigger
      setTimeout(() => {
        document.addEventListener('click', outsideClickHandler);
      }, 0);
    }

    function hide() {
      dropdown.style.display = 'none';
      if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
      }
    }

    function toggle() {
      if (dropdown.style.display === 'none') {
        show();
      } else {
        hide();
      }
    }

    function cleanup() {
      hide();
      dropdown.remove();
    }

    return { element: dropdown, show, hide, toggle, cleanup };
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

    // Check if inside document-sending modals (Send Estimate, Send Change Order, etc.)
    // These have m-auto.shadow-lg container
    const sendModal = field.closest('.m-auto.shadow-lg');
    if (sendModal) {
      // Check if this modal has an "Email Message" section (using orange label)
      const emailMessageLabel = Array.from(sendModal.querySelectorAll('.text-jtOrange'))
        .find(el => (el.textContent || '').toLowerCase().includes('email message'));

      if (emailMessageLabel) {
        // This is a document-sending modal with email message
        // The textarea should be inside a .rounded-sm.border container
        if (field.closest('.rounded-sm.border')) {
          return true;
        }
        // Or it has caret-black class (JobTread's transparent-text textarea)
        if (field.classList.contains('caret-black')) {
          return true;
        }
      }

      // Also match if modal header says "Send" (Send Estimate, Send Invoice, etc.)
      const modalHeader = sendModal.querySelector('.text-cyan-500');
      if (modalHeader) {
        const headerText = (modalHeader.textContent || '').toLowerCase();
        if (headerText.includes('send')) {
          // Any textarea in a Send modal is likely the message field
          if (field.closest('.rounded-sm.border') || field.classList.contains('caret-black')) {
            return true;
          }
        }
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

    // Create container (wraps buttons and counter)
    const container = document.createElement('div');
    container.className = 'jt-signature-container';

    // Create counter element first (needed for updateCounter reference)
    const counter = document.createElement('div');
    counter.className = 'jt-char-counter safe jt-char-counter-message';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    counter.style.margin = '0'; // Remove margin since it's in container

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

    // Create Templates dropdown button
    const dropdownBtn = document.createElement('button');
    dropdownBtn.className = 'jt-signature-btn jt-template-dropdown-btn';
    dropdownBtn.type = 'button';
    dropdownBtn.innerHTML = 'Templates <span class="jt-dropdown-arrow">▼</span>';
    dropdownBtn.title = 'Insert a template';

    // Create dropdown component
    const dropdown = createTemplateDropdown(container, field, updateCounter);

    // Create Settings button (gear icon)
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'jt-signature-btn';
    settingsBtn.type = 'button';
    settingsBtn.innerHTML = '⚙';
    settingsBtn.title = 'Manage templates';

    // Create separator
    const separator = document.createElement('div');
    separator.className = 'jt-signature-separator';

    // Assemble container: [Templates ▼] [dropdown] [⚙] | [counter]
    container.appendChild(dropdownBtn);
    container.appendChild(dropdown.element);
    container.appendChild(settingsBtn);
    container.appendChild(separator);
    container.appendChild(counter);

    // Store reference to container for this field
    fieldToContainerMap.set(field, container);

    // Handle dropdown button click
    dropdownBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.toggle();
    });

    // Handle settings button click
    settingsBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.hide();
      await openTemplateManagerModal();
    });

    // Store dropdown cleanup reference
    const dropdownCleanup = dropdown.cleanup;

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
          // FIRST: Check for document-sending modals (Send Estimate, Send Change Order, etc.)
          // These have a sticky footer with Cancel and Send buttons
          // Check this BEFORE other toolbars to ensure proper positioning
          const stickyFooter = dialog.querySelector('.sticky.border-t');
          if (stickyFooter) {
            // Verify it has a Send button (div with role="button" containing "Send")
            const buttons = stickyFooter.querySelectorAll('[role="button"]');
            const sendBtn = Array.from(buttons).find(b => b.textContent.trim() === 'Send');
            if (sendBtn) {
              toolbar = stickyFooter;
            }
          }

          // SECOND: If no sticky footer found, look for flex.justify-between toolbars
          // These are used in standard message dialogs
          if (!toolbar) {
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
        }

        if (toolbar) {
          if (toolbar.classList.contains('sticky')) {
            // Document-sending modal (sticky footer) - insert inside the footer, left of Cancel
            // This check comes FIRST to override isSidebar detection for these modals
            // The footer has: [Cancel] [Send] with justify-end
            // We want: [signature/counter] [Cancel] [Send]

            // Find the Cancel button (first button/role=button in the footer)
            const cancelBtn = toolbar.querySelector('[role="button"]');
            if (cancelBtn) {
              // Insert our container before the Cancel button
              // Add some margin to separate from buttons
              container.style.marginRight = 'auto'; // Push buttons to the right
              toolbar.insertBefore(container, cancelBtn);
            } else {
              // Fallback: insert at beginning of footer
              toolbar.insertBefore(container, toolbar.firstChild);
            }
          } else if (isSidebar) {
            // In sidebar (UPDATE TASK panel, etc.): add container as a new row below the toolbar
            // This prevents the Send button from being pushed out of the narrow viewport
            const containerRow = document.createElement('div');
            containerRow.className = 'jt-signature-container-row';
            containerRow.appendChild(container);
            toolbar.parentElement.insertBefore(containerRow, toolbar.nextSibling);
          } else {
            // For dashboard and dialogs: insert inline next to Send button
            const rightSide = toolbar.querySelector('div.shrink-0');
            if (rightSide) {
              // Find the space-x-1 wrapper that contains the Send button
              const buttonWrapper = rightSide.querySelector('.space-x-1') || rightSide;
              // Insert our container before the Send button
              buttonWrapper.insertBefore(container, buttonWrapper.firstChild);
            } else {
              // Fallback: look for left side to append after
              const leftSide = toolbar.querySelector('div.flex.gap-1');
              if (leftSide) {
                // Insert signature container after the left side buttons
                leftSide.appendChild(container);
              } else {
                // Last resort: append to toolbar
                toolbar.appendChild(container);
              }
            }
          }
        } else {
          // Fallback: add after the textarea's container
          const textareaContainer = field.closest('.border.rounded-b-sm, .rounded-sm.border') || parent;
          if (textareaContainer.parentElement) {
            const wrapper = document.createElement('div');
            wrapper.className = 'jt-signature-container-row';
            wrapper.style.marginTop = '8px';
            wrapper.appendChild(container);
            textareaContainer.parentElement.insertBefore(wrapper, textareaContainer.nextSibling);
          } else {
            textareaContainer.parentElement?.appendChild(container);
          }
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
      // Cleanup dropdown
      dropdownCleanup();
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

    // Load templates from storage (includes migration from old signature)
    await loadTemplates();

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

    // Remove any open modals (signature and template modals)
    document.querySelectorAll('.jt-signature-modal-overlay').forEach(modal => {
      modal.remove();
    });

    // Remove all template dropdowns
    document.querySelectorAll('.jt-template-dropdown').forEach(dropdown => {
      dropdown.remove();
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

    // Clear cached templates
    cachedTemplates = { templates: [], defaultTemplateId: null };

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
