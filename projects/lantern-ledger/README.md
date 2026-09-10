# Lantern Ledger — night journal

> A night journal lit one lantern at a time.

A bauhaus night-journal: write a few lines before the light goes out, light the
lantern, and keep the streak flame alive night after night. Three colors plus
black/white, click-only interaction throughout.

## Features

- **Night entries** — compose tonight's entry (up to 2000 chars), edit and rekindle
- **Lantern glow** — light a lantern per entry; the lantern row shows your lit nights
- **Streak flame** — consecutive nights feed the flame; gaps let it gutter out
- Entries persist in localStorage; entry cards line the rail

## Constraints

- 3 colors max (plus black/white)
- Only one interaction type (click)
- No backend — localStorage only

## Notes

- Built by auto-forge (vite + React + TypeScript + Tailwind).
- The builder worker was killed by the tick timeout with no result.json; a human ran
  the final `npm run build` (exit 0) and shipped it.
- `npm run build` → `dist/` (relative `./assets/` paths for `/p/` subpath hosting).
