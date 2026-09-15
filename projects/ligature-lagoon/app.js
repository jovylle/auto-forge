// Ligature Lagoon — steampunk type-tide engine. Plain canvas, no deps.
const $ = (id) => document.getElementById(id);
const canvas = $('lagoon'), ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const LIGS = [
  { keys: ['fi'], glyph: 'ﬁ', name: 'fi' },
  { keys: ['fl'], glyph: 'ﬂ', name: 'fl' },
  { keys: ['ff'], glyph: 'ﬀ', name: 'ff' },
  { keys: ['ffi'], glyph: 'ﬃ', name: 'ffi' },
  { keys: ['ffl'], glyph: 'ﬄ', name: 'ffl' },
  { keys: ['ft'], glyph: 'f͡t', name: 'ft' },
  { keys: ['st'], glyph: 'ﬆ', name: 'st' },
  { keys: ['ct'], glyph: 'c͡t', name: 'ct' },
  { keys: ['ae'], glyph: 'æ', name: 'ae' },
  { keys: ['oe'], glyph: 'œ', name: 'oe' },
  { keys: ['AE'], glyph: 'Æ', name: 'AE' },
  { keys: ['OE'], glyph: 'Œ', name: 'OE' },
  { keys: ['ss'], glyph: 'ß', name: 'ss' },
  { keys: ['th'], glyph: 'þ', name: 'th' },
];
const LIG_LOOKUP = new Map();
LIGS.forEach((l) => l.keys.forEach((k) => LIG_LOOKUP.set(k, l)));
const WORDS = ['brass', 'steam', 'copper', 'rivet', 'boiler', 'kraken', 'nautilus', 'gear', 'aether', 'lagoon', 'ligature', 'tide', 'valve', 'piston', 'chronometer'];

const store = JSON.parse(localStorage.getItem('liglagoon1') || '{}');
const settings = Object.assign({ tide: 50, current: 60, weight: 560, opsz: 48, slant: 0, auto: true }, store.settings || {});
const found = new Set(store.found || []);
let counts = Object.assign({ lig: 0, stir: 0 }, store.counts || {});

// --- state ---
let letters = [], blooms = [], parts = [], vortices = [], bubbles = [];
let grabbed = null, grabOff = { x: 0, y: 0 };
let pointer = { x: 0, y: 0, px: 0, py: 0, down: false, speed: 0 };
let kraken = false, t = 0, last = performance.now();
let pairCooldown = new Map();
let typedBuf = '';

// --- controls ---
const cTide = $('cTide'), cCurrent = $('cCurrent'), cWeight = $('cWeight'), cOpsz = $('cOpsz'), cSlant = $('cSlant'), cAuto = $('cAuto');
cTide.value = settings.tide; cCurrent.value = settings.current; cWeight.value = settings.weight;
cOpsz.value = settings.opsz; cSlant.value = settings.slant; cAuto.checked = settings.auto;
function syncOutputs() {
  $('oTide').textContent = cTide.value; $('oCurrent').textContent = cCurrent.value;
  $('oWeight').textContent = cWeight.value; $('oOpsz').textContent = cOpsz.value;
  $('oSlant').textContent = cSlant.value + '°';
  const tv = +cTide.value;
  $('tideFill').style.width = tv + '%';
  $('tideWord').textContent = tv < 20 ? 'LOW EBB' : tv < 40 ? 'EBB TIDE' : tv < 60 ? 'NEAP TIDE' : tv < 80 ? 'FLOOD TIDE' : 'SPRING TIDE ⚓';
}
[cTide, cCurrent, cWeight, cOpsz, cSlant].forEach((el) => el.addEventListener('input', () => { syncOutputs(); save(); }));
cAuto.addEventListener('change', save);
syncOutputs();
function save() {
  settings.tide = +cTide.value; settings.current = +cCurrent.value; settings.weight = +cWeight.value;
  settings.opsz = +cOpsz.value; settings.slant = +cSlant.value; settings.auto = cAuto.checked;
  localStorage.setItem('liglagoon1', JSON.stringify({ settings, found: [...found], counts }));
}

// --- helpers ---
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}
function log(msg) {
  const ol = $('log'); const li = document.createElement('li'); li.textContent = msg;
  ol.prepend(li); while (ol.children.length > 7) ol.lastChild.remove();
}
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[(Math.random() * a.length) | 0]; }

