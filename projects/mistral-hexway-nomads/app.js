// Mistral Hexway Nomads — keyboard-only vaporwave hex strategy
// Paint territories (Space) | Plot caravan routes (R) | Dodge fog | Daily seed leaderboard
const COLS = 10, ROWS = 9, SIZE = 30;
const CLAIM_COST = 12, MAX_MIST = 100, RUN_SECS = 180, MAX_ROUTES = 3;
const TICK_MS = 900;

const $ = (id) => document.getElementById(id);
const svg = $("board"), focusBox = $("boardFocus");

// ---------- seeded RNG + daily seed ----------
function todaySeed() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const SEED = todaySeed();
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedFn = xmur3("mistral-hexway|" + SEED);
let rng = mulberry32(seedFn());

// ---------- audio (tiny synth, M to mute) ----------
let muted = false, actx = null;
function blip(freq = 440, dur = 0.08, type = "square", vol = 0.06) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* file:// or no audio — stay silent */ }
}

// ---------- state ----------
const S = {
  tiles: [], cursor: { c: 4, r: 4 }, score: 0, mist: 80,
  timeLeft: RUN_SECS, hauls: 0, over: false, paused: false,
  routes: [], plotting: null, // {origin:{c,r}, path:[{c,r}]}
  fogBlobs: [], wallCol: 0, wallDir: 1, fogSet: new Set(),
  stunned: new Set(), // caravan indices stunned this tick
};

const key = (c, r) => c + "," + r;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

function neighbors(c, r) {
  const even = r % 2 === 0;
  const d = even
    ? [[+1, 0], [-1, 0], [0, -1], [-1, -1], [0, +1], [-1, +1]]
    : [[+1, 0], [-1, 0], [+1, -1], [0, -1], [+1, +1], [0, +1]];
  return d.map(([dc, dr]) => ({ c: c + dc, r: r + dr })).filter((p) => inBounds(p.c, p.r));
}

function buildTiles() {
  S.tiles = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      S.tiles.push({ c, r, value: 1 + Math.floor(rng() * 3), owner: null });
}
function tileAt(c, r) { return S.tiles[r * COLS + c]; }

function initFog() {
  S.fogBlobs = [
    { c: 1 + Math.floor(rng() * 3), r: 1 + Math.floor(rng() * 3), dc: 1, dr: 1 },
    { c: 6 + Math.floor(rng() * 3), r: 5 + Math.floor(rng() * 2), dc: -1, dr: -1 },
  ];
  S.wallCol = 2 + Math.floor(rng() * 5); S.wallDir = 1;
}
function computeFog() {
  const set = new Set();
  for (const b of S.fogBlobs)
    for (const n of [{ c: b.c, r: b.r }, ...neighbors(b.c, b.r)]) set.add(key(n.c, n.r));
  for (let r = 0; r < ROWS; r++) set.add(key(S.wallCol, r));
  S.fogSet = set;
}
function driftFog() {
  for (const b of S.fogBlobs) {
    b.c += b.dc; b.r += b.dr;
    if (b.c <= 0 || b.c >= COLS - 1) { b.dc *= -1; b.c = Math.max(0, Math.min(COLS - 1, b.c)); }
    if (b.r <= 0 || b.r >= ROWS - 1) { b.dr *= -1; b.r = Math.max(0, Math.min(ROWS - 1, b.r)); }
  }
  S.wallCol += S.wallDir;
  if (S.wallCol >= COLS - 1 || S.wallCol <= 0) { S.wallDir *= -1; S.wallCol = Math.max(0, Math.min(COLS - 1, S.wallCol)); }
  computeFog();
}

// ---------- hex geometry (pointy-top, odd-r offset) ----------
const SQ3 = Math.sqrt(3);
function center(c, r) {
  const x = SQ3 * SIZE * (c + 0.5 * (r & 1)) + 40;
  const y = 1.5 * SIZE * r + 48;
  return { x, y };
}
function points(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push((cx + SIZE * 0.92 * Math.cos(a)).toFixed(1) + "," + (cy + SIZE * 0.92 * Math.sin(a)).toFixed(1));
  }
  return pts.join(" ");
}

