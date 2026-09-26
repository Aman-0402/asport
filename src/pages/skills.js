import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Skill sphere: labels placed on a Fibonacci sphere and projected with
 * CSS transforms (crisp DOM text, no WebGL text). Rotates slowly, leans
 * toward the pointer, and highlights the skill group currently in view.
 */
function initSphere(sphere, env) {
  const items = [...sphere.querySelectorAll('li')];
  const n = items.length;
  const points = items.map((_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
  });

  let radius = 0;
  const measure = () => {
    radius = sphere.clientWidth * 0.4;
  };
  measure();
  new ResizeObserver(measure).observe(sphere);

  sphere.classList.add('is-3d');
  let ay = 0;
  let ax = -0.25;
  let targetAx = -0.25;
  let speed = 0.22;
  let hover = false;

  if (env.finePointer) {
    sphere.addEventListener('pointerenter', () => (hover = true));
    sphere.addEventListener('pointerleave', () => {
      hover = false;
      targetAx = -0.25;
    });
    sphere.addEventListener('pointermove', (e) => {
      const r = sphere.getBoundingClientRect();
      targetAx = ((e.clientY - r.top) / r.height - 0.5) * 1.2;
    });
  }

  const render = (dt) => {
    const s = hover ? 0.06 : speed;
    ay += dt * s;
    ax += (targetAx - ax) * Math.min(1, dt * 3);
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const x1 = p.x * cy + p.z * sy;
      const z1 = -p.x * sy + p.z * cy;
      const y2 = p.y * cx - z1 * sx;
      const z2 = p.y * sx + z1 * cx;
      const depth = (z2 + 1) / 2;
      const el = items[i];
      el.style.transform = `translate(-50%, -50%) translate3d(${(x1 * radius).toFixed(1)}px, ${(y2 * radius).toFixed(1)}px, 0) scale(${(0.7 + depth * 0.45).toFixed(3)})`;
      el.style.opacity = (0.22 + depth * 0.78).toFixed(3);
      el.style.zIndex = String(Math.round(depth * 100));
    }
  };

  if (env.reducedMotion) {
    render(0);
    return;
  }
  gsap.ticker.add((_t, deltaMs) => {
    if (document.hidden) return;
    render(Math.min(deltaMs / 1000, 0.05));
  });
  // Scroll velocity nudges the spin.
  return (velocity) => {
    speed = 0.22 + Math.min(Math.abs(velocity) * 0.05, 1.2);
  };
}

export function init({ env, scroll }) {
  const sphere = document.querySelector('[data-skill-sphere]');
  if (!sphere) return;
  const nudge = initSphere(sphere, env);
  if (nudge) scroll.subscribe(({ velocity }) => nudge(velocity));

  document.querySelectorAll('[data-skill-group]').forEach((group) => {
    ScrollTrigger.create({
      trigger: group,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (self.isActive) sphere.dataset.active = group.dataset.skillGroup;
      },
    });
  });

  if (!env.reducedMotion) {
    gsap.utils.toArray('.skill-list').forEach((list) => {
      gsap.from(list.children, {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.05,
        scrollTrigger: { trigger: list, start: 'top 85%', once: true },
      });
    });
  }
}
