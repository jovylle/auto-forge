# Rowan Tern Roundhouse 🕊️🌊

> Stable seabirds in a spinning roundhouse — a vaporwave click-only harbor game.

## How to open

No build, no server needed. Just open the file:

- Double-click `index.html`, **or**
- from a terminal: `open index.html` (macOS) / `xdg-open index.html` (Linux), **or**
- serve statically: `python3 -m http.server` in this folder, then visit `http://localhost:8000`.

Works from `file://` and any static host.

## What it does

Eight terns roost in stalls around a spinning neon turntable. The wheel spins on a
**14-second schedule** — when a tern's spin arrives, it must be **STABLE** (3 feathers).

- **Tern stalls** — 8 stalls in a circle, each with a named tern (Rowan, Zephyr, Coral,
  Mistral, Vesper, Halcyon, Sora, Nami) and a feather meter. Feathers fade every 8s.
- **Spin schedule** — live panel shows the next 4 spins with countdowns, stall numbers,
  and STABLE/RESTLESS status. The next-up stall pulses gold; the hub counts down.
- **Harbor score** — +100 per clean spin plus streak bonus, tide bonus every 8 spins,
  rank ladder (Driftwood → Neon Legend). Best score persists in `localStorage`.

**Constraint:** click is the *only* interaction — no drag, no typing, no inputs.
(Settling terns, sun, sound toggle, and reset are all clicks.)

**Easter egg:** the sun is watching… click it 7 times to summon the 🌙 **Midnight Tern**
(+500, 60 seconds of blessed spins, the sun puts on shades).

## Files

- `index.html` — structure (roundhouse, score, schedule, log)
- `style.css` — vaporwave identity (chrome type, neon grid, scanlines, Monoton/Orbitron)
- `app.js` — game loop, scoring, schedule, easter egg (plain script, no modules)
