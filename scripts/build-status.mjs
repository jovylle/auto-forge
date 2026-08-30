import fs from "node:fs"; import path from "node:path";
import { ROOT, SITE_DIR } from "../config.mjs";
const q = JSON.parse(fs.readFileSync(path.join(ROOT,"projects.json"),"utf8"));
const loop = JSON.parse(fs.readFileSync(path.join(ROOT,"loop.json"),"utf8"));
let health = null; try { health = JSON.parse(fs.readFileSync(path.join(ROOT,"model-health.json"),"utf8")); } catch {}
const logs = fs.existsSync(path.join(ROOT,"logs")) ? fs.readdirSync(path.join(ROOT,"logs")).filter(f=>f.endsWith(".log")).slice(-12) : [];
const status = {
  total: q.projects.length,
  counts: q.projects.reduce((a,p)=>{a[p.status]=(a[p.status]||0)+1;return a},{}),
  projects: q.projects.map(p=>({slug:p.slug,title:p.title,status:p.status,stack:p.stack,stackReason:p.stackReason||null,category:p.category,aesthetic:p.aesthetic||null,theme:p.theme||null,constraints:p.constraints||[],tags:p.tags||[],updatedAt:p.updatedAt,lastError:p.lastError?.slice(0,400)||null,lastModel:p.lastModel||null})),
  loop, health, logs, pagesOrigin: "https://auto-forge-7dq.pages.dev", af: "https://af.uft1.com", today: "https://today.af.uft1.com", updatedAt: new Date().toISOString()
};
fs.mkdirSync(SITE_DIR,{recursive:true});
fs.writeFileSync(path.join(SITE_DIR,"status.json"), JSON.stringify(status,null,2));
console.log("status.json:", status.total, "projects health:", health?Object.keys(health).join(","):"none");
