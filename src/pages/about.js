import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function init({ env }) {
  if (env.reducedMotion) {
    document.querySelectorAll('[data-word-list] li').forEach((li) => li.classList.add('is-lit'));
    return;
  }

  // Education rail fills as the timeline scrolls past.
  const fill = document.querySelector('[data-timeline-line]');
  const timeline = document.querySelector('.timeline');
  if (fill && timeline) {
    gsap.fromTo(
      fill,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: timeline, start: 'top 70%', end: 'bottom 60%', scrub: true },
      }
    );
  }

  // Strength words light up one by one while scrolling through the list.
  const words = gsap.utils.toArray('[data-word-list] li');
  words.forEach((li) => {
    ScrollTrigger.create({
      trigger: li,
      start: 'top 70%',
      onEnter: () => li.classList.add('is-lit'),
      onLeaveBack: () => li.classList.remove('is-lit'),
    });
  });

  // Portrait drifts slightly slower than the page for depth.
  const photo = document.querySelector('.profile__photo img');
  if (photo) {
    gsap.fromTo(
      photo,
      { yPercent: -6, scale: 1.12 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: '.profile', start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  }
}
