# Pocket Sundial Loops

Loop tiny sundials across history to remix daylight into ambient patterns. Cyberpunk daylight-remixer: drag the sun across the sky, flip through 12 historic dials, grow loopable neon shadow trails, and export GIF snapshots — all canvas + CSS, no images.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` then open the page.

Works from `file://`.

## What it does

- **Drag sun to scrub time** — drag the glowing orb along its arc, drag the timeline, or use the range slider. Range 04:00–20:00 with live altitude readout.
- **12 historic dial styles** — Egyptian shadow clock, Babylonian hemisphere, Greek skaphe, Roman horizontal, Chinese equatorial ring, Islamic qibla, medieval mass dial, Renaissance garden, polar, vertical south, analemmatic, and a 2077 neon grid dial. Buttons or keys `1–9 0 Q W`.
- **Loopable shadow trails** — neon trail ribbons with adjustable length + glow fade, ambient remix rings driven by trail spread, REC/PLAY time loop (4/8/12 s) that replays your scrub performance, auto-cycle mode, optional daylight→hum drone.
- **Export GIF snapshots** — one-click animated GIF (12 frames, full dawn→dusk sweep, tiny built-in 3-3-2-palette GIF89a encoder, loops forever) plus PNG stills. Thumbnails with `save` links appear in-page.

## Keyboard only

Fully operable without a pointer: `Tab` to orb/slider/grid/buttons.

| Key | Action |
|---|---|
| `←`/`→` (`Shift` = 1 hr) | scrub 5 min |
| `Home`/`End` | dawn / dusk |
| `1`–`9`, `0`, `Q`, `W` | the 12 dials |
| `Space` | auto-cycle |
| `L` | record → play → stop loop |
| `T` / `R` | trails on/off, clear |
| `E` / `S` | GIF / PNG |
| `M` | drone |
| `Esc` | close help |

Dial grid also takes arrows. Sun orb is a `role=slider` with `aria-valuetext` time.

## Constraints

- No images — every visual is CSS gradients or `<canvas>` strokes. Google Fonts `@import` only.
- Keyboard-only path verified for every feature.
- `localStorage` (`pocket-sundial-loops`) persists dial, trails toggle, remix, and last time.
- Responsive down to 375 px (single column, 2-up dial grid).
