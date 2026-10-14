# ◈ Magpie Voltage Chapel

A keyboard-only generative voltage liturgy in a sci-fi-terminal chapel.
A choir of four oscillator voices (Cantor, Magpie, Relic, Surge) sings a
16-step sequencer loop while a magpie spirit steals shiny notes and drifts
the pattern each canonical hour. Chapel time runs fast: every loop is one hour
(Vigils → Lauds → … → Compline).

## How to open

No build, no server needed — works from `file://` and any static host:

1. Open `index.html` in a browser (double-click, or `python3 -m http.server` + visit the URL).
2. Press `?` for the full key canon, `T` to start the liturgy.
3. Sound starts on first keypress (browsers require a gesture).

Google Fonts are `@import`ed with monospace fallbacks, so offline still looks right.

## What it does

- **Core interaction** — 4×16 candle grid sequencer with WebAudio choir
  (sine/triangle/saw/square + chapel echo + live oscilloscope). Arrows/HJKL
  move, `space` lights/snuffs candles, `1–4` mute voices, `T` plays,
  `B` tolls the bell, `G`/`V`/`X` generate/mutate/steal, `F` euclidean fill,
  `C` clear, `M` generative drift, `[`/`]` tempo, `5/6/7` preset psalms,
  `0` panic. `N` jumps between voice rows.
- **Polished UI** — phosphor-terminal aesthetic: CRT scanlines, boot sequence,
  glowing candles, playhead pulse, voltage scope, grid-charge meter, chapel
  log (aria-live), canonical-hour clock, help dialog.
- **Share/export** — `E` downloads the liturgy as JSON, `Y` copies a shareable
  link (full state encoded in the URL hash — opening it restores the liturgy),
  `L` copies the liturgy as ASCII text. Autosaves to `localStorage`.

## Constraint

**Keyboard only**: every control is a real button/silder reachable by `Tab`,
the grid uses roving tabindex with arrow-key navigation, all actions have
single-key shortcuts, focus is always visible, and the log announces events
via `aria-live`. No mouse required for anything.

## Files

- `index.html` — structure (toolbar, grid, scope, log, help dialog)
- `style.css` — sci-fi-terminal theme, responsive down to 375px
- `app.js` — sequencer, WebAudio engine, generative magpie, share/export
