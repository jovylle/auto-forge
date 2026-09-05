# ICE_MELT // CRYO-MONITOR

Watch a glacier melt — in real time, by scrolling.

A sci-fi terminal visualization of the cryosphere from 1900 → 2100. The page is a time axis:
**scroll down to advance the year** and watch the glacier calve, the sea rise, the sun burn.

## Open it

Just open `index.html` in a browser. No build, no dependencies, works from `file://` or any static host.

```bash
open index.html
```

## What it does

- **Melt sim** — canvas-rendered ice sheet driven by an anchor-point model (temperature
  anomaly → ice volume → sea level). Calving chunks, melt drips, splash ripples, drifting
  snow (cold years) and heat embers (hot years).
- **Year scrubber** — bottom slider, fully synced with scroll. Drag it and the page scrolls
  to match; scroll and the slider follows.
- **Sea-level meter** — left gauge, 0 → 1.0 m of rise, color shifts cyan → amber → red.
- Telemetry panel (ΔT anomaly, ice remaining, status), a right-edge timeline rail, a typed
  boot sequence, scanlines + flicker for the CRT feel.

## Controls

| Input | Effect |
|-------|--------|
| Scroll | Travel forward/backward through time (1900–2100) |
| Slider | Jump to any year |
| Click / any key | Skip boot screen |

`prefers-reduced-motion` is respected (fewer particles, no flicker).

## Files

- `index.html` — page + HUD shell
- `style.css` — sci-fi terminal aesthetic, responsive (down to 375px)
- `app.js` — sim, rendering, scroll/slider sync, boot