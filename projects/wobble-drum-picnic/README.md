# Wobble Drum Picnic 🧺🥁

Tap blobby drums, stack wobbly loops into goofy polyrhythms, bend the pitch, share your beat.

## How to open

No build, no npm. Either:

- Double-click `index.html`, or
- Serve it: `python3 -m http.server` in this folder → http://localhost:8000

Works from `file://` and any static host. Sound starts on your first tap (browsers require a gesture).

## What it does

- **Tap pads** — 6 synthesized Web Audio drums (no samples): Kick Blob, Snare Pea, Hat Sprout, Tom Melon, Clap Fungus, Boing Jelly. Keys `1–6` work too, `Space` toggles play.
- **Stack loops into polyrhythms** — each drum has its own loop length (8, 6, 12, 5, 7, 9 steps), so layered loops drift in and out of phase. Toggle loops, click step dots to edit patterns, 🎲 per-voice or global scramble.
- **Wobble pitch-bend slider** — a shared 5.5 Hz LFO bends every voice's pitch; the title, sun, and blobs wobble harder as you crank it.
- **Shareable beat link** — state (tempo, wobble, volume, loops + patterns) is encoded into `#b=…` and auto-saved to localStorage. "Copy beat link" puts it on your clipboard; opening it unfolds the friend's beat with a 🎁 toast.

## Easter egg 🐜

A picnic ant marches across the screen every so often. Boop it 3 times to trigger **PICKLE RAVE**: all loops on, hue-cycling blobs, and a secret kazoo melody. Boop again to chill.

## Files

`index.html` · `style.css` · `app.js` — plus Google Fonts via `@import` (graceful offline fallback to system fonts).
