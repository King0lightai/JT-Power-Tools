/**
 * JobTread Page Helper
 *
 * Utilities for reading information from the JobTread UI.
 * Used to verify the user is viewing the correct organization.
 */

const JobTreadPageHelper = {
  /**
   * Get the current organization name from the page
   * Reads from the global search placeholder: "Search [Org Name]"
   */
  getCurrentOrgName() {
    // Method 1: Read from global search input placeholder
    const searchInput = document.querySelector('input[placeholder^="Search "]');
    if (searchInput && searchInput.placeholder) {
      const match = searchInput.placeholder.match(/^Search\s+(.+)$/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Method 2: Try reading from header/navigation elements
    const headerOrgElement = document.querySelector('[data-org-name]');
    if (headerOrgElement) {
      return headerOrgElement.getAttribute('data-org-name');
    }

    // Method 3: Look for organization name in common locations
    const possibleSelectors = [
      '.org-name',
      '.organization-name',
      '[data-testid="org-name"]',
      '.header-org',
      '.nav-org-name'
    ];

    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }

    return null;
  },

  /**
   * Check if the current page is showing the expected organization
   * Uses fuzzy matching to handle minor differences
   */
  isCorrectOrg(expectedOrgName) {
    if (!expectedOrgName) return false;

    const currentOrg = this.getCurrentOrgName();
    if (!currentOrg) return false;

    // Normalize for comparison
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    return normalize(currentOrg) === normalize(expectedOrgName);
  },

  /**
   * Check if we're on a JobTread page
   */
  isJobTreadPage() {
    return window.location.hostname.includes('jobtread.com');
  },

  /**
   * Get the current page type (jobs, customers, settings, etc.)
   */
  getCurrentPageType() {
    const path = window.location.pathname;

    if (path.includes('/jobs')) return 'jobs';
    if (path.includes('/customers')) return 'customers';
    if (path.includes('/vendors')) return 'vendors';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/calendar')) return 'calendar';

    return 'unknown';
  },

  /**
   * Get the current job ID if on a job page
   */
  getCurrentJobId() {
    const path = window.location.pathname;
    const match = path.match(/\/jobs\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  },

  /**
   * Watch for organization changes
   * @param {Function} callback - Called with new org name when it changes
   * @returns {Function} - Call to stop watching
   */
  watchOrgChanges(callback) {
    let lastOrg = this.getCurrentOrgName();

    const checkOrg = () => {
      const currentOrg = this.getCurrentOrgName();
      if (currentOrg !== lastOrg) {
        lastOrg = currentOrg;
        callback(currentOrg);
      }
    };

    // Check periodically
    const intervalId = setInterval(checkOrg, 1000);

    // Also watch for URL changes (SPA navigation)
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(checkOrg, 100);
    };

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      history.pushState = originalPushState;
    };
  },

  /**
   * Show a warning banner when viewing wrong organization
   */
  showOrgMismatchWarning(expectedOrg, currentOrg) {
    // Remove any existing warning
    this.hideOrgMismatchWarning();

    const banner = document.createElement('div');
    banner.id = 'jtpro-org-warning';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #f59e0b;
        color: #78350f;
        padding: 12px 20px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        z-index: 99999;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      ">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <span>
          <strong>Wrong Organization:</strong>
          You're viewing "${currentOrg}" but your license is for "${expectedOrg}".
          Smart filtering is disabled.
        </span>
        <button onclick="document.getElementById('jtpro-org-warning').remove()" style="
          margin-left: 12px;
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          font-size: 20px;
          padding: 0 4px;
        ">&times;</button>
      </div>
    `;

    document.body.appendChild(banner);
  },

  /**
   * Hide the org mismatch warning
   */
  hideOrgMismatchWarning() {
    const existing = document.getElementById('jtpro-org-warning');
    if (existing) {
      existing.remove();
    }
  },

  /**
   * Show a success notification
   */
  showNotification(message, type = 'success') {
    const colors = {
      success: { bg: '#10b981', text: '#fff' },
      error: { bg: '#ef4444', text: '#fff' },
      warning: { bg: '#f59e0b', text: '#78350f' },
      info: { bg: '#3b82f6', text: '#fff' }
    };

    const color = colors[type] || colors.info;

    const notification = document.createElement('div');
    notification.className = 'jtpro-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${color.bg};
        color: ${color.text};
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: jtpro-slide-in 0.3s ease-out;
      ">
        ${message}
      </div>
      <style>
        @keyframes jtpro-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobTreadPageHelper;
} else if (typeof window !== 'undefined') {
  window.JobTreadPageHelper = JobTreadPageHelper;
}
