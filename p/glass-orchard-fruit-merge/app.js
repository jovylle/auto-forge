const W = 360;
const H = 640;
const RIM = 150;
const FLOOR = 588;
const IL = 24;
const IR = 336;
const CR = 22;
const G = 900;
const MAX_FRUITS = 110;

const RAMP = [
  ["#EAE5D7", "#9A927C"],
  ["#E7D088", "#9E8435"],
  ["#CBD5A0", "#7C8C46"],
  ["#B0C9A4", "#5E7B57"],
  ["#9AC7BF", "#488078"],
  ["#95B7DC", "#4A6F9C"],
  ["#B5A0D4", "#6A5595"],
  ["#D3A4C7", "#8F5C82"],
  ["#E4A18E", "#9A5747"],
  ["#E7BA6E", "#9E7A2C"],
  ["#D98880", "#94423A"],
];
const NAMES = ["glass", "citron", "lime", "sage", "sea", "periwinkle", "violet", "orchid", "coral", "amber", "heirloom"];
const BG = "#F3F0E9";
const INK = "rgba(33,30,25,1)";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.scale(dpr, dpr);

const $ = (id) => document.getElementById(id);
const scoreEl = $("score");
const bestEl = $("best");
const nextDot = $("nextDot");
const hintEl = $("hint");
const toastEl = $("toast");
const overlay = $("overlay");
const finalScore = $("finalScore");
const finalBest = $("finalBest");

let fruits = [];
let rings = [];
let floats = [];
let cracks = [];
let score = 0;
let best = parseInt(localStorage.getItem("glassOrchard.best") || "0", 10);
let games = parseInt(localStorage.getItem("glassOrchard.games") || "0", 10);
let nextLvl = pickNext();
let aimX = W / 2;
let state = "running";
let overTime = 0;
let lastMerge = 0;
let combo = 1;
let t = 0;
let hovered = false;
let last = performance.now();

bestEl.textContent = "best " + best;
paintNextDot();

function pickNext() {
  const r = Math.random() * 100;
  if (r < 55) return 1;
  if (r < 85) return 2;
  return 3;
}

function paintNextDot() {
  const c = RAMP[nextLvl - 1];
  nextDot.style.background = c[0];
  nextDot.style.borderColor = c[1];
}

function setScore(v) {
  score = v;
  scoreEl.textContent = String(score);
}

function canDrop() {
  return state === "running" && !fruits.some((f) => f.y < RIM + 46);
}

function drop() {
  if (!canDrop()) return;
  const r = radius(nextLvl);
  const x = clamp(aimX, IL + r + 1, IR - r - 1);
  fruits.push({ x, y: RIM - r, vx: 0, vy: 0, lvl: nextLvl, r, sq: 0.12, born: 0 });
  nextLvl = pickNext();
  paintNextDot();
  beep(150, 0.06, "sine", 0.05);
}

function radius(lvl) {
  return 11 + lvl * 4.2;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function ensureAudio() {
  if (!window.__ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      window.__ac = new AC();
    }
  }
  if (window.__ac && window.__ac.state === "suspended") {
    window.__ac.resume();
  }
}

function beep(freq, dur, type = "sine", vol = 0.05) {
  const ac = window.__ac;
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  const now = ac.currentTime;
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}

function impactSound(v) {
  beep(90 + v * 4, 0.05, "triangle", 0.03);
}

function mergeSound(lvl) {
  beep(280 + lvl * 38, 0.14, "sine", 0.06);
  beep(280 + lvl * 38 + 120, 0.1, "sine", 0.03);
}

function step(dt, alive) {
  t += dt;

  for (const f of fruits) {
    f.vy = Math.min(f.vy + G * dt, 1000);
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= Math.pow(0.9975, dt * 60);
    f.sq *= Math.pow(0.86, dt * 60);
    if (f.sq < 0.001) f.sq = 0;
    f.born += dt;
    collideVessel(f);
  }

  resolvePairs();

  if (alive) {
    mergePass();
    checkOverflow(dt);
  } else {
    mergePass();
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += (r.max - r.r) * Math.min(1, 8 * dt);
    r.life -= dt * 1.6;
    if (r.life <= 0) rings.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.y -= 26 * dt;
    f.life -= dt * 1.05;
    if (f.life <= 0) floats.splice(i, 1);
  }
}

