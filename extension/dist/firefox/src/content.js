/**
 * content.js
 * Injected on every page. Walks text nodes, applies Inkbolt's bold-prefix
 * transform via InkboltCore, and reverses it cleanly on toggle-off.
 *
 * Design notes:
 * - We wrap each processed text node in a <span data-inkbolt-wrap="1">
 *   and stash the ORIGINAL text on the node itself (dataset.original)
 *   so revert is exact and lossless.
 * - We never process: script, style, noscript, textarea, input,
 *   [contenteditable], code, pre, svg, and anything already wrapped.
 * - MutationObserver is debounced and processing is chunked with
 *   requestIdleCallback so we don't jank scrolling / SPA rendering.
 */

(function () {
  'use strict';

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'CODE', 'PRE', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'VIDEO', 'AUDIO',
  ]);

  const WRAP_ATTR = 'data-inkbolt-wrap';

  // Class-name fragments used by common icon fonts. Text inside these
  // elements isn't prose — it's a ligature name (e.g. "home", "search")
  // that a special font substitutes for an icon glyph. Splitting that
  // text across multiple <span> elements (some bold, some not) breaks
  // the ligature, and the browser falls back to a plain font showing the
  // literal letters — which looks exactly like "the font changed".
  const ICON_CLASS_HINTS = [
    'material-icons', 'material-symbols', 'fa-', ' fa ', 'fas ', 'far ',
    'fal ', 'fab ', 'font-awesome', 'glyphicon', 'ion-', 'iconify',
    'bi-', 'octicon', 'remix-icon', 'ri-', 'ti-', 'icomoon', 'feather',
    'dashicons', 'wp-menu-image', 'themify-icon',
  ];

  function looksLikeIconElement(el) {
    if (!el || !el.className || typeof el.className !== 'string') return false;
    const cls = ` ${el.className.toLowerCase()} `;
    return ICON_CLASS_HINTS.some((hint) => cls.includes(hint));
  }

  // Extra safety net for icon fonts that don't use a recognizable class
  // name: check the actually-computed font-family. Only meaningful on a
  // live, rendered page (not available for detached/parsed documents).
  const ICON_FONT_FAMILY_HINTS = [
    'material icons', 'material symbols', 'font awesome', 'fontawesome',
    'glyphicons', 'ionicons', 'icomoon', 'dashicons', 'feather',
  ];

  function looksLikeIconFont(el) {
    if (!el || typeof window.getComputedStyle !== 'function') return false;
    try {
      const family = window.getComputedStyle(el).fontFamily;
      if (!family) return false;
      const lower = family.toLowerCase();
      return ICON_FONT_FAMILY_HINTS.some((hint) => lower.includes(hint));
    } catch (e) {
      return false;
    }
  }

  let settings = {
    globalEnabled: true,
    siteDisabled: [], // hostnames where the extension is off
    ratio: 0.5,
  };

  let enabledOnThisPage = false;
  let observer = null;
  let idleQueue = [];
  let idleScheduled = false;

  function hostname() {
    try { return location.hostname; } catch (e) { return ''; }
  }

  function isSiteDisabled() {
    return settings.siteDisabled.includes(hostname());
  }

  function shouldSkip(el) {
    if (!el) return true;
    if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
    if (el.isContentEditable) return true;
    if (el.closest && el.closest(`[${WRAP_ATTR}]`)) return true;
    if (looksLikeIconElement(el)) return true;
    if (looksLikeIconFont(el)) return true;
    return false;
  }

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue;
        if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (shouldSkip(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function wrapTextNode(textNode) {
    const original = textNode.nodeValue;
    const wrapper = document.createElement('span');
    wrapper.setAttribute(WRAP_ATTR, '1');
    wrapper.dataset.original = original;
    wrapper.appendChild(
      window.InkboltCore.buildBionicFragment(original, { ratio: settings.ratio })
    );
    textNode.parentNode.replaceChild(wrapper, textNode);
  }

  function processChunk(nodes, i) {
    const CHUNK = 150;
    const end = Math.min(i + CHUNK, nodes.length);
    for (let j = i; j < end; j++) {
      const node = nodes[j];
      // Node may have been detached by the time we get to it (dynamic pages)
      if (node.parentNode) wrapTextNode(node);
    }
    if (end < nodes.length) {
      scheduleIdle(() => processChunk(nodes, end));
    }
  }

  function scheduleIdle(fn) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 500 });
    } else {
      setTimeout(fn, 16);
    }
  }

  function applyToRoot(root) {
    const nodes = collectTextNodes(root);
    if (nodes.length) processChunk(nodes, 0);
  }

  function revertAll() {
    const wrappers = document.querySelectorAll(`[${WRAP_ATTR}]`);
    wrappers.forEach((wrapper) => {
      const original = wrapper.dataset.original ?? '';
      const textNode = document.createTextNode(original);
      wrapper.parentNode.replaceChild(textNode, wrapper);
    });
  }

  function startObserving() {
    if (observer) return;
    let pending = [];
    let debounceTimer = null;

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
            pending.push(n);
          }
        });
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const roots = pending.splice(0, pending.length);
        roots.forEach((r) => {
          if (r.nodeType === Node.TEXT_NODE) {
            if (r.parentNode && !shouldSkip(r.parentElement) && r.nodeValue.trim()) {
              wrapTextNode(r);
            }
          } else if (!shouldSkip(r)) {
            applyToRoot(r);
          }
        });
      }, 200);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function enable() {
    if (enabledOnThisPage) return;
    enabledOnThisPage = true;
    applyToRoot(document.body);
    startObserving();
  }

  function disable() {
    if (!enabledOnThisPage) return;
    enabledOnThisPage = false;
    stopObserving();
    revertAll();
  }

  function reapplyWithNewRatio() {
    // Simplest correct approach: revert then re-apply with new settings.
    if (!enabledOnThisPage) return;
    revertAll();
    applyToRoot(document.body);
  }

  function evaluateAndRun() {
    if (settings.globalEnabled && !isSiteDisabled()) {
      enable();
    } else {
      disable();
    }
  }

  function loadSettingsAndStart() {
    chrome.storage.sync.get(
      { globalEnabled: true, siteDisabled: [], ratio: 0.5 },
      (stored) => {
        settings = stored;
        evaluateAndRun();
      }
    );
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let ratioChanged = false;
    if (changes.globalEnabled) settings.globalEnabled = changes.globalEnabled.newValue;
    if (changes.siteDisabled) settings.siteDisabled = changes.siteDisabled.newValue;
    if (changes.ratio) {
      settings.ratio = changes.ratio.newValue;
      ratioChanged = true;
    }
    evaluateAndRun();
    if (ratioChanged) reapplyWithNewRatio();
  });

  // Allow the popup to ask for the current page's status directly.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'INKBOLT_GET_STATUS') {
      sendResponse({
        hostname: hostname(),
        enabledOnThisPage,
        globalEnabled: settings.globalEnabled,
        siteDisabled: isSiteDisabled(),
      });
    }
    return true;
  });

  loadSettingsAndStart();
})();
