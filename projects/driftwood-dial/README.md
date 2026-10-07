# Driftwood Dial

A steampunk **drift computer**: turn a brass-and-driftwood helm dial, trim throttle against an
easterly current, and the instrument plots your projected drift across a procedural canvas
archipelago ("The Verdigris Reach"). Scrolling the page stokes the boiler — gears turn, a
pressure gauge fills, and a ghost ship sails your plotted course through the captain's logbook.

## How to open

No build, no dependencies. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000/`

Google Fonts are loaded via `@import` (needs network for the display type; the instrument
works offline with serif fallbacks).

## What it does

- **Core interaction** — drag / mouse-wheel / arrow-key the helm dial (0–359°) with detent
  clicks (WebAudio, mutable); throttle / current / horizon levers; procedural chart redraws
  the projected drift, landfall reckoning, animated current arrows, reefs, compass roses.
- **Polished UI** — walnut-and-brass steampunk console: riveted panels, glowing boiler meter,
  speed/drift/steam gauges, 16-wind compass readout, voyage-plan fixes, responsive down to 375px.
- **Share/export** — settings encoded in the URL hash (copy share link), copy settings JSON,
  download the chart as PNG (canvas), download the captain's log as `.txt`. Persists to
  `localStorage`; "New waters" re-seeds the archipelago.

## Constraints

- **Reacts to scroll**: page scroll drives the boiler gauge, gear rotation, ghost-ship progress
  along the route, and each logbook chapter seizes the helm (eases the dial to its ordered
  heading) via `IntersectionObserver`.
- **No images**: dial, ticks, gauges, gears (text glyph + CSS), and the entire chart are pure
  CSS + canvas. No `<img>`, no image files, no canvas-drawn bitmaps.
