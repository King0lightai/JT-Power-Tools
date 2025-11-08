// Google Docs Integration - Drive Uploader Module
// Handles uploading files to Google Drive and converting to Google Docs format

const DriveUploader = (() => {

  /**
   * Upload a file to Google Drive and convert to Google Docs/Sheets format
   * @param {Blob} fileBlob - File data
   * @param {string} fileName - Name of the file
   * @param {string} fileType - 'spreadsheet' or 'document'
   * @returns {Promise<string>} Google Drive file ID
   */
  async function uploadAndConvert(fileBlob, fileName, fileType) {
    const token = await GoogleAuth.getToken();

    if (!token) {
      throw new Error('Not authenticated with Google');
    }

    console.log(`DriveUploader: Uploading ${fileName} (${fileType})...`);

    // Determine MIME types for conversion
    const mimeTypeMap = {
      'spreadsheet': {
        input: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        output: 'application/vnd.google-apps.spreadsheet'
      },
      'document': {
        input: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        output: 'application/vnd.google-apps.document'
      }
    };

    const mimeTypes = mimeTypeMap[fileType];
    if (!mimeTypes) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Create metadata for Google Drive
    const metadata = {
      name: fileName,
      mimeType: mimeTypes.output // This triggers auto-conversion to Google format
    };

    // Convert blob to base64 for multipart upload
    const fileData = await blobToBase64(fileBlob);

    // Create multipart upload request
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeTypes.input + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileData.split(',')[1] + // Remove data:... prefix
      closeDelim;

    // Upload to Google Drive
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('DriveUploader: Upload failed:', error);
      throw new Error(`Failed to upload to Google Drive: ${response.status} ${response.statusText}`);
    }

    const file = await response.json();
    console.log(`DriveUploader: File uploaded successfully. ID: ${file.id}`);

    return file.id;
  }

  /**
   * Delete a file from Google Drive
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<void>}
   */
  async function deleteFile(fileId) {
    const token = await GoogleAuth.getToken();

    if (!token) {
      throw new Error('Not authenticated with Google');
    }

    console.log(`DriveUploader: Deleting file ${fileId}...`);

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (!response.ok && response.status !== 404) { // 404 is OK (already deleted)
      console.error('DriveUploader: Delete failed:', response.status);
      throw new Error(`Failed to delete file: ${response.status} ${response.statusText}`);
    }

    console.log('DriveUploader: File deleted successfully');
  }

  /**
   * Convert a Blob to base64 string
   * @param {Blob} blob - Blob to convert
   * @returns {Promise<string>} Base64 string
   */
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Public API
  return {
    uploadAndConvert,
    deleteFile
  };
})();

// Make available globally
window.DriveUploader = DriveUploader;

console.log('DriveUploader: Module loaded');
