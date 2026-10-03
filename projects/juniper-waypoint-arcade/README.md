# Juniper Waypoint Arcade

Claim tiles, plot routes, and outmaneuver rivals on shifting neon maps. Neo-brutalist hex strategy blitz.

## Open

- Double-click `index.html`, or serve statically: `python3 -m http.server` then visit `http://localhost:8000/`
- Works from `file://` — no build, no backend.

## How it plays

- **Hex-grid territory capture** — 10×9 SVG hex map. CLAIM mode: first 3 taps free, then only tiles adjacent to your acid turf. Rivals (blaze bots) expand every second and love waypoints — cut them off.
- **Daily shifting obstacle maps** — VOID tiles + waypoint layout are seeded from the date (`JWA-YYYYMMDD`). Use the day picker, TODAY, or ⟳ SHIFT to jump to another daily map.
- **Route-plotting score combos** — switch to ROUTE mode, chain your adjacent tiles, BANK 3+ tiles. 10/tile + 50/waypoint, loops ×2, 6+ tiles ×2, 9+ ×3. Tap last tile again to undo.
- **Local leaderboard races** — live gap-to-#1 in the HUD, top-8 board (MAP/ALL toggle), persists in `localStorage` (`jwa-board-v1`). 90-second rounds, sign your score with a pilot tag.

## Constraint

3 colors max + black/white: ACID `#D6FF3F` (you) · JUNIPER `#00C2A8` (waypoints/routes) · BLAZE `#FF4D00` (rivals) on paper `#FFFEF5` / ink `#111111`.
