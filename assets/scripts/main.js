import { createConsole } from './console.js';
import { buildCommands } from './commands/index.js';

const $ = (selector) => document.querySelector(selector);

const THEME_KEY = 'alekseenko:theme';
const root = $('[data-root]');
const themeButton = $('[data-theme-toggle]');
const chipsHost = $('[data-chips]');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  // The button is labelled with the theme you would switch *to*.
  themeButton.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');

themeButton.addEventListener('click', (event) => {
  // Must not fall through to the root's focus handler.
  event.stopPropagation();
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {
    /* private mode — the theme just won't stick */
  }
});

const session = createConsole({
  root,
  transcript: $('[data-transcript]'),
  lines: $('[data-lines]'),
  input: $('[data-input]'),
  promptRow: $('[data-prompt-row]'),
  promptLabel: $('[data-prompt]'),
  typed: $('[data-typed]'),
  caret: $('[data-caret]'),
  after: $('[data-after]'),
  ghost: $('[data-ghost]'),
  createCommands: buildCommands,
  onModeChange: (mode) => renderChips(mode)
});

// Touch keyboards and a zero-opacity input are an awkward pair, so small screens
// get tappable command chips instead of the keyboard hints. A game that captures
// the prompt swaps them for its own controls — which is what makes Snake
// playable on a phone rather than merely present.
const DEFAULT_CHIPS = chipsHost.innerHTML;

function bindDefaultChips() {
  for (const chip of chipsHost.querySelectorAll('[data-command]')) {
    chip.addEventListener('click', (event) => {
      event.stopPropagation();
      session.submit(chip.dataset.command);
    });
  }
}

function renderChips(mode) {
  // While a game holds the prompt, the standing hints describe a keyboard that
  // no longer does any of those things — so the bar shows only the game's keys.
  chipsHost.parentElement.classList.toggle('hints--mode', Boolean(mode));

  if (!mode) {
    chipsHost.innerHTML = DEFAULT_CHIPS;
    bindDefaultChips();
    return;
  }

  // A game that names no controls still gets a way out. Leaving the command
  // chips up would be worse than useless — tapping `andy.methods` mid-wordle
  // submits it as a twelve-letter guess.
  const chips = mode.chips || [{ label: 'quit', key: 'Escape' }];

  chipsHost.innerHTML = '';
  for (const { label, key } of chips) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip chip--mode';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      // Deliberately no refocus: a tap must not pop the keyboard mid-game.
      event.stopPropagation();
      session.key(key);
    });
    chipsHost.appendChild(button);
  }
}

bindDefaultChips();

session.focus();
