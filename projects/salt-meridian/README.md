# Salt Meridian — a biomorphic tide pool

Click-only living visualization. Click the lagoon to seed brine blooms; cells drift
toward the shimmering meridian, merge with kin via organic bridges, and crystallize
into salt shards as they mature.

## Open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder, then open the printed URL.

Works from `file://` (share links use the URL hash; PNG/JSON export via download).

## Interaction (click only — the hard constraint)

- **Click lagoon** → seed a bloom burst + expanding ripple
- **stir**: seed bloom · tidal pulse · evaporate (clear)
- **presets**: atoll ring · meridian salt line · superbloom
- **share/export**: tide PNG download · copy lagoon link (state in `#lagoon=` hash)
  · lagoon JSON download

No dragging, no typing, no keyboard shortcuts. Ambient auto-seeding keeps the pool
alive when idle; the lagoon persists to `localStorage` and shared links hydrate on load.

## Stack

Plain `index.html` + `style.css` + `app.js` (ES module, no deps). Canvas 2D with
wobbly blob paths, kin bridges, meridian sweep, crystallization. Fraunces + Space
Grotesk via Google Fonts `@import`. Responsive down to 375px.
