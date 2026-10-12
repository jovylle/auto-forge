// Clockwork Pollen Archive — pop-art generative garden
// Features: hatch bees / pollinate hour blooms / loop evolving garden / export honeycomb
// Palette: 3 inks (pink, yellow, blue) + black/white ONLY.
const PINK = '#FF2E88', YELLOW = '#FFC700', BLUE = '#2B50E0';
const INK = '#0A0A0A', PAPER = '#FFFDF5';
const INKS = [PINK, YELLOW, BLUE];
const INK_NAMES = ['MAGENTA', 'VOLT', 'ULTRA'];
const LS_KEY = 'clockwork-pollen-archive-v1';

const $ = (id) => document.getElementById(id);
const garden = $('garden'), gx = garden.getContext('2d');
const comb = $('honeycomb'), cx = comb.getContext('2d');

const NAMES = ['TICKER','COGWING','SPRING','ESCAPEMENT','BOBBIN','RATCHET','PINION','MAINSPRING','JEWEL','FLYWHEEL','VERGE','BALANCE','FUSEE','ARBOUR'];
const POWS = ['POW!','BZZT!','BLOOM!','ZAP!','POP!','WHIRR!','DING!'];

// ---------- state ----------
let S = load() || fresh();
function fresh() {
  return {
    gen: 1, loopT: 0, honey: 0, paused: false, speed: 2,
    bees: [mkBee(), mkBee(), mkBee()],
    blooms: Array.from({ length: 12 }, (_, h) => mkBloom(h)),
    timeline: [], log: ['ARCHIVE OPENED — HATCH BEES TO BEGIN.'],
    particles: [], flashes: []
  };
}
function mkBee() {
  const n = 1 + Math.floor(Math.random() * 999);
  return {
    id: 'b' + Math.random().toString(36).slice(2, 8),
    name: NAMES[Math.floor(Math.random() * NAMES.length)] + '-' + n,
    ink: Math.floor(Math.random() * 3),
    speed: 0.5 + Math.random() * 1.4,
    wobble: 0.4 + Math.random() * 1.6,
    appetite: 0.5 + Math.random() * 1.2,
    teeth: 6 + Math.floor(Math.random() * 7),
    a: Math.random() * Math.PI * 2, r: 90 + Math.random() * 130,
    pollen: 0, trips: 0, gear: Math.random() * 6
  };
}
function mkBloom(h) {
  return {
    h, pollen: Math.random() * 8, stage: Math.floor(Math.random() * 2),
    petals: 5 + Math.floor(Math.random() * 5),
    ink: h % 3, // hour maps to one of the 3 inks — evolution shuffles
    ring: Math.floor(Math.random() * 3), // 0 solid,1 double,2 dotted
    seed: Math.random()
  };
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify({ ...S, particles: [], flashes: [] })); } catch {} }
function load() { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }

// ---------- helpers ----------
function stageOf(b) { return Math.min(5, Math.floor(b.pollen / 12)); }
function bloomXY(h, R, W, H) {
  const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
  return [W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R, a];
}
function powBurst(x, y) {
  const layer = $('powLayer');
  const r = garden.getBoundingClientRect();
  // map canvas coords -> overlay % coords
  const el = document.createElement('div');
  el.className = 'pow p' + (1 + Math.floor(Math.random() * 3));
  el.textContent = POWS[Math.floor(Math.random() * POWS.length)];
  el.style.left = (x / garden.width * 100) + '%';
  el.style.top = (y / garden.height * 100) + '%';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 850);
  void r;
}
function say(msg) {
  S.log.unshift(msg);
  S.log = S.log.slice(0, 30);
  renderLog();
}

// ---------- actions ----------
$('btnHatch').onclick = () => hatch(1);
$('btnHatch5').onclick = () => hatch(5);
function hatch(n) {
  for (let i = 0; i < n; i++) {
    if (S.bees.length >= 12) { say('HIVE FULL — 12 BEES MAX. RELEASE ONE.'); break; }
    const b = mkBee();
    S.bees.push(b);
    say(`HATCHED ${b.name} · ${INK_NAMES[b.ink]} · TEETH ${b.teeth}.`);
  }
  save(); renderHive();
}
$('btnLoop').onclick = () => { S.loopT = 0.999; say('LOOP WOUND FORWARD BY HAND.'); };
$('btnPause').onclick = (e) => {
  S.paused = !S.paused;
  e.target.textContent = S.paused ? '▶ RESUME' : '❚❚ PAUSE';
  e.target.setAttribute('aria-pressed', String(S.paused));
};
$('speed').oninput = (e) => { S.speed = +e.target.value; $('speedLabel').textContent = S.speed + '×'; save(); };
$('btnReset').onclick = () => {
  if (!confirm('Rewind the whole archive?')) return;
  S = fresh(); save(); renderAll(); say('ARCHIVE REWOUND TO GEN 001.');
};

