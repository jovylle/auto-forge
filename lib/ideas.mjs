// lib/ideas.mjs — picks next idea: continue? seed? LLM generate? + dedup + novelty guard.
import fs from "node:fs";
import path from "node:path";
import { AESTHETICS, CONSTRAINTS, WEEKLY_THEMES, config, ROOT } from "../config.mjs";
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

function weeklyTheme() {
  const week = Math.floor(Date.now() / (7*24*3600*1000)) % WEEKLY_THEMES.length;
  return WEEKLY_THEMES[week];
}

function pickAesthetic(recentAesthetics=[]) {
  // penalize aesthetics used in last 7
  const penalty = new Set(recentAesthetics.slice(-7));
  const candidates = AESTHETICS.filter(a => !penalty.has(a));
  const pool = candidates.length >= 6 ? candidates : AESTHETICS;
  return pool[Math.floor(Math.random()*pool.length)];
}

function pickConstraints() {
  // 1-2 random constraints
  const n = Math.random() < 0.5 ? 1 : 2;
  const shuffled = [...CONSTRAINTS].sort(()=>Math.random()-0.5);
  return shuffled.slice(0, n);
}

export function decideStack(title, category) {
  const t = (title+" "+category).toLowerCase();
  const htmlHit = config.stackHeuristic.htmlKeywords.some(k => t.includes(k));
  const viteHit = config.stackHeuristic.viteKeywords.some(k => t.includes(k));
  if (htmlHit && !viteHit) return { stack: "html", reason: `keyword html (${config.stackHeuristic.htmlKeywords.find(k=>t.includes(k))})` };
  if (viteHit && !htmlHit) return { stack: "vite", reason: `keyword vite (${config.stackHeuristic.viteKeywords.find(k=>t.includes(k))})` };
  if (htmlHit && viteHit) return { stack: Math.random()<0.5?"html":"vite", reason: "both keywords — coin flip" };
  const stack = Math.random() < 0.45 ? "html" : "vite";
  return { stack, reason: "no strong keyword — random" };
}

export function decideContinue() {
  const q = readQueue();
  const staleMs = 24*3600*1000;
  const now = Date.now();
  const candidates = q.projects.filter(p => {
    if (p.status === "continuing" || p.status === "needs-iteration") return true;
    if (p.status === "queued") return true; // scaffold never completed — pick up, don't strand
    if (p.status === "building" && p.updatedAt && (now - new Date(p.updatedAt).getTime() > staleMs)) return true;
    if (p.status === "needs-human" && (p.retries||0) < 1) return true;
    return false;
  });
  if (!candidates.length) return null;
  candidates.sort((a,b)=> new Date(a.updatedAt)-new Date(b.updatedAt));
  return candidates[0];
}

