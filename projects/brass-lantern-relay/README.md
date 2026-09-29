# 🏮 Brass Lantern Relay

A grunge wind-physics relay game. One flame, five posts, a guttering wind.

## How to open

No build, no server needed — just open it:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder, then visit the URL.

Works from `file://` and any static host.

## What it does

- **Core interaction:** run a lantern-keeper down the relay line with real momentum + wind shove (physics). Lean *into* the wind to shelter the flame, pump the bellows to stoke it, and pass the flame at each of 5 posts.
- **Polished UI:** grunge styling (stamped headers, grain overlay, torn/rotated panels), live flame/oil/wind/time HUD, relay ledger, WebAudio bleeps, spark particles, best-time persistence.
- **Share/export:** copy a plain-text run card (`C`), download it as `.txt` (`D`), or use the OS share sheet (`S`).

## Controls (keyboard only — mouse never required)

| Key | Action |
|---|---|
| `←` `→` | Run (momentum) / lean against wind |
| `Space` | Stoke bellows (+flame, −oil) |
| `Enter` | Pass flame at a post (flame ≥ 25) |
| `R` / `P` / `M` | Restart / Pause / Mute |
| `C` / `D` / `S` | Copy / Download / Share run card |
| `?` | Toggle how-to |
| `Tab` | Every button is reachable & operable |

## Rules in brief

Flame drains constantly; wind strips it faster unless you shelter by holding into the gust. Sprinting also strips flame. Stoke costs oil. Each passed post grants +35 oil. Light all 5 before the flame dies. Best time is kept in `localStorage`.
