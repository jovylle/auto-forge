# Tide Choir — A Harbor That Sings the Tide in Voices

Dark-fantasy generative rite. Six drowned voices sing through WebAudio; the tide, fog, and harbor bed mix beneath them. Canvas voice-waves glow over a moonlit harbor.

## How to open
- Double-click `index.html`, or serve statically: `python3 -m http.server` → open the page. Works from `file://`. No build, no npm, no keys.

## What it does
- **Voice waves** — canvas renders one glowing wave per voice (rune crests when singing) plus a tide body-wave and moon reflection. Silent voices are faint dotted ghosts.
- **Tide choir** — hold `A S D F G H` to sing six voices (Buoy Bell 110Hz → Moon Oyster 220Hz, detuned saw/triangle/square + ghost octave + LFO filter). Release to drown them. `Space` (hold) = storm surge swell.
- **Harbor mix** — `Q/W` tide (deep drone + wave height + filter), `Z/X` fog (generated-impulse reverb), `V/B` harbor bed (water noise + random fog-bells). `1/2/3` presets: low-tide vigil / storm vigil / moon crossing. `R` autonomous ritual (generative choir), `C` casts a short generative hymn, `M` mute, `?` speaks the grimoire.

## Constraints honored
- **Keyboard only** — every feature is a keystroke; skip-link + aria-live announcements + visible focus; tested layout at 375px (stalls collapse 6→3, meters stack).
- **One interaction type: type** — zero click/drag/pointer/touch listeners; only `keydown`/`keyup` (+resize/blur helpers).

## Persistence
Tide/fog/harbor levels + hymn count persist in `localStorage` (`tide-choir-v1`).

## Files
`index.html` · `style.css` · `app.js`
