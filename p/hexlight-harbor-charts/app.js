// Hexlight Harbor Charts — cyberpunk hex strategy.
// daily seed -> procedural islands -> click-to-claim vs Vanta Corp -> route scoring -> tide reset.
'use strict';

const CY = '#00F0FF', MG = '#FF2E88', GD = '#FFC857';
const R = 4;                 // hex radius -> 91 cells
const ENERGY_MAX = 14;
const NS = 'http://www.w3.org/2000/svg';

// ---------- seeded rng ----------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const todaySeed = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- state ----------
let SEED = todaySeed();
let DEMO = false;
let rng = null;
let cells = new Map();       // key "q,r" -> cell
let energy = ENERGY_MAX, score = 0, best = 0;
let mode = 'claim';
let route = [];              // array of keys
let over = false;
let krakenDone = false;

const $ = (id) => document.getElementById(id);
const board = $('board'), logEl = $('log');
const key = (q, r) => `${q},${r}`;
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const neighbors = (q, r) => DIRS.map(([dq, dr]) => key(q + dq, r + dr)).filter((k) => cells.has(k));

// ---------- island generation ----------
function genIslands(seed) {
  const seedFn = xmur3(seed);
  rng = mulberry32(seedFn());
  // value-noise lattice
  const G = 6, lat = [];
  for (let i = 0; i < G * G; i++) lat.push(rng());
  const noise = (x, y) => {
    const gx = (x + 1) / 2 * (G - 1), gy = (y + 1) / 2 * (G - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, G - 1), y1 = Math.min(y0 + 1, G - 1);
    const fx = gx - x0, fy = gy - y0;
    const a = lat[y0 * G + x0], b = lat[y0 * G + x1], c = lat[y1 * G + x0], d = lat[y1 * G + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  cells = new Map();
  for (let q = -R; q <= R; q++) {
    for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
      const x = (q - r) / (R * 1.6), y = (q + r) / (R * 1.9);
      const dist = Math.sqrt(x * x + y * y);
      const h = noise(x, y) * 0.75 + (0.62 - dist * 0.85) + (rng() - 0.5) * 0.12;
      let type = 'water';
      if (h > 0.78) type = 'reef';
      else if (h > 0.60) type = 'land';
      else if (h > 0.50) type = 'sand';
      else if (h > 0.44 && rng() < 0.25) type = 'reef';
      const cell = { q, r, type, owner: null, value: 0, port: false };
      if (type === 'land') cell.value = 2 + Math.floor(rng() * 4);       // 2..5
      if (type === 'sand') cell.value = 1 + Math.floor(rng() * 2);       // 1..2
      cells.set(key(q, r), cell);
    }
  }
  // ports: up to 3 land cells adjacent to water
  const candidates = [...cells.values()].filter((c) => c.type === 'land' && neighbors(c.q, c.r).some((k) => cells.get(k).type === 'water'));
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  candidates.slice(0, 3).forEach((c) => { c.port = true; c.type = 'port'; c.value = 5 + Math.floor(rng() * 3); });
  // guarantee enough claimable land
  if ([...cells.values()].filter((c) => c.type === 'land' || c.type === 'sand' || c.type === 'port').length < 20) genIslands(seed + '~');
}

// ---------- rendering ----------
const SIZE = 34, CX = 320, CY0 = 280;
const pt = (q, r) => ({ x: CX + SIZE * Math.sqrt(3) * (q + r / 2), y: CY0 + SIZE * 1.5 * r });
const corners = (x, y) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return `${(x + SIZE * 0.92 * Math.cos(a)).toFixed(1)},${(y + SIZE * 0.92 * Math.sin(a)).toFixed(1)}`; }).join(' ');

const BASE_FILL = { water: '#131A3A', sand: '#3a3a3a', land: '#1d5f66', port: '#5c4a12', reef: '#0A0D1D' };
const BASE_EDGE = { water: 'rgba(0,240,255,.28)', sand: '#6b6b6b', land: 'rgba(0,240,255,.55)', port: GD, reef: 'rgba(255,255,255,.35)' };

