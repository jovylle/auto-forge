# Neon Cartogram Drift

Plot drifting districts on a neon grid and trade routes to win. Organic-brutalist field game, plain HTML/CSS/JS, no build, no backend.

## Open

Just open `index.html` in a browser (double-click works — `file://` safe), or serve the folder statically:

```sh
npx serve .   # or: python3 -m http.server
```

## How to play

- **Drag districts** — grab a wobbling blob and drop it on any empty tile. Districts also drift on their own every tide; anchor them on rich soil (◍ pips).
- **Draw trade routes** — tap one blob then another (or drag a blob onto a blob) to link them, max 6. Routes pay every tide: goods + soil − distance. Tap a route line (or its ledger row) to cut it.
- **Fog reveals tiles** — fog hides soil values. Districts reveal the 8 tiles around them; routes light their path. **Pulse ◉** burns 3◦ to sonar-scan distant fog (2-tide cooldown).
- **Daily seed challenge** — the game boots on today's seed (`★ DAILY`); same map for everyone that day. Reach quota before tide 20. Best score per map and daily streak persist in `localStorage`.

Controls: `drift ▸` (or `Space`) advances one tide · `auto` toggles 3.5s tides · `Esc` closes dialogs / cancels a link.

## Constraints honored

- 3 colors max + black/white: lime `#b8ff29`, teal `#2de1a7`, ember `#ff5a1f` on ink `#0b0e0a` / paper `#f4f6ec` (alpha tints of the same inks only).
- System fonts only — no external fonts, no external requests at all.
- Responsive down to 375px (masthead and board stack vertically).
