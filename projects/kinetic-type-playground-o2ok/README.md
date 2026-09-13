# KINETIC TYPE PLAYGROUND

Neon physics lab: type words, watch letters dance, bounce and morph into
animated typographic art. Cyberpunk aesthetic, zero dependencies.

## How to open

No build, no server needed — just open the file:

- Double-click `index.html`, **or**
- `python3 -m http.server` in this folder, then visit `http://localhost:8000/`

Works from `file://` and any static host. (Google Fonts needs internet;
offline it falls back to Arial Black.)

## What it does

- **Live kinetic text animation** — 5 motion modes: bounce, wave, orbit,
  glitch, rain. Type + hit ⏎ to slam words down.
- **Adjustable font weight & spacing** — weight 100–900, letter-spacing,
  size sliders (Orbitron variable-feel rendering).
- **Gravity & bounce physics** — gravity + bounciness sliders, per-letter
  velocity/spin, floor collisions; **drag any letter to fling it**.
- **Export PNG or GIF** — PNG snapshots the canvas; GIF records 24 frames
  and encodes a looping GIF in-page (self-contained LZW encoder, no libs).
- Extras: 4 neon palettes, glow/trails/spin toggles, preset phrases,
  🎲 shuffle, ☄ drop, fps meter, localStorage persistence.

## Playable in 30 seconds

Zero setup: it boots mid-animation with a preset phrase. Type one word and
hit Enter — that's the whole learning curve.

## Files

`index.html` · `style.css` · `app.js` (all logic + GIF encoder inline)