// --- tossing ---
function tossChar(ch, x, y) {
  if (letters.length > 110) letters.shift();
  const size = rand(26, 54);
  letters.push({
    ch, x: x ?? rand(80, W - 80), y: y ?? rand(-40, 60),
    vx: rand(-60, 60), vy: rand(0, 60), r: size * 0.52,
    size, spin: rand(0, Math.PI * 2), vr: rand(-1.5, 1.5),
    wob: rand(0, Math.PI * 2), born: t,
  });
  updateStats();
}
function tossString(s, x, y) {
  [...s].forEach((ch, i) => setTimeout(() => tossChar(ch, (x ?? W / 2) + i * 34 - s.length * 12, (y ?? 40) - i * 8), i * 70));
}
function updateStats() {
  $('statLetters').textContent = letters.length;
  $('statLig').textContent = counts.lig;
  $('statStirs').textContent = counts.stir;
}
$('tossBtn').addEventListener('click', () => {
  const v = $('tossInput').value.trim() || 'fi';
  tossString(v.slice(0, 24)); log(`Tossed “${v}” into the drink.`);
});
$('wordBtn').addEventListener('click', () => { const w = pick(WORDS); $('tossInput').value = w; tossString(w); });
$('drainBtn').addEventListener('click', () => { letters = []; blooms = []; updateStats(); log('Lagoon drained. The tide keeps the change.'); });

// --- pointer: stir currents + grab letters ---
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  pointer = { ...pointer, x: p.x, y: p.y, px: p.x, py: p.y, down: true, speed: 0 };
  const hit = [...letters].reverse().find((l) => Math.hypot(l.x - p.x, l.y - p.y) < l.r + 14);
  if (hit) { grabbed = hit; grabOff = { x: hit.x - p.x, y: hit.y - p.y }; grabbed.vx = grabbed.vy = 0; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = toCanvas(e);
  const dx = p.x - pointer.x, dy = p.y - pointer.y;
  pointer.px = pointer.x; pointer.py = pointer.y;
  pointer.x = p.x; pointer.y = p.y;
  pointer.speed = Math.hypot(dx, dy);
  if (!pointer.down) return;
  if (grabbed) {
    grabbed.x = p.x + grabOff.x; grabbed.y = p.y + grabOff.y;
    grabbed.vx = dx * 60; grabbed.vy = dy * 60;
  } else {
    vortices.push({ x: p.x, y: p.y, vx: dx * 8, vy: dy * 8, life: 1 });
    if (vortices.length > 60) vortices.shift();
    if (pointer.speed > 4) { counts.stir++; if (counts.stir % 25 === 1) updateStats(); }
  }
});
addEventListener('pointerup', () => { pointer.down = false; if (grabbed) { grabbed = null; } updateStats(); save(); });

// type-to-toss (letters a-z etc; "kraken" = easter egg)
addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    if (e.key === 'Enter') $('tossBtn').click();
    return;
  }
  if (e.key === ' ') { e.preventDefault(); tossString(pick(WORDS)); return; }
  if (/^[a-zA-Z&]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
    tossChar(e.key);
    typedBuf = (typedBuf + e.key.toLowerCase()).slice(-8);
    if (typedBuf.endsWith('kraken')) toggleKraken();
  }
});

// --- easter egg: kraken ---
let gaugeClicks = 0, gaugeTimer = 0;
function gaugeTap() {
  gaugeClicks++; clearTimeout(gaugeTimer);
  gaugeTimer = setTimeout(() => (gaugeClicks = 0), 900);
  if (gaugeClicks >= 3) { gaugeClicks = 0; toggleKraken(true); }
}
$('gauge').addEventListener('click', gaugeTap);
$('gauge').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gaugeTap(); } });
$('krakenBtn').addEventListener('click', () => toggleKraken());
$('krakenClose').addEventListener('click', () => ($('kraken').hidden = true));
function toggleKraken(showCard) {
  kraken = !kraken;
  if (kraken) {
    $('kraken').hidden = !showCard ? true : false;
    if (showCard) $('kraken').hidden = false;
    else { $('kraken').hidden = false; setTimeout(() => ($('kraken').hidden = true), 4200); }
    toast('🦑 THE KRAKEN WAKES — the maelstrom takes your letters!');
    log('The Kraken wakes. All letters to the maelstrom!');
    for (let i = 0; i < 40; i++) parts.push({ x: W / 2, y: H / 2, vx: rand(-260, 260), vy: rand(-260, 260), life: 1, col: pick(['#ffd873', '#57c9b4', '#e89a6b']), s: rand(2, 5) });
  } else {
    $('kraken').hidden = true;
    toast('The beast sinks. The tide settles.');
    log('The Kraken sinks back to the brass deep.');
  }
}

