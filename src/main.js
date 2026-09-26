import { env } from './core/env.js';
import { initNav } from './core/nav.js';
import { initScroll } from './core/scroll.js';
import { runLoader, initTransitions } from './core/transitions.js';
import { initYear, initCopyEmail, initRotator, initProjectFilter } from './ui/misc.js';
import {
  initSplitReveals,
  initReveals,
  initScrubWords,
  initCounters,
  initMagnetic,
  initTilt,
  initMarquee,
} from './ui/motion.js';

const pageModules = {
  home: () => import('./pages/home.js'),
  about: () => import('./pages/about.js'),
  skills: () => import('./pages/skills.js'),
  projects: () => import('./pages/projects.js'),
  certifications: () => import('./pages/certifications.js'),
  contact: () => import('./pages/contact.js'),
};

const page = document.body.dataset.page;

const scroll = initScroll(env);
const nav = initNav({ lockScroll: scroll.lock, unlockScroll: scroll.unlock });
scroll.subscribe(({ y }) => nav.onScroll(y));

initYear();
initCopyEmail();
initRotator(env.reducedMotion);
initProjectFilter();
initTransitions(env);

// 3D boots after first paint work settles so shader compilation never delays content.
const idle = () =>
  new Promise((resolve) => {
    const go = () => ('requestIdleCallback' in window ? requestIdleCallback(resolve, { timeout: 1200 }) : setTimeout(resolve, 200));
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  });
const engine = env.webgl
  ? idle()
      .then(() => import('./three/engine.js'))
      .then(({ startEngine }) => startEngine({ page, env, scroll }))
      .catch((err) => {
        console.warn('3D scene disabled:', err);
        return null;
      })
  : Promise.resolve(null);

const loading = document.documentElement.classList.contains('is-loading');
if (loading) scroll.lock();
await runLoader(env);
if (loading) scroll.unlock();

initSplitReveals(env);
initReveals(env);
initScrubWords(env);
initCounters(env);
initMagnetic(env);
initTilt(env);
initMarquee(env, scroll);

document.documentElement.classList.add('app-ready');

pageModules[page]?.()
  .then((mod) => mod.init?.({ env, scroll, engine }))
  .catch((err) => console.warn(`Page module "${page}" failed:`, err));
