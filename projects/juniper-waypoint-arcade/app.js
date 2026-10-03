/* Juniper Waypoint Arcade — hex capture + daily maps + route combos + local leaderboard */
"use strict";
const $ = (id) => document.getElementById(id);
const grid = $("grid"), scoreEl = $("score"), clockEl = $("clock"), gapEl = $("gap"),
  tilesEl = $("tiles"), bestEl = $("best"), pctEl = $("pct"), mapCodeEl = $("mapCode"),
  mapDateEl = $("mapDate"), leadersEl = $("leaders"), toastEl = $("toast"),
  routeLabel = $("routeLabel"), bankBtn = $("bankBtn"), clearRoute = $("clearRoute");

const LS_KEY = "jwa-board-v1";
const GAME_LEN = 90, COLS = 10, ROWS = 9;
const W = 62, H = 54; // flat-top hex spacing

let S; // state
function todayStr(d = new Date()) { return d.toISOString().slice(0, 10); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const key = (q, r) => q + "," + r;
const neighbors = (q, r) => {
  const off = (r % 2 === 1) ? [[1,0],[-1,0],[1,-1],[0,-1],[1,1],[0,1]] : [[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]];
  return off.map(([dq, dr]) => [q + dq, r + dr]).filter(([qq, rr]) => qq >= 0 && rr >= 0 && qq < COLS && rr < ROWS);
};
const center = (q, r) => {
  const x = W * (q + 0.5 * (r & 1)) + 34, y = H * r * 0.88 + 32;
  return [x, y];
};
const hexPts = (cx, cy, s = 27) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 3 * i + Math.PI / 6;
  return (cx + s * Math.cos(a)).toFixed(1) + "," + (cy + s * Math.sin(a)).toFixed(1);
}).join(" ");

function newGame(dateStr) {
  const seed = hashStr("JWA-" + dateStr);
  const rnd = mulberry32(seed);
  const cells = new Map();
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const edge = (q === 0 || r === 0 || q === COLS - 1 || r === ROWS - 1);
    const isVoid = rnd() < (edge ? 0.06 : 0.13);
    cells.set(key(q, r), { q, r, owner: isVoid ? "void" : null, way: false });
  }
  // waypoints: 6 spread
  let placed = 0, guard = 0;
  while (placed < 6 && guard++ < 500) {
    const q = 1 + Math.floor(rnd() * (COLS - 2)), r = 1 + Math.floor(rnd() * (ROWS - 2));
    const c = cells.get(key(q, r));
    if (c.owner === "void" || c.way) continue;
    c.way = true; placed++;
  }
  // starting turf: player bottom-left, rivals top corners
  const claim = (q, r, o) => { const c = cells.get(key(q, r)); if (c && c.owner !== "void") c.owner = o; };
  claim(1, ROWS - 2, "me"); claim(1, ROWS - 1, "me"); claim(2, ROWS - 1, "me");
  claim(COLS - 2, 0, "foe"); claim(COLS - 1, 0, "foe"); claim(COLS - 1, 1, "foe");
  claim(0, 0, "foe"); claim(1, 0, "foe"); claim(0, 1, "foe");
  // make starts non-void
  return {
    date: dateStr, seed, cells, mode: "claim", route: [], score: 0, tiles: 3, best: 0,
    t: GAME_LEN, over: false, moves: 3, scope: S ? S.scope : "map", rivalTick: 0
  };
}

function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toast._h); toast._h = setTimeout(() => toastEl.classList.remove("show"), 1400); }

function render() {
  mapCodeEl.textContent = "JWA-" + S.date.replaceAll("-", "");
  mapDateEl.textContent = S.date + " · #" + (S.seed % 10000);
  scoreEl.textContent = S.score; clockEl.textContent = S.t;
  clockEl.parentElement.style.outline = S.t <= 10 ? "4px solid #FF4D00" : "none";
  tilesEl.textContent = countOwner("me"); bestEl.textContent = S.best;
  const free = [...S.cells.values()].filter(c => c.owner !== "void").length;
  pctEl.textContent = Math.round(countOwner("me") / free * 100) + "%";
  // gap to leader
  const lb = loadLB().filter(e => S.scope === "all" || e.map === S.date);
  const top = lb.length ? lb[0].score : 0;
  gapEl.textContent = S.score >= top && top > 0 ? "LEAD +" + (S.score - top) : (top ? (top - S.score) + " BEHIND #1" : "NO RIVAL YET");
  // route readout
  if (!S.route.length) routeLabel.textContent = "ROUTE: — pick ROUTE mode, tap your tiles";
  else {
    const s = previewScore(S.route);
    routeLabel.textContent = `ROUTE: ${S.route.length} tiles → ${s.total} pts${s.loop ? " · LOOP ×2" : ""}${s.mult > 1 ? " · ×" + s.mult : ""} (${s.ways} waypoint${s.ways === 1 ? "" : "s"})`;
  }
  bankBtn.disabled = clearRoute.disabled = S.route.length < 3 || S.over;
  drawGrid();
  drawLeaders();
}

