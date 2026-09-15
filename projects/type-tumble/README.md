# TYPE TUMBLE

Drop words into gravity wells that stretch and stack them into kinetic posters. Cyberpunk kinetic-type playground in a **single self-contained `index.html`** (no build, no backend).

## Open

Just open `index.html` in a browser (double-click works — `file://` safe, no modules), or serve statically:

```sh
cd projects/type-tumble && python3 -m http.server 8000
# → http://localhost:8000/index.html
```

## What it does

- **Gravity word sandbox** — canvas physics: words fall, draggable gravity wells (◉) pull them, walls/floor bounce. Drag words to throw them; double-click empty space for a burst-drop.
- **Variable font stretching** — words squash & stretch with velocity (tall when diving, wide when flying), plus per-word stretch / weight / size / color controls on selection (click any word).
- **Collision-based layouts** — word-vs-word AABB collisions with impulse exchange, so words pile and stack; **▤ STACK LAYOUT** settles everything into a pinned poster stack; **⟳ ORBIT** flings words around the first well.
- **One-click poster export** — **⤓ EXPORT POSTER** downloads a 2× PNG with neon border + date tag.
- Extras: preset word packs (NEON / STREET / VOID), gravity / pull / bounce sliders, pin / duplicate / delete per word, pause, state persists in `localStorage`.

## Constraints

- 3 colors + black/white: cyan `#00f0ff`, magenta `#ff2a6d`, acid `#f9f002` on near-black `#08060f` + white ink.
- Single HTML file (`index.html` has zero local refs; `style.css`/`app.js` are pointer mirrors only). Google Fonts via `@import` with system-font fallback offline.
- Responsive down to 375px (stacked toolbar, shorter stage).
