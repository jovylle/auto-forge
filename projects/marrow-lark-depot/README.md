# Marrow Lark Depot

A dark-fantasy supply-depot tool where larks keep the marrow-bone crypts full.
Ledger, shifts, and depot map in one candlelit scroll.

## Features

- **Stock ledger** — marrow-bone entries with ＋/－ steppers, `PROVISIONED` /
  `WANING` (≤3) / `BARE` (0) status stamps, two-press Strike removal, click-only
  "Carve entry" preset picker, sticky Bone Totals rail with per-zone sums and
  one-press ＋5 restock for waning shelves.
- **Lark shifts** — roster of larks perched across four vigils (Dawn Vigil,
  Ember Watch, Dusk Round, Night Hollow) via toggle chips, capacity bar,
  click-only "Hatch a lark" name picker, fly-off release.
- **Depot map** — SVG cathedral floor plan (Hollow Nave, Ember Vault,
  Moss Cloister, Blood Pantry, Gnawed Gallery); zone fill tracks stock, pips
  mark five bones apiece; pressing a zone narrows the ledger (focus mode).

## Constraints honored

- **Click-only** — no text inputs, no selects, no drag. Every control is a
  `<button>` (map zones are keyboard-operable `role="button"` groups).
- **Reacts to scroll** — ember progress thread, rune-rail section nav with
  active/passed states, IntersectionObserver reveals, parallax hero glow and
  watermark numerals, compressing sticky ledger header, sticky totals rail and
  legend chip, scroll-gated back-to-top.

## Persistence

State (stocks + larks) is stored in `localStorage` under `marrow-lark-depot-v1`.
"Re-carve to the old count" restores the seed depot.

## Run

No `npm install` needed — dependencies are vendored in `node_modules/`.

- `npm run dev` — local dev server
- `npm run build` — typecheck (`tsc -b`) + production build to `dist/`
- `npm run preview` — serve the production build

`vite.config.ts` keeps `base: './'` so `dist/` works under subpath hosting.

## Stack

Vite + React 19 + TypeScript + Tailwind CSS v4. Fonts: Grenze Gotisch
(display), Alegreya / Alegreya SC (body / labels) via Google Fonts import.
Palette: pit `#0C0A08`, bone `#EADFC8`, blood `#7E1F2D`, ember `#C6641E` /
`#E8963F`, moss `#5F7042` / `#A3B77A` — no default indigo/gray/white.

## Structure

- `index.html` — entry, relative asset paths
- `src/main.tsx` — React root
- `src/App.tsx` — entire app (ledger, perches, map, scroll engine)
- `src/index.css` — design tokens (`@theme`), keyframes, reveal/parallax styles
- `public/favicon.svg` — depot seal