// --- ligature blooms ---
function renderBlooms() {
  const box = $('blooms'); box.innerHTML = '';
  if (!found.size) { box.innerHTML = '<span class="empty">No ligatures yet — crash an <b>f</b> into an <b>i</b>…</span>'; }
  LIGS.filter((l) => found.has(l.name)).forEach((l) => {
    const d = document.createElement('div'); d.className = 'chip' + (l.name === 'th' && kraken ? ' secret' : '');
    d.innerHTML = `${l.glyph}<small>${l.name} · bloomed</small>`; box.appendChild(d);
  });
  $('bloomCount').textContent = `${found.size} / ${LIGS.length}`;
}
function bloom(pair, lig, x, y) {
  counts.lig++; found.add(lig.name);
  blooms.push({ glyph: lig.glyph, name: lig.name, x, y, life: 1 });
  if (blooms.length > 12) blooms.shift();
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 260);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1, col: pick(['#ffd873', '#f3d27a', '#57c9b4', '#fff6dd']), s: rand(1.5, 4.5) });
  }
  renderBlooms(); updateStats(); save();
  log(`⚙ ${pair} fused → ${lig.glyph} (${lig.name})`);
  if (found.size === LIGS.length) toast('🏆 Master Kernsmith! Every ligature bloomed. The Kraken bows.');
  else if (counts.lig % 5 === 1) toast(`✦ Ligature bloomed: ${lig.glyph} — ${found.size}/${LIGS.length} in the cabinet`);
}
function checkLigature(a, b) {
  const k1 = (a.ch + b.ch), k2 = (b.ch + a.ch);
  const lig = LIG_LOOKUP.get(k1) || LIG_LOOKUP.get(k2);
  if (!lig) return;
  const id = lig.name + Math.round(t * 2);
  if (pairCooldown.get(lig.name) === id) return;
  pairCooldown.set(lig.name, id);
  bloom(k1, lig, (a.x + b.x) / 2, (a.y + b.y) / 2);
}

// --- physics step ---
function step(dt) {
  t += dt;
  const tide = +cTide.value / 100, cur = +cCurrent.value / 100;
  if (cAuto.checked) { // moon pulls the tide
    const sway = (Math.sin(t * 0.25) * 0.5 + 0.5) * 100;
    cTide.value = Math.round(sway); syncOutputs();
  }
  const surfY = H * (0.72 - tide * 0.34);
  const cx = kraken ? W / 2 : null, cy = kraken ? H / 2 : null;

  for (const l of letters) {
    if (l === grabbed) continue;
    // ambient current field
    let fx = Math.sin(l.y * 0.02 + t * 1.4) * 90 * cur + Math.sin(t * 0.7 + l.wob) * 20;
    let fy = Math.cos(l.x * 0.015 + t) * 40 * cur;
    // buoyancy toward tide surface + bob
    fy += (surfY - l.y) * 1.6 + Math.sin(t * 2 + l.wob) * 24;
    fy += 60; // slight sink so tide matters
    // vortices from stirring
    for (const v of vortices) {
      const dx = l.x - v.x, dy = l.y - v.y, d2 = dx * dx + dy * dy + 400;
      const f = 90000 / d2;
      fx += (dx / Math.sqrt(d2)) * f * 0.4 + -dy * f * 0.004 + v.vx * f * 0.002;
      fy += (dy / Math.sqrt(d2)) * f * 0.4 + dx * f * 0.004 + v.vy * f * 0.002;
    }
    // kraken maelstrom
    if (kraken) {
      const dx = cx - l.x, dy = cy - l.y, d = Math.hypot(dx, dy) + 30;
      fx += (dx / d) * 320 + (-dy / d) * 260;
      fy += (dy / d) * 320 + (dx / d) * 260;
    }
    l.vx = (l.vx + fx * dt) * (1 - 1.4 * dt);
    l.vy = (l.vy + fy * dt) * (1 - 1.4 * dt);
    const sp = Math.hypot(l.vx, l.vy), max = kraken ? 620 : 420;
    if (sp > max) { l.vx *= max / sp; l.vy *= max / sp; }
    l.x += l.vx * dt; l.y += l.vy * dt;
    l.spin += l.vr * dt;
    // walls
    if (l.x < 20) { l.x = 20; l.vx = Math.abs(l.vx); }
    if (l.x > W - 20) { l.x = W - 20; l.vx = -Math.abs(l.vx); }
    if (l.y < 16) { l.y = 16; l.vy = Math.abs(l.vy); }
    if (l.y > H - 16) { l.y = H - 16; l.vy = -Math.abs(l.vy) * 0.7; }
  }
  // collisions
  for (let i = 0; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) {
    const a = letters[i], b = letters[j];
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 < rr * rr) {
      const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d, ov = (rr - d) / 2;
      if (a !== grabbed) { a.x -= nx * ov; a.y -= ny * ov; }
      if (b !== grabbed) { b.x += nx * ov; b.y += ny * ov; }
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = -rel * 0.9;
        if (a !== grabbed) { a.vx -= nx * imp; a.vy -= ny * imp; }
        if (b !== grabbed) { b.vx += nx * imp; b.vy += ny * imp; }
        if (Math.abs(rel) > 60) checkLigature(a, b);
      }
    }
  }
  vortices.forEach((v) => (v.life -= dt * 1.2));
  vortices = vortices.filter((v) => v.life > 0);
  parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt * 0.9; });
  parts = parts.filter((p) => p.life > 0);
  blooms.forEach((b) => (b.life -= dt * 0.25));
  blooms = blooms.filter((b) => b.life > 0);
  if (Math.random() < dt * 6) bubbles.push({ x: rand(0, W), y: H + 8, r: rand(2, 7), vy: rand(-50, -20) });
  bubbles.forEach((b) => (b.y += b.vy * dt));
  bubbles = bubbles.filter((b) => b.y > -12).slice(-70);
}

