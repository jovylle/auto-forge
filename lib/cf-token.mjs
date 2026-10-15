// lib/cf-token.mjs — resolve CLOUDFLARE_API_TOKEN without involving the
// worker-visible environment.
//
// Background: the token lives in ~/.env, sourced only by interactive shells
// (~/.zshrc). Cron-spawned ticks never have it in env, so cloudflare deploy
// and per-slug af-dns silently skipped (Oct-15: 3 slugs served the gallery
// index on their hostnames). daily.mjs spawns workers with {...process.env},
// so daily.mjs must NEVER `process.env.X = token` at top level — workers
// would inherit a deploy credential. Callers keep the value in a local and,
// where a child needs it (wrangler), set+delete around that one spawn.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function cfToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  try {
    const env = fs.readFileSync(path.join(os.homedir(), ".env"), "utf8");
    const m = env.match(/^(?:export\s+)?CLOUDFLARE_API_TOKEN=(.+)$/m);
    let v = (m?.[1] ?? "").trim();
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    return v;
  } catch { return ""; }
}
