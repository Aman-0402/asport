import { gsap } from 'gsap';

const CURTAIN_KEY = 'astha-curtain';
const VISITED_KEY = 'astha-visited';

function store(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked: transitions still work, just without state */
  }
}

/**
 * First-visit loader. Resolves when fonts are ready (min 600ms, max 2s) so
 * entrance animations start once the loader has lifted.
 */
export function runLoader(env) {
  const root = document.documentElement;
  const loader = document.querySelector('.loader');
  if (!root.classList.contains('is-loading') || !loader || env.reducedMotion) {
    root.classList.remove('is-loading');
    return Promise.resolve();
  }
  store(VISITED_KEY, '1');

  const minWait = new Promise((r) => setTimeout(r, 600));
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const cap = new Promise((r) => setTimeout(r, 2000));

  return Promise.race([Promise.all([minWait, fonts]), cap]).then(
    () =>
      new Promise((resolve) => {
        loader.classList.add('is-leaving');
        setTimeout(resolve, 250);
        setTimeout(() => root.classList.remove('is-loading'), 750);
      })
  );
}

/**
 * Page transitions. Browsers with cross-document View Transitions use the CSS
 * in transitions.css; others get a coral curtain that wipes up between pages.
 */
export function initTransitions(env) {
  const root = document.documentElement;
  const curtain = document.querySelector('.page-curtain');
  const nativeVT = 'onpagereveal' in window;

  if (root.classList.contains('curtain-in') && curtain) {
    store(CURTAIN_KEY, null);
    gsap.fromTo(
      curtain,
      { yPercent: 0 },
      {
        yPercent: -100,
        duration: 0.8,
        ease: 'expo.inOut',
        delay: 0.05,
        onComplete: () => {
          root.classList.remove('curtain-in');
          gsap.set(curtain, { clearProps: 'transform' });
        },
      }
    );
  }

  if (env.reducedMotion || nativeVT || !curtain) return;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;

    e.preventDefault();
    gsap.fromTo(
      curtain,
      { yPercent: 100 },
      {
        yPercent: 0,
        duration: 0.6,
        ease: 'expo.inOut',
        onComplete: () => {
          store(CURTAIN_KEY, '1');
          location.href = url.href;
        },
      }
    );
  });

  // Returning via the back button restores a page from bfcache with the curtain up.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) gsap.set(curtain, { yPercent: 100 });
  });
}
