// Cinder Quail Kinetic — type-to-burst kinetic letters, drag/fling physics,
// font-morph slider, PNG poster export. System fonts only. No deps.
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const field = document.getElementById("field");
const slider = document.getElementById("morphSlider");
const morphName = document.getElementById("morphName");
const countEl = document.getElementById("count");
const hint = document.getElementById("hint");

const INK = "#141414", EMBER = "#E8442E";
const SANS = `-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`;
const SERIF = `Georgia,"Times New Roman",serif`;
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;

let W = 0, H = 0, DPR = 1;
let letters = [];   // {ch,x,y,vx,vy,rot,vr,size,ember,seed,born}
let sparks = [];    // {x,y,vx,vy,life}
let morph = 20;
let drag = null;    // {L, dx, dy, px, py, vx, vy}
let bornSeq = 0;

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(50, r.width); H = Math.max(50, r.height);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

// --- font morph: 0=sans light … 50=serif italic … 100=mono black ---
function styleFor(L, t) {
  const w = Math.round(300 + t * 600 + (L.seed - 0.5) * 120);
  const fam = t < 38 ? SANS : t < 72 ? SERIF : MONO;
  const it = t >= 30 && t <= 78 ? "italic " : "";
  const skew = t < 38 ? 0 : t < 72 ? -0.10 : 0;          // serif lean
  const sx = 1.18 - t * 0.004;                            // 1.18 → 0.78 width
  return { font: `${it}${w} ${L.size}px ${fam}`, skew, sx, w };
}
function morphLabel(t) {
  if (t < 38) return `sans·${Math.round(300 + t * 600)}`;
  if (t < 72) return `serif·${Math.round(300 + t * 600)}`;
  return `mono·${Math.round(300 + t * 600)}`;
}

function spawnBurst(text) {
  hideHint();
  for (const ch of text) {
    if (ch === " " || ch === "\n" || ch === "\t") { nudgeAll(); continue; }
    if (letters.length > 220) letters.shift();
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
    letters.push({
      ch, x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.42 + (Math.random() - 0.5) * 40,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
      rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.2,
      size: 44 + Math.random() * 66, ember: Math.random() < 0.16,
      seed: Math.random(), born: bornSeq++,
    });
    for (let i = 0; i < 6; i++) {
      const sa = Math.random() * Math.PI * 2, ss = 1 + Math.random() * 4;
      sparks.push({ x: W / 2, y: H * 0.42, vx: Math.cos(sa) * ss, vy: Math.sin(sa) * ss - 1, life: 1 });
    }
  }
  save();
}
function nudgeAll() { for (const L of letters) { L.vx += (Math.random() - 0.5) * 3; L.vy -= 1 + Math.random() * 2; } }

// --- input: desktop typing + mobile field (no double-spawn) ---
document.addEventListener("keydown", (e) => {
  if (e.target === field || e.target === slider || e.target.tagName === "BUTTON") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Backspace") { letters.pop(); save(); return; }
  if (e.key.length === 1) spawnBurst(e.key);
});
field.addEventListener("input", () => {
  if (field.value) { spawnBurst(field.value); field.value = ""; }
  else save();
});
field.addEventListener("keydown", (e) => {
  if (e.key === "Backspace" && field.value === "") letters.pop();
  e.stopPropagation(); save();
});
canvas.addEventListener("pointerdown", () => field.blur(), { passive: true });

// --- drag with fling ---
function letterAt(x, y) {
  for (let i = letters.length - 1; i >= 0; i--) {
    const L = letters[i];
    const r = L.size * 0.75;
    if (Math.hypot(L.x - x, L.y - y) < r) return L;
  }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const L = letterAt(x, y);
  if (L) {
    drag = { L, dx: L.x - x, dy: L.y - y, px: x, py: y, vx: 0, vy: 0 };
    L.vx = L.vy = L.vr = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("grabbing");
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  drag.vx = x - drag.px; drag.vy = y - drag.py;
  drag.px = x; drag.py = y;
  drag.L.x = x + drag.dx; drag.L.y = y + drag.dy;
  drag.L.rot += drag.vx * 0.002;
});
function endDrag() {
  if (!drag) return;
  drag.L.vx = drag.vx * 1.4; drag.L.vy = drag.vy * 1.4;  // fling
  drag.L.vr = drag.vx * 0.01;
  drag = null; canvas.classList.remove("grabbing"); save();
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("dblclick", () => { remix(); });

// --- buttons ---
document.getElementById("scatterBtn").onclick = () => { remix(); };
document.getElementById("clearBtn").onclick = () => { letters = []; sparks = []; save(); };
document.getElementById("settleBtn").onclick = () => { settle(); };
document.getElementById("exportBtn").onclick = () => { exportPNG(); };
for (const b of document.querySelectorAll("button")) b.addEventListener("click", () => b.blur());
slider.addEventListener("input", () => {
  morph = +slider.value; morphName.textContent = morphLabel(morph / 100); save();
});

function remix() {
  hideHint();
  for (const L of letters) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
    L.x = Math.random() * W; L.y = Math.random() * H * 0.7;
    L.vx = Math.cos(a) * sp; L.vy = Math.sin(a) * sp - 2;
    L.vr = (Math.random() - 0.5) * 0.3; L.ember = Math.random() < 0.16;
  }
  save();
}
function settle() {
  // Flow letters into centered poster rows (reading order).
  const t = morph / 100;
  const items = [...letters].sort((a, b) => a.born - b.born);
  const gap = 14, lineH = 96, maxW = Math.min(W - 48, 720);
  let rows = [[]], w = 0;
  for (const L of items) {
    L.size = 64; // normalize for a clean poster
    ctx.font = styleFor(L, t).font;
    const cw = ctx.measureText(L.ch === " " ? " " : L.ch).width + gap;
    if (w + cw > maxW && rows[rows.length - 1].length) { rows.push([]); w = 0; }
    rows[rows.length - 1].push({ L, cw }); w += cw;
  }
  const y0 = H / 2 - (rows.length - 1) * lineH / 2;
  rows.forEach((row, ri) => {
    const rw = row.reduce((s, c) => s + c.cw, 0);
    let x = W / 2 - rw / 2;
    for (const { L, cw } of row) {
      L.x = x + cw / 2; L.y = y0 + ri * lineH;
      L.vx = L.vy = L.vr = L.rot = 0;
      x += cw;
    }
  });
  save();
}

