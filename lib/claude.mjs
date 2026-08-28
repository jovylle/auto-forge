// lib/claude.mjs — one-shot opencode helper (idea generation)
import { spawn } from "node:child_process";
import { config } from "../config.mjs";

export function ask(prompt, { model } = {}) {
  const m = model || config.models.idea;
  return new Promise((resolve, reject) => {
    const args = ["run", prompt, "--model", m, "--agent", "plan"];
    const p = spawn("opencode", args, { stdio: ["ignore","pipe","pipe"] });
    let out="", err="";
    p.stdout.on("data", d=> out+=d);
    p.stderr.on("data", d=> err+=d);
    p.on("close", code => {
      if (code===0) resolve(out.trim());
      else reject(new Error(`opencode ask failed (${code}): ${err.slice(0,800)}`));
    });
    p.on("error", reject);
  });
}

export function extractJson(text) {
  // try direct parse, then ```json fence, then first {...} block
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch {} }
  return null;
}
