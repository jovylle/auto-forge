# Velvet Avalanche

A Memphis-style generative physics toy. Velvet shapes (circles, donuts, triangles,
bars, crosses, squiggles) tumble down the canvas in an endless avalanche.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the URL.

Works from `file://` (Google Fonts needs internet; falls back to system fonts offline).

## What it does

- **Core interaction** — click/drag on the canvas to fling shapes with pointer
  velocity; scroll over the canvas to tilt gravity sideways; ambient flow rains
  new shapes continuously. Sliders: Flow, Gravity, Bounce, Trail.
- **Polished UI** — Memphis identity: 3-color palette, thick black borders, hard
  offset shadows, tilted cards, dot-grid backdrop, keyboard shortcuts
  (`space` pause, `B` burst, `S` shake).
- **Share/export** — ⤓ PNG exports the canvas at 2×; ⧉ copy link encodes
  seed + settings in the URL (`?seed=&flow=&grav=&bounce=&trail=`).
  Settings persist to `localStorage`.

## Constraints

Palette is strictly 3 colors plus black/white: `#FF2E88` pink, `#00C2A8` teal,
`#FFC700` yellow, `#111111` black, `#FFFDF4`/`#ffffff` whites.
