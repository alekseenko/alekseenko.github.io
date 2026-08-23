// Everything the prompt can answer to, composed in one place: the profile
// itself, the Ruby evaluator, the toys, the games, and the one command that
// ends the session for good.

import { profileCommands } from './profile.js';
import { rubyMatchers } from './ruby.js';
import { createDestroy } from './destroy.js';
import { createParty } from '../toys/party.js';
import { createMatrix } from '../toys/matrix.js';
import { donut } from '../toys/donut.js';
import { coffee } from '../toys/coffee.js';
import { wordle } from '../games/wordle.js';
import { snake } from '../games/snake.js';
import { track } from '../analytics.js';

export function buildCommands(api) {
  const party = createParty({
    onStart: () => track('easter_egg_found', { egg: 'dance' }),
    onStop: () => api.focus()
  });

  const matrix = createMatrix({ onStop: () => api.focus() });

  const destroy = createDestroy({
    onKill: () => {
      party.stop();
      matrix.stop();
      api.stopRunning();
    }
  });

  // Every undocumented command reports itself, so it is possible to tell which
  // ones anyone actually finds.
  const egg = (name, run) => () => {
    track('easter_egg_found', { egg: name });
    return run(api);
  };

  // The toys and games are top-level commands, the way `puts` is top-level:
  // they are things you can do here, not facts about a person. Only `destroy!`
  // hangs off `andy`, because destroying a record is exactly an instance method.
  const globals = {
    'dance!': egg('dance', () => {
      party.start();
      return [{ text: '=> :dancing', kind: 'accent' }, { text: '' }];
    }),
    'donut': egg('donut', donut),
    'coffee': egg('coffee', coffee),
    'matrix': egg('matrix', () => {
      matrix.start();
      return [{ text: '=> :wake_up', kind: 'accent' }, { text: '' }];
    }),
    'wordle': egg('wordle', wordle),
    'snake': egg('snake', snake)
  };

  const table = {
    ...profileCommands(),
    ...globals,

    'andy.destroy!': egg('destroy', destroy),
    'andy.destroy': egg('destroy', destroy)
  };

  // Undocumented aliases, so a visitor who guesses `andy.donut` — or who
  // remembers `andy.dance!` from the old site — is not told they are wrong.
  for (const [name, run] of Object.entries(globals)) table[`andy.${name}`] = run;

  return { table, matchers: rubyMatchers() };
}
