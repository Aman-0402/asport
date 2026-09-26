/** One-time capability snapshot used to decide how much motion and 3D to run. */

/**
 * True only for hardware-accelerated WebGL. Software rasterizers (SwiftShader,
 * llvmpipe) make every frame a long main-thread task, so those devices get the
 * CSS backdrop instead. `?webgl=force` overrides for testing.
 */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    if (new URLSearchParams(location.search).get('webgl') === 'force') return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software/i.test(renderer);
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
