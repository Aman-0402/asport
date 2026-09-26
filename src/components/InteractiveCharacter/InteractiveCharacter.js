/**
 * InteractiveCharacter
 * --------------------
 * A single canvas that shows one frame of a pre-rendered character at a time.
 * The character watches the visitor's pointer. The pointer position maps to a
 * target frame, and the displayed frame plays toward it through the real
 * footage, so every in-between image is genuine motion (eyes lead, head follows).
 *
 * Source: public/character/webp-main/frame_0001.webp ... frame_0300.webp
 * (10 s clip, 800x450). Observed sequence, viewer's point of view:
 *
 *    1-28   centre (blink 10-20)            29-60   wind-up (blink 30-36, glance)
 *   61-93   LEFT, head + eyes (peak ~82)     94-99   blink
 *  100-128  back to CENTRE (~126)          131-150   eyes move right, head still
 *  151-164  RIGHT, head follows (~160)     167-178   DOWN-RIGHT (~172)
 *  180-192  DOWN (~186)                    197-227   DOWN-LEFT (~215)
 *  228-234  blink                          235-300   back to CENTRE, settling
 *
 * Frame 300 flows straight into frame 1, so the clip is a seamless loop:
 *   CENTRE - LEFT - CENTRE - RIGHT - DOWN-RIGHT - DOWN - DOWN-LEFT - CENTRE - ...
 * Playback only ever moves FORWARD around that loop (wrapping 300 -> 1), so
 * every transition plays the way it was animated, like one continuous video.
 * It never steps backwards: a target just behind the current frame is held,
 * so small pointer jiggles never trigger a whole lap. Blink frames are never shown.
 *
 * Usage:
 *   const destroy = mountInteractiveCharacter(el, { trackingArea: heroEl, fit: 'cover' });
 */

/* ============================================================
   Configuration (edit here)
   ============================================================ */

const FRAME_DIR = 'character/webp-main';
const FRAME_COUNT = 300;
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

/** Frames showing the same neutral centre pose; the cheapest one to reach is used. */
const CENTER_FRAMES = [POSES.center, 290];

/** Resting frame on load, on phones, and with reduced motion. */
const REST_FRAME = 290;

/** Blinks. Never displayed; playback steps over them. */
const SKIP_FRAMES = [
  [10, 20],
  [30, 36],
  [94, 99],
  [228, 234],
];

/**
 * Playback around the loop. The footage only ever plays forward (1 -> 300 -> 1),
 * like a continuous video.
 * - holdBehind: a target this many frames (or fewer) behind the current frame
 *   is treated as reached, so small pointer jitter never triggers a full lap.
 */
const PLAYBACK = { holdBehind: 12 };

/**
 * Pointer to pose mapping. Offsets are normalized from the character's face:
 * x -1 = hero's left edge, 0 = face, +1 = right edge (same for y).
 * - deadZone: |offset| below this keeps the neutral pose for that axis.
 * - lowerRowAt: y offset where the gaze drops to the "down" poses.
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
 * - minStep / maxStep: speed limits for short moves (0.5 = real time).
 * - lapMaxStep: speed limit for long forward laps (> lapDistance frames).
 * Kept slow so the face turns calmly with the cursor.
 */
const MOTION = { smoothing: 0.05, accel: 0.1, minStep: 0.15, maxStep: 1.1, lapMaxStep: 2, lapDistance: 60 };

/** Face position inside the frame (fractions of width/height): gaze origin and crop anchor. */
const FACE_ORIGIN = { x: 0.69, y: 0.33 };

/** Frames downloaded in parallel after the first one. */
const PRELOAD_CONCURRENCY = 6;

/* ============================================================
   Loop helpers
   ============================================================ */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Frames from `from` to `to` going forward around the loop (0..FRAME_COUNT). */
