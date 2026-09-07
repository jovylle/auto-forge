# FOLDED CITY — an origami map field-guide

A keyboard-first origami map explorer. A whole city is printed on one sheet of
folded paper: the crease field doubles as the street grid, every district is a
fold, and unfolding a district opens its field dossier.

## Open it

There is no build step — plain HTML/CSS/JS.

- **From disk:** double-click `index.html` (works over `file://`)
- **From a host:** drop the three files anywhere static (or `python3 -m http.server` in this folder)

Fonts load from Google Fonts (Oswald, Caveat, Special Elite); offline they fall
back to system typefaces.

## What it does

- A **seeded city** is generated per sheet — 12 districts (Voronoi facets), each
  with a tone, density, founding year, marginal scribbles, a landmark glyph, and
  a prose field note. Same seed → same city; the share-link carries the seed.
- **Pan / zoom** the sheet (drag, wheel, pinch, or keys). The paper has hairline
  creases in two directions, soft pleat shading, avenues with misregistered
  print, dog-eared corners, stains, and a grain/vignette overlay.
- **Unfold a district** — select it (click or Tab+Enter) and its dossier flaps
  open: name, epithet, field note, facts, landmark glyph, plus Locate / Pin / Close.
- **Pin flags** (max 6) with numbered jump shortcuts; pins persist in the share link.
- **Share / export**:
  - *Copy share-link* — restores the exact sheet, camera, pins and open district.
  - *Snapshot .png* — current view at 2×.
  - *Poster .svg* — full vector sheet, self-contained.
  - *Print* — prints the whole sheet on one A4 landscape page.
- New sheets (N) reroll the seed; your last sheet is remembered in localStorage.

## Controls (full keyboard support)

| Keys | Action |
|------|--------|
| `←→↑↓` / `WASD` | pan |
| `+` `−` | zoom |
| `Tab` → `Enter` / `Space` | focus + unfold a district |
| `Esc` | fold the dossier shut |
| `1`–`6` | jump to a pin |
| `F` | fold every other district flat (focus mode) |
| `P` | show/hide pins |
| `L` | show/hide street & district print |
| `R` | frame the whole sheet |
| `N` | crumple a fresh sheet |
| `H` | hide the field-notes card |

## Files

- `index.html` — chrome: masthead, tool buttons, dossier panel, legend, hints
- `style.css` — grunge identity: aged paper, tape, stamps, misprint reds, grain
- `app.js` — seeded world generation, camera, selection, pins, share/export