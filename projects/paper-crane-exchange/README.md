# ◤ Paper Crane Exchange

A cyberpunk social toy: **fold digital paper cranes, ink them with messages, launch them into a neon skystream, and catch what the city sends back.**

## How to open
- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder → open `http://localhost:8000`
- No build, no npm, no backend. Works from `file://`.

## What it does
- **Fold bay (§01):** complete 4 origami folds in order (I→IV) on the paper, pick a message + callsign + wrap frequency (color), then launch. Launch animates the paper flying off and adds your crane to the flock.
- **Skystream (§02):** grid of airborne / mine / kept cranes. Click any card to **catch** it — read the ghost's message, keep it (♥) or release it. Filter chips included.
- **Export deck (§03):** live transmission card + copy share-link (crane encoded in URL hash `#c=…` — anyone opening it catches your exact fold), copy text card, export PNG (canvas-rendered poster), export flock JSON.
- **Persistence:** cranes live in `localStorage` (`paper-crane-exchange-v1`); 12 seeded ghost cranes on first run.

## Constraints
- **Reacts to scroll:** full-page canvas sky — gradient districts, receding grid floor, sun position, rain density, crane speed/banking all driven by scroll position + scroll velocity (wind meter in the stream bar). Content panels reveal on scroll.
- **Sound on interaction:** all WebAudio-synthesized (no assets) — fold creaks, typing ticks, launch whoosh, catch chime, keep arpeggio. Toggle in HUD (`♪ ON/OFF`).

## Files
`index.html` · `style.css` · `app.js` · `README.md` · `.factory/result.json`
