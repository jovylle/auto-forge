# DUNE SWITCH — desert relays

A retro-wave lane-switch relay racer. Three riders, one baton, zero mercy:
thread obsidian slabs, vacuum sun-cells, and hit every relay gate in the
marked lane for boost. Your crew tires — pass the baton before they gas out.

## Play

- **Steer:** `◀ ▶` / `A D` / swipe / on-screen buttons
- **Pass baton:** `SPACE` / `TAB` (cycles to freshest rider)
- **Pick rider:** `1` `2` `3` or tap a crew card
- **Pit (pause):** `P` / `ESC` · **Mute:** `M` · **Start:** `ENTER`

### The crew

| Rider | Bike | Style |
|---|---|---|
| JOLT | dart-bike | fast + twitchy, drinks stamina |
| MIRAGE | sand-skiff | balanced, sips stamina, wider pickup net |
| HAULER | dune-crawler | slow, huge pickup net, sips stamina |

- Active rider drains stamina; benched riders recover. A gassed rider
  auto-passes the baton; a fully gassed crew costs 1 heat.
- Switching gives 1s of phase-through + a speed kick.
- Relay gates every 400m: be in the marked (diamond) lane → +100pts, boost, +25 stamina.
- 3 hull hits = wreckage. Score = distance×2 + cells×25 + clean gates×100.

## Share / export

- **Share tab:** copyable race card (score, distance, leg, seed + URL).
- **Export tab:** download the run as `dune-switch-seed<N>.json`.
- **Import tab:** paste a rival's run JSON to scout it, then race their seed.
- Seeds in the URL (`?seed=…`) regenerate the same dunes; house best + top-5
  board persist in `localStorage` (`dune-switch:*`).

## Sound

100% WebAudio synth — engine hum pitched to speed, pickup blips, crash
noise, baton whoosh, gate chimes, and a low background arp loop. No assets.
`M` or the ♪ button mutes (persisted).

## Dev

```sh
npm run build    # tsc -b && vite build (base './' for /p/<slug>/ hosting)
npm run preview  # serve dist/
```

Palette (3 colors + black/white): blaze `#ff2e88`, dune `#ffb300`,
tide `#00e5cc` on void `#0d0221` / paper `#fff6e9`. Type: Orbitron + Space Mono.