// --- draw ---
function brassFont(l) {
  const w = Math.round(+cWeight.value + Math.sin(t * 1.5 + l.wob) * 60);
  const o = Math.round(Math.min(144, Math.max(8, +cOpsz.value + (+cTide.value - 50) * 0.4)));
  return { w: Math.min(900, Math.max(100, w)), o };
}
function draw() {
  const tide = +cTide.value / 100, surfY = H * (0.72 - tide * 0.34);
  ctx.clearRect(0, 0, W, H);
  // depth glow
  const g = ctx.createRadialGradient(W / 2, surfY, 60, W / 2, surfY, 620);
  g.addColorStop(0, 'rgba(87,201,180,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // gears silhouette
  ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = '#ffd873'; ctx.lineWidth = 5;
  [[140, 440, 46, t * 0.3], [W - 150, 430, 62, -t * 0.22], [W - 90, 130, 34, t * 0.4]].forEach(([x, y, r, a]) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.strokeRect(-6, r - 6, 12, 16); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.restore();
  });
  ctx.restore();
  // tide surface
  ctx.save();
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, surfY + Math.sin(x * 0.02 + t * 2) * 7 + Math.sin(x * 0.05 - t * 3) * 3);
  ctx.lineTo(W, H); ctx.closePath();
  const wg = ctx.createLinearGradient(0, surfY - 20, 0, H);
  wg.addColorStop(0, 'rgba(87,201,180,.5)'); wg.addColorStop(1, 'rgba(6,20,24,.55)');
  ctx.fillStyle = wg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,115,.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  // stir trails
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  vortices.forEach((v) => {
    ctx.globalAlpha = 0.35 * v.life;
    ctx.strokeStyle = '#ffd873'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(v.x, v.y, (1 - v.life) * 60 + 8, 0, 7); ctx.stroke();
  });
  ctx.restore(); ctx.globalAlpha = 1;
  // bubbles
  ctx.save(); ctx.strokeStyle = 'rgba(191,233,226,.5)';
  bubbles.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke(); });
  ctx.restore();
  // kraken shadow
  if (kraken) {
    ctx.save(); ctx.translate(W / 2, H / 2);
    ctx.strokeStyle = 'rgba(142,47,28,.9)'; ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      ctx.save(); ctx.rotate((k / 6) * Math.PI * 2 + t * 0.5);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(60, 40 + 20 * Math.sin(t * 3 + k), 130, 90, 180 + 30 * Math.sin(t * 2 + k * 2), 60);
      ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#2b0d12'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd873'; ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🦑', 0, 2);
    ctx.restore();
  }
  // letters
  const slant = +cSlant.value;
  for (const l of letters) {
    const { w, o } = brassFont(l);
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(Math.sin(t + l.wob) * 0.12 + l.spin * 0.05);
    try { ctx.fontVariationSettings = `"wght" ${w}, "opsz" ${o}`; } catch (_) {}
    ctx.font = `${slant ? `oblique ${Math.abs(slant) * 1.2}deg ` : ''}${l.size}px Fraunces, "IM Fell English", serif`;
    try { ctx.fontVariationSettings = `"wght" ${w}, "opsz" ${o}`; } catch (_) {}
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // brass plaque behind
    ctx.fillStyle = l === grabbed ? 'rgba(255,216,115,.9)' : 'rgba(20,12,5,.78)';
    ctx.strokeStyle = l === grabbed ? '#fff6dd' : '#c9962e'; ctx.lineWidth = 2;
    const pw = l.size * 0.95, ph = l.size * 1.15;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 8); ctx.fill(); ctx.stroke(); }
    else ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.fillStyle = l === grabbed ? '#2a1c10' : '#f3d27a';
    ctx.fillText(l.ch, 0, 2);
    ctx.restore();
  }
  try { ctx.fontVariationSettings = ''; } catch (_) {}
  // bloom flashes
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  blooms.forEach((b) => {
    ctx.globalAlpha = Math.min(1, b.life * 1.6);
    try { ctx.fontVariationSettings = '"wght" 800, "opsz" 144'; } catch (_) {}
    ctx.font = '64px Fraunces, serif';
    ctx.shadowColor = '#ffd873'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#fff6dd';
    const sc = 1 + (1 - Math.min(1, b.life)) * 0.4 + Math.sin(t * 6) * 0.03;
    ctx.save(); ctx.translate(b.x, b.y - 40 * (1 - b.life)); ctx.scale(sc, sc);
    ctx.fillText(b.glyph, 0, 0); ctx.restore();
    ctx.shadowBlur = 0;
  });
  ctx.restore(); ctx.globalAlpha = 1;
  // particles
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  parts.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.s, p.s); });
  ctx.restore(); ctx.globalAlpha = 1;
  // pressure shimmer
  $('needle').style.transform = `translateX(-50%) rotate(${kraken ? 48 : -40 + (+cCurrent.value) * 0.7 + Math.sin(t * 2) * 5}deg)`;
  $('psi').textContent = kraken ? 143 : Math.round(60 + (+cCurrent.value) * 0.5 + Math.sin(t * 2) * 3);
}

