# Moss Compass Atlas

Paint moss territories that spread as you navigate a foggy hex grid. Swiss-style field survey: black rules, red accents, mono labels, live leaderboard.

## Open

No build. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder → open the printed URL.

Works from `file://`. Google Fonts loads via `@import` (needs network for the exact typeface; falls back to Helvetica offline).

## How to play (playable in under 30 seconds)

1. **Drag** on the chart to paint moss. **Tap** to march the surveyor ◉ there.
2. **Move** with `WASD` / arrow keys — fog lifts in radius 2 around the surveyor and everywhere you paint. Hovering also scouts.
3. Every 1.2s auto-**pulse**, all four colonies (you + 3 rivals) spread to neighbouring hexes. `Space` or the button pulses manually.
4. 60-second survey timer. Biggest territory at 0:00 wins. Best score persists in `localStorage`.

## Features

- Hex grid paint (drag / tap / keys), 13×9
- Fog of war that lifts as you explore
- Live territory-size leaderboard (4 colonies, bar chart)
- Export map as PNG (2×, with title strip + standings)
- New-survey reset, verdict card, best-score persistence

## Files

`index.html` · `style.css` · `app.js`
