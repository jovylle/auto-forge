# Midnight Trolley Ledger

Balance the books of a night trolley. A click-only fare ledger for car nº 7 — no typing on this car.

## Features

- **Fare log** — punch coin-denomination tickets (25¢–$3) onto a paper tape; each row stamps time, route, fare. Click a row to void / un-void.
- **Night routes** — Owl Line, Harbor Loop, Ember Run, Veil Express on a side rail with live per-route fare counts and stop lists.
- **Ledger totals** — click the total card to cycle shift / by-route / voided views; PUNCH settles the shift into history. Persists to localStorage.

## Use

Everything is a button. Pick a route, punch fares, click the total to switch views, settle the shift, tear off the tape (two clicks to confirm).

## Dev

```sh
npm run dev      # local dev
npm run build    # typecheck + production build
npm run preview  # serve dist/
```

## Constraints

- **Click only** — zero inputs, textareas, selects, or drag handlers anywhere.
- **Palette** — ink `#0e0e10` (≈black), paper `#f5f2ea` (≈white), plus lamp `#e8a33d`, oxide `#c13b2a`, moss `#7fb069`.
- Extreme-minimal: Instrument Serif display + Spline Sans Mono, asymmetric rail / tape / fare-box layout.
