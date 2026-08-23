import { createConsole } from './console.js';
import { createParty } from './party.js';
import { track } from './analytics.js';

const $ = (selector) => document.querySelector(selector);

const THEME_KEY = 'alekseenko:theme';
const root = $('[data-root]');
const themeButton = $('[data-theme-toggle]');

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

let session;

const party = createParty({
  onStart: () => track('easter_egg_found'),
  onStop: () => session.focus()
});

session = createConsole({
  root,
  transcript: $('[data-transcript]'),
  lines: $('[data-lines]'),
  input: $('[data-input]'),
  promptLabel: $('[data-prompt]'),
  typed: $('[data-typed]'),
  caret: $('[data-caret]'),
  ghost: $('[data-ghost]'),
  startParty: () => party.start(),
  onRun: (command, known) => track('command_run', { command, known })
});

// Touch keyboards and a zero-opacity input are an awkward pair, so small screens
// get tappable command chips instead of the keyboard hints.
for (const chip of document.querySelectorAll('[data-command]')) {
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    session.submit(chip.dataset.command);
  });
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (link) track('outbound_link_clicked', { url: link.href });
});

document.addEventListener('copy', () => {
  const text = String(window.getSelection() || '');
  if (text.length) track('text_copied', { text });
});

session.focus();
