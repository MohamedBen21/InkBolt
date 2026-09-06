# Inkbolt

**Bold words. Faster reading.**

Inkbolt bolds the leading letters of every word — on any web page, or
inside your EPUB/TXT files — so your eyes anchor on fewer fixation points
and your brain fills in the rest. No font changes, no layout shifts.

Independent product, independent identity — unrelated to any other project.
See `BRAND.md` for the full identity system (name rationale, palette,
logo, typography).

## What's in this repo

```
inkbolt/
  extension/          <- Chrome + Firefox browser extension
    src/
      inkbolt-core.js   <- the transform engine (shared by everything below)
      content.js        <- page-wide DOM application + live-content watcher
      background.js
      popup.html/js/css
    epub-tool/          <- bundled e-book converter (also standalone-capable)
      index.html
      app.js
      style.css
      vendor/
        jszip.min.js       <- vendored, zero network dependency
        pdf.min.js         <- pdf.js, for reading PDFs + rendering pages
        pdf.worker.min.js
        pdf-lib.min.js     <- for editing/writing PDFs in place
        standard_fonts/    <- required by pdf.js to render non-embedded
                              standard fonts (Helvetica, etc.) to canvas
    manifest.chrome.json
    manifest.firefox.json
    build.sh             <- assembles dist/chrome, dist/firefox, AND the
                              upload-ready dist/inkbolt-{chrome,firefox}-vX.Y.Z.zip
    icons/
  site/                <- marketing/info landing page (static, standalone)
    index.html
    privacy.html
    style.css
    vercel.json          <- one-command deploy: `vercel --prod` from site/
    netlify.toml          <- one-command deploy: `netlify deploy --prod`
  sync-site-assets.sh  <- copies the e-book converter + core engine + logo
                            into site/ so it deploys as a self-contained
                            folder (run before any Vercel/Netlify deploy;
                            GitHub Pages runs it automatically)
  .github/workflows/
    ci.yml                <- syntax-checks + builds the extension on every push
    deploy-site.yml        <- auto-deploys site/ to GitHub Pages on push
  assets/
    icon.svg             <- master logo source
    social-preview.png   <- GitHub repo social card (1280x640)
    store/
      screenshot-1280x800.png
      promo-small-440x280.png
      promo-marquee-1400x560.png
  BRAND.md             <- full identity system
  PRIVACY.md           <- privacy policy (also hosted at site/privacy.html)
  STORE_LISTING.md     <- Chrome Web Store / AMO listing copy
  DEPLOY.md            <- exact remaining steps: hosting + store submission
  README.md            <- this file
```

## Try it right now

**Chrome / Edge / Brave:**
1. `chrome://extensions` → enable Developer mode → "Load unpacked"
2. Select `extension/dist/chrome`

