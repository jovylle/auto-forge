# Hiss Harbor Choir

Tap tide pools to layer hisses, kicks and chimes into lo-fi loops.

## Open

No build, no server needed. Either:

- double-click `index.html`, or
- `python3 -m http.server` in this folder, then visit the printed URL.

Sound starts on your first tap (browser autoplay rule).

## What it does

- **Tap grid (pools):** 9 tide pools — 3 kicks, 3 hisses, 3 chimes — all synthesized live with WebAudio. Click or press `1`–`9`.
- **Stack loops:** press `S` (stack arm), start the loop with `Space`, then tap pools — taps quantize into the 8-step loop. The loop strip shows the selected pool's pattern; dots toggle steps.
- **Live FX:** tide (low-pass murk), drift (dub delay), grit (tape saturation), plus tempo `+/−`, vinyl hiss `V`, swing `W`. All persist to localStorage.
- **Tide remix (`R`):** randomizes layers, patterns, tempo and FX, then starts rolling.
- **Record + share (`O`):** one tap records a take (MediaRecorder off the master bus). Then listen, download the `.webm`, share via OS share sheet, or copy a loop link (`C`) — the full tide is encoded in the URL hash, so the link replays the exact loop.

## Keyboard only

Everything is a real button/slider: `Tab` reaches all of it, arrows move across pools and steps, sliders adjust with arrows when focused. Full chart is in the in-page "keyboard chart" disclosure.

## Files

Single-file build per constraint: `index.html` (inline CSS + JS). `app.js` / `style.css` are stubs.
