// The dance floor roster. Everything here is original character art plus the
// dog gif that has been on the site forever — deliberately no memes we don't
// own the rights to.

const frame = (...lines) => lines.join('\n');

const ASCII_DANCERS = [
  {
    name: 'wizard',
    frames: [
      frame('   /\\', '  /  \\', ' | oo |', '  \\__/', ' <|##|>', '  /  \\', ' _/  \\_'),
      frame('   /\\', '  /  \\', ' | ^^ |', '  \\__/', ' \\|##|/', '  |  |', '  \\__/')
    ]
  },
  {
    name: 'cat',
    frames: [
      frame(' /\\_/\\', '( o.o )', ' > ^ < ', ' /| |\\ ', '  d b  '),
      frame(' /\\_/\\', '( -.- )', ' > ^ < ', ' \\| |/ ', '  b d  ')
    ]
  },
  {
    name: 'robot',
    frames: [
      frame(' [====] ', ' |o  o| ', ' | -- | ', '_|====|_', ' |    | ', ' /    \\ '),
      frame(' [====] ', ' |^  ^| ', ' | == | ', '\\|====|/', ' |    | ', ' \\    / ')
    ]
  },
  {
    name: 'gem',
    frames: [
      frame('  /\\/\\  ', ' <    > ', '  \\  /  ', '   \\/   ', '  /||\\  ', '  d  b  '),
      frame('  /\\/\\  ', ' <    > ', '  \\  /  ', '   \\/   ', '  \\||/  ', '  b  d  ')
    ]
  },
  {
    name: 'shrug',
    frames: [
      frame(' _/\\_ ', ' (o o)', '  \\_/ ', ' /| |\\', '  | | ', ' _/ \\_'),
      frame(' _/\\_ ', ' (^ ^)', '  \\_/ ', ' \\| |/', '  | | ', '  /_\\ ')
    ]
  },
  {
    name: 'penguin',
    frames: [
      frame('  _._  ', ' (o.o) ', '<( v )>', ' /| |\\ ', '  ^ ^  '),
      frame('  _._  ', ' (-.-) ', ' ( v ) ', ' \\| |/ ', '  v v  '),
      frame('  _._  ', ' (O.O) ', '<( v )>', ' \\|_|/ ', '  ^ ^  ')
    ]
  },
  {
    name: 'ghost',
    frames: [
      frame(' .---. ', '( o o )', '(  ^  )', ' )   ( ', ' ~^~^~ '),
      frame(' .---. ', '( - - )', '(  o  )', ' (   ) ', ' ^~^~^ '),
      frame(' .---. ', '( O O )', '(  _  )', ' )   ( ', ' ~^~^~ ')
    ]
  },
  {
    name: 'alien',
    frames: [
      frame('  .---.  ', ' / o o \\ ', ' \\  =  / ', ' --|_|-- ', '   / \\   '),
      frame('  .---.  ', ' / ^ ^ \\ ', ' \\  o  / ', ' --|_|-- ', '   \\ /   ')
    ]
  },
  {
    name: 'bunny',
    frames: [
      frame(' (\\_/) ', ' (o.o) ', ' (> <) ', ' /| |\\ ', '  " "  '),
      frame(' (\\_/) ', ' (^.^) ', ' (> <) ', ' \\| |/ ', '  " "  ')
    ]
  },
  {
    name: 'raver',
    frames: [
      frame(' \\o/ ', '  |  ', ' / \\ '),
      frame('  o/ ', ' /|  ', ' /\\  '),
      frame(' \\o  ', '  |\\ ', '  /\\ '),
      frame(' _o_ ', '  |  ', ' /_\\ ')
    ]
  }
];

// Weighted so the dog shows up a few times per party without crowding out the
// character art. Bump `weight` (or push a new entry) to change the mix.
const ROSTER = ASCII_DANCERS.map((d) => ({ kind: 'ascii', weight: 1, ...d })).concat([
  { kind: 'image', name: 'dog', weight: 3, src: 'assets/img/dance.gif', ratio: '212 / 270' }
]);

const TOTAL_WEIGHT = ROSTER.reduce((sum, d) => sum + d.weight, 0);

// Neon glow colours — one per dancer, so the floor is not uniformly red.
export const RAVE_COLORS = [
  '#E24A55',
  '#FF3CAC',
  '#B14BFF',
  '#2AF5FF',
  '#4DFF7C',
  '#FFE45E',
  '#FF8A3D'
];

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];

function pickPerformer() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const performer of ROSTER) {
    roll -= performer.weight;
    if (roll < 0) return performer;
  }
  return ROSTER[ROSTER.length - 1];
}

// The art is padded two columns wider than its widest line so it does not touch
// the edges of its slot; font size is derived from that column count.
function columnsOf(performer) {
  const widest = Math.max(...performer.frames.map((f) => Math.max(...f.split('\n').map((l) => l.length))));
  return widest + 2;
}

const COLUMNS = new WeakMap();

export function spawnDancers(count) {
  const cols = 7;
  const rows = 4;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, Math.min(count, cells.length)).map(([c, r]) => {
    const performer = pickPerformer();
    if (performer.kind === 'ascii' && !COLUMNS.has(performer)) COLUMNS.set(performer, columnsOf(performer));
    const width = rand(90, 200);
    return {
      performer,
      columns: COLUMNS.get(performer) || 10,
      // Each dancer starts on its own frame and advances at its own rate, so the
      // troupe never falls into lockstep.
      phase: randInt(0, performer.frames ? performer.frames.length - 1 : 0),
      ticksPerFrame: randInt(2, 4),
      flipped: Math.random() < 0.5,
      swayVariant: Math.random() < 0.5 ? 'sway' : 'sway-alt',
      color: pickFrom(RAVE_COLORS),
      // Clamped so a jittered edge cell does not push a dancer off screen.
      left: clamp(c * (100 / cols) + rand(-4.5, 4.5), 1, 86),
      top: clamp(r * (100 / rows) + rand(-6, 6), 5, 74),
      width,
      fontSize: width / (COLUMNS.get(performer) || 10),
      popDelay: rand(0, 0.7),
      swayDuration: rand(0.55, 1.4),
      swayDelay: rand(0, 0.5)
    };
  });
}

export function frameFor(dancer, tick) {
  const frames = dancer.performer.frames;
  if (!frames) return null;
  return frames[(Math.floor(tick / dancer.ticksPerFrame) + dancer.phase) % frames.length];
}
