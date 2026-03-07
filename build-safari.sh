#!/bin/bash
#
# JT Power Tools - Safari Build Script
#
# Converts the Chrome extension into a Safari Web Extension using
# Apple's safari-web-extension-converter tool (requires macOS + Xcode).
#
# This script:
#   1. Copies the extension source into a build directory
#   2. Runs xcrun safari-web-extension-converter to create an Xcode project
#   3. Optionally builds the project with xcodebuild
#
# Usage:
#   ./build-safari.sh              # Convert only (creates Xcode project)
#   ./build-safari.sh --build      # Convert + build (unsigned debug build)
#
# Requirements:
#   - macOS with Xcode installed
#   - Xcode Command Line Tools (xcode-select --install)
#
# Note: This script is designed to run on macOS or in a GitHub Actions
# macOS runner. It will NOT work on Windows or Linux.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/JT-Tools-Master"
BUILD_DIR="$SCRIPT_DIR/build/safari"
XCODE_PROJECT_DIR="$BUILD_DIR/xcode"
BUILD_FLAG="${1:-}"

echo "=== JT Power Tools - Safari Build ==="
echo ""

# Check for macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "ERROR: Safari builds require macOS with Xcode."
  echo "Use GitHub Actions with a macOS runner for CI builds."
  exit 1
fi

# Check for Xcode
if ! command -v xcrun &> /dev/null; then
  echo "ERROR: Xcode Command Line Tools not found."
  echo "Install with: xcode-select --install"
  exit 1
fi

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
  echo "Cleaning previous build..."
  rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$BUILD_DIR"

# Copy source files (same as Chrome, no manifest swap needed)
echo "Copying source files..."
cp -r "$SOURCE_DIR" "$BUILD_DIR/extension"

# Remove Firefox-specific files
rm -f "$BUILD_DIR/extension/manifest.firefox.json"
rm -f "$BUILD_DIR/extension/background/background.js"

# Extract version
VERSION=$(grep '"version"' "$BUILD_DIR/extension/manifest.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
echo "Version: $VERSION"

echo ""
echo "Running safari-web-extension-converter..."
echo ""

# Convert to Safari Web Extension
# --copy-resources: copies files into Xcode project (vs symlink)
# --no-open: don't auto-open in Xcode
# --force: overwrite output if exists
xcrun safari-web-extension-converter \
  --app-name "JT Power Tools" \
  --bundle-identifier "com.jtpowertools.safari" \
  --copy-resources \
  --no-open \
  --force \
  --macos-only \
  --project-location "$XCODE_PROJECT_DIR" \
  "$BUILD_DIR/extension"

echo ""
echo "Xcode project created at: $XCODE_PROJECT_DIR"

# Build if requested
if [ "$BUILD_FLAG" = "--build" ]; then
  echo ""
  echo "Building Safari extension (unsigned debug)..."

  # List available schemes
  SCHEME=$(xcodebuild -project "$XCODE_PROJECT_DIR/JT Power Tools/JT Power Tools.xcodeproj" -list 2>/dev/null | grep -A 10 "Schemes:" | grep -v "Schemes:" | head -1 | xargs)

  if [ -z "$SCHEME" ]; then
    SCHEME="JT Power Tools (macOS)"
    echo "Using default scheme: $SCHEME"
  else
    echo "Detected scheme: $SCHEME"
  fi

  xcodebuild build \
    -project "$XCODE_PROJECT_DIR/JT Power Tools/JT Power Tools.xcodeproj" \
    -scheme "$SCHEME" \
    -configuration Debug \
    CODE_SIGNING_ALLOWED=NO \
    2>&1 | tail -20

  echo ""
  echo "Build complete!"
fi

echo ""
echo "=== Safari build ready ==="
echo ""
echo "To test locally on macOS:"
echo "  1. Open: $XCODE_PROJECT_DIR/JT Power Tools/JT Power Tools.xcodeproj"
echo "  2. Build and run in Xcode (Cmd+R)"
echo "  3. Safari > Settings > Advanced > Show Develop menu"
echo "  4. Develop > Allow Unsigned Extensions"
echo "  5. Safari > Settings > Extensions > Enable JT Power Tools"
echo ""
echo "To submit to App Store:"
echo "  1. Requires Apple Developer Program membership (\$99/year)"
echo "  2. Set your Team ID in Xcode project settings"
echo "  3. Archive and upload via Xcode Organizer"
echo ""
