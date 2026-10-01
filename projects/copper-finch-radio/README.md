# Copper Finch Radio

Trade dawn choruses with fellow finches. A dark-fantasy single-file web experiment.

## Open

Just open `index.html` in a browser (works from `file://`, no server needed). Audio requires one click (browser autoplay policy) — hit **GO ON AIR** or **SING CHORUS**.

## What it does

- **I · Dawn Dial** — drag the brass ring (or ←/→ keys, or tap map perches) to pick one of 6 dawns (Owl's Last Hour → Late Risers). Each sets thicket, tempo, lore. Mist slider controls WebAudio reverb/delay.
- **II · Chorus Trade** — 8-step finch sequencer (tap = cycle pitch, shift-click = rest). Sing it (synthesized WebAudio chirps + waveform), randomize a wild motif, name it and **loose it to the winds**. Incoming trades from seed finches can be played, kept (♥ → roost), or answer-traded (reverses motif for call-and-response).
- **III · Flock Board** — pin cries, praise posts, clear your own. Persists to `localStorage` (`cfr-trades`, `cfr-board`, `cfr-motif`, `cfr-roost`).

## Notes

Single `index.html`, no deps except Google Fonts `@import` (graceful offline). 375px-friendly.
