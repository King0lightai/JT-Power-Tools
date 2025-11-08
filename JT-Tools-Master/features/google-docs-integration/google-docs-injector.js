// Google Docs Integration - Google Docs Injector Module
// Injects "Save to JobTread" button in Google Docs/Sheets interface

const GoogleDocsInjector = (() => {

  /**
   * Initialize the injector
   */
  function init() {
    // Only run on Google Docs/Sheets domains
    if (!isGoogleDocsPage()) {
      return;
    }

    console.log('GoogleDocsInjector: On Google Docs page');

    // Get file ID from URL
    const fileId = getFileIdFromUrl();
    if (!fileId) {
      console.log('GoogleDocsInjector: Could not extract file ID from URL');
      return;
    }

    // Check if this file was opened via our extension
    chrome.storage.local.get(`editing_${fileId}`, (result) => {
      const context = result[`editing_${fileId}`];

      if (context) {
        console.log('GoogleDocsInjector: File was opened by our extension, injecting button');
        injectSaveButton(fileId, context);
      } else {
        console.log('GoogleDocsInjector: File was not opened by our extension');
      }
    });
  }

  /**
   * Check if current page is Google Docs/Sheets
   * @returns {boolean}
   */
  function isGoogleDocsPage() {
    return window.location.hostname === 'docs.google.com';
  }

  /**
   * Extract file ID from Google Docs URL
   * @returns {string|null}
   */
  function getFileIdFromUrl() {
    // Google Docs URLs: https://docs.google.com/document/d/{fileId}/edit
    // Google Sheets URLs: https://docs.google.com/spreadsheets/d/{fileId}/edit
    const match = window.location.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Inject "Save to JobTread" button in Google Docs toolbar
   * @param {string} fileId - Google Drive file ID
   * @param {Object} context - File context from storage
   */
  function injectSaveButton(fileId, context) {
    // Wait for Google Docs UI to load
    waitForElement('.docs-titlebar-buttons, .docs-butterbar-container', (toolbar) => {
      console.log('GoogleDocsInjector: Toolbar found, injecting button');

      // Check if button already exists
      if (document.querySelector('.jt-save-to-jobtread-btn')) {
        console.log('GoogleDocsInjector: Button already exists');
        return;
      }

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'jt-save-to-jobtread-btn';
      buttonContainer.style.cssText = `
        display: inline-block;
        margin-right: 12px;
        vertical-align: middle;
      `;

      // Create button
      const button = document.createElement('button');
      button.innerHTML = '💾 Save to JobTread';
      button.style.cssText = `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        font-family: 'Google Sans', Arial, sans-serif;
        transition: background 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      `;

      // Hover effect
      button.addEventListener('mouseenter', () => {
        button.style.background = '#45a049';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = '#4CAF50';
      });

      // Click handler
      button.addEventListener('click', async () => {
        // Disable button while saving
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        const originalText = button.innerHTML;
        button.innerHTML = '⏳ Saving...';

        try {
          await GoogleDocsWorkflow.saveToJobTread(fileId);

          // Keep button disabled after successful save
          button.innerHTML = '✓ Saved';
          button.style.background = '#4CAF50';

        } catch (error) {
          console.error('GoogleDocsInjector: Save failed:', error);

          // Re-enable button on error
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          button.innerHTML = originalText;
        }
      });

      buttonContainer.appendChild(button);

      // Insert button at the beginning of toolbar
      if (toolbar.firstChild) {
        toolbar.insertBefore(buttonContainer, toolbar.firstChild);
      } else {
        toolbar.appendChild(buttonContainer);
      }

      console.log('GoogleDocsInjector: ✓ Button injected successfully');

      // Show a notification reminding user about the button
      showReminderNotification(context.originalFileName);
    });
  }

  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {Function} callback - Called when element is found
   * @param {number} timeout - Max time to wait in ms
   */
  function waitForElement(selector, callback, timeout = 10000) {
    const startTime = Date.now();

    const check = () => {
      const element = document.querySelector(selector);

      if (element) {
        callback(element);
        return;
      }

      // Check if timeout reached
      if (Date.now() - startTime > timeout) {
        console.error(`GoogleDocsInjector: Timeout waiting for element: ${selector}`);
        return;
      }

      // Try again
      requestAnimationFrame(check);
    };

    check();
  }

  /**
   * Show a reminder notification about the Save button
   * @param {string} fileName - Original file name
   */
  function showReminderNotification(fileName) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #4285f4;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000000;
      max-width: 350px;
      font-family: 'Google Sans', Arial, sans-serif;
      animation: jt-slideIn 0.3s ease;
    `;

    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">
        Editing: ${fileName}
      </div>
      <div style="font-size: 13px; opacity: 0.95; line-height: 1.5;">
        When you're done editing, click <strong>"💾 Save to JobTread"</strong> in the toolbar above.
      </div>
      <style>
        @keyframes jt-slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
    `;

    document.body.appendChild(notification);

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s, transform 0.3s';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, 8000);
  }

  // Public API
  return {
    init
  };
})();

// Make available globally
window.GoogleDocsInjector = GoogleDocsInjector;

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    GoogleDocsInjector.init();
  });
} else {
  GoogleDocsInjector.init();
}

console.log('GoogleDocsInjector: Module loaded');
