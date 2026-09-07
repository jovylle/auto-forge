# Crumb Budget 🍪

Track spending in **snack units**. Every dollar you spend is a chocolate bar, a donut, or a boba you could've had instead.

Stack: **Vite + React + TypeScript + Tailwind v4**, glassmorphism aesthetic, `localStorage` persistence, no backend.

## Features

- **Expense log** — add a crumb (emoji + name + amount + date), delete entries, clear the shelf. Persisted to `localStorage`. Each row shows the money cost *and* its snack equivalence.
- **Snack converter** — type any dollar amount and see how many of your chosen snack that buys, with a whole-snacks + change breakdown. Pick a snack; the whole page re-frames around it (hero equivalence + ghost emoji).
- **Weekly chart** — 7-day bars for this week's crumbs, a dashed daily-budget line, hover/focus tooltips, and over-budget days flagged in candy.

## Run

```bash
npm install
npm run dev      # develop
npm run build    # tsc -b && vite build
npm run preview  # serve dist
```

## Design notes

- Palette: exactly 3 chromatic colors (`#FF5C8A` candy, `#FFB65C` toffee, `#7FE0A3` pistachio) plus near-black `#120C14` and warm-white `#FFF6EA`.
- Typography: Fraunces (display), Outfit (body), DM Mono (numbers) via Google Fonts with preconnect.
- Glass recipe: `backdrop-filter: blur(18px) saturate(150%)`, gradient tints, top-light catch, cursor-tracked specular, ±3° tilt on hover.
- Micro-interactions: hero count-up, entry "crunch" animation, chewy button press, blob drift, springy chart bars. All disabled under `prefers-reduced-motion`.

## Project config

- `base: './'` in `vite.config.ts` so `dist/` works under subpath hosting.
- No API keys, no network calls beyond the font stylesheet.