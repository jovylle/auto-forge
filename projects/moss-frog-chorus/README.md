# Moss Frog Chorus

Tap lily pads to layer synthesized frog croaks into an evolving polyrhythmic pond chorus. Bauhaus-style pond console: black rules, primary shapes, hard shadows.

## Open

No build, no dependencies. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder → open the printed URL.

Works from `file://`. System fonts only, WebAudio only — zero network requests.

## Play (under 30 seconds)

1. Press **▶ START CHORUS** (or `Space`). Eight frogs loop on polyrhythmic cycles (16/12/9/8/7/6/5/4 steps).
2. **Tap pads** (or keys `1`–`8`) to croak live over the loop.
3. **Click steps** in the lanes to compose; speaker button mutes a frog.
4. Drag **PITCH** (±12 st) and **POND REVERB** sliders. Leave **auto-evolve** on and the pond mutates one lane every N bars.
5. Hit **● REC LOOP**, jam, hit **■ STOP** — play back, download `.webm`, or **copy share link** (encodes tempo/pitch/reverb + every step in the URL hash).

Extras: `R` records, `preset` / `dice` / `clear` reshape the pond, typing `frog` summons a frog cascade. Pattern + sliders persist in `localStorage`; shared links restore via `#c=…`.

## Files

`index.html` · `style.css` · `app.js`
