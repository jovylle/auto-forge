# Moss Clock

> A clock that grows moss when you're calm.

Moss Clock is a keyboard-only meditation piece in an **organic-brutalist** style. A living clock sits beside a concrete wall; the wall grows moss only while you breathe slow and stay still. Agitation makes it recede.

## How it works

- **Breath timer** — a guided 4s-inhale / 4s-hold / 6s-exhale session. The orb is the only circle in the UI; it swells on inhale, holds, and settles on exhale. Each full cycle grows the moss a little more.
- **Moss growth** — moss spreads on a canvas from its own edge, seed by seed, like real moss. **Coverage** is its footprint; **lushness** is its density. Nothing grows while you are away.
- **Stillness score** — rises while you breathe and while your hands rest. Fast key taps, hard pointer flicks, and tab-hopping break it. Drop below 30 and the machine goes into alarm state.

## Keyboard only

| Key | Action |
| --- | --- |
| `SPACE` | start / pause breathing |
| `ESC` | pause the session · close the help panel |
| `← / →` | jump to previous / next breath phase |
| `?` / `H` | toggle help |
| `R` | wipe the moss wall (press twice to confirm) |

Everything is reachable with `Tab`, activated with `Space`/`Enter`, and focus styles are custom (never the browser default). `prefers-reduced-motion` disables animations.

## Local persistence

Progress is saved to `localStorage` (`moss-clock:v1`) every 5 seconds and on page hide. It survives reloads and subpath hosting — no backend, no API keys.

## Stack

- Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`)
- Tailwind CSS v4 (`@tailwindcss/vite`) + custom CSS in `src/index.css`
- Canvas rendering with pre-baked sprites and a cached background (dpr capped at 2)

## Develop

```sh
npm run dev      # dev server
npm run build    # typecheck + production build (outputs to dist/)
npm run preview  # serve the production build
npm run lint     # oxlint
```

The build uses `base: './'` so `dist/` assets use relative paths and can be hosted from any subpath.