**Firefox:**
1. `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on"
2. Pick `manifest.json` inside `extension/dist/firefox`

**E-book converter (standalone, no install):**
Open `extension/epub-tool/index.html` directly in a browser. It's also
reachable from inside the extension's popup via the "Convert an e-book"
button.

**Marketing site (standalone):**
Open `site/index.html` directly, or host the `site/` folder anywhere
static (Vercel, GitHub Pages, Netlify).

If you edit anything under `extension/src/` or `extension/epub-tool/`, run
`extension/build.sh` again before reloading the unpacked extension.

## Design principles

- **Only `font-weight` ever changes.** Font-family, size, line-height —
  untouched, always, on every surface (live pages, EPUB, TXT).
- **One engine, no forks.** `inkbolt-core.js` is framework-agnostic (DOM
  operations only) and is the single source of truth the content script,
  the EPUB path, and the TXT path all call into.
- **TXT stays TXT via real Unicode bold.** No markup exists in plain
  text, so bolding uses actual Unicode Mathematical Bold characters
  (distinct code points, not styling) — the file stays genuinely plain
  text.
- **Same format in, same format out — including PDF's actual layout.**
  `.epub` → `.epub`, `.txt` → `.txt`, `.pdf` → `.pdf`, all keeping their
  original layout, fonts, tables, images, and colors. The PDF path loads
  the *original* file via pdf-lib (not a fresh blank document) and draws
  bold-prefix text directly on top of the existing content, in place —
  it never rebuilds pages from scratch. To do this correctly even on
  colored backgrounds (table headers, logos, etc.), each page is rendered
  once to an offscreen canvas so the real background and ink color behind
  every bold span can be sampled and matched (using a median over many
  edge pixels, not just 4 corners — a single stray pixel on a diacritic
  or antialiased edge was enough to skew a small average toward a visible
  gray box). Word positions are found by scanning the rendered pixels for
  actual ink columns rather than trusting font-metric estimates: real
  documents essentially never use one of the 14 standard PDF fonts we can
  embed for measurement (this one uses "Outfit-Bold" and "Bitter-Regular"),
  and metric estimates drift increasingly across a long string when the
  assumed and actual fonts have different relative letter widths — pixel
  detection is measured from what's actually rendered, so it stays
  accurate regardless of the real font. Text already set in a bold font
  (headings, typically) is left untouched entirely — there's no
  meaningful weight contrast left to add, and it's the one case where a
  substitute bold typeface's shape can visibly differ from the original at
  a glance. Font extraction (reusing the document's own embedded font
  instead of a substitute) was evaluated and rejected: PDF-embedded
  subsetted fonts commonly omit the `cmap` table entirely, since the PDF's
  own CID encoding addresses glyphs directly — reusing them would mean
  bypassing standard text-shaping APIs for raw glyph-ID manipulation,
  which is a real, standard technique in dedicated PDF-editing libraries
  but is a poor fit for "simple and robust" here. A substitute standard
  font is also what real-world PDF annotation/highlighting tools
  typically use for overlay content, for the same reliability reason.
  Scanned/image-only pages are detected and left completely untouched —
  no edits, no notice drawn on them.
- **Zero network dependency where it matters.** JSZip, pdf.js, pdf-lib,
  and pdf.js's standard font data are all vendored locally inside
  `extension/epub-tool/vendor/`, both because a packaged extension page's
  CSP won't allow remote scripts by default, and because it means the
  whole tool works offline.

## Roadmap status

- ✅ Core transform engine, page-wide application, live-content watcher
  (MutationObserver), settings (global/per-site/intensity), toggle-off
  revert — all in the extension
- ✅ E-book converter: EPUB → EPUB, TXT → TXT, and PDF → PDF with the
  original layout/tables/images fully preserved (see design principles
  above), bundled into the extension and reachable from the popup
- ✅ Brand identity: name, logo, palette, applied across extension, popup,
  e-book tool, and a marketing site
- ✅ Icon-font protection: detects and skips Font Awesome/Material Icons/etc.
  so ligatures never get broken into garbled fallback-font text
- ✅ Keyboard shortcut (Ctrl+Shift+B / Cmd+Shift+B) to toggle globally
- ✅ Store submission prep: privacy policy (`PRIVACY.md` + hosted
  `site/privacy.html`), listing copy (`STORE_LISTING.md`), and required
  promotional images (`assets/store/`)
- ✅ Deployment prep: one-click hosting configs for the marketing site
  (Vercel, Netlify, GitHub Pages via Actions), a CI workflow that
  syntax-checks and builds the extension on every push, and `build.sh`
  now auto-generates the actual upload-ready submission zips (with
  `manifest.json` correctly at the zip root) named after the version in
  the manifest — see `DEPLOY.md` for the exact remaining steps
- ⏭ Next up (needs your accounts/payment — see `DEPLOY.md` for the exact
  steps): actually run the deploy (`vercel --prod`, `netlify deploy
  --prod`, or push to trigger the GitHub Pages workflow), swap the
  placeholder privacy-policy URL in `STORE_LISTING.md` for the real one,
  then submit `extension/dist/inkbolt-chrome-v1.0.0.zip` to the Chrome
  Web Store ($5 one-time fee) and `extension/dist/inkbolt-firefox-v1.0.0.zip`
  to Firefox AMO (free)

## Testing notes

Every change to the transform engine has been exercised end-to-end with a
jsdom harness (not just written and assumed correct) — including a real
bug caught and fixed along the way: XHTML-parsed documents keep lowercase
`tagName` (unlike live browser HTML DOM, which is always uppercase), so
the original skip-list silently missed `<pre>`/`<script>` inside EPUB
files and was bolding code. Fixed by normalizing case before comparison in
both the EPUB tool and, defensively, in the content script.
