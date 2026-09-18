# Fader Fern Playground 🌿🌆

Pluck glowing ferns to stack loops into misty jungle rhythms — a vaporwave
generative-groove toy. 100% synthesized WebAudio, zero audio assets, zero backend.

## How to open

No build, no npm. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder → http://localhost:8000/

## What it does

- **Tap ferns to trigger samples** — 7 neon ferns (Palm Kick, Mist Snare, Chrome Hat,
  Lagoon Bass, Neon Pluck, VHS Pad, Glass Frog), each a hand-built WebAudio synth
  voice. Click/tap or press keys `1–7`. Every pluck bursts spore particles.
- **Layer 4-bar loop recorder** — `enable sound` → `play 4-bar loop` → `record`,
  then pluck ferns to overdub into a 64-step (16th-note) loop with swing,
  metronome click, live step-grid + progress bar. `X` clears.
- **Dial delay and filter live** — delay time, delay feedback, mist echo (wet),
  filter cutoff, resonance, plus volume. All retarget live audio params.
- **Randomize groove seeds** — `🎲 shuffle` (or `N`) grows a full seeded pattern:
  kick/snare/hats, a bass riff, pluck melody, pads and frog accents in a
  seed-derived minor-pentatonic key. The seed text field accepts your own seeds.

Keyboard: `Space` play/stop · `R` record · `X` clear · `N` new seed · `1–7` pluck.

Settings + loop persist to `localStorage` (`fader-fern-v1`).

## Files

- `index.html` — layout: transport, grove, faders
- `style.css` — vaporwave identity (chrome type, grid sun, scanlines)
- `app.js` — audio engine, scheduler, seeds, canvas backdrop
