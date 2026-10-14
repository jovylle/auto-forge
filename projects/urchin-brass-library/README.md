# Urchin Brass Library

Sea urchins shelve a brass library — a pixel-art library tool with a 30-second night-shift sprint.

## Features

- **Spine catalog** — 18 seeded tomes across three staggered brass shelves (abyssal folios, brass annals, coral codex). Click any spine for its catalog card; check books out, catalogue new tomes, restock the demo stacks. Persists to `localStorage`.
- **Urchin clerks** — four pixel-art clerks (SPIKE, BRINY, KELPO, GILT) with SPD/CARE stat chunks and lifetime shelve tallies. Check a book out, then assign a clerk from the rail to reshelve it with a working animation.
- **Shelf search** — brass spyglass input with live parchment results drawer (title / author / shelf). Non-matching spines dim; matches pulse kelp. `aria-live` announcements.
- **Night Shift Sprint (30s)** — order slips call a title + shelf; tap the green-outlined spine for +1. Timer bar, miss counter, house record in `localStorage`. A full round is exactly 30 seconds, so the "playable in 30 seconds" constraint is structural.

## Stack

Vite + React + TypeScript + Tailwind CSS v4. No backend; `localStorage` only.

## Run

```sh
npm run build    # tsc -b && vite build
npm run preview  # serve dist/
```

`base: './'` is set in `vite.config.ts` so the build works under `/p/<slug>/` subpath hosting.

## Design

Pixel-art system (per designer spec): abyss ink `#0e2a2b`, brass `#d9a441`, verdigris `#4e9b8f`, coral `#e2603f`, parchment `#f4e3c1`, kelp `#7fa65a`, wreck brown `#3a2418`. Press Start 2P headers + VT323 body via Google Fonts `@import`. Chunky bevels, stepped `clip-path` corners, scanline overlay, `steps()`-timed sprite animations, marquee ticker, asymmetric offset plaque + staggered shelves. `prefers-reduced-motion` kills keyframes; 3px brass focus rings; spines are labelled buttons.
