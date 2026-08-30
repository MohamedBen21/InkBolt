/**
 * inkbolt-core.js
 * Inkbolt's core transform engine — implements a fixation-guided reading
 * technique (bolding the leading letters of each word so the eye can
 * anchor and the brain fills in the rest), the same underlying idea
 * popularized under the "Bionic Reading" name. This is Inkbolt's own
 * independent implementation.
 *
 * No DOM assumptions beyond `document.createElement/createTextNode`, so
 * this same file is reused by both the browser extension and the
 * standalone e-book tool.
 *
 * IMPORTANT: We never touch font-family, font-size, or font-style.
 * We only wrap the "head" of each word in a <span> with an inline
 * font-weight bump. Everything else about the page's typography
 * is left completely alone.
 */

(function (root) {
  'use strict';

  // Matches a "word": a run of letters/numbers, allowing an internal
  // apostrophe or hyphen (don't, well-known), in any Unicode script.
  const WORD_RE = /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;

  const DEFAULTS = {
    // 0.3 = bold ~30% of each word, 0.7 = bold ~70%
    ratio: 0.5,
    boldWeight: '700',
    minWordLength: 1, // words shorter than this are left untouched
  };

  /**
   * How many leading characters of `word` should be bolded.
   */
  function computeBoldLength(word, ratio) {
    const len = Array.from(word).length; // handles surrogate pairs
    if (len <= 1) return len;
    if (len <= 3) return 1;
    const n = Math.round(len * ratio);
    return Math.min(len - 1, Math.max(1, n));
  }

  /**
   * Build a DocumentFragment containing the bionic-formatted version
   * of `text`. Uses textContent (never innerHTML) so page text can
   * never be interpreted as markup.
   */
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

      if (Array.from(word).length < options.minWordLength) {
        frag.appendChild(doc.createTextNode(word));
      } else {
        const boldLen = computeBoldLength(word, options.ratio);
        const chars = Array.from(word);
        const head = chars.slice(0, boldLen).join('');
        const tail = chars.slice(boldLen).join('');

        if (head) {
          const b = doc.createElement('span');
          b.className = 'inkbolt-b';
          b.style.fontWeight = options.boldWeight;
          // Belt-and-suspenders: explicitly pin font-family (and style)
          // to whatever the surrounding text already uses, so nothing
          // about requesting a bold weight can cause the browser to
          // substitute a different font family for this span.
          b.style.fontFamily = 'inherit';
          b.style.fontStyle = 'inherit';
          b.textContent = head;
          frag.appendChild(b);
        }
        if (tail) {
          frag.appendChild(doc.createTextNode(tail));
        }
      }

      lastIndex = start + word.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    return frag;
  }

  /**
   * Maps a single ASCII letter/digit to its Unicode "Mathematical Bold"
   * equivalent (a distinct code point that renders bold in virtually any
   * font, no markup required). Falls back to the original character for
   * anything outside A-Z/a-z/0-9 (accents, punctuation, non-Latin scripts)
   * since no bold variant exists for those in this Unicode block.
   */
  function toMathBoldChar(ch) {
    const code = ch.codePointAt(0);
    if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(0x1d400 + (code - 0x41)); // A-Z
    if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(0x1d41a + (code - 0x61)); // a-z
    if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1d7ce + (code - 0x30)); // 0-9
    return ch;
  }

  /**
   * Plain-text bionic transform: returns a new string (no DOM, no markup)
   * where each word's leading characters are swapped for their Unicode
   * Mathematical Bold equivalents. Used for .txt -> .txt conversion so the
   * output stays a real plain-text file.
   */
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

      const chars = Array.from(word);
      const boldLen = computeBoldLength(word, options.ratio);
      const head = chars.slice(0, boldLen).map(toMathBoldChar).join('');
      const tail = chars.slice(boldLen).join('');
      result += head + tail;

      lastIndex = start + word.length;
    }
    result += text.slice(lastIndex);
    return result;
  }

  /**
   * Same word segmentation as the other transforms, but returns plain
   * data instead of DOM nodes or a string: an array of
   * { text, bold } parts in reading order. For consumers that need to
   * measure and draw text themselves (e.g. laying it out on a PDF page)
   * rather than build DOM or a plain string.
   */
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

      const chars = Array.from(word);
      const boldLen = computeBoldLength(word, options.ratio);
      const head = chars.slice(0, boldLen).join('');
      const tail = chars.slice(boldLen).join('');
      if (head) segments.push({ text: head, bold: true });
      if (tail) segments.push({ text: tail, bold: false });

      lastIndex = start + word.length;
    }
    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), bold: false });
    }
    return segments;
  }

  const InkboltCore = {
    computeBoldLength,
    buildBionicFragment,
    bionicifyPlainText,
    segmentBionic,
    toMathBoldChar,
    WORD_RE,
    DEFAULTS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InkboltCore;
  } else {
    root.InkboltCore = InkboltCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
