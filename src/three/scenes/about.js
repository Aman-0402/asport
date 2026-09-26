import { createAmbient, DEFAULT_PATH, DEFAULT_MOBILE_PATH } from './ambient.js';

/** About: a monarch orange butterfly flies a zig-zag path as the page scrolls. */
export function create(ctx) {
  return createAmbient(ctx, {
    butterflies: [{ path: DEFAULT_PATH, mobilePath: DEFAULT_MOBILE_PATH, radius: 0.8, amp: 0.2, colors: { coral: '#ffa24c', coralDeep: '#b8561c', mint: '#ffe0a3' } }],
    camera: { from: [0, 0, 7], to: [0, -3, 6] },
  });
}
