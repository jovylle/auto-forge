# Kerning Karaoke

Sing to space letters — nail the pitch to kern kinetic lyrics perfectly.

## How to open

No build, no backend. Just open `index.html` in a browser (double-click works from `file://`),
or serve statically: `python3 -m http.server` then visit `http://localhost:8000/index.html`.

Mic access needs a secure context: `localhost` or `https` (or allow mic for `file://` in browser settings).
No mic? The **hum pad** works everywhere — drag it or move the slider.

## What it does

- **Mic pitch → letter-spacing, live.** Autocorrelation pitch detection maps cents-off-target to `letter-spacing`: on-pitch singing snaps glyphs tight, drifting flat/sharp blows them wide with wobble.
- **Kinetic variable-font lyrics.** Each lyric line splits into per-character spans animated on a sine wave; weight (`wght`) and glow tighten as you approach the target note. Fire mode (combo ≥ 4) turns letters gold.
- **Combo scoring.** ±50¢ = PERFECT KERN (+300 × combo), ±150¢ = tight (+100), wider = combo resets. 3 tracks × 4 lines each, karaoke progress bar, target-note readout, live pitch needle meter.
- **Shareable encore cards.** End-of-song modal renders a procedural **canvas-only** card (gradient + orbs + grade + score + lyric quote + confetti — zero image files) with **⬇ PNG download**, **⧉ copy caption**, and **↗ Web Share** buttons. Best score persists in `localStorage`.

Extras: auto-demo mode (perfect-pitch robot singer), hum-pad synth fallback with vibrato, song chart checklist, responsive down to 375px, `prefers-reduced-motion` support.

## Files

- `index.html` — glassmorphism stage, pitch meter, hum pad, encore modal
- `style.css` — palette, glass panels, orbs, animations (Google Fonts `@import`, offline fallback to system fonts)
- `app.js` — pitch detection, game loop, scoring, canvas encore card
