# Moss Beacon Trailheads — 苔の道

Claim glowing trail tiles to link beacons before fog reclaims the map.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `cd projects/moss-beacon-trailheads && python3 -m http.server 8080` → http://localhost:8080

Works from `file://` and any static host. Mobile-ready at 375px (on-screen D-pad appears).

## What it does

A japanese-minimal moss-walking game on an 11×11 grid:

- **Walk grids to paint territory** — move with WASD / arrow keys, tap a tile to auto-walk there, or use the D-pad. Every step paints glowing moss; territory = all currently-living moss.
- **Link beacons for combo routes** — 5 stone beacons (◈) light when stepped on (⬢). Lit beacons joined by unbroken moss become a glowing route (gold tiles); each linked pair scores 50 × combo.
- **Fog regrows idle tiles** — moss unwalked for ~22s withers back to fog (routes hold ~45s). Circle back to refresh your trail.
- **Daily seed map challenge** — beacon layout is seeded; default seed is today's date (one shared mountain per day). Type a seed + "walk", "today's mountain", "wander" (random), or ↺ restart. Best score per seed persists in `localStorage`.
- **Reacts to scroll** — the page is a scrollable zen manual; scrolling stirs 風 wind (readout in hero + fog-appetite stat), pushes mist particles on the board canvas, fills the enso progress ring, tilts the board, and brisk scrolling briefly slows fog regrowth.

Win by linking all 5 beacons into one route (全結び, the grand linking) before the 2:30 timer ends; time bonus on victory. Final seal stamped 未踏 → 踏破 (crossed) or 霧没 (claimed by fog).

System fonts only (Hiragino/Yu Mincho + Georgia serif stack, system sans) — no external requests.
