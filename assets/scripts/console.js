// The irb session itself: transcript, prompt, history, autosuggestion — plus the
// two extension points everything else is built on. `live()` hands a command a
// line it can redraw in place, and `enterMode()` lets a game borrow the prompt
// the way a real irb sub-session would.

import { BOOT_TRANSCRIPT, BOOT_HISTORY, FIRST_STATEMENT, COMPLETIONS } from './commands/profile.js';

const promptFor = (n) => `irb(main):${String(n).padStart(3, '0')}:0>`;

export function createConsole({
  root, transcript, lines, input, promptLabel, typed, caret, ghost,
  createCommands, onRun, onModeChange
}) {
  const state = {
    n: FIRST_STATEMENT,
    value: '',
    draft: '',
    hist: BOOT_HISTORY.slice(),
    histIdx: -1,
    mode: null
  };

  // Animations currently redrawing a line. Escape, or simply running the next
  // command, stops them all — a toy must never outlive the prompt that spawned it.
  const running = new Set();

  const labelFor = () => (state.mode ? `${state.mode.label}>` : promptFor(state.n));

  // Within 40px of the end counts as "following along". Anyone who scrolled up
  // to re-read something is left where they are while an animation redraws.
  const pinned = () =>
    transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 40;

  function scrollToBottom() {
    transcript.scrollTop = transcript.scrollHeight;
    // Web fonts and the ASCII portrait settle a frame late and change the height.
    requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight;
    });
  }

  function renderLine(line) {
    const node = document.createElement('div');
    node.className = 'line';
    if (line.kind) node.classList.add(`line--${line.kind}`);
    if (line.art) node.classList.add('line--art');

    // Wordle scoring: one span per letter, coloured by how well it matched.
    if (line.tiles) {
      node.classList.add('line--tiles');
      for (const tile of line.tiles) {
        const span = document.createElement('span');
        span.className = `tile tile--${tile.state}`;
        span.textContent = tile.ch;
        node.appendChild(span);
      }
      return node;
    }

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
    if (!newLines || !newLines.length) return;
    const batch = document.createDocumentFragment();
    for (const line of newLines) batch.appendChild(renderLine(line));
    lines.appendChild(batch);
    scrollToBottom();
  }

  // One line a command owns and repaints: the donut, the coffee steam, the
  // snake board. Returns a handle rather than a node so callers cannot leak DOM.
  function live({ kind = 'art' } = {}) {
    const node = document.createElement('div');
    node.className = `line line--${kind}`;
    lines.appendChild(node);
    scrollToBottom();

    const handle = {
      onEnd: null,
      update(text) {
        const follow = pinned();
        node.textContent = text;
        if (follow) transcript.scrollTop = transcript.scrollHeight;
      },
      end() {
        if (!running.has(handle)) return;
        running.delete(handle);
        if (handle.onEnd) handle.onEnd();
      }
    };

    running.add(handle);
    return handle;
  }

  function stopRunning() {
    const stopped = running.size > 0;
    for (const handle of Array.from(running)) handle.end();
    return stopped;
  }

  function enterMode(spec) {
    state.mode = spec;
    state.value = '';
    state.draft = '';
    state.histIdx = -1;
    renderPrompt();
    if (onModeChange) onModeChange(spec);
    scrollToBottom();
  }

  function exitMode() {
    if (!state.mode) return;
    const mode = state.mode;
    state.mode = null;
    state.value = '';
    if (mode.onExit) print(mode.onExit() || []);
    renderPrompt();
    if (onModeChange) onModeChange(null);
    scrollToBottom();
  }

  // Trim, collapse whitespace, lowercase, drop a trailing `()`, treat `profile.`
  // as `andy.`, and — as a courtesy — prefix a bare word with `andy.` when that
  // names a real method.
  function normalize(raw) {
    let value = raw.trim().replace(/\s+/g, ' ').toLowerCase().replace(/^profile\./, 'andy.');
    value = value.replace(/\(\)$/, '');
    if (value && !value.startsWith('andy') && !['help', 'exit'].includes(value) && table[`andy.${value}`]) {
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
    if (state.mode || !value.trim()) return '';
    const lower = value.toLowerCase();
    const hit = COMPLETIONS.find((command) => command.startsWith(lower) && command !== lower);
    return hit ? hit.slice(value.length) : '';
  }

  function renderPrompt() {
    const tail = ghostFor(state.value);
    promptLabel.textContent = labelFor();
    typed.textContent = state.value;
    caret.textContent = tail ? tail[0] : ' ';
    caret.classList.toggle('is-blinking', !tail);
    ghost.textContent = tail ? tail.slice(1) : '';
    if (input.value !== state.value) input.value = state.value;
  }

  // Resolution order: exact command, then the argument-taking matchers, then
  // the console's own Ruby error. Matchers are ordered and may decline by
  // returning null, which is how the evaluator hands unparseable input back.
  function dispatch(raw) {
    const exact = table[normalize(raw)];
    if (exact) return exact() || [];

    for (const matcher of matchers) {
      const hit = matcher.pattern.exec(raw.trim());
      if (!hit) continue;
      const out = matcher.run(hit);
      if (out) return out;
    }
    return null;
  }

  function run(raw) {
    stopRunning();
    const echo = { text: `${labelFor()} ${raw}`, kind: 'in' };

    // Inside a game the prompt belongs to the game, not to Ruby.
    if (state.mode) {
      const mode = state.mode;
      state.value = '';
      state.histIdx = -1;
      if (raw.trim()) state.hist.unshift(raw);
      const result = mode.onSubmit(raw) || [];
      const out = Array.isArray(result) ? result : (result.lines || []);
      print([echo].concat(out));
      if (!Array.isArray(result) && result.exit) exitMode();
      else renderPrompt();
      scrollToBottom();
      return;
    }

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
    // The echo lands before the command runs, so a toy that animates or prints
    // as it starts appears underneath its own prompt line rather than above it.
    print([echo]);
    const out = dispatch(raw);
    print(out || errorFor(raw));
    renderPrompt();
    scrollToBottom();
    if (onRun) onRun(raw, out !== null);
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
    // A game gets first refusal on every key — that is how Snake reads arrows
    // without the prompt also treating them as history navigation.
    if (state.mode && state.mode.onKey && state.mode.onKey(event)) {
      event.preventDefault();
      return;
    }

    const tail = ghostFor(state.value);

    if (event.key === 'Enter') {
      run(state.value);
    } else if (event.key === 'Escape') {
      if (state.mode) exitMode();
      else stopRunning();
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

  // Escape works even when the hidden input has lost focus — after a chip tap,
  // say — so a spinning toy is never stuck on screen.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.activeElement === input) return;
    if (state.mode) exitMode();
    else stopRunning();
  });

  root.addEventListener('click', focus);

  const api = {
    print,
    live,
    enterMode,
    exitMode,
    focus,
    stopRunning,
    isModal: () => state.mode !== null
  };

  const { table, matchers } = createCommands(api);

  print(BOOT_TRANSCRIPT);
  renderPrompt();

  return {
    focus,
    print,
    submit(command) {
      // Chips are tapped, not typed — don't pop a touch keyboard for them.
      const wasFocused = document.activeElement === input;
      state.value = command;
      renderPrompt();
      run(command);
      if (wasFocused) focus();
    },
    key(name) {
      // The mode's own chips, routed through the same path as a real keypress.
      if (name === 'Escape') {
        if (state.mode) exitMode();
        else stopRunning();
        return;
      }
      if (state.mode && state.mode.onKey) state.mode.onKey({ key: name, preventDefault() {} });
    }
  };
}
