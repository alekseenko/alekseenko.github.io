// `andy.destroy!` — one warning, then the console dies for real.
//
// Browsers ignore window.close() for any tab the page did not open, which is
// every real visitor, so there is no attempt to close anything. The honest
// terminal equivalent is better anyway: the screen powers off like a CRT and
// stays off until the page is reloaded.

const FACE = [
  ' ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ ',
  '█                        █',
  '█  ▀█▄▄            ▄▄█▀  █',
  '█     ▀▀██      ██▀▀     █',
  '█      ████    ████      █',
  '█                        █',
  '█        ▄▄▄▄▄▄▄▄        █',
  '█     ▄█▀        ▀█▄     █',
  '█   █▀              ▀█   █',
  '█                        █',
  ' ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ '
].join('\n');

const GLARE_MS = 2000;   // how long the face gets to be furious
const SQUASH_MS = 360;   // picture collapses to a horizontal line
const BEAM_MS = 460;     // line collapses to a dot and fades
const HINT_MS = 900;     // pause before the way out is offered

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createDestroy({ onKill } = {}) {
  let strikes = 0;
  let dead = false;

  function kill() {
    if (dead) return;
    dead = true;
    if (onKill) onKill();

    const overlay = el('div', 'crt');
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-label', 'The console has been destroyed. Reload the page.');

    const screen = el('div', 'crt__screen');
    screen.appendChild(el('pre', 'crt__face', FACE));
    const beam = el('div', 'crt__beam');
    const hint = el('div', 'crt__hint', 'reload the page to bring andy back');

    overlay.append(screen, beam, hint);
    document.body.appendChild(overlay);
    document.body.classList.add('is-destroyed');

    // Nothing on the page answers to anything any more. Escape included — this
    // is the one overlay on the site with no way out but a reload.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const swallow = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for (const type of ['keydown', 'keyup', 'keypress']) {
      document.addEventListener(type, swallow, true);
    }

    if (reducedMotion.matches) {
      screen.remove();
      setTimeout(() => hint.classList.add('is-visible'), HINT_MS);
      return;
    }

    setTimeout(() => screen.classList.add('is-collapsing'), GLARE_MS);
    setTimeout(() => {
      screen.remove();
      beam.classList.add('is-firing');
    }, GLARE_MS + SQUASH_MS);
    setTimeout(() => beam.remove(), GLARE_MS + SQUASH_MS + BEAM_MS);
    setTimeout(() => hint.classList.add('is-visible'), GLARE_MS + SQUASH_MS + BEAM_MS + HINT_MS);
  }

  return function destroy() {
    strikes += 1;

    if (strikes === 1) {
      return [
        { text: 'Woooooow did you really just try to destroy me? Kinda rude...' },
        { text: "I'll let it slip this once, but never do that again!" },
        { text: '=> false', kind: 'accent' },
        { text: '' }
      ];
    }

    kill();
    return [{ text: 'ActiveRecord::RecordNotDestroyed: you were warned', kind: 'accent' }];
  };
}
