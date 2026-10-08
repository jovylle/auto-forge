// Pocket Sundial Loops — cyberpunk daylight remixer
// Canvas-only, keyboard-first, file:// ready. No deps.
'use strict';
const $ = (id) => document.getElementById(id);
const dialCanvas = $('dial'), track = $('sunTrack');
const dctx = dialCanvas.getContext('2d'), tctx = track.getContext('2d');
const orb = $('sunOrb'), slider = $('timeSlider'), timeOut = $('timeOut');
const clockTime = $('clockTime'), clockDial = $('clockDial'), dialEra = $('dialEra'), blurb = $('dialBlurb');
const dialGrid = $('dialGrid'), playBtn = $('playBtn'), loopBtn = $('loopBtn'), trailBtn = $('trailBtn');
const trailLen = $('trailLen'), trailLenOut = $('trailLenOut'), fadeAmt = $('fadeAmt'), fadeOut = $('fadeOut');
const remixChk = $('remixChk'), droneChk = $('droneChk'), clearTrailBtn = $('clearTrailBtn');
const loopBar = $('loopBar'), loopLabel = $('loopLabel'), loopMeter = $('loopMeter'), loopLen = $('loopLen'), loopBadge = $('loopBadge');
const gifBtn = $('gifBtn'), pngBtn = $('pngBtn'), gifSize = $('gifSize'), exportStatus = $('exportStatus'), shots = $('shots');

/* ---------- state ---------- */
const MIN = 240, MAX = 1200; // 04:00–20:00
const store = (() => { try { return JSON.parse(localStorage.getItem('pocket-sundial-loops') || '{}'); } catch { return {}; } })();
const save = () => { try { localStorage.setItem('pocket-sundial-loops', JSON.stringify({ dial: S.dial, trails: S.trails, remix: S.remix, m: Math.round(S.m) })); } catch {} };
const S = {
  m: store.m ?? 360, dial: store.dial ?? 0, playing: false,
  trails: store.trails ?? true, trailMax: 160, fade: 10, remix: store.remix ?? true,
  tips: [], loop: { mode: 'idle', buf: [], t0: 0, playT: 0, len: 8 },
  drone: null, lastTs: 0,
};
trailLen.value = 160; fadeAmt.value = S.fade;

/* ---------- 12 historic dials ---------- */
const DIALS = [
  { name: 'Egyptian Shadow Clock', era: 'c. 1500 BCE · Egypt', face: 'bar', warp: 1.35, len: 1.1, blurb: 'Shadow clock — a crossbar casts a travelling shadow across hour marks. Drag the sun.' },
  { name: 'Babylonian Hemisphere', era: 'c. 1000 BCE · Babylon', face: 'bowl', warp: 1.0, len: 0.7, blurb: 'Hemispherical bowl — the bead-shadow crawls the curved belly of the sky.' },
  { name: 'Greek Skaphe', era: 'c. 300 BCE · Alexandria', face: 'bowl2', warp: 0.9, len: 0.8, blurb: 'Skaphe — Berossus’ bowl. Hour arcs bend with the season line.' },
  { name: 'Roman Horizontal', era: 'c. 10 BCE · Rome', face: 'circle', warp: 1.0, len: 1.0, blurb: 'Roman Humber — radial hour lines fan across a bronze disc.' },
  { name: 'Chinese Equatorial', era: 'c. 1000 CE · Song', face: 'ring', warp: 1.0, len: 0.9, blurb: 'Equatorial ring — the rod points at Polaris; shadow rides the inner band.' },
  { name: 'Islamic Qibla Dial', era: 'c. 1200 · Damascus', face: 'qibla', warp: 1.12, len: 1.0, blurb: 'Marble court dial — prayer arcs cross the qibla curve.' },
  { name: 'Mass Dial', era: 'c. 1300 · England', face: 'wall', warp: 1.5, len: 0.9, blurb: 'Church scratch dial — a peg gnomon scores mass-hours into stone.' },
  { name: 'Renaissance Garden', era: 'c. 1550 · Padua', face: 'garden', warp: 1.0, len: 1.15, blurb: 'Garden horizontal — ornate chapter ring with motto arc.' },
  { name: 'Polar Dial', era: 'c. 1600 · Augsburg', face: 'polar', warp: 0.75, len: 1.25, blurb: 'Polar plane — parallel hour lines, long winter shadows.' },
  { name: 'Vertical South', era: 'c. 1700 · Paris', face: 'vert', warp: 1.2, len: 0.85, blurb: 'South wall dial — steep morning fan, flat noon line.' },
  { name: 'Analemmatic', era: 'c. 1750 · Sweden', face: 'ellipse', warp: 1.0, len: 1.0, blurb: 'Analemmatic — YOU are the gnomon. Stand on today’s date point.' },
  { name: 'Neon Grid Dial', era: '2077 · Night City', face: 'digital', warp: 1.0, len: 1.2, blurb: 'Cyberpunk dial — daylight remixed into a signal. Trails drive the halo.' },
];
const SHORT = ['EGYPT', 'BABYLON', 'SKAPHE', 'ROME', 'SONG RING', 'QIBLA', 'MASS', 'PADUA', 'POLAR', 'SUD', 'ANALEM.', 'NEON'];

