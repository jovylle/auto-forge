// Lantern Fog Atlas — bauhaus hex charting game. No deps. WebAudio bleeps. file:// safe.
const $ = (id) => document.getElementById(id);
const canvas = $("map"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// ---------- audio ----------
let AC = null, muted = false;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; }
function tone(freq, dur = 0.12, type = "square", vol = 0.12, when = 0, slide = 0) {
  if (muted) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + when);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + when + dur);
    g.gain.setValueAtTime(vol, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur);
    o.connect(g).connect(a.destination); o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.02);
  } catch {}
}
const sfx = {
  move: () => tone(220 + Math.random() * 80, 0.09, "square", 0.08),
  claim: () => { tone(392, 0.1, "square", 0.1); tone(523, 0.1, "square", 0.1, 0.08); tone(659, 0.16, "square", 0.1, 0.16); },
  trade: () => { tone(523, 0.09, "triangle", 0.14); tone(659, 0.09, "triangle", 0.14, 0.09); tone(784, 0.09, "triangle", 0.14, 0.18); tone(1046, 0.2, "triangle", 0.12, 0.27); },
  bad: () => tone(110, 0.2, "sawtooth", 0.1, 0, -40),
  reveal: () => tone(880, 0.25, "sine", 0.06, 0, 220),
  level: () => { tone(330, 0.12, "square", 0.1); tone(440, 0.12, "square", 0.1, 0.1); tone(554, 0.12, "square", 0.1, 0.2); tone(880, 0.3, "square", 0.1, 0.3); },
};
addEventListener("pointerdown", () => { try { ac(); } catch {} }, { once: true });

// ---------- seeding ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const todayStr = new Date().toISOString().slice(0, 10);
let seedStr = todayStr, practice = false;
try {
  const q = new URLSearchParams(location.search).get("seed");
  if (q) { seedStr = q; practice = true; }
} catch {}
let rng = mulberry32(hashStr("lantern:" + seedStr));

// ---------- grid ----------
const COLS = 13, ROWS = 9, R = 34;
const HEXW = Math.sqrt(3) * R, HEXH = 1.5 * R;
const OX = 70, OY = 60;
function hexCenter(c, r) { return { x: OX + HEXW * (c + 0.5 * (r & 1)), y: OY + HEXH * r * 0.6667 }; }
function hexPath(x, y, rad) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; const px = x + rad * Math.cos(a), py = y + rad * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
function axialDist(a, b) {
  const aq = a.c - ((a.r - (a.r & 1)) >> 1), ar = a.r, bq = b.c - ((b.r - (b.r & 1)) >> 1), br = b.r;
  const dq = aq - bq, dr = ar - br; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
const TERRAIN = ["lagoon", "sand", "meadow", "ridge"];
const TCOL = ["#1d3f8f", "#e8d9a0", "#3f7d3a", "#8a4b2a"];
// value-noise islands
const blobs = Array.from({ length: 7 }, () => ({ x: rng() * COLS, y: rng() * ROWS, r: 2 + rng() * 3.4 }));
const tiles = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  let h = 0; for (const b of blobs) { const d = Math.hypot(c - b.x, (r - b.y) * 1.2); h += Math.max(0, 1 - d / b.r); }
  h += rng() * 0.35;
  const t = h < 0.55 ? 0 : h < 0.95 ? 1 : h < 1.5 ? 2 : 3;
  tiles.push({ c, r, t, claimed: false, seen: false });
}
const at = (c, r) => tiles.find(t => t.c === c && t.r === r);
const key = (t) => t.c + "," + t.r;

