# Hi-Hat Habitat

Breed tiny hi-hat patterns that evolve into glitchy rhythms.

## Open

No build, no dependencies. Either:

- double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000`

Works from `file://` (Google Fonts needs network; the app works offline without it).

## What it does

- **Evolving hat sequencer** — 16-step loop on a lookahead WebAudio scheduler. Every bar-end, the pattern drifts by a few genes when auto-evolve is on (generation counter ticks).
- **Tap to mutate** — tap any egg to cycle empty → closed → accent → open, with instant audition. The ☄ mutate button blasts the whole pattern.
- **WebAudio synthesis** — 100% synthesized: filtered noise-burst hats (closed/accent/open), stereo scatter, dubby feedback-delay tails, and drift-driven 32nd-note glitch stutters. No samples.
- **Shareable rhythm seeds** — every pattern encodes to `XXXX.16digits.bpm`. Copy link (URL `?s=`) to share the exact rhythm; paste a seed back to load it. Persists to localStorage.
- **Spawn clutch** — generates 3 mutated hatchlings (±25/55/90%); tap one to adopt it.

## 30-second start

Hit **play** (or spacebar) → tap eggs → crank **drift** → spawn a clutch.

## Files

`index.html` · `style.css` · `app.js` — plus `SPEC.md`.
