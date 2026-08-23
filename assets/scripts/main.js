import { createConsole } from './console.js';
import { buildCommands } from './commands/index.js';
import { track } from './analytics.js';

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
  promptLabel: $('[data-prompt]'),
  typed: $('[data-typed]'),
  caret: $('[data-caret]'),
  ghost: $('[data-ghost]'),
  createCommands: buildCommands,
  onRun: (command, known) => track('command_run', { command, known }),
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
  if (!mode || !mode.chips) {
    chipsHost.innerHTML = DEFAULT_CHIPS;
    bindDefaultChips();
    return;
  }

  chipsHost.innerHTML = '';
  for (const { label, key } of mode.chips) {
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

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (link) track('outbound_link_clicked', { url: link.href });
});

document.addEventListener('copy', () => {
  const text = String(window.getSelection() || '');
  if (text.length) track('text_copied', { text });
});

session.focus();
