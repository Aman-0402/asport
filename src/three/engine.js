import * as THREE from 'three';
import { gsap } from 'gsap';
import { getTheme, onThemeChange } from '../core/theme.js';

const scenes = {
  home: () => import('./scenes/home.js'),
  about: () => import('./scenes/about.js'),
  skills: () => import('./scenes/skills.js'),
  projects: () => import('./scenes/projects.js'),
  certifications: () => import('./scenes/certifications.js'),
  contact: () => import('./scenes/contact.js'),
};

function disposeScene(scene) {
  scene.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => m?.dispose());
  });
}

/**
 * Boots the single fixed WebGL canvas and the scene for the current page.
 * Scene modules export `create(ctx)` returning
 * `{ scene, camera, update(state, dt), resize?(w, h), setTheme?(t), dispose?() }`.
 * Resolves to null when WebGL is unavailable, so pages never depend on it.
 */
export async function startEngine({ page, env, scroll }) {
  const canvas = document.getElementById('webgl');
  const load = scenes[page];
  if (!canvas || !env.webgl || !load) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !env.lowPower,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const maxDpr = env.mobile || env.lowPower ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const { create } = await load();
  const api = create({ renderer, env, theme: getTheme() });

  const state = {
    time: 0,
    scroll: 0,
    velocity: 0,
    pointer: { x: 0, y: 0 },
    pointerTarget: { x: 0, y: 0 },
  };

  const render = () => renderer.render(api.scene, api.camera);

  // Compile shaders off the main thread where KHR_parallel_shader_compile exists.
  try {
    await renderer.compileAsync(api.scene, api.camera);
  } catch {
    /* falls back to compiling on the first render */
  }

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    api.camera.aspect = w / h;
    api.camera.updateProjectionMatrix();
    api.resize?.(w, h);
    if (env.reducedMotion) render();
  };
  resize();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  if (env.finePointer && !env.reducedMotion) {
    window.addEventListener(
      'pointermove',
      (e) => {
        state.pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
        state.pointerTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true }
    );
  }

  scroll.subscribe(({ progress, velocity }) => {
    state.scroll = progress;
    state.velocity = velocity;
    if (env.reducedMotion) {
      api.update(state, 0);
      render();
    }
  });

  onThemeChange((theme) => {
    api.setTheme?.(theme);
    render();
  });

  // Phones and low-power machines render at ~30fps; motion stays time-based.
  const frameBudget = env.mobile || env.lowPower ? 1 / 32 : 0;
  let pending = 0;
  const tick = (_time, deltaMs) => {
    if (document.hidden) return;
    pending += deltaMs / 1000;
    if (pending < frameBudget) return;
    const dt = Math.min(pending, 1 / 20);
    pending = 0;
    state.time += dt;
    const k = 1 - Math.pow(0.001, dt);
    state.pointer.x += (state.pointerTarget.x - state.pointer.x) * k;
    state.pointer.y += (state.pointerTarget.y - state.pointer.y) * k;
    api.update(state, dt);
    render();
  };

  if (env.reducedMotion) {
    api.update(state, 0);
    render();
  } else {
    gsap.ticker.add(tick);
  }

  requestAnimationFrame(() => canvas.classList.add('is-ready'));

  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    gsap.ticker.remove(tick);
    api.dispose?.();
    disposeScene(api.scene);
    renderer.dispose();
  });

  return { api, state, render };
}
