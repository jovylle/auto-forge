// Wandergrid Parcel Routes — 30-second Memphis delivery dash.
// Drag routes on hex grid · shifting fog blocks paths · claim territory · daily seed leaderboard.
// Plain JS, no deps. Works from file:// . localStorage for bests + daily board.
"use strict";

const $ = (s) => document.querySelector(s);
const board = $("#board"), toastEl = $("#toast"), overlay = $("#overlay");
const clockEl = $("#clock"), scoreEl = $("#score"), parcelsEl = $("#parcels"), bestEl = $("#best");
const timebarFill = $("#timebarFill"), boardList = $("#boardList"), scoreForm = $("#scoreForm");
const nameInput = $("#nameInput"), ovSeed = $("#ovSeed"), boardSeed = $("#boardSeed");

// ---------- daily seed ----------
function daySeed(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const SEED = daySeed();
$("#seedLabel").textContent = SEED;
ovSeed.textContent = SEED; boardSeed.textContent = SEED;

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- hex grid (axial, pointy-top, radius 3 = 37 cells) ----------
const R = 3, SIZE = 44, CX = 320, CY = 300;
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q, r) => `${q},${r}`;
const cells = new Map(); // key -> cell {q,r,x,y,claimed,fog,warn,house,depot,el,poly,label}
for (let q = -R; q <= R; q++)
  for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++)
    cells.set(key(q, r), {
      q, r, x: CX + SIZE * Math.sqrt(3) * (q + r / 2), y: CY + SIZE * 1.5 * r,
      claimed: false, fog: false, warn: false, house: 0, depot: q === 0 && r === 0,
    });

const neighbors = (c) => DIRS.map(([dq, dr]) => cells.get(key(c.q + dq, c.r + dr))).filter(Boolean);
const isNeighbor = (a, b) => DIRS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
const dist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
function hexPoints(cx, cy, s) {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(" ");
}

// ---------- audio (tiny bleeps, guarded) ----------
let AC = null;
function beep(freq = 440, dur = 0.08, type = "square", vol = 0.05) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch { /* silent */ }
}

// ---------- render ----------
const NS = "http://www.w3.org/2000/svg";
function buildBoard() {
  board.innerHTML = "";
  const routeLayer = document.createElementNS(NS, "g");
  routeLayer.setAttribute("id", "routeLayer");
  for (const c of cells.values()) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "hex"); g.dataset.k = key(c.q, c.r);
    g.setAttribute("tabindex", "0"); g.setAttribute("role", "button");
    g.setAttribute("aria-label", `hex ${c.q},${c.r}`);
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", hexPoints(c.x, c.y, SIZE - 3));
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", c.x); label.setAttribute("y", c.y + 8);
    label.setAttribute("text-anchor", "middle"); label.setAttribute("class", "glyph");
    label.setAttribute("font-size", "26");
    g.append(poly, label);
    board.append(g);
    c.el = g; c.poly = poly; c.label = label;
    g.addEventListener("pointerdown", (e) => onDown(e, c));
    g.addEventListener("keydown", (e) => onKeyHex(e, c));
  }
  board.append(routeLayer);
  paintAll();
}
function cellFill(c) {
  if (c.depot) return "#1c1c2b";
  if (c.fog) return "url(#fogPat)";
  if (c.house) return "#FFD02F";
  if (c.claimed) return "#FF3E8A";
  if (c.warn) return "url(#warnPat)";
  return "#FFFDF6";
}
function ensureDefs() {
  if (board.querySelector("defs")) return;
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `<pattern id="fogPat" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="12" height="12" fill="#d5e1ec"/><rect width="6" height="12" fill="#8fa3b8"/></pattern>
    <pattern id="warnPat" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="12" height="12" fill="#fff"/><rect width="6" height="12" fill="#FF6B35"/></pattern>`;
  board.prepend(defs);
}
function paint(c) {
  c.poly.setAttribute("fill", cellFill(c));
  c.el.classList.toggle("in-route", route.includes(c));
  let glyph = "", color = "#1c1c2b";
  if (c.depot) { glyph = "★"; color = "#FFD02F"; }
  else if (c.fog) { glyph = "▒"; color = "#41506b"; }
  else if (c.house) { glyph = "📦"; }
  c.label.textContent = glyph; c.label.setAttribute("fill", color);
  c.label.setAttribute("font-size", c.house ? 26 : 22);
}
function paintAll() { ensureDefs(); for (const c of cells.values()) paint(c); drawRoute(); }

