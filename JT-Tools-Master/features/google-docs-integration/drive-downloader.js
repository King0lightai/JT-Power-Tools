// Google Docs Integration - Drive Downloader Module
// Handles exporting files from Google Drive back to Office format

const DriveDownloader = (() => {

  /**
   * Export a Google Docs/Sheets file back to Office format
   * @param {string} fileId - Google Drive file ID
   * @param {string} fileType - 'spreadsheet' or 'document'
   * @returns {Promise<Blob>} File blob in Office format
   */
  async function exportToOfficeFormat(fileId, fileType) {
    const token = await GoogleAuth.getToken();

    if (!token) {
      throw new Error('Not authenticated with Google');
    }

    console.log(`DriveDownloader: Exporting file ${fileId} to ${fileType} format...`);

    // Determine export MIME type
    const exportMimeTypeMap = {
      'spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    };

    const exportMimeType = exportMimeTypeMap[fileType];
    if (!exportMimeType) {
      throw new Error(`Unsupported file type for export: ${fileType}`);
    }

    // Export file using Google Drive API
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`,
      {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('DriveDownloader: Export failed:', error);
      throw new Error(`Failed to export from Google Drive: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log(`DriveDownloader: File exported successfully (${blob.size} bytes)`);

    return blob;
  }

  /**
   * Download a file blob to the user's computer
   * @param {Blob} blob - File blob
   * @param {string} fileName - Name for the downloaded file
   */
  function downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`DriveDownloader: File downloaded as ${fileName}`);
  }

  // Public API
  return {
    exportToOfficeFormat,
    downloadFile
  };
})();

// Make available globally
window.DriveDownloader = DriveDownloader;

console.log('DriveDownloader: Module loaded');
