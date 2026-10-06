// Lantern Grid Wayfinders — retro-wave hex wayfinding rite.
// Drag routes across hex districts · dodge rewriting fog · relight 12 outposts.
// 3 inks only: #ff2e88 #22e6ff #ffb02e (+ black #0b0714 / white #fff6ec).

const PK = '#ff2e88', CY = '#22e6ff', AM = '#ffb02e';
const BK = '#0b0714', WT = '#fff6ec';

const COLS = 9, ROWS = 8, MAX_TRAIL = 14;
const FOG_START = 9, FOG_TICK_MS = 5000, SHIFT_TICK_MS = 8000;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const litEl = document.getElementById('litCount');
const fogEl = document.getElementById('fogCount');
const clockEl = document.getElementById('clock');
const trailEl = document.getElementById('trailLen');
const chargeFill = document.getElementById('chargeFill');
const hintEl = document.getElementById('hint');
const logEl = document.getElementById('log');
const toastEl = document.getElementById('toast');
const bestEl = document.getElementById('best');

const W = 900, H = 760;
const DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = W * DPR; canvas.height = H * DPR;
ctx.scale(DPR, DPR);

// ---- hex geometry (pointy-top, odd-r offset) ----
const SIZE = 44;
const OX = 70, OY = 62;
const SQ3 = Math.sqrt(3);
function centerOf(c, r) {
  return { x: OX + SIZE * SQ3 * (c + 0.5 * (r & 1)), y: OY + SIZE * 1.5 * r };
}
function corners(x, y, s) {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    p.push([x + s * Math.cos(a), y + s * Math.sin(a)]);
  }
  return p;
}
function key(c, r) { return c + ',' + r; }
function parse(k) { const [c, r] = k.split(',').map(Number); return { c, r }; }
function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
function neighbors(c, r) {
  const odd = r & 1;
  const d = odd
    ? [[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]
    : [[1,0],[-1,0],[-1,-1],[0,-1],[-1,1],[0,1]];
  const out = [];
  for (const [dc, dr] of d) { const nc = c + dc, nr = r + dr; if (inBounds(nc, nr)) out.push({ c: nc, r: nr }); }
  return out;
}
function adjacent(a, b) { return neighbors(a.c, a.r).some(n => n.c === b.c && n.r === b.r); }

// ---- map layout ----
const BASE = { c: 4, r: 3 };
const OUTPOST_SPOTS = [
  { c: 1, r: 0 }, { c: 4, r: 0 }, { c: 7, r: 0 },
  { c: 0, r: 2 }, { c: 8, r: 2 },
  { c: 2, r: 4 }, { c: 6, r: 4 },
  { c: 0, r: 6 }, { c: 8, r: 6 },
  { c: 1, r: 7 }, { c: 4, r: 7 }, { c: 7, r: 7 },
];
const TOTAL_OUTPOSTS = 12;

// ---- state ----
let outposts = [...OUTPOST_SPOTS];
let lit = new Set([key(BASE.c, BASE.r)]);   // lit special keys
let rails = new Set();                       // committed trail cell keys
let fog = new Set();
let districtMutation = new Map();            // key -> extra shift
let districtShift = 0;
let draft = [];                              // [{c,r}]
let dragFrom = null;
let dragging = false;
let startTime = Date.now();
let bankedMs = 0;
let moves = 0;
let won = false;
let nightDrive = false;
let particles = [];
let toastTimer = 0;

const store = {
  load() { try { return JSON.parse(localStorage.getItem('lgw-save-v1') || 'null'); } catch { return null; } },
  save(s) { try { localStorage.setItem('lgw-save-v1', JSON.stringify(s)); } catch {} },
  best() { try { return JSON.parse(localStorage.getItem('lgw-best-v1') || 'null'); } catch { return null; } },
  setBest(b) { try { localStorage.setItem('lgw-best-v1', JSON.stringify(b)); } catch {} },
};
let muted = false;
try { muted = localStorage.getItem('lgw-mute') === '1'; } catch {}

function specialAt(c, r) {
  const k = key(c, r);
  if (c === BASE.c && r === BASE.r) return 'base';
  if (outposts.some(o => o.c === c && o.r === r)) return 'outpost';
  return null;
}
function isLitSpecial(c, r) { return lit.has(key(c, r)); }
function isUnlitOutpost(c, r) {
  return specialAt(c, r) === 'outpost' && !lit.has(key(c, r));
}

// ---- audio (WebAudio, no assets) ----
let AC = null, master = null;
function audio() {
  if (muted) return null;
  try {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.16; master.connect(AC.destination); }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  } catch { return null; }
}
function blip(freq, dur = 0.09, type = 'square', slide = 0) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(0.9, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ac.currentTime + dur + 0.02);
}
const sfx = {
  step() { blip(520 + Math.random() * 120, 0.05, 'square'); },
  back() { blip(300, 0.06, 'square', -80); },
  bad() { blip(140, 0.18, 'sawtooth', -60); },
  lit() { blip(660, 0.12, 'square'); setTimeout(() => blip(880, 0.14, 'square'), 90); setTimeout(() => blip(1320, 0.2, 'sine'), 180); },
  fog() { blip(220, 0.25, 'sawtooth', -140); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'square'), i * 130)); },
  egg() { [392, 523, 659, 784, 659, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'sawtooth'), i * 100)); },
};

