# Wandergrid Parcel Routes

Drag delivery routes across a shifting hex grid, dodge the living fog, and claim neighborhoods — all in 30 seconds. A Memphis-style arcade game in plain HTML/CSS/JS. No build, no backend.

## How to open

- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000/`

Works from `file://` and any static host. Google Fonts `@import` needs internet; the game is fully playable offline with fallback fonts.

## How to play (30-second rounds)

- **Drag routes on a hex grid:** press/touch the ★ depot (or any pink claimed tile) and drag through adjacent hexes. Release to commit. Backtrack over your own trail to undo. Max 8 tiles per route.
- **Deliver parcels:** end your route on a 📦 house to score its value (10–25) + 2 pts per new tile + 10-pt LONG HAUL bonus for 5+ tile routes. Delivered houses claim their whole neighborhood ring and a fresh house spawns.
- **Shifting fog blocks paths:** striped orange tiles warn where fog will close in (~1.3s warning), then fog drifts every 4s. Fogged tiles can't be routed through, fog eats live routes, and fogged houses relocate. The depot never fogs.
- **Claim territory:** every newly painted pink tile is +2, even without a delivery.
- **Daily seed leaderboard:** the grid layout (fog + houses) and five 🤖 rival scores are seeded from the date (`YYYY-MM-DD` in the header). Beat them, then log your tag (max 10 chars) — player runs persist per-day in `localStorage`, all-time best in `wg-best`.
- **Keyboard:** Tab to a hex, arrows move, Enter/Space starts the route, arrows extend, Enter commits, Backspace undoes, Esc cancels.

## Files

- `index.html` — layout, HUD, board frame, leaderboard panel
- `style.css` — Memphis theme (cream/pink/teal/yellow/purple, chunky borders, hard shadows, floating shapes)
- `app.js` — game logic: seeded RNG, SVG hex board, drag routing, fog drift, timer, leaderboard
