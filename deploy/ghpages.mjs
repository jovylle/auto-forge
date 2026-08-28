// deploy/ghpages.mjs — push site/ to gh-pages branch (if git remote exists)
import fs from "node:fs";
import path from "node:path";
import { SITE_DIR, ROOT } from "../config.mjs";
import { run } from "../lib/run.mjs";

export async function deploy() {
  if (!fs.existsSync(path.join(SITE_DIR,"index.html"))) {
    console.log("  gh-pages: site/ empty — building gallery");
    await import("../scripts/build-gallery.mjs");
  }
  const hasGit = fs.existsSync(path.join(ROOT,".git"));
  if (!hasGit) { console.log("  gh-pages: no .git — skip"); return; }
  const remote = (await run("git",["remote"],{cwd:ROOT})).out.trim();
  if (!remote) { console.log("  gh-pages: no git remote — skip (enable after you push to GitHub)"); return; }

  // use git worktree / temp branch technique (simple: gh-pages branch)
  const tmp = path.join(ROOT, ".gh-pages-tmp");
  if (fs.existsSync(tmp)) fs.rmSync(tmp,{recursive:true});
  fs.mkdirSync(tmp,{recursive:true});

  // ensure gh-pages branch exists
  await run("git",["worktree","add", tmp, "gh-pages"], { cwd: ROOT }).catch(async()=>{
    // create orphan branch
    await run("git",["checkout","--orphan","gh-pages"],{cwd:ROOT});
    await run("git",["reset","--hard"],{cwd:ROOT});
    await run("git",["commit","--allow-empty","-m","init gh-pages"],{cwd:ROOT});
    await run("git",["push","-u","origin","gh-pages"],{cwd:ROOT}).catch(()=>{});
    await run("git",["checkout","-"],{cwd:ROOT});
    await run("git",["worktree","add", tmp, "gh-pages"],{cwd:ROOT});
  });

  // sync site/ into worktree
  for (const f of fs.readdirSync(tmp)) if (f!==".git") fs.rmSync(path.join(tmp,f),{recursive:true,force:true});
  fs.cpSync(SITE_DIR, tmp, { recursive:true, force:true });
  // gh-pages needs .nojekyll
  fs.writeFileSync(path.join(tmp,".nojekyll"), "");

  const st = await run("git",["status","--porcelain"],{cwd:tmp});
  if (!st.out.trim()) { console.log("  gh-pages: no changes"); await run("git",["worktree","remove",tmp,{cwd:ROOT}]); try{fs.rmSync(tmp,{recursive:true})}catch{}; return; }
  await run("git",["add","."],{cwd:tmp});
  await run("git",["commit","-m",`deploy: ${new Date().toISOString().slice(0,10)}`],{cwd:tmp});
  const pr = await run("git",["push","origin","gh-pages"],{cwd:tmp});
  console.log(pr.code===0 ? "  gh-pages: deployed ✓" : `  gh-pages push failed: ${pr.err.slice(-800)}`);
  await run("git",["worktree","remove",tmp],{cwd:ROOT});
  try{ fs.rmSync(tmp,{recursive:true}); }catch{}
}
if (import.meta.url === `file://${process.argv[1]}`) deploy();
