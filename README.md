# alekseenko.github.io

Personal site of Andy Aleksieienko — a live `irb` session you can type into.

<https://alekseenko.github.io>

## How it works

The page boots with a short pre-run transcript, then hands you a prompt. There is
one object in the session, `andy`, and every fact about him is a method call on
it — `andy.name`, `andy.position`, `andy.socials`, `andy.photo`. Start with:

```ruby
andy.methods
```

Expressions work too. A small hand-written evaluator (no `eval`) covers
arithmetic with Ruby's integer division, string and array methods, method
chaining, `puts`, and a handful of constants:

```ruby
2 + 2                        # => 4
10 / 3                       # => 3
andy.name.upcase.reverse     # => "OKNEIEISKELA YDNA"
andy.methods.grep(/time/)    # => [:local_time]
RUBY_VERSION                 # => "3.4.1"
1 / 0                        # ZeroDivisionError: divided by 0
```

Anything it cannot make sense of gets a real Ruby error back, not
"command not found".

Tab or → accepts the autosuggestion, ↑/↓ walk the history, and the title bar
toggles light/dark. On phones the keyboard hints are replaced by tappable
command chips.

## Toys and games

These live at the top level, the way `puts` does — they are things you can do
here, not facts about a person:

| | |
|---|---|
| `dance!` | the original easter egg: dancers, strobes, music |
| `donut`  | the spinning ASCII torus, printed into the transcript |
| `coffee` | a mug with rising steam |
| `matrix` | full-viewport digital rain |
| `wordle` | six guesses at a five-letter Ruby word |
| `snake`  | arrows or WASD; arrow chips and swipes on touch |

`donut` and `coffee` are printed output — they keep animating while you carry on
typing. `dance!` and `matrix` are overlays, dismissed with Escape.

The party music ships twice, as Opus (`dance.webm`) and MP3, and `party.js` picks
whichever the browser reports it can play. Nothing is fetched until somebody
actually dances.

And one method on `andy` that is not like the others:

```ruby
andy.destroy!
```

The first call is a warning. The second ends the session — the screen powers off
like a CRT and stays off until you reload. (Nothing calls `window.close()`:
browsers ignore it for any tab the page did not open.)

## Layout

```
index.html                  markup, meta, no-JS fallback styles
assets/
  styles/console.css        design tokens + every rule on the page
  scripts/main.js           entry point: wiring, theme, chips
  scripts/console.js        the irb session — transcript, prompt, history, modes
  scripts/portrait.js       the ASCII portrait (generated, see below)
  scripts/commands/
    index.js                composes the command table and the matchers
    profile.js              content: the facts, boot transcript, completions
    ruby.js                 the expression evaluator
    destroy.js              andy.destroy!
  scripts/toys/
    party.js, dancers.js    the dance overlay and its performers
    donut.js, coffee.js     printed animations
    matrix.js               canvas digital rain
    confetti.js             fired when the wordle is solved
  scripts/games/
    wordle.js, snake.js
  img/, audio/              photo, favicon, dancing dog, party music
```

No build step, no dependencies and no analytics — plain HTML, CSS and ES
modules, served as-is by GitHub Pages. The only third-party request the page
makes is to Google Fonts for JetBrains Mono.

## Extending it

`assets/scripts/console.js` provides three extension points, and everything else
is built on them:

- **`print(lines)`** — append transcript lines. A line is
  `{ text, kind?, link?, href?, art?, tiles? }`.
- **`live({ kind, persistent })`** — claim one line and redraw it in place.
  Persistent lines are never stopped by Escape or the next command.
- **`enterMode(spec)`** — borrow the prompt, the way an irb sub-session does.
  A spec carries `{ label, chips?, onSubmit, onKey?, onExit? }`.

A new command is one entry in the table in `assets/scripts/commands/index.js`,
plus one line in `COMPLETIONS` in `commands/profile.js` if it should be
suggested. Commands taking arguments go in the matcher list instead.

Everything a visitor can read lives in `commands/profile.js` — including
`TIMEZONE`, which is what `andy.local_time` reports.

Adding a dancer is one entry in `ASCII_DANCERS` in `assets/scripts/toys/dancers.js`
— column widths and font sizes are worked out from the art itself.

## Regenerating the ASCII portrait

`assets/scripts/portrait.js` is generated from `assets/img/photo.jpg`: downsample
to 64×49, map luminance through the ramp `" .:-=+*#%@"` (space = lightest), clip
to the 3rd and 98th percentile, apply a 1.25 gamma. Character cells are ~1.9×
taller than wide, so sample the crop at roughly half the aspect you want on
screen.

## Running it locally

ES modules need a real origin, so open it over HTTP rather than from the
filesystem:

```sh
python3 -m http.server 8000
```
