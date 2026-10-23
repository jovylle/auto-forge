# Brine Kettle Cantata

> A boiling kettle sings in salt water.

Click-only generative synth. Cyberpunk boil chamber: stoke heat, dose salt, pop bubbles to sing, export the cantata.

## Open

No build, no npm. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder, then open the URL.

Works from `file://`. Google Fonts needs network; offline fallback is monospace.

## What it does

- **Boil voices** — 4 WebAudio voices (saw/square/triangle/sine). Click bubbles in the chamber to pop them; each pop fires a voice pluck pitched from the movement scale. Clicking water plays a soft tap note.
- **Salt chorus** — SALT +/− controls chorus depth: detuned shimmer layers (up to +6), filter brightness, note decay. CHOIR ON/OFF toggles layers. Salt crystals pile on the chamber floor.
- **Cantata export** — ● RECORD TAKE captures live audio via MediaRecorder → ⬇ AUDIO (.webm). ⬇ SCORE (.json) downloads the full note ledger (time, voice, freq, salt, temp). ⬇ POSTER (.png) snapshots the canvas.
- **Extras** — HEAT LV.1–5 drives temp/bubble rate, 3 movements (Simmer / Roll / Brine Storm scales + tempi), AUTO-CANTATA sequencer, localStorage persists heat/salt/movement.

## Constraint

**Click-only.** Every control is a `<button>` or a canvas click. No sliders, no text inputs, no drag.

## Files

`index.html` · `style.css` · `app.js`
