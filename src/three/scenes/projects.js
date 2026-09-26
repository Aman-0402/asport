import { createAmbient } from './ambient.js';

export function create(ctx) {
  return createAmbient(ctx, {
    blobs: [{ position: [3.4, 1.2, -2], mobilePosition: [1.6, 3.4, -5.5], radius: 1, amp: 0.24 }],
    camera: { from: [0, 0, 7], to: [0, -2.5, 6] },
  });
}
