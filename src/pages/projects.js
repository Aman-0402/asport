import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Case studies stack as sticky panels: each panel tilts up from 3D as it
 * enters, and the one underneath recedes while the next slides over it.
 */
export function init({ env }) {
  if (env.reducedMotion) return;
  const cases = gsap.utils.toArray('.case');
  let triggers = [];

  const build = () => {
    triggers.forEach((t) => t.kill());
    triggers = [];
    const visible = cases.filter((c) => !c.hidden);

    visible.forEach((c, i) => {
      const inner = c.querySelector('.case__inner');
      gsap.set(inner, { clearProps: 'transform,opacity' });

      const enter = gsap.fromTo(
        inner,
        { rotationX: 14, y: 80, transformPerspective: 1400 },
        {
          rotationX: 0,
          y: 0,
          ease: 'power2.out',
          scrollTrigger: { trigger: c, start: 'top bottom', end: 'top 40%', scrub: true },
        }
      );
      triggers.push(enter.scrollTrigger);

      const next = visible[i + 1];
      if (next && window.matchMedia('(min-width: 900px)').matches) {
        const recede = gsap.to(inner, {
          scale: 0.92,
          opacity: 0.45,
          ease: 'none',
          scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 20%', scrub: true },
        });
        triggers.push(recede.scrollTrigger);
      }
    });
    ScrollTrigger.refresh();
  };

  build();
  document.addEventListener('layout:change', build);

  // Anchor links from the home page: land on the right case once layout settles.
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
}