/* ---------- helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const sunAlt = (m) => Math.sin(Math.PI * (m - MIN) / (MAX - MIN)); // 0..1..0
const baseAng = (m, warp) => lerp(-1.25, 1.25, (m - MIN) / (MAX - MIN)) * warp; // radians-ish fan
const shadowLen = (m, mul) => {
  const a = Math.max(0.06, sunAlt(m));
  return (140 / (0.35 + a * 1.6)) * mul;
};
function fitCanvas(cv, ctx, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.aspectRatio = `${w}/${h}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}
let DW = 720, DH = 520;
function fitAll() {
  const r = fitCanvas(dialCanvas, dctx, 720, 520); DW = r.w; DH = r.h;
  fitCanvas(track, tctx, 720, 86);
}
window.addEventListener('resize', fitAll); fitAll();

/* dial select grid */
const KEYMAP = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 0: 9, q: 10, w: 11 };
DIALS.forEach((d, i) => {
  const key = Object.keys(KEYMAP).find((k) => KEYMAP[k] === i).toUpperCase();
  const b = document.createElement('button');
  b.className = 'dial-cell'; b.setAttribute('role', 'option');
  b.setAttribute('aria-selected', i === S.dial ? 'true' : 'false');
  b.dataset.i = i; b.tabIndex = -1;
  b.innerHTML = `<b>${key} · ${SHORT[i]}</b><span>${d.name}</span><br><small>${d.era}</small>`;
  b.addEventListener('click', () => setDial(i, true));
  dialGrid.appendChild(b);
});
function setDial(i, announce) {
  S.dial = ((i % 12) + 12) % 12; S.tips.length = 0;
  dialGrid.querySelectorAll('.dial-cell').forEach((c) => c.setAttribute('aria-selected', +c.dataset.i === S.dial ? 'true' : 'false'));
  dialEra.textContent = DIALS[S.dial].era;
  blurb.textContent = DIALS[S.dial].blurb;
  clockDial.textContent = DIALS[S.dial].name.toUpperCase();
  if (announce) save();
}

