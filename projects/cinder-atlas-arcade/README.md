# Cinder Atlas Arcade

Claim tiles, dodge fog, and race rivals to map the glowing ember grid.

## Open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder, then open the page.

Works from `file://` (plain script, no fetches, no modules).

## Play

1. Press **Ignite the run** (or Start 60s run) — a 60-second map-run begins.
2. **Click-drag** across open tiles to stamp your ember sigil. Each tile's pips (1–3) are its ember value.
3. **Dodge fog:** pale ash is safe; dark, choking fog **scorches** — the tile can't be claimed until the fog drifts on. Fog is procedural: 5 ash blobs wander the grid, plus an **ash surge** every ~9s reshuffles everything.
4. **Race 3 rivals** with real personalities:
   - ▲ **Bramble** — fast, fog-tolerant spreader (takes 1 tile / 0.75s)
   - ◆ **Rust** — slow ember-sniper that steals high-value tiles
   - ● **Wisp** — very fast fog-surfer that grabs 2 tiles but ignores value
   - All three refuse tiles thicker than their courage — that's their "dodge".
5. Steal rivals' tiles by painting over them. When the clock hits zero, the standings decide the **Atlas Sovereign**.

Best score persists in `localStorage` (`cinder-atlas-best`). 🔊 toggles WebAudio blips (no assets).

## Files

- `index.html` — HUD, standings, board, overlays
- `style.css` — organic-brutalist theme (bone cards, hard shadows, ember/moss palette, Fraunces + Archivo Black + Space Grotesk)
- `app.js` — fog sim, drag-claim, 3 AI navigators, 60s timer, scoring, sounds

## Features per SPEC

- Procedurally shifting fog-of-war grid ✓ (drifting blobs + surges + per-tile density)
- Click-drag territory claiming ✓ (pointer drag + click + keyboard-focusable tiles)
- 3 rival AI navigators ✓ (Bramble / Rust / Wisp)
- 60-second map-run timer ✓ (ring countdown, end-of-run results, remap)