async function llmGenerateOne(theme) {
  try {
    const { ask, extractJson } = await import("./claude.mjs");
    const themeLine = theme ? `Weekly theme is "${theme.theme}" (${theme.hint}) — preferably sample inside it, but not mandatory.` : "";
    const prompt = `Generate ONE tiny web project idea as JSON. ${themeLine}
Constraints:
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
    // LLM offline — fall back to a DIVERSE pool (never repeat recent titles).
    // Keep this pool large: when the LLM is down for days, a 3-item pool
    // guarantees exact duplicates (dedup 1.00) on consecutive ticks.
    const pool = [
      { title: "Void Typist", category: "generative", description: "Type to erase a collapsing text void.", features: ["kinetic typography","particle erasure","WPM meter"], tags:["typing","canvas","generative"] },
      { title: "Habit Constellation", category: "viz", description: "Your habits as a star map.", features: ["habit input","constellation viz","streak glow"], tags:["habit","viz","canvas"] },
      { title: "Shelf Shelf", category: "tool", description: "Arrange your bookshelf, judge your taste.", features: ["drag-drop shelf","taste score","share card"], tags:["books","tool","drag-drop"] },
      { title: "Foghorn Funeral", category: "generative", description: "Mourn ships with layered foghorn drones.", features: ["drone mixer","fog canvas","eulogy typer"], tags:["audio","canvas","webaudio"] },
      { title: "Puddle Atlas", category: "viz", description: "Map every puddle on your street.", features: ["puddle log","rain viz","evaporation timer"], tags:["maps","weather","canvas"] },
      { title: "Excuse Roulette", category: "game", description: "Spin for a plausibly deniable excuse.", features: ["spin wheel","believability meter","copy excuse"], tags:["game","fun","generator"] },
      { title: "Drawer Oracle", category: "tool", description: "Photograph-free junk-drawer inventory.", features: ["drawer log","find my thing","declutter score"], tags:["inventory","tool","localStorage"] },
      { title: "Moss Clock", category: "art", description: "A clock that grows moss when you're calm.", features: ["breath timer","moss growth","stillness score"], tags:["time","art","canvas"] },
      { title: "Staircase Ballads", category: "generative", description: "Each step you climb writes a lyric.", features: ["step counter","lyric engine","ballad archive"], tags:["music","pedometer","generator"] },
      { title: "Crumb Budget", category: "tool", description: "Track spending in snack units.", features: ["expense log","snack converter","weekly chart"], tags:["finance","fun","tool"] },
      { title: "Ghost Antenna", category: "social", description: "Leave messages for strangers' radios.", features: ["message tuner","static viz","signal board"], tags:["radio","social","audio"] },
      { title: "Ice Melt", category: "viz", description: "Watch a glacier melt in real time.", features: ["melt sim","year scrubber","sea-level meter"], tags:["climate","viz","physics"] },
    ];
    // exclude anything already built so fallback picks can't duplicate
    let fresh = pool;
    try {
      const used = new Set(readQueue().projects.map(p => (p.title||"").toLowerCase()));
      const unused = pool.filter(i => !used.has(i.title.toLowerCase()));
      if (unused.length) fresh = unused;
    } catch {}
    return fresh[Math.floor(Math.random()*fresh.length)];
  }
}

function noveltyPenalty(candidate, existing) {
  // Forbid repeating {category, aesthetic, primary tag} combo seen in last 7
  const recent = existing.slice(-7);
  const candKey = `${candidate.category}:${candidate.aesthetic}:${candidate.tags?.[0]||""}`;
  for (const p of recent) {
    const key = `${p.category}:${p.aesthetic}:${p.tags?.[0]||""}`;
    if (key === candKey) return 0.15; // penalty
  }
  return 0;
}

export async function generateIdea() {
  const q = readQueue();
  const recentAesthetics = q.projects.map(p=>p.aesthetic).filter(Boolean);
  const theme = weeklyTheme();
  const constraints = pickConstraints();

  const seeds = readSeeds();
  const useSeed = seeds.length && Math.random() < 0.35;
  let cand;
  if (useSeed) {
    const s = seeds[Math.floor(Math.random()*seeds.length)];
    const dec = decideStack(s.title, s.category);
    cand = {
      title: s.title,
      category: s.category || "tool",
      description: s.title,
      features: ["core interaction","polished UI","share/export"],
      tags: s.tags || [],
      stack: s.stack || dec.stack,
      stackReason: s.stack ? "seed stack" : dec.reason,
      aesthetic: pickAesthetic(recentAesthetics),
      constraints,
      theme: theme.theme,
    };
  } else {
    const gen = await llmGenerateOne(theme);
    const dec = decideStack(gen.title, gen.category);
    cand = {
      title: gen.title,
      category: gen.category || "tool",
      description: gen.description || gen.title,
      features: (gen.features||[]).slice(0,6),
      tags: gen.tags||[],
      stack: dec.stack,
      stackReason: dec.reason,
      aesthetic: pickAesthetic(recentAesthetics),
      constraints,
      theme: theme.theme,
    };
  }

  cand.slug = slugify(cand.title);
  const existingSlugs = new Set(q.projects.map(p=>p.slug));
  if (existingSlugs.has(cand.slug)) cand.slug = `${cand.slug}-${Date.now().toString(36).slice(-4)}`;

  let score = dedupScore(cand, q.projects) + noveltyPenalty(cand, q.projects);
  if (score > 0.62) {
    const gen2 = await llmGenerateOne(theme);
    const dec2 = decideStack(gen2.title, gen2.category);
    const cand2 = {
      title: gen2.title, category: gen2.category||"tool", description: gen2.description||gen2.title,
      features: (gen2.features||[]).slice(0,6), tags: gen2.tags||[],
      stack: dec2.stack, stackReason: dec2.reason,
      aesthetic: pickAesthetic(recentAesthetics),
      constraints: pickConstraints(),
      theme: theme.theme,
      slug: slugify(gen2.title),
    };
    if (existingSlugs.has(cand2.slug)) cand2.slug = `${cand2.slug}-${Date.now().toString(36).slice(-4)}`;
    const score2 = dedupScore(cand2, q.projects) + noveltyPenalty(cand2, q.projects);
    if (score2 < score) { cand = cand2; score = score2; }
  }
  // Hard guard: if STILL a near-duplicate (LLM down → same fallback idea twice),
  // force-pick an unused seed instead of shipping a clone.
  if (score > 0.75) {
    const usedTitles = new Set(q.projects.map(p => (p.title||"").toLowerCase()));
    const freshSeeds = seeds.filter(s => !usedTitles.has((s.title||"").toLowerCase()));
    if (freshSeeds.length) {
      const s = freshSeeds[Math.floor(Math.random()*freshSeeds.length)];
      const dec = decideStack(s.title, s.category);
      cand = {
        title: s.title, category: s.category || "tool", description: s.title,
        features: ["core interaction","polished UI","share/export"], tags: s.tags || [],
        stack: s.stack || dec.stack, stackReason: s.stack ? "seed stack (dedup guard)" : dec.reason,
        aesthetic: pickAesthetic(recentAesthetics),
        constraints: pickConstraints(), theme: theme.theme,
        slug: slugify(s.title),
      };
      if (existingSlugs.has(cand.slug)) cand.slug = `${cand.slug}-${Date.now().toString(36).slice(-4)}`;
      score = dedupScore(cand, q.projects) + noveltyPenalty(cand, q.projects);
    }
  }
  cand.dedupScore = dedupScore(cand, q.projects);
  cand.noveltyPenalty = noveltyPenalty(cand, q.projects);
  return cand;
}

// CLI: node lib/ideas.mjs --once
if (process.argv.includes("--once")) {
  const idea = await generateIdea();
  console.log(JSON.stringify(idea, null, 2));
  const cont = decideContinue();
  if (cont) console.log("\n# would-continue:", cont.slug);
}
