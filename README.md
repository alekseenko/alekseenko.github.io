# alekseenko.github.io

Personal site of Andy Aleksieienko — a live `irb` session you can type into.

<https://alekseenko.github.io>

## How it works

The page boots into a Ruby-flavored terminal. There's one object in the
session, `andy`, and every fact about him is a method call on it —
`andy.name`, `andy.position`, `andy.socials`, `andy.photo`. Start with:

```ruby
andy.methods
```

Plain expressions work too (`2 + 2`, `andy.name.upcase.reverse`,
`RUBY_VERSION`), and there's a handful of hidden top-level commands to find —
type `help` for a nudge. Tab-completes, ↑/↓ walks history, and the title bar
toggles light/dark.

No build step, no dependencies, no analytics — plain HTML, CSS and ES modules,
served as-is by GitHub Pages.

## Running it locally

ES modules need a real origin, so open it over HTTP rather than from the
filesystem:

```sh
python3 -m http.server 8000
```
