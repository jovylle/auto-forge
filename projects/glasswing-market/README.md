# Glasswing Market

A cottagecore trading game: trade transparent butterfly goods beneath glass awnings, over 7 market days.

## How to open

Just open `index.html` in any browser — double-click it, or serve the folder:

```sh
cd projects/glasswing-market
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build, no npm, no backend. Works from `file://` and any static host. (Google Fonts load when online; the game falls back to Georgia/system fonts offline.)

## What it does

- **Glass stalls (4)** — Bramble & Dew, Petalwing Pantry, Chrysalis Curios, Moonmoth Provisions. Frosted-glass cards with striped awnings, keepers, daily-drifting prices with trend arrows (▲▼•), and limited stock.
- **Wing trade** — Buy 8 wing-goods (Glasswing Shard → Amber Skipper Jam), sell to the best stall bid, **haggle** once per stall per day (60% charm for −15%, else +5%), and **deliver villager orders** from the order board for coins + renown.
- **Market score** — HUD tracks Day, Dew coins, Renown, and Collection (8 goods). Ring the bell through day 7 for the season tally: coins + renown×10 + collection bonus, a rank title (Wandering Forager → Glasswing Royalty), and a persistent best score.
- Progress auto-saves to `localStorage`; "New game" restarts.

## Files

`index.html` · `style.css` · `app.js` (plain script, no modules) · `SPEC.md`
