# Sidereal Moth Observatory 🦋

Breed glowing moths from **time seeds** — every second hatches a different moth.

## Open it

No build, no server needed. Just open `index.html` in a browser
(double-click it, or serve the folder with any static host).

## What it does

- **Hatch moths from time seeds** — type any `HH:MM:SS`, hit **Now**, roll the
  dice, or press `Space`. The seed deterministically grows the moth's genome
  (wingspan, colors, spots, antennae, orbit). Your flock persists in
  `localStorage`.
- **Orbit dials warp wing patterns** — Orbit speed, Wing curl, Starlight spots,
  and Glow re-weave every moth live while they flutter around the clock rings.
  Moths fade to stardust after ~6 orbits.
- **Loopable dusk chorus** — fully synthesized WebAudio (cricket shimmer + low
  dusk pad + distant owls), loops forever. No audio files. Toggle with the
  button or `C`.
- **Export moth as wallpaper** — renders the focused moth large on a starfield
  in Desktop (1920×1080), Phone (1080×1920), or Square (2048²) and downloads
  a PNG.

## Constraints

- Exactly 3 chromatic colors (amber `#ffc85c`, periwinkle `#a99bff`,
  mint `#6fe3c1`) plus black/white/near-black shades.
- Playable in 30 seconds: one click on **Hatch moth** and you're flying.

## Files

`index.html` · `style.css` · `app.js` — plain HTML/CSS/JS, Google Fonts via
`@import`, everything else self-contained. Works from `file://`.
