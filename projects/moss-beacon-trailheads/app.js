// Moss Beacon Trailheads — walk to paint moss, link beacons, outpace fog. Daily seeded map.
const N = 11;
const BEACONS = 5;
const TIME_LIMIT = 150;
const FOG_MS = 22000;      // idle moss withers after ~22s
const ROUTE_MS = 45000;    // route tiles hold ~45s
const TICK = 500;

const $ = (id) => document.getElementById(id);
const board = $("board"), mist = $("mist"), frame = $("boardFrame");
const mctx = mist.getContext("2d");

const key = (r, c) => r * N + c;
const rc = (k) => [Math.floor(k / N), k % N];

/* --- seeded rng --- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const todaySeed = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* --- state --- */
let seed = todaySeed();
let rng = null;
let player = 0;
let beacons = [];
let lit = new Set();
let claimed = new Map();   // tileKey -> timestamp
let routeTiles = new Set();
let links = 0;             // connected lit-beacon pairs
let combo = 1;
let score = 0;
let timeLeft = TIME_LIMIT;
let over = false;
let won = false;
let walking = false;
let lastTick = performance.now();
let wind = 0;              // scroll-driven wind, decays to 0
let lastScrollY = window.scrollY;

/* --- map gen --- */
function genMap(s) {
  const seedFn = xmur3(s);
  rng = mulberry32(seedFn());
  const spots = new Set();
  const start = key(Math.floor(N / 2), Math.floor(N / 2));
  spots.add(start);
  beacons = [];
  let guard = 0;
  while (beacons.length < BEACONS && guard++ < 2000) {
    const r = Math.floor(rng() * N), c = Math.floor(rng() * N);
    const k = key(r, c);
    if (spots.has(k)) continue;
    // keep beacons spread: min manhattan distance 4 from each other
    if (beacons.some((b) => { const [br, bc] = rc(b); return Math.abs(br - r) + Math.abs(bc - c) < 4; })) continue;
    if (Math.abs(r - N / 2) + Math.abs(c - N / 2) < 3 && beacons.length > 0) continue;
    spots.add(k);
    beacons.push(k);
  }
  player = start;
}

/* --- board dom --- */
const tiles = [];
function buildBoard() {
  board.innerHTML = "";
  tiles.length = 0;
  board.style.gridTemplateColumns = `repeat(${N},1fr)`;
  for (let k = 0; k < N * N; k++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile fog";
    b.dataset.k = String(k);
    b.setAttribute("role", "gridcell");
    b.setAttribute("aria-label", `tile ${k}`);
    b.addEventListener("click", () => walkTo(k));
    board.appendChild(b);
    tiles.push(b);
  }
  sizeMist();
}

function sizeMist() {
  const r = board.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  mist.width = Math.max(1, Math.round(r.width * dpr));
  mist.height = Math.max(1, Math.round(r.height * dpr));
}

/* --- movement --- */
const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
function step(dr, dc) {
  if (over || walking) return;
  const [r, c] = rc(player);
  const nr = Math.min(N - 1, Math.max(0, r + dr));
  const nc = Math.min(N - 1, Math.max(0, c + dc));
  if (nr === r && nc === c) return;
  moveTo(key(nr, nc));
}

function bfsPath(from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, -1]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    const [r, c] = rc(cur);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      const nk = key(nr, nc);
      if (prev.has(nk)) continue;
      prev.set(nk, cur);
      if (nk === to) {
        const path = [to];
        let p = cur;
        while (p !== -1) { path.unshift(p); p = prev.get(p); }
        return path;
      }
      q.push(nk);
    }
  }
  return [from];
}

function walkTo(target) {
  if (over || walking || target === player) return;
  const path = bfsPath(player, target);
  if (path.length < 2) return;
  walking = true;
  let i = 1;
  const hop = () => {
    if (over || i >= path.length) { walking = false; return; }
    moveTo(path[i++]);
    setTimeout(hop, 85);
  };
  hop();
}

function moveTo(k) {
  player = k;
  claim(k);
  if (beacons.includes(k) && !lit.has(k)) {
    lit.add(k);
    showBanner(lit.size >= BEACONS ? "全灯 — all beacons wake" : `灯 ${lit.size} — beacon lights`);
  }
  recomputeRoutes();
  render();
  checkWin();
}

/* --- moss + fog --- */
function claim(k) {
  claimed.set(k, performance.now());
}

function fogTick(now) {
  let changed = false;
  for (const [k, t] of claimed) {
    const limit = routeTiles.has(k) ? ROUTE_MS : FOG_MS;
    // brisk scrolling stirs wind that slows the fog's appetite
    const windShelter = Math.min(9000, Math.abs(wind) * 900);
    if (now - t > limit + windShelter) { claimed.delete(k); changed = true; }
  }
  if (changed) { recomputeRoutes(); render(); }
}

