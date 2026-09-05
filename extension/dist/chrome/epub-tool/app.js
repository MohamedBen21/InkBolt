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

  // This tool loads the ORIGINAL PDF and only draws on top of it — every
  // table, image, colored block, and line stays exactly as it was. Only
  // the leading letters of each word get a bold overlay drawn precisely
  // in place, using the real background and ink colors sampled from a
  // rendered copy of the page (so it works correctly even on colored
  // table headers, not just plain white text).
  //
  // Word positions are found by scanning the rendered pixels for actual
  // ink columns rather than trusting font-metric estimates — real-world
  // PDFs almost never use one of the 14 standard PDF fonts we can embed
  // for measurement, and different fonts have different relative letter
  // widths, so a metric-only estimate drifts increasingly across a long
  // string. Pixel detection is measured from what's actually rendered,
  // so it's accurate regardless of what font the document really uses.
  const PDF_RENDER_SCALE = 3; // higher = more accurate color/position sampling, slower

  let pdfWorkerConfigured = false;
  function configurePdfWorkerOnce() {
    if (pdfWorkerConfigured) return;
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    pdfWorkerConfigured = true;
  }

  function luminance([r, g, b]) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  /**
   * Robust background estimate: samples every pixel along the box's top
   * and bottom edges (not just 4 corners — a single stray ink pixel there,
   * e.g. from a diacritic or antialiasing, would skew a small average
   * toward gray) and takes the per-channel MEDIAN, which stays accurate
   * even when a minority of samples land on actual ink.
   */
  function sampleRobustBackground(ctx, x, yTop, w, h) {
    const rs = [], gs = [], bs = [];
    for (const row of [0, h - 1]) {
      const data = ctx.getImageData(x, yTop + row, w, 1).data;
      for (let col = 0; col < w; col++) {
        rs.push(data[col * 4]); gs.push(data[col * 4 + 1]); bs.push(data[col * 4 + 2]);
      }
    }
    return [Math.round(median(rs)), Math.round(median(gs)), Math.round(median(bs))];
  }

  /**
   * Finds background and ink color for a glyph box. Ink is whichever
   * pixel is furthest in color from the background — works for
   * dark-on-light OR light-on-dark text without assuming which direction
   * the contrast goes.
   */
  function sampleBoxColors(ctx, canvas, pageHeightPt, pdfX, pdfWidth, baseY, fontSize) {
    function pdfToCanvas(x, y) {
      return [Math.round(x * PDF_RENDER_SCALE), Math.round((pageHeightPt - y) * PDF_RENDER_SCALE)];
    }
    const [cx1, cy1] = pdfToCanvas(pdfX, baseY + fontSize * 0.78);
    const [cx2, cy2] = pdfToCanvas(pdfX + pdfWidth, baseY - fontSize * 0.22);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.min(cx1, cx2)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.min(cy1, cy2)));
    const w = Math.max(1, Math.min(canvas.width - x, Math.abs(cx2 - cx1)));
    const h = Math.max(1, Math.min(canvas.height - y, Math.abs(cy2 - cy1)));

    const bg = sampleRobustBackground(ctx, x, y, w, h);
    const bgLum = luminance(bg);

    const data = ctx.getImageData(x, y, w, h).data;
    let ink = bg, bestDist = -1;
    for (let i = 0; i < data.length; i += 4) {
      const px = [data[i], data[i + 1], data[i + 2]];
      const dist = Math.hypot(px[0] - bg[0], px[1] - bg[1], px[2] - bg[2]);
      if (dist > bestDist) { bestDist = dist; ink = px; }
    }
    if (bestDist <= 25) ink = bgLum >= 128 ? [0, 0, 0] : [255, 255, 255];
    return { bg, ink };
  }

  /**
   * Scans a text item's full bounding box in the rendered canvas for real
   * ink columns, then groups them into word blobs separated by gaps wider
   * than a threshold (word spaces are much wider than the gaps between
   * letters within a word). Returns pixel-accurate [xStart, xEnd] (in PDF
   * point space) for each detected word, in reading order.
   */
  function detectWordBoundsFromPixels(ctx, canvas, pageHeightPt, baseX, itemWidth, baseY, fontSize, bg) {
    function pdfToCanvasX(x) { return Math.round(x * PDF_RENDER_SCALE); }
    function pdfToCanvasY(y) { return Math.round((pageHeightPt - y) * PDF_RENDER_SCALE); }
    const xStartPx = pdfToCanvasX(baseX);
    const xEndPx = pdfToCanvasX(baseX + itemWidth);
    const yTopPx = pdfToCanvasY(baseY + fontSize * 0.78);
    const yBotPx = pdfToCanvasY(baseY - fontSize * 0.22);
    const x = Math.max(0, Math.min(canvas.width - 1, xStartPx));
    const yTop = Math.max(0, Math.min(canvas.height - 1, yTopPx));
    const w = Math.max(1, Math.min(canvas.width - x, xEndPx - xStartPx));
    const h = Math.max(1, Math.min(canvas.height - yTop, yBotPx - yTopPx));
    if (w <= 0 || h <= 0) return null;

    const data = ctx.getImageData(x, yTop, w, h).data;
    const colHasInk = new Array(w).fill(false);
    const threshold = 30;
    for (let col = 0; col < w; col++) {
      for (let row = 0; row < h; row++) {
        const i = (row * w + col) * 4;
        const px = [data[i], data[i + 1], data[i + 2]];
        if (Math.hypot(px[0] - bg[0], px[1] - bg[1], px[2] - bg[2]) > threshold) { colHasInk[col] = true; break; }
      }
    }
    const inkRuns = [];
    let runStart = null;
    for (let col = 0; col <= w; col++) {
      const has = col < w ? colHasInk[col] : false;
      if (has && runStart === null) runStart = col;
      if (!has && runStart !== null) { inkRuns.push([runStart, col - 1]); runStart = null; }
    }
    if (inkRuns.length === 0) return null;

    const wordGapThresholdPx = fontSize * PDF_RENDER_SCALE * 0.18;
    const words = [];
    let curStart = inkRuns[0][0], curEnd = inkRuns[0][1];
    for (let i = 1; i < inkRuns.length; i++) {
      const gap = inkRuns[i][0] - curEnd;
      if (gap > wordGapThresholdPx) { words.push([curStart, curEnd]); curStart = inkRuns[i][0]; curEnd = inkRuns[i][1]; }
      else { curEnd = inkRuns[i][1]; }
    }
    words.push([curStart, curEnd]);
    return words.map(([s, e]) => [baseX + s / PDF_RENDER_SCALE, baseX + (e + 1) / PDF_RENDER_SCALE]);
  }

  /**
   * Checks the document's ACTUAL underlying font (not our substitute
   * font) to see if it's already a bold weight. If so, skip bionic
   * processing for this text entirely — there's no meaningful weight
   * contrast left to add, and overlaying a different bold typeface on
   * top of already-bold text (often large heading text, where any shape
   * difference between typefaces is most visible) is the one case that
   * can look like a rendering glitch rather than an improvement.
   */
  function isAlreadyBoldFont(page, fontName) {
    try {
      const fontObj = page.commonObjs.get(fontName);
      const name = (fontObj && fontObj.name) || '';
      return /bold|black|heavy|extrabold|semibold/i.test(name);
    } catch (e) {
      return false; // unknown -> treat as regular weight, process normally
    }
  }

  async function processPdf(file, ratio) {
    if (typeof window.pdfjsLib === 'undefined' || typeof window.PDFLib === 'undefined') {
      throw new Error('PDF libraries failed to load — try reloading the page.');
    }
    configurePdfWorkerOnce();

    // Two independent copies: pdf.js may transfer/detach its buffer for
    // worker use, so pdf-lib needs its own untouched copy.
    const bufForJs = await file.arrayBuffer();
    const bufForLib = bufForJs.slice(0);

    setProgress(5, 'Opening PDF…');
    const jsDoc = await window.pdfjsLib.getDocument({
      data: bufForJs,
      standardFontDataUrl: 'vendor/standard_fonts/',
    }).promise;

    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const outDoc = await PDFDocument.load(bufForLib);
    const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await outDoc.embedFont(StandardFonts.Helvetica); // metrics reference only, never drawn
    const rgbToUnit = ([r, g, b]) => rgb(r / 255, g / 255, b / 255);

    let wordCount = 0;
    let pagesWithText = 0;
    const numPages = jsDoc.numPages;

    for (let pi = 1; pi <= numPages; pi++) {
      const jsPage = await jsDoc.getPage(pi);
      const content = await jsPage.getTextContent({ disableCombineTextItems: true });
      const outPage = outDoc.getPage(pi - 1);

      const hasText = content.items.some((it) => it.str && it.str.trim());
      if (hasText) {
        pagesWithText++;
        const viewport = jsPage.getViewport({ scale: PDF_RENDER_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await jsPage.render({ canvasContext: ctx, viewport }).promise;
        const pageHeightPt = viewport.height / PDF_RENDER_SCALE;

        for (const item of content.items) {
          const str = item.str;
          if (!str || !str.trim()) continue;
          if (isAlreadyBoldFont(jsPage, item.fontName)) continue;

          const fontSize = Math.hypot(item.transform[0], item.transform[1]);
          const baseX = item.transform[4];
          const baseY = item.transform[5];
          const tokens = str.match(/[^\s]+/g) || [];
          if (tokens.length === 0) continue;

          const { bg: itemBg } = sampleBoxColors(ctx, canvas, pageHeightPt, baseX, item.width, baseY, fontSize);
          const pixelWords = detectWordBoundsFromPixels(ctx, canvas, pageHeightPt, baseX, item.width, baseY, fontSize, itemBg);
          // If pixel detection didn't cleanly find one blob per word
          // (rare — very tight kerning, connected script fonts), fall
          // back to a font-metric estimate for this item only.
          const useFallback = !pixelWords || pixelWords.length !== tokens.length;

          const ourFullWidth = fontReg.widthOfTextAtSize(str, fontSize);
          const calibration = ourFullWidth > 0 ? item.width / ourFullWidth : 1;
          let cursorInStr = 0;

          for (let ti = 0; ti < tokens.length; ti++) {
            const token = tokens[ti];
            const tokenStart = str.indexOf(token, cursorInStr);
            cursorInStr = tokenStart;

            let wordPixelStart, wordPixelEnd;
            if (!useFallback) {
              [wordPixelStart, wordPixelEnd] = pixelWords[ti];
            } else {
              const prefixWidth = fontReg.widthOfTextAtSize(str.slice(0, tokenStart), fontSize);
              wordPixelStart = baseX + prefixWidth * calibration;
              wordPixelEnd = wordPixelStart + fontReg.widthOfTextAtSize(token, fontSize) * calibration;
            }
            const wordPixelWidth = wordPixelEnd - wordPixelStart;

            const segs = window.InkboltCore.segmentBionic(token, { ratio });
            const wordMetricWidth = fontReg.widthOfTextAtSize(token, fontSize);
            let metricCursor = 0;

            for (const seg of segs) {
              // Intra-word position is still a font-metric proportion,
              // but now bounded to a single short word's span (a few
              // characters) instead of a whole sentence — any metric
              // mismatch can't accumulate nearly as far, since the outer
              // word bounds come from real pixels, not the estimate.
              const fracStart = wordMetricWidth > 0 ? metricCursor / wordMetricWidth : 0;
              const segMetricWidth = fontReg.widthOfTextAtSize(seg.text, fontSize);
              const fracEnd = wordMetricWidth > 0 ? (metricCursor + segMetricWidth) / wordMetricWidth : 1;
              const x = wordPixelStart + fracStart * wordPixelWidth;
              const segWidth = (fracEnd - fracStart) * wordPixelWidth;

              if (seg.bold) {
                const { bg, ink } = sampleBoxColors(ctx, canvas, pageHeightPt, x, segWidth, baseY, fontSize);
                // Shrink the cover box inward rather than pad it outward:
                // a faint sliver of un-covered original ink at the very
                // edge is a minor cosmetic artifact, but padding outward
                // risks bleeding into the NEXT untouched character and
                // erasing part of it (e.g. "regular" -> "reguar").
                const shrink = segWidth * 0.05;
                outPage.drawRectangle({
                  x: x + shrink / 2,
                  y: baseY - fontSize * 0.2,
                  width: Math.max(0, segWidth - shrink),
                  height: fontSize * 1.0,
                  color: rgbToUnit(bg),
                });
                outPage.drawText(seg.text, { x, y: baseY, size: fontSize, font: fontBold, color: rgbToUnit(ink) });
                wordCount++;
              }
              metricCursor += segMetricWidth;
            }
            cursorInStr = tokenStart + token.length;
          }
        }
      }

      setProgress(5 + Math.round((pi / numPages) * 90), `Page ${pi} of ${numPages}…`);
    }

    logLine(`✓ ${wordCount} bold span(s) applied across ${pagesWithText} page(s) with text`);
    const pagesWithoutText = numPages - pagesWithText;
    if (pagesWithoutText > 0) {
      logLine(`ℹ ${pagesWithoutText} page(s) had no extractable text (likely scans/images) and were left untouched`);
    }

    setProgress(97, 'Saving PDF…');
    const pdfBytes = await outDoc.save();
    setProgress(100, 'Done!');

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return {
      blob,
      filename: file.name.replace(/\.pdf$/i, '') + '-inkbolt.pdf',
      summary: `Stays a .pdf file — the original layout, tables, images, and colors are untouched; only the bolded portions of each word are redrawn in place. Headings already set in a bold font are left as-is (no extra contrast to add). ${wordCount} bold span(s) applied across ${pagesWithText} page(s).${pagesWithoutText ? ` ${pagesWithoutText} page(s) had no extractable text (likely scanned/image-only) and were left exactly as-is.` : ''}`,
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
      } else if (ext === 'pdf') {
        result = await processPdf(file, ratio);
      } else {
        throw new Error(
          `".${ext}" isn't supported yet. This tool handles EPUB, TXT, and PDF — for MOBI, AZW3, or KFX, convert to EPUB first with Calibre (free), then try again.`
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