function collideVessel(f) {
  const cornerR = CR - 1;
  const flatL = IL + cornerR;
  const flatR = IR - cornerR;
  let hit = false;

  if (f.x - f.r < IL) {
    f.x = IL + f.r;
    if (f.vx < 0) {
      hit = Math.abs(f.vx) > 140;
      f.vx = -f.vx * 0.3;
    }
  } else if (f.x + f.r > IR) {
    f.x = IR - f.r;
    if (f.vx > 0) {
      hit = Math.abs(f.vx) > 140;
      f.vx = -f.vx * 0.3;
    }
  }

  if (f.y + f.r > FLOOR) {
    if (f.x >= flatL && f.x <= flatR) {
      f.y = FLOOR - f.r;
      if (f.vy > 60) {
        hit = f.vy > 220;
        f.vy = -f.vy * 0.22;
      }
      f.vx *= Math.pow(0.9, 60 * (1 / 60));
    }
  }

  const corners = [
    [flatL, FLOOR - cornerR],
    [flatR, FLOOR - cornerR],
  ];
  for (const [cx, cy] of corners) {
    const dx = f.x - cx;
    const dy = f.y - cy;
    const d = Math.hypot(dx, dy);
    const minD = f.r + cornerR;
    if (d < minD && d > 0.001) {
      const nx = dx / d;
      const ny = dy / d;
      f.x = cx + nx * minD;
      f.y = cy + ny * minD;
      const vn = f.vx * nx + f.vy * ny;
      if (vn < 0) {
        hit = Math.abs(vn) > 140;
        f.vx -= (1 + 0.3) * vn * nx;
        f.vy -= (1 + 0.3) * vn * ny;
      }
    }
  }

  if (hit) {
    f.sq = 0.22;
    impactSound(Math.abs(f.vy) + Math.abs(f.vx));
  }
}

function resolvePairs() {
  for (let i = 0; i < fruits.length; i++) {
    for (let j = i + 1; j < fruits.length; j++) {
      const a = fruits[i];
      const b = fruits[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.0001 && d2 < (a.r + b.r) * (a.r + b.r)) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const overlap = a.r + b.r - d;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const tot = ma + mb;
        a.x -= nx * overlap * (mb / tot);
        a.y -= ny * overlap * (mb / tot);
        b.x += nx * overlap * (ma / tot);
        b.y += ny * overlap * (ma / tot);
        const rvx = a.vx - b.vx;
        const rvy = a.vy - b.vy;
        const rel = rvx * nx + rvy * ny;
        if (rel < 0) {
          const e = 0.25;
          const jImp = (-(1 + e) * rel) / (1 / ma + 1 / mb);
          a.vx += (jImp / ma) * nx;
          a.vy += (jImp / ma) * ny;
          b.vx -= (jImp / mb) * nx;
          b.vy -= (jImp / mb) * ny;
        }
      }
    }
  }
}

function mergePass() {
  const pending = [];
  for (let i = 0; i < fruits.length; i++) {
    for (let j = i + 1; j < fruits.length; j++) {
      const a = fruits[i];
      const b = fruits[j];
      if (a.lvl !== b.lvl || a.lvl >= RAMP.length) continue;
      if (a.born < 0.12 || b.born < 0.12) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < (a.r + b.r) * 0.9) {
        pending.push([a, b]);
      }
    }
  }
  for (const [a, b] of pending) {
    if (fruits.indexOf(a) === -1 || fruits.indexOf(b) === -1) continue;
    const lvl = a.lvl + 1;
    const r = radius(lvl);
    const nf = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      vx: (a.vx + b.vx) / 2,
      vy: (a.vy + b.vy) / 2 - 40,
      lvl,
      r,
      sq: 0.3,
      born: 0,
    };
    fruits.splice(fruits.indexOf(a), 1);
    fruits.splice(fruits.indexOf(b), 1);
    fruits.push(nf);

    rings.push({ x: nf.x, y: nf.y, r: r * 0.5, max: r * 2.1, life: 1 });
    if (t - lastMerge < 0.7) combo++;
    else combo = 1;
    lastMerge = t;
    const gain = lvl * 10 * combo;
    setScore(score + gain);
    floats.push({
      x: nf.x,
      y: nf.y - r * 0.5,
      txt: "+" + gain + (combo > 1 ? "  ×" + combo : ""),
      life: 1,
    });
    mergeSound(lvl);
  }
}

