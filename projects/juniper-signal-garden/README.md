# Juniper Signal Garden ✦

Grow shrubs that flash signals. Plant signal seeds on a 4×4 glass garden grid, tap sprouts to pulse-boost them, harvest flashing shrubs to complete a 6-rune harvest code.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder, then open the URL.

Works from `file://` and any static host. Google Fonts `@import` needs internet; the game works offline without it.

## How to play (~30 seconds)

1. **Pick a seed** — Ember Pulse ◉ (fast, 5s), Frost Chime ▲ (8s, +20), Verdant Spiral ✦ (11s, +30).
2. **Plant** — click any empty `+` plot.
3. **Pulse** — tap a growing shrub to boost it (−1.8s each tap).
4. **Harvest** — tap a flashing glowing shrub to collect its rune + score.
5. Collect **6 runes** → SIGNAL COMPLETE banner with your code, time, and score. Copy it, keep gardening, or replay.

Every interaction plays a WebAudio synth blip (no audio files). Mute with the 🔊 button. Best score/time persists in `localStorage` (`juniper-signal-garden-best`).

## Files

- `index.html` — layout: seed tray, garden grid, harvest code, win banner
- `style.css` — glassmorphism theme (frosted panels, neon glow, 375px responsive)
- `app.js` — game state, growth ticks, WebAudio SFX, harvest-code logic
