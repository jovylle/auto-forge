// Tidepool Street Oracle — sketch streets, flood blocks, watch ghost walkers reroute.
const COLS = 36, ROWS = 24, CELL = 30;
const W = COLS * CELL, H = ROWS * CELL;
const LS_KEY = 'tidepool-street-oracle-v1';

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

const $ = (id) => document.getElementById(id);
const tideSlider = $('tide'), tideVal = $('tideVal'), bindBox = $('bindScroll');
const toastEl = $('toast');

let seed = (Math.random() * 1e9) | 0;
let elev = new Float32Array(COLS * ROWS);
let streets = new Set();
let tide = 38;
let tool = 'street';
let walkers = [];
let reroutes = 0;
let frozen = false;
let time = 0;
let rerouteTimer = 0;

const key = (x, y) => x + ',' + y;
const idx = (x, y) => y * COLS + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const flooded = (x, y) => elev[idx(x, y)] < tide;
const walkable = (x, y) => inB(x, y) && streets.has(key(x, y)) && !flooded(x, y);

// --- seeded rng + value noise seabed ---
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genTerrain(s) {
  const rnd = mulberry32(s);
  const gw = 9, gh = 7, lat = [];
  for (let j = 0; j <= gh; j++) { lat[j] = []; for (let i = 0; i <= gw; i++) lat[j][i] = rnd() * 100; }
  const out = new Float32Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const gx = (x / (COLS - 1)) * gw, gy = (y / (ROWS - 1)) * gh;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, gw), y1 = Math.min(y0 + 1, gh);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = lat[y0][x0], b = lat[y0][x1], c = lat[y1][x0], d = lat[y1][x1];
    const v = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    // lift edges so map rims stay drier (a natural bowl rim)
    const edge = Math.min(x, y, COLS - 1 - x, ROWS - 1 - y);
    out[idx(x, y)] = Math.max(0, Math.min(100, v + edge * 4 - 6));
  }
  return out;
}
function seedStreets() {
  streets.clear();
  const midY = (ROWS / 2) | 0;
  for (let x = 1; x < COLS - 1; x++) streets.add(key(x, midY));
  for (let y = 1; y < ROWS - 1; y++) { streets.add(key(6, y)); streets.add(key(COLS - 7, y)); streets.add(key((COLS / 2) | 0, y)); }
  for (let x = 6; x < COLS - 6; x++) { streets.add(key(x, 4)); streets.add(key(x, ROWS - 5)); }
}

