// Moss Compass Atlas — paint moss, lift fog, outgrow rivals, export PNG.
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const boardEl = $('board'), timerEl = $('timer'), toastEl = $('toast');
const statFog = $('statFog'), statYou = $('statYou'), statBest = $('statBest');

const COLS = 13, ROWS = 9, REVEAL_R = 2, GAME_SECS = 60;
const FACTIONS = [
  { id: 'you', name: 'Your moss', color: '#1A7A2E', dark: '#0F5420' },
  { id: 'r1', name: 'Ochre colony', color: '#C77F0A', dark: '#8A5600' },
  { id: 'r2', name: 'Ultramarine colony', color: '#1D3FBF', dark: '#12267E' },
  { id: 'r3', name: 'Carmine colony', color: '#C40F4E', dark: '#820A34' },
];
const BEST_KEY = 'mca-best-v1';

let cells, surveyor, timeLeft, over, pulseTimer, best = 0;
try { best = Number(localStorage.getItem(BEST_KEY) || 0); } catch { /* file:// safe */ }
statBest.textContent = best;

const W = canvas.width, H = canvas.height;
const HEX_R = Math.min(W / (COLS * 1.74), H / (ROWS * 1.55));
const HEX_W = Math.sqrt(3) * HEX_R, HEX_H = 2 * HEX_R;
const OX = (W - (COLS * HEX_W + HEX_W / 2)) / 2 + HEX_W / 2;
const OY = (H - (ROWS * HEX_H * 0.75 + HEX_H * 0.25)) / 2 + HEX_H / 2;

function hexCenter(c, r) {
  return { x: OX + c * HEX_W + (r % 2 ? HEX_W / 2 : 0), y: OY + r * HEX_H * 0.75 };
}
// odd-r offset neighbours
function neighbours(c, r) {
  const even = r % 2 === 0;
  const d = even
    ? [[+1, 0], [-1, 0], [0, -1], [-1, -1], [0, +1], [-1, +1]]
    : [[+1, 0], [-1, 0], [+1, -1], [0, -1], [+1, +1], [0, +1]];
  return d.map(([dc, dr]) => ({ c: c + dc, r: r + dr }))
    .filter((p) => p.c >= 0 && p.r >= 0 && p.c < COLS && p.r < ROWS);
}
function hexDist(a, b) {
  // odd-r -> cube
  const off = (c, r) => { const x = c - (r - (r & 1)) / 2; const z = r; return { x, z, y: -x - z }; };
  const A = off(a.c, a.r), B = off(b.c, b.r);
  return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
}
function hexPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}

function newGame() {
  cells = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({ c, r, owner: null, seen: false, age: 0 })));
  surveyor = { c: (COLS / 2) | 0, r: (ROWS / 2) | 0 };
  timeLeft = GAME_SECS; over = false;
  $('resultCard').hidden = true;
  timerEl.classList.remove('low');
  // seed rivals far from center
  const spots = [{ c: 1, r: 1 }, { c: COLS - 2, r: 1 }, { c: COLS - 2, r: ROWS - 2 }];
  const ids = ['r1', 'r2', 'r3'];
  spots.forEach((s, i) => {
    const cell = cells[s.r][s.c];
    cell.owner = ids[i]; cell.age = 2;
    neighbours(s.c, s.r).slice(0, 2).forEach((n) => { cells[n.r][n.c].owner = ids[i]; cells[n.r][n.c].age = 1; });
  });
  // player starter patch
  paintAt(surveyor.c, surveyor.r, true);
  reveal(surveyor);
  updateHud();
  toast('Survey started — paint!');
  restartLoop();
}

function reveal(at) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (hexDist({ c, r }, at) <= REVEAL_R) cells[r][c].seen = true;
  }
}
function paintAt(c, r, silent) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS || over) return false;
  const cell = cells[r][c];
  const changed = cell.owner !== 'you';
  cell.owner = 'you'; cell.age++; cell.seen = true;
  reveal({ c, r });
  if (changed && !silent) updateHud();
  return changed;
}

