// Google Docs Integration - UI Components
// Progress modals, notifications, and user messages

const GoogleDocsUI = (() => {

  /**
   * Show a progress modal with loading spinner
   * @param {string} message - Initial message to display
   * @returns {Object} Modal controller with update() and close() methods
   */
  function showProgressModal(message) {
    const modal = document.createElement('div');
    modal.className = 'jt-google-docs-progress-modal';
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          text-align: center;
          min-width: 300px;
          max-width: 400px;
        ">
          <div class="spinner" style="
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4285f4;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: jt-spin 1s linear infinite;
            margin: 0 auto 20px;
          "></div>
          <div class="message" style="
            font-size: 16px;
            color: #333;
            line-height: 1.5;
          ">${message}</div>
        </div>
      </div>
      <style>
        @keyframes jt-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    document.body.appendChild(modal);

    return {
      update: (newMessage) => {
        const messageEl = modal.querySelector('.message');
        if (messageEl) {
          messageEl.textContent = newMessage;
        }
      },
      close: () => {
        modal.remove();
      }
    };
  }

  /**
   * Show a success notification
   * @param {string} message - Success message
   * @param {number} duration - How long to show (ms)
   */
  function showSuccessNotification(message, duration = 5000) {
    showNotification(message, 'success', duration);
  }

  /**
   * Show an error notification
   * @param {string} message - Error message
   * @param {number} duration - How long to show (ms)
   */
  function showErrorNotification(message, duration = 8000) {
    showNotification(message, 'error', duration);
  }

  /**
   * Show an info notification
   * @param {string} message - Info message
   * @param {number} duration - How long to show (ms)
   */
  function showInfoNotification(message, duration = 5000) {
    showNotification(message, 'info', duration);
  }

  /**
   * Show a notification
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', or 'info'
   * @param {number} duration - How long to show (ms)
   */
  function showNotification(message, type = 'info', duration = 5000) {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      info: '#2196F3'
    };

    const icons = {
      success: '✓',
      error: '✗',
      info: 'ℹ'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000000;
      max-width: 400px;
      animation: jt-slideIn 0.3s ease;
      font-size: 14px;
      line-height: 1.5;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: start; gap: 10px;">
        <div style="font-size: 20px; font-weight: bold;">${icons[type]}</div>
        <div style="flex: 1; white-space: pre-line;">${message}</div>
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

    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s, transform 0.3s';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  /**
   * Show instructions after opening file in Google Docs
   * @param {string} googleFileId - Google Drive file ID
   * @param {string} jobId - JobTread job ID
   */
  function showInstructionsNotification(googleFileId, jobId) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4285f4;
      color: white;
      padding: 20px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000000;
      max-width: 400px;
      animation: jt-slideIn 0.3s ease;
    `;

    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
        ✓ File opened in Google Docs
      </div>
      <div style="font-size: 14px; opacity: 0.95; line-height: 1.6;">
        Make your edits, then click the <strong>"💾 Save to JobTread"</strong> button in the Google Docs toolbar when you're done.
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s, transform 0.3s';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, 10000);
  }

  /**
   * Show a confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {string} confirmText - Confirm button text
   * @param {string} cancelText - Cancel button text
   * @returns {Promise<boolean>} True if confirmed, false if cancelled
   */
  function showConfirmDialog(title, message, confirmText = 'Continue', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      dialog.innerHTML = `
        <div style="
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          max-width: 400px;
          width: 90%;
        ">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">${title}</h3>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #666; line-height: 1.6; white-space: pre-line;">${message}</p>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="jt-cancel-btn" style="
              padding: 8px 16px;
              border: 1px solid #ddd;
              background: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              color: #666;
            ">${cancelText}</button>
            <button class="jt-confirm-btn" style="
              padding: 8px 16px;
              border: none;
              background: #4285f4;
              color: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
            ">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      const confirmBtn = dialog.querySelector('.jt-confirm-btn');
      const cancelBtn = dialog.querySelector('.jt-cancel-btn');

      confirmBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(true);
      });

      cancelBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(false);
      });

      // Close on background click
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          dialog.remove();
          resolve(false);
        }
      });
    });
  }

  // Public API
  return {
    showProgressModal,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification,
    showInstructionsNotification,
    showConfirmDialog
  };
})();

// Make available globally
window.GoogleDocsUI = GoogleDocsUI;

console.log('GoogleDocsUI: Module loaded');
