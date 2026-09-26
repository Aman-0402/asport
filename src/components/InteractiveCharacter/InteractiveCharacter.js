/**
 * InteractiveCharacter
 * --------------------
 * A single canvas that shows one frame of a pre-rendered character at a time.
 * The character "watches" the visitor's pointer: the pointer direction picks a
 * representative frame, and the displayed frame eases toward it along the
 * original frame sequence, so every in-between frame is real footage.
 *
 * Usage:
 *   import { mountInteractiveCharacter } from './InteractiveCharacter.js';
 *   const destroy = mountInteractiveCharacter(containerEl, { trackingArea: heroEl });
 */

/* ============================================================
   Configuration (edit here)
   ============================================================ */

/** Frame files: public/character/webp/frame_0001.webp ... frame_0300.webp */
const FRAME_COUNT = 300;
const frameUrl = (n) => `${import.meta.env.BASE_URL}character/webp/frame_${String(n).padStart(4, '0')}.webp`;

/** Native frame size, used for the canvas aspect ratio. */
const FRAME_WIDTH = 800;
const FRAME_HEIGHT = 450;

/** Representative frame (1-based) for each gaze direction. */
const DIRECTION_FRAMES = {
  center: 1,
  left: 50,
  topLeft: 80,
  topRight: 112,
  right: 145,
  bottomRight: 178,
  bottomLeft: 212,
};

/**
 * Tracking behaviour per device class.
 * - deadZone: radius around the character's centre (as a fraction of the
 *   tracking area's smaller side) where the character looks straight ahead.
 * - sensitivity: scales the pointer offset before the dead-zone test. Lower
 *   values mean the pointer must travel further before the gaze changes.
 */
const TRACKING = {
  desktop: { enabled: true, deadZone: 0.12, sensitivity: 1 },
  tablet: { enabled: true, deadZone: 0.2, sensitivity: 0.6 },
  mobile: { enabled: false, deadZone: 1, sensitivity: 0 },
};
const BREAKPOINTS = { mobile: 767, tablet: 1199 };

/**
 * Motion.
 * - smoothing: fraction of the remaining distance covered each frame (0..1).
 * - maxStep: cap on frames advanced per tick, so long transitions play as
 *   motion instead of skipping.
 * - loop: the sequence ends where it starts (frame 300 is next to frame 1),
 *   so transitions may wrap around and take the shorter path.
 */
const MOTION = { smoothing: 0.1, maxStep: 5, loop: true };

/** Where the face sits inside the frame (fractions of width/height): the gaze origin. */
const FACE_ORIGIN = { x: 0.5, y: 0.42 };

/** Frames downloaded in parallel after the first one. */
const PRELOAD_CONCURRENCY = 6;

/* ============================================================
   Frame loading
   ============================================================ */

/** Loads and decodes one frame. Resolves with the image, or null on failure. */
export function loadFrame(n) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = frameUrl(n);
    const done = () => resolve(img);
    if (img.decode) img.decode().then(done, () => resolve(null));
    else {
      img.onload = done;
      img.onerror = () => resolve(null);
    }
  });
}

/**
 * Loads every frame progressively without blocking the page: direction frames
 * first (so gaze works early), then the rest in sequence order.
 * `frames[i]` is filled as each image arrives; `isCancelled()` stops the queue.
 */
export function preloadFrames(frames, { isCancelled, onFrame }) {
  const priority = [...new Set(Object.values(DIRECTION_FRAMES))];
  const rest = [];
  for (let n = 1; n <= FRAME_COUNT; n++) if (!priority.includes(n) && !frames[n - 1]) rest.push(n);
  const queue = [...priority.filter((n) => !frames[n - 1]), ...rest];

  const worker = async () => {
    while (queue.length && !isCancelled()) {
      const n = queue.shift();
      const img = await loadFrame(n);
      if (isCancelled()) return;
      if (img) {
        frames[n - 1] = img;
        onFrame?.(n);
      }
    }
  };
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  return new Promise((resolve) => {
    idle(() => Promise.all(Array.from({ length: PRELOAD_CONCURRENCY }, worker)).then(resolve));
  });
}

/* ============================================================
   Direction mapping
   ============================================================ */

/**
 * Returns a direction key for a pointer offset from the character's centre.
 * Angles are measured in screen space (y grows downward):
 *   right       -30..30      bottomRight  30..90     bottomLeft  90..150
 *   left        150..-150    topLeft    -150..-90    topRight   -90..-30
 */
