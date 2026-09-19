# Chorus Bloom Box

Paint arpeggios that ripple into glowing blooms with every chord. Bauhaus generative sequencer — single self-contained `index.html`, no deps, no build.

## Open

- Double-click `index.html`, or serve statically: `npx serve .` / `python3 -m http.server`
- Works from `file://` and any static host. Mobile OK at 375px.

## What it does

- **Click-drag petal sequencer grid** — 8 notes × 16 steps, pointer drag-paint, chord stacking, demo pattern, clear, auto-save to localStorage.
- **Live filter and delay blooms** — lowpass cutoff + resonance, delay time + feedback wired live via `setTargetAtTime`; bloom petal size/glow follows feedback + velocity, meter pulses.
- **Generative arpeggio mutations** — Mutate, Evolve (auto-mutate each loop), Invert, Retrograde, Thin/Fill density, 4 scales + octave shift.
- **One-tap loop record and share** — ● Record captures exactly one 4-beat loop via MediaRecorder on the master bus (playback + download); Share encodes grid + settings as base64 in `#b=` URL hash, copy to clipboard.

## Stack

Plain HTML + inline CSS + inline JS (ES module). Google Fonts via `@import` only. WebAudio, Canvas, MediaRecorder, localStorage.
