# Moth Radio — night signals

A nocturnal social radio experiment. Tune through live-synthesized static,
catch drifting night signals from strangers, pin them in your specimen jar,
amplify/relay them, and broadcast your own into the night.

## Open

No build, no server. Either:

- double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder → http://localhost:8000

Works from `file://`. Persistence via `localStorage`.

## What it does

- **Core interaction — the tuner:** drag the brass needle (or ←/→ keys, or
  mousewheel over the tuner) across 87–109 MHz. Static (WebAudio noise)
  thins near a station; the meter burns amber on lock and a signal card
  reveals a message. 8 seeded stations + your own broadcasts.
- **Polished UI:** organic-brutalist — bark-black night, bone ink, amber/moss
  accents, Fraunces + Space Mono, tape-cornered panels, grain overlay,
  canvas starfield with drifting moth-specks, scroll-reveal + parallax.
- **Share/export:** relay a single signal (Web Share API w/ clipboard
  fallback, link carries the signal in `#s=`), share the whole night
  (`#night=` carries jar + broadcasts, mergeable by the recipient),
  copy jar as text, export jar as `.txt` / `.json`, inbound links show a
  merge banner. Release (delete) specimens individually or all at once.

## Constraints

- **Reacts to scroll:** progress bar, night hue deepens, drift-text quips
  morph, hero parallax, star twinkle + moth speed boost, reveal-on-scroll.
- **Easter egg:** tap the 🌕 moon 5× or type `luna` → the 👑 LUNA QUEEN
  station (93.3 MHz) unlocks with a moth eruption.

## Files

`index.html` · `style.css` · `app.js` (ES module, zero deps)
