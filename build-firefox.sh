#!/bin/bash
#
# JT Power Tools - Firefox Build Script
#
# Generates a Firefox-ready extension from the Chrome source.
# This script:
#   1. Copies the extension source into a build directory
#   2. Swaps in the Firefox-compatible manifest (MV2 with gecko ID)
#   3. Uses background.js instead of service-worker.js
#   4. Packages into a .zip ready for Firefox Add-ons submission
#
# Usage:
#   ./build-firefox.sh          # Build into build/firefox/
#   ./build-firefox.sh --zip    # Also create .zip package
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/JT-Tools-Master"
BUILD_DIR="$SCRIPT_DIR/build/firefox"
ZIP_FLAG="${1:-}"

echo "=== JT Power Tools - Firefox Build ==="
echo ""

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
  echo "Cleaning previous build..."
  rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$BUILD_DIR"

# Copy all source files
echo "Copying source files..."
cp -r "$SOURCE_DIR"/* "$BUILD_DIR/"

# Replace manifest with Firefox version
echo "Swapping manifest for Firefox (MV2)..."
rm "$BUILD_DIR/manifest.json"
cp "$BUILD_DIR/manifest.firefox.json" "$BUILD_DIR/manifest.json"
rm "$BUILD_DIR/manifest.firefox.json"

# Service worker is not used in Firefox MV2 (background.js is used instead)
# Keep both files in the build so the directory structure is preserved,
# but only background.js is referenced by the Firefox manifest.
echo "Firefox build uses background/background.js (not service-worker.js)"

echo ""
echo "Build complete: $BUILD_DIR"

# Extract version for zip filename
VERSION=$(grep '"version"' "$BUILD_DIR/manifest.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
echo "Version: $VERSION"

# Create zip if requested
if [ "$ZIP_FLAG" = "--zip" ]; then
  ZIP_FILE="$SCRIPT_DIR/build/jt-power-tools-firefox-v${VERSION}.zip"
  echo ""
  echo "Creating zip package..."
  cd "$BUILD_DIR"
  zip -r "$ZIP_FILE" . -x "*.DS_Store" -x "__MACOSX/*"
  cd "$SCRIPT_DIR"
  echo "Package created: $ZIP_FILE"
fi

echo ""
echo "=== Firefox build ready ==="
echo ""
echo "To load in Firefox:"
echo "  1. Open about:debugging#/runtime/this-firefox"
echo "  2. Click 'Load Temporary Add-on...'"
echo "  3. Select: $BUILD_DIR/manifest.json"
echo ""
echo "To submit to Firefox Add-ons:"
echo "  Run: ./build-firefox.sh --zip"
echo "  Then upload the zip at https://addons.mozilla.org/developers/"
