// daily.mjs — THE BOT. One tick = continue-or-new → scaffold → build → verify → deploy → commit.
// Advice applied: circuit breaker + preflight + VERIFY + receipt.json + run manifest + constraint/tag polish + logs commit.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, ROOT, PROJECTS_DIR, QUEUE_FILE, LOOP_FILE, HEALTH_FILE, SITE_DIR, LOGS_DIR } from "./config.mjs";
import { readQueue, writeQueue, updateProject, addProject, slugify } from "./lib/run.mjs";
import { decideContinue, generateIdea } from "./lib/ideas.mjs";
import { scaffold } from "./lib/scaffold.mjs";
import { verify } from "./lib/verify.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const STATUS = args.includes("--status");
let ONLY = args.find(a=>a.startsWith("--only="))?.split("=")[1]?.split(",").filter(Boolean);
if (!ONLY) {
  const idx = args.indexOf("--only");
  if (idx !== -1 && args[idx+1] && !args[idx+1].startsWith("--")) ONLY = [args[idx+1]];
}

function log(...a){ console.log(new Date().toISOString(), ...a); }

// ——— health / circuit breaker ———
function loadHealth() {
  try { return JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8")); } catch { return {}; }
}
function saveHealth(h) { fs.writeFileSync(HEALTH_FILE, JSON.stringify(h, null, 2)); }
function isDemoted(model, health) {
  const e = health[model];
  if (!e) return false;
  if (e.failStreak < config.models.breakerFails) return false;
  if (!e.lastFail) return false;
  return (Date.now() - new Date(e.lastFail).getTime()) < config.models.breakerCooldownMs;
}
function recordHealth(model, ok, errSnippet="") {
  const h = loadHealth();
  if (!h[model]) h[model] = { failStreak: 0, lastFail: null, lastError: "" };
  if (ok) { h[model].failStreak = 0; h[model].lastError = ""; }
  else { h[model].failStreak = (h[model].failStreak||0)+1; h[model].lastFail = new Date().toISOString(); h[model].lastError = errSnippet.slice(0,400); }
  saveHealth(h);
  return h;
}
function pickModelWithBreaker() {
  const primary = config.models.build;
  const fallback = config.models.buildFallback;
  const h = loadHealth();
  const primaryDemoted = isDemoted(primary, h);
  const fallbackDemoted = isDemoted(fallback, h);
  if (!primaryDemoted) return { model: primary, via: "primary" };
  if (!fallbackDemoted) return { model: fallback, via: "fallback (primary demoted)" };
  // both demoted — pick least recent failure
  const pTime = h[primary]?.lastFail ? new Date(h[primary].lastFail).getTime() : 0;
  const fTime = h[fallback]?.lastFail ? new Date(h[fallback].lastFail).getTime() : 0;
  return pTime < fTime ? { model: primary, via: "primary (both demoted, older)" } : { model: fallback, via: "fallback (both demoted, older)" };
}

async function preflightPing(model) {
  // 1-token ping to check liveness, timeout fast
  const bin = process.env.OPENCODE_BIN || `${process.env.HOME}/.opencode/bin/opencode`;
  const flags = ["run", "ping", "--auto", "--agent", "build", "--format", "json", "--model", model, "--port", "0"];
  return new Promise((resolve)=>{
    const p = spawn(bin, flags, { cwd: ROOT, env: { ...process.env, PATH: `${process.env.HOME}/.opencode/bin:${process.env.PATH}` }, stdio: ["ignore","pipe","pipe"] });
    let out="", err="";
    const to = setTimeout(()=>{ try{p.kill("SIGKILL")}catch{}; resolve({ ok:false, reason:"preflight timeout"}); }, config.models.preflightTimeoutMs);
    p.stdout.on("data", d=> out+=d);
    p.stderr.on("data", d=> err+=d);
    p.on("close", code=>{
      clearTimeout(to);
      if (code===0 || out.includes("ping") || out.includes("pong")) resolve({ ok:true });
      else if (out.includes("UnknownError") || err.includes("UnknownError")) resolve({ ok:false, reason: out.slice(0,300) || err.slice(0,300) });
      else resolve({ ok: code===0, reason: err.slice(0,300) });
    });
    p.on("error", e=>{ clearTimeout(to); resolve({ ok:false, reason:String(e).slice(0,200)}); });
  });
}

function renderPrompt(tpl, idea, retryCtx="") {
  const constraints = (idea.constraints||[]).length ? idea.constraints.map(c=>`- ${c}`).join("\n") : "(none — surprise us)";
  return tpl
    .replaceAll("{{NAME}}", idea.title)
    .replaceAll("{{CATEGORY}}", idea.category)
    .replaceAll("{{AESTHETIC}}", idea.aesthetic)
    .replaceAll("{{SPEC}}", idea.description + "\n\nFeatures:\n" + idea.features.map(f=>`- ${f}`).join("\n"))
    .replaceAll("{{FEATURES}}", idea.features.map(f=>`- ${f}`).join("\n"))
    .replaceAll("{{CONSTRAINTS}}", constraints)
    .replaceAll("{{RETRY_CONTEXT}}", retryCtx);
}

async function spawnWorker(dir, prompt, model) {
  const flags = ["run", prompt, "--auto", "--agent", "build", "--format", "json", "--model", model, "--port", "0"];
  log(`  spawning worker in ${path.basename(dir)} model=${model}`);
  const bin = process.env.OPENCODE_BIN || `${process.env.HOME}/.opencode/bin/opencode`;
  const start = Date.now();
  return new Promise((resolve) => {
    const p = spawn(bin, flags, { cwd: dir, env: { ...process.env, PATH: `${process.env.HOME}/.opencode/bin:${process.env.PATH}` }, stdio: ["ignore","pipe","pipe"] });
    let out="", err="";
    const to = setTimeout(()=> { try{p.kill("SIGKILL")}catch{} }, config.limits.buildTimeoutMs);
    p.stdout.on("data", d=> out+=d);
    p.stderr.on("data", d=> err+=d);
    p.on("close", code => {
      clearTimeout(to);
      const elapsedMs = Date.now() - start;
      resolve({ code, out, err, elapsedMs });
    });
    p.on("error", e => resolve({ code: 127, out:"", err: String(e), elapsedMs: Date.now()-start }));
  });
}

function parseVerify(out) {
  // find last VERIFY: {...} line
  const m = out.match(/VERIFY:\s*(\{[\s\S]*?\})\s*$/m) || out.match(/VERIFY:\s*(\{[\s\S]*?\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

async function buildProject(idea, isContinue=false) {
  const dir = path.join(PROJECTS_DIR, idea.slug);
  let retryCtx = "";
  if (isContinue) {
    const prevLog = idea.lastError?.slice(-1200) || "";
    retryCtx = `\n## RETRY — continuing previous work\nPrevious status: ${idea.status}. Last error:\n\`\`\`\n${prevLog}\n\`\`\`\nFix the issues and complete missing features. Keep what works.`;
    log(`  continuing ${idea.slug} (${idea.status})`);
  } else {
    if (!fs.existsSync(dir)) {
      await scaffold(idea);
    }
  }

  const stack = idea.stack || "html";
  const tplFile = stack === "html" ? "worker-html.md" : "worker-vite.md";
  const tpl = fs.readFileSync(path.join(ROOT, "prompts", tplFile), "utf8");
  const prompt = renderPrompt(tpl, idea, retryCtx);

  if (stack === "vite") {
    const rootCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "opencode.json"),"utf8"));
    fs.writeFileSync(path.join(dir, "opencode.json"), JSON.stringify(rootCfg, null, 2));
  }

  updateProject(idea.slug, { status: "building" });

  if (DRY) { log(`  [dry-run] would spawn worker for ${idea.slug} — not building`);
    updateProject(idea.slug, { status: "queued" });
    return { code: 0, out: "[dry-run]", err: "", elapsedMs: 0, verifyLine: null }; }

  // pick model with breaker + preflight
  let pick = pickModelWithBreaker();
  log(`  model pick: ${pick.model} (${pick.via})`);
  const pre = await preflightPing(pick.model);
  if (!pre.ok) {
    log(`  preflight fail for ${pick.model}: ${pre.reason?.slice(0,120)}`);
    recordHealth(pick.model, false, pre.reason||"preflight fail");
    // try fallback once
    const alt = pick.model === config.models.build ? config.models.buildFallback : config.models.build;
    const pre2 = await preflightPing(alt);
    if (pre2.ok) { pick = { model: alt, via: "fallback after preflight fail" }; log(`  switching to ${alt} (preflight ok)`); }
    else { log(`  both models preflight fail — proceeding with ${pick.model} anyway (will record fail)`); }
  }

  const res = await spawnWorker(dir, prompt, pick.model);
  const verifyLine = parseVerify(res.out);

  // persist log
  fs.mkdirSync(LOGS_DIR,{recursive:true});
  fs.writeFileSync(path.join(LOGS_DIR, `${idea.slug}.log`), `MODEL: ${pick.model} (${pick.via})\nVERIFY: ${verifyLine ? JSON.stringify(verifyLine) : "none"}\n\nSTDOUT:\n${res.out}\n\nSTDERR:\n${res.err}\n`);

  let workerResult = null;
  try { workerResult = JSON.parse(fs.readFileSync(path.join(dir, ".factory/result.json"),"utf8")); } catch {}

  // record health: success if exit 0 and VERIFY pass or workerResult pass; fail if UnknownError/timeout
  const hasUnknown = res.out.includes("UnknownError") || res.err.includes("UnknownError") || res.out.includes("Unexpected server error");
  const ok = res.code===0 && !hasUnknown;
  recordHealth(pick.model, ok, hasUnknown ? "UnknownError" : res.err.slice(0,300));

  return { ...res, workerResult, verifyLine, model: pick.model, modelVia: pick.via };
}

async function main() {
  if (STATUS) {
    const q = readQueue();
    const counts = {};
    for(const p of q.projects) counts[p.status]=(counts[p.status]||0)+1;
    console.log(JSON.stringify({ total: q.projects.length, counts, projects: q.projects.map(p=>({slug:p.slug,title:p.title,status:p.status,stack:p.stack,aesthetic:p.aesthetic,category:p.category})) }, null, 2));
    return;
  }

  const loop = JSON.parse(fs.readFileSync(LOOP_FILE,"utf8"));
  if (!loop.enabled && !ONLY && !DRY) { log("loop disabled (loop.json enabled=false) — skip"); return; }

  let idea;
  let isContinue = false;

  if (ONLY && ONLY.length) {
    const q = readQueue();
    const slug = ONLY[0];
    idea = q.projects.find(p=>p.slug===slug);
    if (!idea) throw new Error(`--only slug not found: ${slug}`);
    isContinue = true;
  } else {
    const cont = decideContinue();
    if (cont) { idea = cont; isContinue = true; }
    else {
      idea = await generateIdea();
      log(`  new idea: ${idea.title} [${idea.stack}/${idea.category}:${idea.aesthetic}] dedup=${idea.dedupScore?.toFixed(2)} theme=${idea.theme} constraints=[${(idea.constraints||[]).join("; ")}] stackReason=${idea.stackReason}`);
      if (idea.dedupScore > 0.75 && !DRY) log(`  ⚠ high dedup score — still proceeding`);
      if (DRY) {
        log(`  [dry-run] would add project ${idea.slug} — skipping write`);
        log(`  dry-run preview: ${JSON.stringify(idea, null, 2)}`);
        return;
      }
      const entry = {
        slug: idea.slug, title: idea.title, category: idea.category, stack: idea.stack,
        stackReason: idea.stackReason, aesthetic: idea.aesthetic, theme: idea.theme, constraints: idea.constraints,
        description: idea.description, features: idea.features, tags: idea.tags,
        status: "queued", deployed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      addProject(entry);
      idea = entry;
    }
  }

  if (!idea) { log("nothing to do"); return; }

  const tickStart = Date.now();
  let result = await buildProject(idea, isContinue);

  if (DRY) { log(`  [dry-run] — stopping before verify/deploy/commit`); return; }

  // verify — retry once with fallback model if we got UnknownError/timeout
  const dir = path.join(PROJECTS_DIR, idea.slug);
  let v = await verify(dir, idea.stack);
  let buildPassed = result.code === 0 && v.ok && !result.out.includes("UnknownError");
  let workerPass = result.workerResult?.status === "pass" || result.verifyLine?.build === "pass";

  if (!buildPassed && (result.out.includes("UnknownError") || result.out.includes("Unexpected server error"))) {
    const altModel = result.model === config.models.build ? config.models.buildFallback : config.models.build;
    log(`  worker UnknownError — retrying once with fallback ${altModel}`);
    // flip health already recorded; retry scaffold keep files, just re-run worker with fallback
    const retryPromptTpl = fs.readFileSync(path.join(ROOT, idea.stack==="html" ? "prompts/worker-html.md" : "prompts/worker-vite.md"),"utf8");
    const retryPrompt = renderPrompt(retryPromptTpl, idea, `\n## RETRY (fallback model) — previous worker hit UnknownError, retry with clean run. Keep any good work, ensure VERIFY line.\n`);
    const retryRes = await spawnWorker(dir, retryPrompt, altModel);
    fs.appendFileSync(path.join(LOGS_DIR, `${idea.slug}.log`), `\n\n=== FALLBACK RETRY ${altModel} ===\nSTDOUT:\n${retryRes.out}\nSTDERR:\n${retryRes.err}\n`);
    try { result.workerResult = JSON.parse(fs.readFileSync(path.join(dir, ".factory/result.json"),"utf8")); } catch {}
    result = { ...retryRes, workerResult: result.workerResult, verifyLine: parseVerify(retryRes.out), model: altModel, modelVia: "fallback retry" };
    v = await verify(dir, idea.stack);
    buildPassed = result.code === 0 && v.ok;
    workerPass = result.workerResult?.status === "pass" || result.verifyLine?.build === "pass";
    recordHealth(altModel, buildPassed, retryRes.err.slice(0,300));
  }

  if (buildPassed) {
    updateProject(idea.slug, { status: "done", buildPassed: true, lastError: null, deployed: false, lastModel: result.model });
    log(`  ✓ ${idea.slug} verified — done (model ${result.model}, VERIFY ${result.verifyLine ? JSON.stringify(result.verifyLine) : "none"})`);
  } else {
    const errSnippet = (result.err || v.reason || result.out || "").slice(-1500);
    const shouldContinue = result.code !== 0 && (errSnippet.toLowerCase().includes("error") || v.reason);
    updateProject(idea.slug, {
      status: shouldContinue ? "needs-iteration" : "needs-human",
      buildPassed: false, lastError: errSnippet, retries: (idea.retries||0)+1, lastModel: result.model
    });
    log(`  ✗ ${idea.slug} failed — ${v.reason || "worker exit "+result.code} → ${shouldContinue?"needs-iteration":"needs-human"}`);
  }

  // ——— receipt.json ———
  try {
    const receipt = {
      slug: idea.slug,
      title: idea.title,
      stack: idea.stack,
      stackReason: idea.stackReason,
      aesthetic: idea.aesthetic,
      theme: idea.theme,
      constraints: idea.constraints,
      model: result.model,
      modelVia: result.modelVia,
      verifyLine: result.verifyLine || null,
      workerResult: result.workerResult || null,
      buildPassed,
      verify: v,
      elapsedMs: result.elapsedMs || (Date.now()-tickStart),
      at: new Date().toISOString(),
    };
    fs.mkdirSync(path.join(dir, ".factory"),{recursive:true});
    fs.writeFileSync(path.join(dir, "receipt.json"), JSON.stringify(receipt, null, 2));
    fs.writeFileSync(path.join(dir, ".factory", "receipt.json"), JSON.stringify(receipt, null, 2));
  } catch {}

  // ——— run manifest site/runs/YYYY-MM-DD.json ———
  try {
    const day = new Date().toISOString().slice(0,10);
    const runsDir = path.join(SITE_DIR, "runs");
    fs.mkdirSync(runsDir,{recursive:true});
    const manifestPath = path.join(runsDir, `${day}.json`);
    let manifest = { date: day, runs: [] };
    try { manifest = JSON.parse(fs.readFileSync(manifestPath,"utf8")); } catch {}
    manifest.runs.push({
      slug: idea.slug, title: idea.title, stack: idea.stack, aesthetic: idea.aesthetic,
      model: result.model, modelVia: result.modelVia, verifyLine: result.verifyLine,
      buildPassed, verify: v, elapsedMs: result.elapsedMs, at: new Date().toISOString()
    });
    manifest.updatedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    // also latest.json
    fs.writeFileSync(path.join(runsDir, "latest.json"), JSON.stringify(manifest.runs[manifest.runs.length-1], null, 2));
  } catch(e){ log("run manifest failed", e.message); }

  // deploy + gallery + commit (even on failure we rebuild gallery so status is visible)
  if (!DRY) {
    try { await import("./scripts/build-gallery.mjs");
    try { await import("./scripts/build-status.mjs"); } catch {} } catch(e){ log("gallery build failed", e.message); }
      // ensure per-project -af DNS
  try { const { ensureAfDns } = await import("./scripts/ensure-af-dns.mjs"); await ensureAfDns(idea.slug); } catch(e){ log("af-dns failed", e.message); }
    for (const tgt of config.deploy.targets) {
      try {
        if (tgt === "cloudflare") { const m = await import("./deploy/cloudflare.mjs"); await m.deploy(); }
        if (tgt === "gh-pages")   { const m = await import("./deploy/ghpages.mjs"); await m.deploy(); }
      } catch(e){ log(`deploy ${tgt} failed:`, e.message); }
    }
    try {
      const { run } = await import("./lib/run.mjs");
      const hasGit = fs.existsSync(path.join(ROOT, ".git"));
      if (hasGit) {
        // commit gallery + receipt + logs (logs for observability)
        await run("git", ["add", "projects.json", `projects/${idea.slug}`, "site", "logs", "model-health.json"], { cwd: ROOT });
        const msg = buildPassed ? `feat(auto): ${idea.slug} — ${idea.title}` : `chore(auto): ${idea.slug} attempt — needs fix`;
        const st = await run("git", ["diff","--cached","--quiet"], { cwd: ROOT });
        if (st.code !== 0) {
          await run("git", ["commit","-m", msg], { cwd: ROOT });
          const hasRemote = (await run("git",["remote"],{cwd:ROOT})).out.trim().length>0;
          if (hasRemote) await run("git",["push"],{cwd:ROOT});
          log(`  git: committed & pushed — ${msg}`);
        }
      }
    } catch(e){ log("git commit failed", e.message); }
    const loop2 = JSON.parse(fs.readFileSync(LOOP_FILE,"utf8"));
    loop2.lastRun = new Date().toISOString();
    loop2.lastSlug = idea.slug;
    fs.writeFileSync(LOOP_FILE, JSON.stringify(loop2, null, 2));
  }

  log("tick complete.");
}

main().catch(e=>{ console.error(e); process.exit(1); });
