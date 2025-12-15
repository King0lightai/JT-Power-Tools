/**
 * Alert Modal Module
 * Provides a JobTread-styled modal for creating alerts
 *
 * Dependencies:
 * - formatter-modules/formats.js (FormatterFormats)
 */

const AlertModal = (() => {
  // Icon SVG paths (matching preview-mode.js)
  const iconMap = {
    infoCircle: {
      name: 'Info',
      path: '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>'
    },
    exclamationTriangle: {
      name: 'Warning',
      path: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"></path>'
    },
    checkCircle: {
      name: 'Success',
      path: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path>'
    },
    octogonAlert: {
      name: 'Alert',
      path: '<path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"></path><path d="M12 8v4M12 16h.01"></path>'
    },
    lightbulb: {
      name: 'Tip',
      path: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"></path>'
    }
  };

  // Color definitions
  const colorMap = {
    blue: { name: 'Blue', class: 'jt-color-blue' },
    yellow: { name: 'Yellow', class: 'jt-color-yellow' },
    red: { name: 'Red', class: 'jt-color-red' },
    green: { name: 'Green', class: 'jt-color-green' },
    orange: { name: 'Orange', class: 'jt-color-orange' },
    purple: { name: 'Purple', class: 'jt-color-purple' }
  };

  // SVG icon helper
  function createSVGIcon(pathContent, colorClass = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em] ${colorClass}" viewBox="0 0 24 24">${pathContent}</svg>`;
  }

  // Close icon SVG
  const closeIconPath = '<path d="M18 6 6 18M6 6l12 12"></path>';
  const chevronDownPath = '<path d="m6 9 6 6 6-6"></path>';
  const cancelIconPath = '<path d="M4.929 4.929 19.07 19.071"></path><circle cx="12" cy="12" r="10"></circle>';
  const plusIconPath = '<path d="M5 12h14M12 5v14"></path>';

  /**
   * Create and show the alert modal
   * @returns {Promise<Object|null>} Alert data or null if cancelled
   */
  function show() {
    return new Promise((resolve) => {
      // Default values
      let selectedColor = 'blue';
      let selectedIcon = 'infoCircle';
      let subject = '';
      let body = '';

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'jt-alert-modal-overlay';

      // Create modal structure
      overlay.innerHTML = `
        <div class="jt-alert-modal">
          <div class="jt-alert-modal-header">
            <div class="jt-alert-modal-title">Add Alert</div>
            <button type="button" class="jt-alert-modal-close">
              ${createSVGIcon(closeIconPath)} Close
            </button>
          </div>
          <div class="jt-alert-modal-body">
            <div class="jt-alert-options-row">
              <!-- Color Dropdown -->
              <div class="jt-alert-dropdown-container" data-dropdown="color">
                <div class="jt-alert-dropdown-button" tabindex="0">
                  <div class="jt-alert-dropdown-label">
                    <span class="${colorMap[selectedColor].class}">${colorMap[selectedColor].name}</span>
                  </div>
                  ${createSVGIcon(chevronDownPath)}
                </div>
                <div class="jt-alert-dropdown-menu">
                  ${Object.entries(colorMap).map(([key, val]) => `
                    <button type="button" class="jt-alert-dropdown-item ${key === selectedColor ? 'active' : ''}" data-color="${key}">
                      <span class="${val.class}">${val.name}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Icon Dropdown -->
              <div class="jt-alert-dropdown-container" data-dropdown="icon">
                <div class="jt-alert-dropdown-button" tabindex="0">
                  <div class="jt-alert-dropdown-label">
                    ${createSVGIcon(iconMap[selectedIcon].path, colorMap[selectedColor].class)}
                  </div>
                  ${createSVGIcon(chevronDownPath)}
                </div>
                <div class="jt-alert-dropdown-menu">
                  ${Object.entries(iconMap).map(([key, val]) => `
                    <button type="button" class="jt-alert-dropdown-item ${key === selectedIcon ? 'active' : ''}" data-icon="${key}">
                      ${createSVGIcon(val.path)} ${val.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Subject Input -->
              <input type="text" class="jt-alert-subject" placeholder="Subject" value="">
            </div>

            <!-- Formatter Toolbar for Message (Full Features) -->
            <div class="jt-alert-formatter-toolbar">
              <div class="jt-toolbar-group">
                <button type="button" class="jt-alert-format-btn" data-format="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
                <button type="button" class="jt-alert-format-btn" data-format="italic" title="Italic (Ctrl+I)"><em>I</em></button>
                <button type="button" class="jt-alert-format-btn" data-format="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                <button type="button" class="jt-alert-format-btn" data-format="strikethrough" title="Strikethrough"><s>S</s></button>
              </div>

              <div class="jt-toolbar-divider"></div>

              <!-- Headings Dropdown -->
              <div class="jt-toolbar-group jt-alert-dropdown-group">
                <button type="button" class="jt-alert-format-btn jt-alert-dropdown-trigger" data-dropdown-target="headings" title="Headings">
                  H<span class="jt-dropdown-arrow">▾</span>
                </button>
                <div class="jt-alert-toolbar-dropdown" data-dropdown-id="headings">
                  <button type="button" class="jt-alert-format-btn" data-format="h1" title="Heading 1"><span style="font-size: 15px; font-weight: 700;">H1</span></button>
                  <button type="button" class="jt-alert-format-btn" data-format="h2" title="Heading 2"><span style="font-size: 14px; font-weight: 600;">H2</span></button>
                  <button type="button" class="jt-alert-format-btn" data-format="h3" title="Heading 3"><span style="font-size: 13px; font-weight: 500;">H3</span></button>
                </div>
              </div>

              <div class="jt-toolbar-divider"></div>

              <!-- More Options Dropdown -->
              <div class="jt-toolbar-group jt-alert-dropdown-group">
                <button type="button" class="jt-alert-format-btn jt-alert-dropdown-trigger" data-dropdown-target="more" title="More Options">
                  +<span class="jt-dropdown-arrow">▾</span>
                </button>
                <div class="jt-alert-toolbar-dropdown" data-dropdown-id="more">
                  <button type="button" class="jt-alert-format-btn" data-format="bullet" title="Bullet List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="3" cy="6" r="1" fill="currentColor"></circle><circle cx="3" cy="12" r="1" fill="currentColor"></circle><circle cx="3" cy="18" r="1" fill="currentColor"></circle></svg> List</button>
                  <button type="button" class="jt-alert-format-btn" data-format="numbered" title="Numbered List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><text x="3" y="7" font-size="6" fill="currentColor" stroke="none" font-weight="600">1</text><text x="3" y="13" font-size="6" fill="currentColor" stroke="none" font-weight="600">2</text><text x="3" y="19" font-size="6" fill="currentColor" stroke="none" font-weight="600">3</text></svg> List</button>
                  <button type="button" class="jt-alert-format-btn" data-format="link" title="Insert Link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Link</button>
                  <button type="button" class="jt-alert-format-btn" data-format="quote" title="Quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path></svg> Quote</button>
                  <button type="button" class="jt-alert-format-btn" data-format="table" title="Insert Table"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg> Table</button>
                  <button type="button" class="jt-alert-format-btn" data-format="hr" title="Horizontal Rule"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg> Rule</button>
                </div>
              </div>

              <div class="jt-toolbar-divider"></div>

              <!-- Color Picker Dropdown -->
              <div class="jt-toolbar-group jt-alert-dropdown-group">
                <button type="button" class="jt-alert-format-btn jt-alert-color-btn jt-alert-dropdown-trigger" data-dropdown-target="colors" title="Text Color">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5" fill="#ef4444" stroke="none"></circle><circle cx="17.5" cy="10.5" r="2.5" fill="#f59e0b" stroke="none"></circle><circle cx="8.5" cy="7.5" r="2.5" fill="#3b82f6" stroke="none"></circle><circle cx="6.5" cy="12.5" r="2.5" fill="#10b981" stroke="none"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"></path></svg>
                </button>
                <div class="jt-alert-toolbar-dropdown jt-alert-color-dropdown" data-dropdown-id="colors">
                  <button type="button" class="jt-alert-format-btn jt-color-green" data-format="color" data-color="green" title="Green">A</button>
                  <button type="button" class="jt-alert-format-btn jt-color-yellow" data-format="color" data-color="yellow" title="Yellow">A</button>
                  <button type="button" class="jt-alert-format-btn jt-color-blue" data-format="color" data-color="blue" title="Blue">A</button>
                  <button type="button" class="jt-alert-format-btn jt-color-red" data-format="color" data-color="red" title="Red">A</button>
                </div>
              </div>
            </div>

            <!-- Message Textarea -->
            <div class="jt-alert-message-container">
              <textarea class="jt-alert-message" placeholder="Message"></textarea>
            </div>
          </div>
          <div class="jt-alert-modal-footer">
            <button type="button" class="jt-alert-btn-cancel">
              ${createSVGIcon(cancelIconPath)} Cancel
            </button>
            <button type="button" class="jt-alert-btn-add">
              ${createSVGIcon(plusIconPath)} Add
            </button>
          </div>
        </div>
      `;

      // Get references to elements
      const modal = overlay.querySelector('.jt-alert-modal');
      const closeBtn = overlay.querySelector('.jt-alert-modal-close');
      const cancelBtn = overlay.querySelector('.jt-alert-btn-cancel');
      const addBtn = overlay.querySelector('.jt-alert-btn-add');
      const subjectInput = overlay.querySelector('.jt-alert-subject');
      const messageTextarea = overlay.querySelector('.jt-alert-message');
      const colorDropdown = overlay.querySelector('[data-dropdown="color"]');
      const iconDropdown = overlay.querySelector('[data-dropdown="icon"]');

      // Update icon preview with current color
      function updateIconPreview() {
        const iconLabel = iconDropdown.querySelector('.jt-alert-dropdown-label');
        iconLabel.innerHTML = createSVGIcon(iconMap[selectedIcon].path, colorMap[selectedColor].class);
      }

      // Update color label
      function updateColorLabel() {
        const colorLabel = colorDropdown.querySelector('.jt-alert-dropdown-label');
        colorLabel.innerHTML = `<span class="${colorMap[selectedColor].class}">${colorMap[selectedColor].name}</span>`;
      }

      // Close modal
      function closeModal(result = null) {
        overlay.remove();
        resolve(result);
      }

      // Handle dropdown toggle
      function setupDropdown(container) {
        const button = container.querySelector('.jt-alert-dropdown-button');
        const menu = container.querySelector('.jt-alert-dropdown-menu');

        button.addEventListener('click', (e) => {
          e.stopPropagation();

          // Close other dropdowns
          overlay.querySelectorAll('.jt-alert-dropdown-menu').forEach(m => {
            if (m !== menu) m.classList.remove('jt-dropdown-open');
          });

          menu.classList.toggle('jt-dropdown-open');
        });

        button.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            button.click();
          }
        });
      }

      // Setup color dropdown
      setupDropdown(colorDropdown);
      colorDropdown.querySelectorAll('.jt-alert-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedColor = item.dataset.color;

          // Update active state
          colorDropdown.querySelectorAll('.jt-alert-dropdown-item').forEach(i => {
            i.classList.toggle('active', i.dataset.color === selectedColor);
          });

          updateColorLabel();
          updateIconPreview();
          colorDropdown.querySelector('.jt-alert-dropdown-menu').classList.remove('jt-dropdown-open');
        });
      });

      // Setup icon dropdown
      setupDropdown(iconDropdown);
      iconDropdown.querySelectorAll('.jt-alert-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedIcon = item.dataset.icon;

          // Update active state
          iconDropdown.querySelectorAll('.jt-alert-dropdown-item').forEach(i => {
            i.classList.toggle('active', i.dataset.icon === selectedIcon);
          });

          updateIconPreview();
          iconDropdown.querySelector('.jt-alert-dropdown-menu').classList.remove('jt-dropdown-open');
        });
      });

      // Close dropdowns when clicking outside
      overlay.addEventListener('click', (e) => {
        if (!e.target.closest('.jt-alert-dropdown-container')) {
          overlay.querySelectorAll('.jt-alert-dropdown-menu').forEach(m => {
            m.classList.remove('jt-dropdown-open');
          });
        }
      });

      // Setup toolbar dropdown triggers
      const toolbarDropdownTriggers = overlay.querySelectorAll('.jt-alert-dropdown-trigger');
      toolbarDropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetId = trigger.dataset.dropdownTarget;
          const dropdown = overlay.querySelector(`[data-dropdown-id="${targetId}"]`);

          // Close all other toolbar dropdowns
          overlay.querySelectorAll('.jt-alert-toolbar-dropdown').forEach(d => {
            if (d !== dropdown) d.classList.remove('jt-dropdown-visible');
          });

          // Toggle this dropdown
          if (dropdown) {
            dropdown.classList.toggle('jt-dropdown-visible');
          }
        });
      });

      // Close toolbar dropdowns when clicking outside
      overlay.addEventListener('click', (e) => {
        if (!e.target.closest('.jt-alert-dropdown-group')) {
          overlay.querySelectorAll('.jt-alert-toolbar-dropdown').forEach(d => {
            d.classList.remove('jt-dropdown-visible');
          });
        }
      });

      // Setup formatter toolbar buttons - reuse existing FormatterFormats module
      const formatButtons = overlay.querySelectorAll('.jt-alert-format-btn[data-format]');
      formatButtons.forEach(btn => {
        // Skip dropdown triggers
        if (btn.classList.contains('jt-alert-dropdown-trigger')) return;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const format = btn.dataset.format;
          const color = btn.dataset.color;

          if (format && messageTextarea && window.FormatterFormats) {
            if (format === 'color' && color) {
              window.FormatterFormats.applyFormat(messageTextarea, format, { color });
            } else {
              window.FormatterFormats.applyFormat(messageTextarea, format);
            }
            // Re-focus the textarea after formatting
            messageTextarea.focus();

            // Close any open toolbar dropdowns
            overlay.querySelectorAll('.jt-alert-toolbar-dropdown').forEach(d => {
              d.classList.remove('jt-dropdown-visible');
            });
          }
        });
      });

      // Handle keyboard shortcuts in message textarea - reuse existing FormatterFormats module
      messageTextarea.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifier = isMac ? e.metaKey : e.ctrlKey;

        if (!modifier) return;

        let format = null;
        switch(e.key.toLowerCase()) {
          case 'b': format = 'bold'; break;
          case 'i': format = 'italic'; break;
          case 'u': format = 'underline'; break;
        }

        if (format && window.FormatterFormats) {
          e.preventDefault();
          e.stopPropagation();
          window.FormatterFormats.applyFormat(messageTextarea, format);
        }
      });

      // Close modal on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(null);
        }
      });

      // Close modal on close/cancel button
      closeBtn.addEventListener('click', () => closeModal(null));
      cancelBtn.addEventListener('click', () => closeModal(null));

      // Add alert on add button
      addBtn.addEventListener('click', () => {
        subject = subjectInput.value.trim() || 'Important';
        body = messageTextarea.value.trim() || 'Your alert message here.';

        closeModal({
          alertColor: selectedColor,
          alertIcon: selectedIcon,
          alertSubject: subject,
          alertBody: body
        });
      });

      // Handle keyboard
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeModal(null);
        }
      });

      // Append to body and focus subject input
      document.body.appendChild(overlay);
      setTimeout(() => {
        subjectInput.focus();
      }, 50);
    });
  }

  // Public API
  return {
    show
  };
})();

// Export to window
if (typeof window !== 'undefined') {
  window.AlertModal = AlertModal;
}
