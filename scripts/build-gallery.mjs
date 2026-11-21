// scripts/build-gallery.mjs — generates web/data.js + site/index.html from projects.json
import fs from "node:fs";
import path from "node:path";
import { ROOT, SITE_DIR, PROJECTS_DIR } from "../config.mjs";

const QUEUE_FILE = path.join(ROOT, "projects.json");

function readQueue(){ try{ return JSON.parse(fs.readFileSync(QUEUE_FILE,"utf8")); }catch{ return {projects:[]}; } }

const q = readQueue();
const done = q.projects.filter(p=>p.status==="done");
const iterating = q.projects.filter(p=>p.status==="needs-iteration");
const shipped = [...done, ...iterating];
// anything not shippable: queued, building, needs-human — shown as pending/in-progress
const pending = q.projects.filter(p=>p.status!=="done"&&p.status!=="needs-iteration");
const counts = q.projects.reduce((a,p)=>{a[p.status]=(a[p.status]||0)+1;return a;},{});

const dataJs = `export const projects = ${JSON.stringify(q.projects, null, 2)};\nexport const stats = { total: ${q.projects.length}, done: ${done.length}, counts: ${JSON.stringify(counts)} };\n`;
fs.mkdirSync(path.join(ROOT, "web"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "web", "data.js"), dataJs);

// Build site shell
fs.mkdirSync(SITE_DIR, { recursive: true });
fs.mkdirSync(path.join(SITE_DIR,"p"), { recursive: true });