// ---------- state ----------
const storeKey = "lantern-fog-atlas:" + seedStr;
let S = { glow: 30, radiusBonus: 0, player: { c: 6, r: 4 }, claimed: [] };
try { const raw = localStorage.getItem(storeKey); if (raw) { const p = JSON.parse(raw); if (p && Array.isArray(p.claimed)) S = { ...S, ...p }; } } catch {}
tiles.forEach(t => { if (S.claimed.includes(key(t))) t.claimed = true; });
let baseRadius = 2.6, scrollBonus = 0, pals = [], logArr = [];
const PALDEF = [
  { name: "KLEE", color: "#0047bb", shape: "sq" },
  { name: "POPOVA", color: "#e30613", shape: "ci" },
  { name: "MOHOLY", color: "#0a7d4f", shape: "tr" },
  { name: "ALBERS", color: "#7a4bb3", shape: "ci" },
];
function scatter() {
  const free = tiles.filter(t => axialDist(t, S.player) > 3);
  pals = PALDEF.map((d, i) => { const t = free[Math.floor(rng() * free.length)] || tiles[0]; return { ...d, c: (t.c + i * 3) % COLS, r: (t.r + i * 2) % ROWS, offer: 2 + (i % 3) }; });
}
scatter();
function save() { try { localStorage.setItem(storeKey, JSON.stringify({ glow: S.glow, radiusBonus: S.radiusBonus, player: S.player, claimed: tiles.filter(t => t.claimed).map(key) })); } catch {} }
function radius() { return baseRadius + S.radiusBonus + scrollBonus; }
function lit(t) { return axialDist(t, S.player) <= radius() || t.claimed; }

