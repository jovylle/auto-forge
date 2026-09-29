# Flint Sparrow Depot

> Dispatch sparrows with flint notes. A neo-brutalist depot board for queueing crates,
> striking the flint, and sending birds across the ridge.

## Features

- **Dispatch board** — queue crates (recipient + flint note + priority), dispatch with a
  canvas flint-strike burst and wing-flap, then confirm delivery or recall to queue.
- **The Roost** — sparrow roster with stamina bars, flying/resting states, and hatching
  new birds. Tired birds must rest before flying again.
- **Sparrow log** — reverse-chron event feed (queue / dispatch / deliver / return / hatch)
  with kind filter and an auto-scrolling ticker in the masthead.
- **Note archive** — every delivered note sealed and shelved; search, copy, shred.

## Design

Neo-brutalism: bone paper, ink borders, hard offset shadows, stamped crate indices,
Archivo Black + Space Mono. **No images** — the sparrow is a CSS `box-shadow` pixel
sprite, the masthead flight path and dispatch bursts are `<canvas>`.

## Run

```sh
npm run build    # tsc + vite build (exits 0)
npm run preview  # serve dist/ locally
```

`base: './'` is kept in `vite.config.ts` for `/p/<slug>/` subpath hosting — asset
paths stay relative. State persists in `localStorage` under `flint-sparrow-depot:v1`
(log capped at 200 entries); no backend, no keys.
