/**
 * background.js
 * Seeds default settings on install, and handles the toggle keyboard
 * shortcut (see "commands" in the manifest).
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

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-global') return;
  chrome.storage.sync.get({ globalEnabled: true }, (stored) => {
    chrome.storage.sync.set({ globalEnabled: !stored.globalEnabled });
  });
});
