# Looping Bell Foundry

Cast tiny bells onto a 24-hour ring. They loop forever — but the loop **re-roots itself to the real clock hour and the season**, so the same bells ring a different melody at dawn, noon and midnight.

Sci-fi-terminal aesthetic: phosphor green, scanlines, glowing foundry ring, live event log.

## How to open

No build, no server, no dependencies. Either:

- Double-click `index.html`, or
- Serve statically: `npx serve .` / `python3 -m http.server` and open the URL.

Works from `file://` (Google Fonts degrades gracefully offline).

## What it does

- **Cast bells on timeline** — click any of the 24 ring nodes (or timeline cells) to cast a bell; click a bell to reclaim it. Pick an alloy (Bronze / Iron / Glass / Void) and octave first. First touch also unlocks audio.
- **Loops shift with hour** — the tuning root follows the effective hour (`root = hour % 12`) and the mode follows the season (spring·lydian, summer·ionian, autumn·dorian, winter·aeolian). `LIVE` follows your real clock; switch to `MANUAL` and scrub the hour slider to time-travel.
- **Layer chimes visually** — every strike fires an expanding ripple on the canvas, flashes its alloy lane in the 4-track strata view, and lights the timeline cell; the playhead sweeps all three views in sync.
- **Export daily melody** — `WAV LOOP` renders one full 24-step loop (+ reverb tail) offline via `OfflineAudioContext` and downloads it; `JSON` downloads the score (bells, notes, tuning); `COPY SCORE` puts a text score on the clipboard.

State (bells, tempo, alloy, season mode) persists in `localStorage`.

## Constraints

Sound is 100% WebAudio-synthesized (additive bell partials + generated-impulse convolver reverb + clapper noise). Zero audio assets, zero network calls except the optional Google Fonts stylesheet.
