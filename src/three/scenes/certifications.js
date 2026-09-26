import { createAmbient } from './ambient.js';

export function create(ctx) {
  return createAmbient(ctx, {
    blobs: [{ position: [3.3, 1.6, -2.5], mobilePosition: [1.3, 2.6, -4], radius: 1.1, amp: 0.2 }],
    camera: { from: [0, 0, 7], to: [0, -4, 6] },
  });
}
