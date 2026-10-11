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

async function llmGenerateOne(theme, banned=[]) {
  try {
    const { ask, extractJson } = await import("./claude.mjs");
    const themeLine = theme ? `Weekly theme is "${theme.theme}" (${theme.hint}) — preferably sample inside it, but not mandatory.` : "";
    const bannedLine = banned.length ? `Already built — do NOT reuse these titles or suffixed variants of them ("X — ..."): ${banned.join(" | ")}.` : "";
    const prompt = `Generate ONE tiny web project idea as JSON. ${themeLine} ${bannedLine}
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
      { title: "Rowan Tern Roundhouse", category: "game", description: "Stable seabirds in a spinning roundhouse.", features: ["tern stalls","spin schedule","harbor score"], tags:["terns","roundhouse","game"] },
      { title: "Sorrel Wasp Spire", category: "generative", description: "Wasps build a humming paper spire.", features: ["spire cells","hum synth","swarm export"], tags:["wasps","spire","audio"] },
      { title: "Tansy Newt Nook", category: "tool", description: "A pocket field guide to pond newts.", features: ["newt log","pond finder","field export"], tags:["newts","guide","tool"] },
      { title: "Ulva Gull Union", category: "social", description: "Unionize the gulls of the sea-lettuce beds.", features: ["gull roster","tide demands","union votes"], tags:["gulls","union","social"] },
      { title: "Woad Ibis Works", category: "viz", description: "Dye the river blue with ibis flight paths.", features: ["flight dye","river canvas","pigment export"], tags:["ibis","dye","canvas"] },
      { title: "Plover Ash Press", category: "generative", description: "Shorebirds print poems in volcanic ash.", features: ["ash press","plover poems","print export"], tags:["plovers","poetry","generator"] },
      { title: "Cinder Sparrow Parlor", category: "social", description: "Sparrows trade gossip over warm cinders.", features: ["gossip trade","ember seats","flock board"], tags:["sparrows","parlor","social"] },
      { title: "Harbor Vole Verse", category: "generative", description: "Dock voles squeak out shipping forecasts.", features: ["tide verses","vole choir","forecast export"], tags:["voles","harbor","audio"] },
      { title: "Yew Sparrow Seminary", category: "game", description: "Train sparrows in an ancient yew seminary.", features: ["perch classes","sermon trials","seminary score"], tags:["sparrows","seminary","game"] },
      { title: "Dulse Otter Outpost", category: "game", description: "Otters run a seaweed trading outpost.", features: ["kelp trade","otter crew","outpost score"], tags:["otters","trade","game"] },
      { title: "Gale Petrel Post", category: "tool", description: "Storm petrels deliver mail on the gale.", features: ["gale routes","petrel log","post tracker"], tags:["petrels","post","tool"] },
      { title: "Marrow Lark Depot", category: "tool", description: "Larks stock a marrow-bone supply depot.", features: ["stock ledger","lark shifts","depot map"], tags:["larks","depot","tool"] },
      { title: "Vervain Rat Relay", category: "game", description: "Relay herbs through rat-run tunnels.", features: ["tunnel legs","herb batons","relay score"], tags:["rats","relay","game"] },
      { title: "Brine Kettle Cantata", category: "generative", description: "A boiling kettle sings in salt water.", features: ["boil voices","salt chorus","cantata export"], tags:["kettle","brine","audio"] },
      { title: "Dune Wren Observatory", category: "viz", description: "Wrens chart the stars from dune scopes.", features: ["star chart","dune scopes","night export"], tags:["wrens","stars","canvas"] },
      { title: "Flint Moth Switchboard", category: "tool", description: "Patch night calls through moth operators.", features: ["moth plugs","night lines","call log"], tags:["moths","switchboard","tool"] },
      { title: "Inkcap Night Market", category: "game", description: "Trade glowing mushrooms after midnight.", features: ["fungus stalls","midnight deals","market score"], tags:["mushrooms","market","game"] },
      { title: "Kelp Lantern Marina", category: "viz", description: "Light the marina with kelp lanterns.", features: ["lantern map","tide lights","marina export"], tags:["kelp","lanterns","canvas"] },
      { title: "Tallow Moth Terminal", category: "social", description: "Moths gather at the candlewax terminal.", features: ["wax board","moth arrivals","terminal chat"], tags:["moths","terminal","social"] },
      { title: "Urchin Brass Library", category: "tool", description: "Sea urchins shelve a brass library.", features: ["spine catalog","urchin clerks","shelf search"], tags:["urchins","library","tool"] },
    ];
    // exclude anything already built (fuzzy: base titles must also lose to
    // shipped suffixed variants, e.g. pool "Comet Queue" vs shipped
    // "Comet Queue — orbit your tasks") so fallback picks can't duplicate
    let fresh = pool;
    try {
      const built = readQueue().projects.map(p => ({ title: p.title, tags: [], features: [] }));
      const unused = pool.filter(i => dedupScore({ title: i.title, tags: [], features: [] }, built) < 0.5);
      if (unused.length) fresh = unused;
      else {
        // pool exhausted (everything built) — don't random-pick a guaranteed
        // duplicate; take the 3 least-similar and draw among them instead
        const scored = pool.map(i => {
          let s = 1;
          try { s = dedupScore({ title: i.title, tags: [], features: [] }, built); } catch {}
          return { i, s };
        }).sort((a, b) => a.s - b.s).slice(0, 3);
        if (scored.length) fresh = scored.map(o => o.i);
      }
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
    const banned = q.projects.slice(-14).map(p => p.title).filter(Boolean);
    const gen = await llmGenerateOne(theme, banned);
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
  // title-only similarity: same-name ideas ("Kinetic Type Playground" twice in 2 days)
  // can score low overall when tags/features differ — veto them explicitly
  let titleScore = 0;
  // compare title tokens against title tokens only — the other side's tags/features
  // dilute the jaccard below the veto line (KTP-vs-KTP scored 0.43 with tags in)
  let titleOnly = [];
  try {
    titleOnly = q.projects.map(p => ({ title: p.title, tags: [], features: [] }));
    titleScore = dedupScore({ title: cand.title, tags: [], features: [] }, titleOnly);
  } catch {}
  if (score > 0.62 || titleScore >= 0.5) {
    const gen2 = await llmGenerateOne(theme, q.projects.slice(-14).map(p => p.title).filter(Boolean));
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
    let titleScore2 = 0;
    try { titleScore2 = dedupScore({ title: cand2.title, tags: [], features: [] }, titleOnly); } catch {}
    if (score2 + titleScore2 < score + titleScore) { cand = cand2; score = score2; titleScore = titleScore2; }
  }
  // Hard guard: if STILL a near-duplicate (LLM down → same fallback idea twice),
  // force-pick an unused seed instead of shipping a clone.
  if (score > 0.75 || titleScore >= 0.5) {
    // fuzzy, not exact-title: "Lantern Ledger — night journal" passed the old
    // exact-match check against shipped "Lantern Ledger" and duplicated it
    const freshSeeds = seeds.filter(s => dedupScore({ title: s.title, tags: [], features: [] }, titleOnly) < 0.5);
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
    else {
      // seed pool exhausted too (every seed built) — regen up to 3x and keep
      // the best; without this the tick ships a known duplicate with only a
      // log warning (copper-kite-v2g4 dedup 1.00 pattern)
      for (let t = 0; t < 3; t++) {
        let g;
        try { g = await llmGenerateOne(theme, q.projects.slice(-14).map(p => p.title).filter(Boolean)); }
        catch { break; }
        if (!g || !g.title) continue;
        const d = decideStack(g.title, g.category);
        const s2 = dedupScore({ title: g.title, tags: g.tags || [], features: g.features || [] }, q.projects)
          + noveltyPenalty({ title: g.title, tags: g.tags || [], aesthetic: "" }, q.projects);
        let ts2 = 1;
        try { ts2 = dedupScore({ title: g.title, tags: [], features: [] }, titleOnly); } catch {}
        if (s2 + ts2 < score + titleScore) {
          cand = {
            title: g.title, category: g.category || "tool", description: g.description || g.title,
            features: (g.features || []).slice(0, 6), tags: g.tags || [],
            stack: d.stack, stackReason: d.reason,
            aesthetic: pickAesthetic(recentAesthetics),
            constraints: pickConstraints(), theme: theme.theme,
            slug: slugify(g.title),
          };
          if (existingSlugs.has(cand.slug)) cand.slug = `${cand.slug}-${Date.now().toString(36).slice(-4)}`;
          score = s2; titleScore = ts2;
          if (!(score > 0.75 || titleScore >= 0.5)) break;
        }
      }
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
