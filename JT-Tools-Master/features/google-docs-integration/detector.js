// Google Docs Integration - File Detector Module
// Detects Office files on JobTread pages and adds "Edit in Google Docs" buttons

const GoogleDocsFileDetector = (() => {
  let observer = null;

  /**
   * Initialize the file detector
   */
  function init() {
    // Only run on job pages
    if (!GoogleDocsWorkflow.isJobPage()) {
      console.log('GoogleDocsFileDetector: Not on a job page, skipping');
      return;
    }

    const jobId = GoogleDocsWorkflow.getJobId();
    console.log(`GoogleDocsFileDetector: Activated for job ${jobId}`);

    // Detect files on initial page load
    detectOfficeFiles();

    // Watch for dynamic content changes (JobTread uses React)
    observer = new MutationObserver(() => {
      detectOfficeFiles();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Clean up the detector
   */
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    console.log('GoogleDocsFileDetector: Cleaned up');
  }

  /**
   * Detect Office files on the page and add edit buttons
   */
  function detectOfficeFiles() {
    // Find all download links for Office files
    const fileLinks = document.querySelectorAll('a[href*=".xlsx"], a[href*=".docx"], a[href*=".xls"], a[href*=".doc"]');

    fileLinks.forEach(link => {
      // Skip if we've already processed this link
      if (link.dataset.googleDocsButton === 'true') {
        return;
      }

      // Get file info
      const fileName = getFileName(link);
      const fileUrl = link.href;
      const fileType = getFileType(fileName);

      // Skip if we can't determine the file type
      if (fileType === 'unknown') {
        return;
      }

      // Add button next to the link
      addEditButton(link, fileName, fileUrl, fileType);

      // Mark as processed
      link.dataset.googleDocsButton = 'true';
    });
  }

  /**
   * Get file name from a link element
   * @param {HTMLAnchorElement} link
   * @returns {string}
   */
  function getFileName(link) {
    // Try to get filename from link text
    let fileName = link.textContent.trim();

    // If link text is empty, try to extract from URL
    if (!fileName) {
      const urlParts = link.href.split('/');
      fileName = urlParts[urlParts.length - 1];
    }

    return fileName;
  }

  /**
   * Determine file type from filename
   * @param {string} fileName
   * @returns {string} 'spreadsheet', 'document', or 'unknown'
   */
  function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();

    const typeMap = {
      'xlsx': 'spreadsheet',
      'xls': 'spreadsheet',
      'docx': 'document',
      'doc': 'document'
    };

    return typeMap[ext] || 'unknown';
  }

  /**
   * Add an "Edit in Google Docs" button next to a file link
   * @param {HTMLAnchorElement} link - File download link
   * @param {string} fileName - Name of the file
   * @param {string} fileUrl - URL to download the file
   * @param {string} fileType - 'spreadsheet' or 'document'
   */
  function addEditButton(link, fileName, fileUrl, fileType) {
    // Create button
    const button = document.createElement('button');
    button.className = 'jt-google-docs-edit-btn';

    const editorName = fileType === 'spreadsheet' ? 'Sheets' : 'Docs';
    button.innerHTML = `✏️ Edit in Google ${editorName}`;

    // Style the button to match JobTread's UI
    button.style.cssText = `
      margin-left: 8px;
      padding: 4px 12px;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background 0.2s;
    `;

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = '#3367d6';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#4285f4';
    });

    // Click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Disable button while processing
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
      const originalText = button.innerHTML;
      button.innerHTML = '⏳ Opening...';

      try {
        await GoogleDocsWorkflow.openInGoogleDocs(fileName, fileUrl, fileType);
      } catch (error) {
        console.error('GoogleDocsFileDetector: Error opening file:', error);

        GoogleDocsUI.showErrorNotification(
          `Failed to open in Google ${editorName}:\n\n${error.message}`
        );

        // Re-enable button
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.innerHTML = originalText;
      }
    });

    // Insert button after the link
    // Try to find a good insertion point
    const parent = link.parentNode;

    if (parent) {
      // If link is in a container with other buttons, add to that container
      const buttonContainer = link.closest('.flex');
      if (buttonContainer && buttonContainer.querySelector('[role="button"]')) {
        buttonContainer.appendChild(button);
      } else {
        // Otherwise, insert right after the link
        parent.insertBefore(button, link.nextSibling);
      }
    }
  }

  // Public API
  return {
    init,
    cleanup
  };
})();

// Make available globally
window.GoogleDocsFileDetector = GoogleDocsFileDetector;

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    GoogleDocsFileDetector.init();
  });
} else {
  GoogleDocsFileDetector.init();
}

console.log('GoogleDocsFileDetector: Module loaded');
