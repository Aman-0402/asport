import { createAmbient } from './ambient.js';

export function create(ctx) {
  return createAmbient(ctx, {
    blobs: [{ position: [2.8, 0, -1], mobilePosition: [0.6, -2.4, -3], radius: 1.7, amp: 0.3, speed: 0.12 }],
    particles: 700,
    camera: { from: [0, 0, 7], to: [0, 0, 7] },
  });
}
