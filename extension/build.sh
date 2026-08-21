#!/usr/bin/env bash
# Assembles dist/chrome and dist/firefox, each a load-ready extension folder.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/chrome dist/firefox

cp -r src icons epub-tool dist/chrome/
cp manifest.chrome.json dist/chrome/manifest.json

cp -r src icons epub-tool dist/firefox/
cp manifest.firefox.json dist/firefox/manifest.json

echo "Built:"
echo "  dist/chrome   -> load unpacked in chrome://extensions"
echo "  dist/firefox  -> load temporary add-on in about:debugging, or zip for AMO"
