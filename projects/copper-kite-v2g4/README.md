# Copper Kite 銅凧

Fly a kite that telegraphs the wind — a japanese-cyberpunk generative toy.

## Open

No build, no backend. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `npx serve .` / `python3 -m http.server` then open the page.

## What it does

- **wind sim** — layered sine-field wind with base speed, turbulence, direction, auto-gusts, and a manual GUST pump. Rendered as teal streak particles (neon red when gusty).
- **kite canvas** — canvas kite on a copper string with lift/gravity physics, sagging wire, ribbon tail, moon + Kyoto rooftop skyline + torii silhouette. Drag the sky to steer; `←/→` trims direction, `G`/`Space` pumps.
- **gust code** — gusts emit ・/ー down the wire as sparks, decoded into katakana (ア イ ウ … 風 凧 銅) in the ticker + transmission log. Copy button exports; settings + last 24 transmissions persist in `localStorage`.

## Constraints

3 colors max (+ black/white): copper `#E0803A` · teal `#27E0C8` · neon `#FF2D55` · ink black `#0B0B10` · paper `#F5F1E8`. Grays are only black/white at opacity.

## Files

`index.html` · `style.css` · `app.js`
