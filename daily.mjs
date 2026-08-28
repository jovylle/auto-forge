// daily.mjs — THE BOT. One tick = continue-or-new → scaffold → build → verify → deploy → commit.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, ROOT, PROJECTS_DIR, QUEUE_FILE, LOOP_FILE } from "./config.mjs";
import { readQueue, writeQueue, updateProject, addProject, slugify } from "./lib/run.mjs";
import { decideContinue, generateIdea } from "./lib/ideas.mjs";
import { scaffold } from "./lib/scaffold.mjs";
import { verify } from "./lib/verify.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const STATUS = args.includes("--status");
const ONLY = args.find(a=>a.startsWith("--only="))?.split("=")[1]?.split(",").filter(Boolean);

function log(...a){ console.log(new Date().toISOString(), ...a); }

function renderPrompt(tpl, idea, retryCtx="") {
  return tpl
    .replaceAll("{{NAME}}", idea.title)
    .replaceAll("{{CATEGORY}}", idea.category)
    .replaceAll("{{AESTHETIC}}", idea.aesthetic)
    .replaceAll("{{SPEC}}", idea.description + "\n\nFeatures:\n" + idea.features.map(f=>`- ${f}`).join("\n"))
    .replaceAll("{{FEATURES}}", idea.features.map(f=>`- ${f}`).join("\n"))
    .replaceAll("{{RETRY_CONTEXT}}", retryCtx);
}

function pickModel(primary, fallback) {
  // factory-style: try primary, caller handles exhaustion
  return primary;
}

async function spawnWorker(dir, prompt, model) {
  const flags = ["run", prompt, "--model", model, "--agent", "build", "--output-format", "stream-json", "--verbose"];
  log(`  spawning worker in ${path.basename(dir)} model=${model}`);
  return new Promise((resolve) => {
    const p = spawn("opencode", flags, { cwd: dir, stdio: ["ignore","pipe","pipe"] });
    let out="", err="";
    const to = setTimeout(()=> { try{p.kill("SIGTERM")}catch{} }, config.limits.buildTimeoutMs);
    p.stdout.on("data", d=> out+=d);
    p.stderr.on("data", d=> err+=d);
    p.on("close", code => {
      clearTimeout(to);
      resolve({ code, out, err });
    });
    p.on("error", e => resolve({ code: 127, out:"", err: String(e) }));
  });
}

async function buildProject(idea, isContinue=false) {
  const dir = path.join(PROJECTS_DIR, idea.slug);
  let retryCtx = "";
  if (isContinue) {
    const specPath = path.join(dir, "SPEC.md");
    const prevLog = idea.lastError?.slice(-1200) || "";
    retryCtx = `\n## RETRY — continuing previous work\nPrevious status: ${idea.status}. Last error:\n\`\`\`\n${prevLog}\n\`\`\`\nFix the issues and complete missing features. Keep what works.`;
    log(`  continuing ${idea.slug} (${idea.status})`);
  } else {
    // fresh scaffold
    if (!fs.existsSync(dir)) {
      await scaffold(idea);
    }
  }

  // write per-project opencode.json + inject prompt
  const stack = idea.stack || "html";
  const tplFile = stack === "html" ? "worker-html.md" : "worker-vite.md";
  const tpl = fs.readFileSync(path.join(ROOT, "prompts", tplFile), "utf8");
  const prompt = renderPrompt(tpl, idea, retryCtx);

  // vite needs opencode.json in project dir for agents
  if (stack === "vite") {
    const rootCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "opencode.json"),"utf8"));
    fs.writeFileSync(path.join(dir, "opencode.json"), JSON.stringify(rootCfg, null, 2));
  }

  updateProject(idea.slug, { status: "building" });

  if (DRY) { log(`  [dry-run] would spawn worker for ${idea.slug}`); return { code: 0, out: "[dry]", err: "" }; }

  const model = pickModel(config.models.build, config.models.buildFallback);
  const res = await spawnWorker(dir, prompt, model);

  // persist log
  const logDir = path.join(ROOT, "logs");
  fs.mkdirSync(logDir,{recursive:true});
  fs.writeFileSync(path.join(logDir, `${idea.slug}.log`), `STDOUT:\n${res.out}\n\nSTDERR:\n${res.err}\n`);

  // read .factory/result.json if worker wrote it
  let workerResult = null;
  try { workerResult = JSON.parse(fs.readFileSync(path.join(dir, ".factory/result.json"),"utf8")); } catch {}

  return { ...res, workerResult };
}

