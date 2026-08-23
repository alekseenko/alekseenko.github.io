// The dance party easter egg: `andy.dance!` and nothing else starts it.

import { spawnDancers, frameFor, RAVE_COLORS } from './dancers.js';

const DANCER_COUNT = 22;
const LIGHT_COUNT = 6;
const TICK_MS = 115; // dancers advance every 2-4 ticks, i.e. 230-460ms each
const MUSIC_SRC = 'assets/audio/dance.mp3';
const MUSIC_VOLUME = 0.5;

const rand = (min, max) => min + Math.random() * (max - min);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function el(tag, className, style) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (style) Object.assign(node.style, style);
  return node;
}

function buildLights() {
  const lights = el('div', 'party__lights');
  // Fresh colours and positions every party, so no two look the same.
  const palette = RAVE_COLORS.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const light = el('div', 'party__light');
    light.style.setProperty('--x', `${rand(8, 92).toFixed(1)}%`);
    light.style.setProperty('--y', `${rand(10, 80).toFixed(1)}%`);
    light.style.setProperty('--color', palette[i % palette.length]);
    light.style.setProperty('--dur', `${rand(0.55, 1.25).toFixed(2)}s`);
    light.style.setProperty('--delay', `${rand(0, 0.9).toFixed(2)}s`);
    light.style.setProperty('--peak', rand(0.22, 0.42).toFixed(2));
    lights.appendChild(light);
  }
  return lights;
}

function buildDancer(dancer) {
  const slot = el('div', 'party__dancer');
  slot.style.left = `${dancer.left.toFixed(2)}%`;
  slot.style.top = `${dancer.top.toFixed(2)}%`;
  slot.style.width = `${dancer.width.toFixed(0)}px`;
  slot.style.animationDelay = `${dancer.popDelay.toFixed(2)}s`;

  const sway = el('div', 'party__sway');
  sway.style.animationName = dancer.swayVariant;
  sway.style.animationDuration = `${dancer.swayDuration.toFixed(2)}s`;
  sway.style.animationDelay = `${dancer.swayDelay.toFixed(2)}s`;

  let body;
  if (dancer.performer.kind === 'ascii') {
    body = el('pre', 'party__ascii');
    body.style.fontSize = `${dancer.fontSize.toFixed(1)}px`;
    body.style.setProperty('--glow', dancer.color);
    body.textContent = frameFor(dancer, 0);
  } else {
    body = el('div', 'party__image');
    // background-image rather than <img src> so a missing file degrades silently
    body.style.backgroundImage = `url(${dancer.performer.src})`;
    body.style.aspectRatio = dancer.performer.ratio;
    // Mirroring only makes sense for the gif — flipped ASCII art reads backwards.
    if (dancer.flipped) body.style.transform = 'scaleX(-1)';
  }

  sway.appendChild(body);
  slot.appendChild(sway);
  return { slot, body };
}

export function createParty({ onStart, onStop } = {}) {
  let overlay = null;
  let beat = null;
  let tick = 0;
  let rendered = [];
  let music = null;

  function playMusic() {
    if (!music) {
      music = new Audio(MUSIC_SRC);
      music.loop = true;
      music.volume = MUSIC_VOLUME;
    }
    music.currentTime = 0;
    // Started from a keypress or a tap, so autoplay policy is satisfied — but a
    // blocked or missing track must never take the visuals down with it.
    const played = music.play();
    if (played && typeof played.catch === 'function') played.catch(() => {});
  }

  function stopMusic() {
    if (!music) return;
    music.pause();
    music.currentTime = 0;
  }

  function start() {
    if (overlay) return;

    overlay = el('div', 'party');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Dance party. Click or press escape to stop.');

    overlay.appendChild(el('div', 'party__scrim'));
    overlay.appendChild(buildLights());

    const floor = el('div', 'party__floor');
    rendered = spawnDancers(DANCER_COUNT).map((dancer) => {
      const { slot, body } = buildDancer(dancer);
      floor.appendChild(slot);
      return { dancer, body };
    });
    overlay.appendChild(floor);

    const caption = el('div', 'party__caption');
    caption.textContent = 'click or press esc to stop the party';
    overlay.appendChild(caption);

    overlay.addEventListener('click', stop);
    document.body.appendChild(overlay);
    document.body.classList.add('is-dancing');

    // Keystrokes would otherwise pile up in the console hidden behind the overlay.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    tick = 0;
    // Frame flipping is motion too — hold a still pose when that is unwelcome.
    if (!reducedMotion.matches) {
      beat = setInterval(() => {
        tick += 1;
        for (const { dancer, body } of rendered) {
          if (dancer.performer.kind !== 'ascii') continue;
          const next = frameFor(dancer, tick);
          if (next !== body.textContent) body.textContent = next;
        }
      }, TICK_MS);
    }

    playMusic();
    if (onStart) onStart();
  }

  function stop() {
    if (!overlay) return;
    clearInterval(beat);
    beat = null;
    overlay.remove();
    overlay = null;
    rendered = [];
    document.body.classList.remove('is-dancing');
    stopMusic();
    if (onStop) onStop();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') stop();
  });

  return { start, stop, isRunning: () => overlay !== null };
}
