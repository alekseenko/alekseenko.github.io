// The single object the whole session revolves around. Every visible fact about
// Andy is reachable as a method call on `andy`.

import { PORTRAIT, PORTRAIT_COLS, PORTRAIT_ROWS } from './portrait.js';

export const LINKS = {
  storylane: 'https://storylane.io',
  github: 'https://github.com/alekseenko',
  linkedin: 'https://www.linkedin.com/in/alekseenkoandy',
  email: 'mailto:mailto.alekseenko@gmail.com'
};

export const NAME = 'Andy Aleksieienko';
export const POSITION = 'Ruby on Rails developer at Storylane';
export const ABOUT = 'Strong web developer with great communication and teamwork skills';
export const EMAIL = 'mailto.alekseenko@gmail.com';
export const STACK = ['Ruby', 'Rails', 'PostgreSQL', 'Hotwire', 'Sidekiq', 'JavaScript'];

const INSPECT = `=> #<Profile id: 1, name: "${NAME}", employed: true>`;
const blank = { text: '' };

// The transcript already on screen when the page boots, so a visitor who never
// types anything still learns who this is. Statements 001 and 002 are spent here.
export const BOOT_TRANSCRIPT = [
  { text: 'Loading personal environment... (Rails 7.2)', kind: 'dim' },
  blank,
  { text: 'irb(main):001:0> andy = Profile.first', kind: 'in' },
  { text: INSPECT },
  blank,
  { text: 'irb(main):002:0> andy.position', kind: 'in' },
  { text: `=> "${POSITION}"`, link: 'Storylane', href: LINKS.storylane },
  blank,
  { text: '# everything here is a real method call. start with andy.methods', kind: 'dim' },
  blank
];

export const BOOT_HISTORY = ['andy.position', 'andy = Profile.first'];
export const FIRST_STATEMENT = 3;

// Commands offered by the autosuggestion, in match priority order. Deliberately
// excludes the `andy = Profile.first` alias: it is recognised when typed, but
// completing a bare `an` into an assignment is not what anyone wants.
export const COMPLETIONS = [
  'andy',
  'andy.name',
  'andy.about',
  'andy.email',
  'andy.methods',
  'andy.position',
  'andy.socials',
  'andy.stack',
  'andy.photo',
  'andy.inspect',
  'andy.employed?',
  'andy.dance!',
  'help',
  'exit'
];

// Keys are normalized input (see normalize()); values produce transcript lines.
// `dance` is the odd one out — it has a side effect, handed in by the console.
export function buildCommands({ startParty }) {
  return {
    'andy': () => [{ text: INSPECT }, blank],
    'andy = profile.first': () => [{ text: INSPECT }, blank],
    'andy.methods': () => [
      { text: '=> [:name, :position, :about, :email, :socials, :stack, :photo, :employed?, :dance!]', kind: 'accent' },
      blank
    ],
    'andy.name': () => [{ text: `=> "${NAME}"` }, blank],
    'andy.position': () => [{ text: `=> "${POSITION}"`, link: 'Storylane', href: LINKS.storylane }, blank],
    'andy.about': () => [{ text: `=> "${ABOUT}"` }, blank],
    'andy.email': () => [{ text: `=> "${EMAIL}"`, link: EMAIL, href: LINKS.email }, blank],
    'andy.socials': () => [
      { text: '=> { github: "github.com/alekseenko",', link: 'github.com/alekseenko', href: LINKS.github },
      { text: '     linkedin: "linkedin.com/in/alekseenkoandy" }', link: 'linkedin.com/in/alekseenkoandy', href: LINKS.linkedin },
      blank
    ],
    'andy.stack': () => [{ text: `=> [${STACK.map((s) => `"${s}"`).join(', ')}]` }, blank],
    'andy.employed?': () => [{ text: '=> true', kind: 'accent' }, blank],
    'andy.photo': () => [
      { text: PORTRAIT, art: true },
      { text: `=> #<Portrait ${PORTRAIT_COLS}x${PORTRAIT_ROWS} chars>`, kind: 'dim' },
      blank
    ],
    'andy.dance!': () => {
      startParty();
      return [{ text: '=> :dancing', kind: 'accent' }, blank];
    },
    'andy.inspect': () => [
      { text: `=> #<Profile id: 1, name: "${NAME}", employed: true,` },
      { text: `     position: "${POSITION}">`, link: 'Storylane', href: LINKS.storylane },
      blank
    ],
    'help': () => [
      { text: 'this is irb, not bash. every answer is a method call:', kind: 'dim' },
      { text: '  andy.methods', kind: 'accent' },
      blank
    ],
    'exit': () => [{ text: "you can't exit. this is the whole website.", kind: 'dim' }, blank]
  };
}
