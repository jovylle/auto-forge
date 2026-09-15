# Ligature Lagoon ⚙🌊

> Toss letters into a brass-bound lagoon where currents kern, collide and bloom.

A steampunk kinetic-typography toy: floating brass plaques drift on a simulated tide. Stir the water, fling letters at each other, and hard collisions fuse pairs into real ligature glyphs (ﬁ ﬂ ﬀ ﬃ ﬄ ﬆ æ œ ß þ …) with a burst of sparks.

## How to open

No build, no backend. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder → http://localhost:8000

## What it does

- **Drag to stir currents** — drag fast across the water to whip up vortices; grab a single letter to fling it.
- **Kinetic collisions form ligatures** — 14 fusable pairs/triples (`fi fl ff ffi ffl ft st ct ae oe AE OE ss th`). Blooms flash on canvas, collect in the Bloom Cabinet, and are logged in the Captain's Log.
- **Variable-font tide controls** — tide level (also auto-pulled by the moon), current strength, weight (`wght`), bloat (`opsz`), slant. Tide moves the waterline and buoyancy; letters bob and kern live. Built on the variable font **Fraunces**.
- **Export poster as PNG** — renders a 1600×2240 brass-framed poster (lagoon snapshot + bloom cabinet + settings) and downloads it.
- Extras: type anywhere to toss letters, `space` splashes a random word, pressure gauge sim, progress persists in `localStorage`.
- **Easter egg** 🦑: type `kraken` or triple-click the pressure gauge to wake the Kraken — a tentacled maelstrom that drags every letter into a vortex.

## Files

`index.html` · `style.css` · `app.js` — Google Fonts via `@import` (Rye, IM Fell English, Fraunces). Everything else is vanilla canvas.
