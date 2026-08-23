# alekseenko.github.io

Personal site of Andy Aleksieienko — a live `irb` session you can type into.

<https://alekseenko.github.io>

## How it works

The page boots with a short pre-run transcript, then hands you a prompt. There is
one object in the session, `andy`, and every fact about him is a method call on
it — `andy.name`, `andy.position`, `andy.stack`, `andy.photo`. Anything else gets
a real Ruby error back. Start with:

```ruby
andy.methods
```

Tab or → accepts the autosuggestion, ↑/↓ walk the history, and the title bar
toggles light/dark. On phones the keyboard hints are replaced by tappable
command chips.

## Easter egg

```ruby
andy.dance!
```

## Layout

```
index.html                  markup, meta, analytics loader
assets/
  styles/console.css        design tokens + every rule on the page
  scripts/main.js           entry point: wiring, theme, chips, analytics
  scripts/console.js        the irb session — transcript, prompt, history
  scripts/profile.js        content: the command table and boot transcript
  scripts/portrait.js       the ASCII portrait (generated, see below)
  scripts/dancers.js        dance floor roster and placement
  scripts/party.js          the dance overlay
  scripts/analytics.js      Woopra wrapper
  img/, audio/              photo, dancing dog, party music
```

No build step and no dependencies — plain HTML, CSS and ES modules, served as-is
by GitHub Pages.

## Editing the content

Everything a visitor can read lives in `assets/scripts/profile.js`: the boot
transcript, the command table, the links. Adding a method is one entry in
`buildCommands()` plus one line in `COMPLETIONS`.

Adding a dancer is one entry in `ASCII_DANCERS` in `assets/scripts/dancers.js` —
column widths and font sizes are worked out from the art itself.

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
