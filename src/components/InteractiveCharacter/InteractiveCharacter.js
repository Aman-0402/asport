/**
 * InteractiveCharacter
 * --------------------
 * A single canvas that shows one frame of a pre-rendered character at a time.
 * The hero is split into a 3x2 grid; each cell owns one pose and its frames:
 *
 *   +-----------+-----------+-----------+
 *   |   LEFT    |  CENTRE   |   RIGHT   |
 *   |  61-93    |  100-128  |  151-164  |
 *   +-----------+-----------+-----------+
 *   | DOWN-LEFT |   DOWN    | DOWN-RIGHT|
 *   |  197-227  |  180-192  |  167-178  |
 *   +-----------+-----------+-----------+
 *
 * Entering a cell plays the footage into that cell's pose (`POSE`); while
 * the pointer rests, she rewinds a few frames and replays them (`IDLE`). Moving to another cell always goes via CENTRE: back to the
 * centre pose, then out to the new pose, playing every frame in between
 * (backwards when returning), so the motion is always continuous.
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
 * Every pose sits on one straight stretch of footage (61-227) with centre in
 * it, so each path from centre to a pose is a plain run of frames. Blink
 * frames are never shown.
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

/**
 * Pose loops (1-based, inclusive), read from the footage (see header).
 * `hub` is where every trip between cells starts and ends.
 */
const ZONES = {
  left: [61, 93],
  center: [100, 128],
  right: [151, 164],
  downLeft: [197, 227],
  down: [180, 192],
  downRight: [167, 178],
};
const HUB = 126;

/** Frame each zone settles and holds on (its clearest pose). */
const POSE = { left: 82, center: HUB, right: 160, downLeft: 215, down: 186, downRight: 172 };

/** Grid, row by row, left to right (matches the header diagram). */
const GRID = [
  ['left', 'center', 'right'],
  ['downLeft', 'down', 'downRight'],
];

/**
 * Hysteresis, as a fraction of the cell size: the pointer must cross a cell
 * border by this much before the zone changes (stops flicker on the lines).
 */
const GRID_HYSTERESIS = 0.04;

/** Resting frame on load, on phones, and with reduced motion. */
const REST_FRAME = HUB;

/** Blinks. Never displayed; playback steps over them. */
const SKIP_FRAMES = [
  [10, 20],
  [30, 36],
  [94, 99],
  [228, 234],
];

/** Tracking per device class. Phones show the resting frame only. */
const TRACKING = {
  desktop: { enabled: true },
  tablet: { enabled: true },
  mobile: { enabled: false },
};
const BREAKPOINTS = { mobile: 767, tablet: 1199 };

/**
 * Speeds in frames per display frame (60 Hz); 0.5 = the clip's real speed.
 * - travelMax / travelMin: speed limits while moving between poses.
 * - smoothing: share of the remaining distance used as the desired speed.
 * - accel: how quickly speed approaches that desired speed (eases starts).
 */
const MOTION = { travelMax: 1.6, travelMin: 0.35, smoothing: 0.12, accel: 0.3 };

/**
 * Idle breathing once the pointer rests: the footage rewinds a few frames from
 * the pose and plays back to it, over and over, so she never freezes.
 * - frames: how far it rewinds (clipped to the zone's own frames).
 * - cycle: seconds for one rewind and replay.
 * - delay: seconds of stillness before it starts.
 */
const IDLE = { frames: 6, cycle: 2.4, delay: 0.4 };

/** Face position inside the frame (fractions of width/height): crop anchor on portrait screens. */
const FACE_ORIGIN = { x: 0.69, y: 0.33 };

/** Frames downloaded in parallel after the first one. */
const PRELOAD_CONCURRENCY = 6;

/* ============================================================
   Helpers
   ============================================================ */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function isSkipped(n) {
  return SKIP_FRAMES.some(([lo, hi]) => n >= lo && n <= hi);
}

/** Frame to show for a playhead position; inside a blink, the open-eye frame in the direction of travel. */
function displayFrame(position, direction = 1) {
  const n = clamp(Math.round(position), 1, FRAME_COUNT);
  const blink = SKIP_FRAMES.find(([lo, hi]) => n >= lo && n <= hi);
  if (!blink) return n;
  return direction >= 0 ? blink[1] + 1 : blink[0] - 1;
}

/** First and last frame any path can reach. */
const PATH_START = Math.min(...Object.values(ZONES).map(([lo]) => lo), HUB);
const PATH_END = Math.max(...Object.values(ZONES).map(([, hi]) => hi), HUB);

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
 * Loads the frames the paths use, without blocking the page: nearest to the
 * hub first, so the first trips are ready soonest. Blinks are skipped.
 * `frames[n]` fills as each image arrives; `isCancelled()` stops the queue.
 */