/* ---------- drawing ---------- */
function neon(color, width, glow) {
  dctx.strokeStyle = color; dctx.lineWidth = width;
  dctx.shadowColor = color; dctx.shadowBlur = glow;
  dctx.lineCap = 'round';
}
function faceBackdrop(t) {
  const g = dctx.createLinearGradient(0, 0, 0, DH);
  const day = sunAlt(S.m);
  g.addColorStop(0, `rgba(20,10,50,1)`);
  g.addColorStop(0.55, `rgba(${Math.round(8 + day * 10)},${Math.round(10 + day * 26)},${Math.round(30 + day * 30)},1)`);
  g.addColorStop(1, '#04050c');
  dctx.fillStyle = g; dctx.shadowBlur = 0;
  dctx.fillRect(0, 0, DW, DH);
  // horizon glow
  const hy = 400;
  const hg = dctx.createRadialGradient(DW / 2, hy, 10, DW / 2, hy, 340);
  hg.addColorStop(0, `rgba(255,43,214,${0.10 + day * 0.22})`);
  hg.addColorStop(1, 'rgba(255,43,214,0)');
  dctx.fillStyle = hg; dctx.fillRect(0, 0, DW, DH);
}
function drawHourFan(cx, cy, r, n, a0, a1, color) {
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, i / (n - 1)) - Math.PI / 2;
    dctx.beginPath(); dctx.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32);
    dctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); dctx.stroke();
  }
  dctx.fillStyle = color; dctx.font = '11px "Share Tech Mono",monospace'; dctx.textAlign = 'center';
  for (let i = 0; i < n; i += 2) {
    const a = lerp(a0, a1, i / (n - 1)) - Math.PI / 2;
    const hr = 4 + Math.round(i * (16 / (n - 1)));
    dctx.fillText(String(hr), cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08 + 4);
  }
}
function drawGnomon(cx, cy, hgt) {
  neon('#ffe600', 4, 18);
  dctx.beginPath(); dctx.moveTo(cx, cy); dctx.lineTo(cx, cy - hgt); dctx.stroke();
  dctx.fillStyle = '#fff'; dctx.shadowColor = '#ffe600'; dctx.shadowBlur = 16;
  dctx.beginPath(); dctx.arc(cx, cy - hgt, 5, 0, TAU); dctx.fill();
  dctx.shadowBlur = 0;
}
function drawShadow(cx, cy, ang, len, tipStore) {
  const dx = Math.sin(ang), dy = Math.cos(ang) * 0.55 + 0.25;
  const tx = cx + dx * len, ty = cy + dy * len * 0.6 + 14;
  const grd = dctx.createLinearGradient(cx, cy, tx, ty);
  grd.addColorStop(0, 'rgba(0,240,255,.95)'); grd.addColorStop(1, 'rgba(255,43,214,.15)');
  dctx.strokeStyle = grd; dctx.lineWidth = 7; dctx.lineCap = 'round';
  dctx.shadowColor = '#00f0ff'; dctx.shadowBlur = 18;
  dctx.beginPath(); dctx.moveTo(cx, cy); dctx.lineTo(tx, ty); dctx.stroke();
  dctx.shadowBlur = 0;
  // tip jewel
  dctx.fillStyle = '#ffe600'; dctx.shadowColor = '#ffe600'; dctx.shadowBlur = 14;
  dctx.beginPath(); dctx.arc(tx, ty, 4.5, 0, TAU); dctx.fill(); dctx.shadowBlur = 0;
  if (tipStore) { S.tips.push({ x: tx, y: ty, m: S.m }); while (S.tips.length > S.trailMax) S.tips.shift(); }
  return { x: tx, y: ty };
}
function drawTrails() {
  if (!S.trails || S.tips.length < 2) return;
  for (let i = 1; i < S.tips.length; i++) {
    const p = i / S.tips.length;
    dctx.strokeStyle = `hsla(${185 + p * 125},100%,${35 + p * 30}%,${0.08 + p * 0.85})`;
    dctx.lineWidth = 1 + p * 4; dctx.shadowColor = '#ff2bd6'; dctx.shadowBlur = 8 * p;
    dctx.beginPath(); dctx.moveTo(S.tips[i - 1].x, S.tips[i - 1].y); dctx.lineTo(S.tips[i].x, S.tips[i].y); dctx.stroke();
  }
  dctx.shadowBlur = 0;
}
function drawRemix(cx, cy) {
  if (!S.remix || S.tips.length < 4) return;
  const n = S.tips.length;
  const recent = S.tips.slice(-40);
  let spread = 0;
  for (const p of recent) spread += Math.hypot(p.x - cx, p.y - cy);
  spread /= recent.length;
  const day = sunAlt(S.m), tt = performance.now() / 1000;
  for (let k = 0; k < 5; k++) {
    const r = 40 + k * 26 + Math.sin(tt * (0.6 + k * 0.22) + S.m / 60) * 8 + (spread - 120) * 0.12;
    dctx.strokeStyle = k % 2 ? `rgba(0,240,255,${0.28 - k * 0.04})` : `rgba(255,43,214,${0.28 - k * 0.04})`;
    dctx.lineWidth = 1.5; dctx.shadowBlur = 0;
    dctx.setLineDash([6, 10]); dctx.lineDashOffset = tt * (10 + k * 6) * (k % 2 ? 1 : -1);
    dctx.beginPath(); dctx.ellipse(cx, cy, r * 1.5, r * 0.62, 0, 0, TAU); dctx.stroke();
  }
  dctx.setLineDash([]);
}
function center() { return { cx: DW / 2, cy: 300 }; }

