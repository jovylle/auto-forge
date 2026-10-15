# Hazel Dormouse Disco — ヘーゼルヤマネ・ディスコ

A pocket neon step-sequencer. The sleepiest DJ in Neo-Kyoto is a hazel dormouse —
**click lantern pads** to program his 4-track light-dance, press PLAY, watch him bop.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder → open the printed URL.

Works from `file://` and any static host. Internet optional (only used for Google Fonts;
offline fallback is system fonts).

## What it does

- **Core interaction (click ONLY):** 4 tracks × 8 steps of lantern pads —
  ドン taiko kick, シャン hat, ベース bass, 星 lead. Clicking a pad toggles it and
  previews its sound. No keyboard, no drag, no text fields anywhere.
- **Polished UI:** japanese-cyberpunk neon sign (flicker animation), SVG dormouse DJ
  who dances while playing, groove score + rank ladder (見習い → 神 neon-kami),
  FEVER mode at 70+, playhead dots, neon-rain canvas that bursts on every hit,
  responsive down to 375px, `prefers-reduced-motion` respected.
- **Sound:** 100% synthesized WebAudio — pitch-drop kick, filtered-noise hat,
  saw bass on an A–F–G drive progression, pentatonic triangle lead with delay echo.
  Zero audio assets. Lookahead scheduler (25 ms / 120 ms) for tight timing.
- **Share / export:**
  - `⛓ COPY DISCO LINK` — encodes pattern + BPM into a `#d=` URL-hash link;
    opening the link loads the exact pattern.
  - `⬇ DOWNLOAD .JSON` — saves the pattern to disk.
  - Auto-persists to `localStorage` on every change.
- **Extras:** tempo ± (80–160 BPM), dice randomizer, clear, 3 house patterns
  (真夜中 midnight / 電車 last-train / 祭り matsuri).

## Files

`index.html` · `style.css` · `app.js` — plus `SPEC.md` (the brief).
