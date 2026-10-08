# Chime Spiral Conservatory鐘螺旋

Grow musical spirals — each sampled tick blooms into an evolving melody.

## Open
- Double-click `index.html`, or serve statically: `python3 -m http.server` then visit `http://localhost:8000`.
- No build, no deps, works from `file://`. Sound is 100% synthesized Web Audio.

## What it does
- **Sampled tick sequencer (弐):** 16-step grid. Each active tick fires a procedurally "sampled" one-shot (Kachi woodblock / Suzu bell / Taiko drum) layered with a koto-ish pluck in a Japanese pentatonic scale (Miyako-bushi, In, Yō, Ryūkyū). Scatter / evolve mutate the pattern.
- **Spiral clock visualizer (壱):** Archimedean spiral with 16 nodes, sweeping clock hand, blooming petals per triggered note. Big ▶ button or click the canvas to play.
- **History scrub timeline (参):** every tap / loop / evolve is pressed into a 64-slot record with a density strip. Drag the scrub slider to preview any moment, then Restore or Branch.
- **One-click loop export:** renders 2 bars offline to `chime-spiral-loop.wav` download + copies pattern JSON to clipboard.
- State persists in `localStorage`.

## Easter egg 🥚
Click the red **hanko seal** (top-left) **5 times** — or type `matsu` — for moon-viewing mode (お月見): falling sakura, a haiku, and a secret descending lullaby.

## Files
`index.html` · `style.css` · `app.js`