async function main() {
  if (STATUS) {
    const q = readQueue();
    const counts = {};
    for(const p of q.projects) counts[p.status]=(counts[p.status]||0)+1;
    console.log(JSON.stringify({ total: q.projects.length, counts, projects: q.projects.map(p=>({slug:p.slug,title:p.title,status:p.status,stack:p.stack})) }, null, 2));
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
      log(`  new idea: ${idea.title} [${idea.stack}/${idea.category}] dedup=${idea.dedupScore?.toFixed(2)} aesthetic=${idea.aesthetic}`);
      if (idea.dedupScore > 0.75 && !DRY) log(`  ⚠ high dedup score — still proceeding (tweak seeds if repeats)`);
      const entry = {
        slug: idea.slug, title: idea.title, category: idea.category, stack: idea.stack,
        aesthetic: idea.aesthetic, description: idea.description,
        features: idea.features, tags: idea.tags,
        status: "queued", deployed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      addProject(entry);
      idea = entry;
    }
  }

  if (!idea) { log("nothing to do"); return; }

  const result = await buildProject(idea, isContinue);

  // verify
  const dir = path.join(PROJECTS_DIR, idea.slug);
  const v = await verify(dir, idea.stack);
  const buildPassed = result.code === 0 && v.ok;
  const workerPass = result.workerResult?.status === "pass";

  if (buildPassed) {
    updateProject(idea.slug, { status: "done", buildPassed: true, lastError: null, deployed: false });
    log(`  ✓ ${idea.slug} verified — done`);
  } else {
    const errSnippet = (result.err || v.reason || result.out || "").slice(-1500);
    const shouldContinue = result.code !== 0 && (errSnippet.toLowerCase().includes("error") || v.reason);
    updateProject(idea.slug, {
      status: shouldContinue ? "needs-iteration" : "needs-human",
      buildPassed: false, lastError: errSnippet, retries: (idea.retries||0)+1
    });
    log(`  ✗ ${idea.slug} failed — ${v.reason || "worker exit "+result.code} → ${shouldContinue?"needs-iteration":"needs-human"}`);
  }

  // deploy + gallery + commit (even on failure we rebuild gallery so status is visible)
  if (!DRY) {
    try { await import("./scripts/build-gallery.mjs"); } catch(e){ log("gallery build failed", e.message); }
    for (const tgt of config.deploy.targets) {
      try {
        if (tgt === "cloudflare") { const m = await import("./deploy/cloudflare.mjs"); await m.deploy(); }
        if (tgt === "gh-pages")   { const m = await import("./deploy/ghpages.mjs"); await m.deploy(); }
      } catch(e){ log(`deploy ${tgt} failed:`, e.message); }
    }
    // git commit if repo
    try {
      const { run } = await import("./lib/run.mjs");
      const hasGit = fs.existsSync(path.join(ROOT, ".git"));
      if (hasGit) {
        await run("git", ["add", "projects.json", `projects/${idea.slug}`, "site"], { cwd: ROOT });
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
    // update loop.json
    const loop2 = JSON.parse(fs.readFileSync(LOOP_FILE,"utf8"));
    loop2.lastRun = new Date().toISOString();
    loop2.lastSlug = idea.slug;
    fs.writeFileSync(LOOP_FILE, JSON.stringify(loop2, null, 2));
  }

  log("tick complete.");
}

main().catch(e=>{ console.error(e); process.exit(1); });
