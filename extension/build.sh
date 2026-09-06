#!/usr/bin/env bash
# Assembles dist/chrome and dist/firefox, each a load-ready extension folder,
# plus dist/inkbolt-chrome-vX.Y.Z.zip and dist/inkbolt-firefox-vX.Y.Z.zip —
# the actual files Chrome Web Store / Firefox AMO submission forms want
# (a zip of the folder's CONTENTS, with manifest.json at the zip root —
# not a zip of the folder itself, which both stores reject).
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/chrome dist/firefox

cp -r src icons epub-tool dist/chrome/
cp manifest.chrome.json dist/chrome/manifest.json

cp -r src icons epub-tool dist/firefox/
cp manifest.firefox.json dist/firefox/manifest.json

VERSION=$(python3 -c "import json; print(json.load(open('manifest.chrome.json'))['version'])")

(cd dist/chrome && zip -rq "../inkbolt-chrome-v${VERSION}.zip" . -x ".*")
(cd dist/firefox && zip -rq "../inkbolt-firefox-v${VERSION}.zip" . -x ".*")

echo "Built:"
echo "  dist/chrome   -> load unpacked in chrome://extensions"
echo "  dist/firefox  -> load temporary add-on in about:debugging"
echo "  dist/inkbolt-chrome-v${VERSION}.zip  -> upload this to Chrome Web Store"
echo "  dist/inkbolt-firefox-v${VERSION}.zip -> upload this to Firefox AMO"
