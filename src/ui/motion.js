import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitText, splitWords } from './split.js';
import { onThemeChange } from '../core/theme.js';

/** Masked word/char rise for `[data-split]` headings. */
export function initSplitReveals(env) {
  document.querySelectorAll('[data-split]').forEach((el) => {
    if (env.reducedMotion) {
      el.classList.add('is-split');
      return;
    }
    const isChars = el.dataset.split === 'chars';
    const parts = splitText(el);
    gsap.set(parts, { yPercent: 115, rotate: isChars ? 0 : 3 });
    gsap.to(parts, {
      yPercent: 0,
      rotate: 0,
      duration: isChars ? 1.2 : 1.05,
      ease: 'expo.out',
      stagger: isChars ? 0.035 : 0.045,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}

/** Fade-up for `[data-reveal]`, batched so neighbours stagger naturally. */
export function initReveals(env) {
  const els = gsap.utils.toArray('[data-reveal]');
  if (env.reducedMotion) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  ScrollTrigger.batch(els, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      batch.forEach((el, i) => {
        el.style.setProperty('--reveal-delay', `${i * 90}ms`);
        el.classList.add('is-in');
      }),
  });
}

/** Resolves a CSS colour token (OKLCH here) to rgb() so GSAP can interpolate it. */
const colorCanvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function tokenToRgb(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  colorCanvas.clearRect(0, 0, 1, 1);
  colorCanvas.fillStyle = value;
  colorCanvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = colorCanvas.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Word-by-word colour scrubbed to scroll for `[data-scrub-words]`. */
export function initScrubWords(env) {
  if (env.reducedMotion) return;
  document.querySelectorAll('[data-scrub-words]').forEach((el) => {
    const words = splitWords(el);
    let tween;
    // Animate colour, not opacity, so dimmed words still meet AA contrast.
    const build = () => {
      tween = gsap.fromTo(
        words,
        { color: tokenToRgb('--text-faint') },
        {
          color: tokenToRgb('--text'),
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true },
        }
      );
    };
    build();
    onThemeChange(() => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(words, { clearProps: 'color' });
      build();
    });
  });
}

/** Count-up numbers for `[data-count]`. */
export function initCounters(env) {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    if (env.reducedMotion) return;
    const obj = { v: 0 };
    el.textContent = '0';
    gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = String(Math.round(obj.v));
      },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/** Buttons and links that lean toward the pointer. Fine pointers only. */
export function initMagnetic(env) {
  if (env.reducedMotion || !env.finePointer) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const strength = el.classList.contains('btn') ? 0.3 : 0.12;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

/** Subtle 3D tilt on media and rows. Fine pointers only. */
export function initTilt(env) {
  if (env.reducedMotion || !env.finePointer) return;
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const max = el.tagName === 'A' ? 3 : 7;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      ry(px * max * 2);
      rx(-py * max * 2);
    });
    el.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}

/** Infinite marquee whose speed reacts to scroll velocity. */
export function initMarquee(env, scroll) {
  document.querySelectorAll('[data-marquee]').forEach((wrap) => {
    const track = wrap.querySelector('.marquee__track');
    if (!track) return;
    if (env.reducedMotion) {
      wrap.classList.add('is-static');
      return;
    }
    [...track.children].forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.appendChild(copy);
    });
    track.style.paddingRight = getComputedStyle(track).columnGap;

    const tween = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
    let boost = 1;
    scroll.subscribe(({ velocity }) => {
      boost = 1 + Math.min(Math.abs(velocity) * 0.12, 4);
    });
    gsap.ticker.add(() => {
      const current = tween.timeScale();
      tween.timeScale(current + (boost - current) * 0.08);
      boost += (1 - boost) * 0.05;
    });
  });
}
