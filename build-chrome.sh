#!/bin/bash
#
# JT Power Tools - Chrome Build Script
#
# Packages the Chrome extension (MV3) into a clean build directory.
# This script:
#   1. Copies the extension source into a build directory
#   2. Removes Firefox-only files
#   3. Packages into a .zip ready for Chrome Web Store submission
#
# Usage:
#   ./build-chrome.sh          # Build into build/chrome/
#   ./build-chrome.sh --zip    # Also create .zip package
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/JT-Tools-Master"
BUILD_DIR="$SCRIPT_DIR/build/chrome"
ZIP_FLAG="${1:-}"

echo "=== JT Power Tools - Chrome Build ==="
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

# Remove Firefox-only files
echo "Removing Firefox-only files..."
rm -f "$BUILD_DIR/manifest.firefox.json"
rm -f "$BUILD_DIR/background/background.js"

echo ""
echo "Build complete: $BUILD_DIR"

# Extract version for zip filename
VERSION=$(grep '"version"' "$BUILD_DIR/manifest.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
echo "Version: $VERSION"

# Create zip if requested
if [ "$ZIP_FLAG" = "--zip" ]; then
  ZIP_FILE="$SCRIPT_DIR/build/jt-power-tools-chrome-v${VERSION}.zip"
  echo ""
  echo "Creating zip package..."
  cd "$BUILD_DIR"
  zip -r "$ZIP_FILE" . -x "*.DS_Store" -x "__MACOSX/*"
  cd "$SCRIPT_DIR"
  echo "Package created: $ZIP_FILE"
fi

echo ""
echo "=== Chrome build ready ==="