const FACES = {
  bar(d, ang, len) { // egyptian
    const { cx, cy } = center();
    neon('rgba(0,240,255,.5)', 1.5, 6); drawHourFan(cx, cy, 150, 9, -1.2, 1.2, '#8b93b8');
    neon('#00f0ff', 3, 12); dctx.strokeRect(cx - 150, cy - 26, 300, 52);
    dctx.fillStyle = '#ffe600'; dctx.font = '12px "Share Tech Mono"'; dctx.textAlign = 'center';
    dctx.fillText('☀ EGYPT · SHADOW BAR ☀', cx, cy - 44);
    neon('#ff2bd6', 6, 14);
    dctx.beginPath(); dctx.moveTo(cx - 150, cy); dctx.lineTo(cx + 150, cy); dctx.stroke();
    drawShadow(cx, cy, ang, len, true);
  },
  bowl(d, ang, len) {
    const { cx, cy } = center();
    const g = dctx.createRadialGradient(cx, cy - 60, 10, cx, cy, 190);
    g.addColorStop(0, '#0a1030'); g.addColorStop(1, '#131a45');
    dctx.fillStyle = g; dctx.shadowBlur = 0;
    dctx.beginPath(); dctx.ellipse(cx, cy, 180, 120, 0, 0, TAU); dctx.fill();
    neon('#00f0ff', 2, 10);
    for (let k = 1; k <= 3; k++) { dctx.beginPath(); dctx.ellipse(cx, cy, 180 * k / 3.4, 120 * k / 3.4, 0, 0, TAU); dctx.stroke(); }
    drawHourFan(cx, cy, 165, 9, -1.3, 1.3, '#8b93b8');
    drawGnomon(cx, cy, 74); drawShadow(cx, cy - 74, ang, len * 0.9, true);
  },
  bowl2(d, ang, len) { FACES.bowl(d, ang, len); dctx.fillStyle = '#ff2bd6'; dctx.font = '12px "Share Tech Mono"'; dctx.textAlign = 'center'; dctx.fillText('ΣΚΑΦΗ', DW / 2, 132); },
  circle(d, ang, len) {
    const { cx, cy } = center();
    neon('#ffe600', 3, 14); dctx.beginPath(); dctx.arc(cx, cy, 160, 0, TAU); dctx.stroke();
    neon('rgba(0,240,255,.7)', 1.5, 6); drawHourFan(cx, cy, 150, 13, -1.35, 1.35, '#8b93b8');
    dctx.fillStyle = '#ff2bd6'; dctx.font = '12px "Share Tech Mono"'; dctx.textAlign = 'center';
    dctx.fillText('· S · P · Q · R ·', cx, cy + 6);
    drawGnomon(cx, cy, 90); drawShadow(cx, cy - 90, ang, len, true);
  },
  ring(d, ang, len) {
    const { cx, cy } = center();
    dctx.save(); dctx.translate(cx, cy); dctx.rotate(-0.41);
    neon('#00f0ff', 10, 18); dctx.beginPath(); dctx.ellipse(0, 0, 170, 170, 0, 0, TAU); dctx.stroke();
    neon('#ffe600', 2, 8);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; dctx.beginPath(); dctx.moveTo(Math.cos(a) * 150, Math.sin(a) * 150); dctx.lineTo(Math.cos(a) * 170, Math.sin(a) * 170); dctx.stroke(); }
    dctx.restore();
    neon('#ff2bd6', 4, 12);
    dctx.beginPath(); dctx.moveTo(cx - 60, cy + 110); dctx.lineTo(cx + 60, cy - 110); dctx.stroke();
    drawShadow(cx, cy, ang, len, true);
    dctx.fillStyle = '#8b93b8'; dctx.textAlign = 'center'; dctx.fillText(' equatorial · 23.5° ', cx, cy + 150);
  },
  qibla(d, ang, len) {
    const { cx, cy } = center();
    neon('#00f0ff', 2, 8); dctx.strokeRect(cx - 170, cy - 110, 340, 220);
    neon('#ff2bd6', 2, 10);
    dctx.beginPath(); dctx.arc(cx - 170, cy + 110, 240, -1.1, -0.2); dctx.stroke(); // qibla arc
    drawHourFan(cx, cy, 165, 11, -1.3, 1.3, '#8b93b8');
    drawGnomon(cx, cy, 80); drawShadow(cx, cy - 80, ang, len, true);
  },
  wall(d, ang, len) {
    const { cx, cy } = center();
    dctx.fillStyle = '#141a38'; dctx.fillRect(cx - 180, cy - 130, 360, 250);
    neon('rgba(255,230,0,.55)', 1.5, 4);
    for (let i = 0; i < 7; i++) { const a = lerp(-1.2, 1.2, i / 6); dctx.beginPath(); dctx.moveTo(cx, cy); dctx.lineTo(cx + Math.sin(a) * 150, cy + Math.cos(a) * 90); dctx.stroke(); }
    neon('#8b93b8', 3, 6); dctx.strokeRect(cx - 180, cy - 130, 360, 250);
    dctx.fillStyle = '#ffe600'; dctx.beginPath(); dctx.arc(cx, cy, 7, 0, TAU); dctx.fill();
    drawShadow(cx, cy, ang * 1.2, len * 0.8, true);
  },
  garden(d, ang, len) {
    const { cx, cy } = center();
    neon('#ffe600', 2.5, 12); dctx.beginPath(); dctx.arc(cx, cy, 165, 0, TAU); dctx.stroke();
    neon('#ff2bd6', 1.5, 8); dctx.beginPath(); dctx.arc(cx, cy, 140, 0, TAU); dctx.stroke();
    drawHourFan(cx, cy, 150, 13, -1.35, 1.35, '#ffe600');
    dctx.fillStyle = '#8b93b8'; dctx.textAlign = 'center'; dctx.font = 'italic 13px Georgia,serif';
    dctx.fillText('“horas non numero nisi serenas”', cx, cy + 190);
    drawGnomon(cx, cy, 95); drawShadow(cx, cy - 95, ang, len, true);
  },
  polar(d, ang, len) {
    const { cx, cy } = center();
    dctx.save(); dctx.translate(cx, cy); dctx.rotate(0.0);
    neon('#00f0ff', 2, 8); dctx.strokeRect(-180, -70, 360, 170);
    neon('rgba(255,230,0,.7)', 1.5, 5);
    for (let i = -6; i <= 6; i++) { dctx.beginPath(); dctx.moveTo(i * 26, -70); dctx.lineTo(i * 26, 100); dctx.stroke(); }
    dctx.restore();
    neon('#ff2bd6', 4, 10);
    dctx.beginPath(); dctx.moveTo(cx - 180, cy - 70); dctx.lineTo(cx + 180, cy - 70); dctx.stroke();
    drawShadow(cx, cy - 70, ang * 0.6, len * 1.1, true);
  },
  vert(d, ang, len) {
    const { cx, cy } = center();
    dctx.fillStyle = '#10142a'; dctx.fillRect(cx - 170, cy - 140, 340, 260);
    neon('#00f0ff', 2, 8); dctx.strokeRect(cx - 170, cy - 140, 340, 260);
    neon('rgba(255,43,214,.8)', 1.5, 6);
    for (let i = 0; i < 9; i++) { const a = lerp(-1.1, 1.1, i / 8); dctx.beginPath(); dctx.moveTo(cx, cy - 40); dctx.lineTo(cx + Math.sin(a) * 160, cy - 40 + Math.abs(Math.cos(a)) * 120); dctx.stroke(); }
    dctx.fillStyle = '#ffe600'; dctx.beginPath(); dctx.arc(cx, cy - 40, 6, 0, TAU); dctx.fill();
    drawShadow(cx, cy - 40, ang, len, true);
  },
  ellipse(d, ang, len) {
    const { cx, cy } = center();
    neon('#00f0ff', 2.5, 12); dctx.beginPath(); dctx.ellipse(cx, cy, 190, 110, 0, 0, TAU); dctx.stroke();
    dctx.fillStyle = '#8b93b8'; dctx.font = '11px "Share Tech Mono"'; dctx.textAlign = 'center';
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    months.forEach((mo, i) => { const y = cy + lerp(-70, 70, i / 11); dctx.fillText(mo, cx, y); });
    // walker gnomon stands on date line
    const gx = cx + Math.sin(ang) * 60;
    neon('#ffe600', 4, 12);
    dctx.beginPath(); dctx.moveTo(gx, cy + 40); dctx.lineTo(gx, cy - 40); dctx.stroke();
    dctx.fillStyle = '#fff'; dctx.beginPath(); dctx.arc(gx, cy - 46, 6, 0, TAU); dctx.fill();
    drawShadow(gx, cy - 40, ang, len * 0.9, true);
  },
  digital(d, ang, len) {
    const { cx, cy } = center();
    const day = sunAlt(S.m);
    neon('#ff2bd6', 3, 16); dctx.beginPath(); dctx.arc(cx, cy, 160, 0, TAU); dctx.stroke();
    neon('#00f0ff', 6, 18);
    dctx.beginPath(); dctx.arc(cx, cy, 160, -Math.PI / 2, -Math.PI / 2 + TAU * (S.m - MIN) / (MAX - MIN)); dctx.stroke();
    dctx.fillStyle = '#ffe600'; dctx.font = '700 44px Orbitron,sans-serif'; dctx.textAlign = 'center';
    dctx.shadowColor = '#ffe600'; dctx.shadowBlur = 18;
    dctx.fillText(fmt(S.m), cx, cy + 8); dctx.shadowBlur = 0;
    dctx.fillStyle = '#8b93b8'; dctx.font = '11px "Share Tech Mono"';
    dctx.fillText(`ALT ${(day * 65).toFixed(1)}° · GRID.SYNC`, cx, cy + 34);
    drawGnomon(cx, cy + 110, 60); drawShadow(cx, cy + 50, ang, len * 0.7, true);
  },
};

