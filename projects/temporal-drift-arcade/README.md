# Temporal Drift Arcade

> Rewind ten seconds to dodge clocks in a neon time-loop maze.

Swiss-poster arcade maze. Procedural clock maze, 10-second scrub-back rewind, combo shards, daily seed challenge. Plain HTML/CSS/JS, no build.

## Open

```sh
open index.html
# or serve
npx serve .
# or
python3 -m http.server
```

Works from `file://` (Google Fonts needs network, degrades gracefully offline).

## Play

- **Move:** WASD / arrows (touch d-pad on mobile). Reach the blue `→` exit gate in 90s.
- **Clocks:** 5 red patrols, one touch kills.
- **Shards:** 14 red diamonds. Grab within 2.5s chains to raise combo (×1–×9, 100×combo pts). Every 8-grab streak earns +1 rewind charge (max 5).
- **Rewind (R):** freezes time, drag the 10s loop-buffer slider back, Enter/click Resume restores position + shards + score (costs 1 charge, start with 3). Esc cancels. Death with charges auto-opens rewind.
- **Seeds:** Daily button loads today's `YYYYMMDD` maze (same for everyone); Random / numeric loader / `?seed=` link + copy button. Best scores per seed + per day in `localStorage`.

## Files

`index.html` · `style.css` · `app.js` — canvas maze (recursive-backtracker + braiding), ring buffer at 60fps × 10s, HUD, log, help sheet.
