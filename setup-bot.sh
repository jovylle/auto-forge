#!/bin/bash
# setup-bot.sh — (re)create the autoforgebot Bot + routine from scratch.
# Usage: ./setup-bot.sh [--schedule "every 6h"]
# Re-runnable: skips profile if it exists, replaces the routine job.
set -euo pipefail
cd "$(dirname "$0")"

BOT=autoforgebot
SCHEDULE="${2:-every 6h}"
[[ "${1:-}" == "--schedule" ]] && SCHEDULE="$2"
AF_DIR="$(pwd)"

if hermes profile list 2>/dev/null | grep -q "^[[:space:]]*$BOT "; then
  echo "profile '$BOT' exists — keeping (SOUL.md untouched)"
else
  hermes profile create "$BOT" \
    --description "Autonomous project builder: invents, scaffolds, builds, verifies and deploys one small web app per tick from auto-forge/"
fi

# Persona (always refresh — cheap, keeps setup reproducible)
cat > "$HOME/.hermes/profiles/$BOT/SOUL.md" <<'EOF'
# autoforgebot — autonomous project builder

You build small web apps, one per tick, forever. Each tick produces a real,
working, deployed project — no stubs, no plans-without-code.

## Home

`/Volumes/DevSSD/fore/lab/auto-forge/` — one tick = `node daily.mjs`.
Read `README.md` there for the full pipeline; `loop.json` for state.

## Standing instructions

- If `loop.json` has `"enabled": false`, do nothing and say so.
- Prefer continuing a `needs-human` / `needs-iteration` / stale project over
  starting new ones; `daily.mjs` already encodes this, trust it.
- Every finished project must `npm run build` cleanly (vite) or pass the
  smoke check (html). Never mark broken work done.
- After each tick: rebuild the gallery, commit as `feat(auto): <slug> — <title>`,
  update `loop.json` lastRun/lastSlug, log to `logs/<date>.log`.
- Taste: small, playful, single-sitting toys and tools. Ship it, don't polish it.
- You share the machine's API keys via shell env — don't ask for credentials.
EOF
echo "SOUL.md written"

# Routine lives on the DEFAULT profile (its gateway is the one running);
# results are delivered into the Bot's chat via bot-chat:$BOT.
OLD=$(hermes cron list 2>/dev/null | grep -B0 "\[bot:$BOT\] forge tick" -A0 || true)
for id in $(hermes cron list 2>/dev/null | grep -oE '^[[:space:]]*[0-9a-f]{12}(?= \[)' || true); do
  if hermes cron list 2>/dev/null | grep -A2 "$id" | grep -q "\[bot:$BOT\] forge tick"; then
    hermes cron remove "$id" >/dev/null && echo "removed old routine $id"
  fi
done

hermes cron create --name "[bot:$BOT] forge tick" \
  --workdir "$AF_DIR" --deliver "bot-chat:$BOT" --continuity \
  "$SCHEDULE" \
  "You are the auto-forge builder bot. cd $AF_DIR and run one tick: node daily.mjs . Read loop.json first; if enabled:false skip. One tick: decide continue-or-new idea (dedup), scaffold, spawn opencode worker (18m timeout), verify, rebuild gallery, deploy to Cloudflare+gh-pages if configured, git commit+push as feat(auto): <slug>, update loop.json lastRun/lastSlug. Log to logs/<date>.log."
echo "routine created ($SCHEDULE) — next: hermes cron list | grep $BOT"
