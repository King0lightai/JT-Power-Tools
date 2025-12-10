#!/bin/bash
# Build script for JT Power Tools extension
# Creates a zip file ready for Chrome Web Store and Microsoft Edge Add-ons store

set -e

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' JT-Tools-Master/manifest.json | cut -d'"' -f4)
EXTENSION_NAME="JT-Power-Tools"
OUTPUT_DIR="dist"
ZIP_NAME="${EXTENSION_NAME}-v${VERSION}.zip"

echo "Building ${EXTENSION_NAME} v${VERSION}..."

# Create dist directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Remove old zip if exists
rm -f "${OUTPUT_DIR}/${ZIP_NAME}"

# Create zip from JT-Tools-Master directory contents
# The -j option is NOT used so we preserve directory structure
# We cd into the directory so manifest.json is at the root of the zip
cd JT-Tools-Master
zip -r "../${OUTPUT_DIR}/${ZIP_NAME}" . \
    -x "*.DS_Store" \
    -x "*.git*" \
    -x "README.md"
cd ..

echo ""
echo "Build complete!"
echo "Output: ${OUTPUT_DIR}/${ZIP_NAME}"
echo ""
echo "This zip file is ready for submission to:"
echo "  - Chrome Web Store"
echo "  - Microsoft Edge Add-ons"
echo ""

# Show zip contents for verification
echo "Zip contents:"
unzip -l "${OUTPUT_DIR}/${ZIP_NAME}" | head -30
