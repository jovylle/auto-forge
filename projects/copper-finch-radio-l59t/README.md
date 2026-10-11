# Copper Finch Radio

Trade dawn choruses with fellow finches. A biomorphic single-file-ish web experiment — no build, no backend, works from `file://` or any static host.

## How to open

Open `index.html` in any modern browser (double-click it, or serve the folder: `python3 -m http.server` then visit `http://localhost:8000`). No install, no network needed. Sound requires one click anywhere first (browser autoplay policy).

## What it does

- **01 · Dawn dial** — Drag the moss knob (or slide the reed) across 4:00→8:00. Time drives a generative WebAudio dawn chorus: density, pitch, and glow shift from night murmur to chorus peak to full day. *Wake the thicket* to listen; the canvas hedge, meters, and perched finches respond live.
- **02 · Chorus trade** — Tap eight seed-notes to cycle rest → peep → trill → warble → buzz, preview your phrase, then *release* it with a finch + phrase name. Carry songs as `CFR1-` codes (copy, `.chorus` file, paste-to-perch) or *catch a wild chorus* from the hedge.
- **03 · Flock board** — Six wild finches plus everything you release or catch. Play any nest, heart the ones that lift you, sort by newest / most-loved / earliest-riser. Everything persists in `localStorage`; *fold for dusk* resets.

## Craft notes

- Palette is exactly 3 colors (paper `#F6EEDF`, copper `#B2622A`, moss `#2F5D3A`) plus near-black `#1B130C` and off-white `#FFFDF7`; system fonts only (system sans + Georgia serif).
- Biomorphic identity: morphing blob field, seed logo, asymmetric pod/card radii, wobbling hedge canvas, stepped organic buttons.
- All birdsong is synthesized live with the Web Audio API (no audio files). Responsive down to 375px; honors `prefers-reduced-motion`.
