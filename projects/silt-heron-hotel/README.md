# Silt Heron Hotel

A retro-wave night-manager game. You're the front desk of a neon hotel on the
marsh. Herons wade into your lobby — check them in, keep them blissful, and
survive 5 nights without tanking your rep.

## How to open

No build, no server needed. Either:

- double-click `index.html`, or
- serve the folder: `python3 -m http.server` then open
  `http://localhost:8000/projects/silt-heron-hotel/` (any static host works too)

Works from `file://`. Needs internet only for the Google Fonts `@import`
(degrades gracefully to monospace offline).

## How to play

1. **Click a guest** in the lobby, then **click a vacant room** to check them
   in (you collect their fee up front).
2. **Click an occupied room**, then **Feed / Preen / Hush** to refill the
   belly / plume / rest meters. High mood earns tips.
3. Meters drain in real time; lobby guests lose patience and storm out
   (rep −2). A fully empty meter makes a guest miserable (rep −3).
4. Press **☾ End night** to collect checkout pay and start the next night.
5. **Win:** finish night 5 with rep above 0. **Lose:** rep hits 0.

## Share / export

- **⧉ copy ledger** — copies the night-by-night receipt to the clipboard
- **⇩ download ledger** — saves it as a `.txt` file
- **🔗 share link** — copies a `#stay=` link encoding your purse so a friend
  can try to beat it (shows a rival banner on load)
- Progress + best season persist in `localStorage`; **↺ new game** resets.

## Tech

- `index.html` + `style.css` + `app.js`, no bundler, no dependencies.
- **No images:** the backdrop (retro sun, perspective grid, stars, flying
  heron silhouettes) is canvas-drawn; guest herons are pure CSS shapes.
- Sound is synthesized with Web Audio (mutable, no audio files).
- Responsive down to 375px; honors `prefers-reduced-motion`.
