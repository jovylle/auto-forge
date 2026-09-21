# Tape Loop Garden

A steampunk ambient conservatory. Overgrown tape loops you plant, prune, and crossfade into ambient rhythms — all synthesized live with WebAudio, no samples.

## How to open

No build step. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically, e.g. `python3 -m http.server` in this folder, then open the printed URL.

Best in Chrome/Firefox (uses `MediaRecorder` + `StereoPanner`).

## What it does

- **Plant draggable loop seeds** — tap a seed in the tray to plant it wild, or drag it onto the soil to place it. Four species: Bass Reel, Chime Spool, Hiss Valve, Piston Drum, each with its own synthesis voice and 16-step rhythm.
- **Drag stems to pitch and pan** — drag a plant: vertical position bends pitch (±12 semitones), horizontal sets stereo pan. Tag shows `name ±st · L/C/R`. Tap a reel to mute, double-tap (or ✕) to prune.
- **Rain mode** — “Summon Rain” mutates a random plant’s rhythm every chorus (plus occasional transposition), with a rain overlay on the bed.
- **One-tap mix record and share** — “Engrave Mix” records the master bus via `MediaRecorder`; stop to listen, download the `.webm` cylinder, share via Web Share (or clipboard), or copy a garden link (`#g=…`) that rebuilds the exact garden on open.

Plus: tempo / A⇄B crossfade / delay (“aether”) console, boiler-pressure gauge + master filter driven by **scroll** (the hard constraint), Gardener’s Chronicle entries that reveal on scroll, live 16-step notation grid, and `localStorage` persistence.

## Layout

- `index.html` — structure (tray, bed, console, chronicle)
- `style.css` — steampunk brass/parchment theme (Google Fonts via `@import`: Rye, IM Fell English, Special Elite)
- `app.js` — audio engine, sequencer, drag/drop, rain, record/share, scroll FX
