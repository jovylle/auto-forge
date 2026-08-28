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

export const AESTHETICS = [
  "cyberpunk","neo-brutalism","glassmorphism","retro-wave",
  "japanese-minimal","bauhaus","dark-fantasy","pixel-art",
  "organic-brutalist","sci-fi-terminal","memphis","vaporwave",
  "japanese-cyberpunk","cottagecore","pop-art","swiss","grunge","steampunk","biomorphic","extreme-minimal",
];

export const config = {
  // deploy targets — bot honors both; per-project pick if you set targets: ["cloudflare"] etc.
  deploy: {
    targets: ["cloudflare", "gh-pages"], // daily bot tries each enabled target
    cloudflareProject: "auto-forge",
    // GH Pages: pushes site/ to gh-pages branch if remote exists
  },

  // model fallback chain (mirrors factory)
  models: {
    idea: process.env.OPENCODE_SMALL_MODEL || "opencode/deepseek-v4-flash-free",
    ideaFallback: "opencode-go/deepseek-v4-flash",
    build: "opencode/deepseek-v4-flash-free",
    buildFallback: "opencode-go/deepseek-v4-flash",
    smart: "opencode-go/glm-5.2",
  },

  // how the bot decides stack per idea
  stackHeuristic: {
    // short playful / canvas / game → html is faster; data-heavy / interactive → vite
    htmlKeywords: ["canvas","particle","generative","game","arcade","visual","shader","pixel","animation","one-page","poster"],
  },

  limits: {
    maxFeatures: 6,
    buildTimeoutMs: 18 * 60 * 1000, // 18 min per project (opencode worker)
  }
};
