# Sub Bass Sandbox

Playful 808 synth toy — 16-step bass sequencer with glide, distortion, and a WebAudio echo room. Memphis-styled, no images (pure CSS + canvas), 3 colors + black/cream.

## How to open

No build, no backend. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server -d .` then open `http://localhost:8000`

Works from `file://` (Google Fonts needs network, but the app works offline with fallback fonts).

## What it does

- **16-step bass sequencer** — tap pads to mute/unmute, pick per-step pitch (C1–B2) from the menus. Playhead highlights the current step.
- **Glide + distortion knobs** — Glide smears pitch between notes (portamento into the 808 punch); Drive fries the sine through a WaveShaper.
- **One-tap randomizer** — 🎲 builds a musical minor-pentatonic groove (anchored downbeats, random density). `R` key works too. Presets: DEEP / BOUNCE / ACID, plus CLEAR.
- **WebAudio echo room** — ROOM = delay time, ECHO = feedback, plus ECHO MIX, PUNCH (pitch-drop depth), DECAY (808 length), TEMPO (70–160 BPM), VOLUME.
- **Extras** — live canvas visualizer (analyser-driven bars), keyboard (`Space` = play/stop), pattern + knob settings auto-save to `localStorage`.

## Tech

Plain `index.html` + `style.css` + `app.js` (ES module, no deps). 808 voice = sine osc with pitch punch envelope → WaveShaper → lowpass → master, with a filtered feedback-delay send for the room. Lookahead scheduler (25 ms tick, 120 ms lookahead).
