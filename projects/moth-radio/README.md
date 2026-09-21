# Moth Radio

Live: https://moth-radio-af.uft1.com/

A self-contained Japanese-minimal night relay for trading short signals with a deterministic moth swarm.

## Open

Open `index.html` directly in a browser. No build or network connection is required.

## Use

1. Select an hour on the night dial.
2. Send a transmission or choose a moth from the swarm board.
3. Press `L` or click the moon three times to reveal the lunar relay.

Signals are stored in this browser with `localStorage`.

## Redeploy

```bash
set -a; source ~/.env; set +a
npx wrangler pages deploy site --project-name auto-forge
```

The gallery and GH Pages target are rebuilt by `node daily.mjs .`.