function countOwner(o) { let n = 0; for (const c of S.cells.values()) if (c.owner === o) n++; return n; }

function drawGrid() {
  const myFrontier = new Set();
  for (const c of S.cells.values()) if (c.owner === "me")
    for (const [qq, rr] of neighbors(c.q, c.r)) { const n = S.cells.get(key(qq, rr)); if (n && !n.owner && n.owner !== "void") myFrontier.add(key(qq, rr)); }
  let html = "";
  for (const c of S.cells.values()) {
    const [cx, cy] = center(c.q, c.r);
    let cls = c.owner === "me" ? "me" : c.owner === "foe" ? "foe" : c.owner === "void" ? "void" : "free";
    if (c.way) cls += " way";
    if (S.route.some(([q, r]) => q === c.q && r === c.r)) cls += " inroute";
    if (S.mode === "claim" && !S.over && (myFrontier.has(key(c.q, c.r)) || (S.moves > 0 && !c.owner))) cls += " hint";
    html += `<polygon data-q="${c.q}" data-r="${c.r}" class="${cls}" points="${hexPts(cx, cy)}"/>`;
    if (c.way) html += `<text x="${cx}" y="${cy}">★</text>`;
    else if (c.owner === "void") html += `<text x="${cx}" y="${cy}" fill="#FFFEF5">✕</text>`;
  }
  grid.innerHTML = html;
}

grid.addEventListener("click", (e) => {
  const p = e.target.closest("polygon"); if (!p || S.over) return;
  const q = +p.dataset.q, r = +p.dataset.r;
  if (S.mode === "claim") doClaim(q, r, p); else doRoute(q, r, p);
});

function doClaim(q, r, el) {
  const c = S.cells.get(key(q, r));
  if (!c || c.owner) { if (c && c.owner === "void") toast("VOID — blocked today"); return; }
  const adjacent = neighbors(q, r).some(([qq, rr]) => S.cells.get(key(qq, rr))?.owner === "me");
  if (S.moves > 0 || adjacent) {
    c.owner = "me"; S.moves = Math.max(0, S.moves - (adjacent ? 0 : 1));
    S.score += c.way ? 25 : 5; S.tiles++;
    el.classList.add("pop");
    if (c.way) toast("WAYPOINT CLAIMED +25");
    render();
  } else toast("CLAIM BESIDE YOUR ACID TURF");
}

function doRoute(q, r) {
  const c = S.cells.get(key(q, r));
  if (!c || c.owner !== "me") { toast("ROUTE USES YOUR TILES ONLY"); return; }
  const last = S.route[S.route.length - 1];
  if (last && last[0] === q && last[1] === r) { S.route.pop(); render(); return; } // tap again to undo
  if (S.route.some(([qq, rr]) => qq === q && rr === r)) { toast("TILE ALREADY IN ROUTE"); return; }
  if (last) {
    const adj = neighbors(last[0], last[1]).some(([qq, rr]) => qq === q && rr === r);
    if (!adj) { toast("MUST CHAIN NEIGHBORS"); return; }
  }
  S.route.push([q, r]); render();
}

function previewScore(route) {
  const s = scoreRoute(route);
  return { total: s.pts, loop: s.loop, mult: s.mult, ways: s.ways };
}
function scoreRoute(route) {
  const ways = route.filter(([q, r]) => S.cells.get(key(q, r))?.way).length;
  let pts = route.length * 10 + ways * 50;
  const [fq, fr] = route[0], [lq, lr] = route[route.length - 1];
  const loop = route.length >= 4 && neighbors(lq, lr).some(([qq, rr]) => qq === fq && rr === fr);
  if (loop) pts *= 2;
  const mult = route.length >= 9 ? 3 : route.length >= 6 ? 2 : 1;
  return { pts: pts * mult, loop, mult, ways };
}

function bank() {
  if (S.route.length < 3) return;
  const { pts, loop, mult, ways } = scoreRoute(S.route);
  S.score += pts; S.best = Math.max(S.best, pts);
  toast(`COMBO BANKED +${pts}${loop ? " LOOP!" : ""}${mult > 1 ? " ×" + mult : ""}${ways ? " ★" + ways : ""}`);
  S.route = []; render();
}
bankBtn.onclick = bank;
clearRoute.onclick = () => { S.route = []; render(); };

