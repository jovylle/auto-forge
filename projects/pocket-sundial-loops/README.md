# Pocket Sundial Loops

Loop tiny sundials across history to remix daylight into ambient patterns. Cyberpunk daylight remixer — drag the sun across the sky arc, flip through 12 historic dial styles, let shadows smear into loopable neon trails, export the loop as a GIF.

## Open

No build, no deps. Works from `file://` and any static host:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` then open the page.

## What it does

- **Drag sun to scrub time** — drag the glowing orb along the sky track, click the track, drag the TIME slider, or use `←`/`→` (5 min, `Shift` = 1 hr, `Home`/`End` = dawn/dusk). Sun orb is a real `role="slider"` so screen readers + keyboard work.
- **12 historic dial styles** — Egyptian shadow bar, Babylonian hemisphere, Greek skaphe, Roman horizontal, Chinese equatorial ring, Islamic qibla, medieval mass dial, Renaissance garden, polar plane, vertical south wall, analemmatic ellipse, plus a 2077 Neon Grid remix. Keys `1–9`, `0`, `Q`, `W` switch; arrow keys work inside the dial grid.
- **Loopable shadow trails** — `≋ trails` toggle + trail-length / glow-fade sliders; `◌ loop` records your scrubbing for 4/8/12 s then plays it back forever (`L`), with a progress meter and `● LOOP` badge. Ambient remix rings pulse off trail spread; optional WebAudio daylight drone (`M`).
- **Export GIF snapshots** — `⬇ export GIF` (`E`) sweeps a full day into 12 frames and encodes a looping GIF89a **locally in-page** (built-in 256-color 3-3-2 + LZW encoder, zero deps, no uploads); `PNG still` (`S`) grabs the canvas. Thumbnails stack below with `save` links.

State (dial, time, trails, remix) autosaves to `localStorage`.

## Keyboard map

`←`/`→` scrub · `Shift` hour jump · `Home`/`End` dawn/dusk · `Space` auto-cycle · `1–0 Q W` dials · `L` record/play loop · `T` trails · `R` clear trails · `E` GIF · `S` PNG · `M` drone · `Esc` close dialog · `Tab` reaches everything.

## Constraints

- No images — CSS gradients + canvas 2D only (snapshot `<img>`s are runtime-generated from your own canvas).
- Keyboard-only operable; `prefers-reduced-motion` disables pulse/blink.
- Responsive down to 375 px (single column, 2-up dial grid).
