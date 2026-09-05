# Inkbolt — Store Listing Copy

Reference copy for Chrome Web Store and Firefox AMO submission forms.
Character limits noted where the store enforces them.

---

## Extension name
Inkbolt — Read Faster
_(matches `manifest.json` "name")_

## Short description (Chrome: 132 char max)
Bolds the first letters of every word so you read faster and stay
focused. No font changes. Works on any site, and on your e-books too.

_(131 characters)_

## Firefox AMO summary (250 char max)
Inkbolt bolds the leading letters of each word on any page, helping your
eyes anchor and your brain fill in the rest — faster reading, sharper
focus. No font or layout changes. Includes a built-in EPUB/TXT e-book
converter.

_(249 characters)_

## Full / detailed description

**Bold words. Faster reading.**

Inkbolt bolds the leading letters of every word on the page — your eyes
anchor on fewer fixation points, and your brain fills in the rest. It's
the same fixation-guided reading idea popularized as "Bionic Reading,"
implemented independently by Inkbolt.

**What makes Inkbolt different:**

✅ **Only font-weight changes — ever.** Font-family, size, and line-height
stay exactly as the site intended. Inkbolt never swaps fonts or breaks
layouts.

✅ **Works on live content.** Search results, infinite-scroll feeds,
single-page apps — Inkbolt watches for new content as it loads, no
refresh needed.

✅ **Full control.** A global on/off switch, per-site toggles, and a
bold-intensity slider so you can tune it exactly how you like it — or
turn it off entirely on sites where you don't want it.

✅ **Convert your e-books, too.** A built-in converter (right in the
popup) bolds the text inside EPUB files — and keeps them as EPUB. TXT
files stay TXT, using real bold Unicode characters. PDFs stay PDFs too —
the original layout, tables, images, and colors are untouched; only the
bolded portions of each word are drawn on top, in place. Nothing is
uploaded anywhere; conversion happens entirely in your browser.

✅ **Icon-font safe.** Inkbolt detects and skips icon fonts (Font
Awesome, Material Icons, and others) so it never breaks a site's icons
into garbled text.

✅ **Private by design.** No data collection, no analytics, no network
requests. Your settings stay in your browser's own sync storage. See the
full privacy policy for details.

**Keyboard shortcut:** Ctrl+Shift+B (Cmd+Shift+B on Mac) toggles Inkbolt
on/off from anywhere.

---

## Category
Chrome Web Store: **Accessibility**
Firefox AMO: **Accessibility**

## Language
English

## Privacy policy URL
`https://inkbolt.app/privacy.html` (placeholder — update once the site is
actually hosted; see README roadmap)

## Permission justification (Chrome Web Store review form)

| Permission | Why it's needed |
|---|---|
| `storage` | Save the user's on/off state, per-site preferences, and bold-intensity setting locally. |
| `activeTab` | Let the popup query the current tab's hostname to show/toggle per-site status. |
| `<all_urls>` host permission | Inkbolt's core purpose is applying formatting to any page the user enables it on — this can't be scoped narrower without breaking that. No data leaves the browser as a result of this access. |

## Single-purpose description (Chrome Web Store requires this)
Inkbolt has a single purpose: reformatting on-page text (and user-uploaded
e-book files) to bold the leading letters of words, to aid reading speed
and focus. It does not perform any unrelated function.
