// scripts/build-gallery.mjs — generates web/data.js + site/index.html from projects.json
import fs from "node:fs";
import path from "node:path";
import { ROOT, SITE_DIR, PROJECTS_DIR } from "../config.mjs";

const QUEUE_FILE = path.join(ROOT, "projects.json");

function readQueue(){ try{ return JSON.parse(fs.readFileSync(QUEUE_FILE,"utf8")); }catch{ return {projects:[]}; } }

const q = readQueue();
const done = q.projects.filter(p=>p.status==="done");

const dataJs = `export const projects = ${JSON.stringify(q.projects, null, 2)};\nexport const stats = { total: ${q.projects.length}, done: ${done.length} };\n`;
fs.mkdirSync(path.join(ROOT, "web"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "web", "data.js"), dataJs);

// Build site shell
fs.mkdirSync(SITE_DIR, { recursive: true });
fs.mkdirSync(path.join(SITE_DIR,"p"), { recursive: true });

// copy projects/*/dist or index.html into site/p/<slug>/
let copied=0;
for(const p of done){
  const srcDist = path.join(PROJECTS_DIR, p.slug, "dist");
  const srcHtml = path.join(PROJECTS_DIR, p.slug, "index.html");
  const dest = path.join(SITE_DIR, "p", p.slug);
  fs.mkdirSync(dest,{recursive:true});
  if (fs.existsSync(srcDist)) {
    // copy dist contents
    for (const f of fs.readdirSync(srcDist)) {
      const s = path.join(srcDist,f), d=path.join(dest,f);
      if (fs.statSync(s).isDirectory()) { fs.cpSync(s,d,{recursive:true}); } else fs.copyFileSync(s,d);
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
.status.building{background:#2a1e0a;color:#fb3;border:1px solid #543}
a{color:#8ab4ff;text-decoration:none}
</style></head><body>
<header><h1>auto-forge</h1><span class="pill">${q.projects.length} projects · ${done.length} done · daily bot</span><a href="https://github.com" style="margin-left:auto;font-size:12px;opacity:.6">hermes cron 09:00 PHT</a></header>
<div class="grid">
${q.projects.map(p=>`
  <div class="card">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><span class="status ${p.status}">${p.status}</span><span style="font-size:11px;opacity:.6">${p.stack||""} · ${p.category||""}</span></div>
    <h3>${p.title||p.slug}</h3>
    <p>${(p.description||"").slice(0,110)}</p>
    <div>${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    ${p.status==="done"?`<div style="margin-top:10px"><a href="./p/${p.slug}/">open →</a></div>`:""}
  </div>`).join("")}
${q.projects.length===0?`<div class="card"><p>No projects yet — the bot runs daily at 09:00 PHT. Trigger manually: <code>node daily.mjs</code></p></div>`:""}
</div>
<footer style="max-width:1000px;margin:20px auto;padding:0 20px;opacity:.5;font-size:12px">auto-forge · hermes cron · <a href="./data.js">data.js</a></footer>
</body></html>
`;
fs.writeFileSync(path.join(SITE_DIR, "index.html"), galleryHtml);
fs.copyFileSync(path.join(ROOT,"web","data.js"), path.join(SITE_DIR,"data.js"));
console.log(`gallery: ${q.projects.length} projects, ${copied} copied to site/p/`);
