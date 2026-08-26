/**
 * app.js — Inkbolt e-book converter
 *
 * EPUB: unzip with JSZip, walk each XHTML/HTML entry with a TreeWalker,
 * reuse the SAME inkbolt-core.js transform the extension uses, re-serialize,
 * re-zip. Nothing else in the EPUB (CSS, images, fonts, metadata) is
 * touched — only text nodes inside the book's own markup.
 *
 * TXT: no markup exists to bold within, so we generate real bold Unicode
 * characters instead — the output stays a genuine .txt file.
 */

(function () {
  'use strict';

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'CODE', 'PRE', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'VIDEO', 'AUDIO',
  ]);

  // Same icon-font class hints as the extension's content script. Some
  // EPUBs embed icon fonts (Font Awesome, Material Icons, etc.) for
  // decorative glyphs — splitting that ligature text across bold/non-bold
  // spans breaks the icon and shows literal fallback-font letters instead.
  const ICON_CLASS_HINTS = [
    'material-icons', 'material-symbols', 'fa-', ' fa ', 'fas ', 'far ',
    'fal ', 'fab ', 'font-awesome', 'glyphicon', 'ion-', 'iconify',
    'bi-', 'octicon', 'remix-icon', 'ri-', 'ti-', 'icomoon', 'feather',
    'dashicons', 'themify-icon',
  ];

  function looksLikeIconElement(el) {
    if (!el || !el.className || typeof el.className !== 'string') return false;
    const cls = ` ${el.className.toLowerCase()} `;
    return ICON_CLASS_HINTS.some((hint) => cls.includes(hint));
  }

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const ratioSlider = document.getElementById('ratioSlider');
  const ratioPreview = document.getElementById('ratioPreview');
  const progressSection = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  const progressLog = document.getElementById('progressLog');
  const resultSection = document.getElementById('result');
  const resultMsg = document.getElementById('resultMsg');
  const downloadLink = document.getElementById('downloadLink');
  const errorBox = document.getElementById('errorBox');

  function updateRatioPreview() {
    const ratio = ratioSlider.value / 100;
    const word = 'Reading';
    const boldLen = Math.max(1, Math.round(word.length * ratio));
    ratioPreview.innerHTML = `<span class="bold">${word.slice(0, boldLen)}</span>${word.slice(boldLen)}`;
  }
  ratioSlider.addEventListener('input', updateRatioPreview);
  updateRatioPreview();

  function resetUI() {
    progressSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorBox.classList.add('hidden');
    progressLog.innerHTML = '';
    progressFill.style.width = '0%';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
    progressSection.classList.add('hidden');
  }

  function logLine(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    progressLog.appendChild(li);
    progressLog.scrollTop = progressLog.scrollHeight;
  }

  function setProgress(pct, label) {
    progressFill.style.width = `${pct}%`;
    if (label) progressLabel.textContent = label;
  }

  function shouldSkip(el) {
    if (!el) return true;
    // XHTML-parsed docs (application/xhtml+xml) keep tagName in its
    // original source case (usually lowercase), unlike HTML documents
    // where tagName is always uppercase — normalize before comparing.
    if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
    if (looksLikeIconElement(el)) return true;
    return false;
  }

  /**
   * Bolds all qualifying text nodes inside `doc` in place.
   * Returns the number of text nodes processed.
   */
  function bionicifyDocument(doc, ratio) {
    const root = doc.body || doc.documentElement;
    if (!root) return 0;

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue;
        if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach((node) => {
      const frag = window.InkboltCore.buildBionicFragment(node.nodeValue, { ratio }, doc);
      node.parentNode.replaceChild(frag, node);
    });

    return nodes.length;
  }

  function parseXhtml(text) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(text, 'application/xhtml+xml');
    if (doc.querySelector('parsererror')) {
      doc = parser.parseFromString(text, 'text/html');
    }
    return doc;
  }

  function serializeXhtml(doc, originalText) {
    const serialized = new XMLSerializer().serializeToString(doc);
    if (originalText.trim().startsWith('<?xml') && !serialized.trim().startsWith('<?xml')) {
      return '<?xml version="1.0" encoding="utf-8"?>\n' + serialized;
    }
    return serialized;
  }

  async function processEpub(file, ratio) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip failed to load (check your internet connection) — cannot open the EPUB.');
    }
    setProgress(5, 'Unzipping EPUB…');
    const zip = await JSZip.loadAsync(file);

    // Keep the mimetype entry STORED (uncompressed) for spec compliance.
    const mimetypeEntry = zip.file('mimetype');
    if (mimetypeEntry) {
      const mimetypeContent = await mimetypeEntry.async('string');
      zip.file('mimetype', mimetypeContent, { compression: 'STORE' });
    }

    const targets = Object.keys(zip.files).filter(
      (name) => /\.(xhtml|html|htm)$/i.test(name) && !zip.files[name].dir
    );

    if (targets.length === 0) {
      throw new Error("Couldn't find any XHTML/HTML content inside this EPUB — is the file valid?");
    }

    setProgress(15, `Found ${targets.length} content file(s)…`);

    let totalWords = 0;
    for (let i = 0; i < targets.length; i++) {
      const name = targets[i];
      const original = await zip.file(name).async('string');
      const doc = parseXhtml(original);
      const count = bionicifyDocument(doc, ratio);
      totalWords += count;
      const serialized = serializeXhtml(doc, original);
      zip.file(name, serialized);

      logLine(`✓ ${name} — ${count} text node(s) processed`);
      setProgress(15 + Math.round(((i + 1) / targets.length) * 70), `Processing ${name}…`);
    }

    setProgress(90, 'Rebuilding EPUB…');
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
    });

    setProgress(100, 'Done!');
    return {
      blob,
      filename: file.name.replace(/\.epub$/i, '') + '-inkbolt.epub',
      summary: `Bolded text across ${targets.length} chapter file(s), ${totalWords} text node(s) total.`,
    };
  }

  async function processTxt(file, ratio) {
    setProgress(20, 'Reading text file…');
    const text = await file.text();

    setProgress(60, 'Applying bionic bold (Unicode)…');
    const wordCount = (text.match(window.InkboltCore.WORD_RE) || []).length;
    const transformed = window.InkboltCore.bionicifyPlainText(text, { ratio });

    logLine(`✓ ${wordCount} word(s) processed`);
    setProgress(100, 'Done!');

    const blob = new Blob([transformed], { type: 'text/plain;charset=utf-8' });
    return {
      blob,
      filename: file.name.replace(/\.txt$/i, '') + '-inkbolt.txt',
      summary: `Stays a plain .txt file — ${wordCount} word(s) now use bold Unicode characters (renders bold in almost any font, no markup needed). Note: only Latin letters and digits have bold Unicode variants, so accented letters, punctuation, and non-Latin scripts are left as-is.`,
    };
  }

  async function handleFile(file) {
    resetUI();
    progressSection.classList.remove('hidden');
    setProgress(0, 'Starting…');

    const ratio = ratioSlider.value / 100;
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    try {
      let result;
      if (ext === 'epub') {
        result = await processEpub(file, ratio);
      } else if (ext === 'txt') {
        result = await processTxt(file, ratio);
      } else {
        throw new Error(
          `".${ext}" isn't supported yet. This tool handles EPUB and TXT — for MOBI, AZW3, KFX, or PDF, convert to EPUB first with Calibre (free), then try again.`
        );
      }

      const url = URL.createObjectURL(result.blob);
      downloadLink.href = url;
      downloadLink.download = result.filename;
      resultMsg.textContent = result.summary;
      resultSection.classList.remove('hidden');
      progressSection.classList.add('hidden');
    } catch (err) {
      console.error(err);
      showError(err.message || 'Something went wrong while converting this file.');
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
})();
