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
    idea: process.env.OPENCODE_SMALL_MODEL || "opencode/deepseek-v4-flash-free",
    ideaFallback: "opencode-go/deepseek-v4-flash",
    build: "opencode/deepseek-v4-flash-free",
    buildFallback: "opencode-go/deepseek-v4-flash",
    smart: "opencode-go/glm-5.2",
    // circuit breaker
    breakerFails: 2,           // consecutive fails to demote for 3 days
    breakerCooldownMs: 3*24*3600*1000,
    preflightTimeoutMs: 15000,
  },
  stackHeuristic: {
    htmlKeywords: ["canvas","particle","generative","game","arcade","visual","shader","pixel","animation","one-page","poster","physics","toy"],
    viteKeywords: ["tool","app","dashboard","tracker","crud","editor","planner","manager","inventory","calendar","board"],
  },
  limits: {
    maxFeatures: 6,
    buildTimeoutMs: 18 * 60 * 1000,
  }
};
