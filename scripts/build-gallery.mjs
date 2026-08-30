// scripts/build-gallery.mjs — generates web/data.js + site/index.html from projects.json
import fs from "node:fs";
import path from "node:path";
import { ROOT, SITE_DIR, PROJECTS_DIR } from "../config.mjs";

const QUEUE_FILE = path.join(ROOT, "projects.json");

function readQueue(){ try{ return JSON.parse(fs.readFileSync(QUEUE_FILE,"utf8")); }catch{ return {projects:[]}; } }

const q = readQueue();
const done = q.projects.filter(p=>p.status==="done");
const iterating = q.projects.filter(p=>p.status==="needs-iteration");

const dataJs = `export const projects = ${JSON.stringify(q.projects, null, 2)};\nexport const stats = { total: ${q.projects.length}, done: ${done.length} };\n`;
fs.mkdirSync(path.join(ROOT, "web"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "web", "data.js"), dataJs);

// Build site shell
fs.mkdirSync(SITE_DIR, { recursive: true });
fs.mkdirSync(path.join(SITE_DIR,"p"), { recursive: true });

// copy projects/*/dist or index.html into site/p/<slug>/
let copied=0;
for(const p of [...done, ...iterating]){
  const srcDist = path.join(PROJECTS_DIR, p.slug, "dist");
  const srcHtml = path.join(PROJECTS_DIR, p.slug, "index.html");
  const dest = path.join(SITE_DIR, "p", p.slug);
  fs.mkdirSync(dest,{recursive:true});
  // clean previous
  for (const f of fs.readdirSync(dest)) {
    try { fs.rmSync(path.join(dest,f), {recursive:true, force:true}); } catch {}
  }
  if (fs.existsSync(srcDist)) {
    for (const f of fs.readdirSync(srcDist)) {
      const s = path.join(srcDist,f), d=path.join(dest,f);
      if (fs.statSync(s).isDirectory()) { fs.cpSync(s,d,{recursive:true}); } else fs.copyFileSync(s,d);
    }
    // add needs-iteration badge overlay page if needed
    if (p.status==="needs-iteration") {
      const badge = `<div style="position:fixed;bottom:12px;right:12px;background:#2a1e0a;color:#fb3;border:1px solid #543;border-radius:999px;padding:6px 12px;font:12px system-ui">needs-iteration — bot will retry</div>`;
      try {
        const idx = path.join(dest,"index.html");
        let html = fs.readFileSync(idx,"utf8");
        if (!html.includes("needs-iteration")) html = html.replace("</body>", badge+"</body>");
        fs.writeFileSync(idx, html);
      } catch {}
    }
    copied++;
  } else if (fs.existsSync(srcHtml)) {
    fs.copyFileSync(srcHtml, path.join(dest, "index.html"));
    for (const extra of ["style.css","app.js"]) {
      const s2 = path.join(PROJECTS_DIR,p.slug,extra);
      if (fs.existsSync(s2)) fs.copyFileSync(s2, path.join(dest, extra));
    }
    copied++;
  }
}

// site/index.html gallery
const galleryHtml = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>auto-forge — daily bots build</title>
<style>
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#0a0a0f;color:#e8e8ef}
header{max-width:1000px;margin:32px auto 16px;padding:0 20px;display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}
h1{margin:0;font-size:22px} .pill{background:#1a1a2a;border:1px solid #333;border-radius:999px;padding:4px 10px;font-size:12px}
.grid{max-width:1000px;margin:0 auto;padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.card{border:1px solid #222;border-radius:14px;padding:14px;background:#111119}
.card h3{margin:0 0 6px;font-size:15px}
.card p{margin:0 0 8px;opacity:.75;font-size:13px}
.tag{display:inline-block;font-size:11px;border:1px solid #333;border-radius:999px;padding:2px 7px;margin:2px 4px 0 0}
.status{font-size:11px;border-radius:999px;padding:2px 7px}
.status.done{background:#0a2a12;color:#6f6;border:1px solid #1a4}
.status.needs-iteration{background:#2a1e0a;color:#fb3;border:1px solid #543}
.status.building{background:#2a1e0a;color:#fb3;border:1px solid #543}
a{color:#8ab4ff;text-decoration:none}
</style></head><body>
<header><h1>auto-forge</h1><span class="pill">${q.projects.length} projects · ${done.length} done · daily bot</span><a href="https://af.uft1.com/status.json" style="margin-left:auto;font-size:12px;opacity:.6">status.json</a> <a href="https://today.af.uft1.com" style="font-size:12px">today →</a></header>
<div class="grid">
${q.projects.map(p=>`
  <div class="card">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><span class="status ${p.status}">${p.status}</span><span style="font-size:11px;opacity:.6">${p.stack||""} · ${p.category||""} · ${p.aesthetic||""}</span></div>
    <h3>${p.title||p.slug}</h3>
    <p>${(p.description||"").slice(0,120)}</p>
    <div style="opacity:.6;font-size:11px;margin-bottom:6px">${p.stackReason||""} ${p.theme?`· theme ${p.theme}`:""} ${p.constraints?`· ${p.constraints.join(" · ")}`:""}</div>
    <div>${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    ${p.status==="done"||p.status==="needs-iteration"?`<div style="margin-top:10px"><a href="./p/${p.slug}/">open →</a> <a href="https://${p.slug}.af.uft1.com/" style="margin-left:8px;opacity:.6">${p.slug}.af.uft1.com</a></div>`:""}
  </div>`).join("")}
${q.projects.length===0?`<div class="card"><p>No projects yet — the bot runs daily at 09:00 PHT. Trigger manually: <code>node daily.mjs</code></p></div>`:""}
</div>
<footer style="max-width:1000px;margin:20px auto;padding:0 20px;opacity:.5;font-size:12px">auto-forge · hermes cron 09:00 PHT · <a href="./status.json">status.json</a> · <a href="./runs/latest.json">latest run</a> · <a href="https://today.af.uft1.com">today.af.uft1.com</a></footer>
</body></html>
`;
fs.writeFileSync(path.join(SITE_DIR, "index.html"), galleryHtml);
fs.copyFileSync(path.join(ROOT,"web","data.js"), path.join(SITE_DIR,"data.js"));
console.log(`gallery: ${q.projects.length} projects, ${copied} copied to site/p/`);
