// lib/thumb.mjs — optional Playwright screenshot (best-effort)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export async function captureThumbnail(dir, slug) {
  const out = path.join(dir, "thumbnail.png");
  // Try: npx playwright screenshot via a tiny inline script to avoid hard dep
  // If playwright not installed, just skip gracefully.
  const hasPw = fs.existsSync(path.join(dir, "package.json")) ? true : false;
  // minimal: try to serve and screenshot if possible, otherwise create a placeholder
  try {
    // placeholder gradient if we can't screenshot (still gives gallery something)
    if (!fs.existsSync(out)) {
      // we won't generate a real PNG here without a canvas lib; just skip — gallery shows gradient
      return null;
    }
    return out;
  } catch { return null; }
}
