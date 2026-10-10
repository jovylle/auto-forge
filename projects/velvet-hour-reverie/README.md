# Velvet Hour Reverie

Paint looping clock chimes into ambient generative soundscapes that warp with time. Retro-wave aesthetic, pure WebAudio synthesis — no samples, no build, no backend.

## How to open

Just open `index.html` in any modern browser (double-click works — runs from `file://`), or serve statically:

```sh
cd projects/velvet-hour-reverie
python3 -m http.server 8080
# → http://localhost:8080/
```

## What it does

- **▶ Enter the Reverie** — one tap starts the generative clockwork. Audible in under 30 seconds, guaranteed.
- **Drag hours to bend tempo** — drag around the neon clock dial (or the scrubber, arrow keys, `←/→`). Hours 0–23 bend tempo 0.6×–1.6× (43–115 BPM), rotate the musical key through all 12 roots, and recolor the sky. `FLOW` mode drifts time on its own; `⛧ MIDNIGHT` snaps to 00:00 with a bell strike.
- **Layer chime loops live** — 5 synthesized loops (Midnight Bell, Glass Chime, Copper Tick, Velvet Pad, Neon Arp) with live toggles (keys `1–5`) and volume faders over a shared dub echo. `✦ LUSH PRESET` / `✧ CLEAR` included.
- **Evolving clockwork visuals** — canvas retro-wave scene: striped sun breathing with the beat, scrolling perspective grid, rotating clockwork gears, 24-hour orbit ring, rising motes, VHS scanlines. Everything warps with hour + tempo.
- **Export midnight mix** — renders a deterministic 16-second WAV of the current hour/layers via `OfflineAudioContext` (seeded RNG, no recording needed) and downloads it as `velvet-hour-reverie_HHMM.wav`.

Settings (hour, layers, gains) persist in `localStorage`. Responsive down to 375px. `Space` = play/stop, `M` = midnight.
