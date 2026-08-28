# auto-forge — daily autonomous project bot

One cron tick per day: invents (or continues) a project, builds it, deploys it.

**Stack:** mixed — `vite` (React+TS+Tailwind) for richer apps, `html` (single HTML/CSS/JS) for quick sketches. Bot picks per idea.

**Deploy:** both Cloudflare Pages (`auto-forge` project) and GitHub Pages (`gh-pages` branch). Configurable in `config.mjs`.

## Quick start

```bash
node daily.mjs --status        # see queue
node daily.mjs --dry-run       # preview next idea without building
node daily.mjs                 # one full tick (idea → scaffold → opencode build → verify → deploy → git commit)
node daily.mjs --only my-slug  # continue/rebuild a specific project
node lib/ideas.mjs --once      # peek at next generated idea
npm run build:gallery          # rebuild site/ gallery from projects.json
```

## How it decides what to build

1. If any project is `continuing` / `needs-iteration` / stale `building` (>24h) / `needs-human` (one retry left) → continue that one (appends retry context to worker prompt).
2. Otherwise generate a new idea (seed pool 35% of the time, LLM 65%). Dedup-checked against `projects.json` titles/tags/features (jaccard >0.62 → regenerates once).
3. Scaffold (`lib/scaffold.mjs`): `vite` → `npm create vite react-ts + tailwind v4`, `html` → `index.html/style.css/app.js` skeleton, both write `SPEC.md`.
4. Spawn **fresh opencode worker** (`opencode run ... --agent build` with stream-json) using `prompts/worker-*.md` + `SPEC.md`. Worker writes `.factory/result.json`.
5. Verify (`npm run build` or html smoke), thumbnail (best-effort), then `scripts/build-gallery.mjs` → `site/` + `site/p/<slug>/`.
6. Deploy: `deploy/cloudflare.mjs` (`wrangler pages deploy`) if `CLOUDFLARE_API_TOKEN` set; `deploy/ghpages.mjs` pushes `site/` to `gh-pages` if git remote exists. Sources control per `config.mjs → deploy.targets`.
7. Git commit + push (`feat(auto): <slug> — <title>`).

## Hermes cron (daily 09:00 PHT)

```bash
hermes cron add --name "auto-forge daily" --schedule "0 9 * * *" --workdir /Volumes/DevSSD/fore/lab/auto-forge --prompt 'Run: node daily.mjs — the auto-forge daily bot tick.'
# or with full context (recommended, so the cron agent has the brief without asking):
hermes cron add --name "auto-forge daily" --schedule "0 9 * * *" --workdir /Volumes/DevSSD/fore/lab/auto-forge \
  --prompt 'You are the auto-forge daily bot. cd /Volumes/DevSSD/fore/lab/auto-forge and run: node daily.mjs . Read loop.json; if enabled:false skip. One tick: decide continue-or-new idea (dedup), scaffold, spawn opencode worker (18m timeout), verify, rebuild gallery, deploy to Cloudflare+gh-pages if configured, git commit+push, update loop.json lastRun. Log to logs/<date>.log. If opencode not installed, scaffold + verify still run so gallery shows something.'
```

Toggle pause: edit `loop.json` → `"enabled": false`.

## GitHub Actions backup

`.github/workflows/daily.yml` mirrors the cron at `0 1 * * *` UTC (09:00 PHT). It's safe to leave enabled alongside Hermes — the second run will see "already done today" if `loop.json` lastRun is today (we don't yet gate on date — enable only one). To use: push repo to GitHub, set `OPENCODE_API_KEY` secret, enable Pages (source: GitHub Actions).

## Config

`config.mjs`: aesthetics pool, model chain (`idea`/`build` + fallbacks, smart=`glm-5.2`), deploy targets, timeouts, html-vs-vite heuristic.

## Where things live

- `projects.json` — the queue/DB (like factory, simpler — no `data/projects.json` duplication until deploy)
- `projects/<slug>/` — isolated builds
- `site/` — deployed static site (generated, not committed except via gh-pages worktree)
- `logs/<slug>.log` — per-project worker transcript
- `loop.json` — enabled + lastRun
