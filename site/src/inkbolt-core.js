(function (root) {
  'use strict';

  const WORD_RE = /[\p{L}\p{M}\p{N}\u0640]+(?:['\u2019-][\p{L}\p{M}\p{N}\u0640]+)*/gu;

  const DEFAULTS = {
    ratio: 0.5,
    boldWeight: '700',
    minWordLength: 1,
  };

  const ZWJ = '\u200D';

  function isArabicChar(code) {
    return (
      (code >= 0x0600 && code <= 0x06FF) ||
      (code >= 0x0750 && code <= 0x077F) ||
      (code >= 0x08A0 && code <= 0x08FF) ||
      (code >= 0xFB50 && code <= 0xFDFF) ||
      (code >= 0xFE70 && code <= 0xFEFF)
    );
  }

  // Right-joining only Arabic letters
  const ARABIC_NON_CONNECTING_LEFT = new Set([
    0x0622, 0x0623, 0x0624, 0x0625, 0x0627,
    0x062F, 0x0630,
    0x0631, 0x0632,
    0x0648, 0x0629, 0x0649,
    0x0671, 0x0672, 0x0673, 0x0675, 0x0676, 0x0677,
    0x0688, 0x0689, 0x068A, 0x068B, 0x068C, 0x068D, 0x068E, 0x068F,
    0x0690, 0x0691, 0x0692, 0x0693, 0x0694, 0x0695, 0x0696, 0x0697, 0x0698, 0x0699,
    0x06C4, 0x06C5, 0x06C6, 0x06C7, 0x06C8, 0x06C9, 0x06CA, 0x06CB, 0x06CF, 0x06EE
  ]);

  const graphemeSegmenter =
    typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;

  function getGraphemeClusters(word) {
    if (graphemeSegmenter) {
      try {
        return Array.from(graphemeSegmenter.segment(word)).map((s) => s.segment);
      } catch (e) {}
    }
    return Array.from(word);
  }

  function computeBoldLength(word, ratio) {
    const clusters = getGraphemeClusters(word);
    const len = clusters.length;
    if (len <= 1) return len;
    if (len <= 3) return 1;
    const n = Math.round(len * ratio);
    return Math.min(len - 1, Math.max(1, n));
  }

  function partitionWord(word, ratio) {
    const clusters = getGraphemeClusters(word);
    const len = clusters.length;
    if (len <= 1) {
      return { head: word, tail: '' };
    }

    const boldLen = computeBoldLength(word, ratio);
    let head = clusters.slice(0, boldLen).join('');
    let tail = clusters.slice(boldLen).join('');

    if (head && tail) {
      const lastHeadCluster = clusters[boldLen - 1];
      const firstTailCluster = clusters[boldLen];
      const lastHeadBase = lastHeadCluster ? lastHeadCluster.codePointAt(0) : 0;
      const firstTailBase = firstTailCluster ? firstTailCluster.codePointAt(0) : 0;

      if (isArabicChar(lastHeadBase) && isArabicChar(firstTailBase)) {
        if (!ARABIC_NON_CONNECTING_LEFT.has(lastHeadBase)) {
          head += ZWJ;
          tail = ZWJ + tail;
        }
      }
    }

    return { head, tail };
  }

  function buildBionicFragment(text, opts, targetDoc) {
    const options = Object.assign({}, DEFAULTS, opts);
    const doc = targetDoc || document;
    const frag = doc.createDocumentFragment();
    let lastIndex = 0;
    let match;

    WORD_RE.lastIndex = 0;
    while ((match = WORD_RE.exec(text)) !== null) {
      const word = match[0];
      const start = match.index;

      if (start > lastIndex) {
        frag.appendChild(doc.createTextNode(text.slice(lastIndex, start)));
      }

      try {
        const clusters = getGraphemeClusters(word);
        if (clusters.length < options.minWordLength) {
          frag.appendChild(doc.createTextNode(word));
        } else {
          const { head, tail } = partitionWord(word, options.ratio);

          if (head) {
            const b = doc.createElement('span');
            b.className = 'inkbolt-b';
            b.style.fontWeight = options.boldWeight;
            b.style.fontFamily = 'inherit';
            b.style.fontStyle = 'inherit';
            b.textContent = head;
            frag.appendChild(b);
          }
          if (tail) {
            frag.appendChild(doc.createTextNode(tail));
          }
        }
      } catch (wordErr) {
        frag.appendChild(doc.createTextNode(word));
      }

      lastIndex = start + word.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    return frag;
  }

  function toMathBoldChar(ch) {
    const code = ch.codePointAt(0);
    if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(0x1d400 + (code - 0x41));
    if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(0x1d41a + (code - 0x61));
    if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1d7ce + (code - 0x30));
    return ch;
  }

  function bionicifyPlainText(text, opts) {
    const options = Object.assign({}, DEFAULTS, opts);
    let result = '';
    let lastIndex = 0;
    let match;

    WORD_RE.lastIndex = 0;
    while ((match = WORD_RE.exec(text)) !== null) {
      const word = match[0];
      const start = match.index;
      result += text.slice(lastIndex, start);

      try {
        const clusters = getGraphemeClusters(word);
        const boldLen = computeBoldLength(word, options.ratio);
        const headClusters = clusters.slice(0, boldLen);
        const tailClusters = clusters.slice(boldLen);

        const head = headClusters.map((c) => Array.from(c).map(toMathBoldChar).join('')).join('');
        const tail = tailClusters.join('');
        result += head + tail;
      } catch (wordErr) {
        result += word;
      }

      lastIndex = start + word.length;
    }
    result += text.slice(lastIndex);
    return result;
  }

  function segmentBionic(text, opts) {
    const options = Object.assign({}, DEFAULTS, opts);
    const segments = [];
    let lastIndex = 0;
    let match;

    WORD_RE.lastIndex = 0;
    while ((match = WORD_RE.exec(text)) !== null) {
      const word = match[0];
      const start = match.index;

      if (start > lastIndex) {
        segments.push({ text: text.slice(lastIndex, start), bold: false });
      }

      try {
        const { head, tail } = partitionWord(word, options.ratio);
        if (head) segments.push({ text: head, bold: true });
        if (tail) segments.push({ text: tail, bold: false });
      } catch (wordErr) {
        segments.push({ text: word, bold: false });
      }

      lastIndex = start + word.length;
    }
    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), bold: false });
    }
    return segments;
  }

  const InkboltCore = {
    computeBoldLength,
    partitionWord,
    buildBionicFragment,
    bionicifyPlainText,
    segmentBionic,
    toMathBoldChar,
    isArabicChar,
    WORD_RE,
    DEFAULTS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InkboltCore;
  } else {
    root.InkboltCore = InkboltCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
