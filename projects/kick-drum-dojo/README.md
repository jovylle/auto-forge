# Kick Drum Dojo 🥋

Tap, layer, and battle beats in a tiny rhythm trainer toy. Zero samples — every drum is synthesized live with WebAudio.

## Open

No build, no server needed. Either:

- double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the URL.

Works at 375px mobile width.

## What it does

1. **16-step sequencer** — kick / snare / hat rows. Click steps, hit `▶ play`, drag tempo (70–180 BPM). Keys: `space` = play/stop, `1–4` = preset katas (four floor, boom bap, dembow, half-time). `shake 🎲` randomizes, `kata →` cycles, `tap-write` quantizes your pad taps live into the kick row.
2. **Tap trial (timing score)** — `start trial` plays 8 kicks at tempo; strike the big circle exactly on each. Judged PERFECT (±35ms) / GREAT (±80ms) / EARLY-LATE / MISS with accuracy %, average ms, and belt progression (white → yellow → green → brown → black 🥋, persisted).
3. **Synth drums** — kick (pitch-dropping sine + click), snare (noise + 190Hz body), hat (highpassed noise), all WebAudio, lookahead scheduler.
4. **Beat codes** — every pattern encodes to `KDD-XXXX.XXXX.XXXX@BPM` in the code box **and** the URL hash (`#b=…`). `copy` copies the shareable link; paste any code/link to load. State persists in localStorage.

## Easter egg

Enter the classic arcade code (↑↑↓↓←→←→BA) — or long-press the strike pad for 1.2s — to unlock **SENSEI MODE**: inverted theme, a hidden 4th drum (sensei bell 🔔) with its own sequencer row, encodable in beat codes (`+XXXX`). The footer warned you: *old arcade codes work here*.