document.querySelector('.hive')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.x'); if (!btn) return;
  const id = btn.dataset.id;
  const b = S.bees.find((x) => x.id === id);
  S.bees = S.bees.filter((x) => x.id !== id);
  if (b) say(`RELEASED ${b.name} — ${b.trips} TRIPS, ${Math.floor(b.pollen)} POLLEN.`);
  save(); renderHive();
});
$('bloomGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.bloom'); if (!card) return;
  const h = +card.dataset.h;
  const b = S.blooms[h];
  b.pollen += 4;
  const [x, y] = bloomXY(h, 218, garden.width, garden.height);
  S.flashes.push({ x, y, t: 1 });
  powBurst(x, y);
  say(`HAND-POLLINATED HOUR ${h === 0 ? 12 : h} (+4).`);
  save(); renderBlooms(); renderComb();
});

// ---------- export ----------
$('btnPng').onclick = () => {
  const out = document.createElement('canvas');
  out.width = 640; out.height = 860;
  const o = out.getContext('2d');
  o.fillStyle = PAPER; o.fillRect(0, 0, 640, 860);
  o.fillStyle = INK; o.fillRect(0, 0, 640, 90);
  o.fillStyle = PAPER; o.font = '900 34px sans-serif'; o.textAlign = 'center';
  o.fillText('CLOCKWORK POLLEN ARCHIVE', 320, 42);
  o.font = '700 18px sans-serif'; o.fillStyle = YELLOW;
  o.fillText(`GEN ${String(S.gen).padStart(3, '0')} · ${Math.floor(S.honey)} HONEY · ${S.bees.length} BEES`, 320, 70);
  o.drawImage(garden, 0, 90, 640, 640);
  o.fillStyle = INK; o.fillRect(0, 730, 640, 130);
  o.drawImage(comb, 140, 740, 360, 110);
  const a = document.createElement('a');
  a.download = `clockwork-pollen-gen${S.gen}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  say('EXPORTED TIME HONEYCOMB PNG.');
};
$('btnJson').onclick = () => {
  const blob = new Blob([JSON.stringify({ gen: S.gen, honey: S.honey, bees: S.bees, blooms: S.blooms, timeline: S.timeline }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `clockwork-pollen-gen${S.gen}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  say('EXPORTED GENOME ARCHIVE JSON.');
};

