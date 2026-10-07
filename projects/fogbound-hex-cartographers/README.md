# Fogbound Hex Cartographers

Chart drifting fog islands, claim hexes, and stitch trade routes with fellow wanderers — a cozy cottagecore map game.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder, then visit `http://localhost:8000/`

Works from `file://` and any static host. Progress persists in `localStorage` (`fogbound-hex-v1`).

## What it does

- **Procedural fog-grid map** — 8×7 hex grid, seeded RNG terrain (meadow, grove, pond, bramble, hollow, apiary) with a hatch-pattern fog of war.
- **Claim and name hexes** — click glowing `?` fog to chart it, click again to claim. Naming is click-to-pick from three generated name-cards (no typing, per the one-interaction rule); re-draw cards any time.
- **Draw trade routes** — click one claimed hex, then another, to stitch a dashed route (+3 baskets each). Click a ledger entry to snip it. Clicking an existing pair toggles it off.
- **Nightly map reshuffle** — live countdown to midnight auto-reshuffles (unclaimed chartings 55% re-fog, wanderer night-claim), or click **Ring the night bell** to sleep till dawn on demand. Claims always survive.
- **Fellow wanderers** — four NPC wanderers (Mabel Pluck, Tommie Fern, Old Ash, Pip Sorrel) claim hexes and appear in the logbook with colored pins.

## Constraint

**One interaction type only: click.** No text inputs, no drag, no keyboard shortcuts. Everything — charting, claiming, naming, routing, sleeping — is a click.

## Files

`index.html` · `style.css` · `app.js` (ES module, no deps except Google Fonts `@import` with serif/sans fallbacks offline)
