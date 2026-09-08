# Receipt Oracle — expense fortune teller

A dark-fantasy tool where you "ink thy expenses" and let a candle-lit oracle read what
the ledger foretells. Vite + React + TypeScript + Tailwind v4, localStorage only —
no backend, no API keys, no cloud.

## Run it

```bash
npm run dev       # local dev server
npm run build     # typecheck + production build → dist/
npm run preview   # serve the production build
```

`base: './'` keeps `dist/` asset paths relative so the app hosts under any subpath.

## How it works

1. **The desk** — add receipts (merchant, amount, category) through the tilted Offering
   Desk. The ledger tracks the running total; rows stamp in as they're inked, delete
   individually, or burn the whole ledger to ash.
2. **The descent** — a 500vh scroll ritual with a sticky stage. Scrolling drives the
   whole divination: chapter headings and per-expense omens unseal at thresholds, the
   category scales (meters) fill, the oracle's eye opens, the verdict is revealed, and
   the ashes band offers the share/export actions. The sigil rotates and the candle
   glow waxes with scroll progress. `prefers-reduced-motion` is respected.
3. **Share / export**
   - **Share-link** — copies a URL whose `#o=` fragment encodes the exact ledger and
     reading seed (base64url, zero requests). Opening it offers to adopt the foreign
     ledger.
   - **Poster** — downloads a self-contained 1080×1440 PNG augury (canvas-drawn,
     categories, verdict, sealed date) of the current reading.
   - **Consult again** — re-rolls the oracle's verdict from a fresh seed.

## The easter egg

The oracle slumbers inside its sigil. Touch the **eye** seven times and it awakens:
the accents invert to witchfire, the room cools, the eye ignites, and an eighth
omen — *The Unseen Ledger* — is appended to every verdict, naming the expense you
refuse to name. The awakening persists in localStorage and can be extinguished from
the footer. (The eye's aria-label hints at how many touches remain.)

## Data & privacy

Everything persists in `localStorage` (`receipt-oracle.ledger.v1`,
`receipt-oracle.awakened.v1`). No analytics, no network calls beyond the Google
Fonts stylesheet.

## Notes

- Built with Tailwind v4 (`@import "tailwindcss"`) plus custom CSS in `src/index.css`.
- Share tokens are validated on import (schema + bounds) before a ledger is adopted.
- The reading is deterministic per ledger + seed, so a shared link reproduces the
  same omens and verdict.