function render() {
  board.innerHTML = '';
  // water glow backdrop
  for (const c of cells.values()) {
    if (c.type !== 'water') continue;
    const { x, y } = pt(c.q, c.r);
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', corners(x, y));
    p.setAttribute('fill', BASE_FILL.water);
    p.setAttribute('stroke', BASE_EDGE.water);
    p.setAttribute('stroke-width', '1');
    if (c.owner === 'kraken') { p.setAttribute('fill', 'rgba(255,46,136,.35)'); }
    p.dataset.k = key(c.q, c.r);
    p.addEventListener('click', () => onHex(key(c.q, c.r)));
    board.appendChild(p);
  }
  for (const c of cells.values()) {
    if (c.type === 'water') continue;
    const { x, y } = pt(c.q, c.r);
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', corners(x, y));
    let fill = BASE_FILL[c.type], edge = BASE_EDGE[c.type];
    if (c.owner === 'you') { fill = 'rgba(0,240,255,.75)'; edge = CY; }
    if (c.owner === 'foe') { fill = 'rgba(255,46,136,.75)'; edge = MG; }
    if (c.owner === 'kraken') { fill = 'rgba(255,46,136,.5)'; edge = MG; }
    p.setAttribute('fill', fill);
    p.setAttribute('stroke', edge);
    p.setAttribute('stroke-width', c.port ? 2.5 : 1.5);
    if (route.includes(key(c.q, c.r))) { p.classList.add('picked'); p.style.color = GD; }
    if (c.owner === 'you') p.style.color = CY;
    if (c.owner === 'foe') p.style.color = MG;
    p.dataset.k = key(c.q, c.r);
    p.addEventListener('click', () => onHex(key(c.q, c.r)));
    board.appendChild(p);
    if (c.type === 'port') {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y - 8);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '15');
      t.setAttribute('class', 'hexval'); t.textContent = '◈';
      t.setAttribute('fill', GD); board.appendChild(t);
    }
    const v = document.createElementNS(NS, 'text');
    v.setAttribute('x', x); v.setAttribute('y', y + (c.type === 'port' ? 12 : 5));
    v.setAttribute('text-anchor', 'middle'); v.setAttribute('font-size', '12');
    v.setAttribute('class', 'hexval'); v.textContent = c.value;
    board.appendChild(v);
  }
  // route polyline
  if (route.length > 1) {
    const pts = route.map((k) => { const c = cells.get(k); const { x, y } = pt(c.q, c.r); return `${x},${y}`; }).join(' ');
    const pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('class', 'routeline');
    board.appendChild(pl);
  }
  updateHud();
}

function updateHud() {
  const all = [...cells.values()];
  $('youCount').textContent = all.filter((c) => c.owner === 'you').length;
  $('foeCount').textContent = all.filter((c) => c.owner === 'foe').length;
  $('score').textContent = score;
  $('best').textContent = best;
  $('energy').textContent = energy;
  $('seedLabel').textContent = (DEMO ? 'demo-' : '') + SEED;
  const hasRoute = route.length > 0;
  $('clearRoute').disabled = !hasRoute;
  $('finishRoute').disabled = route.length < 2;
  $('routeBar').classList.toggle('hidden', mode !== 'route');
  if (mode === 'route') {
    $('routeInfo').textContent = route.length === 0 ? 'pick one of YOUR hexes to start a route…' : `${route.length} hexes — extend to an adjacent hex, then COMPLETE.`;
    $('routeScore').textContent = route.length > 0 ? `≈ ${routeValue(route)} ⬢` : '';
  }
}

// ---------- gameplay ----------
const CLAIMABLE = new Set(['land', 'sand', 'port']);

function log(msg) {
  const li = document.createElement('li');
  li.innerHTML = msg;
  logEl.prepend(li);
  while (logEl.children.length > 40) logEl.lastChild.remove();
}

