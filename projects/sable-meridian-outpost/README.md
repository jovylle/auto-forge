# Sable Meridian Outpost

An extreme-minimal async hex conquest in 37 hexes. Three claims a day. Rivals move while you sleep. Routes pay.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder → open the shown URL.

Works from `file://` and any static host. Progress persists in `localStorage`.

## How to play

1. **Claim daily** — glowing hexes border your rust territory. You get 3 claims per day; click a glowing hex to take it.
2. **Fog of war** — `?` hexes are unseen. Toggle **Scout** to reveal a fogged hex's yield (dots = trade value) for free; claiming also lifts surrounding fog.
3. **Async rivalries** — Vesper (patient) and Halcyon (erratic) expand every time you press **End day →**. For human friends: **Copy rival link** sends your exact map as a shareable URL (`#smo1.…`); they paste it into **Load** and continue your season. **Hot-seat pass** hands the device over for couch async.
4. **Trade route scoring** — connected chains of 2+ hexes score `yield × 2 + length`; tiles score `×2 + yield`; held depots ×3 (captured rival depots double). Season closes when 30+ hexes fall or day 24 passes.

## Constraints honored

- 3 colours + black/white: sand `#E3D5B8`, rust `#C75B39`, sage `#7E8F7B` on ink `#0E0D0B`.
- System fonts only (no external fonts, no `@import`).
- Plain HTML + CSS + JS, no bundler, no npm.
