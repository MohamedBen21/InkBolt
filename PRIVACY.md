# Inkbolt — Privacy Policy

_Last updated: August 2026_

Inkbolt does not collect, transmit, sell, or share any personal data,
browsing history, or page content. Full stop.

## What Inkbolt does on pages you visit

Inkbolt's content script reads the visible text on the current page **in
your browser only**, to apply a local visual formatting change (bolding
the leading letters of words). It never sends that text anywhere — there
is no server, no analytics endpoint, and no network request made by the
extension at all.

## What Inkbolt stores, and where

Inkbolt saves your settings — whether it's on globally, which sites you've
turned it off for, and your bold-intensity preference — using the
browser's built-in `chrome.storage.sync` API. This data:

- Stays within your browser (and syncs across your own signed-in browser
  instances, using your browser vendor's own sync infrastructure — Google's
  for Chrome, Mozilla's for Firefox)
- Is never transmitted to Inkbolt or any third party, because Inkbolt has
  no server to send it to
- Contains no browsing history, page content, or personally identifying
  information — only your feature settings

## Why Inkbolt requests broad host permissions

Inkbolt requests access to all websites (`<all_urls>`) because its entire
purpose is to work on any page you choose to enable it on — there's no way
to offer that without requesting the permission up front. The extension
does not act on this access beyond the local text-formatting described
above unless you have it turned on for that site.

## The e-book converter

The EPUB/TXT converter (bundled with the extension and also usable
standalone) runs entirely in your browser via JavaScript. Files you
convert are never uploaded anywhere — they're read, transformed, and
written back to a downloadable file locally, using the same
browser-native APIs a page uses to let you pick and save files.

## Third-party code

The e-book converter uses JSZip (MIT licensed), bundled locally with the
extension — it is not loaded from a remote server, and does not phone
home.

## Changes to this policy

If this policy ever changes, the updated version will be posted here and
in the extension's store listings, with the "last updated" date revised.

## Contact

Questions about this policy can be raised via the project's GitHub
repository issues page.
