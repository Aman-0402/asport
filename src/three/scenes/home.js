import { createAmbient } from './ambient.js';

export function create(ctx) {
  return createAmbient(ctx, {
    blobs: [
      { position: [2.5, 0.5, -0.5], mobilePosition: [1.2, 2.5, -3.5], radius: 1.3, amp: 0.22 },
      { position: [4.4, -1.6, -2.5], mobilePosition: [-2.4, -3.4, -5], radius: 0.5, amp: 0.16, speed: 0.3 },
    ],
    camera: { from: [0, 0, 7], to: [-0.6, -2.4, 5] },
  });
}
