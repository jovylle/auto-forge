# Fable Foundry

> Smelt morals into tiny fables. A steampunk generative story press.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000/`

Works from `file://`. Only external request is Google Fonts (`@import`); the app is fully usable offline with fallback serif fonts.

## What it does

1. **Moral intake (I)** — Type a moral ("ore"), roll a random one, or pick a preset chip. Choose an alloy **temper** (Brass = heroic, Soot = grim, Aether = whimsical) and an **ingot size** (Spark ~90 words, Ingot ~160, Epic ~250).
2. **Fable press (II)** — Pull the lever. The boiler stokes: pressure gauge sweeps, gears spin up, steam puffs, a synthesized clank/hiss sounds (WebAudio, no files). A seeded generative engine casts a unique fable — hero, rival, relic, and place are drawn deterministically from your moral + settings, so the same ore always smelts the same way unless you **restoke a variant**.
3. **Fresh from the mould (III)** — The fable is revealed with a typewriter effect on aged parchment, drop cap and all, with the moral stamped in brass at the foot. Copy it, or have it read aloud.
4. **Story ingots (IV)** — Cast finished fables into brass ingots. They persist in `localStorage`, can be re-read, copied, melted (deleted), or exported all at once as `.txt`.

## Keyboard only

Every control is a real button/input with visible focus rings, plus shortcuts (see the in-app ledger with `?`):

| Key | Action |
|---|---|
| `/` | focus moral intake |
| `Ctrl`+`Enter` | smelt the fable |
| `R` | random moral |
| `T` / `L` | cycle temper / size |
| `X` | restoke a variant |
| `S` | cast ingot (save) |
| `C` | copy fable |
| `[` / `]` | walk saved ingots |
| `Enter` / `Del` on an ingot | re-read / melt |
| `?` | shortcut ledger |
| `Esc` | close ledger / stop reading |

## Files

- `index.html` — structure (intake, press, story, ingots, ledger)
- `style.css` — steampunk theme (brass/copper/iron/parchment, Cinzel Decorative + IM Fell English)
- `app.js` — seeded fable engine, press sequence, ingots + persistence, keyboard map
