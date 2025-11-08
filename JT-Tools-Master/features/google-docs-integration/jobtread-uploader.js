// Google Docs Integration - JobTread Uploader Module
// Handles uploading files back to JobTread

const JobTreadUploader = (() => {

  /**
   * Upload a file to JobTread
   * @param {Blob} fileBlob - File data
   * @param {string} fileName - Name of the file
   * @returns {Promise<void>}
   */
  async function uploadToJobTread(fileBlob, fileName) {
    console.log(`JobTreadUploader: Uploading ${fileName} to JobTread...`);

    // Find the upload input in the toolbar
    const uploadInput = findUploadInput();

    if (!uploadInput) {
      throw new Error('Upload button not found. Make sure you\'re on the Files tab of a job.');
    }

    // Determine MIME type based on file extension
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypeMap = {
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword'
    };

    const mimeType = mimeTypeMap[ext] || 'application/octet-stream';

    // Create File object
    const file = new File([fileBlob], fileName, { type: mimeType });

    // Set file on input using DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    uploadInput.files = dataTransfer.files;

    // Trigger change event to initiate upload
    uploadInput.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('JobTreadUploader: Upload triggered, waiting for completion...');

    // Wait for upload to complete
    await waitForUploadToComplete(fileName);

    console.log(`JobTreadUploader: ✓ ${fileName} uploaded successfully`);
  }

  /**
   * Find the file upload input on the page
   * @returns {HTMLInputElement|null}
   */
  function findUploadInput() {
    // Look for the hidden file input with multiple attribute
    const uploadInput = document.querySelector('input[type="file"][multiple]');

    if (!uploadInput) {
      console.error('JobTreadUploader: Upload input not found');
      return null;
    }

    // Verify it's visible/enabled (parent button should be enabled)
    const uploadButton = uploadInput.closest('[role="button"]');
    if (uploadButton && uploadButton.classList.contains('pointer-events-none')) {
      console.error('JobTreadUploader: Upload button is disabled');
      return null;
    }

    return uploadInput;
  }

  /**
   * Wait for file to appear in the file list after upload
   * @param {string} fileName - Name of the uploaded file
   * @param {number} maxWait - Maximum time to wait in ms
   * @returns {Promise<void>}
   */
  async function waitForUploadToComplete(fileName, maxWait = 15000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        // Look for the file in the file list
        // Files appear as links with the filename as text
        const fileLinks = Array.from(document.querySelectorAll('a'));
        const fileLink = fileLinks.find(link => {
          const linkText = link.textContent.trim();
          return linkText === fileName || linkText.includes(fileName);
        });

        if (fileLink) {
          clearInterval(checkInterval);
          console.log('JobTreadUploader: File appeared in list');
          resolve();
          return;
        }

        // Check for timeout
        if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          // Don't reject - upload might still have worked
          console.warn('JobTreadUploader: Timeout waiting for file to appear (upload may still have succeeded)');
          resolve();
        }
      }, 500);
    });
  }

  // Public API
  return {
    uploadToJobTread
  };
})();

// Make available globally
window.JobTreadUploader = JobTreadUploader;

console.log('JobTreadUploader: Module loaded');
