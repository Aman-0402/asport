import { createAmbient, DEFAULT_MOBILE_PATH } from './ambient.js';

/** Projects: the butterfly flies a zig-zag path as the page scrolls. */
export function create(ctx) {
  return createAmbient(ctx, {
    butterflies: [{ path: [[-3.2, 1.2, -2.2], [3.4, -0.4, -2.4], [-3.3, -1, -2.6], [3.2, 0.8, -2.8], [-3, 0.2, -2]], mobilePath: DEFAULT_MOBILE_PATH, radius: 0.75, amp: 0.24 }],
    camera: { from: [0, 0, 7], to: [0, -2.5, 6] },
  });
}
