# Kelp Lantern Marina

> Light the marina with kelp lanterns.

A cottagecore tide-lit harbor, kept entirely in your browser. Hang glowing kelp
lanterns along two mossy piers, read the water by their swell, and post the whole
marina home on a shareable postcard. No servers — the harbor lives in
`localStorage`.

## Features

- **Lantern map** — an SVG cove with 12 berths on two piers. Click a lantern to
  light/douse it, rename the berth, and pick its glow (amber, ember, rosehip,
  pond light, moon milk…). Live lit-count, light-all / douse-all / firefly
  shuffle, all persisted.
- **Tide lights** — a synthetic harmonic tide (M2 + S2 + K1) drives a 24-hour
  canvas chart with high/low predictions, a "skim through the day" slider, and a
  follow-the-tide toggle that swells every lantern flame with the water.
  Harborer's log narrates the current watch in fathoms & thumbs.
- **Marina export** — a tilted postcard (name, lantern dots, tide line, stamp)
  plus logbook JSON download, one-click share link (whole marina encoded in the
  URL hash), logbook-entry copy, hash/JSON import, and a wild-tide reset.

## Constraints

- **Reacts to scroll** — a fixed "tide of scroll" gauge fills as you read, the
  hero pond rises, hanging lanterns parallax, and sections reveal on entry.
- **Easter egg** — old sailors click the moon five times… (a hidden 13th berth,
  a secret glow, and a night-watch otter).

## Run it

```bash
npm run dev      # local sketching
npm run build    # → dist/ (relative paths, serves under /p/<slug>/)
npm run preview  # serve the built harbor
```

Stack: Vite + TypeScript + Tailwind v4. Fonts (Fraunces, Caveat, Karla) load via
Google Fonts `@import` in `src/index.css`.
