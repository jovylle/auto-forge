# Tansy Newt Nook

A pocket field guide to pond newts. Log what you lift the net for, learn which water holds them, and carry your notes home.

## Features

- **Newt log** — record sightings (species, count stepper, pond, date, field note); ledger persisted to `localStorage`, with delete and live visit/newt totals.
- **Pond finder** — 8 curated waters ranked by suitability, with search plus shade / access / suitability filters and a "Log here" shortcut that jumps to the log pre-filled.
- **Field export** — preview notes as CSV, JSON, or plain text; copy to clipboard (with fallback) or download as a file.

## Stack

Vite + React + TypeScript + Tailwind CSS v4. No backend — `localStorage` only (`tansy-newt-nook:entries:v1`).

## Aesthetic

Japanese-minimal "sumi on washi": warm washi paper ground (`#F5F0E6`), sumi ink, pond green, moss midori, rationed vermillion hanko accents. Shippori Mincho display + Zen Kaku Gothic New body. Asymmetric ledger/shelf layout, enso empty state, ripple + hanko-press micro-interactions.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck + production build (`dist/` uses relative `./` asset paths for subpath hosting)
- `npm run preview` — serve the production build

## Layout

Single component in `src/App.tsx` (helpers are plain functions); theme tokens and keyframes in `src/index.css`.