function render() {
  const d = DIALS[S.dial];
  const ang = baseAng(S.m, d.warp), len = shadowLen(S.m, d.len);
  faceBackdrop();
  // fade wash for trails persistence feel
  dctx.fillStyle = `rgba(4,5,12,${S.fade / 220})`;
  dctx.fillRect(0, 0, DW, DH);
  drawTrails();
  const { cx, cy } = center();
  drawRemix(cx, cy);
  (FACES[d.face] || FACES.circle)(d, ang, len);
  // vignette
  const v = dctx.createRadialGradient(DW / 2, DH / 2, 200, DW / 2, DH / 2, 480);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  dctx.fillStyle = v; dctx.fillRect(0, 0, DW, DH);
  drawTrack();
  syncChrome();
}
function drawTrack() {
  const w = 720, h = 86;
  tctx.clearRect(0, 0, w, h);
  tctx.strokeStyle = 'rgba(0,240,255,.6)'; tctx.lineWidth = 2;
  tctx.shadowColor = '#00f0ff'; tctx.shadowBlur = 8;
  tctx.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const t = x / w, y = 70 - Math.sin(t * Math.PI) * 52;
    x === 0 ? tctx.moveTo(x, y) : tctx.lineTo(x, y);
  }
  tctx.stroke(); tctx.shadowBlur = 0;
  tctx.fillStyle = '#8b93b8'; tctx.font = '10px "Share Tech Mono"'; tctx.textAlign = 'center';
  for (let hr = 4; hr <= 20; hr += 2) {
    const x = ((hr * 60 - MIN) / (MAX - MIN)) * w;
    tctx.fillText(String(hr).padStart(2, '0'), x, 82);
  }
  const p = (S.m - MIN) / (MAX - MIN);
  orb.style.left = `calc(${p * 100}% )`;
  orb.style.top = `${70 - Math.sin(p * Math.PI) * 52 - 43}px`;
}