// ---------- evolution loop ----------
const LOOP_LEN = 26; // seconds at 1x
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!S.paused) {
    S.loopT += (dt * S.speed) / LOOP_LEN;
    stepBees(dt * S.speed, now / 1000);
    if (S.loopT >= 1) completeLoop();
  }
  draw(now / 1000);
  requestAnimationFrame(tick);
}
function stepBees(dt, t) {
  const W = garden.width, H = garden.height;
  for (const b of S.bees) {
    b.a += dt * b.speed * 0.55;
    b.r += Math.sin(t * b.wobble + b.gear) * dt * 22;
    b.r = Math.max(70, Math.min(250, b.r));
    b.gear += dt * (1 + b.speed);
    const bx = W / 2 + Math.cos(b.a) * b.r + Math.sin(t * 3 * b.wobble) * 8;
    const by = H / 2 + Math.sin(b.a) * b.r + Math.cos(t * 2.4 * b.wobble) * 8;
    // nearest bloom
    let best = null, bd = 1e9;
    for (const bl of S.blooms) {
      const [fx, fy] = bloomXY(bl.h, 218, W, H);
      const d = Math.hypot(bx - fx, by - fy);
      if (d < bd) { bd = d; best = bl; }
    }
    if (best && bd < 46) {
      const gain = dt * 6 * b.appetite;
      best.pollen += gain;
      b.pollen += gain; b.trips += dt;
      if (Math.random() < dt * 3) {
        S.particles.push({ x: bx, y: by, vx: (Math.random() - .5) * 40, vy: -30 - Math.random() * 30, life: 1, ink: b.ink });
        if (Math.random() < 0.25) { const [fx, fy] = bloomXY(best.h, 218, W, H); S.flashes.push({ x: fx, y: fy, t: 1 }); }
      }
      if (Math.random() < dt * 0.5) {
        const [fx, fy] = bloomXY(best.h, 218, W, H);
        powBurst(fx + (Math.random() - .5) * 40, fy - 20);
      }
    }
  }
  // particles
  for (const p of S.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4; }
  S.particles = S.particles.filter((p) => p.life > 0).slice(-160);
  for (const f of S.flashes) f.t -= dt * 2.2;
  S.flashes = S.flashes.filter((f) => f.t > 0);
}
function completeLoop() {
  S.loopT = 0;
  S.gen++;
  // honey = stored pollen
  let total = 0;
  for (const b of S.blooms) total += b.pollen;
  S.honey += total * 0.5;
  // timeline snapshot
  S.timeline.push({ gen: S.gen - 1, levels: S.blooms.map((b) => Math.round(b.pollen)) });
  S.timeline = S.timeline.slice(-8);
  // evolve: top-4 pollinated seed the ring; mutate petals / ink / ring
  const ranked = [...S.blooms].sort((a, b) => b.pollen - a.pollen);
  const champs = ranked.slice(0, 4);
  S.blooms = S.blooms.map((bl, h) => {
    const donor = champs[h % champs.length];
    const mutate = (v, amt) => Math.max(0, v + (Math.random() - 0.5) * amt);
    return {
      h,
      pollen: 4 + donor.pollen * 0.18 + Math.random() * 4,
      stage: 0,
      petals: Math.max(5, Math.min(12, Math.round(donor.petals + (Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0)))),
      ink: Math.random() < 0.55 ? donor.ink : Math.floor(Math.random() * 3),
      ring: Math.random() < 0.6 ? donor.ring : Math.floor(Math.random() * 3),
      seed: mutate(donor.seed, 0.2)
    };
  });
  // bees age: slowest bee retires past gen variety, keep hive lively
  if (S.bees.length > 0 && Math.random() < 0.5) {
    const slow = [...S.bees].sort((a, b) => a.pollen - b.pollen)[0];
    S.bees = S.bees.filter((x) => x.id !== slow.id);
    say(`RETIRED ${slow.name} TO THE ARCHIVE (${Math.floor(slow.pollen)} POLLEN).`);
  }
  if (S.bees.length < 3) { const nb = mkBee(); S.bees.push(nb); say(`WILD BEE ${nb.name} JOINED THE GARDEN.`); }
  say(`LOOP ${S.gen - 1} SEALED → GEN ${S.gen} · +${Math.floor(total * 0.5)} HONEY.`);
  for (const b of S.bees) b.trips = 0;
  save(); renderAll();
}

