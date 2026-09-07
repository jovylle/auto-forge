# NEON TIDE — audio-reactive particle shore

A pop-art generative experiment: a comic-book shoreline of glowing particles
that surges and breaks to your voice. Plain HTML + CSS + JS, no build, no
dependencies. Works from `file://` and any static host.

## Open

```bash
open index.html
# or serve it
python3 -m http.server 8000
```

## What it does

- **TUNE IN** — opens your microphone; the shore reacts to bass energy in real time (chip turns LIVE).
- **SURGE** — a synthesized wave drives the tide if you'd rather not use a mic, and fires a big splash impulse.
- **Tap the sea** — every tap throws a ring + droplet burst where you hit (the first tap also wakes the tide).
- **STORM / GLOW / CREST** — sliders tune reaction strength, neon bloom, and particle count.
- **COLORWAY** — three themes (PINK / CYAN / VOLT), each exactly the same 3-color pop family re-rolled.
- **PNG** — downloads a clean poster of the current frame (HUD excluded).
- **SHARE** — copies a URL encoding the current settings + theme; opening it reloads the tide.

A BASS meter (top right) shows live energy, the masthead spark pops on big hits,
and the whole sea runs on one `<canvas>`: a Ben-Day halftone sky, misprint
double-stroke shore, stacked comic water bands, and additive neon particles.

Settings persist in `localStorage`; share URLs override them.

## Constraints honored

- **3 colors max (plus black/white)** — the palette is pink `#ff2a85`, cyan
  `#00e5ff`, volt `#ffd60a` against ink `#06070b` and paper `#fff6ec`; every
  theme is a permutation of the same three.
- **No external fonts** — `"Arial Black"`/Impact display stack plus `system-ui`
  and `ui-monospace` only. No network requests at all.