function onHex(k) {
  if (over) return;
  const c = cells.get(k);
  if (!c) return;
  if (mode === 'claim') doClaim(c);
  else doRouteStep(c);
}

function doClaim(c) {
  if (!CLAIMABLE.has(c.type)) { log(`<b class="g">✕</b> ${c.type} can't be claimed — chart the isles.`); return; }
  if (c.owner) { log(`<b class="g">✕</b> hex already flies ${c.owner === 'you' ? 'YOUR' : 'VANTA'} colors.`); return; }
  if (energy <= 0) { log(`<b class="g">✕</b> out of energy. run a ROUTE to score, or wait for the tide.`); return; }
  c.owner = 'you'; energy--;
  log(`<b class="y">⚓ YOU</b> claimed ${c.type}${c.port ? ' ◈PORT◈' : ''} (+${c.value})`);
  render(); save();
  if (checkEnd()) return;
  setTimeout(foeMove, 450);
}

function foeMove() {
  if (over) return;
  const open = [...cells.values()].filter((c) => CLAIMABLE.has(c.type) && !c.owner);
  if (!open.length) { checkEnd(); return; }
  // vanta prefers high value, prefers adjacency to its turf
  const foeOwned = new Set([...cells.values()].filter((c) => c.owner === 'foe').map((c) => key(c.q, c.r)));
  open.sort((a, b) => {
    const adj = (c) => neighbors(c.q, c.r).filter((k) => foeOwned.has(k)).length;
    return (b.value + adj(b) * 2) - (a.value + adj(a) * 2);
  });
  const pick = open[0];
  pick.owner = 'foe';
  log(`<b class="f">⬢ VANTA</b> seized ${pick.type}${pick.port ? ' ◈PORT◈' : ''} (+${pick.value})`);
  render(); save();
  checkEnd();
}

function doRouteStep(c) {
  if (route.length === 0) {
    if (c.owner !== 'you') { log(`<b class="g">✕</b> routes start on YOUR claimed hex.`); return; }
    route.push(key(c.q, c.r));
  } else {
    const k = key(c.q, c.r);
    if (route.includes(k)) { log(`<b class="g">✕</b> hex already in route.`); return; }
    const last = cells.get(route[route.length - 1]);
    if (!neighbors(last.q, last.r).includes(k)) { log(`<b class="g">✕</b> routes must chain adjacent hexes.`); return; }
    if (c.type === 'water' || c.type === 'reef') { log(`<b class="g">✕</b> no trade lanes through ${c.type}.`); return; }
    route.push(k);
  }
  render(); save();
}

function routeValue(rk) {
  const cels = rk.map((k) => cells.get(k));
  const sum = cels.reduce((s, c) => s + c.value * (c.port ? 2 : 1), 0);
  const ports = cels.filter((c) => c.port).length;
  return Math.round(sum * (1 + 0.25 * (rk.length - 1)) + ports * 10 + (cels.every((c) => c.owner === 'you') ? 15 : 0));
}

function finishRoute() {
  if (route.length < 2) return;
  const pts = routeValue(route);
  score += pts;
  if (score > best) { best = score; }
  log(`<b class="g">⟡ ROUTE</b> ${route.length} hexes → <b class="g">+${pts}</b> (score ${score})`);
  route = [];
  render(); save();
  checkEnd(true);
}

function ownedCount(who) { return [...cells.values()].filter((c) => c.owner === who).length; }

function checkEnd() {
  const open = [...cells.values()].some((c) => CLAIMABLE.has(c.type) && !c.owner);
  if (!open) {
    over = true;
    const y = ownedCount('you'), f = ownedCount('foe');
    const verdict = y > f ? 'HARBOR MASTER — the charts are yours.' : y < f ? 'VANTA takes the harbor. next tide, striker.' : 'DEAD HEAT on the neon water.';
    log(`<b class="g">◈ TIDE OUT ◈</b> you ${y} · vanta ${f} · score ${score}. ${verdict}`);
    return true;
  }
  return false;
}

