# Looping Clock Garden

Grow a garden where every flower blooms on a looping clock schedule.

## Open

Open `index.html` directly in a browser (works from `file://`), or serve the folder statically. No build, no dependencies, no keys.

## Features

- **Tap to plant flowers** — click/tap the soil, or move the keyboard cursor and press Enter/Space.
- **Watch blooms follow clock loops** — each flower has its own period; petals open with its hand and restart when the loop closes.
- **Speed up time** — use +/− buttons or +/- keys (0.5× to 8×).
- **Share a garden seed** — copies a URL containing your garden; opening it recreates it.

## Controls

- Arrow keys move the planting cursor; Enter/Space plants.
- `+` / `-` speed up / slow time. `S` share. `C` clear. `Esc` blur.
- Scroll pans the garden view.

## Stack

Plain `index.html` + `style.css` + `app.js`. Canvas rendering, localStorage persistence, URL-hash seeds.
