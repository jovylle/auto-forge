// lib/ideas.mjs — picks next idea: continue? seed? LLM generate? + dedup.
import fs from "node:fs";
import path from "node:path";
import { AESTHETICS, config, ROOT } from "../config.mjs";
import { readQueue, slugify } from "./run.mjs";

const SEEDS_FILE = path.join(ROOT, "seeds.json");

function readSeeds() {
  try { return JSON.parse(fs.readFileSync(SEEDS_FILE,"utf8")).seeds || []; } catch { return []; }
}

function tokenize(s){ return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)); }
function jaccard(a,b){
  const A=tokenize(a), B=tokenize(b);
  let inter=0; for(const t of A) if(B.has(t)) inter++;
  const uni = new Set([...A,...B]).size || 1;
  return inter/uni;
}

function dedupScore(candidate, existing) {
  const candText = `${candidate.title} ${candidate.tags?.join(" ")||""} ${candidate.features?.join(" ")||""}`;
  let max=0;
  for(const p of existing){
    const existText = `${p.title} ${p.tags?.join(" ")||""} ${p.features?.join(" ")||""}`;
    max = Math.max(max, jaccard(candText, existText));
    if (candidate.slug && p.slug === candidate.slug) return 1;
  }
  return max;
}

function pickAesthetic() { return AESTHETICS[Math.floor(Math.random()*AESTHETICS.length)]; }

function vibeStackForIdea(title, category) {
  const t = (title+" "+category).toLowerCase();
  if (config.stackHeuristic.htmlKeywords.some(k => t.includes(k))) return "html";
  // randomize but bias vite for tools/apps
  if (["tool","app","dashboard","tracker"].some(k=>t.includes(k))) return "vite";
  return Math.random() < 0.45 ? "html" : "vite";
}

export function decideContinue() {
  const q = readQueue();
  // priority: building stale, continuing, needs-iteration, needs-human (retry once)
  const staleMs = 24*3600*1000;
  const now = Date.now();
  const candidates = q.projects.filter(p => {
    if (p.status === "continuing" || p.status === "needs-iteration") return true;
    if (p.status === "building" && p.updatedAt && (now - new Date(p.updatedAt).getTime() > staleMs)) return true;
    if (p.status === "needs-human" && (p.retries||0) < 1) return true;
    return false;
  });
  if (!candidates.length) return null;
  candidates.sort((a,b)=> new Date(a.updatedAt)-new Date(b.updatedAt));
  return candidates[0];
}

// --- LLM generation (cheap) ---
// Uses `opencode` CLI if available, otherwise falls back to a local template without LLM.
async function llmGenerateOne() {
  // Try opencode ask helper if lib/claude exists; otherwise template fallback injected here.
  // Keep this file free of heavy deps — daily.mjs will import ./claude.mjs when present.
  try {
    const { ask, extractJson } = await import("./claude.mjs");
    const prompt = `Generate ONE tiny web project idea as JSON. Constraints:
- title: catchy, 2-6 words
- category: one of [tool, game, generative, viz, social, utility, art]
- features: 3-5 short feature phrases (user-visible)
- tags: 3-5 lowercase keywords
- one-line description (max 18 words)
Return ONLY JSON: {"title":"...","category":"...","description":"...","features":["..."],"tags":["..."]}`;
    const raw = await ask(prompt, { model: config.models.idea });
    let obj = extractJson(raw);
    if (!obj) throw new Error("no json");
    if (Array.isArray(obj)) obj = obj[0];
    return obj;
  } catch (e) {
    // graceful fallback — template pool
    const pool = [
      { title: "Void Typist", category: "generative", description: "Type to erase a collapsing text void.", features: ["kinetic typography","particle erasure","WPM meter"], tags:["typing","canvas","generative"] },
      { title: "Habit Constellation", category: "viz", description: "Your habits as a star map.", features: ["habit input","constellation viz","streak glow"], tags:["habit","viz","canvas"] },
      { title: "Shelf Shelf", category: "tool", description: "Arrange your bookshelf, judge your taste.", features: ["drag-drop shelf","taste score","share card"], tags:["books","tool","drag-drop"] },
    ];
    return pool[Math.floor(Math.random()*pool.length)];
  }
}

export async function generateIdea() {
  const q = readQueue();
  // 1) maybe seed
  const seeds = readSeeds();
  const useSeed = seeds.length && Math.random() < 0.35;
  let cand;
  if (useSeed) {
    const s = seeds[Math.floor(Math.random()*seeds.length)];
    cand = {
      title: s.title,
      category: s.category || "tool",
      description: s.title,
      features: ["core interaction","polished UI","share/export"],
      tags: s.tags || [],
      stack: s.stack || vibeStackForIdea(s.title, s.category),
      aesthetic: pickAesthetic(),
    };
  } else {
    const gen = await llmGenerateOne();
    cand = {
      title: gen.title,
      category: gen.category || "tool",
      description: gen.description || gen.title,
      features: (gen.features||[]).slice(0,6),
      tags: gen.tags||[],
      stack: vibeStackForIdea(gen.title, gen.category),
      aesthetic: pickAesthetic(),
    };
  }

  cand.slug = slugify(cand.title);
  // ensure unique slug
  const existingSlugs = new Set(q.projects.map(p=>p.slug));
  if (existingSlugs.has(cand.slug)) cand.slug = `${cand.slug}-${Date.now().toString(36).slice(-4)}`;

  const score = dedupScore(cand, q.projects);
  if (score > 0.62) {
    // too similar — try once more with LLM
    const gen2 = await llmGenerateOne();
    const cand2 = {
      title: gen2.title, category: gen2.category||"tool", description: gen2.description||gen2.title,
      features: (gen2.features||[]).slice(0,6), tags: gen2.tags||[],
      stack: vibeStackForIdea(gen2.title, gen2.category), aesthetic: pickAesthetic(),
      slug: slugify(gen2.title),
    };
    if (existingSlugs.has(cand2.slug)) cand2.slug = `${cand2.slug}-${Date.now().toString(36).slice(-4)}`;
    if (dedupScore(cand2, q.projects) < score) cand = cand2;
    // if still high, we still emit but caller can decide to skip
  }
  cand.dedupScore = dedupScore(cand, q.projects);
  return cand;
}

// CLI: node lib/ideas.mjs --once
if (process.argv.includes("--once")) {
  const idea = await generateIdea();
  console.log(JSON.stringify(idea, null, 2));
  const cont = decideContinue();
  if (cont) console.log("\n# would-continue:", cont.slug);
}
