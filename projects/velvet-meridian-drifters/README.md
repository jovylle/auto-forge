# Velvet Meridian Drifters

Claim drifting map tiles in cozy meridian navigation duels — a neo-brutalist,
pass-and-play strategy duel for 2 skippers on one device. No build, no backend.

## How to open

Just open `index.html` in any modern browser (double-click works — runs from
`file://`), or serve the folder statically, e.g. `python3 -m http.server`.

## How to play

1. Enter skipper names, tap **set sail!** (P1 ◈ velvet vs P2 ◎ meridian).
2. On your turn, **press & drag** a connected trail of open tiles (up to 6),
   then release to claim. Trails must touch your color after your first claim.
3. Tiles on the red-outlined **meridian column score ×2** — it **shifts every
   2 rounds**, so plan ahead.
4. ★ star-charts = 3 pts, ⚡ tiles grant a random **power-up**:
   - 💨 **Gust** — tap any open tile to claim the 3×3 around it
   - ⚓ **Anchor** — arms a ward; your next 3 claimed tiles lock 🔒 against storms
   - 🔭 **Spyglass** — +3 drag-moves immediately
5. Tap **end turn**, pass the device (a pass-screen hides the board), 12 rounds
   total — highest score wins. Storms occasionally reclaim unlocked tiles!

## Features

- **Drag to claim map tiles** — pointer/touch drag with live preview, backtrack
  to trim, adjacency + territory rules enforced.
- **Shifting meridian power-ups** — ×2 meridian column drifts mid-game, plus
  earnable/useable Gust, Anchor, Spyglass, and tile-stealing storms.
- **Daily seed navigation boards** — deterministic seeded chart per date
  (`DAILY-YYYY-MM-DD`), date picker, random drift, loadable/shareable seeds,
  win-streak tracking in localStorage.
- **Local 2-player pass-and-play** — turn passing with hidden-board pass screen,
  rematch on the same seed.

## Constraints

- **Single self-contained `index.html`** — all CSS + JS inlined, zero
  dependencies (Google Fonts via `@import` with system-font fallback).
- **Sound on every interaction** — pure WebAudio oscillator SFX (claims, stars,
  power-ups, meridian shifts, storms, win fanfare), mutable, no audio assets.

## Files

- `index.html` — the entire game
- `SPEC.md` — project spec
- `README.md` — this file
- `result.json` — build report
