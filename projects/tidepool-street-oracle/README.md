# Tidepool Street Oracle

Sketch a street, flood it with tides, watch ghost walkers reroute live. A dark-fantasy cartography toy in plain HTML/CSS/JS — no build, no backend, works from `file://`.

## Open

- Double-click `index.html`, or serve statically: `npx serve .` / `python3 -m http.server`
- Mobile-friendly (verified layout at 375px via responsive CSS + touch drawing).

## What it does

- **Sketch streets to grow maps** — drag on the chart with 🛤 street / ⌫ erase / ▲ raise / ▼ dredge brushes. Buildings, shores and shallows grow around what you draw.
- **Tide slider floods blocks** — the 🌊 slider drowns every cell below the waterline; drowned streets get dashed amber warnings and become impassable.
- **Ghost walkers reroute live** — glowing walkers pathfind (A\*) across dry streets only; every tide shift or brush stroke triggers live reroutes (counted in the stats, flashed gold). Stranded walkers show a red `!` and keep retrying.
- **Export map postcards** — ✉ seals the live canvas into a framed 1200×900 PNG (title, tide-mark, date, drowned count) with preview + auto-download.
- Extras: 🎲 new omen (regenerate seabed), 👻 +walker, ⏸ still the water, `localStorage` persistence of streets/tide/terrain.

## Scroll reaction (constraint)

Page scroll drives the piece: overall scroll depth maps to tide level when **“tide follows scroll”** is checked (the well-meter + prophecy chapters I–III narrate low → half → high water), dragging the slider manually unbinds it. Plus rune parallax, fog drift, and IntersectionObserver chapter reveals.

## Files

- `index.html` · `style.css` · `app.js`
