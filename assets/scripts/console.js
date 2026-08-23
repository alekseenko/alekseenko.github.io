// The irb session itself: transcript, prompt, history, autosuggestion.

import { BOOT_TRANSCRIPT, BOOT_HISTORY, FIRST_STATEMENT, COMPLETIONS, buildCommands } from './profile.js';

const promptFor = (n) => `irb(main):${String(n).padStart(3, '0')}:0>`;

export function createConsole({ root, transcript, lines, input, promptLabel, typed, caret, ghost, startParty, onRun }) {
  const commands = buildCommands({ startParty });

  const state = {
    n: FIRST_STATEMENT,
    value: '',
    draft: '',
    hist: BOOT_HISTORY.slice(),
    histIdx: -1
  };

  function renderLine(line) {
    const node = document.createElement('div');
    node.className = 'line';
    if (line.kind) node.classList.add(`line--${line.kind}`);
    if (line.art) node.classList.add('line--art');
    if (!line.text) node.classList.add('line--blank');

    // A link is always a substring of the line, never the whole line.
    const at = line.link ? line.text.indexOf(line.link) : -1;
    if (at < 0) {
      node.textContent = line.text;
    } else {
      const anchor = document.createElement('a');
      anchor.href = line.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.textContent = line.link;
      node.append(line.text.slice(0, at), anchor, line.text.slice(at + line.link.length));
    }
    return node;
  }

  function print(newLines) {
    const batch = document.createDocumentFragment();
    for (const line of newLines) batch.appendChild(renderLine(line));
    lines.appendChild(batch);
    transcript.scrollTop = transcript.scrollHeight;
  }

  // Trim, collapse whitespace, lowercase, drop a trailing `()`, treat `profile.`
  // as `andy.`, and — as a courtesy — prefix a bare word with `andy.` when that
  // names a real method.
  function normalize(raw) {
    let value = raw.trim().replace(/\s+/g, ' ').toLowerCase().replace(/^profile\./, 'andy.');
    value = value.replace(/\(\)$/, '');
    if (value && !value.startsWith('andy') && !['help', 'exit'].includes(value) && commands[`andy.${value}`]) {
      value = `andy.${value}`;
    }
    return value;
  }

  // Real Ruby errors, not "command not found" — that is the whole conceit.
  function errorFor(raw) {
    const value = raw.trim();
    const dot = value.indexOf('.');
    if (dot > 0) {
      const receiver = value.slice(0, dot);
      const method = value.slice(dot + 1).replace(/\(.*$/, '');
      if (receiver === 'andy' || receiver === 'profile') {
        return [
          { text: `NoMethodError: undefined method \`${method}' for an instance of Profile`, kind: 'accent' },
          { text: '  did you mean?  andy.methods', kind: 'dim' },
          { text: '' }
        ];
      }
      return [
        { text: `NameError: undefined local variable or method \`${receiver}' for main:Object`, kind: 'accent' },
        { text: '  the only object in this session is `andy`', kind: 'dim' },
        { text: '' }
      ];
    }
    if (/^[A-Z]/.test(value)) {
      return [{ text: `NameError: uninitialized constant ${value.replace(/[^\w:]/g, '')}`, kind: 'accent' }, { text: '' }];
    }
    return [
      { text: `NameError: undefined local variable or method \`${value.replace(/\(.*$/, '')}' for main:Object`, kind: 'accent' },
      { text: '  did you mean?  andy.methods', kind: 'dim' },
      { text: '' }
    ];
  }

  function ghostFor(value) {
    if (!value.trim()) return '';
    const lower = value.toLowerCase();
    const hit = COMPLETIONS.find((command) => command.startsWith(lower) && command !== lower);
    return hit ? hit.slice(value.length) : '';
  }

  function renderPrompt() {
    const tail = ghostFor(state.value);
    promptLabel.textContent = promptFor(state.n);
    typed.textContent = state.value;
    caret.textContent = tail ? tail[0] : ' ';
    caret.classList.toggle('is-blinking', !tail);
    ghost.textContent = tail ? tail.slice(1) : '';
    if (input.value !== state.value) input.value = state.value;
  }

  function run(raw) {
    const echo = { text: `${promptFor(state.n)} ${raw}`, kind: 'in' };
    state.n += 1;
    state.value = '';
    state.draft = '';
    state.histIdx = -1;

    if (!raw.trim()) {
      print([echo]);
      renderPrompt();
      return;
    }

    state.hist.unshift(raw);
    const command = commands[normalize(raw)];
    print([echo].concat(command ? command() : errorFor(raw)));
    renderPrompt();
    if (onRun) onRun(raw, Boolean(command));
  }

  function focus() {
    // Without this guard every click steals focus and collapses the selection,
    // making the transcript impossible to copy.
    const selection = window.getSelection();
    if (selection && String(selection).length) return;
    input.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => {
    state.value = input.value;
    renderPrompt();
  });

  input.addEventListener('keydown', (event) => {
    const tail = ghostFor(state.value);

    if (event.key === 'Enter') {
      run(state.value);
    } else if ((event.key === 'Tab' || event.key === 'ArrowRight') && tail) {
      // Only swallow Tab when there is something to accept, so it still moves
      // focus out of the console for keyboard users.
      event.preventDefault();
      state.value += tail;
      renderPrompt();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(state.histIdx + 1, state.hist.length - 1);
      if (next < 0 || next === state.histIdx) return;
      if (state.histIdx === -1) state.draft = state.value;
      state.histIdx = next;
      state.value = state.hist[next];
      renderPrompt();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (state.histIdx <= -1) return;
      state.histIdx -= 1;
      state.value = state.histIdx >= 0 ? state.hist[state.histIdx] : state.draft;
      renderPrompt();
    }
  });

  root.addEventListener('click', focus);

  print(BOOT_TRANSCRIPT);
  renderPrompt();

  return {
    focus,
    submit(command) {
      // Chips are tapped, not typed — don't pop a touch keyboard for them.
      const wasFocused = document.activeElement === input;
      state.value = command;
      renderPrompt();
      run(command);
      if (wasFocused) focus();
    }
  };
}