// --- A* over dry streets ---
function astar(sx, sy, tx, ty) {
  if (!walkable(tx, ty) || !walkable(sx, sy)) return null;
  if (sx === tx && sy === ty) return [[sx, sy]];
  const open = [{ x: sx, y: sy, g: 0, f: 0, p: null }];
  const best = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  let guard = 0;
  while (open.length && guard++ < 4000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === tx && cur.y === ty) {
      const path = []; let n = cur;
      while (n) { path.push([n.x, n.y]); n = n.p; }
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!walkable(nx, ny) || closed.has(key(nx, ny))) continue;
      const g = cur.g + 1;
      if (g < (best.get(key(nx, ny)) ?? Infinity)) {
        best.set(key(nx, ny), g);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny), p: cur });
      }
    }
  }
  return null;
}
function randomDryCell(rnd) {
  const r = rnd || Math.random;
  for (let t = 0; t < 60; t++) {
    const x = 1 + ((r() * (COLS - 2)) | 0), y = 1 + ((r() * (ROWS - 2)) | 0);
    if (walkable(x, y)) return [x, y];
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (walkable(x, y)) return [x, y];
  return null;
}
const GHOSTS = ['#cbbfff', '#8df5d6', '#f2e7ff', '#9fd8ff'];
function spawnWalker(w) {
  const c = randomDryCell();
  if (!c) return null;
  const t = randomDryCell() || c;
  return Object.assign({
    cx: c[0], cy: c[1], px: (c[0] + .5) * CELL, py: (c[1] + .5) * CELL,
    path: null, seg: 0, tx: t[0], ty: t[1],
    trail: [], stranded: false, color: GHOSTS[(Math.random() * GHOSTS.length) | 0],
    retry: 0, flash: 0,
  }, w);
}
function routeWalker(w) {
  const p = astar(w.cx, w.cy, w.tx, w.ty);
  if (p && p.length > 1) {
    const changed = !w.path || w.path.length !== p.length;
    w.path = p; w.seg = 0; w.stranded = false;
    if (changed) { w.flash = 1; }
    return changed;
  }
  // try a fresh destination before declaring stranded
  const t = randomDryCell();
  if (t) {
    const p2 = astar(w.cx, w.cy, t[0], t[1]);
    if (p2 && p2.length > 1) {
      w.tx = t[0]; w.ty = t[1]; w.path = p2; w.seg = 0; w.stranded = false; w.flash = 1;
      return true;
    }
  }
  if (!w.stranded) { w.stranded = true; w.flash = 1; return true; }
  return false;
}
function scheduleReroute() {
  clearTimeout(rerouteTimer);
  rerouteTimer = setTimeout(() => {
    let n = 0;
    for (const w of walkers) if (routeWalker(w)) n++;
    if (n > 0) {
      reroutes += n;
      toast(`⇄ ${n} walker${n > 1 ? 's' : ''} rerouted around the water`);
      updateStats();
    }
  }, 220);
}

// --- painting ---
let painting = false;
function paintAt(ev) {
  const r = canvas.getBoundingClientRect();
  const gx = Math.floor(((ev.clientX - r.left) / r.width) * W / CELL);
  const gy = Math.floor(((ev.clientY - r.top) / r.height) * H / CELL);
  let touched = false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > 1 && tool !== 'street') continue;
    const x = gx + dx, y = gy + dy;
    if (!inB(x, y)) continue;
    if (tool === 'street') { if (!streets.has(key(x, y))) { streets.add(key(x, y)); touched = true; } }
    else if (tool === 'erase') { if (streets.delete(key(x, y))) touched = true; }
    else if (tool === 'raise') { const i = idx(x, y); const v = Math.min(100, elev[i] + 7); if (v !== elev[i]) { elev[i] = v; touched = true; } }
    else if (tool === 'dredge') { const i = idx(x, y); const v = Math.max(0, elev[i] - 7); if (v !== elev[i]) { elev[i] = v; touched = true; } }
  }
  if (touched) { scheduleReroute(); updateStats(); save(); }
}
canvas.addEventListener('pointerdown', (e) => { painting = true; canvas.setPointerCapture(e.pointerId); paintAt(e); });
canvas.addEventListener('pointermove', (e) => { if (painting) paintAt(e); });
canvas.addEventListener('pointerup', () => { painting = false; });
canvas.addEventListener('pointercancel', () => { painting = false; });

