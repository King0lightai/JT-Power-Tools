# JT Power Tools - Firefox Build Instructions

## Overview

This extension uses a simple build script that swaps the Chrome MV3 manifest for a Firefox MV2 manifest. No code is transpiled, minified, bundled, or machine-generated. All source JavaScript, CSS, and HTML files are included as-is in the final build.

## Requirements

- **Operating System:** macOS, Linux, or Windows (with Bash/WSL)
- **Bash:** Version 4.0+ (pre-installed on macOS/Linux)
- **zip:** Standard zip utility (pre-installed on macOS/Linux; on Windows use WSL or install via package manager)
- **No additional dependencies** (no Node.js, npm, or other tools required)

## Build Steps

1. Open a terminal in the root of this source directory.

2. Make the build script executable (if needed):
   ```bash
   chmod +x build-firefox.sh
   ```

3. Run the build script with the `--zip` flag:
   ```bash
   ./build-firefox.sh --zip
   ```

4. The output zip will be created at:
   ```
   build/jt-power-tools-firefox-v<VERSION>.zip
   ```

## What the Build Script Does

1. Copies all files from `JT-Tools-Master/` into `build/firefox/`
2. Replaces `manifest.json` (Chrome MV3) with `manifest.firefox.json` (Firefox MV2 with gecko ID and browser_specific_settings)
3. Removes the now-redundant `manifest.firefox.json` from the build directory
4. Packages the build directory into a `.zip` file

No source code is modified, transpiled, or generated during this process. The only change is the manifest swap.

## Third-Party Libraries

- **browser-polyfill.js** (`utils/browser-polyfill.js`) — Mozilla's WebExtension browser API polyfill (open-source, MPL-2.0). Source: https://github.com/nicolo-ribaudo/webextension-polyfill

## Source Code Structure

```
JT-Tools-Master/           # Extension source files
├── manifest.json           # Chrome MV3 manifest
├── manifest.firefox.json   # Firefox MV2 manifest (used by build script)
├── background/             # Background/service worker scripts
├── features/               # Feature modules (all plain JS)
├── popup/                  # Popup UI (HTML, CSS, JS)
├── styles/                 # CSS stylesheets
├── utils/                  # Utility scripts
├── config/                 # Configuration files
├── services/               # API and license service modules
└── icons/                  # Extension icons
build-firefox.sh            # Build script
BUILD_INSTRUCTIONS.md       # This file
```
