# ⬢ Hexlight Harbor Charts

Chart shifting islands, claim hexes, and run trade routes before the tide resets. Cyberpunk hex-strategy for one restless striker vs. Vanta Corp.

## Open

No build, no server. Either:

- double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` and visit the shown URL.

Works from `file://` (Google Fonts need network; game works without them).

## How to play

1. **Claim** — click a glowing isle / shoal / port to stake it (costs 1 energy, 14 per tide). Water and reef can't be claimed. Vanta Corp answers every claim.
2. **Route** — switch to ROUTE mode, tap one of YOUR hexes, chain adjacent isles, hit COMPLETE ROUTE. Score = cargo × length bonus + port doubles + all-yours bonus.
3. **Tide** — the island map is seeded by the date (`YYYY-MM-DD`). A countdown ticks to midnight, when a fresh chart generates. `↻ NEW TIDE` rolls a demo seed anytime. Progress saves per-tide in `localStorage`.
4. **Easter egg** — enter the Konami code, or click the harbor beacon 5 times… 🐙

## Palette (3 hues + black/white)

cyan `#00F0FF` (you) · magenta `#FF2E88` (vanta) · gold `#FFC857` (ports/score) on near-black.
