import { createAmbient } from './ambient.js';

export function create(ctx) {
  return createAmbient(ctx, {
    blobs: [{ position: [3.3, 1.9, -3], mobilePosition: [1.4, 2.6, -4], radius: 1, amp: 0.18 }],
    camera: { from: [0, 0, 7], to: [0, -4.5, 6.5] },
  });
}