// ---------- drawing ----------
function draw(t) {
  const W = garden.width, H = garden.height, C = [W / 2, H / 2];
  gx.clearRect(0, 0, W, H);
  gx.fillStyle = PAPER; gx.fillRect(0, 0, W, H);
  // halftone corner dots (ink only, faint)
  gx.fillStyle = INK; gx.globalAlpha = 0.08;
  for (let y = 12; y < H; y += 22) for (let x = 12; x < W; x += 22) { gx.beginPath(); gx.arc(x, y, 2, 0, 7); gx.fill(); }
  gx.globalAlpha = 1;
  // dial rings
  ring(C[0], C[1], 292, INK, 10);
  ring(C[0], C[1], 276, PAPER, 4);
  ring(C[0], C[1], 268, BLUE, 6);
  // minute ticks
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2;
    const big = m % 5 === 0;
    gx.strokeStyle = INK; gx.lineWidth = big ? 5 : 2;
    gx.beginPath();
    gx.moveTo(C[0] + Math.cos(a) * (big ? 250 : 256), C[1] + Math.sin(a) * (big ? 250 : 256));
    gx.lineTo(C[0] + Math.cos(a) * 264, C[1] + Math.sin(a) * 264);
    gx.stroke();
  }
  // blooms
  const hr = S.loopT * 12;
  S.blooms.forEach((bl) => drawBloom(bl, hr, t));
  // clock hands
  const la = S.loopT * Math.PI * 2 - Math.PI / 2;
  gx.strokeStyle = INK; gx.lineCap = 'round';
  gx.lineWidth = 9; gx.beginPath(); gx.moveTo(...C); gx.lineTo(C[0] + Math.cos(la) * 150, C[1] + Math.sin(la) * 150); gx.stroke();
  gx.lineWidth = 5; gx.strokeStyle = PAPER; gx.beginPath(); gx.moveTo(...C); gx.lineTo(C[0] + Math.cos(la) * 150, C[1] + Math.sin(la) * 150); gx.stroke();
  gx.fillStyle = PINK; gx.strokeStyle = INK; gx.lineWidth = 5;
  gx.beginPath(); gx.arc(...C, 22, 0, 7); gx.fill(); gx.stroke();
  gx.fillStyle = INK; gx.beginPath(); gx.arc(...C, 7, 0, 7); gx.fill();
  // loop progress arc
  gx.strokeStyle = YELLOW; gx.lineWidth = 12;
  gx.beginPath(); gx.arc(C[0], C[1], 292, -Math.PI / 2, -Math.PI / 2 + S.loopT * Math.PI * 2); gx.stroke();
  gx.strokeStyle = INK; gx.lineWidth = 3;
  gx.beginPath(); gx.arc(C[0], C[1], 298, 0, 7); gx.stroke();
  gx.beginPath(); gx.arc(C[0], C[1], 286, 0, 7); gx.stroke();
  // particles
  for (const p of S.particles) {
    gx.globalAlpha = Math.max(0, p.life);
    gx.fillStyle = INKS[p.ink]; gx.strokeStyle = INK; gx.lineWidth = 2;
    gx.beginPath(); gx.arc(p.x, p.y, 5, 0, 7); gx.fill(); gx.stroke();
  }
  gx.globalAlpha = 1;
  for (const f of S.flashes) {
    gx.globalAlpha = Math.max(0, f.t) * 0.8;
    gx.strokeStyle = INK; gx.lineWidth = 3;
    gx.beginPath(); gx.arc(f.x, f.y, (1 - f.t) * 46 + 18, 0, 7); gx.stroke();
  }
  gx.globalAlpha = 1;
  // bees on top
  for (const b of S.bees) drawBee(b, t);
  // readout
  const cur = Math.floor(S.loopT * 12) % 12;
  $('hourReadout').textContent = `HOUR ${cur === 0 ? 12 : cur} · ${(S.loopT * 100).toFixed(0)}%`;
  $('honeyReadout').textContent = `⬢ ${Math.floor(S.honey)} HONEY`;
  $('loopPct').textContent = `${Math.floor(S.loopT * 100)}%`;
}
function ring(x, y, r, color, w) { gx.strokeStyle = color; gx.lineWidth = w; gx.beginPath(); gx.arc(x, y, r, 0, 7); gx.stroke(); }
function drawBloom(bl, hr, t) {
  const W = garden.width, H = garden.height;
  const [x, y, a] = bloomXY(bl.h, 218, W, H);
  const st = stageOf(bl);
  const R = 20 + st * 7 + Math.sin(t * 2 + bl.h) * 1.5;
  const ink = INKS[bl.ink];
  const active = Math.floor(hr) % 12 === bl.h;
  if (active) {
    gx.fillStyle = YELLOW; gx.strokeStyle = INK; gx.lineWidth = 3;
    gx.beginPath(); gx.arc(x, y, R + 14, 0, 7); gx.fill(); gx.stroke();
  }
  // petals
  for (let i = 0; i < bl.petals; i++) {
    const pa = (i / bl.petals) * Math.PI * 2 + t * 0.15 * (bl.h % 2 ? 1 : -1);
    const px = x + Math.cos(pa) * (R * 0.85), py = y + Math.sin(pa) * (R * 0.85);
    gx.fillStyle = i <= st + 2 ? ink : PAPER;
    gx.strokeStyle = INK; gx.lineWidth = 3.5;
    gx.beginPath(); gx.ellipse(px, py, R * 0.42, R * 0.30, pa, 0, 7); gx.fill(); gx.stroke();
  }
  // ring style
  if (bl.ring === 1) { ring(x, y, R * 0.72, INK, 3); }
  if (bl.ring === 2) {
    gx.fillStyle = INK;
    for (let i = 0; i < 8; i++) { const da = (i / 8) * Math.PI * 2; gx.beginPath(); gx.arc(x + Math.cos(da) * R * 0.62, y + Math.sin(da) * R * 0.62, 2.4, 0, 7); gx.fill(); }
  }
  // face
  gx.fillStyle = st >= 4 ? INK : PAPER;
  gx.strokeStyle = INK; gx.lineWidth = 4;
  gx.beginPath(); gx.arc(x, y, R * 0.52, 0, 7); gx.fill(); gx.stroke();
  gx.fillStyle = st >= 4 ? YELLOW : INK;
  gx.font = `900 ${Math.max(12, R * 0.5)}px sans-serif`; gx.textAlign = 'center'; gx.textBaseline = 'middle';
  gx.fillText(bl.h === 0 ? '12' : String(bl.h), x, y + 1);
  // pollen pips
  gx.fillStyle = INK; gx.font = '700 11px sans-serif';
  gx.fillText(`${Math.floor(bl.pollen)}✿`, x, y + R + 14);
}
function drawBee(b, t) {
  const W = garden.width;
  const x = W / 2 + Math.cos(b.a) * b.r + Math.sin(t * 3 * b.wobble) * 8;
  const y = W / 2 + Math.sin(b.a) * b.r + Math.cos(t * 2.4 * b.wobble) * 8;
  const ang = b.a + Math.PI / 2;
  gx.save(); gx.translate(x, y); gx.rotate(ang);
  // wings (white)
  const flap = Math.sin(t * 28 + b.gear) * 0.5;
  gx.fillStyle = PAPER; gx.strokeStyle = INK; gx.lineWidth = 3;
  for (const s of [-1, 1]) {
    gx.save(); gx.rotate(s * (0.7 + flap * 0.35));
    gx.beginPath(); gx.ellipse(s * 4, -14, 9, 6, s * 0.5, 0, 7); gx.fill(); gx.stroke();
    gx.restore();
  }
  // body
  gx.fillStyle = INKS[b.ink]; gx.strokeStyle = INK; gx.lineWidth = 4;
  gx.beginPath(); gx.ellipse(0, 0, 13, 18, 0, 0, 7); gx.fill(); gx.stroke();
  gx.fillStyle = INK;
  for (let i = -1; i <= 1; i++) gx.fillRect(-13, i * 9 - 2, 26, 4);
  // gear
  gx.save(); gx.translate(0, 0); gx.rotate(b.gear);
  gx.strokeStyle = INK; gx.lineWidth = 2.5;
  gx.beginPath();
  for (let i = 0; i < b.teeth; i++) { const ga = (i / b.teeth) * Math.PI * 2; gx.moveTo(Math.cos(ga) * 5, Math.sin(ga) * 5); gx.lineTo(Math.cos(ga) * 9, Math.sin(ga) * 9); }
  gx.stroke();
  gx.fillStyle = PAPER; gx.beginPath(); gx.arc(0, 0, 5, 0, 7); gx.fill(); gx.stroke();
  gx.restore();
  // head
  gx.fillStyle = INK; gx.beginPath(); gx.arc(0, -20, 6, 0, 7); gx.fill();
  gx.restore();
}