function forwardDistance(from, to) {
  return (((to - from) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
}

/** Keeps a loop position in [1, FRAME_COUNT + 1). */
function wrap(position) {
  return ((((position - 1) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT) + 1;
}

/** Frames to play forward to reach `to`; 0 when `to` is only just behind (hold). */
function plan(from, to) {
  if (forwardDistance(to, from) <= PLAYBACK.holdBehind) return 0;
  return forwardDistance(from, to);
}

/** The centre frame that is cheapest to reach from `from`. */
function nearestCenter(from) {
  let best = CENTER_FRAMES[0];
  let bestCost = Infinity;
  for (const c of CENTER_FRAMES) {
    const cost = Math.abs(plan(from, c));
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}

function isSkipped(n) {
  return SKIP_FRAMES.some(([lo, hi]) => n >= lo && n <= hi);
}

/** Frame to show for a loop position; inside a blink, the open-eye frame in the direction of travel. */
function displayFrame(position, direction = 1) {
  const n = wrap(Math.round(position));
  const blink = SKIP_FRAMES.find(([lo, hi]) => n >= lo && n <= hi);
  if (!blink) return n;
  return direction >= 0 ? wrap(blink[1] + 1) : wrap(blink[0] - 1);
}

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
 * Loads the loop progressively without blocking the page: pose frames first,
 * then the rest in playback order from the resting frame. Blinks are skipped.
 * `frames[n]` fills as each image arrives; `isCancelled()` stops the queue.
 */
export function preloadFrames(frames, { isCancelled, onFrame }) {
  const poses = [...new Set([...Object.values(POSES), ...CENTER_FRAMES])];
  const rest = [];
  for (let n = 1; n <= FRAME_COUNT; n++) if (!poses.includes(n) && !isSkipped(n)) rest.push(n);
  rest.sort((a, b) => forwardDistance(REST_FRAME, a) - forwardDistance(REST_FRAME, b));
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
 * Returns the chosen row (for hysteresis) and whether the target is centre.
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
  return { frame, row, isCenter: row === 'upper' && s === 0 };
}

/* ============================================================
   Drawing
   ============================================================ */

/** Nearest loaded frame to `n`, so gaps during preload never flash blank. */
function nearestLoaded(frames, n) {
  if (frames[n]) return frames[n];
  for (let o = 1; o < FRAME_COUNT; o++) {
    const back = frames[wrap(n - o)];
    if (back) return back;
    const ahead = frames[wrap(n + o)];
    if (ahead) return ahead;
  }
  return null;
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

/** Draws frame `n` into `rect` (device pixels). */
export function drawFrame(ctx, frames, n, rect) {
  const img = nearestLoaded(frames, n);
  if (!img) return false;
  const { width, height } = ctx.canvas;
  ctx.fillStyle = '#120f0c';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
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
    wantsCenter: true,
    targetFrame: REST_FRAME,
    currentFrame: REST_FRAME,
    speed: 0,
    direction: 1,
    drawnFrame: -1,
  };
  let rect = { x: 0, y: 0, w: 0, h: 0 };
  const frames = [];
  let cancelled = false;
  let rafId = 0;
  let inView = true;
  let tracking = reducedMotion ? TRACKING.mobile : TRACKING[deviceClass()];

  const shownFrame = () => displayFrame(refs.currentFrame, refs.direction);

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
      if (drawFrame(ctx, frames, shownFrame(), rect)) refs.drawnFrame = shownFrame();
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
      refs.wantsCenter = true;
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
    const { frame, row, isCenter } = getTargetFrame(offset, refs.row);
    refs.row = row;
    refs.wantsCenter = isCenter;
    if (!isCenter) refs.targetFrame = frame;
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
    if (trackingStarted || cancelled || !frames[REST_FRAME]) return;
    trackingStarted = true;
    trackingArea.addEventListener('pointermove', onPointerMove, { passive: true });
    trackingArea.addEventListener('pointerleave', onPointerLeave);
    preloadFrames(frames, {
      isCancelled: () => cancelled,
      onFrame: (n) => {
        // Redraw if the frame on screen was a stand-in for this one.
        if (n === shownFrame()) {
          refs.drawnFrame = -1;
          start();
        }
      },
    });
  }

  /* ---- render loop: plays the footage forward around the loop toward the target ---- */
  function animate() {
    rafId = 0;
    // A centre target picks whichever centre frame is now cheapest to reach.
    if (refs.wantsCenter) refs.targetFrame = nearestCenter(refs.currentFrame);
    const delta = plan(refs.currentFrame, refs.targetFrame);
    const distance = Math.abs(delta);
    const moving = distance > 0.02;

    if (moving) {
      const limit = distance > MOTION.lapDistance ? MOTION.lapMaxStep : MOTION.maxStep;
      const desired = clamp(distance * MOTION.smoothing, MOTION.minStep, limit);
      refs.speed += (desired - refs.speed) * MOTION.accel;
      refs.direction = 1;
      refs.currentFrame = wrap(refs.currentFrame + Math.min(distance, refs.speed));
    } else {
      // Arrived (or holding just past the target): never step backwards.
      refs.currentFrame = wrap(refs.currentFrame + delta);
      refs.speed = 0;
    }

    const n = shownFrame();
    if (n !== refs.drawnFrame && drawFrame(ctx, frames, n, rect)) refs.drawnFrame = n;

    // Keep ticking only while moving; a settled character costs nothing.
    if (inView && (moving || refs.drawnFrame !== n)) rafId = requestAnimationFrame(animate);
  }
  function start() {
    if (!rafId && inView && !cancelled) rafId = requestAnimationFrame(animate);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
  });
  visibility.observe(container);

  /* ---- boot: resting frame now, the rest in the background ---- */
  loadFrame(REST_FRAME).then((img) => {
    if (cancelled || !img) return;
    frames[REST_FRAME] = img;
    resize();
    drawFrame(ctx, frames, REST_FRAME, rect);
    refs.drawnFrame = REST_FRAME;
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
