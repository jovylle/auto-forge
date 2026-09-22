// Copper Kite 銅凧 — wind sim + kite canvas + gust code
// Plain classic script (file:// safe), no deps. Works from file:// . localStorage persistence.
const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const windSpeedEl = $('windSpeed'), windDirEl = $('windDir'),
  gustCountEl = $('gustCount'), lastKanaEl = $('lastKana'),
  tickerText = $('tickerText'), logEl = $('log'), saveState = $('saveState');

const store = {
  load() { try { return JSON.parse(localStorage.getItem('copper-kite-v2') || '{}'); } catch { return {}; } },
  save(s) { try { localStorage.setItem('copper-kite-v2', JSON.stringify(s)); saveState.textContent = 'saved ✓ ' + new Date().toLocaleTimeString(); } catch {}
  }
};
const saved = store.load();

// ---- state ----
const S = {
  base: saved.base ?? 12, turb: saved.turb ?? 55, dirDeg: saved.dirDeg ?? 90,
  auto: saved.auto ?? true, gusts: saved.gusts ?? 0,
  log: saved.log ?? [], // [{kana, code, t}]
  t: 0, wind: { speed: 4, dir: Math.PI / 2 },
  gustEnv: 0, gustCool: 0, pulse: 0, // manual pump
  codeBuf: '', ticker: saved.ticker ?? '… listening to the wind … カゼ ヲ ヨム …',
  pointer: null, dragging: false,
};

// Morse-ish → katakana map (2–3 symbols). ・= short, ー = long.
const KANA = {
  '・ー': 'ア', 'ー・': 'イ', '・・': 'ウ', 'ーー': 'エ', '・ー・': 'オ',
  '・・ー': 'カ', 'ー・・': 'キ', '・ーー': 'ク', 'ー・ー': 'ケ', '・・・': 'コ',
  'ーー・': 'サ', '・ーー・': 'シ', 'ー・・ー': 'ス', '・・ー・': 'セ', 'ーーー': 'ソ',
  '・ー・・': 'タ', 'ー・ー・': 'チ', '・・ーー': 'ツ', 'ーー・・': 'テ', '・ー・ー': 'ト',
  'ー・・・': 'ナ', '・・ー・・': 'ニ', 'ーー・ー': '風', '・ーーー': '凧', 'ー・ーー': '銅',
};
const DIRS = [[ '北 N', 270 ], [ '東 E', 90 ], [ '南 S', 180 ], [ '西 W', 0 ]];
function dirName(deg) {
  let best = DIRS[0], bd = 1e9;
  for (const d of DIRS) { const df = Math.abs(((deg - d[1] + 540) % 360) - 180); if (df < bd) { bd = df; best = d; } }
  return best[0];
}

// ---- controls ----
const baseWind = $('baseWind'), turb = $('turb'), dir = $('dir');
baseWind.value = S.base; turb.value = S.turb; dir.value = S.dirDeg;
function syncLabels() {
  $('baseWindOut').textContent = baseWind.value;
  $('turbOut').textContent = turb.value;
  $('dirOut').textContent = dir.value + '°';
}
syncLabels();
function persist() { store.save({ base: S.base, turb: S.turb, dirDeg: S.dirDeg, auto: S.auto, gusts: S.gusts, log: S.log.slice(-24), ticker: S.ticker }); }
for (const el of [baseWind, turb, dir]) el.addEventListener('input', () => {
  S.base = +baseWind.value; S.turb = +turb.value; S.dirDeg = +dir.value; syncLabels(); persist();
});
const autoBtn = $('autoBtn');
function syncAuto() { autoBtn.textContent = 'AUTO: ' + (S.auto ? 'ON' : 'OFF'); autoBtn.setAttribute('aria-pressed', String(S.auto)); }
syncAuto();
autoBtn.addEventListener('click', () => { S.auto = !S.auto; syncAuto(); persist(); });
$('clearBtn').addEventListener('click', () => { S.log = []; S.codeBuf = ''; renderLog(); S.ticker = '… wire cleared …'; persist(); });
$('gustBtn').addEventListener('click', () => pumpGust(1));
$('copyBtn').addEventListener('click', async () => {
  const txt = S.log.map(e => `${e.kana} ${e.code}`).join(' / ') || S.ticker;
  try { await navigator.clipboard.writeText('COPPER KITE 銅凧 :: ' + txt); $('copyBtn').textContent = 'COPIED!'; }
  catch { $('copyBtn').textContent = 'SELECT+CTRL+C'; window.prompt('Copy transmissions:', txt); }
  setTimeout(() => $('copyBtn').textContent = 'COPY', 1200);
});
function pumpGust(power = 1) { S.pulse = Math.min(2.2, S.pulse + power); spawnGust(); }
window.addEventListener('keydown', (e) => {
  if (e.key === 'g' || e.key === 'G' || e.key === ' ') { e.preventDefault(); pumpGust(0.8); }
  if (e.key === 'ArrowLeft') { S.dirDeg = (S.dirDeg + 350) % 360; dir.value = S.dirDeg; syncLabels(); }
  if (e.key === 'ArrowRight') { S.dirDeg = (S.dirDeg + 10) % 360; dir.value = S.dirDeg; syncLabels(); }
});

