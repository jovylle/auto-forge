# Granular Grove Synth 🌲

Scatter field recordings into evolving granular clouds you conduct with gestures.

## How to open

No build, no server needed — just open `index.html` in a browser (double-click works, `file://` is fine). For best audio latency, Chrome/Edge/Safari recommended.

## What it does

1. **Sample the forest floor** — drag & drop any audio file (`wav/mp3/ogg/m4a`) onto the dropzone, or press `Enter` on it to open a file picker. No file handy? Press `D` to grow a synthesized demo grove (dawn chorus + drone + plucks, generated offline in Web Audio). Every sample is **auto-sliced** into 8 regions via onset detection; keys `1`–`8` (or click) seed the cloud at that slice with an audible flurry.
2. **Conduct the cloud** — the glass XY pad controls the granular engine: **X = position** through the sample, **Y = grain size** (30–400ms). Sliders add density (2–60 grains/s), pitch (±12 st), spray, and cloud/dry mix. Fireflies on the canvas visualize live grains.
3. **Tap-tempo echo trails** — tap `T` (or the Tap button) to set BPM; echo time follows the selected division (quarter / dotted-8th / 8th / triplet) with trail-length (feedback) and mix controls. `M` mutes the echo.
4. **Bottle the loop** — `E` (or Export loop) records the next **8 seconds** of the master bus and downloads `granular-grove-loop.webm`.

## Keyboard-only play

Every control is reachable by `Tab`. Shortcuts: `Space` play/stop · `D` demo · `←→↑↓` move cloud on the focused pad (`Shift` = big steps) · `1`–`8` trigger slices · `T` tap · `E` export · `M` mute echo. Settings persist in `localStorage`.

## Stack

Plain `index.html` + `style.css` + `app.js` (ES module, zero deps). Glassmorphism theme: night-forest gradient, orbs, blur cards, Fraunces + Space Grotesk. Responsive down to 375px.
