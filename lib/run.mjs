// lib/run.mjs — queue helpers (atomic) + shell
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { QUEUE_FILE } from "../config.mjs";

export function readQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")); }
  catch { return { projects: [] }; }
}
export function writeQueue(data) {
  const tmp = QUEUE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, QUEUE_FILE);
}
export function updateProject(slug, patch) {
  const q = readQueue();
  const p = q.projects.find(x => x.slug === slug);
  if (!p) throw new Error(`unknown slug ${slug}`);
  Object.assign(p, patch, { updatedAt: new Date().toISOString() });
  writeQueue(q);
  return p;
}
export function addProject(entry) {
  const q = readQueue();
  if (q.projects.some(p => p.slug === entry.slug)) throw new Error(`slug exists: ${entry.slug}`);
  entry.createdAt = entry.createdAt || new Date().toISOString();
  entry.updatedAt = new Date().toISOString();
  q.projects.push(entry);
  writeQueue(q);
  return entry;
}
export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60) || `proj-${Date.now().toString(36)}`;
}

export function run(cmd, args, opts={}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore","pipe","pipe"], ...opts });
    let out="", err="";
    p.stdout.on("data", d => out+=d);
    p.stderr.on("data", d => err+=d);
    p.on("close", code => resolve({ code, out, err }));
    p.on("error", reject);
  });
}
