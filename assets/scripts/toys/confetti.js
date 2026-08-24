// A short burst of confetti. Not a command of its own — it fires when you solve
// the wordle, which is the one moment on this site worth celebrating.

import { RAVE_COLORS } from './dancers.js';

const COUNT = 150;
const GRAVITY = 0.32;
const DRAG = 0.992;
const LIFE_MS = 2800;
const FADE_MS = 700;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Two cannons in the lower corners, firing up and inward — the shape everyone
// recognises as a celebration, rather than a listless drift from the ceiling.
function spawn(width, height) {
  const cannons = [
    { x: width * 0.06, y: height * 0.98, angle: -Math.PI / 3.1 },
    { x: width * 0.94, y: height * 0.98, angle: -Math.PI + Math.PI / 3.1 }
  ];

  return new Array(COUNT).fill(0).map((_, i) => {
    const cannon = cannons[i % 2];
    const angle = cannon.angle + rand(-0.34, 0.34);
    const speed = rand(15, 27);
    return {
      x: cannon.x,
      y: cannon.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: rand(6, 11),
      h: rand(4, 8),
      spin: rand(0, Math.PI * 2),
      spinRate: rand(-0.25, 0.25),
      color: pick(RAVE_COLORS)
    };
  });
}

// window.innerWidth/innerHeight report the *layout* viewport, which on iOS
// Safari does not shrink when the on-screen keyboard opens — only the visual
// viewport does. Wordle keeps its input focused right up to the winning
// guess, so sizing off innerHeight put the cannons at 98% of a height that
// included the area now covered by the keyboard: below the part of the
// screen anyone could actually see. visualViewport is the space that is
// really on screen; fall back to the layout viewport where it's unsupported.
function viewport() {
  const vv = window.visualViewport;
  return vv
    ? { width: vv.width, height: vv.height, left: vv.offsetLeft, top: vv.offsetTop }
    : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
}

export function confetti() {
  // Celebration is still motion. Somebody who asked for less does not want a
  // screenful of it thrown at them for guessing a word.
  if (reducedMotion.matches) return;

  // Solving twice in quick succession restarts the burst rather than stacking
  // two canvases on top of each other.
  const previous = document.querySelector('.confetti');
  if (previous) previous.remove();

  // A focused input is a keyboard still on screen, stealing exactly the
  // bottom third of the view the cannons fire into. Blurring starts it
  // closing; the visualViewport listener below picks up the resize once the
  // dismiss animation actually finishes and grows the canvas to match.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const context = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let pieces = [];
  let raf = null;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const view = viewport();
    width = view.width;
    height = view.height;
    // The CSS box tracks the same rectangle the particles are drawn in, so a
    // canvas backing store sized to the (possibly smaller) visual viewport is
    // never stretched to fill a larger, stale layout-viewport box.
    canvas.style.left = `${view.left}px`;
    canvas.style.top = `${view.top}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const resizeTarget = window.visualViewport || window;

  function cleanup() {
    cancelAnimationFrame(raf);
    resizeTarget.removeEventListener('resize', resize);
    canvas.remove();
  }

  resize();
  resizeTarget.addEventListener('resize', resize);
  pieces = spawn(width, height);

  const started = performance.now();

  function frame(now) {
    const elapsed = now - started;
    context.clearRect(0, 0, width, height);
    context.globalAlpha = elapsed > LIFE_MS - FADE_MS
      ? Math.max(0, (LIFE_MS - elapsed) / FADE_MS)
      : 1;

    for (const piece of pieces) {
      piece.vy += GRAVITY;
      piece.vx *= DRAG;
      piece.vy *= DRAG;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.spin += piece.spinRate;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.spin);
      // Squashing horizontally on the spin turns a rectangle into a ribbon
      // tumbling edge-on and back.
      context.scale(Math.abs(Math.cos(piece.spin * 0.7)) * 0.9 + 0.1, 1);
      context.fillStyle = piece.color;
      context.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      context.restore();
    }

    if (elapsed < LIFE_MS) raf = requestAnimationFrame(frame);
    else cleanup();
  }

  raf = requestAnimationFrame(frame);
}
