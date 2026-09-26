import { createAmbient } from './ambient.js';

/** Contact: one large, calm blob that leans toward the pointer. */
export function create(ctx) {
  const ambient = createAmbient(ctx, {
    blobs: [{ position: [2.8, 0, -1], mobilePosition: [0.6, -2.4, -3], radius: 1.35, amp: 0.2, speed: 0.12 }],
    particles: 700,
    pointerStrength: 0.15,
    camera: { from: [0, 0, 7], to: [0, 0, 7] },
  });
  const blob = ambient.blobs[0];
  const home = blob.base.clone();
  const baseUpdate = ambient.update;
  const baseResize = ambient.resize;

  return {
    ...ambient,
    resize(w, h) {
      baseResize(w, h);
      home.copy(blob.base);
    },
    update(state, dt) {
      const k = dt ? 1 - Math.pow(0.1, dt) : 1;
      blob.base.x += (home.x + state.pointer.x * 0.9 - blob.base.x) * k;
      blob.base.y += (home.y + state.pointer.y * 0.6 - blob.base.y) * k;
      blob.uniforms.uAmp.value = 0.2 + Math.hypot(state.pointer.x, state.pointer.y) * 0.08;
      baseUpdate(state, dt);
    },
  };
}