function pulse() {
  if (over) return;
  const claims = [];
  const P = { you: 0.22, r1: 0.16, r2: 0.19, r3: 0.14 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c];
    if (!cell.owner) continue;
    cell.age++;
    if (Math.random() < (P[cell.owner] ?? 0.15)) {
      const empty = neighbours(c, r).filter((n) => !cells[n.r][n.c].owner);
      if (empty.length) {
        const t = empty[(Math.random() * empty.length) | 0];
        claims.push({ ...t, owner: cell.owner });
      }
    }
  }
  // resolve conflicts randomly
  claims.sort(() => Math.random() - 0.5);
  const taken = new Set();
  for (const cl of claims) {
    const k = cl.c + ',' + cl.r;
    const cell = cells[cl.r][cl.c];
    if (!cell.owner && !taken.has(k)) { cell.owner = cl.owner; cell.age = 0; taken.add(k); }
  }
  updateHud();
}

function counts() {
  const n = { you: 0, r1: 0, r2: 0, r3: 0 };
  let seen = 0, total = COLS * ROWS;
  for (const row of cells) for (const cell of row) {
    if (cell.owner) n[cell.owner]++;
    if (cell.seen) seen++;
  }
  return { n, fogPct: Math.round((seen / total) * 100) };
}

function updateHud() {
  const { n, fogPct } = counts();
  statFog.textContent = fogPct + '%';
  statYou.textContent = n.you;
  const order = [...FACTIONS].sort((a, b) => n[b.id] - n[a.id]);
  const max = Math.max(1, ...order.map((f) => n[f.id]));
  boardEl.innerHTML = '';
  order.forEach((f, i) => {
    const li = document.createElement('li');
    if (i === 0) li.className = 'lead';
    li.innerHTML = `<span class="rank">${String(i + 1).padStart(2, '0')}</span>
      <span><span class="name">${f.name}</span><span class="bar"><i style="width:${Math.round((n[f.id] / max) * 100)}%;background:${f.color}"></i></span></span>
      <span class="n">${n[f.id]}</span>`;
    boardEl.appendChild(li);
  });
  render();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#E9E5D7';
  ctx.fillRect(0, 0, W, H);
  // grid dots
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, 3);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c];
    const { x, y } = hexCenter(c, r);
    hexPath(ctx, x, y, HEX_R - 1.5);
    if (!cell.seen) {
      ctx.fillStyle = '#CFCABA';
      ctx.fill();
      ctx.save();
      hexPath(ctx, x, y, HEX_R - 1.5);
      ctx.clip();
      ctx.strokeStyle = 'rgba(17,17,17,.28)';
      ctx.lineWidth = 1;
      for (let d = -HEX_R * 2; d < HEX_R * 2; d += 6) {
        ctx.beginPath(); ctx.moveTo(x - HEX_R + d, y - HEX_R); ctx.lineTo(x + d, y + HEX_R); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      continue;
    }
    const f = FACTIONS.find((f) => f.id === cell.owner);
    ctx.fillStyle = f ? f.color : '#F4F1EA';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = cell.owner ? 2 : 1.2;
    ctx.stroke();
    if (f) {
      // moss stipple
      ctx.fillStyle = f.dark;
      const dots = 3 + Math.min(4, cell.age);
      for (let i = 0; i < dots; i++) {
        const a = (i * 2.4 + cell.c * 0.7 + cell.r * 1.3);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * HEX_R * 0.38, y + Math.sin(a) * HEX_R * 0.38, 2.2, 0, 7);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(17,17,17,.35)';
      ctx.font = '600 9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${c},${r}`, x, y);
    }
  }
  // surveyor token
  const s = hexCenter(surveyor.c, surveyor.r);
  ctx.beginPath(); ctx.arc(s.x, s.y, 13, 0, 7);
  ctx.fillStyle = '#111'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x, s.y - 8); ctx.lineTo(s.x + 5, s.y + 5); ctx.lineTo(s.x - 5, s.y + 5); ctx.closePath();
  ctx.fillStyle = '#E30613'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 7px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center'; ctx.fillText('N', s.x, s.y + 0.5);
}