// ---------- persistence ----------
const storeKey = () => `hexlight-${SEED}`;
function save() {
  try {
    localStorage.setItem(storeKey(), JSON.stringify({
      owners: [...cells.entries()].map(([k, c]) => [k, c.owner]),
      energy, score, best: Math.max(best, score), route,
    }));
    localStorage.setItem('hexlight-best', String(Math.max(best, score, Number(localStorage.getItem('hexlight-best') || 0))));
  } catch { /* file:// private mode — ignore */ }
}
function load() {
  try {
    best = Number(localStorage.getItem('hexlight-best') || 0);
    const raw = localStorage.getItem(storeKey());
    if (!raw) return false;
    const s = JSON.parse(raw);
    s.owners.forEach(([k, o]) => { if (cells.has(k)) cells.get(k).owner = o; });
    energy = s.energy; score = s.score; best = Math.max(best, s.best || 0); route = s.route || [];
    return true;
  } catch { return false; }
}

// ---------- tide ----------
function countdownTick() {
  const now = new Date(), mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  let s = Math.max(0, Math.floor((mid - now) / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0'), m = String(Math.floor((s % 3600) / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  $('countdown').textContent = `${h}:${m}:${ss}`;
  const t = todaySeed();
  if (!DEMO && t !== SEED) newTide(t, false);
}
function newTide(seed, demo) {
  SEED = seed; DEMO = !!demo;
  energy = ENERGY_MAX; score = 0; route = []; over = false;
  genIslands(SEED);
  load();
  // fresh demo tides shouldn't inherit
  if (demo) { energy = ENERGY_MAX; score = 0; route = []; over = false; [...cells.values()].forEach((c) => (c.owner = null)); }
  log(`<b class="g">◈ ${demo ? 'DEMO TIDE' : 'NEW TIDE'} ◈</b> seed <b class="g">${SEED}</b> — chart it, striker.`);
  render(); save();
}

// ---------- easter egg: KRAKEN ----------
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let konamiIdx = 0, beaconClicks = 0;
function wakeKraken(src) {
  if (krakenDone) return;
  krakenDone = true;
  const k = $('kraken');
  k.classList.remove('hidden');
  const open = [...cells.values()].filter((c) => !c.owner && c.type !== 'reef');
  for (let i = 0; i < Math.min(5, open.length); i++) {
    const c = open[Math.floor(Math.random() * open.length)];
    c.owner = 'kraken';
  }
  score += 50;
  log(`<b class="f">🐙 KRAKEN</b> woke via ${src}! seized the shallows. <b class="g">+50 phantom cargo</b>`);
  render(); save();
  setTimeout(() => k.classList.add('hidden'), 3200);
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  konamiIdx = k === KONAMI[konamiIdx] ? konamiIdx + 1 : k === KONAMI[0] ? 1 : 0;
  if (konamiIdx === KONAMI.length) { konamiIdx = 0; wakeKraken('konami code'); }
});
$('beacon').addEventListener('click', () => {
  beaconClicks++;
  log(`beacon hums… (${beaconClicks}/5)`);
  if (beaconClicks >= 5) { beaconClicks = 0; wakeKraken('the beacon'); }
});

// ---------- wire up ----------
$('modeClaim').addEventListener('click', () => { mode = 'claim'; $('modeClaim').classList.add('on'); $('modeRoute').classList.remove('on'); updateHud(); });
$('modeRoute').addEventListener('click', () => { mode = 'route'; $('modeRoute').classList.add('on'); $('modeClaim').classList.remove('on'); updateHud(); });
$('finishRoute').addEventListener('click', finishRoute);
$('clearRoute').addEventListener('click', () => { route = []; render(); save(); });
$('newTide').addEventListener('click', () => newTide(`demo-${Date.now().toString(36)}`, true));

// ---------- boot ----------
genIslands(SEED);
load();
log(`<b class="g">◈ HARBOR ONLINE ◈</b> seed <b class="g">${SEED}</b> — click a glowing isle to claim it.`);
render();
setInterval(countdownTick, 1000);
countdownTick();
