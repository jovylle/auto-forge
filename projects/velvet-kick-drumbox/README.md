# Velvet Kick Drumbox

Sci-fi-terminal Web Audio drum machine. Tap pads to layer kicks, hats, and bass into tiny loops.

## Run

- `npm run dev` — develop
- `npm run build` — production build (`dist/`, relative `./assets` paths for subpath hosting)
- `npm run preview` — serve the build

No backend, no API keys. Pattern + tempo persist in `localStorage` (`velvet-kick-drumbox:v1`).

## Features

- **16-step sequencer with tap input** — click cells to toggle; clicking a pad or a cell auditions the voice; arrow keys move the step cursor.
- **4 synth drum voices** — KICK (pitch-drop sine + click), SNARE (bandpass noise + triangle body), HAT (highpass noise), BASS (saw through lowpass). 100% Web Audio synthesis, zero samples.
- **Live filter + delay knobs** — round dials (native `<input type="range">`, so drag + arrow keys work); lowpass cutoff is log-mapped 150Hz–12kHz, delay is tempo-synced echo with wet-mix control. Both apply live while the loop plays.
- **One-tap random groove** — `◈ RANDOM` shuffles a musical pattern (anchored downbeat kick, backbeat snare, 8th hats, sparse bass) with a stagger flash; hit count lands in the terminal log.
- Transport: play/stop, BPM 60–180, swing 50–75%, clear, live status log.

## Keyboard only

Everything is native buttons/sliders: `Tab` moves, `Space`/`Enter` toggles, arrows step the cursor and turn knobs. Shortcuts: `1–4` audition, `P`/`Space` play, `R` random, `[`/`]` BPM, `-`/`=` swing.

## Design

Burgundy CRT terminal: velvet-black `#120a10`, cream text, rose/amber/mint/wine voice accents, scanlines + vignette, blinking block cursor, phosphor glow. System monospace stack only — no external fonts, no network requests.
