# Moss Telegraph

A grungy slow-social telegraph. Pound a brass key in dots & dashes, decode live Morse, transmit dispatches to moss-covered relay huts on an overgrown map, water other dispatches, and share the wire.

## How to open

No build, no server needed:

- Double-click `index.html`, **or**
- `npx serve .` / `python3 -m http.server` in this folder, then open the URL.

Works from `file://` and any static host. Google Fonts `@import` needs network; everything else is offline-safe.

## What it does

- **Core interaction** — Hold the brass key (or hold `SPACE`): quick tap = `·`, long hold = `−`. Pauses split letters/words automatically. Live Morse + decoded readouts, morse cheat card, line-voltage needle, `·`/`−`/gap/backspace/clear buttons for touch.
- **Relay map** — 6 grungy relay huts (Bog, Ruin, Fen, Hollow, Quarry, Thorn). Sign with a handle, pick a hut, hit TRANSMIT. Pins land on the map; click to read in a stamped modal.
- **The wire** — Chronological feed with water/💧 (likes), read, copy, share, two-tap burn. Draft handle + whole wire persist in `localStorage`. Inbound `#m=` / `#w=` links merge into your wire.
- **Share/export** — Copy wire, download `.txt` transcript, export wire JSON, per-dispatch or whole-wire base64 share links.

## Constraint

Sound on every interaction via WebAudio oscillators + filtered noise — key drone, dot/dash blips, static-burst transmit, droplet water, paper rustle. No audio assets. Mute toggle in the masthead.