// pointer: drag steers kite + injects local gust
function evPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
canvas.addEventListener('pointerdown', (e) => { S.dragging = true; canvas.setPointerCapture(e.pointerId); S.pointer = evPos(e); S.pulse = Math.min(2, S.pulse + 0.5); });
canvas.addEventListener('pointermove', (e) => { if (S.dragging) S.pointer = evPos(e); });
canvas.addEventListener('pointerup', () => { S.dragging = false; S.pointer = null; });

// ---- wind field ----
// layered sines ≈ cheap noise; gust envelope adds telegraph events
function field(x, y, t) {
  const turbAmt = S.turb / 100;
  const a = Math.sin(x * 3.1 + t * 0.7) + 0.6 * Math.sin(x * 7.3 - t * 1.3 + y * 4.0);
  const b = Math.cos(y * 2.6 - t * 0.5) + 0.6 * Math.sin(y * 6.1 + t * 1.1 + x * 3.0);
  const base = S.base / 10; // 0..3
  const spd = Math.max(0.2, base * 2.2 + a * turbAmt * 2.4 + S.gustEnv * 6 + S.pulse * 4);
  const dirR = (S.dirDeg * Math.PI / 180) + b * turbAmt * 0.9;
  return { spd, dx: Math.cos(dirR), dy: Math.sin(dirR) * 0.55 };
}

// ---- actors ----
const W = () => canvas.width, H = () => canvas.height;
const anchor = { x: 0.5, y: 0.98 };
const kite = { x: 0.5, y: 0.42, vx: 0, vy: 0, ang: 0 };
const tail = Array.from({ length: 9 }, (_, i) => ({ x: 0.5, y: 0.5 + i * 0.03 }));
const parts = Array.from({ length: 130 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.6, o: 0.25 + Math.random() * 0.6 }));
const pulses = []; // telegraph sparks travelling down the string

function spawnGust(big = false) {
  S.gusts++; gustCountEl.textContent = S.gusts;
  S.gustEnv = Math.min(2.4, S.gustEnv + (big ? 1.6 : 1.0));
  emitSymbol(S.gustEnv > 1.4 ? 'ー' : '・');
  const li = logEl.querySelector('li'); if (li) li.classList.add('gust-flash');
  persist();
}

// gust code: accumulate symbols, decode every 2-4 into kana
function emitSymbol(sym) {
  S.codeBuf += sym;
  S.ticker = (S.ticker + ' ' + sym).slice(-90);
  // spark down the wire
  pulses.push({ p: 0, sym });
  if (S.codeBuf.length >= 2 && (S.codeBuf.length >= 3 || Math.random() < 0.45)) {
    const chunk = S.codeBuf.slice(0, 3);
    const key2 = S.codeBuf.slice(0, 2);
    const kana = KANA[chunk] || KANA[key2] || '・';
    const used = KANA[chunk] ? 3 : 2;
    const code = S.codeBuf.slice(0, used);
    S.codeBuf = S.codeBuf.slice(used);
    const entry = { kana, code, t: new Date().toLocaleTimeString() };
    S.log.push(entry); S.log = S.log.slice(-24);
    lastKanaEl.textContent = kana + ' ' + code;
    S.ticker = (S.ticker + ' → ' + kana).slice(-90);
    renderLog(); persist();
  }
  tickerText.textContent = S.ticker;
}

function renderLog() {
  logEl.innerHTML = '';
  for (const e of [...S.log].reverse().slice(0, 14)) {
    const li = document.createElement('li');
    const kn = document.createElement('span'); kn.className = 'kana'; kn.textContent = e.kana;
    const cd = document.createElement('span'); cd.className = 'code'; cd.textContent = e.code;
    const tm = document.createElement('time'); tm.textContent = e.t;
    li.append(kn, cd, tm); logEl.appendChild(li);
  }
  if (!S.log.length) { const li = document.createElement('li'); li.textContent = 'no transmissions yet — pump a gust ⚡'; logEl.appendChild(li); }
}
renderLog();
tickerText.textContent = S.ticker;
gustCountEl.textContent = S.gusts;

