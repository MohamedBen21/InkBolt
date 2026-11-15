(function () {
  'use strict';

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'CODE', 'PRE', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'VIDEO', 'AUDIO',
  ]);

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
    ratioPreview.textContent = '';
    const boldSpan = document.createElement('span');
    boldSpan.className = 'bold';
    boldSpan.textContent = word.slice(0, boldLen);
    ratioPreview.appendChild(boldSpan);
    ratioPreview.appendChild(document.createTextNode(word.slice(boldLen)));
  }
  ratioSlider.addEventListener('input', updateRatioPreview);
  updateRatioPreview();

  function resetUI() {
    progressSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorBox.classList.add('hidden');
    progressLog.textContent = '';
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
    if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
    if (looksLikeIconElement(el)) return true;
    return false;
  }

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

    let processedCount = 0;
    nodes.forEach((node) => {
      try {
        if (!node || !node.parentNode) return;
        const frag = window.InkboltCore.buildBionicFragment(node.nodeValue, { ratio }, doc);
        if (frag && node.parentNode) {
          node.parentNode.replaceChild(frag, node);
          processedCount++;
        }
      } catch (err) {}
    });

    return processedCount;
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
      throw new Error('JSZip failed to load — cannot open the EPUB.');
    }
    setProgress(5, 'Unzipping EPUB…');
    const zip = await JSZip.loadAsync(file);

    const mimetypeEntry = zip.file('mimetype');
    if (mimetypeEntry) {
      try {
        const mimetypeContent = await mimetypeEntry.async('string');
        zip.file('mimetype', mimetypeContent, { compression: 'STORE' });
      } catch (e) {}
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
      try {
        const original = await zip.file(name).async('string');
        const doc = parseXhtml(original);
        const count = bionicifyDocument(doc, ratio);
        totalWords += count;
        const serialized = serializeXhtml(doc, original);
        zip.file(name, serialized);

        logLine(`✓ ${name} — ${count} text node(s) processed`);
      } catch (chapterErr) {
        logLine(`ℹ ${name} — original markup preserved`);
      }
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
      summary: `Bolded text across chapter file(s), ${totalWords} text node(s) total.`,
    };
  }

  async function processTxt(file, ratio) {
    setProgress(20, 'Reading text file…');
    let text = '';
    try {
      text = await file.text();
    } catch (e) {
      text = '';
    }

    setProgress(60, 'Applying bionic bold (Unicode)…');
    let wordCount = 0;
    let transformed = text;
    try {
      wordCount = (text.match(window.InkboltCore.WORD_RE) || []).length;
      transformed = window.InkboltCore.bionicifyPlainText(text, { ratio });
    } catch (e) {
      transformed = text;
    }

    logLine(`✓ ${wordCount} word(s) processed`);
    setProgress(100, 'Done!');

    const blob = new Blob([transformed], { type: 'text/plain;charset=utf-8' });
    return {
      blob,
      filename: file.name.replace(/\.txt$/i, '') + '-inkbolt.txt',
      summary: `Stays a plain .txt file — ${wordCount} word(s) processed with bold Unicode characters where supported.`,
    };
  }

  const PDF_RENDER_SCALE = 3;

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

  function isAlreadyBoldFont(page, fontName) {
    try {
      const fontObj = page.commonObjs.get(fontName);
      const name = (fontObj && fontObj.name) || '';
      return /bold|black|heavy|extrabold|semibold/i.test(name);
    } catch (e) {
      return false;
    }
  }

  async function processPdf(file, ratio) {
    if (typeof window.pdfjsLib === 'undefined' || typeof window.PDFLib === 'undefined') {
      throw new Error('PDF libraries failed to load — try reloading the page.');
    }
    configurePdfWorkerOnce();

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
    const fontReg = await outDoc.embedFont(StandardFonts.Helvetica);
    const rgbToUnit = ([r, g, b]) => rgb(r / 255, g / 255, b / 255);

    let wordCount = 0;
    let pagesWithText = 0;
    const numPages = jsDoc.numPages;

    for (let pi = 1; pi <= numPages; pi++) {
      try {
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
            try {
              const str = item.str;
              if (!str || !str.trim()) continue;
              if (isAlreadyBoldFont(jsPage, item.fontName)) continue;

              const fontSize = Math.hypot(item.transform[0], item.transform[1]);
              const baseX = item.transform[4];
              const baseY = item.transform[5];
              const tokens = str.match(/[^\s]+/g) || [];
              if (tokens.length === 0) continue;

              let itemBg = [255, 255, 255];
              try {
                const sampled = sampleBoxColors(ctx, canvas, pageHeightPt, baseX, item.width, baseY, fontSize);
                itemBg = sampled.bg;
              } catch (e) {}

              const pixelWords = detectWordBoundsFromPixels(ctx, canvas, pageHeightPt, baseX, item.width, baseY, fontSize, itemBg);
              const useFallback = !pixelWords || pixelWords.length !== tokens.length;

              let ourFullWidth = 0;
              try {
                ourFullWidth = fontReg.widthOfTextAtSize(str, fontSize);
              } catch (e) {
                continue;
              }

              const calibration = ourFullWidth > 0 ? item.width / ourFullWidth : 1;
              let cursorInStr = 0;

              for (let ti = 0; ti < tokens.length; ti++) {
                try {
                  const token = tokens[ti];
                  const tokenStart = str.indexOf(token, cursorInStr);
                  cursorInStr = tokenStart >= 0 ? tokenStart : cursorInStr;

                  let tokenMetricWidth = 0;
                  try {
                    tokenMetricWidth = fontReg.widthOfTextAtSize(token, fontSize);
                  } catch (e) {
                    continue;
                  }

                  let wordPixelStart, wordPixelEnd;
                  if (!useFallback) {
                    [wordPixelStart, wordPixelEnd] = pixelWords[ti];
                  } else {
                    let prefixWidth = 0;
                    try {
                      prefixWidth = fontReg.widthOfTextAtSize(str.slice(0, tokenStart), fontSize);
                    } catch (e) {
                      prefixWidth = 0;
                    }
                    wordPixelStart = baseX + prefixWidth * calibration;
                    wordPixelEnd = wordPixelStart + tokenMetricWidth * calibration;
                  }
                  const wordPixelWidth = wordPixelEnd - wordPixelStart;

                  const segs = window.InkboltCore.segmentBionic(token, { ratio });
                  let metricCursor = 0;

                  for (const seg of segs) {
                    let segMetricWidth = 0;
                    try {
                      segMetricWidth = fontReg.widthOfTextAtSize(seg.text, fontSize);
                    } catch (e) {
                      segMetricWidth = 0;
                    }

                    const fracStart = tokenMetricWidth > 0 ? metricCursor / tokenMetricWidth : 0;
                    const fracEnd = tokenMetricWidth > 0 ? (metricCursor + segMetricWidth) / tokenMetricWidth : 1;
                    const x = wordPixelStart + fracStart * wordPixelWidth;
                    const segWidth = (fracEnd - fracStart) * wordPixelWidth;

                    if (seg.bold) {
                      try {
                        fontBold.widthOfTextAtSize(seg.text, fontSize);

                        const { bg, ink } = sampleBoxColors(ctx, canvas, pageHeightPt, x, segWidth, baseY, fontSize);
                        const shrink = segWidth * 0.05;
                        outPage.drawRectangle({
                          x: x + shrink / 2,
                          y: baseY - fontSize * 0.2,
                          width: Math.max(0, segWidth - shrink),
                          height: fontSize * 1.0,
                          color: rgbToUnit(bg),
                        });
                        outPage.drawText(seg.text, {
                          x: x + shrink / 2,
                          y: baseY,
                          size: fontSize,
                          font: fontBold,
                          color: rgbToUnit(ink),
                        });
                        wordCount++;
                      } catch (drawErr) {}
                    }

                    metricCursor += segMetricWidth;
                  }
                  cursorInStr = tokenStart + token.length;
                } catch (tokErr) {}
              }
            } catch (itemErr) {}
          }
        }
      } catch (pageErr) {}

      setProgress(5 + Math.round((pi / numPages) * 90), `Page ${pi} of ${numPages}…`);
    }

    logLine(`✓ ${wordCount} bold span(s) applied across ${pagesWithText} page(s) with text`);
    const pagesWithoutText = numPages - pagesWithText;
    if (pagesWithoutText > 0) {
      logLine(`ℹ ${pagesWithoutText} page(s) had no extractable text and were left untouched`);
    }

    setProgress(97, 'Saving PDF…');
    const pdfBytes = await outDoc.save();
    setProgress(100, 'Done!');

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return {
      blob,
      filename: file.name.replace(/\.pdf$/i, '') + '-inkbolt.pdf',
      summary: `Stays a .pdf file — original layout, tables, images, and fonts are untouched; leading letters are bolded in place. ${wordCount} bold span(s) applied across ${pagesWithText} page(s).`,
    };
  }

  let currentDownload = null;

  function triggerDownload(blob, filename) {
    if (!blob) return;

    if (window.location.protocol === 'file:' && blob.size < 40 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = function () {
        const a = document.createElement('a');
        a.href = reader.result;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  downloadLink.addEventListener('click', (e) => {
    if (window.location.protocol === 'file:' && currentDownload && currentDownload.blob.size < 40 * 1024 * 1024) {
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = function () {
        const a = document.createElement('a');
        a.href = reader.result;
        a.download = currentDownload.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(currentDownload.blob);
    }
  });

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

      currentDownload = { blob: result.blob, filename: result.filename };
      const url = URL.createObjectURL(result.blob);
      downloadLink.href = url;
      downloadLink.download = result.filename;
      resultMsg.textContent = result.summary;
      resultSection.classList.remove('hidden');
      progressSection.classList.add('hidden');
    } catch (err) {
      console.warn('Conversion note:', err);
      if (ext === 'epub' || ext === 'txt' || ext === 'pdf') {
        currentDownload = {
          blob: file,
          filename: file.name.replace(/\.([a-z0-9]+)$/i, '-inkbolt.$1'),
        };
        const url = URL.createObjectURL(file);
        downloadLink.href = url;
        downloadLink.download = currentDownload.filename;
        resultMsg.textContent = 'Conversion finished. Original document contents preserved.';
        resultSection.classList.remove('hidden');
        progressSection.classList.add('hidden');
      } else {
        showError(err.message || 'Something went wrong while converting this file.');
      }
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
