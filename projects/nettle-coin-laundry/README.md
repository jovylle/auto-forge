# 根 Nettle Coin Laundry

A **japanese-minimal day-shift game**: run a tiny coin laundry for 90 seconds. Load baskets into five machines, tap them to agitate, collect finished loads before the combo cools — and watch out for the itchy **nettle イガ loads** that pay double.

## Open it

No build, no dependencies, no backend. The Google Fonts `@import` degrades gracefully offline.

```bash
open index.html            # or just double-click it
# or serve it:
python3 -m http.server 8731
```

Works from `file://` and any static host. Plays at desktop width and at 375px (machines become a 2-column grid, vertical side-text hides).

## How to play

1. **開店 OPEN SHOP** — starts the 90-second day. Baskets arrive on the counter (max 4; extras walk away).
2. Click an **empty machine (あき)** to load the next basket — costs 1 coin.
3. While it washes, **tap the machine to agitate** (−0.3s per tap, short cooldown). progress ring + water fill show the cycle.
4. When it flashes **できあがり DONE** (ding + shake + steam), click to collect: **+2 coins, +10 pts**. Collect quickly in succession to build a **combo 連** (up to +10 bonus pts).
5. **Nettle loads** take 12s instead of 8s but pay **+4 coins, +20 pts**.
6. Broke? The first penniless load is **on the house (おまけ)**. At closing time, unfinished loads auto-finish at half pay.

Ranks, stamped hanko-style on your day sheet: 見習い apprentice → 番頭 clerk → 職人 artisan → 達人 master.

## Features

- **core interaction** — 5-machine load/agitate/collect loop with queue pressure, combo timing, and nettle risk/reward, all on a 90-second day clock.
- **polished UI** — noren curtain header, vertical Japanese side-text, hanko stamp buttons, spinning drums with rising water, steam puffs, shake-on-done, and a slam-in rank stamp.
- **share/export** — ⧉ COPY RECORD puts a day summary on the clipboard (with `execCommand` fallback for `file://`), ↓ RECEIPT downloads a text receipt of the day, and best score + day count persist in `localStorage` (`ncl.best`, `ncl.day`).

## Constraints honored

- **3 colors max + black/white** — shu red `#BE3A1E`, nettle green `#5C7F3E`, ai indigo `#2E4E7E`, plus paper-white `#F5F0E2` and sumi-black `#22241F`. All tints are opacity mixes of these tokens.
- **Sound on interaction** — every sound is synthesized live with WebAudio (coin clink, load thump, bubble blips, completion ding, collect chimes, closing jingle). No audio files. Toggle with ♪ SOUND.
