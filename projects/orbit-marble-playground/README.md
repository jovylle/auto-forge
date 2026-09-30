# Orbit Marble Playground

A dark-fantasy gravity rite in a **single `index.html`** — no build, no deps, works from `file://`.

## How to open
Open `index.html` in any browser (or serve statically). Works at 375px width; touch supported.

## What it does
- **Drag to launch marbles** — pull back from the bone altar (bottom-left orb), release to fling. Dotted path predicts the gravity-bent trajectory.
- **Gravity wells bend paths** — 3 violet wells with rune rings; drag wells to reposition. Scroll deepens gravity slightly (scroll-tide).
- **Combo scoring** — full loop (~300°+) around a well = ORBIT +100. Chain orbits within 6s for ×2, ×3… multipliers. Rim grazes pay +15. Falling in = devoured, combo resets.
- **Daily orbit challenge** — seeded by date (`orbit-YYYY-MM-DD`), same 3 wells + 600-pt tithe for everyone that day. Best tribute persisted in localStorage. "Wild Cosmos" gives a random practice sky.
- **Must react to scroll** — scrolling the grimoire sections charges Abyssal Attunement (0–100%, sticky bar), blessing scores up to +50%, shifting nebula hue and starfield parallax.

## Controls
- Drag altar → aim/release; drag wells → move; `R` / ↻ → reset; sound toggle included.
