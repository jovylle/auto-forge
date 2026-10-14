# Cinder Sparrow Parlor

> Sparrows trade gossip over warm cinders.

A neo-brutalist social trading game. You hold one gossip card. Three sparrow
patrons make offers — match their cravings for **warm trades**, stoke the
ember seats to multiply your warmth, and pin the best gossip to the flock board.

## Play in 30 seconds

1. **Whisper** — type your own gossip (or keep the one in your beak).
2. **Trade** — hit ⇄ TRADE on any sparrow offer. Matching its craving = warm
   trade with bonus warmth.
3. **Stoke** — tap 🔥 STOKE on ember seats. Each lit seat adds ×0.25 to warm
   trades. Embers cool over time, so keep feeding them.

Warmth ranks: COLD EGG → WARM CHICK (15°) → CINDER REGULAR (40°) → PARLOR LEGEND (80°).

## Features

- **Gossip trade** — 3 live offers from sparrows with cravings (SPICY / SWEET /
  DARK / SILLY); flavor-match scoring with ember multiplier; fresh sparrow
  rotates in after every trade; 🪑 SEAT invites a trader to an empty perch.
- **Ember seats** — 6 seats around an animated fire pit; stoke 0→3, cooling tick
  every 6s, lit seats boost trades.
- **Flock board** — every collected gossip lands here; chirp (upvote) notes,
  pin your hand, sort by fresh / top chirps. Persists in localStorage.
- **Sound on interaction** — pure WebAudio synth (chirps, crackles, warm chords,
  fanfares). No audio assets. Toggle in header, persisted.
- Session clock + 3-step coach strip prove the 30-second loop.

## Tech

Vite + React + TypeScript + Tailwind CSS v4. No backend — state in localStorage
under `cinder-sparrow:*` keys. Fonts via Google Fonts `@import`
(Archivo Black, Space Grotesk, Space Mono).

```sh
npm run dev      # local dev
npm run build    # production build → dist/
npm run preview  # serve dist/
```
