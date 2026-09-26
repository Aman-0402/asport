import { gsap } from 'gsap';

/** The certificate swings in from a 3D angle and settles flat as it reaches the centre. */
export function init({ env }) {
  const card = document.querySelector('[data-certificate-card]');
  if (!card || env.reducedMotion) return;

  gsap.fromTo(
    card,
    { rotationY: -32, rotationX: 14, z: -120, transformPerspective: 1200 },
    {
      rotationY: 0,
      rotationX: 0,
      z: 0,
      ease: 'power2.out',
      scrollTrigger: { trigger: '[data-certificate]', start: 'top 95%', end: 'center 55%', scrub: true },
    }
  );

  if (env.finePointer) {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 10);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
    });
    card.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  }
}
