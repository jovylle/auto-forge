# Lantern Fog Atlas

A Bauhaus charting game: paint territory on a foggy hex archipelago with your lantern, and barter glow with four wandering neighbours (Klee, Popova, Moholy, Albers).

## Open

- Static, no build: just open `index.html` in a browser (double-click works via `file://`), or serve with e.g. `python3 -m http.server` and visit the page.
- 375px mobile friendly; canvas scales to width.

## How to play

- **Paint territory:** click/tap a lit hex to walk toward it and claim it (◉ CLAIM button or Space claims your hex). Claims cost glow (lagoon 4, ridge 3, else 2).
- **Lantern radius:** only lit hexes can be claimed. Lantern Ø grows with milestones (10/25/45/70 tiles), mouse-wheel focus over the map, and **scrolling the page** (+up to 2.2).
- **Trade glow:** when a coloured neighbour dot is alongside (≤2 hexes), press its TRADE button (or T). Gifts, barter-claims, or lens-tuning.
- **Daily fog seed:** map terrain is seeded from the date (`YYYY-MM-DD`); shown in the header/log. `?seed=xyz` or "new fog (practice)" rolls a practice map. Progress persists per-seed in localStorage; "reset day" clears it.
- Claimed tiles tithe +glow every few seconds; walking costs 1 glow.

## Controls

Arrows/WASD move · Space claims · T trades · M mutes · scroll widens beam · wheel over map fine-tunes.

## Files

`index.html` · `style.css` · `app.js` — plus this README. Sound is pure WebAudio (no assets).