/* ---------- time + transport ---------- */
function setTime(m, fromLoop) {
  S.m = clamp(Math.round(m), MIN, MAX);
  slider.value = S.m;
  if (!fromLoop && S.loop.mode === 'rec') S.loop.buf.push({ m: S.m, t: performance.now() });
  if (!fromLoop) saveSoon();
}
let saveT = 0;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }
function syncChrome() {
  const f = fmt(S.m);
  timeOut.textContent = f; clockTime.textContent = f;
  orb.setAttribute('aria-valuenow', S.m); orb.setAttribute('aria-valuetext', f);
  if (document.activeElement !== slider) slider.value = S.m;
}
slider.addEventListener('input', () => setTime(+slider.value));
playBtn.addEventListener('click', togglePlay);
function togglePlay() {
  S.playing = !S.playing;
  playBtn.setAttribute('aria-pressed', S.playing);
  playBtn.textContent = S.playing ? '❚❚ pause' : '▶ cycle';
}
trailBtn.addEventListener('click', () => {
  S.trails = !S.trails;
  trailBtn.setAttribute('aria-pressed', S.trails);
  if (!S.trails) S.tips.length = 0;
  saveSoon();
});
trailLen.addEventListener('input', () => { S.trailMax = +trailLen.value; trailLenOut.textContent = trailLen.value; while (S.tips.length > S.trailMax) S.tips.shift(); });
fadeAmt.addEventListener('input', () => { S.fade = +fadeAmt.value; fadeOut.textContent = fadeAmt.value; });
remixChk.addEventListener('change', () => { S.remix = remixChk.checked; saveSoon(); });
clearTrailBtn.addEventListener('click', () => { S.tips.length = 0; });
if (store.remix === false) remixChk.checked = false;

/* sun drag */
let dragging = false;
function scrubTo(clientX, el) {
  const r = el.getBoundingClientRect();
  const p = clamp((clientX - r.left) / r.width, 0, 1);
  setTime(MIN + p * (MAX - MIN));
}
orb.addEventListener('pointerdown', (e) => { dragging = true; orb.setPointerCapture(e.pointerId); e.preventDefault(); });
window.addEventListener('pointermove', (e) => { if (dragging) scrubTo(e.clientX, orb.parentElement); });
window.addEventListener('pointerup', () => { dragging = false; });
track.addEventListener('pointerdown', (e) => scrubTo(e.clientX, track));
orb.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    setTime(S.m + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 60 : 5));
  } else if (e.key === 'Home') { e.preventDefault(); setTime(MIN); }
  else if (e.key === 'End') { e.preventDefault(); setTime(MAX); }
});