// ---------- honeycomb preview ----------
function renderComb() {
  const w = comb.width, h = comb.height;
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = INK; cx.fillRect(0, 0, w, h);
  const R = 26;
  const maxP = Math.max(12, ...S.blooms.map((b) => b.pollen));
  S.blooms.forEach((bl, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const x = 42 + col * 56 + (row % 2 ? 28 : 0), y = 52 + row * 96;
    hex(x, y, R, PAPER, true);
    const frac = Math.min(1, bl.pollen / maxP);
    if (frac > 0.03) hex(x, y, R * (0.25 + frac * 0.68), INKS[bl.ink], true);
    hex(x, y, R, INK, false);
    cx.fillStyle = INK; cx.font = '900 13px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(bl.h === 0 ? '12' : String(bl.h), x, y);
    cx.font = '700 10px sans-serif';
    cx.fillText(`${Math.floor(bl.pollen)}`, x, y + R + 14 > h - 6 ? h - 10 : y + R + 12);
  });
  function hex(x, y, r, fill, doFill) {
    cx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? cx.lineTo(px, py) : cx.moveTo(px, py); }
    cx.closePath();
    if (doFill) { cx.fillStyle = fill; cx.fill(); }
    cx.strokeStyle = INK; cx.lineWidth = 4; cx.stroke();
  }
}