// auto gusts
setInterval(() => {
  if (!S.auto || document.hidden) return;
  if (S.gustCool <= 0 && Math.random() < 0.12 + (S.turb / 100) * 0.35) { spawnGust(Math.random() < 0.3); S.gustCool = 2 + Math.random() * 5; }
}, 700);

// ---- main loop ----
let last = performance.now();
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.round(r.width * dpr));
  canvas.height = Math.round(canvas.width * 5 / 8);
}
new ResizeObserver(fit).observe(canvas); fit();

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  S.t += dt;
  S.gustCool -= dt;
  S.gustEnv = Math.max(0, S.gustEnv - dt * 0.55);
  S.pulse = Math.max(0, S.pulse - dt * 1.1);

  // global wind at kite
  const f = field(kite.x, kite.y, S.t);
  S.wind = { speed: f.spd, dir: Math.atan2(f.dy, f.dx) };

  // kite physics: lift vs gravity + string constraint
  const lift = f.spd * 0.55;
  let ax = f.dx * lift * 0.9;
  let ay = -lift * 0.75 + 0.55; // gravity pulls down
  // pointer steering
  const steer = S.pointer;
  if (S.dragging && steer) { ax += (steer.x - kite.x) * 6; ay += (steer.y - kite.y) * 6; }
  kite.vx = (kite.vx + ax * dt) * (1 - dt * 1.4);
  kite.vy = (kite.vy + ay * dt) * (1 - dt * 1.4);
  kite.x += kite.vx * dt * 0.55; kite.y += kite.vy * dt * 0.55;
  // string max length
  const dx = kite.x - anchor.x, dy = kite.y - anchor.y;
  const dist = Math.hypot(dx, dy), maxL = 0.86;
  if (dist > maxL) { kite.x = anchor.x + dx / dist * maxL; kite.y = anchor.y + dy / dist * maxL; }
  kite.x = Math.min(0.97, Math.max(0.03, kite.x)); kite.y = Math.min(0.92, Math.max(0.06, kite.y));
  kite.ang += ((Math.atan2(f.dy, -f.dx) * 0.3) - kite.ang) * dt * 3;

  // tail follows
  let px = kite.x, py = kite.y + 0.035;
  for (const seg of tail) {
    seg.x += (px - seg.x) * dt * 7 + f.dx * f.spd * dt * 0.05;
    seg.y += (py - seg.y) * dt * 7 + 0.012 * dt * 10;
    px = seg.x; py = seg.y;
  }
  // particles advect
  for (const p of parts) {
    const pf = field(p.x, p.y, S.t);
    p.x += pf.dx * pf.spd * dt * 0.14 * p.s;
    p.y += pf.dy * pf.spd * dt * 0.14 * p.s + dt * 0.008;
    if (p.x > 1.02) p.x = -0.02; if (p.x < -0.02) p.x = 1.02;
    if (p.y > 1.02) p.y = -0.02; if (p.y < -0.02) p.y = 1.02;
  }
  for (const pu of pulses) pu.p += dt * 1.4;
  for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].p > 1) pulses.splice(i, 1);

  draw(f);
  // HUD ~ every frame cheap
  windSpeedEl.textContent = (2 + S.wind.speed * 1.35).toFixed(1) + ' m/s';
  windDirEl.textContent = dirName(S.dirDeg);
  requestAnimationFrame(step);
}