// ---- helpers ----
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function addLog(html) {
  const li = document.createElement('li');
  li.innerHTML = '<span class="t">' + fmt(Date.now() - startTime + bankedMs) + '</span>' + html;
  logEl.prepend(li);
  while (logEl.children.length > 30) logEl.lastChild.remove();
}
function litOutpostCount() {
  return outposts.filter(o => lit.has(key(o.c, o.r))).length;
}
function persist() {
  store.save({ lit: [...lit], rails: [...rails], outposts, bankedMs: Date.now() - startTime + bankedMs, moves });
}
function refreshBest() {
  const b = store.best();
  bestEl.textContent = b
    ? 'Fastest dawn: ' + fmt(b.ms) + ' · ' + b.moves + ' routes.'
    : 'No completed night yet. Relight all 12 outposts.';
}

// ---- fog ----
function randomFreeCell() {
  for (let t = 0; t < 60; t++) {
    const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
    const k = key(c, r);
    if (specialAt(c, r)) continue;
    if (lit.has(k) || rails.has(k) || fog.has(k)) continue;
    if (draft.some(d => d.c === c && d.r === r)) continue;
    // don't wall off the start completely
    if (Math.abs(c - BASE.c) + Math.abs(r - BASE.r) < 2) continue;
    return { c, r };
  }
  return null;
}
function seedFog() {
  fog.clear();
  for (let i = 0; i < FOG_START; i++) {
    const cell = randomFreeCell();
    if (cell) fog.add(key(cell.c, cell.r));
  }
}
function fogTick() {
  if (won) return;
  // clear oldest two (and REWRITE their district: fog rewrites tiles)
  const arr = [...fog];
  for (let i = 0; i < Math.min(2, arr.length); i++) {
    fog.delete(arr[i]);
    districtMutation.set(arr[i], (districtMutation.get(arr[i]) || 0) + 1);
  }
  // grow: prefer cells adjacent to existing fog so it visibly crawls
  let added = 0;
  const edge = [];
  fog.forEach(k => { const { c, r } = parse(k); neighbors(c, r).forEach(n => edge.push(n)); });
  for (const n of edge.sort(() => Math.random() - 0.5)) {
    if (added >= 3) break;
    const k = key(n.c, n.r);
    if (specialAt(n.c, n.r) || lit.has(k) || rails.has(k) || fog.has(k)) continue;
    fog.add(k); added++;
  }
  while (added < 2) { const cell = randomFreeCell(); if (!cell) break; fog.add(key(cell.c, cell.r)); added++; }
  // fog eats in-progress draft
  if (draft.length && draft.some(d => fog.has(key(d.c, d.r)))) {
    draft = draft.filter(d => !fog.has(key(d.c, d.r)));
    sfx.fog(); toast('Fog rewrote your draft — reroute!');
    addLog('Fog <b>rewrote</b> the draft trail.');
  }
  // keep HUD honest
  updateHUD();
  persist();
}