// ---------- ui helpers ----------
let toastT = null;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1800); }
function log(msg) { logArr.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`); logArr = logArr.slice(0, 30); const ol = $("log"); ol.innerHTML = logArr.map(m => `<li>${m}</li>`).join(""); }
function refresh() {
  $("glowVal").textContent = S.glow;
  $("glowBar").style.width = Math.min(100, S.glow) + "%";
  const n = tiles.filter(t => t.claimed).length;
  $("claimVal").textContent = n;
  $("claimBar").style.width = (100 * n / tiles.length) + "%";
  $("radiusVal").textContent = radius().toFixed(1);
  $("radiusBar").style.width = Math.min(100, radius() / 6 * 100) + "%";
  const seen = tiles.filter(lit).length;
  $("chartPct").textContent = Math.round(100 * seen / tiles.length) + "% charted · " + seen + "/" + tiles.length + " lit";
  $("seedLabel").textContent = (practice ? "practice · " : "day · ") + seedStr;
  $("seedCode").textContent = seedStr + " · ⌀" + radius().toFixed(1);
  const ul = $("pals");
  ul.innerHTML = pals.map((p, i) => {
    const d = axialDist(p, S.player);
    const near = d <= 2.2;
    return `<li><span class="dot" style="background:${p.color}"></span><span><b>${p.name}</b> · ${near ? "alongside — ready to trade" : Math.round(d) + " hexes away"} · offers +${p.offer} glow</span><button data-pal="${i}" ${near ? "" : "disabled"}>TRADE ${near ? "⚖" : "· · ·"}</button></li>`;
  }).join("");
  ul.querySelectorAll("button[data-pal]").forEach(b => b.onclick = () => trade(+b.dataset.pal));
}

// ---------- actions ----------
function move(dc, dr) {
  const nc = S.player.c + dc, nr = S.player.r + dr;
  const t = at(nc, nr);
  if (!t) { sfx.bad(); toast("Edge of the charted world."); return; }
  if (S.glow < 1) { sfx.bad(); toast("Lantern is dark — trade or wait for dawn tithe."); return; }
  S.player = { c: nc, r: nr }; S.glow = Math.max(0, S.glow - 1);
  tiles.forEach(x => { if (lit(x) && !x.seen) { x.seen = true; } });
  sfx.move(); save(); draw(); refresh();
  autoClaimFoots(t);
}
function claimCost(t) { return t.t === 0 ? 4 : t.t === 3 ? 3 : 2; }
function claim(t, silent) {
  t = t || at(S.player.c, S.player.r);
  if (!t) return false;
  if (t.claimed) { if (!silent) { toast("Already yours — stamped in yellow."); } return false; }
  if (!lit(t)) { sfx.bad(); toast("Too dark there — move closer or scroll to widen beam."); return false; }
  const cost = claimCost(t);
  if (S.glow < cost) { sfx.bad(); toast(`Need ${cost} glow (have ${S.glow}). Trade with a neighbour!`); return false; }
  S.glow -= cost; t.claimed = true; t.seen = true;
  const n = tiles.filter(x => x.claimed).length;
  if (n === 10 || n === 25 || n === 45 || n === 70) { S.radiusBonus += 0.4; sfx.level(); log(`Lantern upgraded! Ø now ${radius().toFixed(1)} at ${n} tiles.`); toast("⬢ Lantern upgraded — beam wider!"); }
  else sfx.claim();
  if (!silent) { log(`Claimed ${TERRAIN[t.t]} hex (${t.c},${t.r}) for ${cost} glow.`); toast(`◉ Claimed ${TERRAIN[t.t]} −${cost} glow`); }
  save(); draw(); refresh(); return true;
}
function autoClaimFoots(t) { /* stepping onto rich meadow auto-tithe */ if (t.t === 2 && !t.claimed && S.glow >= 6 && Math.random() < 0.25) claim(t); }
function trade(i) {
  const p = pals[i]; if (!p) return;
  if (axialDist(p, S.player) > 2.2) { sfx.bad(); toast(p.name + " is too far — walk closer."); return; }
  const roll = Math.random();
  if (roll < 0.55) { S.glow += p.offer + 2; log(`${p.name} gifts +${p.offer + 2} glow for a story.`); toast(`⚖ ${p.name} gifts +${p.offer + 2} glow`); }
  else if (roll < 0.85) {
    const dark = tiles.filter(t => !t.claimed && lit(t)).slice(0, 6);
    let k = 0; for (const t of dark) { if (S.glow >= 1) { S.glow -= 1; t.claimed = true; k++; if (k >= 2) break; } }
    S.glow += p.offer; log(`${p.name} barters: claims ${k} hexes for you, +${p.offer} glow.`); toast(`⚖ ${p.name} claims ${k} tiles +${p.offer} glow`);
  } else { S.glow = Math.max(0, S.glow - 2); S.radiusBonus = Math.min(2.5, S.radiusBonus + 0.3); log(`${p.name} tunes your lens: −2 glow, beam +0.3.`); toast("⚖ Lens tuned — beam wider, −2 glow"); }
  p.offer = 2 + Math.floor(Math.random() * 5);
  // pal drifts off after trading
  wanderPal(p);
  sfx.trade(); save(); draw(); refresh();
}
function wanderPal(p) {
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [0, 0]];
  const [dc, dr] = opts[Math.floor(Math.random() * opts.length)];
  const t = at(p.c + dc, p.r + dr); if (t) { p.c = t.c; p.r = t.r; }
}
setInterval(() => { pals.forEach(wanderPal); draw(); refresh(); }, 2200);
// dawn tithe: claimed tiles drip glow
setInterval(() => {
  const n = tiles.filter(t => t.claimed).length;
  if (n > 0) { S.glow += Math.min(6, 1 + Math.floor(n / 12)); save(); refresh(); draw(); }
}, 7000);

// ---------- render ----------
function draw() {
  ctx.clearRect(0, 0, W, H);
  // bauhaus backdrop stripes
  ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#e30613"; ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = "#f5c400"; ctx.fillRect(0, H - 14, W, 14);
  for (const t of tiles) {
    const { x, y } = hexCenter(t.c, t.r);
    const isLit = lit(t);
    hexPath(x, y, R - 2);
    ctx.fillStyle = isLit ? TCOL[t.t] : "#2a2f3a";
    ctx.fill();
    ctx.lineWidth = t.claimed ? 4 : 1.5;
    ctx.strokeStyle = t.claimed ? "#f5c400" : isLit ? "#141414" : "#454c5c";
    ctx.stroke();
    if (t.claimed && isLit) {
      // bauhaus glyph per terrain
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      if (t.t === 0) { ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
      else if (t.t === 1) { ctx.fillRect(x - 9, y - 9, 18, 18); }
      else if (t.t === 2) { ctx.moveTo(x, y - 11); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x - 10, y + 8); ctx.closePath(); ctx.fill(); }
      else { ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.fillStyle = "#f5c400"; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
      // red ring
      ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = "#e30613"; ctx.stroke();
    }
    if (!isLit) { // fog dots
      ctx.fillStyle = "rgba(244,239,228,.16)";
      for (let k = 0; k < 3; k++) { const a = hashStr(t.c + ":" + t.r + ":" + k) % 100 / 100 * 6.28; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 12, y + Math.sin(a) * 10, 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = "rgba(244,239,228,.5)"; ctx.font = "700 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", x, y + 4);
    }
  }
  // lantern halo
  const pp = hexCenter(S.player.c, S.player.r);
  const gr = ctx.createRadialGradient(pp.x, pp.y, 10, pp.x, pp.y, radius() * 62);
  gr.addColorStop(0, "rgba(245,196,0,.34)"); gr.addColorStop(1, "rgba(245,196,0,0)");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pp.x, pp.y, radius() * 62, 0, 7); ctx.fill();
  // pals
  for (const p of pals) {
    const { x, y } = hexCenter(p.c, p.r);
    if (!lit({ c: p.c, r: p.r })) continue;
    ctx.beginPath(); ctx.arc(x + 12, y - 12, 11, 0, 7); ctx.fillStyle = p.color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#f4efe4"; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "700 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(p.name[0], x + 12, y - 8);
  }
  // player lantern
  hexPath(pp.x, pp.y, R - 2); ctx.lineWidth = 4; ctx.strokeStyle = "#e30613"; ctx.stroke();
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 13, 0, 7); ctx.fillStyle = "#e30613"; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = "#f4efe4"; ctx.stroke();
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 5, 0, 7); ctx.fillStyle = "#f5c400"; ctx.fill();
}

// ---------- input ----------
// click / tap to walk + claim
function pick(e) {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W / rect.width), py = (e.clientY - rect.top) * (H / rect.height);
  let best = null, bd = 1e9;
  for (const t of tiles) { const { x, y } = hexCenter(t.c, t.r); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = t; } }
  if (!best || bd > R * 1.2) return;
  if (best.c === S.player.c && best.r === S.player.r) { claim(best); return; }
  const d = axialDist(best, S.player);
  if (d <= 2 && lit(best)) {
    // step one hex toward it, then claim if arrived
    const dc = Math.sign(best.c - S.player.c), dr = Math.sign(best.r - S.player.r);
    if (d === 1 || (d === 2 && dc !== 0 && dr !== 0)) move(dc, 0);
    else move(dc, dr);
    if (axialDist(best, S.player) === 0) claim(best);
    else if (axialDist(best, S.player) === 1) claim(best);
  } else if (!lit(best)) { sfx.bad(); toast("Shrouded — scroll to widen the beam, then approach."); }
  else { sfx.bad(); toast("Too far — walk hex by hex."); }
}
canvas.addEventListener("click", pick);

const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
addEventListener("keydown", (e) => {
  if (DIRS[e.key]) { e.preventDefault(); const [dc, dr] = DIRS[e.key]; move(dc, dr); }
  else if (e.key === " " || e.key === "Enter") { e.preventDefault(); claim(); }
  else if (e.key === "m" || e.key === "M") { muted = !muted; toast(muted ? "🔇 sound off" : "🔊 sound on"); }
  else if (e.key === "t" || e.key === "T") { const i = pals.findIndex(p => axialDist(p, S.player) <= 2.2); if (i >= 0) trade(i); }
});
$("btnUp").onclick = () => move(0, -1); $("btnDown").onclick = () => move(0, 1);
$("btnLeft").onclick = () => move(-1, 0); $("btnRight").onclick = () => move(1, 0);
$("btnClaim").onclick = () => claim();
$("btnTrade").onclick = () => { const i = pals.findIndex(p => axialDist(p, S.player) <= 2.2); i >= 0 ? trade(i) : (sfx.bad(), toast("No neighbour in range — follow the coloured dots.")); };
$("btnNewSeed").onclick = () => { location.search = "?seed=practice-" + Math.floor(Math.random() * 1e6); };
$("btnReset").onclick = () => { localStorage.removeItem(storeKey); location.reload(); };

// ---------- scroll constraint: scroll widens lantern + morphs masthead ----------
function onScroll() {
  const y = window.scrollY || 0;
  scrollBonus = Math.min(2.2, y / 350); // must react to scroll
  $("mast").classList.toggle("zoomed", y > 60);
  // parallax the shape column
  document.querySelector(".mast-shapes").style.transform = `translateY(${Math.min(30, y * 0.05)}px) rotate(${y * 0.02}deg)`;
  refresh(); draw();
}
addEventListener("scroll", onScroll, { passive: true });
// wheel over map = fine lantern focus (also counts as scroll reaction)
canvas.addEventListener("wheel", (e) => { e.preventDefault(); S.radiusBonus = Math.max(-1, Math.min(2.5, S.radiusBonus + (e.deltaY < 0 ? 0.15 : -0.15))); save(); refresh(); draw(); }, { passive: false });

// ---------- boot ----------
tiles.forEach(x => { if (lit(x)) x.seen = true; });
log(`Unfurled daily fog "${seedStr}". ${tiles.length} hexes, lantern Ø ${radius().toFixed(1)}.`);
log("Claim tiles (◉), walk with arrows, trade when a neighbour is alongside.");
draw(); refresh(); onScroll();
