# Fogline Parcel Scouts

Chart foggy parcels, claim territory, and outmaneuver rival scouts. A grunge-styled, single-survey strategy game — asphalt, torn flyers, spray paint, rubber stamps. No fonts, no images; ink & static only.

## Open

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` then visit the page.

Works from `file://` and any static host. No build, no backend.

## What it does

- **Fog-of-war grid exploration** — 15×15 canvas map starts fogged; your scout (Y) reveals a 7×7 vision block as you move. Charting new tiles earns ink (+2 for forest/rubble caches).
- **Claim and paint territories** — every step paints the tile acid yellow. `STAKE (Space)` spends 6 ink to blast-paint a 3×3 block. Water can't be claimed.
- **Procedural map seeds** — seeded RNG (`xmur3` + `mulberry32`) generates terrain from any seed string. Type a seed + SURVEY, roll ⚄ for random, `N` for a fresh map. Same seed = same map.
- **Rival scout AI** — Rust Jackals (greedy fog-expanders) move every turn; Violet Magpies lurk toward you and poach your border paint (faster late-game). Both path greedily toward high-value frontier tiles.

Win by holding the most paint at turn 140, or hitting 45% of dry land first. Best haul persists in `localStorage`.

## Controls

Click/tap adjacent glowing tile or `WASD`/arrows to move · `Space` stake · `N` new map · `M` mute · `Esc` closes help.
