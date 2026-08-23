// A ten-second charm, deliberately not a centrepiece.

const MUG = [
  '     ________',
  '    /        \\____',
  '   |          |   \\',
  '   |          |    |',
  '   |          |___/',
  '    \\________/',
  '  __________________',
];

// Steam rises by cycling four hand-drawn plumes above the mug.
const STEAM = [
  ['      ( (   ', '       ) )  ', '      ( (   '],
  ['       ) )  ', '      ( (   ', '       ) )  '],
  ['      (  )  ', '       )(   ', '      (  )  '],
  ['       )(   ', '      (  )  ', '       )(   ']
];

const DURATION_MS = 8000;
const TICK_MS = 340;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const render = (phase) => STEAM[phase % STEAM.length].concat(MUG).join('\n');

export function coffee({ live, print }) {
  const handle = live({ kind: 'toy' });
  let phase = 0;
  handle.update(render(phase));

  let beat = null;
  let stop = null;

  handle.onEnd = () => {
    clearInterval(beat);
    clearTimeout(stop);
    print([{ text: '=> :caffeinated', kind: 'accent' }, { text: '' }]);
  };

  if (reducedMotion.matches) return [];

  beat = setInterval(() => {
    phase += 1;
    handle.update(render(phase));
  }, TICK_MS);

  // Steam that never stops is a leak, not a joke.
  stop = setTimeout(() => handle.end(), DURATION_MS);

  return [];
}