// ---- districts ----
function districtOf(c, r) {
  const mut = districtMutation.get(key(c, r)) || 0;
  return (r * 2 + c + districtShift + mut) % 3;
}
const DISTRICT_COLOR = [PK, CY, AM];

// ---- routing ----
function cellBlocked(c, r) { return fog.has(key(c, r)); }
function tryExtend(cell) {
  const last = draft[draft.length - 1];
  if (!last || (last.c === cell.c && last.r === cell.r)) return;
  if (!adjacent(last, cell)) return;
  const k = key(cell.c, cell.r);
  if (cellBlocked(cell.c, cell.r)) { sfx.bad(); toast('Fog wall — route around it.'); return; }
  // backtrack = undo
  if (draft.length > 1) {
    const prev = draft[draft.length - 2];
    if (prev.c === cell.c && prev.r === cell.r) { draft.pop(); sfx.back(); updateHUD(); return; }
  }
  if (draft.some(d => d.c === cell.c && d.r === cell.r)) return;
  const sp = specialAt(cell.c, cell.r);
  if (sp === 'base') return;                       // never walk through base
  if (sp === 'outpost' && lit.has(k)) return;      // never walk through lit outposts
  if (draft.length >= MAX_TRAIL) { sfx.bad(); toast('Trail charge spent (14). Release on an outpost!'); return; }
  draft.push(cell);
  sfx.step();
  updateHUD();
}
function draftTarget() {
  if (!draft.length) return null;
  const last = draft[draft.length - 1];
  if (isUnlitOutpost(last.c, last.r)) return last;
  // generous: ending adjacent to an unlit outpost counts
  const near = neighbors(last.c, last.r).find(n => isUnlitOutpost(n.c, n.r));
  return near || null;
}
function commitDraft() {
  const target = draftTarget();
  if (!target) {
    if (draft.length > 1) toast('Trail fizzles — release ON or NEXT TO a dim outpost.');
    draft = []; dragFrom = null; updateHUD();
    return;
  }
  // commit
  draft.forEach(d => { if (!specialAt(d.c, d.r)) rails.add(key(d.c, d.r)); });
  lit.add(key(target.c, target.r));
  moves++;
  const n = litOutpostCount();
  burst(target.c, target.r, AM);
  draft.forEach(d => burst(d.c, d.r, nightDrive ? WT : CY, 3));
  sfx.lit();
  addLog('Outpost <b>relit</b> — ' + n + '/12 · route of ' + (draft.length + 1) + ' hexes.');
  toast('Outpost relit ✦ ' + n + '/12');
  draft = []; dragFrom = null;
  updateHUD(); persist();
  if (n >= TOTAL_OUTPOSTS) winGame();
}
function burst(c, r, color, count = 26) {
  const p = centerOf(c, r);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
    particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
  }
}

// ---- pointer input ----
function eventCell(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top) * (H / rect.height);
  let best = null, bd = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = centerOf(c, r);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = { c, r }; }
  }
  const p = centerOf(best.c, best.r);
  if (Math.hypot(p.x - x, p.y - y) > SIZE * 1.05) return null;
  return best;
}
canvas.addEventListener('pointerdown', e => {
  audio();
  const cell = eventCell(e);
  if (!cell) return;
  if (!isLitSpecial(cell.c, cell.r)) {
    toast('Start your drag ON a lit lantern.');
    sfx.bad();
    return;
  }
  dragging = true; dragFrom = cell;
  draft = [{ ...cell }];
  canvas.setPointerCapture(e.pointerId);
  updateHUD();
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const cell = eventCell(e);
  if (cell) tryExtend(cell);
});
function endDrag() {
  if (!dragging) return;
  dragging = false;
  commitDraft();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { dragging = false; draft = []; updateHUD(); });

