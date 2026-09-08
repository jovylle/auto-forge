# Receipt Oracle — expense fortune teller

A steampunk divination engine for your money. Ink your real expenses into the brass
ledger desk, then **scroll** and let the Oracle read the receipts: it casts your
dominant spending element, quotes omens drawn from the actual items you bought, and
turns the dials on your financial peril, heat, and diligence.

Stack: Vite + React + TypeScript + Tailwind CSS v4. No backend, no API keys —
receipts live in `localStorage`.

## Run

```bash
npm run dev      # local dev
npm run build    # typecheck (tsc -b) + production build into dist/
npm run preview  # serve the built app
```

## Features

- **Core interaction** — add / edit / delete expense receipts (name, amount,
  category, date) on the Ledger Desk. The reading is computed live from whatever
  is inked, with seeded (deterministic) fortune text so a given ledger always
  reads the same.
- **Scroll-reactive reading** — the divination stage is a 400vh scroll journey: a
  sticky brass pin holds the Oracle eye (which dilates), the opening line, the
  category ledger bars, the omens, and a triple dial cluster (Peril / Heat /
  Diligence). Every stanza fades in from ink-blur as you scroll; needle rotation
  and pupil dilation track window scroll progress via a rAF-throttled handler.
- **Polished steampunk UI** — warm umber/brass/copper/parchment palette, brass
  bevel plates with rivet frames, engraved small-caps headings, parchment grain,
  ambient gear-dust parallax, gear emblem idle-spin, receipt stamp animation.
  System fonts only (no webfonts). Full `prefers-reduced-motion` fallback.
- **Share / export** — "Copy Share-Link" packs the whole ledger into a URL-safe
  token (`?o=`); opening that link restores the reading. "Export Poster" downloads
  a self-contained HTML poster of the augury with all styles inlined.

## Project layout

```
src/
  App.tsx                    scroll-progress + layout shell + localStorage
  components/LedgerDesk.tsx  the ink form + receipt list
  components/OracleReading.tsx  scroll stage, dials, share/export
  lib/oracle.ts              pure logic: aggregation, seeded PRNG, fortune, share codec
  index.css                  Tailwind v4 import + steampunk design system
```

## Notes

- `base: './'` in `vite.config.ts` keeps `dist/` assets relative so the build can
  be hosted from a subpath (`/p/<slug>/`).
- The fortune is deterministic: the PRNG seed is a hash of the ledger totals, so
  a shared link reproduces the exact same reading.
- Receipts persist under the `receipt-oracle:receipts:v1` localStorage key.