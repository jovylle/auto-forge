# Waxwing Weather Station

> Birds forecast the weather in flocks. — レンジャク気象台

A Japanese-minimal flock radar: a live waxwing murmuration (boids on canvas)
reads the sky for you. Flock shape → weather reading + haiku. File sightings
in the waxwing log, export the sky as PNG or the log as JSON/CSV.

## Open

No build, no server, no network. Either:

- double-click `index.html`, or
- `python3 -m http.server` in this folder → http://localhost:8000/

Works from `file://`. Entries persist in `localStorage` (`waxwing-log-v1`).

## What it does

1. **Flock radar** — canvas murmuration with radar sweep, enso rings, wind
   arrow, and a sun/moon dot. Cohesion / altitude / swirl / pace meters feed
   a rule-based forecast (雨 rain, 風 wind, 晴 clear, 曇 overcast, 嵐 gust,
   凪 calm) with a haiku and advice.
2. **Waxwing log** — file count + behaviour + sky note; each entry stamps the
   current forecast. Delete via button or `Del` on a focused entry.
3. **Sky export** — PNG postcard (washi + seal + haiku), log as JSON or CSV,
   forecast poem to clipboard.

## Keyboard only (constraint)

Every control is a native button/slider/input. Shortcuts:

| Key | Action |
|---|---|
| `Tab` | move through everything |
| `←→↑↓` | steer wind direction / breeze |
| `R` | gust · `Space` pause · `D` next hour |
| `+` `−` | more / fewer waxwings |
| `1`–`4` | wind N/E/S/W |
| `E` `J` `C` `P` | PNG, JSON, CSV, copy poem |
| `L` | jump to log · `Ctrl+↵` file entry · `Del` delete entry |
| `?` | toggle key table |

## Constraints

- System fonts only — zero `@import`, zero webfonts (Hiragino/Yu Mincho → Georgia → system-ui fallback).
- Responsive down to 375px (single-column under 860px / 420px tweaks).
- `prefers-reduced-motion` disables transitions; pause freezes the flock.
