#!/usr/bin/env bash
# The site/ folder is deployed as a completely standalone web root
# (Vercel, Netlify, GitHub Pages all publish ONLY this folder's contents —
# nothing outside it exists on the live site). But the e-book converter
# and the logo live under extension/, shared with the browser extension.
# This script copies what the site actually needs into site/ itself, so
# the deployed site never has a dangling relative link ("../something")
# pointing outside its own folder.
#
# Run this after any change to extension/epub-tool/ or extension/src/
# and before deploying the site.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf site/epub-tool site/src
mkdir -p site/src

cp -r extension/epub-tool site/epub-tool
cp extension/src/inkbolt-core.js site/src/inkbolt-core.js
cp assets/icon.svg site/icon.svg

echo "Synced into site/:"
echo "  site/epub-tool/       <- from extension/epub-tool/"
echo "  site/src/inkbolt-core.js  <- from extension/src/inkbolt-core.js"
echo "  site/icon.svg          <- from assets/icon.svg"
