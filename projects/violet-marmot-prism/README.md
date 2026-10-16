# Violet Marmot Prism

> Mix gradients, test contrast, and export shareable palettes in seconds — a dark-fantasy color forge.

## What it is

A single-page gradient mixer dressed as a cathedral grimoire: bruised plum-black void, candlelight-gilt controls, engraved Cinzel caps over Spline Sans Mono instrument type.

## Features

- **Live gradient mixer** — up to 3 chromatic pigments (hard cap) with hex + rune-stone pickers, per-stop position sliders, linear / radial / conic refraction, and a living CSS incantation readout.
- **Black & white candles** — toggle fixed #000000 / #FFFFFF endpoints. They don't count toward the 3-color limit (constraint: *3 colors max plus black/white*).
- **Color-blind perception preview** — True Sight / Protanopia / Deuteranopia / Tritanopia / Achroma veils (Machado 2009 matrices) with per-stop simulated hex and muddied-stop warnings when two pigments collapse below 1.5:1.
- **Contrast altar** — WCAG pairwise ratios between all stops plus parchment-text checks with AAA / AA / AA-large / fail sigils.
- **Random harmony dice** — cast the die in Analogous, Complement, Triadic, Monochrome, or Wild mode (600 ms tumble + gilt flash).
- **One-click palette export** — copy CSS variables, Tailwind theme snippet, SVG gradient, or JSON; download to file; copy a share-link (state encoded in the URL hash).
- **Persistence** — state autosaves to `localStorage`; shared links restore via hash.

## Run

```bash
npm run dev      # develop
npm run build    # build to dist/ (base './' — serves from any subpath)
npm run preview  # serve the production build
```

No backend, no API keys. `node_modules` is a symlink to the sibling `moss-clock` install (never run `npm install` in this lab).

## Stack

Vite 8 + React 19 + TypeScript + Tailwind CSS v4. Color science lives in `src/lib/color.ts` (pure functions: conversion, WCAG contrast, Machado simulation, harmony roller, export builders, hash codec).
