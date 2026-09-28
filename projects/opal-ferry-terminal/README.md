# Opal Ferry Terminal

Watch opal ferries cross the bay — a living departure board, an animated canvas bay, and a crossing bell that rings on every docking.

## Open

No build. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server 8000` then open `http://localhost:8000/index.html`

Works from `file://` (Google Fonts `@import` needs network; everything else is offline-safe).

## What it does

- **Ferry board** — 5 boats (Opal Queen, Kelp Runner, Gullwing, Barnacle Belle, Driftwood) with route, status pill (boarding / enroute / docked / delayed), ETA, and progress bar. Live-updates from the sim.
- **Bay viz** — canvas with Opal + Kelp docks, Gull Rock, route lane, wakes, smoke, gulls, shimmer sun, and a selected-boat highlight. Pauses with a "TIDE HELD" overlay.
- **Crossing bell** — WebAudio two-tone bell (no audio files). Auto-rings on every docking (toggleable), manually ringable, mutable, with a persisted ring log + crossing tally in `localStorage`.

## Keyboard only (constraint)

Everything works without a mouse. Every control is a real `<button>`/`<input>`, the board is a `listbox` with roving tabindex, and the canvas is focusable:

| Key | Action |
|---|---|
| `Tab` | move through everything |
| `↑` `↓` / `←` `→` | pick ferry |
| `Enter` | hail selected ferry (cast off / horn) |
| `N` | dispatch new crossing |
| `P` / `Space` | hold / release tide |
| `B` | ring crossing bell |
| `M` | mute / unmute |
| `1`–`5` | jump to ferry |

Skip link, visible focus rings, `aria-live` announcements, `prefers-reduced-motion` support.

## Files

- `index.html` — structure
- `style.css` — organic-brutalist theme (concrete + kelp + opal + rust, Archivo Black / Space Grotesk / Space Mono)
- `app.js` — sim + canvas + WebAudio bell, ES module, no deps
