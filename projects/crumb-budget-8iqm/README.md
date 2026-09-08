# Crumb Budget · クラム・バジェット

Track your spending in **snack units**. A vaporwave arcade cabinet for your wallet — log expenses, convert dollars into snacks, and watch your week unfold as neon bars.

No backend. No API keys. Everything lives in your browser's `localStorage`.

## Features

- **Expense log** — add spends with a name, dollar amount, and category (🍔 Food · 🚌 Transit · 🎮 Fun · 🛍️ Stuff · 💧 Bills). Rows show the dollar amount and its snack equivalent. Delete with a glitch-out.
- **Snack converter** — pick from 8 preset snacks (Donut $3.50, Boba Tea $5.75, Taco $3.25…) or define a **custom snack** with your own name and price. Type a dollar amount, hit **CONVERT ▶**, and the retro sun counts up to how many snacks that buys — whole units + fractional snack, an emoji strip, and a rotating quip.
- **Weekly chart** — bars for the last 7 days in dollars **or** snacks (toggle), hover/click for a tooltip, today highlighted in cyan. A **weekly budget** bar fills as you spend and pulses **OVERDRIVE** when you blow past it.

## Run

```bash
npm run dev       # dev server
npm run build     # typecheck (tsc -b) + production build → dist/
npm run preview   # serve the built app locally
```

`base: './'` is set in `vite.config.ts`, so the build outputs relative asset paths and can be hosted under any subpath.

## Sound

All audio is synthesized live with **WebAudio** — zero audio asset files. Add = chord, delete = zap, convert = chord, invalid input = buzz, plus hover ticks and toggle tones. Mute with the **SND** chip in the header (persisted).

## Easter egg

<details>
<summary>spoiler</summary>

Click the retro sun **five times** — or type the Konami code (**↑ ↑ ↓ ↓ ← → ← → B A**) — to detonate **SNACK OVERDRIVE**: the sun swells to fill the screen, katakana marquee scrolls, snacks rain down, and your lifetime spend × 42 appears as **GALACTIC CRUMBS**. The footer hints: "the sun is clickable… probably."

</details>

## Data (localStorage)

| Key | Contents |
| --- | --- |
| `crumb:entries` | Expense list `{id, name, amount, category, ts}` |
| `crumb:snack` | Selected snack (preset id or custom name + price) |
| `crumb:budget` | Weekly budget in dollars |
| `crumb:snd` | Sound on/off |
| `crumb:egg` | Reserved for egg state |

## Stack & design

Vite + React 19 + TypeScript + Tailwind CSS v4. Palette: deep ultraviolet `#0B0221` night, hot magenta `#FF2E97`, electric cyan `#00F0FF`, laser-lemon sun `#FFD319`. Typography: **Monoton** (neon wordmark), **Space Grotesk** (UI), **VT323** (terminal numbers). CRT scanlines, a scrolling synthwave grid floor, and a clickable retro sun tie it together. Respects `prefers-reduced-motion`.