// BFS path for caravans
function findPath(a, b) {
  const prev = new Map([[key(a.c, a.r), null]]);
  const q = [a];
  while (q.length) {
    const cur = q.shift();
    if (cur.c === b.c && cur.r === b.r) break;
    for (const n of neighbors(cur.c, cur.r)) {
      const k = key(n.c, n.r);
      if (!prev.has(k)) { prev.set(k, cur); q.push(n); }
    }
  }
  const bk = key(b.c, b.r);
  if (!prev.has(bk)) return null;
  const path = []; let cur = b;
  while (cur) { path.unshift({ c: cur.c, r: cur.r }); cur = prev.get(key(cur.c, cur.r)); }
  return path;
}

// ---------- render ----------
const NS = "http://www.w3.org/2000/svg";
let hexEls = new Map(), caravanLayer = null;

function buildBoard() {
  svg.innerHTML = "";
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `<linearGradient id="claimGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff71ce"/><stop offset=".55" stop-color="#b967ff"/><stop offset="1" stop-color="#01cdfe"/></linearGradient>`;
  svg.appendChild(defs);
  hexEls = new Map();
  for (const t of S.tiles) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "hex val" + t.value);
    g.dataset.k = key(t.c, t.r);
    const { x, y } = center(t.c, t.r);
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", points(x, y));
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", x); label.setAttribute("y", y + 4);
    label.textContent = "◆" + t.value;
    g.append(poly, label);
    g.addEventListener("click", () => { moveCursorTo(t.c, t.r); claim(); focusBox.focus(); });
    g.addEventListener("dblclick", () => toggleRoute());
    svg.appendChild(g);
    hexEls.set(key(t.c, t.r), g);
  }
  caravanLayer = document.createElementNS(NS, "g");
  caravanLayer.setAttribute("class", "caravans");
  svg.appendChild(caravanLayer);
}

function refresh() {
  const routeCells = new Set();
  for (const rt of S.routes) for (const p of rt.path) routeCells.add(key(p.c, p.r));
  if (S.plotting) for (const p of S.plotting.path) routeCells.add(key(p.c, p.r));
  for (const t of S.tiles) {
    const g = hexEls.get(key(t.c, t.r));
    if (!g) continue;
    let cls = "hex val" + t.value;
    if (t.owner) cls += " claimed";
    if (S.fogSet.has(key(t.c, t.r))) cls += " fog";
    if (routeCells.has(key(t.c, t.r))) cls += " onroute";
    if (S.cursor.c === t.c && S.cursor.r === t.r) cls += " cursor";
    if (S.plotting && S.plotting.origin.c === t.c && S.plotting.origin.r === t.r) cls += " origin";
    g.setAttribute("class", cls);
    g.querySelector("text").textContent = t.owner ? "◈" + t.value : "◆" + t.value;
  }
  // caravans
  caravanLayer.innerHTML = "";
  S.routes.forEach((rt, i) => {
    const p = rt.path[rt.caravan.idx];
    if (!p) return;
    const { x, y } = center(p.c, p.r);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "caravan" + (rt.caravan.stun > 0 ? " stunned" : ""));
    g.innerHTML = `<circle cx="${x + 12}" cy="${y - 12}" r="8" class="pulse"/><text x="${x + 12}" y="${y - 8}" text-anchor="middle" font-size="9" fill="#0d0221" font-weight="bold">C${i + 1}</text>`;
    caravanLayer.appendChild(g);
  });
  // HUD
  $("hudScore").textContent = S.score;
  $("hudMist").textContent = Math.floor(S.mist);
  $("hudTiles").textContent = S.tiles.filter((t) => t.owner).length;
  $("hudHauls").textContent = S.hauls;
  const m = Math.floor(S.timeLeft / 60), s = String(S.timeLeft % 60).padStart(2, "0");
  $("hudTime").textContent = `${m}:${s}`;
  $("routeCount").textContent = `${S.routes.length} / ${MAX_ROUTES}`;
  renderRoutes(); renderLeaders();
  const b = $("phaseBanner");
  if (S.over) b.innerHTML = "◈ run over — enter callsign & press <b>Enter</b>, or <b>N</b> for a new run";
  else if (S.paused) b.innerHTML = "⏸ paused — press <b>P</b> to resume";
  else if (S.plotting) b.innerHTML = `🐪 plotting route from <b>${S.plotting.origin.c},${S.plotting.origin.r}</b> — walk cursor & press <b>R</b> on a claimed tile · <b>C</b> cancel`;
  else b.innerHTML = "◈ cursor on board — move with arrows · <b>SPACE</b> claim · <b>R</b> route";
}

