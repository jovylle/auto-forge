# Brine Clock

> A tide timer that breathes with the sea.

A biomorphic timepiece for coastal rhythm. It reads the lunar tide in real time, paces your breathing to a tidal cadence, and rings the harbor on the ship's bell schedule — all drawn live with canvas and CSS, no images.

## Features

- **Tide dial** — An organic, breathing dial driven by a synthetic lunar tide model (M2 + S2 + K1 constituents). The pool fills and drains with the tide, foam bubbles rise, and a coral fin-hand sweeps one full cycle per M2 period. Live flood/ebb chevrons, next high/low countdowns, and a height readout in meters.
- **Breath sync** — A jelly-like breathing orb that swells on the inhale and sinks on the exhale. Adjust the cadence (4–12 breaths/min); the pacer counts your breaths and labels each phase.
- **Harbor bell** — A CSS-drawn bell that rings the traditional watch schedule (1–8 bells per half-hour watch, including the split dog watches). Synthesized bell tones via the Web Audio API (no audio files), with a manual "Ring now" and a sound toggle.

## Constraint

No images — all visuals are CSS, gradients, and canvas.

## Stack

Vite + TypeScript + Tailwind CSS v4. Local preferences (cadence, sound) persist in `localStorage` under `brine-clock`.

## Develop / Build

```bash
npm run dev      # dev server
npm run build    # production build → dist/
npm run preview  # serve the build
```

The Vite config uses `base: './'` so the build serves correctly from any subpath.