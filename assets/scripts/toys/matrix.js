// Full-viewport digital rain. Canvas rather than DOM: this is the one place on
// the site where a few hundred glyphs at 30fps would actually cost frames.

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789{}[]|=>@$&*';
const FONT_SIZE = 15;
const TRAIL = 0.075; // how fast the previous frame fades to black
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

      // Each column falls at its own speed, starting somewhere above the fold so
      // the screen fills unevenly rather than as one descending wall.
      columns = new Array(Math.ceil(width / FONT_SIZE)).fill(0).map(() => ({
        y: Math.random() * -height,
        speed: FONT_SIZE * (0.5 + Math.random() * 0.9)
      }));

      context.fillStyle = '#000000';
      context.fillRect(0, 0, width, height);
    }

    function draw() {
      context.fillStyle = `rgba(0, 0, 0, ${TRAIL})`;
      context.fillRect(0, 0, width, height);

      columns.forEach((column, index) => {
        const x = index * FONT_SIZE;
        context.fillStyle = '#B8FFD0';
        context.fillText(pick(), x, column.y);
        // One glyph of afterglow behind the bright head sells the trail.
        context.fillStyle = 'rgba(59, 224, 122, 0.85)';
        context.fillText(pick(), x, column.y - FONT_SIZE);

        column.y += column.speed;
        if (column.y > height + Math.random() * height * 0.5) column.y = -FONT_SIZE;
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    overlay.__resize = resize;

    if (reducedMotion.matches) {
      // A single still frame: recognisably the same image, none of the motion.
      for (let pass = 0; pass < 26; pass++) {
        columns.forEach((column, index) => {
          context.fillStyle = pass > 22 ? '#B8FFD0' : `rgba(59, 224, 122, ${0.18 + pass * 0.03})`;
          context.fillText(pick(), index * FONT_SIZE, column.y + pass * FONT_SIZE);
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
