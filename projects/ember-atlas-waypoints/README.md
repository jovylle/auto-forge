# Ember Atlas Waypoints

> Pin drifting waypoints to paint a living atlas from your wanderings.

A japanese-cyberpunk living map: drop ember-diamond waypoints on a drifting
grid, link them into glowing routes, watch kuchiba territory bloom around
your wanderings, then export a stamped mini-map PNG or a share link that
carries the whole atlas in the URL hash.

## Run

```bash
npm run dev      # local dev
npm run build    # typecheck + production build (dist/, relative paths)
npm run preview  # serve dist/
```

## Features

- **Drop custom waypoints** — DROP mode + click, double-click, or Drop @ Random.
  Rename, add field notes, pin against drift, delete. Drag diamonds to move.
- **Connect routes live** — NEW ROUTE / AUTO-TRACE, then LINK mode: click
  diamonds in order and the energy line draws itself with marching dashes.
- **Animate territory growth** — ember blobs bloom around waypoints and route
  corridors on every change; BLOOM [B] replays it with spark particles.
  Unpinned waypoints visibly drift on a sine current (toggleable).
- **Export shareable mini-map** — 640×400 stamped PNG download, plus a
  `#a=` share link (full state, base64) you can copy or reload.

Persistence is `localStorage` only; a shared link in the URL takes precedence
on load. A 3-waypoint demo atlas seeds first run.

## Constraints honored

- **System fonts only** — no external fonts, no Google Fonts import anywhere.
- **Sound on interaction** — pure WebAudio synth (koto-ish triangle plucks,
  square blips, noise-sizzle bloom, export chime). Mute with [M] or the panel
  toggle. Zero audio assets.

## Shortcuts

`D` drop · `L` link · `B` bloom · `M` mute · `ESC` cancel/deselect.