function drawRoute() {
  board.querySelectorAll(".route-line").forEach((n) => n.remove());
  if (route.length < 2 && !cursorPreview) return;
  const layer = board.querySelector("#routeLayer");
  const pts = route.map((c) => `${c.x},${c.y}`).join(" ");
  const pl = document.createElementNS(NS, "polyline");
  pl.setAttribute("points", pts);
  pl.setAttribute("class", "route-line" + (dragging ? " preview" : ""));
  layer.append(pl);
}

// ---------- game state ----------
let rng = mulberry32(hashStr("wg" + SEED));
let playing = false, dragging = false, route = [], cursorPreview = null;
let score = 0, delivered = 0, timeLeft = 30, timerId = null, fogId = null;
let fogCells = [], cursor = null, loggedThisRound = false;

const walkable = (c) => !c.fog;
function canStart(c) { return c.depot || c.claimed; }

function toast(msg, ms = 1400) {
  toastEl.textContent = msg; toastEl.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
}

// ---------- setup per round ----------
const HOUSE_VALUES = [10, 15, 15, 20, 20, 25];
function freeCells(exclude = []) {
  return [...cells.values()].filter((c) => !c.depot && !c.fog && !c.house && !exclude.includes(c) && dist(c, cells.get("0,0")) > 1);
}
function placeHouses(n = 6) {
  for (const c of cells.values()) c.house = 0;
  const free = freeCells().sort(() => rng() - 0.5);
  for (let i = 0; i < Math.min(n, free.length); i++) free[i].house = HOUSE_VALUES[i % HOUSE_VALUES.length];
}
function placeFog(n = 6) {
  fogCells = [];
  const opts = freeCells().sort(() => rng() - 0.5).slice(0, n);
  for (const c of opts) { c.fog = true; fogCells.push(c); }
}
function spawnHouse() {
  const free = freeCells().sort(() => Math.random() - 0.5);
  if (!free.length) return;
  const vals = [10, 15, 20, 25];
  free[0].house = vals[Math.floor(Math.random() * vals.length)];
}

function resetRound() {
  rng = mulberry32(hashStr("wg" + SEED + (localStorage.getItem("wg-reshuffle") || "")));
  for (const c of cells.values()) { c.claimed = false; c.fog = false; c.warn = false; c.house = 0; }
  cells.get("0,0").claimed = true;
  placeFog(6); placeHouses(6);
  route = []; score = 0; delivered = 0; timeLeft = 30; loggedThisRound = false;
  scoreEl.textContent = "0"; parcelsEl.textContent = "0"; clockEl.textContent = "30";
  timebarFill.style.width = "100%";
  bestEl.textContent = localStorage.getItem("wg-best") || "0";
  scoreForm.hidden = true;
  paintAll(); renderBoard();
}

// ---------- routing (drag) ----------
function onDown(e, c) {
  if (!playing) return;
  e.preventDefault();
  if (c.fog) { deny(c, "fogged!"); return; }
  if (route.length === 0 && !canStart(c)) {
    deny(c, "start from ★ or pink turf!");
    return;
  }
  if (route.length === 0) { dragging = true; route = [c]; beep(520, 0.06); paintAll(); }
}
window.addEventListener("pointermove", (e) => {
  if (!dragging || !playing) return;
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".hex");
  if (!el) return;
  const c = cells.get(el.dataset.k);
  if (c) tryExtend(c);
});
window.addEventListener("pointerup", () => { if (dragging) commitRoute(); });
window.addEventListener("pointercancel", () => { dragging = false; route = []; paintAll(); });

