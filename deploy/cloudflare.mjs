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
  const tok = cfToken();
  if (!tok) {
    console.log("  cloudflare: CLOUDFLARE_API_TOKEN not set (env or ~/.env) — skipping (gallery still built locally)");
    return;
  }
  // wrangler reads the token from env: expose it ONLY around this one spawn,
  // then remove it — daily.mjs workers inherit process.env and must never see
  // a deploy credential.
  process.env.CLOUDFLARE_API_TOKEN = tok;
  let r;
  try {
    r = await run("npx", ["wrangler","pages","deploy", SITE_DIR, "--project-name", proj], { cwd: ROOT });
  } finally {
    delete process.env.CLOUDFLARE_API_TOKEN;
  }
  console.log(r.out.slice(-2000));
  if (r.code!==0) console.log("  cloudflare deploy stderr:", r.err.slice(-1500));
  else console.log("  cloudflare: deployed ✓");
}
if (import.meta.url === `file://${process.argv[1]}`) deploy();
