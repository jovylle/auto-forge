# Echo Garden Oscillator

Plant glowing synths in a garden and strum loops into ambient songs.

## How to open

No build, no server needed. Just open `index.html` in any modern browser
(Chrome / Firefox / Safari) — works from `file://` and from any static host.
For sound, any browser with WebAudio (all modern ones) will do.

## What it does

- **Tap to plant oscillator blooms** — tap empty soil and a flower-bloom synth
  voice pops up, quantized to the current scale row. Pitch runs bottom→top,
  panning runs left→right. Loops auto-start on the first planting.
- **Drag to bend pitch and panning** — grab any bloom and drag it: vertical
  snaps between scale degrees, horizontal bends the stereo pan. Live preview
  while you drag. Arrow keys nudge the selected bloom; double-click (or DIG UP)
  removes it. Up to 12 blooms.
- **Auto-looping polyrhythm sequencer** — every bloom gets its own loop length
  (3–8 steps, adjustable in the inspector via − LOOP / + LOOP). A lookahead
  scheduler fires 16th-note steps, so 4-vs-5-vs-7 patterns phase against each
  other. Blooms flash when they trigger. BPM (60–160), three scales
  (SUNNY / MOODY / STRANGE) and four waveforms included; a STRUM button
  strums the whole garden bottom→top.
- **One-click ambient mix export** — EXPORT MIX re-renders 4 bars plus a
  closing strum through an OfflineAudioContext (with the same dubby feedback
  delay) and downloads `echo-garden-mix.wav`.

Garden + settings persist in `localStorage`, so your patch survives reloads.

## Easter egg

The sun likes attention: click it **5 times** (or type `echo` anywhere) to
unlock **Midnight Garden** mode plus a secret arpeggio.

## Stack

Plain `index.html` + `style.css` + `app.js`. Google Fonts via `@import`
(with monospace fallbacks offline). Neo-brutalist look in exactly 3 colors
(sun yellow `#FFD02F`, bloom pink `#FF6BC1`, leaf teal `#2ED3B7`) plus
ink black and paper white.