// copy projects/*/dist or index.html into site/p/<slug>/
let copied=0;
for(const p of shipped){
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
    // safety net: rewrite root-absolute asset refs ("/assets/...") to relative ("./assets/...")
    // so the page works under /p/<slug>/ subpaths (vite default base '/' breaks there)
    try {
      const idx = path.join(dest,"index.html");
      const html = fs.readFileSync(idx,"utf8");
      const fixed = html.replace(/((?:src|href)=")\/(?!\/)/g, "$1./");
      if (fixed !== html) { fs.writeFileSync(idx, fixed); console.log(`  ${p.slug}: rewrote absolute asset paths → relative`); }
    } catch {}
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
    if (p.stack === "vite") console.log(`  ⚠ ${p.slug}: no dist/ — copied unbuilt dev index.html (page will be blank until npm run build runs)`);
    fs.copyFileSync(srcHtml, path.join(dest, "index.html"));
    for (const extra of ["style.css","app.js"]) {
      const s2 = path.join(PROJECTS_DIR,p.slug,extra);
      if (fs.existsSync(s2)) fs.copyFileSync(s2, path.join(dest, extra));
    }
    copied++;
  }
}

// site/index.html gallery — showcase first, build logs last.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const ts = p => Date.parse(p.updatedAt || p.createdAt || 0) || 0;
const hue = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

// one card per idea; rebuilds of the same title become variant links on the newest one
const groups = [];
const seen = new Map();
for (const p of [...shipped].sort((a, b) => ts(b) - ts(a))) {
  const key = (p.title || p.slug).trim().toLowerCase();
  if (seen.has(key)) { seen.get(key).variants.push(p); continue; }
  const g = { primary: p, variants: [] };
  seen.set(key, g);
  groups.push(g);
}

const card = ({ primary: p, variants }) => {
  const h = hue(p.slug);
  const glyph = esc((p.title || p.slug).replace(/[^A-Za-z0-9]/g, "")[0] || "•").toUpperCase();
  const desc = (p.description || "").trim() === (p.title || "").trim() ? "" : (p.description || "").slice(0, 140);
  const search = esc([p.title, p.description, (p.tags || []).join(" "), p.category, p.aesthetic, p.stack].join(" ").toLowerCase());
  const variantLinks = variants.map(v => `<a href="./p/${esc(v.slug)}/">${esc(v.aesthetic || v.slug)}</a>`).join(", ");
  return `<article class="card" data-cat="${esc(p.category || "")}" data-title="${esc((p.title || p.slug).toLowerCase())}" data-t="${ts(p)}" data-search="${search}">
  <a class="poster" href="./p/${esc(p.slug)}/" style="--h:${h};--h2:${(h + 40) % 360}" aria-label="${esc(p.title || p.slug)} — open">
    <span class="glyph" aria-hidden="true">${glyph}</span>
    <span class="kind">${esc(p.category || "toy")} · ${esc(p.stack || "")}</span>
    ${p.status === "needs-iteration" ? `<span class="wip">iterating</span>` : ""}
  </a>
  <div class="body">
    <h3><a href="./p/${esc(p.slug)}/">${esc(p.title || p.slug)}</a></h3>
    ${desc ? `<p>${esc(desc)}</p>` : ""}
    <div class="tags">${(p.tags || []).slice(0, 4).map(t => `<span>${esc(t)}</span>`).join("")}</div>
    <div class="meta">
      <a class="ext" href="https://${esc(p.slug)}-af.uft1.com/" target="_blank" rel="noopener">live ↗</a>
      ${variants.length ? `<span class="variants">rebuilt: ${variantLinks}</span>` : ""}
    </div>
  </div>
</article>`;
};

const pendingRow = p => `<li><span class="dot ${esc(p.status)}">${esc(p.status)}</span><span class="pt">${esc(p.title || p.slug)}</span><span class="pr">${esc(String(p.lastError || "").replace(/\s+/g, " ").slice(0, 120))}</span><time>${(p.updatedAt || "").slice(0, 10)}</time></li>`;

const cats = [...new Set(groups.map(g => g.primary.category).filter(Boolean))];
const catChip = c => `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === "all" ? "true" : "false"}">${esc(c)}</button>`;

const galleryHtml = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>auto-forge — a small web toy, every day</title>
<meta name="description" content="A bot ships one small web toy every morning. ${shipped.length} live, playable in the browser."/>
<style>
:root{--bg:#08080c;--card:#111119;--line:#20202b;--ink:#ececf2;--dim:#9a9aab;--hi:#8ab4ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
header{padding:60px 0 10px;display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}
h1{margin:0;font:600 42px/1.02 ui-serif,Georgia,serif;letter-spacing:-.025em}
.tagline{margin:10px 0 0;color:var(--dim);max-width:52ch}
.tagline b{color:var(--ink);font-weight:600}
.head-links{margin-left:auto;display:flex;gap:18px;font-size:13px;color:var(--dim);padding-bottom:6px}
.head-links a:hover{color:var(--ink)}
.bar{position:sticky;top:0;z-index:20;margin-top:24px;background:color-mix(in srgb,#08080c 90%,transparent);backdrop-filter:blur(12px);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.bar-in{max-width:1120px;margin:0 auto;display:flex;gap:10px;align-items:center;padding:12px 24px;flex-wrap:wrap}
input[type=search]{flex:1 1 220px;min-width:160px;background:#12121a;border:1px solid var(--line);border-radius:10px;color:var(--ink);padding:9px 13px;font:inherit;font-size:14px}
input[type=search]:focus{outline:2px solid #3d5bd4;outline-offset:1px;border-color:transparent}
input::placeholder{color:#6f6f80}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chips button{background:transparent;border:1px solid var(--line);color:var(--dim);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}
.chips button:hover{border-color:#3a3a4d;color:var(--ink)}
.chips button[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:#0a0a0f}
select{background:#12121a;border:1px solid var(--line);border-radius:10px;color:var(--dim);padding:8px 10px;font:inherit;font-size:13px}
.count{font-size:12px;color:var(--dim);min-width:62px;text-align:right}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:22px;padding:26px 24px 10px;max-width:1120px;margin:0 auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s ease,border-color .15s ease}
.card:hover{transform:translateY(-2px);border-color:#3a3a4d}
.card[hidden]{display:none}
.poster{position:relative;display:block;aspect-ratio:16/10;background:linear-gradient(150deg,hsl(var(--h) 52% 27%),hsl(var(--h2) 58% 9%));overflow:hidden}
.glyph{position:absolute;right:-4px;bottom:-34px;font:700 132px/1 ui-serif,Georgia,serif;color:#fff;opacity:.16;letter-spacing:-.05em;user-select:none}
.kind{position:absolute;left:12px;top:12px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#fff;opacity:.8;background:#0003;border:1px solid #ffffff26;border-radius:999px;padding:3px 9px;backdrop-filter:blur(4px)}
.wip{position:absolute;right:12px;top:12px;font-size:11px;color:#fb3;background:#2a1e0acc;border:1px solid #543;border-radius:999px;padding:3px 9px}
.body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:9px;flex:1}
.card h3{margin:0;font-size:16px;line-height:1.25}
.card h3 a:hover{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.card p{margin:0;font-size:13px;color:var(--dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tags span{font-size:11px;color:#b9b9c9;border:1px solid var(--line);border-radius:999px;padding:2px 8px}
.meta{margin-top:auto;padding-top:2px;font-size:12px;color:var(--dim);display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}
.ext{color:var(--hi)}
.ext:hover{text-decoration:underline}
.variants a{color:var(--hi)}
.variants a:hover{text-decoration:underline}
.empty{padding:60px 24px;text-align:center;color:var(--dim);font-size:14px}
.empty[hidden]{display:none}
details.parked{max-width:1120px;margin:26px auto 0;padding:0 24px}
details.parked summary{cursor:pointer;color:var(--dim);font-size:13px;list-style:none}
details.parked summary::-webkit-details-marker{display:none}
details.parked summary::before{content:"▸ ";color:#6a6a7a}
details.parked[open] summary::before{content:"▾ "}
details.parked ul{list-style:none;margin:12px 0 0;padding:0;border-top:1px solid var(--line)}
details.parked li{display:flex;gap:12px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;flex-wrap:wrap}
.dot{font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid;white-space:nowrap}
.dot.needs-human{color:#f88;border-color:#533;background:#2a0a0a}
.dot.queued{color:#aab;border-color:#445;background:#1a1a2a}
.dot.building{color:#8ab4ff;border-color:#345;background:#1a2340}
.dot.needs-iteration{color:#fb3;border-color:#543;background:#2a1e0a}
.pt{font-weight:600}
.pr{color:var(--dim);flex:1;min-width:220px}
time{color:#6a6a7a;font-size:12px}
footer{border-top:1px solid var(--line);margin-top:36px;color:var(--dim);font-size:12px}
footer div{max-width:1120px;margin:0 auto;padding:20px 24px 52px;display:flex;gap:18px;flex-wrap:wrap}
footer a:hover{color:var(--ink)}
@media(max-width:640px){
  header{padding:34px 0 4px;gap:8px}
  h1{font-size:34px}
  .tagline{font-size:14px;margin-top:8px}
  .head-links{margin-left:0;width:100%;padding:12px 0 0;gap:16px}
  .bar-in{padding:10px 16px;gap:8px}
  .chips{width:100%;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;mask-image:linear-gradient(to right,#000 92%,transparent)}
  .chips::-webkit-scrollbar{display:none}
  .chips button{white-space:nowrap}
  .grid{padding:18px 16px 4px;gap:16px;grid-template-columns:1fr}
  .wrap,details.parked{padding-inline:16px}
  footer div{padding:18px 16px 40px;gap:12px}
}
</style></head><body>
<header class="wrap">
  <div>
    <h1>auto-forge</h1>
    <p class="tagline">A bot ships one small web toy every morning. <b>${shipped.length} builds live</b> — games, clocks, maps and odd little instruments, all playable in the browser.</p>
  </div>
  <nav class="head-links"><a href="https://today-af.uft1.com">today →</a><a href="./status.json">status.json</a></nav>
</header>
<div class="bar"><div class="bar-in">
  <input id="q" type="search" placeholder="Search ${groups.length} toys…" aria-label="Search toys"/>
  <div class="chips">${["all", ...cats].map(catChip).join("")}</div>
  <select id="sort" aria-label="Sort"><option value="new">newest</option><option value="az">A–Z</option></select>
  <span class="count" id="count">${groups.length} toys</span>
</div></div>
<main class="grid" id="grid">${groups.map(card).join("")}</main>
<div class="empty" id="empty" hidden>Nothing matches that. <button type="button" onclick="document.getElementById('q').value='';document.getElementById('q').dispatchEvent(new Event('input'))" style="background:none;border:0;color:#8ab4ff;font:inherit;cursor:pointer;padding:0">Clear search</button></div>
${pending.length ? `<details class="parked"><summary>${pending.length} build${pending.length === 1 ? "" : "s"} parked or failed — open for logs</summary><ul>${pending.map(pendingRow).join("")}</ul></details>` : ""}
<footer><div>auto-forge · bot runs daily 09:00 PHT · <a href="./status.json">status.json</a> · <a href="./runs/latest.json">latest run</a> · <a href="https://today-af.uft1.com">today-af.uft1.com</a></div></footer>
<script>
(function(){
  var grid=document.getElementById("grid"),q=document.getElementById("q"),count=document.getElementById("count"),empty=document.getElementById("empty"),sort=document.getElementById("sort");
  var cards=Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var chips=Array.prototype.slice.call(document.querySelectorAll(".chips button"));
  var cat="all";
  function apply(){
    var s=q.value.trim().toLowerCase(),n=0;
    cards.forEach(function(c){
      var show=(cat==="all"||c.dataset.cat===cat)&&(!s||c.dataset.search.indexOf(s)>-1);
      c.hidden=!show; if(show)n++;
    });
    count.textContent=n+(n===1?" toy":" toys");
    empty.hidden=n>0;
  }
  q.addEventListener("input",apply);
  chips.forEach(function(b){
    b.addEventListener("click",function(){
      cat=b.dataset.cat;
      chips.forEach(function(o){o.setAttribute("aria-pressed",String(o===b));});
      apply();
    });
  });
  sort.addEventListener("change",function(){
    var az=sort.value==="az";
    cards.sort(function(a,b){
      return az?a.dataset.title.localeCompare(b.dataset.title):Number(b.dataset.t)-Number(a.dataset.t);
    });
    cards.forEach(function(c){grid.appendChild(c);});
  });
  apply();
})();
</script>
</body></html>
`;
fs.writeFileSync(path.join(SITE_DIR, "index.html"), galleryHtml);
fs.copyFileSync(path.join(ROOT,"web","data.js"), path.join(SITE_DIR,"data.js"));
console.log(`gallery: ${q.projects.length} projects (${shipped.length} shipped, ${pending.length} pending), ${copied} copied to site/p/`);
