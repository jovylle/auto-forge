# Ulva Gull Union — Local 07

Unionize the gulls of the sea-lettuce beds. An extreme-minimal union hall:
paper background, ink rules, one sea-lettuce green, one picket red.

## How to open

No build, no server. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit it.

Works from `file://` (Google Fonts needs network; falls back to system fonts offline).

## What it does

- **01 · Gull roster** — signed/unsigned cards with seniority + titles. Add gulls, sign cards, retire gulls. Live signed count + quorum.
- **02 · Tide demands** — weighted demand board sorted by weight. Raise/lower weight, mark won, strike demands.
- **03 · Union votes** — open ballots with animated aye/nay tally bars. Call motions, vote, close & record verdicts (pass needs quorum ayes + majority). Permanent record list.
- Persists to `localStorage` (`ulva-gull-union-v1`).

## Keyboard only (constraint)

Every action works without a mouse. Press `?` in the app for the steward's keys:

| Keys | Action |
|---|---|
| `1` `2` `3`, `←` `→` | switch halls |
| `↑` `↓` / `j` `k` | move in list |
| `Enter` | sign / unsign gull |
| `/` `d` `m` | focus name / demand / motion box |
| `a` `n` `c` | aye / nay / close motion |
| `+` `−` `w` `x` | weight / won / retire |
| `?` / `Esc` | help / close |

Skip link + visible focus rings throughout.

## Easter egg (constraint)

Type `squawk` anywhere on the hall floor. 🥬