// ---- win / reset ----
function winGame() {
  won = true;
  const ms = Date.now() - startTime + bankedMs;
  sfx.win();
  const prev = store.best();
  if (!prev || ms < prev.ms) { store.setBest({ ms, moves }); }
  refreshBest();
  document.getElementById('winStats').textContent =
    'Dawn in ' + fmt(ms) + ' · ' + moves + ' routes charted.' +
    (nightDrive ? ' The Night Driver salutes you.' : '');
  document.getElementById('winOverlay').classList.remove('hidden');
  addLog('<b>DAWN.</b> All 12 outposts burn.');
  try { localStorage.removeItem('lgw-save-v1'); } catch {}
}
function newMap(reshuffle) {
  if (reshuffle) {
    // pick 12 spread cells deterministically-ish but fresh
    const pool = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (Math.abs(c - BASE.c) + Math.abs(r - BASE.r) < 2) continue;
      pool.push({ c, r });
    }
    pool.sort(() => Math.random() - 0.5);
    // force spread: greedily keep cells far from chosen ones
    const chosen = [];
    for (const cell of pool) {
      if (chosen.length >= TOTAL_OUTPOSTS) break;
      if (chosen.every(o => Math.abs(o.c - cell.c) + Math.abs(o.r - cell.r) > 2)) chosen.push(cell);
    }
    for (const cell of pool) { if (chosen.length >= TOTAL_OUTPOSTS) break; if (!chosen.includes(cell)) chosen.push(cell); }
    outposts = chosen.slice(0, TOTAL_OUTPOSTS);
  }
  lit = new Set([key(BASE.c, BASE.r)]);
  rails = new Set(); draft = []; won = false; moves = 0;
  startTime = Date.now(); bankedMs = 0;
  seedFog();
  document.getElementById('winOverlay').classList.add('hidden');
  logEl.innerHTML = '';
  addLog('Night falls. <b>12 outposts</b> wait in the dark.');
  addLog('Fog is <b>rewriting</b> the districts. Move fast.');
  updateHUD(); persist();
}

// ---- HUD ----
function updateHUD() {
  const n = litOutpostCount();
  litEl.textContent = (n + 1) + '/13';
  fogEl.textContent = fog.size;
  trailEl.textContent = draft.length + '/' + MAX_TRAIL;
  chargeFill.style.width = (draft.length / MAX_TRAIL * 100) + '%';
  if (!won) {
    if (dragging && draft.length) {
      const t = draftTarget();
      hintEl.innerHTML = t
        ? 'Release to <b>relight</b> that outpost ✦'
        : 'Charge ' + draft.length + '/' + MAX_TRAIL + ' — drag to a <b>dim outpost</b>. Backtrack to undo.';
    } else if (n === 0) {
      hintEl.innerHTML = 'Drag from the <b>lit lantern</b> at the grid heart to a nearby <b>dim outpost</b>.';
    } else {
      hintEl.innerHTML = 'Chain outward from any <b>lit lantern</b>. Fog eats drafts — route around it.';
    }
  }
}

