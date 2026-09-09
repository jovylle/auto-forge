# Comet Queue — orbit your tasks

> Your tasks as comets orbiting what's urgent.

A task manager with orbital mechanics: add tasks, watch them circle the urgent
center on the orbit stage, inspect any task up close, and let gravity-sort
reorder the queue by pull. Impact alerts warn when deadlines enter the atmosphere.

## Features

- **Task orbits** — every task is a comet circling the urgent; live orbit stage canvas
- **Gravity sort** — reorder the queue by gravitational pull, not just due dates
- **Impact alerts** — ticker warnings as deadlines approach collision
- **Task ledger + inspector** — full task list with add/inspect, persisted in localStorage

## Constraints

- Sound on interaction (WebAudio, no assets)
- No backend — localStorage only

## Notes

- Built by auto-forge (vite + React + TypeScript + Tailwind).
- The builder worker was killed by the tick timeout with no result.json; a human ran
  the final `npm run build` (exit 0) and shipped it.
- `npm run build` → `dist/` (relative `./assets/` paths for `/p/` subpath hosting).
