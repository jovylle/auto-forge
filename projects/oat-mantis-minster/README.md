# OAT MANTIS MINSTER · 麦截

A **30-second Japanese-cyberpunk snip ritual**. A chrome praying-mantis priest sits at the
bottom of a neon shrine shaft and slices falling oat grains exactly as they cross a magenta
cut line. One button, no downloads, no backend — the whole run is a single 30-second round.

> 麦を截れ — *cut the grain at the line.*

## Play

| Input | Action |
| --- | --- |
| `SPACE` / `ENTER` / click / tap | Snip — cut the oat nearest the cut line |
| `M` | Sound on / off |
| Any button | Standard keyboard/touch activation |

The rule is on screen and the round is 30 seconds, so the first play is understood in under
half a minute:

- **PERFECT 完璧** — snip within the tight window: 3 pts × multiplier, and inscribes one sutra glyph.
- **GOOD 良** — a forgiving window: 1 pt × multiplier.
- **WHIFF 空振** — an empty swing: no points and the chain resets, so mashing is a losing line.
- **MISS 失** — an oat falls past the gate: a bell rings, one of three lanterns goes dark.
- **SUTRA 経** — six glyphs seal a sutra: +40 pts and a gold flare.
- Every four chained snips raises the multiplier, capped at **×5**.
- Three bells **or** the 30-second clock ends the run.

The result panel gives a rank (**S / A / B / C**), perfect count, best chain, sutras sealed,
and a short haiku chosen by rank.

## Share / export

- **Share 共有** — uses the native share sheet when available (mobile), otherwise copies a
  haiku-stamped score line plus a challenge link to the clipboard.
- **Ofuda 御札** — renders a **1080 × 1350 PNG talisman** (score, rank seal, stats, haiku, URL)
  on a canvas at 2×-safe resolution and downloads it. No image assets, no server.
- **Challenge links** — the score is encoded in the URL hash (`#m=812&r=A`). Opening a shared
  link shows a 挑戦状 "beat 812" target on the title screen and in the sidebar.
- **Best score / runs / mute** persist in `localStorage` (`omm.best`, `omm.runs`, `omm.muted`).
  If storage is blocked (private mode, sandboxed iframe) the game still plays; the score is
  simply session-only.

## Hard constraints — how they are met

| Constraint | Implementation |
| --- | --- |
| **Sound on interaction (WebAudio, no assets)** | `src/sound.ts` synthesises everything at runtime: an `OscillatorNode`/`GainNode` koto pluck that climbs a pentatonic scale with the chain, layered sines for a perfect, filtered noise for the swing, a pitch-dropping taiko thud for a missed oat, a four-note sutra arpeggio, and a long temple bell at the end. The `AudioContext` is created lazily on the first gesture and resumed if suspended. An `M` toggle silences the master gain. There is not a single audio file in the project. |
| **Playable in 30 seconds** | One interaction (snip), one visible rule line, 30-second timer, and the round is legible from the first oat. No tutorial, no menus, no loading state. |

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict, `tsc -b` in the build) + **Tailwind CSS v4**
  (`@tailwindcss/vite`) — Tailwind supplies preflight and theme tokens; the visual system is
  hand-written CSS in `src/index.css`.
- No backend, no API keys, no runtime dependencies beyond React. The only network request is
  the Google Fonts stylesheet.
- `vite.config.ts` sets `base: './'`, so the built `dist/` uses relative `./assets/…` URLs and
  works under a subpath such as `/p/oat-mantis-minster/`.

## Scripts

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build  → dist/
npm run preview    # serve dist/ on :4173
npm run check      # pure-rules self-check (node --experimental-strip-types)
```

## Design system

- **Palette** — sumi ink `#0b0710`, panel `#1a1024`, neon magenta `#ff2e9a`, cyan `#2be8e0`,
  oat gold `#f2c14e`, rice-paper text `#f4e9dc`, vermilion `#ff3b3b`, muted plum `#8a7697`.
- **Type** — Chakra Petch (display/buttons), Zen Kaku Gothic New 900 (kanji, seal, judgement),
  Space Mono (HUD numerals, haiku, ledger) via a single Google Fonts `@import`.
- **Layout** — asymmetric three-column board: a vertical kanji rail (神 · 麦 · 截), a portrait
  shrine canvas, and a ledger of live stats. Collapses to rail → stage → ledger under 980 px,
  compacts under 560 px, and switches to a two-column stage/ledger layout on short landscape
  phones so the cut line stays on screen.
- **Micro-interactions** — glitching title, scanline drift, combo pulse on every chain step,
  notched `clip-path` panels and buttons, skew-on-hover stat rows, cut-line flare and slash
  wedge on each snip, spark burst, miss shake, and lanterns that dim as devotion is lost.
- **Accessibility** — labelled canvas tap button, focus-visible rings on every control, lives
  and sutra progress exposed with `role="img"` labels, result panel is a focusable `status`
  region, `prefers-reduced-motion` disables scanlines/glitch/pulses and fades the judgement,
  and colour is never the only signal (text labels accompany every state).

## Structure

```
index.html            shell, meta, inline SVG favicon
src/main.tsx          React entry
src/App.tsx           layout, HUD, round state machine, share/export handlers
src/game/engine.ts    pure rules: spawn, cut windows, combo, sutras, lives, rank
src/game/render.ts    canvas renderer: shaft, torii, rain, oats, mantis, beam, sparks
src/sound.ts          WebAudio synthesis (no assets)
src/share.ts          share text, challenge-link parsing, ofuda PNG rendering
src/index.css         design tokens, layout, component styling, responsive rules
scripts/engine-check.mts  assert-based rules check
```
