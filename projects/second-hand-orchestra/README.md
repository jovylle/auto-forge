# Second Hand Orchestra

> Conduct drifting loops where every second ticks a new layer of sound.

A generative music toy in plain HTML + CSS + JS (no build, no backend, no samples — all sound is synthesized live with WebAudio).

## How to open

Just open `index.html` in any modern browser — double-click it (`file://` works) or serve the folder statically. Press **“Start the clock”** (browsers require one user gesture before audio).

## What it does

- **Tap-tempo clock ensemble** — tap the *Tap tempo* button (or hit `Space`) to set the tempo; three clock voices (*Tick* on beats, *Tock* on off-beats, *Bell* each bar) follow it and can be toggled independently. A tempo slider (50–180 BPM) mirrors the tapped value.
- **Layered loop mixer** — five generative loops (Pulse bass, Arp wanderer, Shimmer bells, Drift noise-swell, and a pitched *Second* blip). Every wall-clock second mutates the pattern and adds a new pitched tick from a pentatonic scale. Each channel has enable, volume, mute, and solo; lanes flash as notes fire.
- **History timeline scrubber** — every note played is logged into a rolling 60-second window, drawn as per-lane dots on a canvas with a live playhead. Drag across it to scrub back in time and loop-replay any moment; **Back to live** resumes the generative clock.
- **Shareable minute symphonies** — *Capture this minute* freezes the last 60 s (events + tempo + mix) into a named symphony, persisted in `localStorage` (up to 12). Each symphony can be replayed or encoded as a compact `#s=…` URL-hash link — opening the link elsewhere restores the symphony for replay.

## Design

Glassmorphism: frosted-glass cards over drifting gradient orbs, Unbounded + Space Grotesk type. Palette is exactly **3 colors + black/white**: violet `#8B5CF6`, cyan `#22D3EE`, amber `#FBBF24` on black `#06070C` with white text.

## Files

`index.html` · `style.css` · `app.js` · `README.md`