/* loop */
loopBtn.addEventListener('click', toggleLoop);
loopLen.addEventListener('change', () => { S.loop.len = +loopLen.value; });
function toggleLoop() {
  const L = S.loop;
  if (L.mode === 'idle') {
    L.mode = 'rec'; L.buf = [{ m: S.m, t: performance.now() }]; L.t0 = performance.now(); L.len = +loopLen.value;
    loopBtn.setAttribute('aria-pressed', 'true'); loopBtn.textContent = '■ stop→play';
    loopBar.hidden = false; loopBadge.hidden = true; loopLabel.textContent = `LOOP ${L.len}s · REC …scrub the sun!`;
  } else if (L.mode === 'rec') { startPlay(); }
  else { L.mode = 'idle'; loopBtn.setAttribute('aria-pressed', 'false'); loopBtn.textContent = '◌ loop'; loopBadge.hidden = true; loopBar.hidden = true; }
}
function startPlay() {
  const L = S.loop;
  if (L.buf.length < 2) L.buf.push({ m: S.m, t: performance.now() });
  L.mode = 'play'; L.playT = 0;
  loopBtn.textContent = '❚❚ stop loop'; loopBadge.hidden = false;
  loopLabel.textContent = `LOOP ${L.len}s · PLAY ×∞ — scrub to overdub`;
}
function stepLoop(dt) {
  const L = S.loop;
  if (L.mode === 'rec') {
    const el = (performance.now() - L.t0) / 1000;
    loopMeter.style.width = `${Math.min(100, el / L.len * 100)}%`;
    if (el >= L.len) startPlay();
  } else if (L.mode === 'play') {
    L.playT += dt;
    const span = L.len;
    const t = (L.playT % span) / span; // 0..1
    // interpolate buf by recorded normalized time
    const total = (L.buf[L.buf.length - 1].t - L.buf[0].t) / 1000 || 1;
    const rt = t * total + 0; // seconds into recording
    const t0 = L.buf[0].t;
    let target = L.buf[L.buf.length - 1].m;
    for (let i = 1; i < L.buf.length; i++) {
      if ((L.buf[i].t - t0) / 1000 >= rt) {
        const a = L.buf[i - 1], b = L.buf[i];
        const k = ((rt * 1000) - (a.t - t0)) / Math.max(1, b.t - a.t);
        target = lerp(a.m, b.m, clamp(k, 0, 1)); break;
      }
    }
    setTime(target, true);
    loopMeter.style.width = `${t * 100}%`;
    loopLabel.textContent = `LOOP ${L.len}s · PLAY ${(t * 100) | 0}%`;
  }
}

/* ---------- ambient drone ---------- */
let AC = null, droneNodes = null;
function setDrone(on) {
  droneChk.checked = on;
  if (on && !AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const g = AC.createGain(); g.gain.value = 0.0; g.connect(AC.destination);
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.connect(g);
    const o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110;
    const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.value = 220;
    o1.connect(f); o2.connect(f); o1.start(); o2.start();
    g.gain.linearRampToValueAtTime(0.05, AC.currentTime + 2);
    droneNodes = { g, f, o1, o2 };
  } else if (!on && droneNodes) {
    droneNodes.g.gain.linearRampToValueAtTime(0.0, AC.currentTime + 0.5);
    const dn = droneNodes; setTimeout(() => { try { dn.o1.stop(); dn.o2.stop(); } catch {} }, 700);
    droneNodes = null;
  }
}
droneChk.addEventListener('change', () => setDrone(droneChk.checked));
function stepDrone() {
  if (!droneNodes) return;
  const day = sunAlt(S.m);
  droneNodes.o1.frequency.value = 55 + day * 110 + Math.sin(performance.now() / 3000) * 4;
  droneNodes.o2.frequency.value = 110 + day * 220;
  droneNodes.f.frequency.value = 250 + day * 900;
}

/* ---------- export: PNG + GIF (tiny built-in encoder) ---------- */
function thumb(url, label) {
  const fig = document.createElement('figure');
  const img = document.createElement('img'); img.src = url; img.alt = label;
  const cap = document.createElement('figcaption');
  const a = document.createElement('a'); a.href = url; a.download = label.replace(/\s+/g, '-').toLowerCase() + (label.includes('gif') ? '.gif' : '.png');
  a.textContent = 'save';
  const s = document.createElement('span'); s.textContent = label;
  cap.append(s, a); fig.append(img, cap);
  shots.prepend(fig);
  while (shots.children.length > 4) shots.lastChild.remove();
}
pngBtn.addEventListener('click', () => {
  dialCanvas.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    thumb(url, `still ${fmt(S.m)} png`); exportStatus.textContent = 'PNG snapshot saved below.';
  });
});

