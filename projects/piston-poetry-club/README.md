# Piston Poetry Club — ピストン詩クラブ

Steam pistons hammer out verses. A japanese-cyberpunk generative poetry forge in plain HTML/CSS/JS — no build, no backend, no images (CSS + canvas only).

## How to open

- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder → `http://localhost:8000/`

Works from `file://` and any static host. Google Fonts `@import` needs internet; offline it falls back to serif/mono.

## What it does

- **Piston meter (壱)** — live steam-pressure gauge (0–100 kPa). Three CSS pistons hammer faster as pressure rises; zones: murmur / hammer / OVERDRIVE. Pressure decays via the valve-leak setting; 25 kPa per forge.
- **Verse engine (弐)** — generative neon-edo poetry in 3 forms: 俳句 haiku, 短歌 tanka, 電脳 free-cyber. Forging stamps lines out one-by-one with a hammer clack + steam puff. Pressure ≥75 kPa unlocks overdrive diction (chrome dragons, plasma torii). Re-roll, copy, recite (speechSynthesis), keep.
- **Poetry bellows (参)** — pump by clicking/holding PUMP, dragging across the bellows visual, or holding `Space`. Stoke (coal) and valve-leak sliders tune the physics; vent button + auto-stoker; 97+ kPa triggers an overpressure blowoff with screen shake.
- **Club anthology (四)** — kept verses persist in `localStorage`, exportable to `.txt`, burnable one-by-one or all.

Keys: `Space` hold = pump · `F` = forge · `V` = vent. Responsive down to 375px.
