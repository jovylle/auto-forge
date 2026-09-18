# Wobble Choir Lab — ゆらぎ合唱

Stack wobbly oscillators into a playable choir with morphing vowels. Japanese-minimal generative toy. No build, no backend, no images (CSS + canvas only).

## Open

- Double-click `index.html`, or serve statically: `python3 -m http.server` → open the page.
- Works from `file://`. Google Fonts degrade gracefully offline.

## What it does

1. **Drag blobs to pitch-shift** — five ink blobs (Sora, Kaze, Mori, Hoshi, Umi). Vertical drag retunes (quantized to C major, note name shown on the blob); horizontal drag bends wobble depth + brightness. Tap a blob for a solo blip. Arrow keys work when a blob is focused.
2. **Morph vowel with one slider** — ア→エ→イ→オ→ウ. Each voice runs its saw/sub stack through a 3-formant bandpass bank interpolated live between vowel formants.
3. **Loop 4-bar jam** — 16-step × 5-voice grid, lookahead scheduler, tempo 60–160, three presets (Still Water / Festival / Night Rain) + clear.
4. **One-click record** — `MediaRecorder` on a `MediaStreamDestination` tapped from the master compressor; produces a downloadable take (webm/m4a depending on browser).

## Scroll

Scroll is a breath controller: a vermillion progress hairline, section reveals, the hero enso grows/rotates, and scroll depth opens the master lowpass "air" filter (900 Hz → ~10 kHz). Dust particles drift on the choir canvas.

## Persistence

Voices, vowel, tempo, and grid auto-save to `localStorage` (`wobble-choir-v1`).

## Files

`index.html` · `style.css` · `app.js`