// --- input: drag paints, tap moves+paints, keys move ---
let painting = false, downPos = null, moved = false;
function eventCell(e) {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W / rect.width);
  const py = (e.clientY - rect.top) * (H / rect.height);
  let bestCell = null, bestD = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const { x, y } = hexCenter(c, r);
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bestD) { bestD = d; bestCell = { c, r }; }
  }
  return bestCell;
}
canvas.addEventListener('pointerdown', (e) => {
  painting = true; moved = false;
  downPos = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  const t = eventCell(e);
  paintAt(t.c, t.r); updateHud();
});
canvas.addEventListener('pointermove', (e) => {
  if (painting) {
    if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) moved = true;
    const t = eventCell(e);
    reveal(t); // hovering explores
    paintAt(t.c, t.r); updateHud();
  } else {
    reveal(eventCell(e)); // scouting by hover lifts fog
    render();
    const { fogPct } = counts();
    statFog.textContent = fogPct + '%';
  }
});
canvas.addEventListener('pointerup', (e) => {
  painting = false;
  if (!moved) { // tap = march surveyor here
    const t = eventCell(e);
    surveyor = t;
    paintAt(t.c, t.r); updateHud();
  }
});
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const d = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
  if (d) {
    e.preventDefault();
    surveyor = {
      c: Math.min(COLS - 1, Math.max(0, surveyor.c + d[0])),
      r: Math.min(ROWS - 1, Math.max(0, surveyor.r + d[1])),
    };
    paintAt(surveyor.c, surveyor.r); updateHud();
  } else if (k === ' ') { e.preventDefault(); pulse(); }
});

function toast(msg) {
  toastEl.hidden = false;
  toastEl.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toastEl.hidden = true), 2200);
}

// --- game loop / timer ---
function restartLoop() {
  clearInterval(pulseTimer); clearInterval(restartLoop._t);
  pulseTimer = setInterval(() => { if ($('optPulse').checked) pulse(); }, 1200);
  restartLoop._t = setInterval(() => {
    if (over) return;
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 10) timerEl.classList.add('low');
    if (timeLeft <= 0) finish();
  }, 1000);
  timerEl.textContent = timeLeft;
}
function finish() {
  over = true;
  clearInterval(pulseTimer); clearInterval(restartLoop._t);
  const { n } = counts();
  const order = [...FACTIONS].sort((a, b) => n[b.id] - n[a.id]);
  const won = order[0].id === 'you';
  const rank = order.findIndex((f) => f.id === 'you') + 1;
  if (n.you > best) {
    best = n.you;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
    statBest.textContent = best;
  }
  $('resultCard').hidden = false;
  $('verdictTag').textContent = won ? 'Winner' : `Rank ${rank}/4`;
  $('verdict').textContent = won
    ? `Moss triumphant — ${n.you} hexes held.`
    : `${order[0].name} wins with ${n[order[0].id]} hexes. You held ${n.you}.`;
  $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  toast(won ? 'Victory — export your map!' : 'Survey closed — try again.');
}

// --- export PNG ---
$('btnPng').addEventListener('click', () => {
  const S = 2;
  const off = document.createElement('canvas');
  off.width = W * S; off.height = (H + 120) * S;
  const g = off.getContext('2d');
  g.scale(S, S);
  g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, W, H + 120);
  g.fillStyle = '#111'; g.fillRect(0, 0, W, 8);
  g.fillStyle = '#111'; g.font = '900 34px Archivo, Helvetica, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText('MOSS COMPASS ATLAS', 24, 52);
  g.fillStyle = '#E30613'; g.fillRect(W - 140, 22, 116, 30);
  g.fillStyle = '#fff'; g.font = '600 13px "IBM Plex Mono", monospace';
  g.fillText('SURVEY Nº 001', W - 130, 42);
  // reuse render by drawing main canvas then caption
  g.drawImage(canvas, 0, 64, W, H);
  const { n } = counts();
  const order = [...FACTIONS].sort((a, b) => n[b.id] - n[a.id]);
  g.fillStyle = '#111'; g.font = '600 12px "IBM Plex Mono", monospace';
  g.fillText(order.map((f, i) => `${i + 1}. ${f.name.toUpperCase()} ${n[f.id]}`).join('   ·   '), 24, H + 96);
  const a = document.createElement('a');
  a.download = 'moss-compass-atlas.png';
  a.href = off.toDataURL('image/png');
  a.click();
  toast('PNG exported.');
});

$('btnNew').addEventListener('click', newGame);
$('btnAgain').addEventListener('click', newGame);
$('btnPulse').addEventListener('click', () => { pulse(); toast('Pulse spread.'); });

newGame();
