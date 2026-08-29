// Snake on a character grid, in the transcript. Arrow keys on a desktop; on a
// phone the mode's chips take over the hint bar and swipes work on the board,
// so it is genuinely playable rather than nominally present.

const COLS = 26;
const ROWS = 13;
const START_MS = 150;
const FLOOR_MS = 70;
const STEP_MS = 4; // shaved off the tick per gem eaten
const BUFFER = 2;  // turns that can be queued between ticks

const CHARS = { body: '█', head: '█', food: '♦', empty: ' ' };
const KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
};

// Survives for the session so a second game has something to beat.
let best = 0;

const key = (x, y) => `${x},${y}`;

export function snake({ enterMode, exitMode, live }) {
  let body = [{ x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 }];
  let heading = [1, 0];
  // A real input buffer, not a single slot. Pressing up then left before the
  // next tick has to mean "up, then left" — validating the second press against
  // the first while the snake is still travelling right would let it turn 180°
  // into its own neck.
  const pending = [];
  let food = null;
  let score = 0;
  let alive = true;
  let timer = null;

  const handle = live({ kind: 'toy' });

  function placeFood() {
    const taken = new Set(body.map((cell) => key(cell.x, cell.y)));
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (!taken.has(key(x, y))) free.push({ x, y });
    }
    food = free[Math.floor(Math.random() * free.length)];
  }

  function draw() {
    const grid = new Array(ROWS).fill(null).map(() => new Array(COLS).fill(CHARS.empty));
    if (food) grid[food.y][food.x] = CHARS.food;
    body.forEach((cell, index) => {
      grid[cell.y][cell.x] = index === 0 ? CHARS.head : CHARS.body;
    });

    const out = [`┌${'─'.repeat(COLS)}┐`];
    for (const row of grid) out.push(`│${row.join('')}│`);
    out.push(`└${'─'.repeat(COLS)}┘`);
    out.push(` ${score} gems${best ? `   best ${best}` : ''}${alive ? '' : '   game over'}`);
    handle.update(out.join('\n'));
  }

  function step() {
    if (pending.length) heading = pending.shift();

    const head = { x: body[0].x + heading[0], y: body[0].y + heading[1] };
    const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
    // The tail cell frees up this tick, so following it exactly is not a crash.
    const hitSelf = body.slice(0, -1).some((cell) => cell.x === head.x && cell.y === head.y);

    if (hitWall || hitSelf) {
      alive = false;
      draw();
      // Death leaves the mode from the inside; Escape does the same from outside.
      exitMode();
      return;
    }

    body.unshift(head);
    if (food && head.x === food.x && head.y === food.y) {
      score += 1;
      best = Math.max(best, score);
      placeFood();
      restartTimer();
    } else {
      body.pop();
    }
    draw();
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(step, Math.max(FLOOR_MS, START_MS - score * STEP_MS));
  }

  function turn(name) {
    if (!Object.prototype.hasOwnProperty.call(KEYS, name)) return false;
    const next = KEYS[name];
    // Two moves ahead is as much as anyone plays; beyond that it stops feeling
    // like steering and starts feeling like a recording.
    if (pending.length >= BUFFER) return true;

    // Each turn is judged against the direction that will actually precede it.
    const prev = pending.length ? pending[pending.length - 1] : heading;
    const reverses = next[0] === -prev[0] && next[1] === -prev[1];
    const repeats = next[0] === prev[0] && next[1] === prev[1];
    if (reverses || repeats) return true;

    pending.push(next);
    return true;
  }

  // Swipes on the board, for the same reason the chips exist.
  let touch = null;
  const onTouchStart = (event) => {
    touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const onTouchEnd = (event) => {
    if (!touch) return;
    const end = event.changedTouches[0];
    const dx = end.clientX - touch.x;
    const dy = end.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
  };

  const mode = {
    label: 'snake',
    chips: [
      { label: '←', key: 'ArrowLeft' },
      { label: '↑', key: 'ArrowUp' },
      { label: '↓', key: 'ArrowDown' },
      { label: '→', key: 'ArrowRight' },
      { label: 'quit', key: 'Escape' }
    ],
    onKey(event) {
      return turn(event.key);
    },
    onSubmit(raw) {
      const value = raw.trim().toLowerCase();
      if (value === 'exit' || value === 'quit') return { lines: [], exit: true };
      return [];
    },
    onExit() {
      clearInterval(timer);
      handle.end();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      return [
        { text: `=> ${score} gems${score && score === best ? ' (a new best)' : ''}`, kind: 'accent' },
        { text: '' }
      ];
    }
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  placeFood();
  draw();
  restartTimer();
  enterMode(mode);

  return [
    { text: '=> #<Snake board: 26x13, food: :gems>' },
    { text: '   arrows or wasd. ctrl+c to quit.', kind: 'dim' },
    { text: '' }
  ];
}
