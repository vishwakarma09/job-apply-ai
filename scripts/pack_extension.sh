#!/bin/bash
set -e

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXT_DIR="$ROOT_DIR/browser-extension"
OUTPUT_ZIP="$ROOT_DIR/job-apply-extension.zip"

echo "======================================"
echo " Packaging Chrome Extension ..."
echo "======================================"

# Clean existing zip
if [ -f "$OUTPUT_ZIP" ]; then
    rm "$OUTPUT_ZIP"
fi

cd "$EXT_DIR"

# Zip contents, excluding temp profiles, playwright captures, metadata, and hidden files
zip -r "$OUTPUT_ZIP" . \
  -x "temp_chrome_profile/*" \
  -x "**/steps_captured/*" \
  -x "*.DS_Store" \
  -x "*/.DS_Store" \
  -x "_metadata/*" \
  -x "**/.*"

echo ""
echo "✅ Extension packaged successfully!"
echo "Package located at: $OUTPUT_ZIP"
echo "Package size: $(du -sh "$OUTPUT_ZIP" | cut -f1)"
