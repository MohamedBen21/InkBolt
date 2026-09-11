(function () {
  'use strict';

  const globalToggle = document.getElementById('globalToggle');
  const siteToggle = document.getElementById('siteToggle');
  const siteLabel = document.getElementById('siteLabel');
  const siteSub = document.getElementById('siteSub');
  const ratioSlider = document.getElementById('ratioSlider');
  const statusMsg = document.getElementById('statusMsg');
  const headerDot = document.getElementById('headerDot');

  let currentHostname = '';

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
    });
  }

  function getStorage() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { globalEnabled: true, siteDisabled: [], ratio: 0.5 },
        resolve
      );
    });
  }

  function setStorage(obj) {
    return new Promise((resolve) => chrome.storage.sync.set(obj, resolve));
  }

  function flash(msg) {
    statusMsg.textContent = msg;
    setTimeout(() => { if (statusMsg.textContent === msg) statusMsg.textContent = ''; }, 1500);
  }

  async function init() {
    const tab = await getActiveTab();
    try {
      currentHostname = new URL(tab.url).hostname;
    } catch (e) {
      currentHostname = '';
    }

    const stored = await getStorage();
    globalToggle.checked = stored.globalEnabled;
    if (headerDot) {
      headerDot.classList.toggle('disabled', !stored.globalEnabled);
    }
    ratioSlider.value = Math.round(stored.ratio * 100);
    updateRatioPreview();

    if (!currentHostname) {
      siteLabel.textContent = 'This page';
      siteSub.textContent = 'Not a website tab';
      siteSub.classList.remove('active-site');
      siteToggle.disabled = true;
    } else {
      siteLabel.textContent = currentHostname;
      const isSiteActive = !stored.siteDisabled.includes(currentHostname);
      siteSub.textContent = isSiteActive ? 'Active on this site' : 'Disabled on this site';
      siteSub.classList.toggle('active-site', isSiteActive);
      siteToggle.checked = isSiteActive;
    }
  }

  function updateRatioPreview() {
    const ratio = ratioSlider.value / 100;
    const word = 'Reading';
    const boldLen = Math.max(1, Math.round(word.length * ratio));
    document.getElementById('ratioPreview').innerHTML =
      `<span class="bold">${word.slice(0, boldLen)}</span>${word.slice(boldLen)}`;
  }

  globalToggle.addEventListener('change', async () => {
    await setStorage({ globalEnabled: globalToggle.checked });
    if (headerDot) {
      headerDot.classList.toggle('disabled', !globalToggle.checked);
    }
    flash(globalToggle.checked ? 'Enabled everywhere' : 'Disabled everywhere');
  });

  siteToggle.addEventListener('change', async () => {
    if (!currentHostname) return;
    const stored = await getStorage();
    const set = new Set(stored.siteDisabled);
    if (siteToggle.checked) {
      set.delete(currentHostname);
      siteSub.textContent = 'Active on this site';
      siteSub.classList.add('active-site');
    } else {
      set.add(currentHostname);
      siteSub.textContent = 'Disabled on this site';
      siteSub.classList.remove('active-site');
    }
    await setStorage({ siteDisabled: Array.from(set) });
    flash('Saved');
  });

  let ratioDebounce = null;
  ratioSlider.addEventListener('input', () => {
    updateRatioPreview();
    if (ratioDebounce) clearTimeout(ratioDebounce);
    ratioDebounce = setTimeout(async () => {
      await setStorage({ ratio: ratioSlider.value / 100 });
      flash('Intensity saved');
    }, 250);
  });

  document.getElementById('epubToolBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('epub-tool/index.html') });
  });

  init();
})();