// ---------- renders ----------
function renderHive() {
  const el = $('hive');
  $('beeCount').textContent = `${S.bees.length}/12`;
  el.innerHTML = S.bees.length ? '' : '<div class="empty">NO BEES — HATCH ONE! ⚙</div>';
  const ranked = [...S.bees].sort((a, b) => b.pollen - a.pollen);
  for (const b of ranked) {
    const d = document.createElement('div');
    d.className = 'bee-card';
    d.innerHTML = `<div class="face" style="background:${INKS[b.ink]}">🐝</div>
      <div><b>${b.name}</b><small>SP ${b.speed.toFixed(1)} · AP ${b.appetite.toFixed(1)} · ⚙${b.teeth} · ⬢${Math.floor(b.pollen)}</small>
      <div class="meter"><i style="width:${Math.min(100, b.pollen / 2)}%;background:${INKS[b.ink]}"></i></div></div>
      <button class="x" data-id="${b.id}" title="Release bee">✕</button>`;
    el.appendChild(d);
  }
}
function renderBlooms() {
  const g = $('bloomGrid');
  g.innerHTML = '';
  const avg = S.blooms.reduce((s, b) => s + b.pollen, 0) / 12;
  $('bloomAvg').textContent = `AVG ${avg.toFixed(1)}`;
  S.blooms.forEach((bl) => {
    const st = stageOf(bl);
    const d = document.createElement('button');
    d.className = 'bloom' + (st >= 4 ? ' hot' : '');
    d.dataset.h = bl.h;
    d.title = `Hour ${bl.h === 0 ? 12 : bl.h} — click to hand-pollinate`;
    d.innerHTML = `<div class="dot" style="background:${INKS[bl.ink]};color:${bl.ink === 1 ? '#0A0A0A' : '#FFFDF5'}">${'✿'.repeat(1)}</div>
      <b>${bl.h === 0 ? 12 : bl.h}H · LV${st}</b><small>${Math.floor(bl.pollen)} POLLEN</small>`;
    g.appendChild(d);
  });
}
function renderTimeline() {
  const t = $('timeline');
  t.innerHTML = S.timeline.length ? '' : '<div style="color:#FFFDF5;font-weight:700;font-size:12px;padding:18px">COMPLETE A LOOP TO ETCH TIMELINES…</div>';
  const maxV = Math.max(12, ...S.timeline.flatMap((c) => c.levels));
  for (const col of S.timeline) {
    const d = document.createElement('div');
    d.className = 'tl-col';
    d.innerHTML = `<b>${col.levels.reduce((s, v) => s + v, 0)}✿</b>
      <div class="tl-bars">${col.levels.map((v, i) => `<i style="height:${Math.max(4, (v / maxV) * 52)}px;background:${INKS[i % 3]}" title="hour ${i}"></i>`).join('')}</div>
      <div class="tl-gen">G${col.gen}</div>`;
    t.appendChild(d);
  }
}
function renderLog() {
  const l = $('log');
  l.innerHTML = S.log.map((m) => `<div>${m}</div>`).join('');
}
function renderAll() {
  $('genNum').textContent = String(S.gen).padStart(3, '0');
  $('speed').value = S.speed; $('speedLabel').textContent = S.speed + '×';
  renderHive(); renderBlooms(); renderTimeline(); renderLog(); renderComb();
}

// live bloom/timeline refresh (cheap, 2fps)
setInterval(() => { renderBlooms(); renderTimeline(); renderComb(); $('genNum').textContent = String(S.gen).padStart(3, '0'); save(); }, 2000);

// boot
renderAll();
say(`ARCHIVE LOADED — GEN ${S.gen}, ${S.bees.length} BEES, ${Math.floor(S.honey)} HONEY.`);
requestAnimationFrame(tick);
