# Echo Fern Sequencer

Paint looped beats on a mossy step grid with dripping reverb blooms. A steampunk WebAudio toy: brass plates, rivets, moss beds, and a reverb greenhouse.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` then open the URL.

Works from `file://`. Google Fonts needs network; everything else is offline.

## What it does

- **16-step paintable beat grid** — 5 tracks (Kick, Snare, Hat, Clank, Spore). Click/drag to paint, eraser mode, per-track mute + solo.
- **Built-in WebAudio drum samples** — all synthesized (sine-drop kick, noise snare/hat, metallic clank, pentatonic spore pluck). No audio files.
- **Drag-to-bend delay and reverb** — two drag pads (delay time × feedback, reverb decay × bloom) plus sliders. Reverb uses a live-generated convolution impulse; spore hits drip blooms on canvas.
- **Instant rhythm seed sharing** — pattern + FX + tempo compress into a short `EF-…` seed in the URL hash. Copy seed link, send it, it regrows exactly.
- **Reacts to scroll** — scrolling bends the master low-pass filter, swells reverb, sways the ferns, tilts the machine, and drives the scroll-progress bar. A whole greenhouse section below gives room to scroll.
- Transport: play/stop, tempo 70–170 BPM, swing. Persists to localStorage; live seed in URL.

## Files

- `index.html` — structure
- `style.css` — steampunk × moss aesthetic
- `app.js` — sequencer, synth, FX, seeds (ES module, no deps)
