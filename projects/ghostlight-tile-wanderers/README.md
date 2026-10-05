# 👻 Ghostlight Tile Wanderers

Wander foggy tiles, claim territory, and chart shortcuts in shifting mazes.

## How to open
- Double-click `index.html`, or serve statically: `python3 -m http.server` then open `http://localhost:8000/index.html`.
- Works from `file://`. No build, no backend, no keys.

## What it does
- **Fog-of-war tile exploring** — lantern-radius visibility with line-of-sight through walls; explored tiles stay dimly charted, unseen tiles stay dark.
- **Territory painting and stealing** — every step paints your ghostlight teal; the roaming wisp 👺 paints magenta and steals your tiles (you steal back by walking over ink).
- **Daily shifting maze seed** — seeded DFS maze from the date (`YYYY-MM-DD`); ◀/▶ flip days, "today" jumps back. Best score per seed persists.
- **Shortcut beacon carving** — `B` drops a beacon (max 3, oldest recycled), `1/2/3` blinks back to it; `E` carves one adjacent wall (3 charges).

## Win
Claim **55%** of open tiles **and** light all **6 lanterns** 🏮.

## Controls (keyboard only)
`Arrows`/`WASD` move · `B` beacon · `1 2 3` blink · `E` carve · `R` restart · `N` today.

Progress on the current seed autosaves to `localStorage`.