function draw(f) {
  const w = W(), h = H();
  const X = (v) => v * w, Y = (v) => v * h;
  // sky gradient (ink only — neutrals allowed)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#101018'); g.addColorStop(0.62, '#0B0B10'); g.addColorStop(1, '#050508');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // moon (paper white — neutral)
  ctx.fillStyle = '#F5F1E8';
  ctx.globalAlpha = 0.92;
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.2, h * 0.075, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.2, h * 0.13, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  // skyline: kyoto rooftops + neon windows (copper + teal + neon only)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  ctx.fillStyle = '#E0803A';
  for (let i = 0; i < 26; i++) {
    const bx = (i / 26) * w, bh = h * (0.03 + 0.05 * Math.abs(Math.sin(i * 2.7)));
    ctx.globalAlpha = 0.85; ctx.fillRect(bx + 2, h * 0.86 - bh, w / 26 - 6, bh);
  }
  ctx.globalAlpha = 1;
  // deterministic windows
  for (let i = 0; i < 60; i++) {
    const wx = ((i * 197.3) % 1) * w, wy = h * 0.87 + ((i * 91.7) % 1) * h * 0.1;
    ctx.fillStyle = i % 3 === 0 ? '#27E0C8' : i % 3 === 1 ? '#E0803A' : '#FF2D55';
    ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(S.t * 2 + i));
    ctx.fillRect(wx, wy, 3, 4);
  }
  ctx.globalAlpha = 1;
  // torii silhouette (copper)
  ctx.strokeStyle = '#E0803A'; ctx.lineWidth = Math.max(2, w * 0.004);
  const tx = w * 0.12, ty = h * 0.86;
  ctx.beginPath();
  ctx.moveTo(tx - 34, ty - 64); ctx.lineTo(tx + 34, ty - 64);
  ctx.moveTo(tx - 26, ty - 48); ctx.lineTo(tx + 26, ty - 48);
  ctx.moveTo(tx - 20, ty - 64); ctx.lineTo(tx - 24, ty); ctx.moveTo(tx + 20, ty - 64); ctx.lineTo(tx + 24, ty);
  ctx.stroke();
  // wind particles (teal streaks; gust = neon)
  ctx.lineCap = 'round';
  for (const p of parts) {
    const pf = field(p.x, p.y, S.t);
    const gusty = pf.spd > 4.2;
    ctx.strokeStyle = gusty ? '#FF2D55' : '#27E0C8';
    ctx.globalAlpha = p.o * (gusty ? 0.95 : 0.5);
    ctx.lineWidth = gusty ? 2.2 : 1.3;
    const len = 8 + pf.spd * 7 * p.s;
    ctx.beginPath();
    ctx.moveTo(X(p.x), Y(p.y));
    ctx.lineTo(X(p.x) - pf.dx * len, Y(p.y) - pf.dy * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // string: anchor → kite (copper wire)
  const kx = X(kite.x), ky = Y(kite.y), axp = X(anchor.x), ayp = Y(anchor.y);
  const sag = 30 + (1 - Math.min(1, f.spd / 6)) * 46;
  ctx.strokeStyle = '#E0803A'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(axp, ayp);
  ctx.quadraticCurveTo((axp + kx) / 2, (ayp + ky) / 2 + sag, kx, ky); ctx.stroke();
  // telegraph pulses down the wire
  for (const pu of pulses) {
    const t = pu.p, mx = (1 - t) * (1 - t) * axp + 2 * (1 - t) * t * ((axp + kx) / 2) + t * t * kx;
    const my = (1 - t) * (1 - t) * ayp + 2 * (1 - t) * t * ((ayp + ky) / 2 + sag) + t * t * ky;
    ctx.fillStyle = pu.sym === 'ー' ? '#FF2D55' : '#27E0C8';
    ctx.beginPath(); ctx.arc(mx, my, pu.sym === 'ー' ? 7 : 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#F5F1E8'; ctx.font = `${pu.sym === 'ー' ? 11 : 10}px monospace`;
    ctx.fillText(pu.sym, mx + 9, my + 4);
  }
  // holder (paper)
  ctx.fillStyle = '#F5F1E8';
  ctx.beginPath(); ctx.arc(axp, ayp, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#0B0B10'; ctx.font = 'bold 9px monospace'; ctx.fillText('持', axp - 4.5, ayp + 3);
  // kite: diamond, copper sail + neon spine + paper cross
  ctx.save(); ctx.translate(kx, ky); ctx.rotate(kite.ang + Math.sin(S.t * 3) * 0.08);
  const s = Math.min(w, h) * 0.085;
  ctx.fillStyle = '#E0803A';
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.72, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#FF2D55'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
  ctx.strokeStyle = '#F5F1E8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-s * 0.72, 0); ctx.lineTo(s * 0.72, 0); ctx.stroke();
  ctx.fillStyle = '#0B0B10'; ctx.font = `800 ${Math.round(s * 0.5)}px serif`; ctx.textAlign = 'center';
  ctx.fillText('銅', 0, s * 0.18);
  ctx.restore();
  // tail ribbons alternate teal/neon
  tail.forEach((seg, i) => {
    ctx.fillStyle = i % 2 ? '#FF2D55' : '#27E0C8';
    ctx.save(); ctx.translate(X(seg.x), Y(seg.y)); ctx.rotate(Math.sin(S.t * 5 + i) * 0.6);
    ctx.fillRect(-6, -3, 12, 6); ctx.restore();
  });
  // wind comb readout (mono, teal)
  ctx.fillStyle = '#27E0C8'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`風 ${S.wind.speed.toFixed(1)} · ${dirName(S.dirDeg)} · GUST×${S.gusts}`, 10, 18);
  // big vertical kanji watermark (copper, faint)
  ctx.fillStyle = '#E0803A'; ctx.globalAlpha = 0.14;
  ctx.font = `800 ${Math.round(h * 0.34)}px serif`; ctx.textAlign = 'right';
  ctx.fillText('風', w - 8, h * 0.5);
  ctx.globalAlpha = 1;
}
requestAnimationFrame(step);
persist();
console.log('copper-kite ready: wind sim + kite canvas + gust code');
