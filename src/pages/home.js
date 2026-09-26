import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Blob stations per section: [x, y, z], scale, opacity, satellite opacity. */
const STATIONS = {
  desktop: {
    hero: { x: 2.5, y: 0.5, z: -0.5, scale: 1, opacity: 1, satellite: 1 },
    intro: { x: 3.4, y: 1.7, z: -3.4, scale: 0.75, opacity: 1, satellite: 0 },
    focus: { x: -3.3, y: -1.7, z: -2, scale: 0.62, opacity: 1, satellite: 0 },
    work: { x: 4.2, y: 2.3, z: -6, scale: 0.6, opacity: 0.8, satellite: 0 },
    cert: { x: -3.7, y: -2.3, z: -3, scale: 0.7, opacity: 1, satellite: 1 },
  },
  mobile: {
    hero: { x: 1.2, y: 2.5, z: -3.5, scale: 1, opacity: 1, satellite: 1 },
    intro: { x: 1.8, y: 0.4, z: -6, scale: 0.8, opacity: 0.35, satellite: 0 },
    focus: { x: -1.6, y: -1.4, z: -6, scale: 0.8, opacity: 0.3, satellite: 0 },
    work: { x: 1.6, y: 1.2, z: -7, scale: 0.7, opacity: 0.3, satellite: 0 },
    cert: { x: 0, y: 2.4, z: -6, scale: 0.9, opacity: 0.45, satellite: 0 },
  },
};

/** Shape personality for each focus area: amplitude, frequency, rim light. */
const MORPHS = [
  { amp: 0.22, freq: 0.75, rim: 0.6 },
  { amp: 0.14, freq: 1.25, rim: 0.85 },
  { amp: 0.34, freq: 0.5, rim: 0.5 },
  { amp: 0.1, freq: 1.55, rim: 1 },
];

export async function init({ env, engine }) {
  const hero = document.querySelector('[data-hero]');
  const focusList = document.querySelector('.focus__list');
  const focusItems = gsap.utils.toArray('[data-focus-item]');

  if (!env.reducedMotion && hero) {
    gsap.to(hero.querySelector('.hero__inner'), {
      yPercent: -18,
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 15%', scrub: true },
    });
  }

  const eng = await engine;
  const api = eng?.api;

  // Focus list: highlight the item nearest the middle of the viewport and morph the blob.
  if (focusList && focusItems.length && !env.reducedMotion) {
    focusList.classList.add('is-tracking');
    const settle = () => {
      if (api) gsap.to(api.target, { ...MORPHS[0], duration: 1.6, ease: 'power3.out', overwrite: 'auto' });
    };
    const activate = (i) => {
      focusItems.forEach((el, j) => el.classList.toggle('is-active', i === j));
      if (api) gsap.to(api.target, { ...MORPHS[i % MORPHS.length], duration: 1.4, ease: 'power3.out', overwrite: 'auto' });
    };
    focusItems.forEach((item, i) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 62%',
        end: 'bottom 62%',
        onToggle: (self) => self.isActive && activate(i),
      });
    });
    ScrollTrigger.create({
      trigger: focusList,
      start: 'top 62%',
      end: 'bottom 62%',
      onLeave: () => {
        focusList.classList.remove('is-tracking');
        settle();
      },
      onLeaveBack: () => {
        focusList.classList.remove('is-tracking');
        settle();
      },
      onEnter: () => focusList.classList.add('is-tracking'),
      onEnterBack: () => focusList.classList.add('is-tracking'),
    });
    focusList.classList.remove('is-tracking');
  }

  if (!api || env.reducedMotion) return;

  // Blob travels between stations, scrubbed to each section's entrance.
  const s = env.mobile ? STATIONS.mobile : STATIONS.desktop;
  api.sync();
  Object.assign(api.target, s.hero);
  gsap.from(api.target, { scale: 0.7, duration: 2.2, ease: 'expo.out' });

  const legs = [
    ['.intro', s.hero, s.intro],
    ['.focus', s.intro, s.focus],
    ['.work', s.focus, s.work],
    ['.cert-teaser', s.work, s.cert],
  ];
  legs.forEach(([selector, from, to]) => {
    const trigger = document.querySelector(selector);
    if (!trigger) return;
    gsap.fromTo(api.target, { ...from }, {
      ...to,
      ease: 'power1.inOut',
      immediateRender: false,
      scrollTrigger: { trigger, start: 'top bottom', end: 'top 25%', scrub: true },
    });
  });
}