// --- export poster PNG (1200×1500) ---
function exportPNG() {
  const PW = 1200, PH = 1500;
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  const g = c.getContext("2d");
  g.fillStyle = "#FAFAF7"; g.fillRect(0, 0, PW, PH);
  g.fillStyle = "#141414";
  g.font = `500 28px ${SANS}`; g.fillText("Cinder Quail — kinetic", 72, 110);
  g.fillStyle = "#E8442E";
  g.beginPath(); g.arc(72 + g.measureText("Cinder Quail — kinetic").width + 34, 101, 10, 0, 7); g.fill();
  g.strokeStyle = "#14141422"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(72, 140); g.lineTo(PW - 72, 140); g.stroke();
  const t = morph / 100, s = (PW - 144) / W;
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const L of letters) {
    const st = styleFor({ ...L, size: L.size * s }, t);
    g.save();
    g.translate(72 + L.x * s, 140 + (L.y / H) * (PH - 340));
    g.rotate(L.rot); g.transform(st.sx, 0, st.skew, 1, 0, 0);
    g.font = st.font; g.fillStyle = L.ember ? EMBER : INK;
    g.fillText(L.ch, 0, 0);
    g.restore();
  }
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#14141488"; g.font = `400 24px ${SANS}`;
  g.fillText(`${letters.length} glyphs · cinder-quail-kinetic`, 72, PH - 72);
  const a = document.createElement("a");
  a.download = "cinder-quail-poster.png";
  a.href = c.toDataURL("image/png");
  a.click();
}

// --- persistence ---
let saveT = 0;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem("cqk", JSON.stringify({
        morph, seq: bornSeq,
        letters: letters.map((L) => [L.ch, L.x / W, L.y / H, L.size, L.ember, L.seed, L.born]),
      }));
    } catch { /* file:// or private mode — fine */ }
  }, 300);
  countEl.textContent = String(letters.length);
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem("cqk") || "null");
    if (!d) return false;
    morph = d.morph ?? 20; bornSeq = d.seq ?? 0;
    slider.value = morph; morphName.textContent = morphLabel(morph / 100);
    letters = d.letters.map(([ch, nx, ny, size, ember, seed, born]) => ({
      ch, x: nx * W, y: ny * H, vx: 0, vy: 0, rot: 0, vr: 0,
      size: size || 60, ember: !!ember, seed: seed ?? Math.random(), born: born ?? 0,
    }));
    countEl.textContent = String(letters.length);
    return letters.length > 0;
  } catch { return false; }
}

// --- main loop ---
function frame() {
  ctx.clearRect(0, 0, W, H);
  // faint baseline grid — extreme-minimal texture
  ctx.strokeStyle = "#14141410"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = W / 2 % 48; x < W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  ctx.stroke();

  const t = morph / 100;
  for (const L of letters) {
    if (L !== drag?.L) {
      L.vy += 0.12; L.vx *= 0.986; L.vy *= 0.986;       // gravity + air
      L.x += L.vx; L.y += L.vy; L.rot += L.vr; L.vr *= 0.98;
      const r = L.size * 0.5;
      if (L.x < r) { L.x = r; L.vx = Math.abs(L.vx) * 0.72; L.vr *= -0.8; }
      if (L.x > W - r) { L.x = W - r; L.vx = -Math.abs(L.vx) * 0.72; L.vr *= -0.8; }
      if (L.y > H - r) { L.y = H - r; L.vy = -Math.abs(L.vy) * 0.68; L.vx *= 0.94; L.vr *= 0.9; }
      if (L.y < -80) { L.y = -80; L.vy = Math.abs(L.vy) * 0.5; }
    }
    const st = styleFor(L, t);
    ctx.save();
    ctx.translate(L.x, L.y); ctx.rotate(L.rot); ctx.transform(st.sx, 0, st.skew, 1, 0, 0);
    ctx.font = st.font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = L.ember ? EMBER : INK;
    ctx.fillText(L.ch, 0, 0);
    ctx.restore();
  }
  // ember sparks
  sparks = sparks.filter((p) => p.life > 0);
  for (const p of sparks) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.03;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = EMBER;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

let hintHidden = false;
function hideHint() { if (!hintHidden) { hintHidden = true; hint.classList.add("dim"); } }
setTimeout(hideHint, 9000);

resize();
const had = restore();
if (!had) {
  morphName.textContent = morphLabel(morph / 100);
  spawnBurst("quail");
  for (const L of letters) { L.x = W / 2 + (Math.random() - 0.5) * 300; L.y = H * 0.4 + (Math.random() - 0.5) * 120; L.vx = L.vy = 0; }
}
countEl.textContent = String(letters.length);
resize(); // re-clamp restored coords after layout
requestAnimationFrame(frame);
