# KERN PANIC — Kinetic Type Playground

Kinetic letterforms erupt, collide and settle into playable typographic posters. Swiss-style poster lab: paper background, black grid, red accents, system grotesk only.

## How to open

No build. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder → open `http://localhost:8000`

Works from `file://`.

## What it does

- **Type words to spawn physics letters** — type in the input + ENTER / ERUPT, or just type anywhere on the page; each glyph is a rigid body with velocity, spin, wall/floor bounce and letter-vs-letter collisions. Click the stage to poke an explosion impulse.
- **Gravity, wind, bounce controls** — sliders in panel `02 / PHYSIK`, plus SIZE. SHAKE / SETTLE / CLEAR helpers. Settings persist to `localStorage`.
- **Variable-feel fonts react to sound** — mic level (or built-in test tone) drives weight 150→900, vertical stretch and jitter with red glow. Panel `03 / TON` has the live meter. No external fonts: Helvetica Neue / Arial / system-ui stack only; "variable" feel is synthesized via weight + scale.
- **Export frozen frames as poster PNGs** — FREEZE pauses physics, EXPORT PNG renders a 1200×1500 poster (grid, red bar, your title, glyph count, date) and downloads it. Ink/paper/title controls in `04 / PLAKAT`.

## Easter egg

Type the word `panik` (or enter the Konami code ↑↑↓↓←→←→ B A) → **PANIK MODE**: six seconds of lawless red grid chaos. Shh.

## Files

`index.html` · `style.css` · `app.js` — no dependencies.
