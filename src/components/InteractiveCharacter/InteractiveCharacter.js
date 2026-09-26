/**
 * InteractiveCharacter
 * --------------------
 * A single canvas that shows one frame of a pre-rendered character at a time.
 * The character watches the visitor's pointer. The pointer position maps to a
 * target frame, and the displayed frame travels there along the real footage,
 * so every in-between image is genuine motion (eyes lead, head follows).
 *
 * Source: public/character/webp-main/frame_0001.webp ... frame_0300.webp
 * (10 s clip, 800x450). Observed sequence, viewer's point of view:
 *
 *    1-28   centre (blink 11-20)            29-60   wind-up (blink, glance)
 *   61-93   LEFT, head + eyes (peak ~82)     94-99   blink            (skipped)
 *  100-128  back to CENTRE (~126)          131-150   eyes move right, head still
 *  151-164  RIGHT, head follows (~160)     167-178   DOWN-RIGHT (~172)
 *  180-192  DOWN (~186)                    197-227   DOWN-LEFT (~215)
 *  228-234  blink                (skipped) 235-300   back to CENTRE, settling
 *
 * Only frames 82-279 are used. Centre 126 and centre 279 are nearly identical,
 * so they are joined (with a short crossfade) and the playable path becomes a
 * loop: LEFT - CENTRE - RIGHT - DOWN-RIGHT - DOWN - DOWN-LEFT - CENTRE.
 * Travel always takes the shorter way round that loop.
 *
 * Usage:
 *   const destroy = mountInteractiveCharacter(el, { trackingArea: heroEl, fit: 'cover' });
 */

/* ============================================================
   Configuration (edit here)
   ============================================================ */

const FRAME_DIR = 'character/webp-main';
const frameUrl = (n) => `${import.meta.env.BASE_URL}${FRAME_DIR}/frame_${String(n).padStart(4, '0')}.webp`;

/** Native frame size, used for the aspect ratio. */
const FRAME_WIDTH = 800;
const FRAME_HEIGHT = 450;

/** Pose frames (1-based), read from the footage (see header). */
const POSES = {
  left: 82,
  center: 126,
  right: 160,
  downRight: 172,
  down: 186,
  downLeft: 215,
};

/** Playable range of the footage, and the two matching centre frames joined into a loop. */
const PATH = { start: 82, end: 279 };
const LOOP_LINK = { from: POSES.center, to: 279, fadeMs: 240 };

/** Blinks inside the path. Never displayed; the nearest open-eye frame is shown instead. */
const SKIP_FRAMES = [
  [94, 99],
  [228, 234],
];

/**
 * Pointer to pose mapping. Offsets are normalized from the character's face:
 * x -1 = hero's left edge, 0 = face, +1 = right edge (same for y).
 * - deadZone: |offset| below this keeps the neutral pose for that axis.
 * - lowerRowAt: y offset where the gaze drops to the "down" row.
 * - rowHysteresis: extra y travel needed to switch rows (prevents flicker).
 */
const MAPPING = { deadZone: 0.08, lowerRowAt: 0.3, rowHysteresis: 0.07 };

/** Per device class. `sensitivity` scales pointer offsets (lower = calmer). */
const TRACKING = {
  desktop: { enabled: true, sensitivity: 1 },
  tablet: { enabled: true, sensitivity: 0.6 },
  mobile: { enabled: false, sensitivity: 0 },
};
const BREAKPOINTS = { mobile: 767, tablet: 1199 };

/**
 * Motion along the footage, in frames per display frame (60 Hz):
 * - smoothing: share of the remaining distance used as the desired speed.
 * - accel: how quickly speed approaches that desired speed (eases starts).
 * - maxStep / minStep: speed limits; maxStep ~2 plays about 4x real time.
 */
const MOTION = { smoothing: 0.08, accel: 0.18, maxStep: 2.2, minStep: 0.2 };

