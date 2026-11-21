// deploy/cloudflare.mjs — wrangler pages deploy site/ → auto-forge
import fs from "node:fs";
import path from "node:path";
import { config, SITE_DIR, ROOT } from "../config.mjs";
import { run } from "../lib/run.mjs";
import { cfToken } from "../lib/cf-token.mjs";

export async function deploy() {
  if (!fs.existsSync(SITE_DIR) || !fs.existsSync(path.join(SITE_DIR,"index.html"))) {
    console.log("  cloudflare: site/ empty — building gallery first");
    await import("../scripts/build-gallery.mjs");
  }
  const proj = config.deploy.cloudflareProject;
  console.log(`  cloudflare: wrangler pages deploy ${SITE_DIR} --project-name ${proj} ...`);
  const flags = ["wrangler","pages","deploy", SITE_DIR, "--project-name", proj];
  // wrangler reads the token from env: expose it ONLY around this one spawn,
  // then remove it — daily.mjs workers inherit process.env and must never see
  // a deploy credential. If that token is stale (Oct-28: expired -> error 9109),
  // retry via the local `wrangler login` OAuth session instead of skipping.
  const tok = cfToken();
  let r;
  if (tok) {
    process.env.CLOUDFLARE_API_TOKEN = tok;
    try { r = await run("npx", flags, { cwd: ROOT }); }
    finally { delete process.env.CLOUDFLARE_API_TOKEN; }
    if (r.code !== 0) console.log("  cloudflare: token deploy failed — retrying via wrangler OAuth session");
  }
  if (!tok || r.code !== 0) r = await run("npx", flags, { cwd: ROOT }); // no env token -> wrangler uses its stored OAuth
  console.log(r.out.slice(-2000));
  if (r.code!==0) console.log("  cloudflare deploy stderr:", r.err.slice(-1500));
  else console.log("  cloudflare: deployed ✓");
}
if (import.meta.url === `file://${process.argv[1]}`) deploy();
