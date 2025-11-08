// Google Docs Integration - Workflow Orchestrator
// Coordinates the entire edit workflow from JobTread to Google Docs and back

const GoogleDocsWorkflow = (() => {

  /**
   * Check if current page is a job page
   * @returns {boolean}
   */
  function isJobPage() {
    const url = window.location.href;
    const jobPagePattern = /app\.jobtread\.com\/jobs\/[a-zA-Z0-9_-]+/;
    return jobPagePattern.test(url);
  }

  /**
   * Get the current job ID from URL
   * @returns {string|null}
   */
  function getJobId() {
    const match = window.location.pathname.match(/\/jobs\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Open a file in Google Docs/Sheets for editing
   * @param {string} fileName - Name of the file
   * @param {string} fileUrl - URL to download the file from JobTread
   * @param {string} fileType - 'spreadsheet' or 'document'
   * @returns {Promise<void>}
   */
  async function openInGoogleDocs(fileName, fileUrl, fileType) {
    // Verify we're on a job page
    if (!isJobPage()) {
      throw new Error('This feature only works within specific jobs');
    }

    const jobId = getJobId();
    console.log(`GoogleDocsWorkflow: Opening ${fileName} in Google ${fileType} for job ${jobId}`);

    const progressUI = GoogleDocsUI.showProgressModal('Opening in Google Docs...');

    try {
      // Step 1: Authenticate with Google
      progressUI.update('Authenticating with Google...');
      await GoogleAuth.authenticate();

      // Step 2: Fetch file from JobTread
      progressUI.update('Downloading file from JobTread...');
      const fileBlob = await fetchFileFromJobTread(fileUrl);

      // Step 3: Upload to Google Drive (auto-converts to Google format)
      progressUI.update(`Converting to Google ${fileType === 'spreadsheet' ? 'Sheets' : 'Docs'} format...`);
      const googleFileId = await DriveUploader.uploadAndConvert(fileBlob, fileName, fileType);

      // Step 4: Store context for later (when saving back)
      await chrome.storage.local.set({
        [`editing_${googleFileId}`]: {
          jobId: jobId,
          originalFileName: fileName,
          originalFileUrl: fileUrl,
          fileType: fileType,
          googleFileId: googleFileId,
          timestamp: Date.now()
        }
      });

      console.log('GoogleDocsWorkflow: Context stored:', {
        jobId,
        fileName,
        googleFileId
      });

      // Step 5: Open in Google Docs/Sheets
      progressUI.update('Opening editor...');
      const editorUrl = getEditorUrl(googleFileId, fileType);
      window.open(editorUrl, '_blank');

      // Close progress modal
      progressUI.close();

      // Show instructions
      GoogleDocsUI.showInstructionsNotification(googleFileId, jobId);

      console.log('GoogleDocsWorkflow: ✓ File opened successfully');

    } catch (error) {
      progressUI.close();
      console.error('GoogleDocsWorkflow: Error opening file:', error);
      throw error;
    }
  }

  /**
   * Save edited file back to JobTread
   * @param {string} googleFileId - Google Drive file ID
   * @returns {Promise<void>}
   */
  async function saveToJobTread(googleFileId) {
    console.log(`GoogleDocsWorkflow: Saving file ${googleFileId} to JobTread`);

    const progressUI = GoogleDocsUI.showProgressModal('Saving to JobTread...');

    try {
      // Get context
      const result = await chrome.storage.local.get(`editing_${googleFileId}`);
      const context = result[`editing_${googleFileId}`];

      if (!context) {
        throw new Error('Could not find file context. Please try downloading the file manually.');
      }

      console.log('GoogleDocsWorkflow: Context retrieved:', context);

      // Safety check: Verify we're on the correct job (if on JobTread)
      if (window.location.hostname.includes('jobtread.com')) {
        const currentJobId = getJobId();

        if (!currentJobId) {
          throw new Error('Not on a job page. Please navigate to the job before saving.');
        }

        if (currentJobId !== context.jobId) {
          throw new Error(
            `Wrong job!\n\nFile was opened from: ${context.jobId}\nCurrent job: ${currentJobId}\n\nPlease go back to the original job.`
          );
        }
      }

      // Step 1: Export from Google Drive
      progressUI.update('Exporting from Google Docs...');
      const fileBlob = await DriveDownloader.exportToOfficeFormat(googleFileId, context.fileType);

      // Step 2: Upload to JobTread (same filename = duplicate handling)
      progressUI.update('Uploading to JobTread...');
      try {
        await JobTreadUploader.uploadToJobTread(fileBlob, context.originalFileName);
      } catch (uploadError) {
        console.error('GoogleDocsWorkflow: Upload failed, offering download fallback');

        // Fallback: Download file
        progressUI.close();
        DriveDownloader.downloadFile(fileBlob, context.originalFileName);

        GoogleDocsUI.showErrorNotification(
          `Could not upload to JobTread automatically.\n\n` +
          `The file has been downloaded to your computer.\n\n` +
          `Please upload it manually to JobTread.`
        );

        // Still cleanup Google Drive
        await DriveUploader.deleteFile(googleFileId);
        await chrome.storage.local.remove(`editing_${googleFileId}`);

        return;
      }

      // Step 3: Cleanup Google Drive
      progressUI.update('Cleaning up...');
      await DriveUploader.deleteFile(googleFileId);

      // Step 4: Clear context
      await chrome.storage.local.remove(`editing_${googleFileId}`);

      // Success!
      progressUI.close();

      GoogleDocsUI.showSuccessNotification(
        `✓ ${context.originalFileName} saved!\n\n` +
        `Updated version is now in JobTread.\n` +
        `Previous version is in file history.`
      );

      console.log('GoogleDocsWorkflow: ✓ Save completed successfully');

      // Close Google Docs tab if we're on Google Docs
      if (window.location.hostname === 'docs.google.com') {
        setTimeout(() => window.close(), 2000);
      }

    } catch (error) {
      progressUI.close();
      console.error('GoogleDocsWorkflow: Save failed:', error);
      GoogleDocsUI.showErrorNotification(`Error saving to JobTread:\n\n${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch file from JobTread
   * @param {string} fileUrl - URL to download from
   * @returns {Promise<Blob>}
   */
  async function fetchFileFromJobTread(fileUrl) {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download file from JobTread: ${response.status} ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Get Google Docs/Sheets editor URL
   * @param {string} fileId - Google Drive file ID
   * @param {string} fileType - 'spreadsheet' or 'document'
   * @returns {string}
   */
  function getEditorUrl(fileId, fileType) {
    const baseUrls = {
      'spreadsheet': 'https://docs.google.com/spreadsheets/d/',
      'document': 'https://docs.google.com/document/d/'
    };

    return baseUrls[fileType] + fileId + '/edit';
  }

  // Public API
  return {
    openInGoogleDocs,
    saveToJobTread,
    isJobPage,
    getJobId
  };
})();

// Make available globally
window.GoogleDocsWorkflow = GoogleDocsWorkflow;

console.log('GoogleDocsWorkflow: Module loaded');
