// Full-viewport digital rain. Canvas rather than DOM: this is the one place on
// the site where a few hundred glyphs at 30fps would actually cost frames.

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789{}[]|=>@$&*';
const FONT_SIZE = 15;
const TRAIL = 0.055;     // how fast the previous frame fades to black
const SLOWEST = 10;      // frames a column waits before dropping one row
const FASTEST = 3;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

export function createMatrix({ onStart, onStop } = {}) {
  let overlay = null;
  let raf = null;

  function start() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'matrix';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Digital rain. Click or press escape to stop.');

    const canvas = document.createElement('canvas');
    overlay.appendChild(canvas);

    const caption = document.createElement('div');
    caption.className = 'party__caption';
    caption.textContent = 'click or press esc to wake up';
    overlay.appendChild(caption);

    overlay.addEventListener('click', stop);
    document.body.appendChild(overlay);
    document.body.classList.add('is-dancing');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    const context = canvas.getContext('2d');
    let columns = [];
    let width = 0;
    let height = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.font = `700 ${FONT_SIZE}px 'JetBrains Mono', monospace`;
      context.textBaseline = 'top';

      // Columns fall one whole character at a time, on their own cadence. Moving
      // by fractions of a cell every frame instead would smear each glyph into
      // the next and lose the katakana entirely.
      const rows = Math.ceil(height / FONT_SIZE);
      columns = new Array(Math.ceil(width / FONT_SIZE)).fill(0).map(() => ({
        // Seeded across the whole screen, so the rain is already falling when
        // the overlay appears rather than arriving as one descending wall.
        row: Math.floor(Math.random() * rows * 1.5) - Math.floor(rows * 0.5),
        every: FASTEST + Math.floor(Math.random() * (SLOWEST - FASTEST)),
        wait: 0
      }));

      context.fillStyle = '#000000';
      context.fillRect(0, 0, width, height);
    }

    function draw() {
      // Everything already on screen dims a little; that fade *is* the trail.
      context.fillStyle = `rgba(0, 0, 0, ${TRAIL})`;
      context.fillRect(0, 0, width, height);

      const rows = Math.ceil(height / FONT_SIZE);

      columns.forEach((column, index) => {
        column.wait += 1;
        if (column.wait < column.every) return;
        column.wait = 0;

        const x = index * FONT_SIZE;
        // The glyph the head just vacated cools to plain green.
        context.fillStyle = 'rgba(59, 224, 122, 0.9)';
        context.fillText(pick(), x, column.row * FONT_SIZE);

        column.row += 1;
        context.fillStyle = '#CFFFE0';
        context.fillText(pick(), x, column.row * FONT_SIZE);

        if (column.row > rows + Math.random() * rows * 0.6) column.row = -1;
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    overlay.__resize = resize;

    if (reducedMotion.matches) {
      // A single still frame: recognisably the same image, none of the motion.
      for (let pass = 0; pass < 24; pass++) {
        columns.forEach((column, index) => {
          context.fillStyle = pass === 23 ? '#CFFFE0' : `rgba(59, 224, 122, ${0.16 + pass * 0.032})`;
          context.fillText(pick(), index * FONT_SIZE, (column.row + pass - 23) * FONT_SIZE);
        });
      }
    } else {
      draw();
    }

    if (onStart) onStart();
  }

  function stop() {
    if (!overlay) return;
    cancelAnimationFrame(raf);
    raf = null;
    window.removeEventListener('resize', overlay.__resize);
    overlay.remove();
    overlay = null;
    document.body.classList.remove('is-dancing');
    if (onStop) onStop();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') stop();
  });

  return { start, stop, isRunning: () => overlay !== null };
}
