# NEON TIDE — audio-reactive particle shore

A pop-art generative experiment: a shoreline of glowing particles that surges and
breaks to sound. Plain HTML + CSS + JS — no build, no dependencies. Works from
`file://` and any static host.

## Open

```bash
open index.html
# or serve it
python3 -m http.server 8000
```

## What it does

- **TUNE IN** — enables your microphone; the shore particle field reacts to bass energy in real time.
- **SURGE** — if you'd rather not use a mic, hit SURGE to drive the tide with a built-in synthesized wave (or just press it anytime for an impulse).
- **STORM / GLOW / DENSITY** — sliders tune reaction strength, neon bloom, and particle count.
- **Swatches** — three color themes (pink / cyan / volt), each exactly 3 colors + black/white.
- **PNG** — exports a snapshot of the current frame.
- **SHARE** — copies a URL encoding the current settings (works on `file://` by loading them directly).

The top-right BASS meter shows live energy. All visuals are a single canvas:
a halftone pop-art backdrop, an undulating neon shore line, and thousands of
surging particles with additive neon glow.

## Constraints honored

- 3 colors max (plus black/white) — enforced by the theme palette.
- No external fonts — system font stack only.

## Notes

Salvaged from a tick whose worker wrote this file to the repo root instead of the
project dir, then hung on dead models before writing any app code. The app itself
was never built — this README is the worker's design, kept for the retry.