function tryExtend(c) {
  const last = route[route.length - 1];
  if (!last || c === last) return;
  if (route.includes(c)) { // backtrack = undo
    if (route[route.length - 2] === c) { route.pop(); beep(300, 0.05); paintAll(); }
    return;
  }
  if (!isNeighbor(last, c)) return;
  if (c.fog) { deny(c, "fog blocks!"); return; }
  if (route.length >= 8) { toast("max 8 tiles — release!"); return; }
  route.push(c); beep(440 + route.length * 60, 0.05); paintAll();
}
function deny(c, msg) {
  c.el.classList.remove("bad"); void c.el.getBoundingClientRect(); c.el.classList.add("bad");
  beep(160, 0.12, "sawtooth"); toast(msg);
}
function commitRoute() {
  dragging = false;
  if (!route.length) { paintAll(); return; }
  if (route.length < 2) { route = []; paintAll(); return; }
  const end = route[route.length - 1];
  let gained = 0;
  const fresh = route.filter((c) => !c.claimed);
  for (const c of route) c.claimed = true;
  gained += fresh.length * 2;
  if (end.house) {
    const val = end.house;
    gained += val + (route.length >= 5 ? 10 : 0);
    end.house = 0; delivered++;
    for (const n of neighbors(end)) if (walkable(n) && !n.claimed) { n.claimed = true; gained += 2; }
    parcelsEl.textContent = delivered;
    toast(val >= 20 ? `📦 BIG DELIVERY +${gained}!` : `📦 delivered +${gained}!`);
    beep(660, 0.09); setTimeout(() => beep(880, 0.12), 90);
    confettiBurst(end.x, end.y);
    spawnHouse();
  } else if (gained > 0) {
    toast(`claimed +${gained}`); beep(500, 0.06);
  }
  score += gained; scoreEl.textContent = score;
  route = []; paintAll();
}

// keyboard: arrows move cursor from depot, Enter starts/extends, Backspace undoes, Esc cancels
function onKeyHex(e, c) {
  if (!playing) return;
  cursor = c;
  const idx = { ArrowRight: 0, ArrowDownRight: 1, ArrowDownLeft: 2, ArrowLeft: 3, ArrowUpLeft: 4, ArrowUpRight: 5 };
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (!route.length) { if (canStart(c) && walkable(c)) { route = [c]; paintAll(); } else deny(c, "start from ★ or pink!"); }
    else commitRoute();
  } else if (e.key === "Escape") { route = []; paintAll(); }
  else if (e.key in idx) {
    e.preventDefault();
    const [dq, dr] = DIRS[idx[e.key] % 6];
    const n = cells.get(key(c.q + dq, c.r + dr));
    if (!n) return;
    if (!route.length) { n.el.focus(); }
    else tryExtend(n), n.el.focus();
  } else if (e.key === "Backspace" && route.length) { route.pop(); paintAll(); }
}

// ---------- fog drift (two-phase: warn → close in) ----------
function fogTick() {
  if (!playing) return;
  // clear old warnings that never converted (safety)
  for (const c of cells.values()) c.warn = false;
  // pick next fog targets: neighbors of current fog, non-depot, non-house-kept
  const candidates = new Map();
  for (const f of fogCells) for (const n of neighbors(f))
    if (!n.depot && !n.fog && !route.includes(n)) candidates.set(key(n.q, n.r), n);
  const picks = [...candidates.values()].sort(() => Math.random() - 0.5).slice(0, 4);
  // drift: release ~half the old fog, keep count ~6
  const keep = fogCells.sort(() => Math.random() - 0.5).slice(0, 3);
  for (const f of fogCells) if (!keep.includes(f)) f.fog = false;
  fogCells = [...keep];
  for (const p of picks) p.warn = true;
  paintAll();
  if (picks.length) toast("🌫 fog shifting…", 1100), beep(220, 0.15, "sine", 0.04);
  setTimeout(() => {
    for (const p of picks) {
      p.warn = false;
      if (!playing) continue;
      p.fog = true; fogCells.push(p);
      if (p.house) { p.house = 0; spawnHouse(); }
      // trim live route at fog
      const i = route.indexOf(p);
      if (i >= 0) { route = route.slice(0, i); toast("fog ate your route!"); }
    }
    if (playing) paintAll();
  }, 1300);
}

