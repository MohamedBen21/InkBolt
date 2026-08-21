/**
 * background.js
 * Minimal by design. Just seeds default settings on install so the
 * content script and popup always have something to read.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      globalEnabled: true,
      siteDisabled: [],
      ratio: 0.5,
    });
  }
});