function checkOverflow(dt) {
  const anyAbove = fruits.some((f) => f.y < RIM && Math.abs(f.vy) < 80);
  if (anyAbove) overTime += dt;
  else overTime = Math.max(0, overTime - dt * 2);
  if (overTime > 1.35 || fruits.length > MAX_FRUITS) endGame();
}

function topLvl() {
  let m = 0;
  for (const f of fruits) if (f.lvl > m) m = f.lvl;
  return m;
}

function endGame() {
  if (state !== "running") return;
  state = "over";
  games++;
  localStorage.setItem("glassOrchard.games", String(games));
  if (score > best) {
    best = score;
    localStorage.setItem("glassOrchard.best", String(best));
    bestEl.textContent = "best " + best;
  }
  makeCracks();
  beep(180, 0.2, "triangle", 0.05);
  beep(120, 0.3, "triangle", 0.05);
  finalScore.textContent = String(score);
  const tl = topLvl();
  finalBest.textContent = "grew the " + NAMES[tl - 1] + " · best " + best;
  overlay.hidden = false;
}

function makeCracks() {
  cracks = [];
  for (let k = 0; k < 3; k++) {
    let x = IL + Math.random() * (IR - IL);
    let y = RIM - 4;
    const segs = [];
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 46;
      y += 10 + Math.random() * 16;
      segs.push([x, y]);
    }
    cracks.push(segs);
  }
  cracks.push([[IL + 10, RIM], [IL + 2, RIM + 18], [IL + 16, RIM + 30]]);
  cracks.push([[IR - 8, RIM], [IR + 4, RIM + 22], [IR - 12, RIM + 38]]);
}

function reset() {
  fruits = [];
  rings = [];
  floats = [];
  cracks = [];
  setScore(0);
  overTime = 0;
  combo = 1;
  state = "running";
  nextLvl = pickNext();
  paintNextDot();
  overlay.hidden = true;
  aimX = W / 2;
}

function vesselPath(c) {
  c.beginPath();
  c.moveTo(IL, RIM);
  c.lineTo(IL, FLOOR - CR);
  c.arc(IL + CR, FLOOR - CR, CR, Math.PI, 1.5 * Math.PI, false);
  c.lineTo(IR - CR, FLOOR);
  c.arc(IR - CR, FLOOR - CR, CR, 1.5 * Math.PI, 2 * Math.PI, false);
  c.lineTo(IR, RIM);
  c.closePath();
}

function drawWorld(c, opts) {
  c.fillStyle = BG;
  c.fillRect(0, 0, W, H);

  vesselPath(c);
  c.fillStyle = "rgba(33,30,25,0.045)";
  c.fill();
  c.strokeStyle = "rgba(33,30,25,0.3)";
  c.lineWidth = 1.4;
  c.stroke();

  c.strokeStyle = "rgba(33,30,25,0.16)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(IL, RIM);
  c.lineTo(IR, RIM);
  c.stroke();
  c.beginPath();
  c.moveTo(IL, RIM + 6);
  c.lineTo(IL + 3, RIM + 6);
  c.moveTo(IR, RIM + 6);
  c.lineTo(IR - 3, RIM + 6);
  c.stroke();

  c.strokeStyle = "rgba(255,255,255,0.4)";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(IL + 8, RIM + 10);
  c.lineTo(IL + 8, RIM + 60);
  c.stroke();

  if (opts.ghost) {
    c.strokeStyle = "rgba(33,30,25,0.22)";
    c.lineWidth = 1;
    c.setLineDash([3, 6]);
    c.beginPath();
    c.moveTo(aimX, 0);
    c.lineTo(aimX, RIM - 6);
    c.stroke();
    c.setLineDash([]);
    drawGhost(c, aimX, 112);
  }

  for (const f of fruits) drawFruit(c, f, false);

  for (const r of rings) {
    c.globalAlpha = Math.max(0, r.life) * 0.6;
    c.strokeStyle = "rgba(33,30,25,0.5)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(r.x, r.y, r.r, 0, 6.283);
    c.stroke();
  }
  c.globalAlpha = 1;

  for (const f of floats) {
    c.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
    c.fillStyle = INK;
    c.font = "300 13px -apple-system, system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(f.txt, f.x, f.y);
  }
  c.globalAlpha = 1;

  if (state === "over") {
    c.strokeStyle = "rgba(33,30,25,0.45)";
    c.lineWidth = 1;
    for (const segs of cracks) {
      c.beginPath();
      c.moveTo(segs[0][0], segs[0][1]);
      for (let i = 1; i < segs.length; i++) c.lineTo(segs[i][0], segs[i][1]);
      c.stroke();
    }
  }
}