function rivalMove() {
  // each foe cluster expands once
  const empt = [...S.cells.values()].filter(c => !c.owner);
  if (!empt.length) return;
  // pick up to 2 random frontier claims
  for (let k = 0; k < 2; k++) {
    const frontier = empt.filter(c => neighbors(c.q, c.r).some(([qq, rr]) => S.cells.get(key(qq, rr))?.owner === "foe") && !c.owner);
    if (!frontier.length) break;
    // prefer waypoints
    frontier.sort((a, b) => (b.way - a.way) || Math.random() - 0.5);
    frontier[0].owner = "foe";
    const i = empt.indexOf(frontier[0]); if (i > -1) empt.splice(i, 1);
  }
}

// modes
$("modeClaim").onclick = () => setMode("claim");
$("modeRoute").onclick = () => setMode("route");
function setMode(m) {
  S.mode = m;
  $("modeClaim").classList.toggle("active", m === "claim");
  $("modeRoute").classList.toggle("active", m === "route");
  $("modeClaim").setAttribute("aria-pressed", m === "claim");
  $("modeRoute").setAttribute("aria-pressed", m === "route");
  render();
}

// leaderboard
function loadLB() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function drawLeaders() {
  const all = loadLB().sort((a, b) => b.score - a.score);
  const list = (S.scope === "all" ? all : all.filter(e => e.map === S.date)).slice(0, 8);
  $("scopeBtn").textContent = S.scope === "all" ? "ALL ▾" : "MAP ▾";
  leadersEl.innerHTML = list.length ? list.map((e, i) =>
    `<li><span class="rk">${i + 1}</span><span>${escapeHtml(e.name)}</span><span style="margin-left:auto">${e.score} PTS · ${e.combo}</span></li>`).join("")
    : `<li><span class="rk">–</span><span>No scores yet — be the first legend.</span></li>`;
}
$("scopeBtn").onclick = () => { S.scope = S.scope === "all" ? "map" : "all"; render(); };
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

$("saveForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = ($("pilot").value.trim() || "JUNI").toUpperCase().slice(0, 10);
  const lb = loadLB();
  lb.push({ name, score: S.score, tiles: countOwner("me"), combo: S.best, map: S.date, at: Date.now() });
  localStorage.setItem(LS_KEY, JSON.stringify(lb.sort((a, b) => b.score - a.score).slice(0, 50)));
  $("saveForm").classList.add("hidden"); toast("SAVED TO LEADERBOARD"); render();
});

// controls
const picker = $("dayPicker");
function start(dateStr) {
  clearInterval(start._t);
  S = newGame(dateStr);
  picker.value = dateStr;
  $("saveForm").classList.add("hidden"); $("over").classList.add("hidden");
  setMode("claim"); render();
  start._t = setInterval(() => {
    if (S.over) return;
    S.t--;
    if (S.t % 1 === 0) rivalMove();
    if (S.t <= 0) { S.t = 0; gameOver(); }
    render();
  }, 1000);
}
function gameOver() {
  S.over = true;
  $("overMap").textContent = S.date;
  $("overScore").textContent = S.score + " PTS";
  $("overDetail").textContent = `${countOwner("me")} tiles · best combo ${S.best} · map JWA-${S.date.replaceAll("-", "")}`;
  $("over").classList.remove("hidden");
  $("saveForm").classList.remove("hidden");
  $("finalLine").textContent = `FINAL: ${S.score} PTS — sign it, pilot.`;
  render();
}
$("againBtn").onclick = () => start(S.date);
$("dismissBtn").onclick = () => $("over").classList.add("hidden");
$("restartBtn").onclick = () => start(picker.value || todayStr());
$("todayBtn").onclick = () => start(todayStr());
$("shiftBtn").onclick = () => { // random daily-style shift
  const d = new Date((picker.value || todayStr()) + "T12:00:00");
  d.setDate(d.getDate() + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 6)));
  start(d.toISOString().slice(0, 10));
};
picker.addEventListener("change", () => picker.value && start(picker.value));

// seed demo scores so first visit isn't empty (only once)
if (!localStorage.getItem(LS_KEY)) {
  const d = todayStr();
  localStorage.setItem(LS_KEY, JSON.stringify([
    { name: "JUNI", score: 420, tiles: 22, combo: 180, map: d, at: Date.now() - 9000 },
    { name: "RIVAL-7", score: 350, tiles: 25, combo: 120, map: d, at: Date.now() - 8000 },
    { name: "HEXER", score: 210, tiles: 14, combo: 90, map: d, at: Date.now() - 7000 }
  ]));
}
start(todayStr());