export function getMouseDirection(dx, dy, radius, { deadZone, sensitivity }) {
  const sx = dx * sensitivity;
  const sy = dy * sensitivity;
  if (Math.hypot(sx, sy) < radius * deadZone) return 'center';

  const angle = (Math.atan2(sy, sx) * 180) / Math.PI;
  if (angle >= -30 && angle < 30) return 'right';
  if (angle >= 30 && angle < 90) return 'bottomRight';
  if (angle >= 90 && angle < 150) return 'bottomLeft';
  if (angle >= -90 && angle < -30) return 'topRight';
  if (angle >= -150 && angle < -90) return 'topLeft';
  return 'left';
}

/** Zero-based frame index for a direction key. */
export function getTargetFrame(direction) {
  return (DIRECTION_FRAMES[direction] ?? DIRECTION_FRAMES.center) - 1;
}

/** Signed distance from `from` to `to`, taking the short way round when looping. */
function frameDelta(from, to) {
  let d = to - from;
  if (MOTION.loop) {
    const half = FRAME_COUNT / 2;
    d = ((((d + half) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT) - half;
  }
  return d;
}

/* ============================================================
   Drawing
   ============================================================ */

/** Nearest loaded frame to `index`, so gaps during preload never flash blank. */
function nearestLoaded(frames, index) {
  if (frames[index]) return frames[index];
  for (let o = 1; o < FRAME_COUNT; o++) {
    const a = frames[(index + o) % FRAME_COUNT];
    if (a) return a;
    const b = frames[(index - o + FRAME_COUNT) % FRAME_COUNT];
    if (b) return b;
  }
  return null;
}

/**
 * Where the frame lands on a canvas of `width` x `height` device pixels.
 * - contain: canvas already matches the frame's aspect ratio, fill it.
 * - cover: fill the canvas without distortion, cropping around `focus`
 *   (focus.y = 0 keeps the top edge, so the head and hair are never cut).
 */
export function getDrawRect(width, height, fit, focus) {
  if (fit !== 'cover') return { x: 0, y: 0, w: width, h: height };
  const scale = Math.max(width / FRAME_WIDTH, height / FRAME_HEIGHT);
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;
  return { x: (width - w) * focus.x, y: (height - h) * focus.y, w, h };
}

/** Draws one frame into `rect` (device pixels). */
export function drawFrame(ctx, frames, index, rect) {
  const img = nearestLoaded(frames, index);
  if (!img) return false;
  const { width, height } = ctx.canvas;
  const r = rect ?? { x: 0, y: 0, w: width, h: height };
  ctx.fillStyle = '#120f0c';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return true;
}

/* ============================================================
   Mount
   ============================================================ */

function deviceClass() {
  const w = window.innerWidth;
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (w <= BREAKPOINTS.mobile) return 'mobile';
  if (w <= BREAKPOINTS.tablet || coarse) return 'tablet';
  return 'desktop';
}

/**
 * Mounts the character into `container`.
 * @param {HTMLElement} container  element that receives the canvas
 * @param {object} [options]
 * @param {HTMLElement} [options.trackingArea]  element whose pointer movement
 *   drives the gaze (defaults to the container)
 * @param {'contain'|'cover'} [options.fit]  'contain' keeps the 16:9 box;
 *   'cover' fills the container (full-bleed hero)
 * @param {{x: number, y: number}} [options.focus]  crop anchor for 'cover'
 *   (0..1 per axis; y = 0 never crops the top of the head)
 * @returns {() => void} destroy function
 */
export function mountInteractiveCharacter(
  container,
  { trackingArea = container, fit = 'contain', focus = { x: 0.5, y: 0 } } = {}
) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'interactive-character__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  container.classList.add('interactive-character', `interactive-character--${fit}`);
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // High-frequency values live here, never in state that triggers re-rendering.
  const refs = {
    mouseX: 0,
    mouseY: 0,
    hasPointer: false,
    targetFrame: getTargetFrame('center'),
    currentFrame: getTargetFrame('center'),
    drawnFrame: -1,
  };
  let rect = { x: 0, y: 0, w: 0, h: 0 };
  const frames = new Array(FRAME_COUNT).fill(null);
  let cancelled = false;
  let rafId = 0;
  let inView = true;
  let tracking = reducedMotion ? TRACKING.mobile : TRACKING[deviceClass()];

  /* ---- canvas sizing (devicePixelRatio aware) ---- */
  const resize = () => {
    const cssWidth = container.clientWidth;
    const cssHeight = fit === 'cover' ? container.clientHeight : (cssWidth * FRAME_HEIGHT) / FRAME_WIDTH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssWidth * dpr);
    const h = Math.round(cssHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingQuality = 'high';
      rect = getDrawRect(w, h, fit, focus);
      refs.drawnFrame = -1;
      drawFrame(ctx, frames, Math.round(refs.currentFrame), rect);
    }
    if (!reducedMotion) tracking = TRACKING[deviceClass()];
    if (tracking.enabled) enableTracking();
    else {
      refs.targetFrame = getTargetFrame('center');
      start();
    }
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  /* ---- pointer tracking ---- */
  const updateTarget = () => {
    if (!tracking.enabled || !refs.hasPointer) {
      refs.targetFrame = getTargetFrame('center');
      return;
    }
    const area = trackingArea.getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    // Face position on screen, following the cover crop when there is one.
    const px = box.width / canvas.width;
    const centerX = box.left + (rect.x + rect.w * FACE_ORIGIN.x) * px;
    const centerY = box.top + (rect.y + rect.h * FACE_ORIGIN.y) * px;
    const radius = Math.min(area.width, area.height);
    const direction = getMouseDirection(refs.mouseX - centerX, refs.mouseY - centerY, radius, tracking);
    refs.targetFrame = getTargetFrame(direction);
  };

  const onPointerMove = (e) => {
    if (e.pointerType === 'touch') return;
    refs.mouseX = e.clientX;
    refs.mouseY = e.clientY;
    refs.hasPointer = true;
    updateTarget();
    start();
  };
  const onPointerLeave = () => {
    refs.hasPointer = false;
    updateTarget();
    start();
  };

  /**
   * Attaches pointer listeners and starts the background preload the first
   * time tracking is allowed (never on phones or with reduced motion).
   */
  let trackingStarted = false;
  function enableTracking() {
    if (trackingStarted || cancelled || !frames[DIRECTION_FRAMES.center - 1]) return;
    trackingStarted = true;
    trackingArea.addEventListener('pointermove', onPointerMove, { passive: true });
    trackingArea.addEventListener('pointerleave', onPointerLeave);
    preloadFrames(frames, {
      isCancelled: () => cancelled,
      onFrame: (n) => {
        // Redraw if the frame on screen was a stand-in for this one.
        if (n - 1 === Math.round(refs.currentFrame) % FRAME_COUNT) {
          refs.drawnFrame = -1;
          start();
        }
      },
    });
  }

  /* ---- render loop ---- */
  function animate() {
    rafId = 0;
    const delta = frameDelta(refs.currentFrame, refs.targetFrame);
    if (Math.abs(delta) > 0.01) {
      let step = delta * MOTION.smoothing;
      step = Math.max(-MOTION.maxStep, Math.min(MOTION.maxStep, step));
      refs.currentFrame = (refs.currentFrame + step + FRAME_COUNT) % FRAME_COUNT;
    } else {
      refs.currentFrame = refs.targetFrame;
    }

    const index = Math.round(refs.currentFrame) % FRAME_COUNT;
    if (index !== refs.drawnFrame && drawFrame(ctx, frames, index, rect)) refs.drawnFrame = index;

    // Keep ticking only while there is somewhere to go; idle costs nothing.
    if (inView && (Math.abs(delta) > 0.01 || refs.drawnFrame !== index)) rafId = requestAnimationFrame(animate);
  }
  function start() {
    if (!rafId && inView && !cancelled) rafId = requestAnimationFrame(animate);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
  });
  visibility.observe(container);

  /* ---- boot: first frame now, the rest in the background ---- */
  loadFrame(DIRECTION_FRAMES.center).then((img) => {
    if (cancelled || !img) return;
    frames[DIRECTION_FRAMES.center - 1] = img;
    resize();
    drawFrame(ctx, frames, getTargetFrame('center'), rect);
    refs.drawnFrame = getTargetFrame('center');
    container.classList.add('is-ready');
    if (tracking.enabled) enableTracking();
  });

  /* ---- cleanup ---- */
  return function destroy() {
    cancelled = true;
    cancelAnimationFrame(rafId);
    trackingArea.removeEventListener('pointermove', onPointerMove);
    trackingArea.removeEventListener('pointerleave', onPointerLeave);
    resizeObserver.disconnect();
    visibility.disconnect();
    frames.forEach((img, i) => {
      if (img) img.src = '';
      frames[i] = null;
    });
    canvas.remove();
    container.classList.remove('interactive-character', `interactive-character--${fit}`, 'is-ready');
  };
}