/* minimal GIF89a encoder: fixed 8x8x4 (3-3-2) palette = 256 colors, LZW min 8 */
function lzwEncode(minSize, pixels) {
  const clear = 1 << minSize, eoi = clear + 1;
  let codeSize = minSize + 1, next = eoi + 1;
  const dict = new Map();
  const out = []; let acc = 0, bits = 0;
  const emit = (code) => { acc |= code << bits; bits += codeSize; while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; } };
  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i], key = prefix * 256 + k;
    if (dict.has(key)) { prefix = dict.get(key); }
    else {
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++; }
      else { emit(clear); dict.clear(); codeSize = minSize + 1; next = eoi + 1; }
      prefix = k;
    }
  }
  emit(prefix); emit(eoi);
  if (bits) out.push(acc & 255);
  return out;
}
function encodeGIF(frames, w, h, delayCs) {
  const B = [];
  const str = (s) => { for (const c of s) B.push(c.charCodeAt(0)); };
  const u16 = (v) => { B.push(v & 255, (v >> 8) & 255); };
  str('GIF89a'); u16(w); u16(h); B.push(0xF7, 0, 0);
  for (let i = 0; i < 256; i++) { // 3-3-2 palette
    B.push(((i >> 5) & 7) * 36, ((i >> 2) & 7) * 36, (i & 3) * 85);
  }
  str('!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00'); // loop forever
  for (const px of frames) {
    B.push(0x21, 0xF9, 4, 0x04, delayCs & 255, (delayCs >> 8) & 255, 0, 0);
    B.push(0x2C, 0, 0, 0, 0); u16(w); u16(h); B.push(0, 8);
    const comp = lzwEncode(8, px);
    for (let i = 0; i < comp.length; i += 255) {
      const n = Math.min(255, comp.length - i);
      B.push(n); for (let j = 0; j < n; j++) B.push(comp[i + j]);
    }
    B.push(0);
  }
  B.push(0x3B);
  return new Blob([new Uint8Array(B)], { type: 'image/gif' });
}
function quant332(img) {
  const d = img.data, out = new Array(img.width * img.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    out[j] = ((d[i] >> 5) << 5) | ((d[i + 1] >> 5) << 2) | (d[i + 2] >> 6);
  }
  return out;
}
gifBtn.addEventListener('click', async () => {
  gifBtn.disabled = true;
  exportStatus.textContent = 'Rendering GIF — scrubbing a full day…';
  try {
    const W = +gifSize.value, H = Math.round(W * 520 / 720);
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const octx = off.getContext('2d', { willReadFrequently: true });
    const keepM = S.m, keepTrail = [...S.tips];
    const NF = 12, frames = [];
    S.tips.length = 0;
    for (let f = 0; f < NF; f++) {
      S.m = MIN + (f / (NF - 1)) * (MAX - MIN);
      render();
      octx.drawImage(dialCanvas, 0, 0, dialCanvas.width, dialCanvas.height, 0, 0, W, H);
      frames.push(quant332(octx.getImageData(0, 0, W, H)));
      exportStatus.textContent = `Rendering GIF ${f + 1}/${NF}…`;
      await new Promise((r) => setTimeout(r, 10));
    }
    S.m = keepM; S.tips = keepTrail; render();
    const blob = encodeGIF(frames, W, H, 12);
    const url = URL.createObjectURL(blob);
    thumb(url, `loop ${fmt(keepM)} gif`);
    exportStatus.textContent = `GIF ready (${W}px, ${NF} frames) — click save.`;
    save();
  } catch (err) { exportStatus.textContent = 'GIF failed: ' + err.message; }
  gifBtn.disabled = false;
});

/* ---------- keyboard ---------- */
$('helpBtn').addEventListener('click', () => $('helpDialog').showModal());
dialGrid.addEventListener('keydown', (e) => {
  const cells = [...dialGrid.querySelectorAll('.dial-cell')];
  const idx = cells.findIndex((c) => c.getAttribute('aria-selected') === 'true');
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setDial((idx + 1) % 12, true); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setDial((idx + 11) % 12, true); }
});
window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName || '';
  const type = (e.target.type || '').toLowerCase();
  const isTextEntry = tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(type)) || e.target.isContentEditable;
  if (isTextEntry && e.key.length === 1) return; // let typing happen
  if (e.target === slider && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; // native scrub
  const k = e.key.toLowerCase();
  if (e.key === ' ' && !e.target.matches('button,input,select')) { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowLeft' && !e.target.matches('input')) { setTime(S.m - (e.shiftKey ? 60 : 5)); }
  else if (e.key === 'ArrowRight' && !e.target.matches('input')) { setTime(S.m + (e.shiftKey ? 60 : 5)); }
  else if (e.key === 'Home' && !e.target.matches('input')) setTime(MIN);
  else if (e.key === 'End' && !e.target.matches('input')) setTime(MAX);
  else if (k in KEYMAP) setDial(KEYMAP[k], true);
  else if (k === 'l') toggleLoop();
  else if (k === 't') trailBtn.click();
  else if (k === 'r') S.tips.length = 0;
  else if (k === 'e') gifBtn.click();
  else if (k === 's') pngBtn.click();
  else if (k === 'm') setDrone(!droneChk.checked);
});

/* ---------- main loop ---------- */
function tick(ts) {
  const dt = Math.min(0.1, (ts - (S.lastTs || ts)) / 1000 || 0.016);
  S.lastTs = ts;
  if (S.playing) {
    let nm = S.m + dt * 60; // 1 hr per 10 s
    if (nm > MAX) nm = MIN;
    setTime(nm, true);
  }
  stepLoop(dt); stepDrone(); render();
  requestAnimationFrame(tick);
}
setDial(S.dial, false);
trailLenOut.textContent = S.trailMax = 160;
trailLen.value = 160;
setTime(S.m);
syncChrome();
console.log('pocket-sundial-loops ready');
requestAnimationFrame(tick);
