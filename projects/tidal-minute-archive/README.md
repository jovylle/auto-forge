# Tidal Minute Archive

Generative tide-clock that loops sampled chimes into evolving history tapestries. Organic-brutalist field instrument in plain HTML/CSS/JS — no build, no network.

## Open

```sh
# any static server, or straight from disk:
open index.html
# or
npx serve .
```

Works from `file://`. Sound needs one click (browser autoplay policy) — press **FLOOD**.

## What it does

- **Looping tide-clock sequencer** — 12-step circular clock (SVG). FLOOD/EBB transport, 40–160 bpm tide speed, tide-depth + decay controls, 4 synth voices (shell / bell / kelp / foghorn). Tide height live-modulates filter cutoff, velocity, and slight pitch drift. Optional EVOLVE mutates the pattern a little every loop.
- **One-tap chime sampling** — big TAP CHIME button (or `Space`) samples a chime at the live playhead: pitch from step position on a D pentatonic climb, velocity from tide height. Click dial steps (or keys `1`–`=`) to score directly.
- **Evolving history ribbon** — every completed loop lays down a colored stratum (red = chime, foam = rest, opacity = tide). Click a stratum to reload it. `+ keep` pins the current loop manually. Persists to `localStorage` (`tma-v1`).
- **Exportable loop cards** — tilted archive card with wave canvas, pattern dots, stats. Export as **PNG** (off-screen canvas render), **copy text** summary, or **JSON** dump of pattern + history.

## Constraints

- System fonts only — no external fonts, no `@import`, no CDN.
- No backend, no API keys. `localStorage` only.

## Files

`index.html` · `style.css` · `app.js`
