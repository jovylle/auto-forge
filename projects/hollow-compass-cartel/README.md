# Hollow Compass Cartel

Chart trade routes across a shifting foggy archipelago with a living compass. Sci-fi-terminal tide-trading experiment — canvas + CSS only, zero images.

## Open

- Double-click `index.html`, or serve statically: `npx serve .` / `python3 -m http.server`
- Works from `file://` and any static host. No build, no keys.

## Play

- **SAIL mode** — click any lit water hex (or arrow keys / WASD / helm pad) to sail. Fog lifts in a 2-league radius; supplies burn per league. Hailing a port pays +15cr, +6 supplies.
- **CHART mode** — click a lit port ⚓, then a second port. A glowing trade route is inked over the shortest water passage; profit scales with length + unknown waters crossed + tide.
- **Living compass** — tide phase breathes over time and slips ±24° of declination; the needle wobbles, the map drifts, helm steps bend in heavy tide.
- **Sonar pulse** (−4 supplies) bursts fog back in a 4-league radius.
- **Win** — reach 400cr, or 4+ routes with 45%+ charted, to take the Cartel Crown.

## Scroll = tide

Scrolling the page physically tugs the tide (`tide += scrollDelta`), shifts the compass, parallaxes the background grid, and reveals lore sections via IntersectionObserver.

## Rival seeds

- Every chart is a seed (`#SEED`). `COPY RIVAL LINK` copies a URL with the seed — rivals load the identical fog, ports, and lies.
- Type a seed into the SEED box + Enter to jump charts. Progress persists in `localStorage`.

## Files

`index.html` · `style.css` · `app.js` — Google Fonts via `@import` only; everything else procedural canvas.
