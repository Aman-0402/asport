/** One-time capability snapshot used to decide how much motion and 3D to run. */

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const mq = (q) => window.matchMedia(q).matches;

export const env = {
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  finePointer: mq('(hover: hover) and (pointer: fine)'),
  mobile: mq('(max-width: 767px)'),
  lowPower: (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4,
  webgl: hasWebGL(),
};

document.documentElement.classList.toggle('reduced-motion', env.reducedMotion);
