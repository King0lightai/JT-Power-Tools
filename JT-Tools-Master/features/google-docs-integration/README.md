# Google Docs Integration Module

This module enables seamless editing of Office documents (Excel and Word) from JobTread using Google Docs/Sheets.

## Overview

**User Flow:**
1. User browses a job in JobTread (`app.jobtread.com/jobs/[job-id]`)
2. Clicks "✏️ Edit in Google Sheets/Docs" button next to an Office file
3. File opens in Google Docs/Sheets for editing
4. User makes changes
5. Clicks "💾 Save to JobTread" button in Google Docs toolbar
6. File is automatically uploaded back to JobTread

**Benefits:**
- No download/upload cycle required
- Professional editing experience (Google's editor)
- Real-time collaboration built-in
- Version history through JobTread's duplicate handling
- Zero bundle size impact (~15 KB total)

---

## Module Architecture

### auth.js - Authentication
**Purpose:** Handles OAuth2 authentication with Google Drive API

**Key Functions:**
- `authenticate()` - Request OAuth token from user
- `getToken()` - Get current token (re-authenticates if expired)
- `revokeToken()` - Sign out and revoke access
- `isAuthenticated()` - Check if user is signed in

**How it works:**
- Uses `chrome.identity` API for OAuth2
- Requests `drive.file` scope (restricted access - only sees files it creates)
- Tokens expire after 1 hour and auto-refresh

---

### ui.js - UI Components
**Purpose:** Provides modals, notifications, and dialogs

**Key Functions:**
- `showProgressModal(message)` - Loading spinner with message
- `showSuccessNotification(message)` - Green success notification
- `showErrorNotification(message)` - Red error notification
- `showConfirmDialog(title, message)` - Confirmation dialog
- `showInstructionsNotification()` - Instructions after opening file

**Features:**
- Animated slide-in notifications
- Auto-dismiss after timeout
- Consistent styling
- Non-blocking UI

---

### drive-uploader.js - Google Drive Upload
**Purpose:** Uploads files to Google Drive and converts to Google format

**Key Functions:**
- `uploadAndConvert(fileBlob, fileName, fileType)` - Upload and auto-convert
- `deleteFile(fileId)` - Delete file from Google Drive

**How it works:**
- Uses Google Drive API v3 multipart upload
- Specifies `mimeType` to trigger auto-conversion:
  - Excel → Google Sheets (`application/vnd.google-apps.spreadsheet`)
  - Word → Google Docs (`application/vnd.google-apps.document`)
- Returns Google Drive file ID for later reference

---

### drive-downloader.js - Google Drive Export
**Purpose:** Exports Google Docs/Sheets back to Office format

**Key Functions:**
- `exportToOfficeFormat(fileId, fileType)` - Export to .xlsx or .docx
- `downloadFile(blob, fileName)` - Download file to user's computer

**How it works:**
- Uses Google Drive API export endpoint
- Converts back to Office format:
  - Google Sheets → .xlsx
  - Google Docs → .docx
- Returns Blob for upload or download

---

### jobtread-uploader.js - JobTread Upload
**Purpose:** Uploads files back to JobTread

**Key Functions:**
- `uploadToJobTread(fileBlob, fileName)` - Upload file to JobTread

**How it works:**
- Finds hidden file input in JobTread's toolbar
- Creates File object with proper MIME type
- Sets input.files using DataTransfer API
- Triggers change event to initiate upload
- Waits for file to appear in file list

**Important:** Uses same filename so JobTread's duplicate handling kicks in

---

### workflow.js - Workflow Orchestrator
**Purpose:** Coordinates the entire edit workflow

**Key Functions:**
- `openInGoogleDocs(fileName, fileUrl, fileType)` - Start editing workflow
- `saveToJobTread(googleFileId)` - Save back to JobTread
- `isJobPage()` - Check if on a job page
- `getJobId()` - Extract job ID from URL

**Workflow Steps (Open):**
1. Verify user is on a job page
2. Authenticate with Google
3. Fetch file from JobTread
4. Upload to Google Drive (auto-converts)
5. Store context in chrome.storage.local
6. Open in Google Docs/Sheets
7. Show instructions

**Workflow Steps (Save):**
1. Retrieve context from storage
2. Verify user is on correct job (safety check)
3. Export from Google Drive to Office format
4. Upload to JobTread
5. Delete temporary file from Google Drive
6. Clear context
7. Show success message

**Context Storage:**
```javascript
{
  jobId: "abc123",                  // JobTread job ID
  originalFileName: "Budget.xlsx",  // Original filename
  originalFileUrl: "https://...",   // Download URL
  fileType: "spreadsheet",          // 'spreadsheet' or 'document'
  googleFileId: "xyz789",           // Google Drive file ID
  timestamp: 1699123456789          // When opened
}
```

---

### detector.js - File Detector
**Purpose:** Detects Office files on JobTread and adds edit buttons

**Key Functions:**
- `init()` - Start detector
- `cleanup()` - Stop detector
- `detectOfficeFiles()` - Find Office files and add buttons

**How it works:**
- Only runs on job pages (`app.jobtread.com/jobs/[job-id]`)
- Finds download links for .xlsx, .xls, .docx, .doc files
- Adds "✏️ Edit in Google Sheets/Docs" button next to each
- Uses MutationObserver to detect dynamic content (React)
- Marks processed links to avoid duplicates

**Button Click:**
1. Disable button (prevent double-click)
2. Call `GoogleDocsWorkflow.openInGoogleDocs()`
3. Show error notification if fails
4. Re-enable button on error

---

### google-docs-injector.js - Google Docs Button Injector
**Purpose:** Injects "Save to JobTread" button in Google Docs interface

**Key Functions:**
- `init()` - Check if file was opened by extension and inject button
- `injectSaveButton(fileId, context)` - Add button to toolbar

**How it works:**
- Only runs on docs.google.com
- Extracts file ID from URL
- Checks chrome.storage.local for context
- If file was opened by extension:
  - Waits for Google Docs toolbar to load
  - Injects "💾 Save to JobTread" button
  - Shows reminder notification

**Button Click:**
1. Disable button (prevent double-click)
2. Call `GoogleDocsWorkflow.saveToJobTread()`
3. On success: Change to "✓ Saved"
4. On error: Re-enable button

---

## File Type Detection

**Supported:**
- `.xlsx` → Google Sheets
- `.xls` → Google Sheets
- `.docx` → Google Docs
- `.doc` → Google Docs

**Not Supported:**
- `.pdf` (no conversion available)
- `.pptx` (could add PowerPoint support later)
- `.csv` (could add, but simple enough to edit directly)

---

## Security & Privacy

**OAuth Scope:**
- Uses `https://www.googleapis.com/auth/drive.file`
- **Restricted scope** - only sees files IT creates
- Cannot access user's existing Google Drive files
- Cannot browse Google Drive

**Data Flow:**
1. File: JobTread → Extension → Google Drive
2. User edits in Google Docs
3. File: Google Drive → Extension → JobTread
4. Temporary file deleted from Google Drive

**Data Retention:**
- Zero retention in extension
- Temporary file in Google Drive (deleted after save)
- Context in chrome.storage.local (cleared after save)

---

## Error Handling

**Fallback Strategy:**
If upload to JobTread fails:
1. Download file to user's computer
2. Show notification with instructions
3. User manually uploads to JobTread
4. Still better than current download/edit/upload workflow

**Common Errors:**
- **"Not authenticated"** → User needs to sign in with Google
- **"Wrong job"** → User switched jobs, need to go back
- **"Upload input not found"** → Not on Files tab
- **"Upload timeout"** → Upload may have worked, check JobTread

---

## Testing Checklist

**Phase 1 - Authentication:**
- [ ] OAuth consent screen appears
- [ ] User can sign in with Google account
- [ ] Token is stored and reused
- [ ] Token refresh works after expiry

**Phase 2 - Open in Google Docs:**
- [ ] Button appears next to Excel files
- [ ] Button appears next to Word files
- [ ] Clicking button opens Google Sheets for Excel
- [ ] Clicking button opens Google Docs for Word
- [ ] File content is correct
- [ ] Formatting is preserved
- [ ] "Save to JobTread" button appears in toolbar

**Phase 3 - Save to JobTread:**
- [ ] Clicking "Save" uploads file
- [ ] File appears in JobTread file list
- [ ] File content matches edits
- [ ] Old version is hidden (duplicate handling)
- [ ] Temporary file deleted from Google Drive
- [ ] Google Docs tab closes

**Phase 4 - Error Handling:**
- [ ] Shows error if not on job page
- [ ] Shows error if wrong job
- [ ] Downloads file if upload fails
- [ ] Re-enables button on error

---

## Known Limitations

1. **Requires Google account** - Users must be signed into Google
2. **Temporary file in Google Drive** - Deleted after save, but briefly exists
3. **JobTread duplicate handling** - Relies on JobTread hiding duplicates
4. **File size limits** - Very large files (100MB+) may timeout
5. **Complex Excel features** - Charts, pivots may not convert perfectly (Google's limitation)

---

## Future Enhancements

**Short-term:**
- Add progress indicator during upload
- Show file size before opening
- Warn if file is very large

**Medium-term:**
- Support PowerPoint (.pptx)
- Support CSV files
- Add "Preview" mode (view-only)

**Long-term:**
- Real-time collaboration indicator
- Version comparison tool
- Direct link sharing from JobTread

---

## Debugging

**Enable verbose logging:**
All modules log to console with prefixes:
- `GoogleAuth: ...`
- `DriveUploader: ...`
- `DriveDownloader: ...`
- `JobTreadUploader: ...`
- `GoogleDocsWorkflow: ...`
- `GoogleDocsFileDetector: ...`
- `GoogleDocsInjector: ...`

**Check context storage:**
```javascript
chrome.storage.local.get(null, (items) => {
  console.log('All stored contexts:', items);
});
```

**Common issues:**
- Button not appearing: Check if on job page and file type is supported
- Authentication fails: Check OAuth client ID in manifest.json
- Upload fails: Check network tab for errors, verify CSRF token

---

## Dependencies

**Chrome APIs:**
- `chrome.identity` - OAuth authentication
- `chrome.storage.local` - Context storage

**Google APIs:**
- Google Drive API v3 - File upload/download/export/delete
- OAuth 2.0 - Authentication

**No external libraries!** All code is vanilla JavaScript.

---

## Bundle Size

| Module | Approx Size | Purpose |
|--------|------------|---------|
| auth.js | ~2 KB | OAuth handling |
| ui.js | ~3 KB | Modals & notifications |
| drive-uploader.js | ~3 KB | Upload to Drive |
| drive-downloader.js | ~2 KB | Export from Drive |
| jobtread-uploader.js | ~2 KB | Upload to JobTread |
| workflow.js | ~3 KB | Orchestration |
| detector.js | ~3 KB | Button injection (JT) |
| google-docs-injector.js | ~3 KB | Button injection (GD) |
| **Total** | **~21 KB** | Minified ~15 KB |

**vs. Inline Editor:** Would be ~1 MB (67x larger!)

---

## Credits

Built for JT Power Tools extension to enhance JobTread productivity.