// ---------- timer ----------
function tick() {
  timeLeft = Math.max(0, +(timeLeft - 0.1).toFixed(2));
  clockEl.textContent = Math.ceil(timeLeft);
  timebarFill.style.width = `${(timeLeft / 30) * 100}%`;
  document.querySelector(".time-stat").classList.toggle("urgent", timeLeft <= 5.5);
  if (timeLeft <= 5.5 && Math.abs(timeLeft * 10 % 10) < 0.01) beep(980, 0.05, "square", 0.03);
  if (timeLeft <= 0) endGame();
}
function startGame() {
  resetRound();
  overlay.classList.add("hidden");
  playing = true;
  clearInterval(timerId); clearInterval(fogId);
  timerId = setInterval(tick, 100);
  fogId = setInterval(fogTick, 4000);
  setTimeout(fogTick, 2500);
  toast("drag from ★ to a 📦 — go!");
  cells.get("0,0").el.focus({ preventScroll: true });
}
function endGame() {
  playing = false; dragging = false; route = [];
  clearInterval(timerId); clearInterval(fogId);
  paintAll();
  const best = +(localStorage.getItem("wg-best") || 0);
  const isBest = score > best;
  if (isBest) localStorage.setItem("wg-best", score);
  bestEl.textContent = localStorage.getItem("wg-best");
  $("#ovKicker").textContent = isBest ? "★ new all-time best ★" : "route day complete";
  $("#ovTitle").innerHTML = `Score ${score}<br />${delivered} parcel${delivered === 1 ? "" : "s"}`;
  $("#ovBody").innerHTML = isBest
    ? `You beat your best of <b>${best}</b>! Log it on the daily board.`
    : `Best ever: <b>${Math.max(best, score)}</b>. Daily seed <b>${SEED}</b> — one grid, everyone rivals.`;
  $("#startBtn").textContent = "↻ Run it back (30s)";
  overlay.classList.remove("hidden");
  renderBoard(true);
  if (!loggedThisRound) scoreForm.hidden = false;
  beep(523, 0.1); setTimeout(() => beep(659, 0.1), 120); setTimeout(() => beep(784, 0.2), 240);
}

// ---------- daily leaderboard (seeded bots + local players) ----------
const BOTS = ["ZIGGY", "DOT", "SQUIG", "TRI-BE", "NEON", "GRIDMOM"];
function botScores() {
  const r = mulberry32(hashStr("bots" + SEED));
  return BOTS.slice(0, 5).map((n) => ({ name: n, score: 55 + Math.floor(r() * 130), bot: true }))
    .sort((a, b) => b.score - a.score);
}
function playerScores() {
  try { return JSON.parse(localStorage.getItem("wg-lb-" + SEED) || "[]"); }
  catch { return []; }
}
function renderBoard(highlightMe = false) {
  const rows = [...botScores(), ...playerScores()].sort((a, b) => b.score - a.score).slice(0, 7);
  boardList.innerHTML = "";
  if (!rows.length) boardList.innerHTML = "<li><span>no runs yet</span><span class='pts'>—</span></li>";
  for (const r of rows) {
    const li = document.createElement("li");
    if (highlightMe && r.me) li.classList.add("me");
    const nm = document.createElement("span"); nm.textContent = `${r.bot ? "🤖 " : "🧍 "}${r.name}`;
    const pts = document.createElement("span"); pts.className = "pts"; pts.textContent = r.score;
    li.append(nm, pts); boardList.append(li);
  }
}
scoreForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = (nameInput.value || "ROOKIE").toUpperCase().slice(0, 10);
  const arr = playerScores(); arr.push({ name, score, me: true });
  localStorage.setItem("wg-lb-" + SEED, JSON.stringify(arr));
  loggedThisRound = true; scoreForm.hidden = true; nameInput.value = "";
  renderBoard(true); toast("logged! daily rivals beware");
});

// ---------- confetti ----------
function confettiBurst(svgX, svgY) {
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const layer = $("#confetti");
  const rect = board.getBoundingClientRect();
  const x = rect.left + (svgX / 640) * rect.width, y = rect.top + (svgY / 600) * rect.height;
  const colors = ["#FF3E8A", "#00D2C6", "#FFD02F", "#7B5CFF", "#FF6B35"];
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("i");
    s.textContent = ["▲", "●", "◆", "✚"][i % 4];
    s.style.cssText = `left:${x}px;color:${colors[i % 5]};font-size:${10 + Math.random() * 14}px;
      transform:translate(${(Math.random() - .5) * 160}px,0);animation-duration:${0.9 + Math.random()}s`;
    layer.append(s); setTimeout(() => s.remove(), 2000);
  }
}

// ---------- wire up ----------
$("#startBtn").addEventListener("click", startGame);
$("#restartBtn").addEventListener("click", () => {
  localStorage.setItem("wg-reshuffle", String(Date.now() % 100000));
  rng = mulberry32(hashStr("wg" + SEED + localStorage.getItem("wg-reshuffle")));
  if (playing) { startGame(); } else { resetRound(); toast("fresh grid, same seed"); }
});
buildBoard();
resetRound();
