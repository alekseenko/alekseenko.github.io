// The single object the whole session revolves around. Every visible fact about
// Andy is reachable as a method call on `andy`.

import { PORTRAIT, PORTRAIT_COLS, PORTRAIT_ROWS } from '../portrait.js';

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

// Where Andy actually is. Everything `andy.local_time` prints derives from this.
export const TIMEZONE = 'Europe/Kyiv';

export const INSPECT = `=> #<Profile id: 1, name: "${NAME}", employed: true>`;
const blank = { text: '' };

// What `andy` actually responds to. The toys live in the global namespace
// instead — they are not facts about a person. `destroy!` goes last, where the
// dangerous method belongs.
export const METHODS = [
  'name', 'position', 'about', 'email', 'socials', 'stack',
  'photo', 'local_time', 'employed?', 'destroy!'
];

// Top-level commands, the way `puts` is top-level.
export const GLOBALS = ['dance!', 'donut', 'coffee', 'matrix', 'wordle', 'snake'];

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
// `andy.destroy!` sits last on purpose — findable, never the first thing Tab
// hands you.
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
  'andy.local_time',
  'andy.inspect',
  'andy.employed?',
  'coffee',
  'dance!',
  'donut',
  'matrix',
  'snake',
  'wordle',
  'help',
  'exit',
  'andy.destroy!'
];

// Ruby's Time#inspect, near enough: "2026-08-23 18:42:07 +0300".
function timeParts(zone) {
  const options = {
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'longOffset'
  };
  if (zone) options.timeZone = zone;

  const found = {};
  for (const part of new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date())) {
    found[part.type] = part.value;
  }
  // "GMT+03:00" -> "+0300"; bare "GMT" means UTC.
  const raw = (found.timeZoneName || 'GMT').replace('GMT', '').replace(':', '');
  found.offset = raw || '+0000';
  // Intl renders midnight as 24 in some locales.
  if (found.hour === '24') found.hour = '00';
  return found;
}

function offsetMinutes(offset) {
  const sign = offset.startsWith('-') ? -1 : 1;
  return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
}

export function formatTime(zone) {
  const t = timeParts(zone);
  return { text: `${t.year}-${t.month}-${t.day} ${t.hour}:${t.minute}:${t.second} ${t.offset}`, offset: t.offset };
}

function localTimeLines() {
  const mine = formatTime(TIMEZONE);
  const yours = formatTime(null);
  const delta = (offsetMinutes(mine.offset) - offsetMinutes(yours.offset)) / 60;

  const out = [{ text: `=> ${mine.text} (${TIMEZONE})` }];
  if (delta) {
    const hours = Math.abs(delta) === 1 ? '1 hour' : `${Math.abs(delta)} hours`;
    out.push({ text: `   # ${hours} ${delta > 0 ? 'ahead of' : 'behind'} you`, kind: 'dim' });
  }
  out.push(blank);
  return out;
}

export function profileCommands() {
  return {
    'andy': () => [{ text: INSPECT }, blank],
    'andy = profile.first': () => [{ text: INSPECT }, blank],
    'andy.methods': () => [
      { text: `=> [${METHODS.map((m) => `:${m}`).join(', ')}]`, kind: 'accent' },
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
    'andy.local_time': localTimeLines,
    'andy.photo': () => [
      { text: PORTRAIT, art: true },
      { text: `=> #<Portrait ${PORTRAIT_COLS}x${PORTRAIT_ROWS} chars>`, kind: 'dim' },
      blank
    ],
    'andy.inspect': () => [
      { text: `=> #<Profile id: 1, name: "${NAME}", employed: true,` },
      { text: `     position: "${POSITION}">`, link: 'Storylane', href: LINKS.storylane },
      blank
    ],
    'help': () => [
      { text: 'this is irb, not bash. every answer is a method call:', kind: 'dim' },
      { text: '  andy.methods', kind: 'accent' },
      { text: 'expressions work too — try 2 + 2, or andy.stack.sample.', kind: 'dim' },
      { text: 'and a few things live at the top level:', kind: 'dim' },
      { text: `  ${GLOBALS.join('  ')}`, kind: 'accent' },
      blank
    ],
    'exit': () => [{ text: "you can't exit. this is the whole website.", kind: 'dim' }, blank]
  };
}
