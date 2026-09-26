import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages/home.css';
import './styles/pages/inner.css';

import { initTheme } from './core/theme.js';
import { initNav } from './core/nav.js';
import { initYear, initCopyEmail, initRotator, initProjectFilter } from './ui/misc.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

initTheme();
const nav = initNav();
initYear();
initCopyEmail();
initRotator(reducedMotion);
initProjectFilter();

window.addEventListener('scroll', () => nav.onScroll(window.scrollY), { passive: true });

// Basic reveal until the motion engine lands.
document.querySelectorAll('[data-split]').forEach((el) => el.classList.add('is-split'));
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  },
  { rootMargin: '0px 0px -10% 0px' }
);
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
document.documentElement.classList.add('app-ready');
