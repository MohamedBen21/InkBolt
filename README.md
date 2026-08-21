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
      vendor/jszip.min.js  <- vendored locally, zero network dependency
    manifest.chrome.json
    manifest.firefox.json
    build.sh             <- assembles dist/chrome and dist/firefox
    icons/
  site/                <- marketing/info landing page (static, standalone)
    index.html
    style.css
  assets/
    icon.svg             <- master logo source
    social-preview.png   <- GitHub repo social card (1280x640)
  BRAND.md             <- full identity system
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
- **Same format in, same format out.** `.epub` → `.epub`, `.txt` → `.txt`.
  TXT achieves "bold" via real Unicode Mathematical Bold characters
  (distinct code points, not markup) since plain text has nothing to hold
  a `<span>`.
- **Zero network dependency where it matters.** JSZip is vendored locally
  inside `extension/epub-tool/vendor/`, both because a packaged extension
  page's CSP won't allow remote scripts by default, and because it means
  the whole tool works offline.

## Roadmap status

- ✅ Core transform engine, page-wide application, live-content watcher
  (MutationObserver), settings (global/per-site/intensity), toggle-off
  revert — all in the extension
- ✅ E-book converter: EPUB → EPUB, TXT → TXT, bundled into the extension
  and reachable from the popup
- ✅ Brand identity: name, logo, palette, applied across extension, popup,
  e-book tool, and a marketing site
- ⏭ Next up: store submission prep (Chrome Web Store $5 fee, Firefox AMO
  signing — zip `extension/dist/chrome` and `extension/dist/firefox`
  respectively), a keyboard shortcut to toggle, and hosting `site/` +
  `extension/epub-tool/` live so the marketing page's CTAs and the
  "Open the converter" link point to a real URL instead of a relative
  local path.

## Testing notes

Every change to the transform engine has been exercised end-to-end with a
jsdom harness (not just written and assumed correct) — including a real
bug caught and fixed along the way: XHTML-parsed documents keep lowercase
`tagName` (unlike live browser HTML DOM, which is always uppercase), so
the original skip-list silently missed `<pre>`/`<script>` inside EPUB
files and was bolding code. Fixed by normalizing case before comparison in
both the EPUB tool and, defensively, in the content script.
