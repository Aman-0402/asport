import * as THREE from 'three';
import { createBlob } from '../blob.js';
import { createParticles } from '../particles.js';
import { palettes } from '../palette.js';

/**
 * Shared scene recipe: a few noise blobs plus drifting particles, with the
 * camera dollying along z as the page scrolls. Page scenes pass config and
 * may extend the returned object.
 */
export function createAmbient({ renderer, env, theme }, config = {}) {
  const {
    blobs = [{ position: [2.4, 0.4, 0], radius: 1.4 }],
    particles = 520,
    camera: cam = { from: [0, 0, 7], to: [0, -1.5, 5.5] },
    pointerStrength = 0.35,
    spin = 0.08,
  } = config;

  let palette = palettes[theme];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(...cam.from);

  const group = new THREE.Group();
  scene.add(group);

  const detail = env.lowPower || env.mobile ? 28 : 56;
  const blobItems = blobs.map((b) => {
    const blob = createBlob({ ...b, detail: b.detail ?? detail, palette });
    blob.mesh.position.set(...b.position);
    blob.base = new THREE.Vector3(...b.position);
    blob.float = b.float ?? 0.18;
    blob.phase = Math.random() * Math.PI * 2;
    group.add(blob.mesh);
    return blob;
  });

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

  return {
    scene,
    camera,
    group,
    blobs: blobItems,
    dust,
    /** Scroll-mapped camera position; page scenes can override via config.camera. */
    update(state, dt) {
      const t = state.time;
      blobItems.forEach((b) => {
        b.uniforms.uTime.value = t;
        b.mesh.position.x = b.base.x;
        b.mesh.position.z = b.base.z;
        b.mesh.position.y = b.base.y + Math.sin(t * 0.6 + b.phase) * b.float;
        b.mesh.rotation.y += dt * spin;
        b.mesh.rotation.x += dt * spin * 0.4;
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
    setTheme(next) {
      palette = palettes[next];
      blobItems.forEach((b) => b.setPalette(palette));
      dust.setPalette(palette);
    },
    resize(w) {
      // Keep the composition readable on narrow screens: push blobs back and centre them.
      const narrow = w < 768;
      blobItems.forEach((b, i) => {
        const cfg = blobs[i];
        const p = narrow && cfg.mobilePosition ? cfg.mobilePosition : cfg.position;
        b.base.set(...p);
      });
    },
  };
}
