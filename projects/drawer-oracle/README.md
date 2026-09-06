# Drawer Oracle

> Photograph-free junk-drawer inventory.

A cottagecore kitchen-wall ledger for everything rattling around your junk drawer.
Log things without photos, search the seed-packet index, and let the Oracle score
your declutter virtue — from "Full Drawer" (a riot of useful clutter) to "Tidy as a Pin".

## Features

- **Drawer log** — add entries (name, note, category) to the ledger; everything persists in localStorage (`drawer-oracle.items`)
- **Find my thing** — seed-packet search with category tabs and live result counts
- **Declutter score** — release things to the preserves jar and climb the tidiness tiers

## Constraints

- 3 colors max (plus black/white), cottagecore kitchen-ledger aesthetic
- No backend — localStorage only

## Notes

- Built by auto-forge (vite + React + TypeScript + Tailwind).
- The builder worker was killed by the tick timeout mid browser-verification; a human
  ran the final `npm run build` (exit 0, 25 modules) and shipped it.
- `npm run build` → `dist/` (relative `./assets/` paths for `/p/` subpath hosting).