function drawGhost(c, x, y) {
  const lvl = nextLvl;
  const r = radius(lvl);
  c.globalAlpha = 0.38;
  c.fillStyle = RAMP[lvl - 1][0];
  c.strokeStyle = "rgba(33,30,25,0.5)";
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(x, y, r, 0, 6.283);
  c.fill();
  c.stroke();
  c.globalAlpha = 1;
}

function drawFruit(c, f, ghost) {
  const ramp = RAMP[f.lvl - 1];
  const r = f.r;
  c.save();
  c.translate(f.x, f.y);
  c.scale(1 + f.sq, 1 - f.sq * 0.85);
  c.fillStyle = ramp[0];
  c.strokeStyle = ramp[1];
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(0, 0, r, 0, 6.283);
  c.fill();
  c.stroke();

  c.fillStyle = "rgba(255,255,255,0.55)";
  c.beginPath();
  c.arc(-r * 0.32, -r * 0.34, r * 0.2, 0, 6.283);
  c.fill();

  c.strokeStyle = ramp[1];
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, -r * 0.72);
  c.quadraticCurveTo(r * 0.18, -r * 1.08, r * 0.42, -r * 1.0);
  c.moveTo(0, -r * 0.72);
  c.quadraticCurveTo(-r * 0.12, -r * 0.98, -r * 0.3, -r * 0.9);
  c.stroke();

  c.fillStyle = "rgba(33,30,25,0.55)";
  c.font = "300 " + Math.max(8, r * 0.72) + "px -apple-system, system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(f.lvl), 0, 1);
  c.restore();
}

function draw() {
  drawWorld(ctx, { ghost: state === "running" });
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === "running") step(dt, true);
  else if (state === "over") step(dt, false);
  draw();
requestAnimationFrame(frame);
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), 1500);
}

function shareText() {
  const tl = topLvl();
  const name = NAMES[Math.max(0, tl - 1)];
  return "Glass Orchard — I grew the " + name + " and scored " + score + ". Best " + best + ". Can you fill your glass?";
}

function copyText(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {}
  document.body.removeChild(ta);
  return ok;
}

function share() {
  const text = shareText();
  let shared = false;
  if (navigator.share) {
    try {
      navigator.share({ title: "Glass Orchard", text }).then(() => {
        shared = true;
      }).catch(() => {});
    } catch (e) {}
  }
  const ok = copyText(text);
  if (!ok && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  toast(shared ? "shared" : "copied");
}

function exportPng() {
  const s = 2;
  const c = document.createElement("canvas");
  c.width = W * s;
  c.height = H * s;
  const g = c.getContext("2d");
  g.scale(s, s);
  drawWorld(g, { ghost: false });
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "glass-orchard.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, "image/png");
  toast("saved");
}

canvas.addEventListener("pointermove", (e) => {
  hovered = true;
  const r = canvas.getBoundingClientRect();
  aimX = ((e.clientX - r.left) * W) / r.width;
  const lvl = nextLvl;
  aimX = clamp(aimX, IL + radius(lvl) + 1, IR - radius(lvl) - 1);
});

canvas.addEventListener("pointerleave", () => {
  hovered = false;
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  ensureAudio();
  hovered = true;
  const r = canvas.getBoundingClientRect();
  aimX = ((e.clientX - r.left) * W) / r.width;
  const lvl = nextLvl;
  aimX = clamp(aimX, IL + radius(lvl) + 1, IR - radius(lvl) - 1);
  drop();
});

window.addEventListener("keydown", (e) => {
  ensureAudio();
  if (e.key === "ArrowLeft") {
    aimX = clamp(aimX - 14, IL + radius(nextLvl) + 1, IR - radius(nextLvl) - 1);
  } else if (e.key === "ArrowRight") {
    aimX = clamp(aimX + 14, IL + radius(nextLvl) + 1, IR - radius(nextLvl) - 1);
  } else if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    drop();
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

$("shareBtn").addEventListener("click", share);
$("shareBtn2").addEventListener("click", share);
$("saveBtn").addEventListener("click", exportPng);
$("saveBtn2").addEventListener("click", exportPng);
$("againBtn").addEventListener("click", reset);

requestAnimationFrame(frame);