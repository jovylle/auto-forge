// auto-forge/config.mjs — one place to tune the bot.
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = __dirname;
export const PROJECTS_DIR = path.join(ROOT, "projects");
export const QUEUE_FILE = path.join(ROOT, "projects.json");
export const LOOP_FILE = path.join(ROOT, "loop.json");
export const LOGS_DIR = path.join(ROOT, "logs");
export const SITE_DIR = path.join(ROOT, "site");
export const HEALTH_FILE = path.join(ROOT, "model-health.json");

// Oct-28: ~/.opencode/bin/opencode is a stale v1.19 install whose key store 401s;
// the current CLI lives at ~/.local/bin/opencode (v2.x). Cron PATH omits it, so use the absolute path.
export const OPENCODE_BIN = process.env.OPENCODE_BIN || `${process.env.HOME}/.local/bin/opencode`;

export const AESTHETICS = [
  "cyberpunk","neo-brutalism","glassmorphism","retro-wave",
  "japanese-minimal","bauhaus","dark-fantasy","pixel-art",
  "organic-brutalist","sci-fi-terminal","memphis","vaporwave",
  "japanese-cyberpunk","cottagecore","pop-art","swiss","grunge","steampunk","biomorphic","extreme-minimal",
];

export const CONSTRAINTS = [
  "3 colors max (plus black/white)",
  "no external fonts — system fonts only",
  "must react to scroll",
  "sound on interaction (WebAudio, no assets)",
  "single HTML file if html stack, single component if vite",
  "must work with keyboard only",
  "no images — CSS/canvas only",
  "must have an easter egg",
  "uses only one interaction type (click OR drag OR type)",
  "must be playable in 30 seconds",
];

export const WEEKLY_THEMES = [
  { week: 0, theme: "typography", hint: "kinetic type, fonts as art" },
  { week: 1, theme: "audio", hint: "WebAudio, rhythm, sound toys" },
  { week: 2, theme: "physics", hint: "gravity, springs, particles" },
  { week: 3, theme: "maps", hint: "grids, territories, navigation" },
  { week: 4, theme: "time", hint: "clocks, loops, history" },
  { week: 5, theme: "color", hint: "palettes, gradients, perception" },
];

export const config = {
  deploy: {
    targets: ["cloudflare", "gh-pages"],
    cloudflareProject: "auto-forge",
  },
  models: {
    // Nov-06: free-first. The Nov-04 benchmark put eight -free IDs at parity on
    // bounded work, and quota is per-model — so a chain buys runway that one ID
    // cannot. Paid is the last resort only, at #high effort (never #xhigh).
    // All of these were pinged live 2026-11-06 before being wired in.
    idea: process.env.OPENCODE_SMALL_MODEL || "opencode/beam-free",
    ideaFallback: "opencode-go/deepseek-v4.1-flash#high",
    buildChain: [
      "opencode/beam-free",                   // 2/2, does not train on requests
      "opencode/crouton-alpha-free",          // fastest of the eight
      "opencode/pulse-alpha-free",            // 2/2
      "opencode-go/deepseek-v4.1-flash#high", // paid last resort, high effort
    ],
    smart: "opencode-go/glm-5.2",
    // circuit breaker
    breakerFails: 2,           // consecutive fails to demote for 3 days
    breakerCooldownMs: 3*24*3600*1000,
    preflightTimeoutMs: 30000, // raised: preflight kept timing out on slow opencode startup even when models then built fine
  },
  stackHeuristic: {
    htmlKeywords: ["canvas","particle","generative","game","arcade","visual","shader","pixel","animation","one-page","poster","physics","toy"],
    viteKeywords: ["tool","app","dashboard","tracker","crud","editor","planner","manager","inventory","calendar","board"],
  },
  limits: {
    maxFeatures: 6,
    maxRetries: 3,             // failed attempts before a project parks itself as needs-human
    buildTimeoutMs: 45 * 60 * 1000, // single-component builds; free-tier workers are slower than paid muse
  }
};
