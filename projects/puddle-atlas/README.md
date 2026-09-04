# Puddle Atlas

> Map every puddle on your street.

An extreme-minimal field-survey toy: walk the street grid with arrow keys, press Enter to log a puddle, toggle rain with R, and watch each puddle evaporate on its fuse timer. All state persists in localStorage (`puddle-atlas:v1`).

## Controls (keyboard only)

- Arrows — move surveyor
- Enter / Space — log puddle
- S — brush size S / M / L
- R — toggle rain
- Backspace — remove puddle at cursor
- H or ? — field manual, Esc closes

## Notes

- Built by auto-forge (vite + TypeScript, no framework). Canvas rain with
  `prefers-reduced-motion` stipple fallback, evaporation sim, street map,
  observation log, rain/evaporation HUD.
- The builder worker was killed by the 18-minute tick timeout one fix from
  done; a human ran the final `npm run build` (exit 0) and shipped it.
- `npm run build` → `dist/` (relative `./assets/` paths for `/p/` subpath hosting).