// ---- render ----
function hexPath(x, y, s) {
  ctx.beginPath();
  corners(x, y, s).forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath();
}
let startStamp = performance.now();
function draw(now) {
  const t = (now - startStamp) / 1000;
  ctx.clearRect(0, 0, W, H);

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const { x, y } = centerOf(c, r);
    const k = key(c, r);
    const sp = specialAt(c, r);
    const isFog = fog.has(k);
    const inDraft = draft.some(d => d.c === c && d.r === r);
    const isRail = rails.has(k);
    const dc = DISTRICT_COLOR[districtOf(c, r)];

    // base fill
    hexPath(x, y, SIZE - 3);
    ctx.fillStyle = 'rgba(11,7,20,0.92)';
    ctx.fill();
    // district tint
    hexPath(x, y, SIZE - 3);
    ctx.fillStyle = hexA(dc, sp ? 0.16 : 0.08);
    ctx.fill();
    // stroke
    ctx.lineWidth = sp ? 2.4 : 1.2;
    ctx.strokeStyle = sp ? (lit.has(k) ? AM : WT) : hexA(dc, 0.55);
    ctx.shadowBlur = sp ? 16 : 0;
    ctx.shadowColor = sp ? (lit.has(k) ? AM : WT) : 'transparent';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // rail glow dot at center
    if (isRail) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 7);
      ctx.fillStyle = AM; ctx.shadowBlur = 10; ctx.shadowColor = AM; ctx.fill(); ctx.shadowBlur = 0;
    }

    // fog: animated static
    if (isFog) {
      hexPath(x, y, SIZE - 5);
      ctx.fillStyle = 'rgba(255,246,236,0.10)';
      ctx.fill();
      ctx.save();
      hexPath(x, y, SIZE - 5); ctx.clip();
      const drift = (t * 22) % 12;
      ctx.fillStyle = 'rgba(255,246,236,0.5)';
      for (let i = -3; i < 7; i++) {
        const lx = x - SIZE + i * 12 + drift;
        ctx.fillRect(lx, y - SIZE, 2, SIZE * 2);
      }
      ctx.fillStyle = 'rgba(255,246,236,0.85)';
      ctx.font = '11px monospace';
      ctx.fillText('≈', x - 5, y + 4);
      ctx.restore();
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,246,236,0.75)'; hexPath(x, y, SIZE - 5); ctx.stroke();
    }

    // specials: lantern glyph
    if (sp) {
      const isLit = lit.has(k);
      const pulse = isLit ? (0.75 + 0.25 * Math.sin(t * 3 + c + r)) : 1;
      ctx.save();
      ctx.shadowBlur = isLit ? 26 * pulse : 6;
      ctx.shadowColor = isLit ? AM : WT;
      // lantern diamond
      ctx.beginPath();
      ctx.moveTo(x, y - 15 * pulse); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 15 * pulse); ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.fillStyle = isLit ? AM : 'rgba(11,7,20,0.9)';
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = isLit ? AM : 'rgba(255,246,236,0.8)';
      ctx.stroke();
      // flame
      ctx.beginPath(); ctx.arc(x, y, isLit ? 4.5 * pulse : 2.5, 0, 7);
      ctx.fillStyle = isLit ? WT : 'rgba(255,246,236,0.55)';
      ctx.fill();
      ctx.restore();
      if (sp === 'base') {
        ctx.fillStyle = 'rgba(255,246,236,0.8)';
        ctx.font = '9px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('H E A R T', x, y + 30);
        ctx.textAlign = 'start';
      }
    }

    // draft highlight
    if (inDraft) {
      hexPath(x, y, SIZE - 8);
      ctx.fillStyle = hexA(nightDrive ? AM : CY, 0.30);
      ctx.fill();
    }
  }

  // committed rails as glowing polylines — group rail cells into runs via flood from each lit node
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowBlur = 14; ctx.shadowColor = AM;
  ctx.strokeStyle = AM; ctx.lineWidth = 5;
  drawRailNet();
  ctx.restore();

  // draft trail
  if (draft.length > 1 || (draft.length === 1 && dragging)) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, nightDrive ? AM : CY);
    grad.addColorStop(1, PK);
    ctx.strokeStyle = grad; ctx.lineWidth = 6;
    ctx.shadowBlur = 18; ctx.shadowColor = nightDrive ? AM : CY;
    ctx.beginPath();
    draft.forEach((d, i) => {
      const p = centerOf(d.c, d.r);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    // rubber-band to pointer
    if (pointerXY && dragging) ctx.lineTo(pointerXY.x, pointerXY.y);
    ctx.stroke();
    ctx.restore();
    // head dot
    const head = centerOf(draft[draft.length - 1].c, draft[draft.length - 1].r);
    ctx.beginPath(); ctx.arc(head.x, head.y, 6, 0, 7);
    ctx.fillStyle = WT; ctx.shadowBlur = 14; ctx.shadowColor = CY; ctx.fill(); ctx.shadowBlur = 0;
  }

  // target pulse on reachable outposts while dragging
  if (dragging && draft.length) {
    const last = draft[draft.length - 1];
    neighbors(last.c, last.r).forEach(n => {
      if (isUnlitOutpost(n.c, n.r)) {
        const p = centerOf(n.c, n.r);
        ctx.beginPath(); ctx.arc(p.x, p.y, 24 + 5 * Math.sin(t * 6), 0, 7);
        ctx.strokeStyle = AM; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 16; ctx.shadowColor = AM; ctx.stroke(); ctx.shadowBlur = 0;
      }
    });
  }

  // particles
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.02;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    ctx.globalAlpha = 1;
  });

  // clock
  if (!won) clockEl.textContent = fmt(Date.now() - startTime + bankedMs);
  requestAnimationFrame(draw);
}
// rails visual: for each rail cell, link to adjacent rail/lit cells (each pair once)
function drawRailNet() {
  const seen = new Set();
  rails.forEach(k => {
    const { c, r } = parse(k);
    neighbors(c, r).forEach(n => {
      const nk = key(n.c, n.r);
      if (!rails.has(nk) && !lit.has(nk)) return;
      const id = [k, nk].sort().join('|');
      if (seen.has(id)) return;
      seen.add(id);
      const a = centerOf(c, r), b = centerOf(n.c, n.r);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
  });
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
let pointerXY = null;
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  pointerXY = { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
});
canvas.addEventListener('pointerleave', () => { pointerXY = null; });

// ---- easter egg: Konami + sun clicks ----
const KONAMI = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
let konamiIdx = 0, sunClicks = 0, sunTimer = 0;
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  konamiIdx = (k === KONAMI[konamiIdx]) ? konamiIdx + 1 : (k === KONAMI[0] ? 1 : 0);
  if (konamiIdx >= KONAMI.length) { konamiIdx = 0; triggerEgg('konami'); }
});
document.getElementById('sunBtn').addEventListener('click', () => {
  audio(); blip(880, 0.08, 'sine');
  sunClicks++;
  clearTimeout(sunTimer);
  sunTimer = setTimeout(() => { sunClicks = 0; }, 3000);
  if (sunClicks >= 5) { sunClicks = 0; triggerEgg('sun'); }
  else if (sunClicks >= 3) toast('The sun hums back… keep going.');
});
function triggerEgg(how) {
  if (nightDrive) { document.getElementById('eggOverlay').classList.remove('hidden'); return; }
  nightDrive = true;
  document.body.classList.add('night-drive');
  sfx.egg();
  addLog('A <b>secret frequency</b> crackles in (' + how + '). NIGHT DRIVE engaged.');
  toast('✦ SECRET FREQUENCY FOUND ✦');
  document.getElementById('eggOverlay').classList.remove('hidden');
}
document.getElementById('eggClose').addEventListener('click', () => {
  document.getElementById('eggOverlay').classList.add('hidden');
});

