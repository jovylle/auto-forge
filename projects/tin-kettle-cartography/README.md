# Tin Kettle Cartography

> Map your kitchen in kettle steam.

Pop-art kitchen-mapping toy in a **single `index.html`** (no build, no deps, works from `file://`).

## How to open
- Double-click `index.html`, or serve statically: `npx serve .` / `python3 -m http.server`.

## What it does
- **Steam map** — canvas kitchen floorplan (stove, sink, fridge, table, kettle). Drag items, hit **BOIL!**; a steam particle sim (buoyancy + turbulence + wind + condensation near fridge/window) paints a pink coverage wash. Coverage % = mapped territory. Scrub tool erases, walls toggle, reset button.
- **Kettle log** — every boil auto-logs tea, temp, wind, duration, map gain, star rating. Stars editable, entries deletable, persisted in `localStorage`.
- **Kitchen export** — map as PNG, log as JSON/CSV, one-click copyable share-card summary.

## Controls
Tea select • temp 70–100°C • wind draught • boil power (2–9s) • whistle sound (WebAudio) • 375px-friendly responsive layout.
