import { createAmbient, DEFAULT_MOBILE_PATH } from './ambient.js';

/** Skills: the butterfly flies a zig-zag path as the page scrolls. */
export function create(ctx) {
  return createAmbient(ctx, {
    butterflies: [{ path: [[3.3, 1.6, -2.5], [-3.2, 0, -2.8], [3.2, -1.2, -2.4], [-3, 0.9, -3], [3.1, 0.3, -2]], mobilePath: DEFAULT_MOBILE_PATH, radius: 0.75, amp: 0.18 }],
    camera: { from: [0, 0, 7], to: [0, -4.5, 6.5] },
  });
}
