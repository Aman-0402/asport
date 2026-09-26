import { createAmbient } from './ambient.js';

export function create(ctx) {
  return createAmbient(ctx, {
    blobs: [{ position: [2.8, 0.4, -2.5], mobilePosition: [0, 1.8, -4], radius: 1.3, amp: 0.18 }],
    camera: { from: [0, 0, 7], to: [0.6, -2, 6.5] },
  });
}
