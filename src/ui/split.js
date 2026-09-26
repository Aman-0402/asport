/**
 * Splits `[data-split="words|chars"]` text into masked spans for reveal animations.
 * Screen readers get the original text from a visually-hidden copy; the animated
 * copy is aria-hidden.
 */
export function splitText(el) {
  const mode = el.dataset.split === 'chars' ? 'chars' : 'words';
  const text = el.textContent.replace(/\s+/g, ' ').trim();

  const reader = document.createElement('span');
  reader.className = 'visually-hidden';
  reader.textContent = text;

  const visual = document.createElement('span');
  visual.className = 'split';
  visual.setAttribute('aria-hidden', 'true');

  const words = text.split(' ');
  words.forEach((word, i) => {
    const mask = document.createElement('span');
    mask.className = 'split-line';
    const inner = document.createElement('span');
    inner.className = 'split-word';
    if (mode === 'chars') {
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'split-char';
        c.textContent = ch;
        inner.appendChild(c);
      }
    } else {
      inner.textContent = word;
    }
    mask.appendChild(inner);
    visual.appendChild(mask);
    if (i < words.length - 1) visual.appendChild(document.createTextNode(' '));
  });

  el.replaceChildren(reader, visual);
  el.classList.add('is-split');
  return [...visual.querySelectorAll(mode === 'chars' ? '.split-char' : '.split-word')];
}

/** Wraps each word of a paragraph for scroll-scrubbed highlighting. */
export function splitWords(el) {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const reader = document.createElement('span');
  reader.className = 'visually-hidden';
  reader.textContent = text;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  const words = text.split(' ').map((w, i, arr) => {
    const s = document.createElement('span');
    s.className = 'scrub-word';
    s.textContent = w;
    visual.appendChild(s);
    if (i < arr.length - 1) visual.appendChild(document.createTextNode(' '));
    return s;
  });
  el.replaceChildren(reader, visual);
  return words;
}
