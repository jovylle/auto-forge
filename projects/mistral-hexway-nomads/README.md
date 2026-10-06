# Mistral Hexway Nomads 🌆🐪

Vaporwave hex-territory strategy. Claim glowing hex tiles, plot looping caravan
routes between them, and dodge two drifting fog blobs + a sweeping fog wall.
Daily seed, local leaderboard. **Keyboard only.**

## Open

No build, no npm. Works from `file://` or any static host:

- Double-click `index.html`, **or**
- `npx serve .` / `python3 -m http.server` then open the page.

Google Fonts `@import` needs network for full chrome type; game works offline
with fallback fonts.

## How to play (keyboard only)

| Key | Action |
|---|---|
| `←↑↓→` / `WASD` | move hex cursor |
| `Space` / `Enter` | claim tile (costs 12⚡ mist; blocked in fog) |
| `R` | start route on a claimed tile → walk → `R` on another claimed tile |
| `C` / `Esc` | cancel plotting |
| `P` pause · `N` restart · `M` mute · `H` help | — |

Rules: 3-minute run. Mist ⚡ regens +4/tick; caravans earn mist + score each
time they cross your tiles. Fog stuns caravans and steals 15 pts. Up to 3
caravans. Run ends at 0:00 → type a 3-letter callsign, hit Enter to save.

## Features

- 🟪 Paint territories on a 10×9 pointy-top hex grid (seeded tile values 1–3)
- 🐪 Plot caravan routes (BFS path, ping-pong hauling, fog stuns)
- 🌫 Dodge roaming fog: 2 diagonal blobs + 1 sweeping wall, all seeded
- 🏆 Daily seed leaderboard (`localStorage` key `mhn-board-YYYY-MM-DD`, seed bots so the board is never empty)
- 🎹 100% keyboard playable, focus ring + ARIA live toasts, 375px responsive

## Files

- `index.html` — layout, HUD, board, side panels, game-over modal
- `style.css` — vaporwave system (chrome type, sunset, grid floor, scanlines)
- `app.js` — seeded RNG, hex math, fog AI, caravans, ticks, leaderboard
