// donut.c, ported. The spinning ASCII torus is a piece of folk art in this
// trade, and it costs a screenful of trigonometry to have one on the page.

const RAMP = '.,-~:;=!*#$@';
const FPS = 24;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// A torus of tube radius 1 and centre radius 2, viewed from 5 units away, with
// every point of its surface projected onto a character cell and z-buffered so
// the near face wins. Character choice is surface luminance against a fixed light.
function frame(a, b, cols, rows) {
  const output = new Array(cols * rows).fill(' ');
  const depth = new Array(cols * rows).fill(0);
  const [cosA, sinA, cosB, sinB] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)];

  for (let theta = 0; theta < 6.28; theta += 0.07) {
    const [cosT, sinT] = [Math.cos(theta), Math.sin(theta)];
    for (let phi = 0; phi < 6.28; phi += 0.02) {
      const [cosP, sinP] = [Math.cos(phi), Math.sin(phi)];
      const circle = cosT + 2;
      const inverseZ = 1 / (sinP * circle * sinA + sinT * cosA + 5);
      const t = sinP * circle * cosA - sinT * sinA;

      const x = Math.round(cols / 2 + cols * 0.375 * inverseZ * (cosP * circle * cosB - t * sinB));
      // Character cells are about twice as tall as they are wide.
      const y = Math.round(rows / 2 + rows * 0.66 * inverseZ * (cosP * circle * sinB + t * cosB));
      if (x < 0 || x >= cols || y < 0 || y >= rows) continue;

      const at = x + cols * y;
      if (inverseZ <= depth[at]) continue;

      const luminance = Math.floor(
        8 * ((sinT * sinA - sinP * cosT * cosA) * cosB - sinP * cosT * sinA - sinT * cosA - cosP * cosT * sinB)
      );
      depth[at] = inverseZ;
      output[at] = RAMP[luminance > 0 ? Math.min(luminance, RAMP.length - 1) : 0];
    }
  }

  const rowsOut = [];
  for (let r = 0; r < rows; r++) rowsOut.push(output.slice(r * cols, (r + 1) * cols).join(''));
  return rowsOut.join('\n');
}

export function donut({ live, print }) {
  // Narrow enough to fit a phone without wrapping; the art box scrolls if not.
  const cols = window.innerWidth < 520 ? 44 : 62;
  const rows = Math.round(cols / 2.6) + 2;

  const handle = live({ kind: 'toy' });
  let a = 1;
  let b = 1;

  handle.update(frame(a, b, cols, rows));

  if (reducedMotion.matches) {
    handle.onEnd = () => print([{ text: '=> :spinning', kind: 'accent' }, { text: '' }]);
    return [{ text: '# esc to stop', kind: 'dim' }, { text: '' }];
  }

  const timer = setInterval(() => {
    a += 0.07;
    b += 0.03;
    handle.update(frame(a, b, cols, rows));
  }, 1000 / FPS);

  handle.onEnd = () => {
    clearInterval(timer);
    print([{ text: '=> :spinning', kind: 'accent' }, { text: '' }]);
  };

  return [{ text: '# esc to stop', kind: 'dim' }, { text: '' }];
}
