# Sorrel Wasp Spire

> Wasps build a humming paper spire.

A generative glassmorphism toy: a wasp swarm extrudes a tapering tower of
paper hex-cells on canvas while a WebAudio hum tracks the colony. Scroll to
climb the spire — the camera, the swarm's agitation, and the hum's pitch all
follow you. Export the moment as a PNG poster, a genome JSON, or a share-link
that regrows the identical spire.

## Open it

No build, no backend, no keys. Either:

- double-click `index.html` (works from `file://` — plain `<script>`, no modules/CORS issues), or
- serve the folder: `python3 -m http.server` → http://localhost:8000

## What it does

- **Spire cells** — seeded generative hex-tower (44 tapering tiers, sorrel-capped
  brood cells every 5th). Click/tap the canvas to lay cells, "release swarm" for
  a 40-cell burst, sliders for swarm size / cell size / build tempo, new-seed + reset.
- **Hum synth** — detuned saw + sub sine through a band-pass, LFO grit. Spire
  height sets base pitch; scroll velocity bends it; "sting" fires a pitch-zap.
- **Swarm export** — PNG snapshot, colony genome JSON download, copyable
  `#colony=…` share-link (seed + params regrow the exact spire), plus
  localStorage autosave/restore.

## Constraints

- **3 colors max (+ black/white):** sorrel rust `#C8502E` · wasp amber `#F2B705` ·
  moss `#4E9B6A` (+ ink `#120B06`, paper `#FFF9EE`). Cell variety via alpha/ink
  wash, never new hues.
- **Reacts to scroll:** sticky-spire camera climb, scroll-velocity agitation,
  stratum chapters + progress bar + nav readout.

Palette, type (Fraunces + Space Grotesk via Google Fonts `@import`), layout, and
all logic live in `index.html` + `style.css` + `app.js`.