/** Face position inside the frame (fractions of width/height): gaze origin and crop anchor. */
const FACE_ORIGIN = { x: 0.69, y: 0.33 };

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
 * Loads the playable range progressively without blocking the page: pose
 * frames first, then the rest ordered by distance from the centre frames.
 * `frames[n]` fills as each image arrives; `isCancelled()` stops the queue.
 */
export function preloadFrames(frames, { isCancelled, onFrame }) {
  const poses = [...Object.values(POSES), LOOP_LINK.to];
  const rest = [];
  for (let n = PATH.start; n <= PATH.end; n++) if (!poses.includes(n) && !isSkipped(n)) rest.push(n);
  const nearCentre = (n) => Math.min(Math.abs(n - LOOP_LINK.from), Math.abs(n - LOOP_LINK.to));
  rest.sort((a, b) => nearCentre(a) - nearCentre(b));
  const queue = [...poses, ...rest].filter((n) => !frames[n]);

  const worker = async () => {
    while (queue.length && !isCancelled()) {
      const n = queue.shift();
      const img = await loadFrame(n);
      if (isCancelled()) return;
      if (img) {
        frames[n] = img;
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
   Pointer to pose
   ============================================================ */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Dead zone plus ease-out: small offsets move the eyes, large ones turn the head. */
function shapeAxis(v) {
  const a = Math.abs(v);
  if (a <= MAPPING.deadZone) return 0;
  const t = Math.min(1, (a - MAPPING.deadZone) / (1 - MAPPING.deadZone));
  return Math.sign(v) * t * (2 - t);
}

/**
 * Normalized pointer offset from the face, per side of the tracking area,
 * so every edge reaches +-1 regardless of where the face sits.
 */
export function getMouseDirection(mouseX, mouseY, face, area, sensitivity) {
  const nx = mouseX < face.x ? (mouseX - face.x) / Math.max(1, face.x - area.left) : (mouseX - face.x) / Math.max(1, area.right - face.x);
  const ny = mouseY < face.y ? (mouseY - face.y) / Math.max(1, face.y - area.top) : (mouseY - face.y) / Math.max(1, area.bottom - face.y);
  return { x: clamp(nx * sensitivity, -1, 1), y: clamp(ny * sensitivity, -1, 1) };
}

/**
 * Target frame for a normalized offset. The upper row blends centre toward
 * left or right; the lower row blends down toward down-left or down-right.
 * Returns the chosen row too, so the caller can apply row hysteresis.
 */
export function getTargetFrame(offset, previousRow = 'upper') {
  const split = MAPPING.lowerRowAt;
  const h = MAPPING.rowHysteresis;
  const row =
    previousRow === 'lower' ? (offset.y < split - h ? 'upper' : 'lower') : offset.y > split + h ? 'lower' : 'upper';
  const s = shapeAxis(offset.x);
  const frame =
    row === 'upper'
      ? s < 0 ? lerp(POSES.center, POSES.left, -s) : lerp(POSES.center, POSES.right, s)
      : s < 0 ? lerp(POSES.down, POSES.downLeft, -s) : lerp(POSES.down, POSES.downRight, s);
  return { frame, row };
}

/**
 * Shortest route between two path positions, allowing the centre link.
 * Returns the next waypoint and whether reaching it means crossing the link.
 */
function route(from, to) {
  const { from: a, to: b } = LOOP_LINK;
  const direct = Math.abs(to - from);
  const viaA = Math.abs(from - a) + Math.abs(to - b);
  const viaB = Math.abs(from - b) + Math.abs(to - a);
  if (direct <= viaA && direct <= viaB) return { distance: direct, waypoint: to, jumpTo: null };
  return viaA < viaB
    ? { distance: viaA, waypoint: a, jumpTo: b }
    : { distance: viaB, waypoint: b, jumpTo: a };
}

function isSkipped(n) {
  return SKIP_FRAMES.some(([lo, hi]) => n >= lo && n <= hi);
}

/** Frame to show for a path position: rounded, blinks replaced by the nearest open-eye frame. */
function displayFrame(position) {
  const n = clamp(Math.round(position), PATH.start, PATH.end);
  const blink = SKIP_FRAMES.find(([lo, hi]) => n >= lo && n <= hi);
  if (!blink) return n;
  const [lo, hi] = blink;
  return n - lo < hi - n ? lo - 1 : hi + 1;
}

/* ============================================================
   Drawing
   ============================================================ */

/** Nearest loaded frame to `n`, so gaps during preload never flash blank. */
function nearestLoaded(frames, n) {
  if (frames[n]) return frames[n];
  for (let o = 1; o <= PATH.end - PATH.start; o++) {
    if (frames[n - o]) return frames[n - o];
    if (frames[n + o]) return frames[n + o];
  }
  return frames[POSES.center] ?? null;
}

/**
 * Where the frame lands on a canvas of `width` x `height` device pixels.
 * - contain: the canvas already has the frame's aspect ratio; fill it.
 * - cover: fill without distortion. focus.y = 0 keeps the top edge (never cuts
 *   the hair); focus.x = 'face' centres the face on portrait screens and keeps
 *   the whole composition centred elsewhere.
 */
export function getDrawRect(width, height, fit, focus) {
  if (fit !== 'cover') return { x: 0, y: 0, w: width, h: height };
  const scale = Math.max(width / FRAME_WIDTH, height / FRAME_HEIGHT);
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;
  let x;
  if (focus.x === 'face') {
    x = width / height < 1.1 ? width / 2 - w * FACE_ORIGIN.x : (width - w) * 0.5;
    x = clamp(x, width - w, 0);
  } else {
    x = (width - w) * focus.x;
  }
  return { x, y: (height - h) * focus.y, w, h };
}

/** Draws frame `n`, optionally crossfading from frame `fadeFrom` (alpha 0..1 remaining). */
export function drawFrame(ctx, frames, n, rect, fadeFrom = null, fadeAlpha = 0) {
  const img = nearestLoaded(frames, n);
  if (!img) return false;
  const { width, height } = ctx.canvas;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#120f0c';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  if (fadeFrom !== null && fadeAlpha > 0) {
    const prev = nearestLoaded(frames, fadeFrom);
    if (prev) {
      ctx.globalAlpha = fadeAlpha;
      ctx.drawImage(prev, rect.x, rect.y, rect.w, rect.h);
      ctx.globalAlpha = 1;
    }
  }
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
 * @param {{x: number|'face', y: number}} [options.focus]  crop anchor for 'cover'
 * @returns {() => void} destroy function
 */
export function mountInteractiveCharacter(
  container,
  { trackingArea = container, fit = 'contain', focus = { x: 'face', y: 0 } } = {}
) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'interactive-character__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  container.classList.add('interactive-character', `interactive-character--${fit}`);
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // High-frequency values live here, never in anything that re-renders.
  const refs = {
    mouseX: 0,
    mouseY: 0,
    hasPointer: false,
    row: 'upper',
    targetFrame: POSES.center,
    currentFrame: POSES.center,
    speed: 0,
    drawnFrame: -1,
    fade: null, // { from: frame, start: ms } while crossing the centre link
  };
  let rect = { x: 0, y: 0, w: 0, h: 0 };
  const frames = [];
  let cancelled = false;
  let rafId = 0;
  let inView = true;
  let tracking = reducedMotion ? TRACKING.mobile : TRACKING[deviceClass()];

  const redraw = () => {
    refs.drawnFrame = -1;
    start();
  };

  /* ---- canvas sizing (devicePixelRatio aware) ---- */
  const resize = () => {
    const cssWidth = container.clientWidth;
    const cssHeight = fit === 'cover' ? container.clientHeight : (cssWidth * FRAME_HEIGHT) / FRAME_WIDTH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssWidth * dpr);
    const h = Math.round(cssHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingQuality = 'high';
      rect = getDrawRect(w, h, fit, focus);
      drawFrame(ctx, frames, displayFrame(refs.currentFrame), rect);
      refs.drawnFrame = displayFrame(refs.currentFrame);
    }
    if (!reducedMotion) tracking = TRACKING[deviceClass()];
    if (tracking.enabled) enableTracking();
    else {
      refs.hasPointer = false;
      updateTarget();
    }
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  /* ---- pointer tracking ---- */
  function updateTarget() {
    if (!tracking.enabled || !refs.hasPointer) {
      refs.row = 'upper';
      refs.targetFrame = POSES.center;
      start();
      return;
    }
    const area = trackingArea.getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    // Face position on screen, following the cover crop.
    const px = box.width / canvas.width;
    const face = {
      x: box.left + (rect.x + rect.w * FACE_ORIGIN.x) * px,
      y: box.top + (rect.y + rect.h * FACE_ORIGIN.y) * px,
    };
    const offset = getMouseDirection(refs.mouseX, refs.mouseY, face, area, tracking.sensitivity);
    const { frame, row } = getTargetFrame(offset, refs.row);
    refs.row = row;
    refs.targetFrame = frame;
    start();
  }

  const onPointerMove = (e) => {
    if (e.pointerType === 'touch') return;
    refs.mouseX = e.clientX;
    refs.mouseY = e.clientY;
    refs.hasPointer = true;
    updateTarget();
  };
  const onPointerLeave = () => {
    refs.hasPointer = false;
    updateTarget();
  };

  /** Attaches listeners and starts the background preload once tracking is allowed. */
  let trackingStarted = false;
  function enableTracking() {
    if (trackingStarted || cancelled || !frames[POSES.center]) return;
    trackingStarted = true;
    trackingArea.addEventListener('pointermove', onPointerMove, { passive: true });
    trackingArea.addEventListener('pointerleave', onPointerLeave);
    preloadFrames(frames, {
      isCancelled: () => cancelled,
      onFrame: (n) => {
        // Redraw if the frame on screen was a stand-in for this one.
        if (n === displayFrame(refs.currentFrame)) redraw();
      },
    });
  }

  /* ---- render loop: eases the position along the footage toward the target ---- */
  function animate(now) {
    rafId = 0;
    const { distance, waypoint, jumpTo } = route(refs.currentFrame, refs.targetFrame);
    let moving = distance > 0.02;

    if (moving) {
      const desired = clamp(distance * MOTION.smoothing, MOTION.minStep, MOTION.maxStep);
      refs.speed += (desired - refs.speed) * MOTION.accel;
      const toWaypoint = waypoint - refs.currentFrame;
      const step = Math.min(Math.abs(toWaypoint), refs.speed);
      refs.currentFrame += Math.sign(toWaypoint) * step;
      if (jumpTo !== null && Math.abs(waypoint - refs.currentFrame) < 0.01) {
        refs.fade = { from: displayFrame(refs.currentFrame), start: now };
        refs.currentFrame = jumpTo;
      }
    } else {
      refs.currentFrame = refs.targetFrame;
      refs.speed = 0;
    }

    let fadeAlpha = 0;
    if (refs.fade) {
      fadeAlpha = 1 - (now - refs.fade.start) / LOOP_LINK.fadeMs;
      if (fadeAlpha <= 0) refs.fade = null;
    }

    const n = displayFrame(refs.currentFrame);
    if (n !== refs.drawnFrame || refs.fade) {
      if (drawFrame(ctx, frames, n, rect, refs.fade?.from ?? null, fadeAlpha)) refs.drawnFrame = n;
    }

    // Keep ticking only while moving or fading; a settled character costs nothing.
    if (inView && (moving || refs.fade || refs.drawnFrame !== n)) rafId = requestAnimationFrame(animate);
  }
  function start() {
    if (!rafId && inView && !cancelled) rafId = requestAnimationFrame(animate);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
  });
  visibility.observe(container);

  /* ---- boot: centre frame now, the rest in the background ---- */
  loadFrame(POSES.center).then((img) => {
    if (cancelled || !img) return;
    frames[POSES.center] = img;
    resize();
    drawFrame(ctx, frames, POSES.center, rect);
    refs.drawnFrame = POSES.center;
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
