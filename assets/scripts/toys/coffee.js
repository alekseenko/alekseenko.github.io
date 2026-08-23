// A ten-second charm, deliberately not a centrepiece.

const MUG = [
  '     ______',
  '    /      \\___',
  '    |      |   \\',
  '    |      |   |',
  '    |      |__/',
  '    \\______/',
  '   ____________'
];

// Steam rises by cycling four hand-drawn plumes above the mug.
const STEAM = [
  ['      ( (   ', '       ) )  ', '      ( (   '],
  ['       ) )  ', '      ( (   ', '       ) )  '],
  ['      (  )  ', '       )(   ', '      (  )  '],
  ['       )(   ', '      (  )  ', '       )(   ']
];

const TICK_MS = 340;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const render = (phase) => STEAM[phase % STEAM.length].concat(MUG).join('\n');

// One cup steams at a time; the rest cool down where they were poured.
let steaming = null;

export function coffee({ live }) {
  const handle = live({ kind: 'toy', persistent: true });
  let phase = 0;
  handle.update(render(phase));

  if (!reducedMotion.matches) {
    clearInterval(steaming);
    steaming = setInterval(() => {
      phase += 1;
      handle.update(render(phase));
    }, TICK_MS);
  }

  return [{ text: '=> :caffeinated', kind: 'accent' }, { text: '' }];
}
