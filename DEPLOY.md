# Deploying the site & submitting to the stores

Everything up to this point is prepared and tested — this doc is the
remaining manual steps that need your accounts/payment, which nothing
automated can do on your behalf.

## 1. Host the site (pick one — all free)

**Important — run this first, and again after any change to
`extension/epub-tool/`, `extension/src/inkbolt-core.js`, or
`assets/icon.svg`:**
```
./sync-site-assets.sh
```
Why: `site/` gets deployed as a completely standalone web root — Vercel,
Netlify, and GitHub Pages all publish *only* that folder's contents,
nothing outside it. But the e-book converter and the logo normally live
under `extension/`, shared with the browser extension. This script
copies what the site actually needs (the converter + its vendored
libraries, the core engine, the logo) into `site/` itself, so the
deployed site never has a broken link pointing outside its own folder.
GitHub Pages runs this automatically as part of its deploy — Vercel and
Netlify CLI deploys don't, so run it yourself first.

**Option A — Vercel (fastest)**
```
npm i -g vercel
cd site
vercel --prod
```
Follow the prompts (link or create a project). Vercel prints your live
URL — something like `https://inkbolt.vercel.app`, or attach a custom
domain afterward from the Vercel dashboard. `site/vercel.json` is already
set up.

**Option B — Netlify**
```
npm i -g netlify-cli
cd site
netlify deploy --prod
```
`site/netlify.toml` is already set up. Netlify gives you a URL like
`https://inkbolt.netlify.app`.

**Option C — GitHub Pages (free, no CLI needed)**
1. Push this repo to GitHub if you haven't already.
2. Repo Settings → Pages → Source → select **"GitHub Actions"**.
3. Push to `main` (or click "Run workflow" on the
   `Deploy site to GitHub Pages` action under the Actions tab).
4. Your site appears at `https://<your-username>.github.io/<repo-name>/`.

Any of these work — the store submission forms just need a stable HTTPS
URL for the privacy policy page.

## 2. Update the privacy policy URL

Once you have a real URL, replace the placeholder in two places:

- `STORE_LISTING.md` — the `Privacy policy URL` line
- Paste the same URL (yourdomain/privacy.html) directly into the Chrome
  Web Store / AMO submission forms in the steps below

## 3. Submit to the Chrome Web Store ($5 one-time developer fee)

1. Run `extension/build.sh` if you haven't recently — it now generates
   `extension/dist/inkbolt-chrome-v1.0.0.zip` automatically (version
   number comes from `manifest.chrome.json`, so it stays in sync).
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   pay the one-time $5 fee if this is your first submission.
3. "New item" → upload `inkbolt-chrome-v1.0.0.zip`.
4. Fill in the store listing using `STORE_LISTING.md`:
   - Short description (already under the 132-char limit)
   - Full description
   - Category: Accessibility
   - Upload the images from `assets/store/`: `screenshot-1280x800.png`,
     `promo-small-440x280.png`, `promo-marquee-1400x560.png`
5. Privacy practices tab: paste your hosted privacy policy URL, and use
   the permission justifications table in `STORE_LISTING.md` for the
   `storage` / `activeTab` / host-permission fields.
6. Submit for review (typically a few days to ~2 weeks for a first
   submission).

## 4. Submit to Firefox AMO (free)

1. Same `build.sh` also generates `extension/dist/inkbolt-firefox-v1.0.0.zip`.
2. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/),
   sign in, "Submit a New Add-on".
3. Choose "On this site" (listed publicly) or "On your own" (unlisted,
   self-distributed) depending on preference — listed is recommended for
   discoverability.
4. Upload `inkbolt-firefox-v1.0.0.zip`.
5. Fill in the listing using the AMO-specific summary in
   `STORE_LISTING.md` (already trimmed to the 250-char limit) and the
   full description.
6. AMO runs an automated validation pass immediately, then a human review
   — typically faster than Chrome's.

## 5. After both are live

- Update `site/index.html`'s hero CTA buttons (currently pointing at
  "How it works" and the e-book converter) to link to the real Chrome
  Web Store and AMO listing pages once approved.
- Update the README's "Try it right now" section the same way, so new
  visitors can install directly instead of loading the dev build.

## Re-submitting updates later

Bump the `version` field in both `manifest.chrome.json` and
`manifest.firefox.json`, run `build.sh` (it names the zips after that
version automatically), and upload the new zip as an update in each
store's dashboard — you don't need a new listing.