function renderRoutes() {
  const ol = $("routeList"); ol.innerHTML = "";
  if (!S.routes.length) { ol.innerHTML = `<li>no caravans yet — claim 2+ tiles, then press <kbd>R</kbd>.</li>`; return; }
  S.routes.forEach((rt, i) => {
    const li = document.createElement("li");
    li.className = rt.caravan.stun > 0 ? "" : "moving";
    li.textContent = `C${i + 1} · ${rt.path.length} hexes · ${rt.caravan.stun > 0 ? "🌫 FOG-BOUND (" + rt.caravan.stun + ")" : "✦ hauling +" + rt.path.reduce((a, p) => a + tileAt(p.c, p.r).value * 2, 0) + "/loop"}`;
    ol.appendChild(li);
  });
}

// ---------- leaderboard (daily seed, localStorage) ----------
function boardKey() { return "mhn-board-" + SEED; }
function seedBots() {
  const r = mulberry32(xmur3("bots|" + SEED)());
  const names = ["VHS", "NEO", "MIA", "EXE", "SYN", "PAL"];
  return [0, 1, 2].map((i) => ({
    name: names[Math.floor(r() * names.length)], score: 120 + Math.floor(r() * 320),
    tiles: 5 + Math.floor(r() * 14), hauls: 2 + Math.floor(r() * 10), bot: true,
  })).sort((a, b) => b.score - a.score);
}
function loadBoard() {
  try {
    const raw = localStorage.getItem(boardKey());
    if (raw) return JSON.parse(raw);
  } catch { /* private mode */ }
  const bots = seedBots();
  saveBoard(bots);
  return bots;
}
function saveBoard(list) { try { localStorage.setItem(boardKey(), JSON.stringify(list.slice(0, 10))); } catch { } }
function renderLeaders() {
  const ol = $("leaders"); const list = loadBoard();
  ol.innerHTML = "";
  const mine = S.over ? S.score : -1;
  list.slice(0, 7).forEach((e) => {
    const li = document.createElement("li");
    if (!e.bot && e.score === mine) li.className = "me";
    li.innerHTML = `<span class="nm">${escapeHtml(e.name)}</span><span>${e.score} pts · ${e.tiles}⛉</span>`;
    ol.appendChild(li);
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---------- actions ----------
let toastT = null;
function toast(msg) {
  const el = $("toast"); el.textContent = msg;
  clearTimeout(toastT); toastT = setTimeout(() => (el.textContent = ""), 2600);
}
function moveCursorTo(c, r) {
  if (S.over || S.paused) return;
  S.cursor = { c: Math.max(0, Math.min(COLS - 1, c)), r: Math.max(0, Math.min(ROWS - 1, r)) };
  if (S.plotting) {
    const last = S.plotting.path[S.plotting.path.length - 1];
    if (last.c !== c || last.r !== r) {
      // extend plotting trail only through adjacent hexes
      const adj = neighbors(last.c, last.r).some((n) => n.c === c && n.r === r)
        ? [{ c, r }]
        : findPath(last, S.cursor) || [{ c, r }];
      for (const p of adj) {
        const k = key(p.c, p.r);
        if (!S.plotting.path.some((q) => key(q.c, q.r) === k)) S.plotting.path.push(p);
      }
    }
  }
  blip(220, 0.04, "sine", 0.03);
  refresh();
}
function claim() {
  if (S.over || S.paused) return;
  const t = tileAt(S.cursor.c, S.cursor.r);
  const k = key(t.c, t.r);
  if (S.fogSet.has(k)) { toast("🌫 too foggy to claim — wait for the wall to pass"); blip(140, 0.12, "sawtooth"); return; }
  if (t.owner) { toast("already yours ◈"); return; }
  if (S.mist < CLAIM_COST) { toast(`need ${CLAIM_COST}⚡ mist — caravans earn it back`); blip(140, 0.12, "sawtooth"); return; }
  S.mist -= CLAIM_COST; t.owner = "you";
  const gain = t.value * 10;
  S.score += gain;
  toast(`◈ claimed ${t.c},${t.r} (+${gain})`);
  blip(520 + t.value * 120, 0.1, "square");
  refresh();
}
function toggleRoute() {
  if (S.over || S.paused) return;
  const cur = { ...S.cursor };
  const t = tileAt(cur.c, cur.r);
  if (!S.plotting) {
    if (!t.owner) { toast("start routes on YOUR claimed tile ◈ — claim first with SPACE"); blip(160, 0.12, "sawtooth"); return; }
    if (S.routes.length >= MAX_ROUTES) { toast(`max ${MAX_ROUTES} caravans — they haul mist for you`); return; }
    S.plotting = { origin: cur, path: [cur] };
    toast(`🐪 route origin ${cur.c},${cur.r} — walk & press R on another claimed tile`);
    blip(660, 0.1, "triangle");
  } else {
    if (cur.c === S.plotting.origin.c && cur.r === S.plotting.origin.r) { toast("walk somewhere first, then press R"); return; }
    if (!t.owner) { toast("caravans run between YOUR tiles — claim this one first"); blip(160, 0.12, "sawtooth"); return; }
    const path = findPath(S.plotting.origin, cur);
    if (!path || path.length < 2) { toast("no path found"); return; }
    S.routes.push({ path, caravan: { idx: 0, dir: 1, stun: 0 } });
    S.plotting = null;
    toast(`🐪 caravan C${S.routes.length} rolling — ${path.length} hexes`);
    blip(880, 0.14, "triangle");
  }
  refresh();
}
function cancelRoute() { if (S.plotting) { S.plotting = null; toast("route cancelled"); refresh(); } }

// ---------- tick: fog drifts, caravans haul, mist regens, clock runs ----------
function tick() {
  if (S.over || S.paused) return;
  driftFog();
  S.mist = Math.min(MAX_MIST, S.mist + 4);
  for (const rt of S.routes) {
    const c = rt.caravan;
    if (c.stun > 0) { c.stun--; continue; }
    c.idx += c.dir;
    if (c.idx >= rt.path.length - 1 || c.idx <= 0) {
      // endpoint reached → haul bonus
      const end = rt.path[c.dir > 0 ? rt.path.length - 1 : 0];
      const et = tileAt(end.c, end.r);
      if (S.fogSet.has(key(end.c, end.r))) {
        c.stun = 2; S.score = Math.max(0, S.score - 15);
        toast(`🌫 C-caravan robbed by fog (−15)`);
        blip(120, 0.2, "sawtooth");
      } else if (et.owner) {
        const bonus = et.value * 6;
        S.score += bonus; S.mist = Math.min(MAX_MIST, S.mist + 6); S.hauls++;
        blip(740, 0.09, "sine");
      }
      c.dir *= -1;
      c.idx = Math.max(0, Math.min(rt.path.length - 1, c.idx));
    } else {
      const p = rt.path[c.idx];
      const pt = tileAt(p.c, p.r);
      if (S.fogSet.has(key(p.c, p.r))) {
        c.stun = 1; S.score = Math.max(0, S.score - 15);
        toast("🌫 caravan caught in fog (−15)");
        blip(120, 0.2, "sawtooth");
      } else if (pt.owner) {
        const g = pt.value * 2;
        S.score += g; S.mist = Math.min(MAX_MIST, S.mist + 1);
      }
    }
  }
  S.timeLeft--;
  if (S.timeLeft <= 0) { S.timeLeft = 0; gameOver(); }
  refresh();
}

function gameOver() {
  S.over = true; S.plotting = null;
  blip(330, 0.3, "triangle"); setTimeout(() => blip(220, 0.4, "triangle"), 200);
  const tiles = S.tiles.filter((t) => t.owner).length;
  $("finalLine").textContent = `Score ${S.score} · ${tiles} tiles · ${S.hauls} hauls · seed ${SEED}`;
  $("overModal").hidden = false;
  setTimeout(() => $("initials").focus(), 50);
  refresh();
}
function saveScore() {
  const name = ($("initials").value || "NOM").toUpperCase().slice(0, 3).padEnd(3, "·");
  const list = loadBoard();
  list.push({ name, score: S.score, tiles: S.tiles.filter((t) => t.owner).length, hauls: S.hauls });
  list.sort((a, b) => b.score - a.score);
  saveBoard(list);
  $("overModal").hidden = true;
  toast(`🏆 saved ${name} — ${S.score} pts on ${SEED}`);
  blip(990, 0.15, "square");
  refresh();
  focusBox.focus();
}
function restart() {
  rng = mulberry32(seedFn());
  Object.assign(S, {
    cursor: { c: 4, r: 4 }, score: 0, mist: 80, timeLeft: RUN_SECS,
    hauls: 0, over: false, paused: false, routes: [], plotting: null,
  });
  buildTiles(); initFog(); computeFog();
  $("overModal").hidden = true;
  toast(`◈ new run — seed ${SEED}`);
  refresh(); focusBox.focus();
}

// ---------- keyboard (the whole game lives here) ----------
document.addEventListener("keydown", (e) => {
  // modal typing: only Enter/Escape escape the input
  if (!$("overModal").hidden) {
    if (e.key === "Enter") { e.preventDefault(); saveScore(); }
    else if (e.key === "n" || e.key === "N") restart();
    else if (e.key === "Escape") { $("overModal").hidden = true; focusBox.focus(); }
    return; // let letters go to the input
  }
  const k = e.key;
  const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k]
    || { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] }[k];
  if (mv) { e.preventDefault(); moveCursorTo(S.cursor.c + mv[0], S.cursor.r + mv[1]); return; }
  if (k === " " || k === "Enter") { e.preventDefault(); claim(); }
  else if (k === "r" || k === "R") toggleRoute();
  else if (k === "c" || k === "C" || k === "x" || k === "X") cancelRoute();
  else if (k === "Escape") { if (S.plotting) cancelRoute(); }
  else if (k === "p" || k === "P") { S.paused = !S.paused; toast(S.paused ? "⏸ paused" : "▶ rolling"); refresh(); }
  else if (k === "n" || k === "N") restart();
  else if (k === "m" || k === "M") { muted = !muted; toast(muted ? "🔇 muted" : "🔊 sound on"); }
  else if (k === "h" || k === "H" || k === "?") $("helpCard").classList.toggle("hidden");
});

// buttons mirror keys (mouse optional, keyboard sufficient)
$("btnPause").addEventListener("click", () => { S.paused = !S.paused; refresh(); focusBox.focus(); });
$("btnRestart").addEventListener("click", restart);
$("btnHelp").addEventListener("click", () => $("helpCard").classList.toggle("hidden"));
$("btnSave").addEventListener("click", saveScore);
$("btnAgain").addEventListener("click", restart);

// ---------- boot ----------
$("seedLabel").textContent = "SEED " + SEED;
$("boardSeed").textContent = SEED;
buildTiles(); initFog(); computeFog(); buildBoard(); refresh();
setInterval(tick, TICK_MS);
focusBox.focus();
console.log("mistral-hexway-nomads ready", { seed: SEED, cols: COLS, rows: ROWS });
