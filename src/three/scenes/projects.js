import { createAmbient, DEFAULT_MOBILE_PATH } from './ambient.js';

/** Projects: a violet butterfly flies a zig-zag path as the page scrolls. */
export function create(ctx) {
  return createAmbient(ctx, {
    butterflies: [{ path: [[3.4, 1.1, -2.2], [-3.3, -0.3, -2.6], [3.3, -1, -2.4], [-3.2, 0.8, -2.8], [3, 0.2, -2]], mobilePath: DEFAULT_MOBILE_PATH, radius: 0.75, amp: 0.24, colors: { coral: '#b58cff', coralDeep: '#5a2fb0', mint: '#ffc2f0' } }],
    camera: { from: [0, 0, 7], to: [0, -2.5, 6] },
  });
}
