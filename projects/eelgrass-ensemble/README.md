# Eelgrass Ensemble

Conduct an underwater grass band. Glassmorphism lagoon, all sound synthesized live with WebAudio — no samples, no backend.

## How to open

Just open `index.html` in a browser (works from `file://`), or serve the folder statically:

```sh
cd projects/eelgrass-ensemble
python3 -m http.server 8080
# → http://localhost:8080
```

Press **Play** (sound starts on first tap — browsers require a gesture).

## What it does

- **01 · Tide baton** — drag across the lagoon to conduct. Side-to-side motion sets tempo (60–160 bpm, also via slider); depth (up/down) sets the tide swell, which drives filter LFO and blade sway. A glowing baton with a sparkle trail follows your pointer. Tap a blade to mute/unmute it, double-tap to pluck a solo note.
- **02 · Grass voices** — eight eelgrass blades, each a voice on a C-major pentatonic reef (C4–E5). Each blade runs its own rhythmic cycle so the meadow feels alive; buttons pulse as notes fire. Canvas blades sway with the tide and flash coral when sounding.
- **03 · Reef mix** — Depth (low-pass filter), Current (echo drift), Glow (master volume), plus three presets: Lagoon, Storm surge, Night reef. Everything persists to `localStorage` and returns on reload.

Space toggles play/pause. Layout stacks cleanly at 375px.

## Palette (3 colors + black/white)

teal `#0e7c7b` · seafoam `#7ef0c1` · coral `#ff8a5c` · black `#04181d`/black · white
