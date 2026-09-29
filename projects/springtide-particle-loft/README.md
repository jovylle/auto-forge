# Springtide Particle Loft

Toss particles into gravity wells and freeze springy constellations as shareable poster art.
Swiss-plakat generative toy: paper background, grotesk type, red/black/blue grid.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and open the URL.

Works from `file://` (plain `<script>`, no modules, no fetches; Google Fonts degrades to Helvetica offline).

## Play

1. **Drag** empty canvas → spawns a gravity well (drag length = pull strength).
2. **Toss** tool (or `Toss +60`) → flings bodies through the field.
3. Sliders tune **Gravity / Spring / Damping / Trail**; toggles for inflow, spring links, grid.
4. **Freeze** the frame you love → **↓ Poster** exports a 1600×2000 PNG plakat (field + masthead + seed + timestamp).
5. **Remix** regenerates from a new seed; **Copy** copies `SEED + share link` (`#s=...` URL hash regrows the same sky).
6. Drag a well to move it · double-click / select + ⌫ to delete · `Rebuild` regrows wells from the seed.

Keys: `W` well · `T` toss · `F` freeze · `R` remix · `E` export · `⌫` delete selected well.

State (seed, wells, sliders) persists to `localStorage` (`springtide-loft-v1`).

## Files

- `index.html` — masthead, toolbar, stage + control panel
- `style.css` — Swiss system (paper/ink/red, Archivo + Space Grotesk via Google Fonts)
- `app.js` — seeded RNG, gravity + spring-chain physics, trails, poster renderer
- `SPEC.md` — project spec

Constraints honored: canvas + CSS only, zero image assets.