// --- render ---
function cellCenter(c) { return [(c[0] + .5) * CELL, (c[1] + .5) * CELL]; }
function render() {
  ctx.fillStyle = '#05050c'; ctx.fillRect(0, 0, W, H);
  const swell = frozen ? 0 : Math.sin(time * 1.6) * 4;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const e = elev[idx(x, y)], px = x * CELL, py = y * CELL;
    const isSt = streets.has(key(x, y));
    const wet = e < tide;
    if (wet) {
      const depth = Math.min(1, (tide - e) / 30);
      const g = ctx.createLinearGradient(px, py, px, py + CELL);
      g.addColorStop(0, `rgba(31,111,122,${.55 + depth * .4})`);
      g.addColorStop(1, `rgba(10,32,72,${.75 + depth * .25})`);
      ctx.fillStyle = g; ctx.fillRect(px, py, CELL, CELL);
      if (!frozen && depth > .15) {
        ctx.strokeStyle = `rgba(94,242,200,${.10 + depth * .12})`;
        ctx.lineWidth = 1;
        const wy = py + CELL * (.3 + .4 * Math.abs(Math.sin(time * 2 + x * .7 + y * 1.1)));
        ctx.beginPath(); ctx.moveTo(px + 3, wy); ctx.quadraticCurveTo(px + CELL / 2, wy + swell * .3, px + CELL - 3, wy); ctx.stroke();
      }
      if (isSt) { // drowned street: dashed amber warning
        ctx.strokeStyle = 'rgba(255,179,92,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6); ctx.setLineDash([]);
      }
    } else if (isSt) {
      ctx.fillStyle = '#2e2417'; ctx.fillRect(px, py, CELL, CELL);
      ctx.fillStyle = '#c9a86a'; ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(px + 2, py + 2, CELL - 4, 3); ctx.fillRect(px + 2, py + CELL - 5, CELL - 4, 3);
      if (!frozen && Math.sin(time * 3 + x + y * 2) > .86) {
        ctx.fillStyle = 'rgba(255,220,150,.5)'; ctx.fillRect(px + CELL / 2 - 1, py + 4, 2, CELL - 8);
      }
    } else {
      const h = Math.min(1, e / 100);
      const b = 18 + h * 22;
      ctx.fillStyle = `rgb(${b | 0},${(b * .95) | 0},${(b * 1.7) | 0})`;
      ctx.fillRect(px, py, CELL, CELL);
      // rooftop blocks with lit windows
      if (e > tide + 4) {
        const hh = (x * 7 + y * 13) % 5;
        ctx.fillStyle = '#1b1b33'; ctx.fillRect(px + 5, py + 5 + hh * .5, CELL - 10, CELL - 10 - hh);
        ctx.fillStyle = 'rgba(255,179,92,.75)';
        if ((x + y) % 3 === 0) ctx.fillRect(px + 9, py + 9, 4, 5);
        if ((x * y) % 4 === 0) ctx.fillRect(px + CELL - 13, py + 12, 4, 5);
      } else if (e >= tide) { // damp shore
        ctx.fillStyle = 'rgba(94,242,200,.28)'; ctx.fillRect(px, py + CELL - 5, CELL, 3);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(px + .5, py + .5, CELL - 1, CELL - 1);
  }
  // walker paths (faint) + walkers
  for (const w of walkers) {
    if (w.path && w.path.length > 1 && !w.stranded) {
      ctx.strokeStyle = w.flash > 0 ? `rgba(255,179,92,${.2 + w.flash * .5})` : 'rgba(185,167,255,.22)';
      ctx.lineWidth = w.flash > 0 ? 3 : 1.5;
      ctx.beginPath();
      w.path.slice(w.seg).forEach(([cx, cy], i) => {
        const [px, py] = cellCenter([cx, cy]);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
  }
  for (const w of walkers) {
    // trail
    for (let i = 0; i < w.trail.length; i++) {
      const a = (i / w.trail.length) * .35;
      ctx.fillStyle = w.color + '';
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(w.trail[i][0], w.trail[i][1], 7 * (i / w.trail.length), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const pulse = frozen ? 0 : Math.sin(time * 5 + w.px) * 2;
    const R = 9 + pulse;
    const g = ctx.createRadialGradient(w.px, w.py, 0, w.px, w.py, R * 2.2);
    g.addColorStop(0, w.color); g.addColorStop(.4, w.color + '88'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.px, w.py, R * 2.2, 0, 7); ctx.fill();
    // sheet body
    ctx.fillStyle = 'rgba(240,238,255,.92)';
    ctx.beginPath();
    ctx.arc(w.px, w.py - 2, 6, Math.PI, 0);
    ctx.lineTo(w.px + 6, w.py + 7 + (frozen ? 0 : Math.sin(time * 9 + w.py) * 1.5));
    ctx.lineTo(w.px - 6, w.py + 7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(w.px - 3.4, w.py - 4.4, 2.4, 3.2); ctx.fillRect(w.px + 1, w.py - 4.4, 2.4, 3.2);
    if (w.stranded) {
      ctx.fillStyle = `rgba(255,107,138,${frozen ? .8 : .5 + Math.sin(time * 6) * .3})`;
      ctx.font = 'bold 15px serif'; ctx.textAlign = 'center';
      ctx.fillText('!', w.px, w.py - 14);
    }
    if (w.flash > 0) w.flash = Math.max(0, w.flash - .02);
  }
  ctx.globalAlpha = 1;
}
function step(dt) {
  if (frozen) return;
  time += dt;
  for (const w of walkers) {
    w.trail.push([w.px, w.py]);
    if (w.trail.length > 22) w.trail.shift();
    if (w.stranded || !w.path || w.seg >= w.path.length - 1) {
      w.retry += dt;
      if (w.retry > 2.5) { w.retry = 0; const t = randomDryCell(); if (t) { w.tx = t[0]; w.ty = t[1]; routeWalker(w); } }
      continue;
    }
    const [tx, ty] = cellCenter(w.path[w.seg + 1]);
    const dx = tx - w.px, dy = ty - w.py, d = Math.hypot(dx, dy);
    const sp = CELL * 4 * dt;
    if (d <= sp) {
      w.px = tx; w.py = ty; w.cx = w.path[w.seg + 1][0]; w.cy = w.path[w.seg + 1][1]; w.seg++;
      if (flooded(w.cx, w.cy)) { routeWalker(w); reroutes++; updateStats(); }
      if (w.seg >= w.path.length - 1) {
        const t = randomDryCell();
        if (t) { w.tx = t[0]; w.ty = t[1]; routeWalker(w); }
      }
    } else { w.px += (dx / d) * sp; w.py += (dy / d) * sp; }
  }
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  step(dt); render();
  requestAnimationFrame(loop);
}

// --- tide + stats + toast ---
function setTide(v, silent) {
  tide = Math.max(0, Math.min(100, Math.round(v)));
  tideSlider.value = tide; tideVal.textContent = tide;
  $('wellFill').style.width = tide + '%';
  $('scrollTide').textContent = tide;
  if (!silent) scheduleReroute();
  updateStats(); save();
}
function updateStats() {
  let dry = 0, wet = 0, drowned = 0;
  for (const k of streets) {
    const [x, y] = k.split(',').map(Number);
    flooded(x, y) ? wet++ : dry++;
  }
  for (let i = 0; i < elev.length; i++) if (elev[i] < tide) drowned++;
  const total = dry + wet;
  $('stDry').textContent = total ? Math.round((dry / total) * 100) + '%' : '–';
  $('stDrowned').textContent = drowned;
  $('stWalk').textContent = walkers.length;
  $('stStrand').textContent = walkers.filter((w) => w.stranded).length;
  $('stReroute').textContent = reroutes;
}
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// --- scroll binding (the hard constraint) + reveal + parallax ---
const runes = $('runes');
let scrollTick = false;
function onScroll() {
  if (scrollTick) return; scrollTick = true;
  requestAnimationFrame(() => {
    scrollTick = false;
    const y = window.scrollY || 0;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = Math.min(1, Math.max(0, y / max));
    runes.style.transform = `translateY(${y * .12}px)`;
    runes.style.opacity = `${Math.max(.25, 1 - p * .8)}`;
    document.querySelector('.fog-a').style.transform = `translateY(${y * -.06}px)`;
    $('scrollPct').textContent = Math.round(p * 100) + '%';
    if (bindBox.checked) setTide(p * 100);
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('risen'); io.unobserve(e.target); }
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// --- toolbar wiring ---
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tool').forEach((x) => x.classList.remove('is-active'));
  b.classList.add('is-active'); tool = b.dataset.tool;
}));
tideSlider.addEventListener('input', () => {
  bindBox.checked = false; // a manual hand overrules the scroll-spirit
  setTide(+tideSlider.value);
});
$('btnWalkers').addEventListener('click', () => {
  const w = spawnWalker();
  if (w) { walkers.push(w); routeWalker(w); toast(`👻 a walker joins — ${walkers.length} abroad`); }
  else toast('no dry street to haunt — sketch one first');
  updateStats(); save();
});
$('btnRegrow').addEventListener('click', () => {
  seed = (Math.random() * 1e9) | 0;
  elev = genTerrain(seed); seedStreets();
  walkers = walkers.map((w, i) => spawnWalker({ color: GHOSTS[i % GHOSTS.length] })).filter(Boolean);
  walkers.forEach(routeWalker);
  toast('🎲 the seabed dreams a new shape'); scheduleReroute(); updateStats(); save();
});
$('btnClear').addEventListener('click', () => {
  streets.clear(); walkers.forEach((w) => { w.stranded = true; w.path = null; });
  toast('🌊 the streets wash away'); updateStats(); save();
});
$('btnPause').addEventListener('click', (e) => {
  frozen = !frozen;
  e.currentTarget.textContent = frozen ? '▶ drift' : '⏸ still';
  toast(frozen ? '⏸ the water holds its breath' : '▶ the tide drifts again');
});

// --- postcard export ---
function exportPostcard() {
  const PW = 1200, PH = 900;
  const pc = document.createElement('canvas'); pc.width = PW; pc.height = PH;
  const c = pc.getContext('2d');
  const bg = c.createLinearGradient(0, 0, 0, PH);
  bg.addColorStop(0, '#171233'); bg.addColorStop(.6, '#0c0c1a'); bg.addColorStop(1, '#07070f');
  c.fillStyle = bg; c.fillRect(0, 0, PW, PH);
  c.strokeStyle = '#5ef2c8'; c.lineWidth = 3; c.strokeRect(18, 18, PW - 36, PH - 36);
  c.strokeStyle = '#2b2b4d'; c.lineWidth = 1; c.strokeRect(30, 30, PW - 60, PH - 60);
  c.fillStyle = '#e9e2d0'; c.textAlign = 'center';
  c.font = '800 54px Georgia, serif';
  c.fillText('TIDEPOOL STREET ORACLE', PW / 2, 105);
  c.fillStyle = '#9a93b8'; c.font = 'italic 26px Georgia, serif';
  const d = new Date();
  c.fillText(`tide ${tide} ft · ${walkers.length} walkers · ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`, PW / 2, 148);
  // map
  const mw = PW - 160, mh = 560, ox = 80, oy = 190;
  c.save();
  c.beginPath(); c.rect(ox, oy, mw, mh); c.clip();
  c.drawImage(canvas, ox, oy, mw, mh);
  c.restore();
  c.strokeStyle = '#c9a86a'; c.lineWidth = 2; c.strokeRect(ox, oy, mw, mh);
  c.fillStyle = '#ffb35c'; c.font = '22px Georgia, serif';
  c.fillText(`ᚦ drowned blocks: ${[...Array(elev.length)].filter((_, i) => elev[i] < tide).length} · reroutes sung: ${reroutes} · — the oracle keeps what it kisses —`, PW / 2, oy + mh + 60);
  const url = pc.toDataURL('image/png');
  $('postPreview').src = url;
  const dl = $('postDownload'); dl.href = url; dl.classList.remove('hidden');
  dl.click();
  toast('✉ postcard sealed & downloaded');
}
$('btnPostcard').addEventListener('click', exportPostcard);
$('btnPostcard2').addEventListener('click', exportPostcard);

// --- persistence ---
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      seed, tide, tool, reroutes,
      streets: [...streets],
      elev: Array.from(elev),
      walkers: walkers.length,
    }));
  } catch { /* private mode — sail on */ }
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.streets)) return false;
    seed = s.seed | 0; tide = Math.max(0, Math.min(100, +s.tide || 0));
    streets = new Set(s.streets);
    if (Array.isArray(s.elev) && s.elev.length === COLS * ROWS) elev = Float32Array.from(s.elev);
    else elev = genTerrain(seed);
    reroutes = +s.reroutes || 0;
    return { walkers: Math.min(30, Math.max(1, +s.walkers || 12)) };
  } catch { return false; }
}

// --- boot ---
(function boot() {
  const prev = load();
  if (!prev) { elev = genTerrain(seed); seedStreets(); }
  const n = (prev && prev.walkers) || 12;
  for (let i = 0; i < n; i++) {
    const w = spawnWalker({ color: GHOSTS[i % GHOSTS.length] });
    if (w) walkers.push(w);
  }
  walkers.forEach(routeWalker);
  tideSlider.value = tide;
  setTide(tide, true);
  onScroll();
  updateStats();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
  console.log('tidepool-street-oracle ready', { streets: streets.size, walkers: walkers.length });
})();
