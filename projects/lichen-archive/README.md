# Lichen Archive

A Bauhaus-styled catalog of slow-growing lichen colonies. Log specimens, read their growth rings, search the archive — all local, no backend.

## Features

- **Colony log** — file new specimens (name, species, substrate, site, founding year, notes); two-step ✕ removal; seeded with 3 colonies on first run.
- **Growth rings** — SVG visualizer: concentric rings cycle blue → yellow → red, stroke width encodes measured growth, dashed red "live edge" rotates once per minute (lichen time). Hover/click a ring for year + width; add yearly measurements; per-colony stats (age, diameter, mean/yr).
- **Archive search** — live text search across name/species/site/notes with yellow match wipes, substrate filter chips, 4 sort orders, live specimen count, and a shaking red triangle on zero hits.

## Run

```sh
npm run dev      # develop
npm run build    # typecheck + production build (exits 0)
npm run preview  # serve dist/
```

`node_modules` is already in place — do not run `npm install`. Data persists in `localStorage` under `lichen-archive:v1`.

## Constraints honored

- **Single component** — all UI lives in `src/App.tsx` (helpers are plain functions, never JSX components).
- **3 colors max + black/white** — red `#DA291C`, yellow `#F5C518`, blue `#1D4E89`, ink `#161616`, white; shading only via black-at-opacity. No gray/cream/indigo anywhere.
- Fonts: Archivo Black (display) + Jost (body) via Google Fonts `@import`.

## Structure

| File | Role |
|---|---|
| `index.html` | entry, relative `./assets` output via `base: './'` |
| `src/main.tsx` | React root (renders `<App/>` only) |
| `src/App.tsx` | the entire app |
| `src/index.css` | Tailwind v4 `@theme` tokens + Bauhaus keyframes |
| `vite.config.ts` | Tailwind + React plugins, `base: './'` |
