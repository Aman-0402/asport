import * as THREE from 'three';
import { createButterfly } from '../butterfly.js';
import { createParticles } from '../particles.js';
import { palette } from '../palette.js';

/**
 * Shared scene recipe: one or more butterflies plus drifting particles, with
 * the camera dollying along z as the page scrolls. Page scenes pass config and
 * may extend the returned object. Wings beat faster while the page scrolls.
 *
 * A butterfly with a `path` flies along it as the page scrolls (0 = top,
 * 1 = bottom). Path points are relative to the camera, so it stays in view
 * while the camera dollies; `mobilePath` replaces it on narrow screens and
 * `lean` pulls it toward the pointer.
 */

/** Default scroll flight: zig-zags across the screen, mostly beside the copy. */
export const DEFAULT_PATH = [
  [3.2, 1.3, -2],
  [-3.4, -0.6, -2.6],
  [3.4, -1, -2.2],
  [-3.2, 0.8, -3],
  [3, 0.2, -1.8],
];
export const DEFAULT_MOBILE_PATH = [
  [1.2, 2.6, -4],
  [-1.3, -2.6, -5],
  [1.3, -2.4, -4.5],
  [-1.2, 2.4, -5],
  [1, 2.2, -4],
];

export function createAmbient({ renderer, env }, config = {}) {
  const {
    butterflies = [{ position: [2.4, 0.4, 0], radius: 1.4 }],
    particles = 520,
    camera: cam = { from: [0, 0, 7], to: [0, -1.5, 5.5] },
    pointerStrength = 0.35,
  } = config;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(...cam.from);

  const group = new THREE.Group();
  scene.add(group);

  const toCurve = (pts) => pts && new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
  let narrow = false;
  const items = butterflies.map((b) => {
    const fly = createButterfly({ ...b, palette });
    const start = b.path ? b.path[0] : b.position;
    fly.mesh.position.set(...start);
    fly.base = new THREE.Vector3(...start);
    fly.curve = toCurve(b.path);
    fly.mobileCurve = toCurve(b.mobilePath ?? b.path);
    fly.lean = b.lean ?? 0;
    fly.progress = 0;
    fly.float = b.float ?? 0.18;
    fly.phase = Math.random() * Math.PI * 2;
    group.add(fly.mesh);
    return fly;
  });
  let boost = 0;

  const dust = createParticles({
    count: env.lowPower || env.mobile ? Math.round(particles * 0.45) : particles,
    palette,
    pixelRatio: renderer.getPixelRatio(),
  });
  scene.add(dust.points);

  const from = new THREE.Vector3(...cam.from);
  const to = new THREE.Vector3(...cam.to);
  const lookAt = new THREE.Vector3(0, 0, 0);
  const desired = new THREE.Vector3();
  const point = new THREE.Vector3();

  return {
    scene,
    camera,
    group,
    butterflies: items,
    dust,
    /** Scroll-mapped camera position; page scenes can override via config.camera. */
    update(state, dt) {
      const t = state.time;
      // Scroll speed (px/frame) quickens the wing beat; eases back when scrolling stops.
      const wanted = Math.min(Math.abs(state.velocity) / 30, 1.5);
      boost += (wanted - boost) * (dt ? 1 - Math.pow(0.05, dt) : 1);
      items.forEach((b) => {
        b.uniforms.uTime.value = t;
        const curve = narrow ? b.mobileCurve : b.curve;
        if (curve) {
          // Follow the scroll with a little lag so the flight feels alive.
          b.progress += (state.scroll - b.progress) * (dt ? 1 - Math.pow(0.08, dt) : 1);
          curve.getPoint(THREE.MathUtils.clamp(b.progress, 0, 1), point);
          b.base.set(
            point.x + camera.position.x + state.pointer.x * b.lean,
            point.y + camera.position.y + state.pointer.y * b.lean * 0.7,
            point.z
          );
          // Fade while crossing the middle of the screen so text stays readable.
          const side = THREE.MathUtils.smoothstep(Math.abs(point.x), narrow ? 0.4 : 1.2, narrow ? 1.1 : 2.8);
          b.uniforms.uOpacity.value = 0.35 + 0.65 * side;
        }
        // Bank into horizontal travel, sway gently while hovering.
        const vx = dt ? (b.base.x - b.mesh.position.x) / dt : 0;
        b.mesh.position.x = b.base.x;
        b.mesh.position.z = b.base.z;
        b.mesh.position.y = b.base.y + Math.sin(t * 0.6 + b.phase) * b.float;
        b.mesh.rotation.y = Math.sin(t * 0.35 + b.phase) * 0.35;
        b.mesh.rotation.z += (THREE.MathUtils.clamp(-vx * 0.15, -0.5, 0.5) - b.mesh.rotation.z) * 0.08;
        b.flap(t, boost);
      });
      dust.uniforms.uTime.value = t;
      dust.points.rotation.y = state.scroll * 0.6;

      desired.lerpVectors(from, to, state.scroll);
      desired.x += state.pointer.x * pointerStrength;
      desired.y += state.pointer.y * pointerStrength;
      camera.position.lerp(desired, dt ? 1 - Math.pow(0.02, dt) : 1);
      // Pan rather than orbit: look straight ahead so scene content scrolls with the page.
      lookAt.set(camera.position.x * 0.5, camera.position.y, 0);
      camera.lookAt(lookAt);
    },
    resize(w) {
      // Keep the composition readable on narrow screens: push butterflies back and centre them.
      narrow = w < 768;
      items.forEach((b, i) => {
        const cfg = butterflies[i];
        if (cfg.path) return;
        const p = narrow && cfg.mobilePosition ? cfg.mobilePosition : cfg.position;
        b.base.set(...p);
      });
    },
  };
}