/* --- beacon linking via claimed-tile connectivity --- */
function connectedNetwork() {
  // BFS over claimed tiles from each lit beacon
  const seen = new Set();
  const q = [];
  for (const b of lit) {
    if (claimed.has(b)) { seen.add(b); q.push(b); }
  }
  while (q.length) {
    const cur = q.shift();
    const [r, c] = rc(cur);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      const nk = key(nr, nc);
      if (seen.has(nk) || !claimed.has(nk)) continue;
      seen.add(nk);
      q.push(nk);
    }
  }
  return seen;
}

function shortestPathOnMoss(a, b, net) {
  const prev = new Map([[a, -1]]);
  const q = [a];
  while (q.length) {
    const cur = q.shift();
    if (cur === b) break;
    const [r, c] = rc(cur);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      const nk = key(nr, nc);
      if (prev.has(nk) || !net.has(nk)) continue;
      prev.set(nk, cur);
      q.push(nk);
    }
  }
  if (!prev.has(b)) return [];
  const path = [b];
  let p = prev.get(b);
  while (p !== -1) { path.unshift(p); p = prev.get(p); }
  return path;
}

function recomputeRoutes() {
  const net = connectedNetwork();
  routeTiles = new Set();
  const litInNet = [...lit].filter((b) => net.has(b));
  let pairs = 0;
  for (let i = 0; i < litInNet.length; i++) {
    for (let j = i + 1; j < litInNet.length; j++) {
      const p = shortestPathOnMoss(litInNet[i], litInNet[j], net);
      if (p.length) { pairs++; p.forEach((k) => routeTiles.add(k)); }
    }
  }
  const before = links;
  links = pairs;
  combo = 1 + litInNet.length;
  if (pairs > before && before >= 0 && litInNet.length >= 2) {
    showBanner(`結び — route linked ×${combo}`);
  }
  // score: moss tiles + 50 per linked pair × combo + lit bonus
  score = claimed.size + links * 50 * combo + lit.size * 25 + (won ? Math.round(timeLeft) * 5 : 0);
}

/* --- render --- */
function render() {
  const now = performance.now();
  for (let k = 0; k < N * N; k++) {
    const el = tiles[k];
    const isMoss = claimed.has(k);
    const age = isMoss ? now - claimed.get(k) : 0;
    el.classList.toggle("moss", isMoss);
    el.classList.toggle("fog", !isMoss);
    el.classList.toggle("old", isMoss && age > (routeTiles.has(k) ? ROUTE_MS : FOG_MS) * 0.6);
    el.classList.toggle("route", routeTiles.has(k));
    el.classList.toggle("beacon", beacons.includes(k));
    el.classList.toggle("lit", lit.has(k));
    el.classList.toggle("you", k === player);
    el.setAttribute("aria-label", `tile ${k}${k === player ? ", you" : ""}${beacons.includes(k) ? (lit.has(k) ? ", lit beacon" : ", beacon") : ""}${isMoss ? ", moss" : ", fog"}`);
  }
  $("score").textContent = String(score);
  $("statTiles").textContent = String(claimed.size);
  $("statBeacons").textContent = `${lit.size} / ${BEACONS}`;
  $("statLinks").textContent = String(links);
  $("statCombo").textContent = `×${combo}`;
  const fogEl = $("statFog");
  const w = Math.abs(wind);
  fogEl.textContent = over ? "settled" : w > 2.2 ? "scattered by wind" : w > 0.8 ? "restless" : "hungry";
  $("best").textContent = `best (this seed): ${bestFor(seed)}`;
  const t = Math.max(0, Math.ceil(timeLeft));
  const timer = $("timer");
  timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  timer.classList.toggle("low", t <= 20 && !over);
}

let bannerTimer = 0;
function showBanner(text) {
  const b = $("banner");
  b.textContent = text;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove("show"), 1900);
}

/* --- win / lose --- */
function bestFor(s) {
  try { return Number(localStorage.getItem(`mbt-best-${s}`) || 0); } catch { return 0; }
}
function saveBest() {
  try {
    if (score > bestFor(seed)) localStorage.setItem(`mbt-best-${seed}`, String(score));
  } catch { /* private mode */ }
}

function checkWin() {
  if (over || lit.size < BEACONS) return;
  const net = connectedNetwork();
  if (beacons.every((b) => net.has(b))) {
    won = true;
    finish(true);
    showBanner("全結び — the grand linking");
  }
}