// --- export poster PNG ---
$('exportBtn').addEventListener('click', () => {
  const PW = 1600, PH = 2240, off = document.createElement('canvas');
  off.width = PW; off.height = PH;
  const c = off.getContext('2d');
  c.fillStyle = '#17100a'; c.fillRect(0, 0, PW, PH);
  c.strokeStyle = '#c9962e'; c.lineWidth = 10; c.strokeRect(30, 30, PW - 60, PH - 60);
  c.strokeStyle = '#f3d27a'; c.lineWidth = 3; c.strokeRect(60, 60, PW - 120, PH - 120);
  c.fillStyle = '#e9d3a3'; c.textAlign = 'center';
  c.font = '110px Rye, serif'; c.fillText('Ligature Lagoon', PW / 2, 260);
  c.font = 'italic 44px Georgia, serif'; c.fillStyle = '#c9962e';
  c.fillText('where currents kern, collide & bloom', PW / 2, 340);
  c.drawImage(canvas, 110, 420, PW - 220, (PW - 220) * (H / W));
  const snapB = 420 + (PW - 220) * (H / W);
  c.textAlign = 'left'; c.fillStyle = '#ffd873'; c.font = '64px Georgia, serif';
  c.fillText('Bloom Cabinet', 130, snapB + 110);
  c.font = '72px Georgia, serif';
  const got = LIGS.filter((l) => found.has(l.name));
  got.forEach((l, i) => {
    const col = i % 4, row = (i / 4) | 0;
    c.fillStyle = '#e9d3a3';
    c.fillText(`${l.glyph}  ${l.name}`, 140 + col * 360, snapB + 200 + row * 110);
  });
  if (!got.length) { c.fillStyle = '#8a744f'; c.fillText('— no blooms yet —', 140, snapB + 200); }
  c.textAlign = 'center'; c.fillStyle = '#8a744f'; c.font = 'italic 36px Georgia, serif';
  c.fillText(`tide ${cTide.value} · current ${cCurrent.value} · weight ${cWeight.value} · ${counts.lig} blooms · Patent No. 1889`, PW / 2, PH - 120);
  const a = document.createElement('a');
  a.download = 'ligature-lagoon-poster.png'; a.href = off.toDataURL('image/png'); a.click();
  toast('⬇ Poster exported as PNG — frame it in brass!');
  log('Poster exported as PNG (1600×2240).');
});

// --- boot ---
tossString('ligature');
setTimeout(() => tossString('fi fl ffi'), 900);
renderBlooms(); updateStats();
log('Lagoon flooded. Awaiting letters…');
if (store.found?.length) toast(`Welcome back, Kernsmith — ${found.size} ligatures kept.`);

function frame(now) {
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.033);
  step(dt); draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
