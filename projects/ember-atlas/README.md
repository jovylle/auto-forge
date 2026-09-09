# EMBER ATLAS

Chart your week as a **cooling heat map**. A cyberpunk heat diary on a 7-day × 24-hour grid — ignite cells, watch them burn and slowly cool to ash over 26 hours.

## Open it

No build, no dependencies, no network beyond the Google Fonts import. Just open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 8731
# → http://127.0.0.1:8731
```

Works from `file://` too. Data persists in `localStorage` (`emberAtlas.v1`), keyed to the current week (Mon–Sun) — a fresh week starts a fresh map.

## How to use

- **IGNITE** (default brush) — click or drag across the grid to paint heat. The hotter/fresher a cell, the brighter it glows.
- **DOUSE** — drag to cool cells back to ash.
- Hover any cell for its readout: current level, ignition count, minutes until the next cool-down, and a **cool-down trail** — the projected cooling curve for that cell over the next ~30 hours.
- **DOUSE ALL** — clear the whole week.

## Features

- **heat diary** — persistent weekly grid; paint and re-paint your week, survives reloads.
- **cool-down trails** — every ignition cools on a real clock: **MOLTEN** (< 3h) → **FIRE** (3–9h) → **EMBER** (9–26h) → **ASH**. Cells emit drifting ember particles and a visible cooling pulse as they drop levels, and each cell shows its projected cool-down curve on hover.
- **ember export** — opens an export console with a pixel-precise **PNG snapshot** of the week and a copyable **ASCII ember shard** (█ ▒ ░ ·) of the whole grid.

## Constraints honored

- **Sound on interaction** — all UI sounds synthesized live with WebAudio (no assets): ignition plucks pitch up with hour, douse and cool-down whooshes, export chord. Mutable via the top-right toggle.
- **3 colors max + black/white** — the palette is exactly three hues (cyan `#22e6ff`, magenta `#ff2d78`, ember `#ff9f1c`) plus black and white. Heat itself maps white-hot → magenta → ember → black.
- Fast, self-contained, no backend, no API keys.