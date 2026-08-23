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

  const table = {
    ...profileCommands({ startParty: () => party.start() }),

    'andy.donut': egg('donut', donut),
    'andy.coffee': egg('coffee', coffee),
    'andy.matrix': egg('matrix', () => {
      matrix.start();
      return [{ text: '=> :wake_up', kind: 'accent' }, { text: '' }];
    }),

    'andy.wordle': egg('wordle', wordle),
    'andy.snake': egg('snake', snake),

    'andy.destroy!': egg('destroy', destroy),
    'andy.destroy': egg('destroy', destroy)
  };

  return { table, matchers: rubyMatchers() };
}