export function preloadFrames(frames, { isCancelled, onFrame }) {
  const queue = [];
  for (let n = PATH_START; n <= PATH_END; n++) if (!isSkipped(n) && !frames[n]) queue.push(n);
  queue.sort((a, b) => Math.abs(a - HUB) - Math.abs(b - HUB));

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
   Pointer to zone
   ============================================================ */

/**
 * Grid cell under the pointer, as a zone name. Keeps `previous` until the
 * pointer is clearly inside another cell.
 */
export function getZone(mouseX, mouseY, area, previous = 'center') {
  const cols = GRID[0].length;
  const rows = GRID.length;
  const fx = clamp((mouseX - area.left) / Math.max(1, area.width), 0, 0.9999) * cols;
  const fy = clamp((mouseY - area.top) / Math.max(1, area.height), 0, 0.9999) * rows;
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  const zone = GRID[row][col];
  if (zone === previous) return zone;

  // Only switch once the pointer is past the border by the hysteresis margin.
  const prev = GRID.flat().indexOf(previous);
  if (prev < 0) return zone;
  const pc = prev % cols;
  const pr = Math.floor(prev / cols);
  const m = GRID_HYSTERESIS;
  const outX = fx < pc - m || fx > pc + 1 + m;
  const outY = fy < pr - m || fy > pr + 1 + m;
  return outX || outY ? zone : previous;
}

/* ============================================================
   Drawing
   ============================================================ */

/** Nearest loaded frame to `n`, so gaps during preload never flash blank. */
function nearestLoaded(frames, n) {
  if (frames[n]) return frames[n];
  for (let o = 1; o < FRAME_COUNT; o++) {
    const back = frames[n - o];
    if (back) return back;
    const ahead = frames[n + o];
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
    target: 'center', // zone under the pointer
    leg: 'center', // zone whose path the playhead is on
    currentFrame: REST_FRAME,
    speed: 0,
    direction: 1,
    drawnFrame: -1,
    idleOffset: 0, // frames rewound from the pose while idling
    idlePhase: 0,
    idleWait: 0,
  };
  let rect = { x: 0, y: 0, w: 0, h: 0 };
  const frames = [];
  let cancelled = false;
  let rafId = 0;
  let inView = true;
  let tracking = reducedMotion ? TRACKING.mobile : TRACKING[deviceClass()];
  const animated = () => tracking.enabled && !reducedMotion;

  const shownFrame = () => displayFrame(refs.currentFrame - refs.idleOffset, refs.direction);

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
    refs.target =
      tracking.enabled && refs.hasPointer
        ? getZone(refs.mouseX, refs.mouseY, trackingArea.getBoundingClientRect(), refs.target)
        : 'center';
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
    start();
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

  /* ---- render loop: travel via the centre hub, then hold on the target pose ---- */
  function animate() {
    rafId = 0;
    let goal = REST_FRAME;
    if (animated()) goal = refs.leg !== refs.target ? HUB : POSE[refs.leg];

    const delta = goal - refs.currentFrame;
    const distance = Math.abs(delta);
    let moving = distance > 0.02;
    if (moving) {
      // Pass through the hub at full speed; ease out only on the final pose.
      const passing = goal === HUB && refs.leg !== refs.target;
      const desired = passing ? MOTION.travelMax : clamp(distance * MOTION.smoothing, MOTION.travelMin, MOTION.travelMax);
      refs.speed += (desired - refs.speed) * MOTION.accel;
      refs.direction = Math.sign(delta);
      refs.currentFrame += refs.direction * Math.min(distance, refs.speed);
    } else {
      refs.currentFrame = goal;
      refs.speed = 0;
      // At the hub, switch onto the target's path (keeps ticking to set off).
      if (goal === HUB && refs.leg !== refs.target) {
        refs.leg = refs.target;
        moving = true;
      }
    }

    // Idle rewind: only while resting on a pose; eases away as soon as she moves.
    const resting = animated() && !moving && refs.leg === refs.target;
    if (resting && (refs.idleWait += 1 / 60) >= IDLE.delay) {
      const [lo] = ZONES[refs.leg];
      const reach = Math.min(IDLE.frames, POSE[refs.leg] - lo);
      refs.idlePhase += (Math.PI * 2) / (IDLE.cycle * 60);
      refs.idleOffset = reach * (0.5 - 0.5 * Math.cos(refs.idlePhase));
      refs.direction = Math.sin(refs.idlePhase) > 0 ? -1 : 1;
    } else if (!resting) {
      refs.idleWait = 0;
      refs.idlePhase = 0;
      refs.idleOffset *= 0.8;
      if (refs.idleOffset < 0.05) refs.idleOffset = 0;
    }

    const n = shownFrame();
    if (n !== refs.drawnFrame && drawFrame(ctx, frames, n, rect)) refs.drawnFrame = n;

    // Phones and reduced motion stop on the resting frame and cost nothing.
    const settled = !animated() && !moving && refs.drawnFrame === n;
    if (inView && !settled) rafId = requestAnimationFrame(animate);
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
