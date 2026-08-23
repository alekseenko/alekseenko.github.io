// Wordle, if the dictionary had been written by a Rails developer. Every guess
// is a word typed at a prompt, which is exactly what this console already is —
// so it needs no key capture and plays identically on a phone.

import { confetti } from '../toys/confetti.js';

const WORDS = [
  'BLOCK', 'YIELD', 'ARRAY', 'RANGE', 'CLASS', 'MIXIN', 'SUPER', 'FIBER',
  'SCOPE', 'CACHE', 'ROUTE', 'MODEL', 'TABLE', 'INDEX', 'MERGE', 'SPLAT',
  'MATCH', 'QUERY', 'STACK', 'DEBUG', 'PATCH', 'ASYNC', 'PARSE', 'RESET',
  'MUTEX', 'QUEUE', 'RAILS', 'GUARD', 'MACRO', 'TOKEN', 'SHELL', 'WHERE',
  'ORDER', 'COUNT', 'LIMIT', 'GROUP', 'FETCH', 'BUILD', 'ERROR', 'VALUE',
  'FIELD', 'SEEDS'
].filter((word) => word.length === 5);

const ROUNDS = 6;

// Standard Wordle scoring, duplicate letters included: exact matches claim their
// letter first, so a second 'S' only goes yellow if the answer has one to spare.
function score(guess, answer) {
  const states = new Array(5).fill('miss');
  const pool = answer.split('');

  for (let i = 0; i < 5; i++) {
    if (guess[i] === pool[i]) {
      states[i] = 'hit';
      pool[i] = null;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (states[i] !== 'miss') continue;
    const at = pool.indexOf(guess[i]);
    if (at >= 0) {
      states[i] = 'near';
      pool[at] = null;
    }
  }
  return states;
}

const tileLine = (guess, states) => ({
  tiles: guess.split('').map((ch, i) => ({ ch, state: states[i] }))
});

export function wordle({ enterMode, print }) {
  const answer = WORDS[Math.floor(Math.random() * WORDS.length)];
  let round = 0;
  let solved = false;

  const mode = {
    label: `wordle(1/${ROUNDS})`,
    onSubmit(raw) {
      const guess = raw.trim().toUpperCase();

      if (guess === 'EXIT' || guess === 'QUIT') return { lines: [], exit: true };

      if (!/^[A-Z]*$/.test(guess)) {
        return [{ text: 'ArgumentError: letters only', kind: 'accent' }];
      }
      if (guess.length !== 5) {
        return [{
          text: `ArgumentError: wrong number of letters (given ${guess.length}, expected 5)`,
          kind: 'accent'
        }];
      }

      round += 1;
      const states = score(guess, answer);
      solved = states.every((state) => state === 'hit');
      mode.label = `wordle(${Math.min(round + 1, ROUNDS)}/${ROUNDS})`;

      const out = [tileLine(guess, states)];

      if (solved) {
        // No recap grid: every guess is still on screen a few lines up.
        confetti();
        out.push({ text: '=> :solved', kind: 'accent' });
        return { lines: out, exit: true };
      }

      if (round >= ROUNDS) {
        out.push({ text: '' });
        out.push({ text: `the word was ${answer}.`, kind: 'dim' });
        out.push({ text: '=> :lost', kind: 'accent' });
        return { lines: out, exit: true };
      }

      return out;
    },
    onExit() {
      // Giving up early still deserves an answer.
      if (solved || round >= ROUNDS) return [{ text: '' }];
      return [{ text: `the word was ${answer}.`, kind: 'dim' }, { text: '=> :abandoned' }, { text: '' }];
    }
  };

  enterMode(mode);

  return [
    { text: `=> #<Wordle rounds: ${ROUNDS}, dictionary: :ruby>` },
    { text: '   five letters, from ruby and rails. type exit to give up.', kind: 'dim' },
    { text: '' }
  ];
}
