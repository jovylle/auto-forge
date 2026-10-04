# Emberline Islet Cartography — 浮島海図

Sketch drifting islands, claim tiles with beacons, and watch trade winds route themselves. A cozy hex-map sandbox in a japanese-cyberpunk neon survey office.

## How to open

No build, no server, no keys. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder → open `http://localhost:8000`

## What it does

- **Paintable hex island grid** — 13×9 pointy-top hex sea. `島 island` brush raises land (drag to paint), `海 sea` dredges back to water. Islands bob gently like drifting islets; shoals glow lagoon.
- **Territory claiming with beacons** — `灯 beacon` brush stakes lantern-beacons (max 6) on dry land; each claims every land tile within 2 sails, washed gold with an ember rim. Tap a beacon again (or sea-brush it) to lift it. First visit auto-stakes 2 beacons so routes exist in seconds.
- **Auto-routed trade paths** — Dijkstra routing that prefers open water links beacons in placement order, drawn as animated neon dashes with gold waypoints. Ledger tracks trade legs + wind-miles live.
- **Export map as postcard** — renders a 1200×880 washi-paper postcard (map, manifest, captain's signature, 燈 hanko stamp, date) and downloads it as PNG.

Plus: procedural `⟳ new drift` archipelagos, `✦ still sea` reset, poetic islet-name generator, per-beacon ledger with lift buttons, localStorage autosave, toast guidance, responsive down to 375px.

## Constraints honored

- **3 colors max (+ black/white):** ember `#ff4d2e`, lagoon `#27e6c4`, gold `#ffb627` on ink-black `#0a0a12` and paper-white `#f7f2e7`. Sea/shoal/claimed washes are alpha blends of those same inks.
- **Playable in 30 seconds:** a seeded archipelago with 2 beacons + 1 live route loads instantly; the 3-step how-to strip (`paint → 2 beacons → export`) is visible above the map.
