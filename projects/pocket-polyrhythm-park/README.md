# Pocket Polyrhythm Park — PPP/01

Tap layered loops to build shifting polyrhythms in a playful pocket park.
Swiss-grid edition: three inks (paper / black / red), one gesture (click).

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `npx serve .` / `python3 -m http.server`, then open the URL.

Works from `file://` and any static host. Internet only needed for the
Google Fonts `@import` (falls back to Helvetica gracefully offline).

## What it does

- **01 · Tap grid** — three loop lanes with different cycle lengths
  (KICK ×4, SNARE ×3, HAT ×5) sharing one 8th-note pulse, so patterns
  phase against each other. Click cells to toggle steps; click LAYER ON/OFF
  to mute a voice without erasing it.
- **Layered WebAudio drum voices** — kick (sine drop), snare (noise snap),
  hat (steel tick), all synthesized live. No samples.
- **02 · Tempo morph** — click anywhere on the track to jump 60–180 BPM,
  click a preset (72/96/120/150), or engage MORPH for a slow ±10 BPM drift.
- **03 · Groove link** — grid + tempo + layers are encoded in the URL hash
  (`#g=112.1000.001.10101.111`). Click COPY GROOVE LINK and send it;
  opening the link restores the exact groove. Also persisted to localStorage.

## Constraints obeyed

- **One interaction type: click.** No `<input>`, no drag handlers, no text
  fields — the tempo "slider" is a click-to-jump track, and keyboard
  Enter/Space only mirrors native button activation.
- **3 colors max (plus black/white):** paper `#f4f1ea`, ink `#111111`,
  red `#e30613`.

## Files

- `index.html` — structure
- `style.css` — Swiss styling, responsive down to 375px
- `app.js` — sequencer engine, synth voices, share-link codec
