# Dune Wren Observatory

> Wrens chart the stars from dune scopes.

A pop-art night-sky viz: an interactive star chart with 5 wren constellations (~550 stars),
three dune telescopes ("scopes") that slew the chart, and a night-export strip
(PNG poster, Markdown observing log, shareable night link). All state persists in
`localStorage` — no backend, no keys.

## Run

```sh
npm run dev      # local dev
npm run build    # production build → dist/
npm run preview  # serve the build
```

## Features

- **Star chart** — canvas sky: drag to pan, scroll to zoom, click stars for lore,
  night-hour slider rotates the sky, toggles for lines / names / wrens / meteors,
  name search, full keyboard support (arrows, +/−, Enter). Wrens hop along
  constellation edges; meteors streak overhead.
- **Dune scopes** — Scope-01 "Wide-Eye" (wide field), Scope-02 "Pinpoint" (deep zoom),
  Scope-03 "Comet Sweeper" (meteor watch). Switching slews the chart with a comic ZOOM! wipe.
- **Night export** — PNG poster (chart + caption bar), `.md` observing log
  (logged stars, notes, scope, sky position), copyable night link (`#n=…` restores
  the exact sky), plus named saved nights in `localStorage`.

## Constraints honored

- **3 colors max + black/white**: `#FF2D55` pop red, `#FFC700` dune yellow,
  `#2B44FF` scope blue, plus `#0D0D0D` ink and `#FFFFFF` white. Muted tones use
  black/white alpha overlays only — no gray hexes, no extra hues.
- **System fonts only**: `Arial Black` / system-ui / ui-monospace stacks.
  No webfonts, no external requests.

## Layout

Asymmetric pop-art: rotated logo block, 62/38 chart-vs-rail grid with an offset
control rail, zig-zag staggered scope cards, diagonal export strip, Ben-Day dot
textures, chunky outlined panels and squishy buttons. Respects
`prefers-reduced-motion`.
