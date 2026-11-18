# Hex Trail Wanderer

> Draw glowing trails across a living hex territory and claim the land they enclose.

A retro-wave browser game: explore a hex grid, draw trails by clicking adjacent hexes,
close a loop to fill a territory with color, and save/share your map. No backend, no keys.

## Run

Open `index.html` in any modern browser (works from `file://` and static hosts).

## Features

- **Draw hex trails** — click or drag across adjacent hexes to lay a glowing path.
- **Claim territories** — close a loop (return to the start hex) and the enclosed hexes fill with color.
- **Save & share** — save to localStorage, copy a share link that restores the exact map, export a PNG.

## Controls

- Click/drag hexes to draw. Click the starting hex to close a loop.
- Undo point, clear path, new map, save, copy share link, export PNG, sound toggle.

## Constraints honored

- Static HTML/CSS/JS, no build, no npm.
- Sound via WebAudio (no assets).