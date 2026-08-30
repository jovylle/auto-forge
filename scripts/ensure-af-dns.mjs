import { SITE_DIR } from "../config.mjs";
import fs from "node:fs";
import path from "node:path";

export async function ensureAfDns(slug) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) { console.log("  af-dns: no CLOUDFLARE_API_TOKEN — skip"); return; }
  const zone = "ad1e2401f625042ce70db3594f283ce6";
  const name = `${slug}-af`;
  // check exists
  const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?name=${name}.uft1.com`, { headers: { Authorization: `Bearer ${token}` } });
  const list = await listRes.json();
  if (list.result && list.result.length) { console.log(`  af-dns: ${name}.uft1.com already exists`); return; }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "CNAME", name, content: "auto-forge-7dq.pages.dev", proxied: true, ttl: 1 })
  });
  const j = await res.json();
  console.log(j.success ? `  af-dns: created ${name}.uft1.com ✓` : `  af-dns: failed ${name}: ${JSON.stringify(j.errors).slice(0,400)}`);
}
