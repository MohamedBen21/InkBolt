# Inkbolt — Brand Guide

## Name

**Inkbolt.** "Ink" for text and reading, "bolt" doing double duty — it
evokes speed (a bolt of lightning) and sounds like "bold" (the actual
mechanic: bolding the lead letters of every word).

Deliberately **not** named "Bionic" anything — "Bionic Reading" is an
active registered trademark (Bionic Reading GmbH). Inkbolt implements the
same underlying fixation-guided reading idea as its own independent
product, and credits the popularized name in prose where relevant, but
never uses it as the product name itself. This also means Inkbolt is free
to stand fully on its own, unconnected to any other product's trademark or
identity — including FocusGuard, which it shares no branding with.

**Tagline:** "Bold words. Faster reading."

## Logo

A single lightning-bolt mark on a rounded-square gradient backdrop
(deep violet → near-black ink). Simple enough to stay legible down to
16×16 (browser toolbar size), distinctive enough to read at banner size.

- Source: `assets/icon.svg` — edit this file, regenerate PNGs from it.
- Extension icons: `extension/icons/icon16.png`, `icon48.png`, `icon128.png`
- Never stretch, recolor, or add effects (drop shadows, outlines) to the
  mark outside of what's defined here — keep it flat and crisp.

## Color palette

| Token | Hex | Use |
|---|---|---|
| `--bg` (Ink) | `#150f27` | Page/panel background, darkest layer |
| `--panel` | `#1c1438` | Cards, popup body, raised surfaces |
| `--accent` (Bolt) | `#ffc857` | Primary accent — buttons, the bolt mark, active states |
| `--accent-2` (Volt) | `#8b5cf6` | Secondary accent — links, gradients, highlights |
| `--text` | `#f5f3ff` | Primary text on dark backgrounds |
| `--sub` | `#a79fc9` | Secondary/muted text |
| `--line` | `#2c2350` | Borders, dividers |
| `--ok` | `#35c98a` | Success states |
| `--err` | `#ff6b6b` | Error states |

Deliberately distinct from FocusGuard's navy/lighthouse-blue system —
violet + amber reads as energetic and focused rather than nautical/calm,
which fits a "read faster" product better than a "block distractions"
one.

## Typography

System font stack everywhere inside the extension and e-book tool
(`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) —
this is a deliberate choice, not a placeholder: it keeps both surfaces
fully offline-capable with zero network dependency or CSP friction inside
a packaged browser extension.

The standalone marketing site (`site/`) isn't bound by that constraint and
uses **Sora** (Google Fonts) for headings — a geometric sans with the
kind of confident weight contrast that echoes the product's own "bold
vs. regular" mechanic.

## Voice

Direct, a little energetic, never gimmicky. Inkbolt describes what it does
in concrete terms ("bolds the lead letters of every word") rather than
over-promising ("supercharge your brain"). Feature copy stays honest about
limitations (e.g. the e-book tool's TXT-only Unicode-bold caveat is stated
plainly, not buried).

## Where the brand shows up

- Browser extension (Chrome + Firefox): icon, popup
- E-book converter page (bundled + standalone)
- `README.md` and this file, for GitHub
- `site/index.html` — marketing/info landing page
- `assets/social-preview.png` — GitHub repo social card (1280×640)
