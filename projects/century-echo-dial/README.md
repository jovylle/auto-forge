# Century Echo Dial

Spin a clock dial to remix centuries of history into looping ambient soundscapes.

## Open it

No build, no server, no network needed (Google Fonts degrades gracefully offline):

- Double-click `index.html`, or
- `python3 -m http.server` in this folder → http://localhost:8000

## What it does

A single hairline dial scrubs **1500 → 2026**. Six synthesized eras crossfade
as you turn — Ink & Vellum, Baroque Pluck, Clockwork Waltz, Iron Choir,
Static Age, Glass Signal. Every sound is generated live with WebAudio
(oscillators + filtered noise); there are no audio files and nothing leaves
your machine.

- **Drag time dial to scrub eras** — drag the ring (one full turn = all of
  history), mouse-wheel, or ←/→ keys (Shift = ×10). Tap the center to play.
- **Auto-loop historic samples** — a lookahead scheduler loops each era's
  generative motif, tick, and pad; adjacent centuries blend by dial position.
- **Layer chimes and ticks** — CHIME / TICK / WASH pills mix the three
  layers live, plus a volume slider. State persists in `localStorage`.
- **Export 30s loop** — renders 30 seconds of the current year + layer mix
  through `OfflineAudioContext` and downloads a 16-bit WAV
  (`century-echo-<year>.wav`).
- **Easter egg** — the dial remembers 1776. Spin three full clockwise turns,
  or triple-click the center… 🔔

## Files

`index.html` · `style.css` · `app.js` — plain HTML/CSS/JS, works from `file://`.
