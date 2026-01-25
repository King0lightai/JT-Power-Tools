// Budget Changelog Feature
// Compare JobTread budget backups and display human-readable changes
// Power User tier feature

const BudgetChangelogFeature = (() => {
  let isActive = false;
  let sidebarObserver = null;
  let currentJobId = null;

  // Selectors for Budget Backups sidebar
  const SIDEBAR_SELECTOR = 'div.z-30.absolute.top-0.bottom-0.right-0';

  /**
   * Check if a sidebar element is the Budget Backups sidebar
   * @param {HTMLElement} sidebar - Sidebar element to check
   * @returns {boolean} True if this is the Budget Backups sidebar
   */
  function isBudgetBackupsSidebar(sidebar) {
    if (!sidebar) return false;

    // Look for "Budget Backups" text in the header
    const headerText = sidebar.textContent || '';
    if (headerText.includes('Budget Backups') || headerText.includes('BUDGET BACKUPS')) {
      return true;
    }

    // Look for backup list items (rows with dates)
    const hasBackupItems = sidebar.querySelector('[class*="cursor-pointer"]');
    const hasDateText = /\d{1,2}\/\d{1,2}\/\d{4}|\w{3}\s+\d{1,2},\s+\d{4}/.test(headerText);

    return hasBackupItems && hasDateText;
  }

  /**
   * Find the Budget Backups sidebar if currently open
   * @returns {HTMLElement|null} Sidebar element or null
   */
  function findBudgetBackupsSidebar() {
    const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
    for (const sidebar of sidebars) {
      if (isBudgetBackupsSidebar(sidebar)) {
        return sidebar;
      }
    }
    return null;
  }

  /**
   * Extract job ID from current URL
   * @returns {string|null} Job ID or null
   */
  function getJobIdFromUrl() {
    const match = window.location.pathname.match(/\/jobs\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActive) {
      return;
    }

    isActive = true;

    // Start observing for Budget Backups sidebar
    startSidebarObserver();

    // Check if sidebar is already present
    const existingSidebar = findBudgetBackupsSidebar();
    if (existingSidebar) {
      handleSidebarAppeared(existingSidebar);
    }

    console.log('BudgetChangelog: Activated');
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      return;
    }

    isActive = false;

    // Stop observer
    stopSidebarObserver();

    // Remove any injected UI
    BudgetChangelogUI.cleanup();

    // Reset state
    currentJobId = null;

    console.log('BudgetChangelog: Deactivated');
  }

  /**
   * Start observing for Budget Backups sidebar appearances
   */
  function startSidebarObserver() {
    if (sidebarObserver) {
      return;
    }

    sidebarObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if added node is a sidebar or contains one
            const sidebar = node.matches?.(SIDEBAR_SELECTOR)
              ? node
              : node.querySelector?.(SIDEBAR_SELECTOR);

            if (sidebar) {
              // Delay to ensure sidebar is fully rendered
              setTimeout(() => {
                if (isBudgetBackupsSidebar(sidebar)) {
                  handleSidebarAppeared(sidebar);
                }
              }, 200);
            }
          }
        }

        // Also check for removed nodes to cleanup
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.(SIDEBAR_SELECTOR) || node.querySelector?.(SIDEBAR_SELECTOR)) {
              // Sidebar was removed, cleanup our UI
              BudgetChangelogUI.cleanup();
            }
          }
        }
      }
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Stop the sidebar observer
   */
  function stopSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }
  }

  /**
   * Handle when Budget Backups sidebar appears
   * @param {HTMLElement} sidebar - The sidebar element
   */
  async function handleSidebarAppeared(sidebar) {
    // Check if API is configured
    const isApiConfigured = await checkApiConfigured();
    if (!isApiConfigured) {
      console.log('BudgetChangelog: API not configured, skipping');
      return;
    }

    // Get job ID
    const jobId = getJobIdFromUrl();
    if (!jobId) {
      console.log('BudgetChangelog: Not on a job page, skipping');
      return;
    }

    currentJobId = jobId;

    // Fetch backup list
    try {
      const backups = await fetchBudgetBackups(jobId);

      if (backups.length < 2) {
        console.log('BudgetChangelog: Less than 2 backups, comparison not possible');
        // Could show a message in the sidebar here
        return;
      }

      // Inject compare controls
      BudgetChangelogUI.injectCompareControls(sidebar, backups);

    } catch (error) {
      console.error('BudgetChangelog: Error fetching backups:', error);
    }
  }

  /**
   * Check if API is configured (Worker or Direct)
   * @returns {Promise<boolean>} True if API is configured
   */
  async function checkApiConfigured() {
    // Check Worker API first (Pro Service)
    if (typeof JobTreadProService !== 'undefined') {
      const configured = await JobTreadProService.isConfigured();
      if (configured) return true;
    }

    // Fall back to Direct API
    if (typeof JobTreadAPI !== 'undefined') {
      const configured = await JobTreadAPI.isFullyConfigured();
      if (configured) return true;
    }

    return false;
  }

  /**
   * Fetch budget backups for a job
   * @param {string} jobId - Job ID
   * @returns {Promise<Array>} Array of backup objects
   */
  async function fetchBudgetBackups(jobId) {
    // Try Pro Service first
    if (typeof JobTreadProService !== 'undefined' && await JobTreadProService.isConfigured()) {
      return await fetchBackupsViaProService(jobId);
    }

    // Fall back to direct API
    if (typeof JobTreadAPI !== 'undefined' && await JobTreadAPI.isFullyConfigured()) {
      return await fetchBackupsViaDirect(jobId);
    }

    throw new Error('No API configured');
  }

  /**
   * Fetch backups via Pro Service (Cloudflare Worker)
   * @param {string} jobId - Job ID
   * @returns {Promise<Array>} Array of backup objects
   */
  async function fetchBackupsViaProService(jobId) {
    // Use raw query to fetch backups
    const query = {
      job: {
        $: { id: jobId },
        jobBudgetBackups: {
          id: true,
          createdAt: true,
          createdByUser: {
            name: true
          },
          url: {
            $: { download: true }
          }
        }
      }
    };

    const result = await JobTreadProService.paveQuery(query);

    if (!result?.job?.jobBudgetBackups) {
      return [];
    }

    return result.job.jobBudgetBackups.map(backup => ({
      id: backup.id,
      createdAt: backup.createdAt,
      createdByUser: backup.createdByUser,
      url: backup.url
    }));
  }

  /**
   * Fetch backups via direct API
   * @param {string} jobId - Job ID
   * @returns {Promise<Array>} Array of backup objects
   */
  async function fetchBackupsViaDirect(jobId) {
    const query = {
      job: {
        $: { id: jobId },
        jobBudgetBackups: {
          id: true,
          createdAt: true,
          createdByUser: {
            name: true
          },
          url: {
            $: { download: true }
          }
        }
      }
    };

    const result = await JobTreadAPI.paveQuery(query);

    if (!result?.job?.jobBudgetBackups) {
      return [];
    }

    return result.job.jobBudgetBackups.map(backup => ({
      id: backup.id,
      createdAt: backup.createdAt,
      createdByUser: backup.createdByUser,
      url: backup.url
    }));
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
  window.BudgetChangelogFeature = BudgetChangelogFeature;
}
