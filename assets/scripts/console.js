// The irb session itself: transcript, prompt, history, autosuggestion — plus the
// two extension points everything else is built on. `live()` hands a command a
// line it can redraw in place, and `enterMode()` lets a game borrow the prompt
// the way a real irb sub-session would.

import { BOOT_TRANSCRIPT, BOOT_HISTORY, FIRST_STATEMENT, COMPLETIONS } from './commands/profile.js';

const promptFor = (n) => `irb(main):${String(n).padStart(3, '0')}:0>`;

// The command table is a plain object, so `table[input]` alone would match
// `constructor` and every other Object.prototype member — silently running a
// JavaScript builtin instead of reporting an unknown method.
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function createConsole({
  root, transcript, lines, input, promptRow, promptLabel, typed, caret, after, ghost,
  createCommands, onModeChange
}) {
  // `pos` is the caret; `anchor` is the other end of a selection, equal to
  // `pos` when there is none. Both mirror the hidden input rather than replace
  // it — the input still does the actual editing, so word jumps, double-click
  // selection and the platform's own emacs bindings keep working, and the
  // painted line just follows wherever it left the caret.
  const state = {
    n: FIRST_STATEMENT,
    value: '',
    pos: 0,
    anchor: 0,
    draft: '',
    hist: BOOT_HISTORY.slice(),
    histIdx: -1,
    mode: null
  };

  // Animations currently redrawing a line. Escape, or simply running the next
  // command, stops them all — a toy must never outlive the prompt that spawned it.
  const running = new Set();

  const labelFor = () => (state.mode ? `${state.mode.label}>` : promptFor(state.n));

  // Whether a redrawing line may keep the view at the bottom. It is a latch, not
  // a distance test: a tolerance band would re-pin on every small scroll step,
  // so scrolling up slowly could never escape it — each notch would be undone by
  // the next frame. Scrolling up at all lets go; returning to the bottom takes
  // hold again.
  let following = true;

  transcript.addEventListener('scroll', () => {
    following = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <= 2;
  });

  // Submitting always returns to the bottom, whatever the reader was looking at.
  function scrollToBottom() {
    following = true;
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
    if (line.art) {
      node.classList.add('line--art');
      // The transcript is an aria-live log; announcing three thousand punctuation
      // marks helps nobody. The `#<Portrait …>` line beneath is the description.
      node.setAttribute('aria-hidden', 'true');
    }

    // Wordle scoring: one span per letter, coloured by how well it matched.
    // Colour is the whole message, so the row carries it in words as well.
    if (line.tiles) {
      node.classList.add('line--tiles');
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', line.tiles
        .map((tile) => `${tile.ch} ${{ hit: 'correct', near: 'wrong place', miss: 'not in word' }[tile.state]}`)
        .join(', '));
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
  // A persistent line is left out of `running`, so neither Escape nor the next
  // command stops it — that is how a printed toy keeps going while you type.
  function live({ kind = 'art', persistent = false, announce = false } = {}) {
    const node = document.createElement('div');
    node.className = `line line--${kind}`;
    // A line that redraws itself 24 times a second inside an aria-live region
    // would be read aloud 24 times a second. The return value below it says
    // everything a screen reader needs. A menu is the exception: it repaints
    // once per keypress, and what it says is the whole point.
    if (!announce) node.setAttribute('aria-hidden', 'true');
    lines.appendChild(node);
    scrollToBottom();

    const handle = {
      onEnd: null,
      update(text) {
        node.textContent = text;
        if (following) transcript.scrollTop = transcript.scrollHeight;
      },
      // Same line, repainted from line objects instead of a string — for a
      // block that redraws but still needs colour, links or tiles inside it.
      // The permission menu is one: only the highlighted row changes.
      render(newLines) {
        node.replaceChildren(...newLines.map(renderLine));
        if (following) transcript.scrollTop = transcript.scrollHeight;
      },
      end() {
        if (!running.has(handle)) return;
        running.delete(handle);
        if (handle.onEnd) handle.onEnd();
      }
    };

    if (!persistent) running.add(handle);
    return handle;
  }

  function stopRunning() {
    const stopped = running.size > 0;
    for (const handle of Array.from(running)) handle.end();
    return stopped;
  }

  function enterMode(spec) {
    // Never stack modes: whatever was holding the prompt gets its onExit run, so
    // a game cannot leave a timer or a listener behind when another takes over.
    if (state.mode) exitMode();
    state.mode = spec;
    setValue('');
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
    setValue('');
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
    if (value && !value.startsWith('andy') && !['help', 'exit'].includes(value) && has(table, `andy.${value}`)) {
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

  // Nothing is suggested mid-line: a completion appended to text the caret is
  // standing in front of would be a suggestion for a line nobody is typing.
  function ghostFor(value) {
    if (state.mode || !value.trim()) return '';
    if (state.pos !== value.length || state.anchor !== state.pos) return '';
    const lower = value.toLowerCase();
    const hit = COMPLETIONS.find((command) => command.startsWith(lower) && command !== lower);
    return hit ? hit.slice(value.length) : '';
  }

  // Set the line programmatically — history, completion, a kill. The caret goes
  // where told (end of the line by default) and any selection collapses onto it.
  function setValue(value, pos = value.length) {
    state.value = value;
    state.pos = Math.max(0, Math.min(pos, value.length));
    state.anchor = state.pos;
  }

  function renderPrompt() {
    const value = state.value;
    const tail = ghostFor(value);
    const from = Math.min(state.pos, state.anchor);
    const to = Math.max(state.pos, state.anchor);

    promptLabel.textContent = labelFor();

    // A mode that asks its question as a menu has no use for a command line:
    // a caret blinking under the options only invites typing that goes nowhere.
    // The row is collapsed rather than removed — the input inside it is still
    // the thing receiving every keystroke, and `display: none` cannot be focused.
    promptRow.classList.toggle('prompt--silent', Boolean(state.mode && state.mode.silent));

    // The caret is a block sitting *on* a character, the way a terminal's is —
    // and a selection is the same block widened, which is exactly how reverse
    // video renders one. So both are the same element.
    if (to > from) {
      typed.textContent = value.slice(0, from);
      caret.textContent = value.slice(from, to);
      after.textContent = value.slice(to);
      ghost.textContent = '';
      caret.classList.remove('is-blinking');
    } else {
      typed.textContent = value.slice(0, from);
      // At the end of the line the block holds the first character of the
      // suggestion, or a space when there is nothing to suggest.
      caret.textContent = from < value.length ? value[from] : (tail ? tail[0] : ' ');
      after.textContent = from < value.length ? value.slice(from + 1) : '';
      ghost.textContent = tail ? tail.slice(1) : '';
      caret.classList.toggle('is-blinking', !tail);
    }

    // Assigning `value` drops the input's own selection, so the caret has to be
    // restored after it — and only when it actually moved, or the assignment
    // would fight the user's in-progress drag.
    if (input.value !== value) input.value = value;
    if (input.selectionStart !== from || input.selectionEnd !== to) {
      input.setSelectionRange(from, to, state.pos < state.anchor ? 'backward' : 'forward');
    }
  }

  // Resolution order: exact command, then the argument-taking matchers, then
  // the console's own Ruby error. Matchers are ordered and may decline by
  // returning null, which is how the evaluator hands unparseable input back.
  function dispatch(raw) {
    const key = normalize(raw);
    if (has(table, key)) return table[key]() || [];

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
      setValue('');
      state.histIdx = -1;
      if (raw.trim()) state.hist.unshift(raw);
      const result = mode.onSubmit(raw) || [];
      const out = Array.isArray(result) ? result : (result.lines || []);
      // A menu answers Enter by repainting the choice it already shows, so
      // echoing the empty line the reader submitted would only add a stray
      // prompt above it.
      print(mode.echo === false ? out : [echo].concat(out));
      if (!Array.isArray(result) && result.exit) exitMode();
      else renderPrompt();
      scrollToBottom();
      return;
    }

    state.n += 1;
    setValue('');
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
  }

  // Ctrl+C, as a terminal means it: abandon whatever is on the prompt — a
  // half-typed line, a spinning toy, a game holding the session — and hand back
  // a clean one. It never runs anything, and the `^C` stays in the transcript
  // so the abandoned line is still part of the record.
  function interrupt() {
    const inMode = state.mode !== null;
    // A silent mode has no visible prompt to interrupt, so the `^C` stands
    // alone rather than introducing a line the reader never saw.
    const line = state.mode && state.mode.silent ? '^C' : `${labelFor()} ${state.value}^C`;
    print([{ text: line, kind: 'in' }]);
    stopRunning();
    if (inMode) {
      exitMode();
      return;
    }
    // irb re-prompts with the same statement number: nothing was evaluated.
    setValue('');
    state.draft = '';
    state.histIdx = -1;
    renderPrompt();
    scrollToBottom();
  }

  function focus() {
    // Without this guard every click steals focus and collapses the selection,
    // making the transcript impossible to copy.
    const selection = window.getSelection();
    if (selection && String(selection).length) return;
    input.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => {
    syncCaret();
    renderPrompt();
  });

  // Where the input left the caret. `selectionDirection` says which end the
  // user is dragging, and that end is the caret — extending a selection
  // leftwards has to paint the block growing leftwards too.
  function syncCaret() {
    // The value comes along for the ride. Every caller is about to paint from
    // `state`, and painting a stale value would write it straight back into the
    // input — silently undoing anything the input knows and this does not yet.
    state.value = input.value;
    const backward = input.selectionDirection === 'backward';
    const start = input.selectionStart ?? state.value.length;
    const end = input.selectionEnd ?? start;
    state.pos = backward ? start : end;
    state.anchor = backward ? end : start;
  }

  // Arrow keys, Home/End, word jumps, a click into the middle of the line, a
  // drag across it: all of them are the input's job, and all of them surface
  // here. Painting on `selectionchange` rather than on a list of keys is what
  // keeps the block caret honest for keystrokes this file never enumerates.
  document.addEventListener('selectionchange', () => {
    if (document.activeElement !== input) return;
    const before = `${state.pos}:${state.anchor}:${state.value}`;
    syncCaret();
    if (`${state.pos}:${state.anchor}:${state.value}` !== before) renderPrompt();
  });

  input.addEventListener('keydown', (event) => {
    // A game gets first refusal on every key — that is how Snake reads arrows
    // without the prompt also treating them as history navigation.
    if (state.mode && state.mode.onKey && state.mode.onKey(event)) {
      event.preventDefault();
      return;
    }

    // `selectionchange` is delivered a task late, so after an arrow key the
    // cached caret can still be one keystroke behind when the next one arrives.
    // Reading the input directly here is what makes a kill land where the
    // caret actually is rather than where it was.
    syncCaret();
    const tail = ghostFor(state.value);
    const at = Math.min(state.pos, state.anchor);
    const to = Math.max(state.pos, state.anchor);

    // The readline bindings a terminal answers to. Ctrl and not Meta: on macOS
    // Cmd+A/Cmd+C belong to the browser, and taking them would break selecting
    // and copying the transcript.
    if (event.ctrlKey && !event.metaKey && !event.altKey) {
      const kill = event.key.toLowerCase();
      if (kill === 'c') {
        // On Windows and Linux this is also the copy shortcut, and a terminal
        // resolves the clash the same way: with something selected it copies,
        // and only an empty selection interrupts.
        const selection = window.getSelection();
        if (to > at || (selection && String(selection).length)) return;
        event.preventDefault();
        interrupt();
        return;
      }
      if (kill === 'u') {
        // Kill to the start of the line.
        event.preventDefault();
        setValue(state.value.slice(to), 0);
        renderPrompt();
        return;
      }
      if (kill === 'k') {
        // Kill to the end of the line.
        event.preventDefault();
        setValue(state.value.slice(0, at), at);
        renderPrompt();
        return;
      }
      if (kill === 'w') {
        // Kill the word behind the caret, and the whitespace before it.
        event.preventDefault();
        const head = state.value.slice(0, at).replace(/\s*\S*$/, '');
        setValue(head + state.value.slice(to), head.length);
        renderPrompt();
        return;
      }
      if (kill === 'l') {
        // Clear the screen, keeping the line you were typing — as `clear` does.
        event.preventDefault();
        lines.replaceChildren();
        scrollToBottom();
        return;
      }
    }

    if (event.key === 'Enter') {
      run(state.value);
    } else if (event.key === 'Escape') {
      if (state.mode) exitMode();
      else stopRunning();
    } else if (event.key === 'Tab') {
      // Always swallow Tab, whether or not there is a suggestion to accept.
      // Letting it through with nothing to complete used to hand focus to the
      // browser chrome (the URL bar) since nothing else on the page sits after
      // the input in tab order — jarring for a console you are meant to keep
      // typing into. Clicking anywhere on the page refocuses it anyway, so
      // nothing reachable is lost by keeping Tab local to the prompt.
      event.preventDefault();
      if (tail) {
        setValue(state.value + tail);
        renderPrompt();
      }
    } else if (event.key === 'ArrowRight' && tail) {
      // Only ever true at the end of the line, where there is no character to
      // step onto — everywhere else the arrow moves the caret, as it should.
      event.preventDefault();
      setValue(state.value + tail);
      renderPrompt();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(state.histIdx + 1, state.hist.length - 1);
      if (next < 0 || next === state.histIdx) return;
      if (state.histIdx === -1) state.draft = state.value;
      state.histIdx = next;
      setValue(state.hist[next]);
      renderPrompt();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (state.histIdx <= -1) return;
      state.histIdx -= 1;
      setValue(state.histIdx >= 0 ? state.hist[state.histIdx] : state.draft);
      renderPrompt();
    }
  });

  // Escape and Ctrl+C work even when the hidden input has lost focus — after a
  // chip tap, say — so a spinning toy is never stuck on screen.
  document.addEventListener('keydown', (event) => {
    if (document.activeElement === input) return;
    if (event.key === 'Escape') {
      if (state.mode) exitMode();
      else stopRunning();
      return;
    }
    // Not when something is selected: that is a copy on Linux and Windows.
    if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c') {
      const selection = window.getSelection();
      if (selection && String(selection).length) return;
      event.preventDefault();
      interrupt();
    }
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
      setValue(command);
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
      // A menu's confirm chip submits the line, exactly as Enter would.
      if (name === 'Enter') {
        run(state.value);
        return;
      }
      if (state.mode && state.mode.onKey) state.mode.onKey({ key: name, preventDefault() {} });
    }
  };
}
