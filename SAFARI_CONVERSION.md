# Safari Extension Conversion Guide

## Overview

This document outlines the conversion of JT Power Tools from a Chrome-only extension to a cross-browser compatible extension that works on both Chrome and Safari.

## What Changed

### 1. Browser API Compatibility Layer

**New File:** `utils/browser-polyfill.js`

- Provides unified API wrapper for Chrome and Safari
- Automatically detects which browser API is available (`chrome.*` vs `browser.*`)
- Wraps storage, runtime, and tabs APIs with error handling
- All JavaScript files now use this polyfill for browser API calls

### 2. Safari-Compatible Manifest

**New File:** `manifest-safari.json`

- Uses Manifest V2 (Safari's preferred format)
- Converts Chrome's `service_worker` to Safari's `background.scripts`
- Combines `host_permissions` into main `permissions` array
- Changes `action` to `browser_action` (Manifest V2 naming)
- Loads browser polyfill in all content scripts and background

### 3. Safari Background Script

**New File:** `background/background-safari.js`

- Converted from Chrome's service worker format
- Uses persistent background page model
- All async/await patterns maintained
- Uses cross-browser `api` object from polyfill

### 4. Updated JavaScript Files

All JavaScript files updated to use cross-browser API:

```javascript
// Before (Chrome-only):
chrome.storage.sync.get(['key'])
chrome.runtime.sendMessage(...)
chrome.tabs.query(...)

// After (Cross-browser):
const api = typeof browser !== 'undefined' ? browser : chrome;
api.storage.sync.get(['key'])
api.runtime.sendMessage(...)
api.tabs.query(...)
```

**Modified Files:**
- `popup/popup.js` - Storage and runtime API calls
- `popup/popup.html` - Loads browser polyfill script
- `services/license.js` - Storage API calls
- `content.js` - Storage and runtime API calls

### 5. Safari-Specific CSS Prefixes

Added `-webkit-` prefixes for Safari compatibility:

**popup/popup.css:**
- `-webkit-transition` for toggle animations
- `-webkit-transform` for slider movement
- `-webkit-box` and `-webkit-flex` for flexbox
- `-webkit-appearance` for input elements

**styles/formatter-toolbar.css:**
- `-webkit-backdrop-filter` for toolbar blur effect
- `-webkit-transition` and `-webkit-transform` for animations
- `-webkit-flex` prefixes for all flexbox usage
- `-webkit-background-clip` and `-webkit-text-fill-color` for gradient text

## Browser Differences Handled

### 1. Storage API
- Chrome: `chrome.storage.sync` (Promise-based in MV3)
- Safari: `browser.storage.sync` (Promise-based)
- **Solution:** Polyfill auto-detects and uses correct API, with fallback to `local` storage if `sync` unavailable

### 2. Runtime API
- Chrome: `chrome.runtime.*`
- Safari: `browser.runtime.*`
- **Solution:** Unified wrapper supports both callback and promise patterns

### 3. Background Script
- Chrome MV3: Service worker
- Safari: Persistent background page (non-persistent preferred)
- **Solution:** Separate background scripts for each browser

### 4. Message Passing
- Both browsers support similar message passing, but timing can differ
- **Solution:** Proper error handling and promise-based async patterns

### 5. CSS Support
- Safari requires `-webkit-` prefixes for some modern CSS
- **Solution:** Dual CSS declarations with both prefixed and unprefixed versions

## File Structure

```
JT-Tools-Master/
├── manifest.json                    # Chrome Manifest V3
├── manifest-safari.json            # NEW: Safari Manifest V2
├── utils/
│   └── browser-polyfill.js         # NEW: Cross-browser API layer
├── background/
│   ├── service-worker.js           # Chrome service worker
│   └── background-safari.js        # NEW: Safari background page
├── popup/
│   ├── popup.html                  # Updated: loads polyfill
│   ├── popup.js                    # Updated: uses api object
│   └── popup.css                   # Updated: webkit prefixes
├── services/
│   └── license.js                  # Updated: uses api object
├── content.js                      # Updated: uses api object
└── styles/
    └── formatter-toolbar.css       # Updated: webkit prefixes
```

## Testing Checklist

### Chrome Testing
- [ ] Extension loads without errors
- [ ] All features work (Drag & Drop, Contrast Fix, Formatter, Dark Mode)
- [ ] Settings persist across browser restarts
- [ ] License verification works
- [ ] Popup UI renders correctly
- [ ] No console errors

### Safari Testing
- [ ] Extension loads without errors
- [ ] All features work (Drag & Drop, Contrast Fix, Formatter, Dark Mode)
- [ ] Settings persist across browser restarts
- [ ] License verification works
- [ ] Popup UI renders correctly
- [ ] No console errors
- [ ] CSS animations work smoothly
- [ ] Toolbar displays correctly

## How to Build for Safari

### Prerequisites
- macOS with Xcode installed
- Apple Developer account (for signing and distribution)

### Steps

1. **Convert to Safari Extension (using Xcode):**
   ```bash
   # Use Safari's built-in converter
   xcrun safari-web-extension-converter /path/to/JT-Tools-Master \
     --app-name "JT Power Tools" \
     --bundle-identifier "com.jobtread.powertools"
   ```

2. **Important:** Use `manifest-safari.json` as the manifest
   - Rename `manifest.json` to `manifest-chrome.json`
   - Rename `manifest-safari.json` to `manifest.json`
   - Update background script reference in manifest

3. **Open in Xcode:**
   ```bash
   open "JT Power Tools.xcodeproj"
   ```

4. **Configure Signing:**
   - Select project in Xcode
   - Go to "Signing & Capabilities"
   - Select your development team
   - Xcode will create provisioning profile

5. **Test in Safari:**
   - Product → Run (⌘R)
   - Safari will open with extension loaded
   - Enable extension in Safari preferences

## Distribution

### Chrome Web Store
- Use `manifest.json` (Manifest V3)
- Use `background/service-worker.js`
- Zip and upload to Chrome Web Store

### Safari App Store
- Use `manifest-safari.json` renamed to `manifest.json`
- Use `background/background-safari.js`
- Build in Xcode
- Submit via App Store Connect

## Known Limitations

1. **Manifest Versions:** Need to swap manifest files for each browser
2. **Background Scripts:** Need different background scripts for each browser
3. **Storage Sync:** Safari's storage.sync has lower quota than Chrome
4. **Extension Updates:** Different update mechanisms between browsers

## Maintenance Notes

### When Adding New Features:
1. Always use the `api` object (from polyfill) instead of `chrome.*` or `browser.*`
2. Test in both Chrome and Safari
3. Add `-webkit-` CSS prefixes when using modern CSS features
4. Ensure all async operations use promises (not callbacks)

### When Updating APIs:
1. Update the browser polyfill if new browser APIs are needed
2. Ensure error handling is consistent across browsers
3. Test message passing between scripts in both browsers

## Support

- **Minimum Chrome Version:** 88+ (Manifest V3)
- **Minimum Safari Version:** 14+ (Manifest V2 with promises)

## Version History

- **v3.1.0** - Safari version updated with latest features
  - Updated to match Chrome extension v3.1.0
  - Added Quick Job Switcher feature (Alt+J keyboard shortcut)
  - Added RGB Custom Theme feature
  - Included modularized Drag & Drop (6 sub-modules)
  - Updated description: "Budget Formatter" → "Text Formatter"
  - Updated background script default settings

- **v3.0.0** - Initial Safari compatibility conversion
  - Added browser API polyfill
  - Created Safari-compatible manifest
  - Added Safari background script
  - Updated all JavaScript files for cross-browser support
  - Added Safari CSS prefixes

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Safari Extension Docs](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [Browser Extension Polyfill](https://github.com/mozilla/webextension-polyfill)
- [Manifest V2 vs V3](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

**Last Updated:** 2025-11-05
**Branch:** `claude/update-safari-version-011CUoyRTPKWv3xY9rgYi6MS`
**Safari Version:** 3.1.0
