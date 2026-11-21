// scripts/check-models.mjs — ping every model the bot would use. Free IDs get
// delisted or quota-walled without notice, so run this after editing config.mjs.
// usage: node scripts/check-models.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import { config, OPENCODE_BIN, ROOT, HEALTH_FILE } from "../config.mjs";

const models = [...new Set([config.models.idea, ...config.models.buildChain])];
const TIMEOUT_MS = 45000;

function ping(model) {
  return new Promise((resolve) => {
    const p = spawn(OPENCODE_BIN, ["run", "reply with the single word pong", "--auto", "--agent", "build", "--format", "json", "--model", model],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const to = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} resolve({ ok: false, why: "timeout" }); }, TIMEOUT_MS);
    p.stdout.on("data", d => out += d);
    p.stderr.on("data", d => err += d);
    p.on("close", (code) => {
      clearTimeout(to);
      const hit = (out + err).match(/Free usage limit reached|Model unavailable|api_key_expired|API key has expired/i);
      if (code === 0 && /pong/i.test(out)) return resolve({ ok: true });
      resolve({ ok: false, why: hit ? hit[0] : `exit ${code}: ${(err || out).slice(0, 120)}` });
    });
    p.on("error", e => { clearTimeout(to); resolve({ ok: false, why: String(e).slice(0, 120) }); });
  });
}

const results = await Promise.all(models.map(async m => ({ m, ...(await ping(m)) })));
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.m}${r.ok ? "" : "  — " + r.why}`);
// Seed the circuit breaker with what the live ping just saw, so
// `node daily.mjs --pick-model` agrees with this report instead of trusting a
// stale "failStreak 0". Only hard model facts (quota wall, delisted id) demote;
// a timeout is flaky startup, not a verdict. Keys outside the chain are dropped.
let health = {};
try { health = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8")); } catch {}
for (const r of results) {
  if (r.ok) { health[r.m] = { failStreak: 0, lastFail: null, lastError: "" }; continue; }
  if (!/Free usage limit reached|Model unavailable/i.test(r.why)) continue;
  health[r.m] = { failStreak: Math.max(1, config.models.breakerFails), lastFail: new Date().toISOString(), lastError: r.why.slice(0,400) };
}
for (const k of Object.keys(health)) if (!models.includes(k)) delete health[k];
fs.writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2));
process.exit(results.every(r => r.ok) ? 0 : 1);
