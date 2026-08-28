// lib/verify.mjs — smoke checks (vite: npm build + preview; html: file exists)
import fs from "node:fs";
import path from "node:path";
import { run } from "./run.mjs";

export async function verifyVite(dir) {
  const r = await run("npm", ["run", "build"], { cwd: dir });
  if (r.code !== 0) return { ok: false, reason: "build failed", log: (r.out+r.err).slice(-3000) };
  const dist = path.join(dir, "dist", "index.html");
  if (!fs.existsSync(dist)) return { ok: false, reason: "dist/index.html missing" };
  return { ok: true };
}
export async function verifyHtml(dir) {
  const idx = path.join(dir, "index.html");
  if (!fs.existsSync(idx)) return { ok: false, reason: "index.html missing" };
  const html = fs.readFileSync(idx,"utf8");
  if (html.length < 80) return { ok: false, reason: "index.html too small" };
  return { ok: true };
}
export async function verify(dir, stack) {
  if (stack === "html") return verifyHtml(dir);
  return verifyVite(dir);
}