// ---- buttons ----
document.getElementById('newMapBtn').addEventListener('click', () => { audio(); newMap(true); toast('Fresh districts charted.'); });
document.getElementById('againBtn').addEventListener('click', () => { newMap(true); });
const muteBtn = document.getElementById('muteBtn');
function paintMute() { muteBtn.textContent = muted ? '✕ muted' : '♪ sound on'; muteBtn.setAttribute('aria-pressed', String(muted)); }
muteBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('lgw-mute', muted ? '1' : '0'); } catch {}
  paintMute();
  if (!muted) sfx.step();
});
document.getElementById('helpBtn').addEventListener('click', () => document.getElementById('helpOverlay').classList.remove('hidden'));
document.getElementById('helpClose').addEventListener('click', () => document.getElementById('helpOverlay').classList.add('hidden'));
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => {
  if (e.target === o && o.id !== 'winOverlay') o.classList.add('hidden');
}));
window.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => { if (o.id !== 'winOverlay') o.classList.add('hidden'); }); });

// ---- boot ----
(function boot() {
  paintMute();
  refreshBest();
  const s = store.load();
  if (s && Array.isArray(s.lit) && s.lit.length > 1 && Array.isArray(s.outposts) && s.outposts.length === 12) {
    outposts = s.outposts;
    lit = new Set(s.lit);
    rails = new Set(s.rails || []);
    bankedMs = s.bankedMs || 0;
    moves = s.moves || 0;
    seedFog();
    // fog must never sit on restored progress
    lit.forEach(k => fog.delete(k)); rails.forEach(k => fog.delete(k));
    addLog('Wayfinder returns. <b>' + litOutpostCount() + '/12</b> outposts still burn.');
  } else {
    seedFog();
    addLog('Night falls. <b>12 outposts</b> wait in the dark.');
    addLog('Fog is <b>rewriting</b> the districts. Move fast.');
  }
  startTime = Date.now();
  updateHUD();
  setInterval(fogTick, FOG_TICK_MS);
  setInterval(() => { districtShift = (districtShift + 1) % 3; }, SHIFT_TICK_MS);
  setInterval(() => { if (!won && !dragging) persist(); }, 10000);
  requestAnimationFrame(draw);
})();