function finish(win) {
  over = true;
  won = win;
  recomputeRoutes();
  saveBest();
  const h = $("hanko");
  h.textContent = win ? "踏破" : "霧没";
  h.classList.toggle("won", win);
  showBanner(win ? `踏破 ${score} stones — mountain crossed` : `霧没 ${score} stones — fog keeps the rest`);
  render();
}

/* --- new game --- */
function newGame(s) {
  seed = (s || "").trim() || todaySeed();
  genMap(seed);
  lit = new Set();
  claimed = new Map();
  routeTiles = new Set();
  links = 0; combo = 1; score = 0;
  timeLeft = TIME_LIMIT;
  over = false; won = false; walking = false;
  lastTick = performance.now();
  $("hanko").textContent = "未踏";
  $("hanko").classList.remove("won");
  $("seedLabel").textContent = `seed ${seed}`;
  $("boardSeed").textContent = `seed ${seed} · ${TIME_LIMIT / 60}:00 to link ${BEACONS}`;
  $("seedInput").value = seed;
  $("footSeed").textContent = `seed ${seed}`;
  claim(player); // start tile is moss
  recomputeRoutes();
  render();
}

/* --- input --- */
window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  const k = e.key.toLowerCase();
  const map = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };
  const dir = map[k] || map[e.key];
  if (dir) {
    e.preventDefault();
    const [dr, dc] = DIRS[dir];
    step(dr, dc);
  }
});
document.querySelectorAll(".dpad button").forEach((b) => {
  b.addEventListener("click", () => { const [dr, dc] = DIRS[b.dataset.dir]; step(dr, dc); });
});
$("seedGo").addEventListener("click", () => newGame($("seedInput").value));
$("seedInput").addEventListener("keydown", (e) => { if (e.key === "Enter") newGame($("seedInput").value); });
$("dailyBtn").addEventListener("click", () => newGame(todaySeed()));
$("randomBtn").addEventListener("click", () => newGame("wander-" + Math.floor(Math.random() * 1e6).toString(36)));
$("restartBtn").addEventListener("click", () => newGame(seed));

/* --- scroll reacts: wind, progress, reveals --- */
const threadFill = $("threadFill");
const ensoArc = $("ensoArc");
const CIRC = 97.4;
function onScroll() {
  const y = window.scrollY;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const p = Math.min(1, Math.max(0, y / max));
  document.documentElement.style.setProperty("--scroll", p.toFixed(3));
  threadFill.style.transform = `scaleX(${p})`;
  ensoArc.style.strokeDashoffset = String(CIRC * (1 - p));
  const vel = y - lastScrollY;
  lastScrollY = y;
  wind = Math.max(-6, Math.min(6, wind * 0.85 + vel * 0.02));
  const w = Math.abs(wind);
  $("windReadout").textContent = w > 2.2 ? `風 wind: strong ${wind > 0 ? "↓" : "↑"} — fog slows` : w > 0.8 ? "風 wind: breeze — fog stirs" : "風 wind: still air — fog hungers";
  // story chapters light up as you reach them
  document.querySelectorAll(".scroll-story article").forEach((a) => {
    const r = a.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.8) a.classList.add("lit");
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", sizeMist);

/* --- mist canvas: fog breathes, wind pushes it --- */
const puffs = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 0.05 + Math.random() * 0.12, s: 0.0004 + Math.random() * 0.0012, o: 0.05 + Math.random() * 0.12 }));
function drawMist() {
  const w = mist.width, h = mist.height;
  if (w > 1) {
    mctx.clearRect(0, 0, w, h);
    const fogginess = 1 - claimed.size / (N * N);
    for (const p of puffs) {
      p.x += p.s + wind * 0.0012;
      p.y += Math.sin(performance.now() / 2400 + p.r * 40) * 0.0004;
      if (p.x > 1.2) p.x = -0.2;
      if (p.x < -0.3) p.x = 1.1;
      const g = mctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, p.r * w);
      const a = Math.min(0.22, p.o * (0.35 + fogginess));
      g.addColorStop(0, `rgba(200,203,192,${a})`);
      g.addColorStop(1, "rgba(200,203,192,0)");
      mctx.fillStyle = g;
      mctx.fillRect(0, 0, w, h);
    }
  }
  requestAnimationFrame(drawMist);
}

/* --- main loop --- */
function loop(now) {
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  wind *= 0.985; // wind settles back to still air
  if (!over) {
    timeLeft -= dt;
    fogTick(now);
    if (timeLeft <= 0) { timeLeft = 0; finish(won); }
    render();
  }
  requestAnimationFrame(loop);
}

/* --- boot --- */
buildBoard();
newGame(todaySeed());
onScroll();
sizeMist();
requestAnimationFrame(drawMist);
requestAnimationFrame(loop);
setTimeout(sizeMist, 300);
