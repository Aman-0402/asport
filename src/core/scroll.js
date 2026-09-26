import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scroll (Lenis) driven by the GSAP ticker so ScrollTrigger, Lenis,
 * and the WebGL loop all advance on the same frame. Falls back to native
 * scrolling when the user prefers reduced motion.
 */
export function initScroll(env) {
  const subscribers = new Set();
  let lenis = null;

  const emit = () => {
    const y = window.scrollY;
    const max = Math.max(1, ScrollTrigger.maxScroll(window));
    const info = { y, progress: Math.min(1, y / max), velocity: lenis ? lenis.velocity : 0 };
    subscribers.forEach((fn) => fn(info));
  };

  if (!env.reducedMotion) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: true });
    lenis.on('scroll', () => {
      ScrollTrigger.update();
      emit();
    });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', emit, { passive: true });
  }

  let refreshQueued = false;
  const refresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      lenis?.resize();
      ScrollTrigger.refresh();
    });
  };
  document.addEventListener('layout:change', refresh);
  document.fonts?.ready.then(refresh);
  window.addEventListener('load', refresh);

  return {
    lenis,
    refresh,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    lock() {
      lenis?.stop();
      document.documentElement.classList.add('scroll-locked');
    },
    unlock() {
      lenis?.start();
      document.documentElement.classList.remove('scroll-locked');
    },
  };
}
