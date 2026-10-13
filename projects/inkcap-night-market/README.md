# Inkcap Night Market

Trade glowing mushrooms after midnight. A grunge trading game in plain HTML + CSS + JS — no build, no images, no backend.

## How to open

- Double-click `index.html`, or
- serve it statically: `python3 -m http.server` in this folder, then visit `http://localhost:8000/`

Works from `file://` (plain `<script>`, no modules, no fetch). Google Fonts `@import` needs network; the game plays fine offline with fallback fonts.

## What it does

- **Fungus stalls** — 6 stalls (Common Inkcap → Void Truffle), each with a CSS-only glowing mushroom, live price, trend arrow, sparkline history, crate stock, and buy/sell buttons.
- **Midnight deals** — an accelerated night clock (23:00 → 06:00 per ~90s night). When it strikes **00:00**, a 16-second deal fires: either a **fire sale** (buy one crate cheap) or a **buying frenzy** (sell one cap over the odds, or buy-and-flip if you're empty-handed).
- **Market score** — net worth (purse + inventory at live prices), rank ladder from Spore Drifter to Mycelium Monarch, plus trades / deals caught / realised profit / nights survived. Best score persists in `localStorage`.

Extra grunge & polish: flickering neon masthead, caution-tape ticker, torn-paper section stamps, canvas spore field, film-grain overlay, toasts, night ledger log, dawn rot for hoarders (more than 6 of a kind rots overnight), an 8% house cut on sales, sell-all button, fresh-night reset. Responsive down to 375px; respects `prefers-reduced-motion`.

## Files

`index.html` · `style.css` · `app.js` — that is the whole game.
