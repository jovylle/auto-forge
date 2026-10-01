# Fog Cartographer Club

Chart shifting fog islands, claim tiles, and run trade routes with friends. Grunge-styled chart room in plain HTML/CSS/JS — no build, no backend.

## Open

Just open `index.html` in a browser (works from `file://` or any static host).

## What it does

- **Procedural fog-grid islands** — 28×18 chart generated from a seed (value-noise + island blobs: deep water, shallows, sand, grass, forest, peaks, harbours). Fog of war covers everything except harbour soundings.
- **Click-drag territory claiming** — drag across revealed land to stamp claims in blood-red. Costs ink; mapping fog and scraping claims refunds it. Peaks and sea refuse the stamp.
- **Route pathfinder scoring** — switch to ⟿ ROUTE, tap start then destination. A\* plots the cheapest passage (water costs more); fame pays for harbour-to-harbour runs, fog crossings, water legs, and long hauls. Ledger keeps every run.
- **Seeded daily map share** — daily seed is the date (`#seed=YYYY-MM-DD`); custom seeds, ⚄ drift randoms, and a copy-share-link button give your crew the identical islands.
- **Scroll reacts** — scrolling drifts the parallax fog, swings the tide gauge (high tide thickens fog over low sandbars), and inks in the captain's logbook entries.
- **Easter egg** — type `kraken` or tap the compass 5×.

Keys: `C` claim · `R` route · `E` scrape. Progress persists per-seed in `localStorage`.
