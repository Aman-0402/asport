import { createAmbient, DEFAULT_MOBILE_PATH } from './ambient.js';

/** Contact: one calm butterfly that flies down with the page and leans toward the pointer. */
export function create(ctx) {
  const ambient = createAmbient(ctx, {
    butterflies: [
      {
        path: [[2.8, 0.6, -1.5], [-2.9, -0.4, -2.2], [2.9, -0.2, -1.8]],
        mobilePath: DEFAULT_MOBILE_PATH,
        lean: 0.9,
        radius: 0.9,
        amp: 0.2,
        colors: { coral: '#5fe0b8', coralDeep: '#1f8a6c', mint: '#d2fff0' }, // emerald
      },
    ],
    particles: 700,
    pointerStrength: 0.15,
    camera: { from: [0, 0, 7], to: [0, 0, 7] },
  });
  const fly = ambient.butterflies[0];
  const baseUpdate = ambient.update;

  return {
    ...ambient,
    update(state, dt) {
      // Wings reach further as the pointer moves away from centre.
      fly.uniforms.uAmp.value = 0.2 + Math.hypot(state.pointer.x, state.pointer.y) * 0.08;
      baseUpdate(state, dt);
    },
  };
}
