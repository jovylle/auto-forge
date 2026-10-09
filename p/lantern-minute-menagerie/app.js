// Lantern Minute Menagerie — wind clock eggs, loop 60s habitats, crossbreed echoes, mint midnights.
// Plain ES module. No deps. localStorage persistence. file:// safe.
const $ = (id) => document.getElementById(id);
const LS = 'lantern-menagerie-v1';
const COLORS = ['#FFB000', '#00C2A8', '#FF4D2E']; // amber, teal, coral — the ONLY hues (+ink/paper)
const EGG_FACES = ['🥚', '🪺', '🐣'];

const FIRST = ['Tick','Glim','Clack','Whirr','Brr','Lumi','Cog','Pend','Zzz','Moth','Tock','Spro'];
const SECOND = ['le','wick','bell','jaw','moth','spring','hopper','gloom','fin','pail','trix','boo'];

const store = {
  load() { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; } },
  save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch {} }
};

let S = store.load() || null;
if (!S || !Array.isArray(S.beasts)) {
  S = { beasts: [], echoes: [], mints: [], eggs: null, sel: [], cur: 0, chime: true, lastHour: new Date().getHours(), hatched: 0 };
}
if (!S.eggs || S.eggs.length !== 3) S.eggs = [mkEgg(0), mkEgg(1), mkEgg(2)];
let keeperMode = false;

function mkEgg(i) {
  const temps = ['eager', 'sleepy', 'tricky'];
  return { id: 'e' + Date.now().toString(36) + i + Math.floor(Math.random() * 999), wind: 0, need: 60, temp: temps[Math.floor(Math.random() * 3)], face: EGG_FACES[i % 3] };
}
function rnd(n) { return Math.floor(Math.random() * n); }
function mkName() { return FIRST[rnd(FIRST.length)] + SECOND[rnd(SECOND.length)]; }
function mkGenome(parents) {
  const now = new Date();
  let g;
  if (parents && parents.length === 2) {
    const a = parents[0].g, b = parents[1].g;
    const pick = (x, y) => (Math.random() < 0.5 ? x : y);
    g = { body: Math.random() < 0.2 ? rnd(5) : pick(a.body, b.body), color: Math.random() < 0.2 ? rnd(3) : pick(a.color, b.color),
      eyes: Math.random() < 0.25 ? 1 + rnd(3) : pick(a.eyes, b.eyes), legs: Math.random() < 0.25 ? [2, 4, 6][rnd(3)] : pick(a.legs, b.legs),
      tempo: Math.min(2.2, Math.max(0.5, ((a.tempo + b.tempo) / 2) + (Math.random() - 0.5) * 0.6)) };
  } else {
    g = { body: rnd(5), color: rnd(3), eyes: 1 + rnd(3), legs: [2, 4, 6][rnd(3)], tempo: 0.6 + Math.random() * 1.2 };
  }
  return g;
}
function mkBeast(genome, parents, note) {
  const now = new Date();
  return { id: 'b' + Date.now().toString(36) + rnd(9999), name: mkName(), g: genome,
    bornHour: now.getHours(), bornMin: now.getMinutes(), gen: parents ? Math.max(parents[0].gen, parents[1].gen) + 1 : 1,
    parents: parents ? parents.map(p => p.name) : [], note: note || '', evo: false };
}
function persist() { store.save(S); }

/* ---------- toast ---------- */
let toastT = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- audio (tiny chime, no assets) ---------- */
let AC = null;
function blip(freq = 880, dur = 0.35) {
  if (!S.chime) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.18, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch {}
}
function hatchChord() { blip(660, .3); setTimeout(() => blip(880, .3), 120); setTimeout(() => blip(1320, .5), 240); }

/* ---------- creature renderer ---------- */
function drawCreature(ctx, W, H, g, t, opts = {}) {
  // t: 0..1 position in the 60s loop
  const cx = W / 2, cy = H / 2 + 8;
  const R = Math.min(W, H) * 0.26;
  const col = COLORS[g.color % 3];
  const ghost = opts.ghost || 0;
  ctx.save();
  if (ghost) ctx.globalAlpha = Math.max(0.12, 0.4 - ghost * 0.12);
  // glow
  ctx.shadowColor = col; ctx.shadowBlur = ghost ? 8 : 26;
  // legs
  const nLegs = g.legs, wob = Math.sin(t * Math.PI * 2 * g.tempo) * 8;
  ctx.strokeStyle = opts.mono || '#111111'; ctx.lineWidth = Math.max(3, W * 0.012); ctx.lineCap = 'round';
  ctx.shadowBlur = 0;
  for (let i = 0; i < nLegs; i++) {
    const a = (i / nLegs) * Math.PI * 2 + t * Math.PI * 2;
    const x0 = cx + Math.cos(a) * R * 0.7, y0 = cy + Math.sin(a) * R * 0.55 + R * 0.4;
    const step = Math.sin(t * Math.PI * 2 * g.tempo + i * 1.3) * R * 0.28;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(a) * R * 0.5, y0 + R * 0.55 + step * 0.4);
    ctx.stroke();
  }
  // body shapes
  ctx.shadowColor = col; ctx.shadowBlur = ghost ? 8 : 26;
  ctx.fillStyle = col; ctx.strokeStyle = '#111111'; ctx.lineWidth = Math.max(3, W * 0.012);
  ctx.beginPath();
  if (g.body === 0) ctx.arc(cx, cy, R, 0, Math.PI * 2);
  else if (g.body === 1) { // eggy
    ctx.ellipse(cx, cy, R * 0.85, R * 1.1, wob * 0.01, 0, Math.PI * 2);
  } else if (g.body === 2) { // square bot
    const s = R * 1.5, x = cx - s / 2, y = cy - s / 2;
    ctx.rect(x, y, s, s);
  } else if (g.body === 3) { // triangle imp
    ctx.moveTo(cx, cy - R * 1.2); ctx.lineTo(cx + R * 1.1, cy + R * 0.8); ctx.lineTo(cx - R * 1.1, cy + R * 0.8); ctx.closePath();
  } else { // blob
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = R * (1 + 0.12 * Math.sin(a * 3 + t * Math.PI * 4));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // clock face belly
  const fr = R * 0.62;
  ctx.fillStyle = '#FFFDF5'; ctx.beginPath(); ctx.arc(cx, cy + R * 0.08, fr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // tick marks
  ctx.save(); ctx.translate(cx, cy + R * 0.08);
  for (let m = 0; m < 12; m++) {
    ctx.save(); ctx.rotate((m / 12) * Math.PI * 2);
    ctx.fillStyle = m % 3 === 0 ? COLORS[(g.color + 1) % 3] : '#111111';
    ctx.fillRect(-1.5, -fr + 3, 3, m % 3 === 0 ? 9 : 5);
    ctx.restore();
  }
  // hands show loop-second
  const sec = t * 60;
  ctx.strokeStyle = '#111111'; ctx.lineCap = 'round';
  ctx.save(); ctx.rotate((sec / 60) * Math.PI * 2); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -fr + 10); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.rotate(((sec / 12) % 12 / 12) * Math.PI * 2); ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS[(g.color + 2) % 3];
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -fr * 0.55); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#111111'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // eyes
  const bob = Math.sin(t * Math.PI * 2 * 2) * 2;
  for (let e = 0; e < g.eyes; e++) {
    const ex = cx + (e - (g.eyes - 1) / 2) * R * 0.5, ey = cy - R * 0.62 + bob;
    ctx.fillStyle = '#FFFDF5'; ctx.beginPath(); ctx.arc(ex, ey, R * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const blink = (Math.sin(t * Math.PI * 2 * g.tempo + e) > 0.96) ? 0.15 : 1;
    ctx.fillStyle = '#111111'; ctx.beginPath(); ctx.arc(ex, ey + 2, R * 0.09 * blink + 1, 0, Math.PI * 2); ctx.fill();
  }
  // antennae / crown for evolutions
  if (opts.crown) {
    ctx.fillStyle = '#FFB000'; ctx.strokeStyle = '#111111'; ctx.lineWidth = 3;
    ctx.beginPath();
    const cw = R * 1.1, cy0 = cy - R * (g.body === 1 ? 1.35 : 1.2);
    ctx.moveTo(cx - cw / 2, cy0); ctx.lineTo(cx - cw / 2, cy0 - R * 0.4); ctx.lineTo(cx - cw / 4, cy0 - R * 0.12);
    ctx.lineTo(cx, cy0 - R * 0.48); ctx.lineTo(cx + cw / 4, cy0 - R * 0.12); ctx.lineTo(cx + cw / 2, cy0 - R * 0.4); ctx.lineTo(cx + cw / 2, cy0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 3;
    const sway = Math.sin(t * Math.PI * 2) * 6;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.3, cy - R * 0.95); ctx.lineTo(cx - R * 0.3 + sway * 0.4, cy - R * 1.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R * 0.3, cy - R * 0.95); ctx.lineTo(cx + R * 0.3 - sway * 0.4, cy - R * 1.35); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx - R * 0.3 + sway * 0.4, cy - R * 1.4, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + R * 0.3 - sway * 0.4, cy - R * 1.4, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function thumbURL(beast, crown) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 120;
  drawCreature(c.getContext('2d'), 160, 120, beast.g, 0.18, { crown: crown || beast.evo });
  return c.toDataURL();
}

/* ---------- eggs UI ---------- */
let selectedEgg = 0, winding = false, windRaf = 0;
function renderEggs() {
  const box = $('eggs'); box.innerHTML = '';
  S.eggs.forEach((e, i) => {
    const d = document.createElement('div');
    d.className = 'egg' + (i === selectedEgg ? ' sel' : '') + (winding && i === selectedEgg ? ' winding' : '') + (e.wind >= e.need ? ' ready' : '');
    d.setAttribute('role', 'listitem'); d.tabIndex = 0;
    d.setAttribute('aria-label', `Egg ${i + 1}, ${e.temp}, ${Math.floor(e.wind)} of ${e.need} ticks`);
    d.innerHTML = `<div class="face">${e.wind >= e.need ? '🐣' : e.face}</div>
      <div class="ename">EGG-${i + 1} · ${e.temp.toUpperCase()}</div>
      <div class="ticks">${Math.floor(e.wind)}/${e.need} TICKS</div>
      <div class="bar"><i style="width:${Math.min(100, e.wind / e.need * 100)}%"></i></div>
      <div class="temp">${e.wind >= e.need ? 'READY — wind once more to hatch!' : e.temp === 'eager' ? 'loves fast winding' : e.temp === 'sleepy' ? 'wind slow & steady' : 'slips if you rush'}</div>`;
    const pick = () => { selectedEgg = i; renderEggs(); $('windMsg').textContent = `Egg-${i + 1} selected (${e.temp}). HOLD the wind key!`; };
    d.onclick = pick;
    d.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } };
    box.appendChild(d);
  });
  const e = S.eggs[selectedEgg];
  if (e) $('windFill').style.width = Math.min(100, e.wind / e.need * 100) + '%';
}
function windTick(dt) {
  const e = S.eggs[selectedEgg];
  if (!e) return;
  let gain = dt * 22; // ticks per second baseline
  if (e.temp === 'eager') gain *= 1.5;
  if (e.temp === 'sleepy') gain *= 0.7;
  if (e.temp === 'tricky' && Math.random() < 0.06) gain = -14 * dt * 3; // slips!
  e.wind = Math.max(0, e.wind + gain);
  if (e.wind >= e.need) {
    hatch(selectedEgg);
    stopWind();
    return;
  }
  const msgs = { eager: 'whirrrring! eager egg drinks the winding…', sleepy: 'slow… steady… the sleepy egg warms…', tricky: 'careful! this one slips when rushed…' };
  $('windMsg').textContent = `${Math.floor(e.wind)}/${e.need} — ${msgs[e.temp]}`;
  $('windMsg').classList.toggle('hot', e.wind > e.need * 0.75);
  renderEggs();
}
function startWind(ev) {
  if (ev) ev.preventDefault();
  if (winding) return;
  winding = true; renderEggs();
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch {}
  let last = performance.now();
  const step = (now) => { if (!winding) return; windTick((now - last) / 1000); last = now; windRaf = requestAnimationFrame(step); };
  windRaf = requestAnimationFrame(step);
}
function stopWind() { winding = false; cancelAnimationFrame(windRaf); renderEggs(); }
function hatch(eggIdx, wild) {
  const egg = S.eggs[eggIdx];
  const beast = mkBeast(mkGenome(null), null, wild ? 'wild hourly hatch' : 'hand-wound');
  S.beasts.unshift(beast); S.cur = 0;
  S.echoes.unshift({ name: beast.name, g: beast.g, when: Date.now(), kind: wild ? 'wild' : 'hatch' });
  S.echoes = S.echoes.slice(0, 24);
  S.hatched++;
  S.eggs[eggIdx] = mkEgg(eggIdx);
  persist(); renderAll();
  hatchChord();
  toast(`🐣 ${beast.name} HATCHED! gen-${beast.gen} · ${COLORS[beast.g.color] === '#FFB000' ? 'AMBER' : COLORS[beast.g.color] === '#00C2A8' ? 'TEAL' : 'CORAL'} · ${beast.g.legs} legs`);
  $('windMsg').textContent = `${beast.name} hatched! A fresh egg rolled in.`;
  $('windMsg').classList.remove('hot');
  checkKeeperProgress();
}

/* ---------- menagerie + crossbreed ---------- */
function renderMenagerie() {
  const box = $('menagerie'); box.innerHTML = '';
  if (!S.beasts.length) { box.innerHTML = '<p class="hint">No creatures yet — wind an egg above. 👆</p>'; return; }
  S.beasts.forEach((b, i) => {
    const d = document.createElement('div');
    d.className = 'beast' + (S.sel.includes(b.id) ? ' picked' : '') + (b.evo ? ' evo' : '');
    d.setAttribute('role', 'listitem'); d.tabIndex = 0;
    const img = document.createElement('canvas'); img.width = 160; img.height = 120;
    drawCreature(img.getContext('2d'), 160, 120, b.g, 0.18 + (i * 0.07) % 1, { crown: b.evo });
    d.appendChild(img);
    const nm = document.createElement('div'); nm.className = 'bname';
    nm.textContent = `${b.evo ? '👑 ' : ''}${b.name} · G${b.gen}`;
    const mt = document.createElement('div'); mt.className = 'bmeta';
    mt.textContent = `:${String(b.bornMin).padStart(2, '0')} · ${b.parents.length ? '✕ ' + b.parents.join(' + ') : b.note || 'wild'}`;
    d.appendChild(nm); d.appendChild(mt);
    const toggle = () => {
      const k = S.sel.indexOf(b.id);
      if (k >= 0) S.sel.splice(k, 1);
      else { S.sel.push(b.id); if (S.sel.length > 2) S.sel.shift(); blip(520, .12); }
      S.cur = i; persist(); renderAll();
    };
    d.onclick = toggle;
    d.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } };
    d.ondblclick = () => { S.cur = i; persist(); renderHabitatMeta(); };
    box.appendChild(d);
  });
  const eb = $('breedBtn');
  eb.textContent = `⚗ CROSSBREED SELECTED ${S.sel.length}/2`;
  eb.disabled = S.sel.length !== 2;
}
function crossbreed() {
  const parents = S.sel.map(id => S.beasts.find(b => b.id === id)).filter(Boolean);
  if (parents.length !== 2) { toast('Select exactly 2 parents first.'); return; }
  const child = mkBeast(mkGenome(parents), parents, 'crossbreed');
  S.beasts.unshift(child); S.cur = 0; S.sel = [];
  S.echoes.unshift({ name: child.name, g: child.g, when: Date.now(), kind: 'cross', parents: parents.map(p => p.name) });
  S.echoes = S.echoes.slice(0, 24);
  S.hatched++;
  persist(); renderAll(); hatchChord();
  toast(`⚗ ${child.name} crossbred from ${parents.map(p => p.name).join(' ✕ ')}!`);
  checkKeeperProgress();
}
function renderEchoes() {
  const box = $('echoes'); box.innerHTML = '';
  $('echoCount').textContent = S.echoes.length ? `(${S.echoes.length})` : '';
  if (!S.echoes.length) { box.innerHTML = '<span class="hint small">History echoes appear here after hatches.</span>'; return; }
  S.echoes.forEach(e => {
    const d = document.createElement('div'); d.className = 'echo';
    const c = document.createElement('canvas'); c.width = 120; c.height = 90;
    drawCreature(c.getContext('2d'), 120, 90, e.g, 0.3, { ghost: 1 });
    d.appendChild(c);
    const t = document.createElement('div');
    t.textContent = (e.kind === 'cross' ? '✕ ' : e.kind === 'wild' ? '◷ ' : '🐣 ') + e.name;
    d.title = `${e.name} · ${new Date(e.when).toLocaleString()}${e.parents ? ' · ✕ ' + e.parents.join('+') : ''}`;
    d.appendChild(t); box.appendChild(d);
  });
}

/* ---------- habitat loop ---------- */
const hab = $('habitat');
const hctx = hab.getContext('2d');
function renderHabitatMeta() {
  const b = S.beasts[S.cur];
  if (!b) { $('nowName').textContent = '— no creature yet —'; $('nowMeta').textContent = 'wind an egg to hatch your first beast'; return; }
  $('nowName').textContent = `${b.evo ? '👑 ' : ''}${b.name} · GEN ${b.gen}`;
  const colName = b.g.color === 0 ? 'AMBER' : b.g.color === 1 ? 'TEAL' : 'CORAL';
  $('nowMeta').textContent = `body-${['orb','egg','box','imp','blob'][b.g.body]} · ${colName} · ${b.g.eyes} eye${b.g.eyes > 1 ? 's' : ''} · ${b.g.legs} legs · tempo ${b.g.tempo.toFixed(1)}× · hatched :${String(b.bornMin).padStart(2, '0')}${b.parents.length ? ' · ✕ ' + b.parents.join('+') : ''}`;
}
function habitatFrame() {
  const now = new Date();
  const sec = now.getSeconds() + now.getMilliseconds() / 1000;
  const t = sec / 60;
  const W = hab.width, H = hab.height;
  const midnight = now.getHours() === 0;
  // bg — ink always (3-color rule: amber/teal/coral + ink/paper only)
  hctx.fillStyle = '#111111';
  hctx.fillRect(0, 0, W, H);
  // dot grid
  hctx.fillStyle = 'rgba(255,253,245,.14)';
  for (let x = 12; x < W; x += 32) for (let y = 12; y < H; y += 32) { hctx.fillRect(x, y, 2, 2); }
  // 60s sun arc
  const ax = 30 + (t * (W - 60));
  const ay = H - 40 - Math.sin(t * Math.PI) * (H * 0.55);
  const b = S.beasts[S.cur];
  const col = b ? COLORS[b.g.color % 3] : '#FFB000';
  hctx.save(); hctx.shadowColor = col; hctx.shadowBlur = 22; hctx.fillStyle = col;
  hctx.beginPath(); hctx.arc(ax, ay, 13, 0, Math.PI * 2); hctx.fill(); hctx.restore();
  hctx.strokeStyle = '#FFFDF5'; hctx.lineWidth = 2; hctx.setLineDash([6, 6]);
  hctx.beginPath(); hctx.moveTo(20, H - 34);
  for (let i = 0; i <= 40; i++) { const tt = i / 40; hctx.lineTo(30 + tt * (W - 60), H - 40 - Math.sin(tt * Math.PI) * (H * 0.55)); }
  hctx.stroke(); hctx.setLineDash([]);
  // echo ghosts trailing behind current creature
  if (b) {
    const ghosts = S.echoes.slice(0, 3);
    ghosts.forEach((e, i) => {
      hctx.save(); hctx.translate(-34 * (i + 1), 10 * (i + 1)); hctx.scale(0.82 - i * 0.1, 0.82 - i * 0.1); hctx.translate(W * 0.11 * (i + 1), -6 * (i + 1));
      drawCreature(hctx, W, H, e.g, (t - (i + 1) * 0.03 + 1) % 1, { ghost: i + 1 });
      hctx.restore();
    });
    drawCreature(hctx, W, H, b.g, t, { crown: b.evo });
    if (keeperMode) { // parade all beasts
      S.beasts.slice(0, 8).forEach((p, i) => {
        const px = 40 + (i / 8) * (W - 80), py = 44 + Math.sin(t * Math.PI * 4 + i) * 8;
        hctx.save(); hctx.translate(px - W / 2, py - H / 2); hctx.scale(0.28, 0.28); hctx.translate(W / 2 - 0, 0);
        drawCreature(hctx, W, H, p.g, (t + i * 0.05) % 1, {});
        hctx.restore();
      });
    }
  } else {
    hctx.fillStyle = '#FFFDF5'; hctx.font = '700 22px "Space Mono", monospace'; hctx.textAlign = 'center';
    hctx.fillText('— wind an egg to wake the habitat —', W / 2, H / 2);
  }
  // loop progress + clock
  $('loopFill').style.width = (t * 100) + '%';
  $('loopTick').style.left = `calc(${t * 100}% - 2px)`;
  $('loopLabel').textContent = `LOOP :${String(Math.floor(sec)).padStart(2, '0')} / :60 ${midnight ? '· 🌙 MIDNIGHT GLOW' : ''}`;
  const p = (n) => String(n).padStart(2, '0');
  $('bigClock').textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  // countdown to midnight
  const mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const ms = mid - now, hh = Math.floor(ms / 3.6e6), mm = Math.floor(ms % 3.6e6 / 6e4), ss = Math.floor(ms % 6e4 / 1e3);
  $('midCount').textContent = `${p(hh)}:${p(mm)}:${p(ss)}`;
  // hourly wild egg
  if (now.getHours() !== S.lastHour) {
    S.lastHour = now.getHours();
    const slot = S.eggs.findIndex(e => e.wind < e.need);
    S.eggs[slot >= 0 ? slot : rnd(3)] = mkEgg(0);
    S.echoes.unshift({ name: '◷ hourly bell', g: mkGenome(null), when: Date.now(), kind: 'wild' });
    persist(); renderEggs(); renderEchoes();
    blip(990, .4); setTimeout(() => blip(1320, .5), 200);
    toast(`🕰 The hour turned! A wild egg rolled into the nest.`);
  }
  updateMintBtn();
  requestAnimationFrame(habitatFrame);
}

/* ---------- midnight mint ---------- */
function isMidnight() { const h = new Date().getHours(); return h === 0 || $('timeMachine').checked; }
function updateMintBtn() {
  const ok = isMidnight() && S.beasts.length > 0 && !recentMint();
  $('mintBtn').disabled = !ok;
  if (!S.beasts.length) $('mintMsg').textContent = 'Hatch a creature first — midnight needs someone to crown.';
  else if (recentMint()) $('mintMsg').textContent = 'Tonight\'s evolution is already minted. One per midnight. 👑';
  else if (!isMidnight()) $('mintMsg').textContent = 'The mint opens at 00:00. Flip the time-machine to preview.';
  else $('mintMsg').textContent = '🌙 MIDNIGHT IS OPEN — mint your evolution now!';
}
function recentMint() {
  const day = new Date().toDateString() + ($('timeMachine') && $('timeMachine').checked ? '-tm' : '');
  return S.mints.some(m => m.day === day);
}
function mint() {
  if (!isMidnight() || !S.beasts.length || recentMint()) return;
  const src = S.beasts[S.cur] || S.beasts[0];
  const evoG = { ...src.g, tempo: Math.min(2.4, src.g.tempo + 0.3) };
  const evo = { ...mkBeast(evoG, null, 'midnight evolution'), name: 'Midnight ' + src.name, evo: true,
    day: new Date().toDateString() + ($('timeMachine').checked ? '-tm' : ''), from: src.name, no: S.mints.length + 1 };
  S.mints.unshift(evo); S.beasts.unshift({ ...evo });
  S.echoes.unshift({ name: evo.name, g: evo.g, when: Date.now(), kind: 'evo' });
  S.cur = 0; S.hatched++;
  persist(); renderAll(); hatchChord(); setTimeout(() => blip(1560, .6), 300);
  toast(`👑 MIDNIGHT EVOLUTION MINTED: ${evo.name} #${evo.no}!`);
  checkKeeperProgress();
}
function renderMints() {
  const box = $('mints'); box.innerHTML = '';
  if (!S.mints.length) { box.innerHTML = '<p class="hint light" style="margin:0">No evolutions yet. The crowned ones live here.</p>'; return; }
  S.mints.forEach(m => {
    const d = document.createElement('div'); d.className = 'mintcard';
    const c = document.createElement('canvas'); c.width = 200; c.height = 140;
    drawCreature(c.getContext('2d'), 200, 140, m.g, 0.5, { crown: true });
    d.appendChild(c);
    const n = document.createElement('div'); n.className = 'mname'; n.textContent = `👑 ${m.name} #${m.no}`;
    const dt = document.createElement('div'); dt.className = 'mdate'; dt.textContent = `${m.day.replace('-tm', ' (time-machine)')} · from ${m.from}`;
    d.appendChild(n); d.appendChild(dt); box.appendChild(d);
  });
}

/* ---------- easter eggs ---------- */
// 1) click the lantern 7× → KEEPER PARADE. 2) Konami code → same. 3) type "moon" → instant midnight preview pulse.
let lanternClicks = 0, konami = [];
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let typed = '';
function keeperUnleash(source) {
  keeperMode = true;
  $('keeperVeil').hidden = false;
  hatchChord();
  toast(`🏮 THE LANTERN KEEPER AWAKENS (${source})!`);
}
function checkKeeperProgress() {
  if (S.hatched >= 10 && !S.keeperSeen) { S.keeperSeen = true; persist(); keeperUnleash('10 hatchlings'); }
}
$('lanternBtn').addEventListener('click', () => {
  blip(700 + lanternClicks * 60, .12);
  lanternClicks++;
  $('lanternBtn').style.transform = `rotate(${lanternClicks * 12}deg) scale(${1 + lanternClicks * 0.02})`;
  if (lanternClicks >= 7) { lanternClicks = 0; keeperUnleash('7 lantern rubs'); }
  else if (lanternClicks >= 5) toast(`🏮 the lantern warms… (${lanternClicks}/7)`);
});
$('keeperClose').addEventListener('click', () => { $('keeperVeil').hidden = true; });
document.addEventListener('keydown', (e) => {
  konami.push(e.key); if (konami.length > 10) konami.shift();
  if (KONAMI.every((k, i) => konami[i] === k)) { konami = []; keeperUnleash('konami code'); }
  if (e.key.length === 1) { typed = (typed + e.key.toLowerCase()).slice(-4); if (typed === 'moon') { $('timeMachine').checked = true; toast('🌙 "moon" whispered — time-machine engaged.'); updateMintBtn(); } }
});

/* ---------- wire up ---------- */
function renderAll() { renderEggs(); renderMenagerie(); renderEchoes(); renderMints(); renderHabitatMeta(); updateMintBtn(); persist(); }
$('windBtn').addEventListener('pointerdown', startWind);
window.addEventListener('pointerup', stopWind);
$('windBtn').addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startWind(e); });
$('windBtn').addEventListener('keyup', stopWind);
$('layEggBtn').onclick = () => { const i = S.eggs.findIndex(e => e.wind < e.need); S.eggs[i >= 0 ? i : rnd(3)] = mkEgg(rnd(3)); persist(); renderEggs(); blip(440, .12); toast('🥚 a new glass egg rolled in.'); };
$('breedBtn').onclick = crossbreed;
$('clearSelBtn').onclick = () => { S.sel = []; persist(); renderMenagerie(); };
$('prevBtn').onclick = () => { if (!S.beasts.length) return; S.cur = (S.cur - 1 + S.beasts.length) % S.beasts.length; S.sel = []; persist(); renderMenagerie(); renderHabitatMeta(); blip(500, .1); };
$('nextBtn').onclick = () => { if (!S.beasts.length) return; S.cur = (S.cur + 1) % S.beasts.length; S.sel = []; persist(); renderMenagerie(); renderHabitatMeta(); blip(600, .1); };
$('chimeBtn').onclick = () => { S.chime = !S.chime; $('chimeState').textContent = S.chime ? 'on' : 'off'; persist(); };
$('mintBtn').onclick = mint;
$('timeMachine').onchange = updateMintBtn;
$('resetBtn').onclick = () => { if (confirm('Release every creature back into the glass dark?')) { localStorage.removeItem(LS); location.reload(); } };
$('chimeState').textContent = S.chime ? 'on' : 'off';

// seed a starter egg state + demo echo so first paint isn't empty
if (!S.beasts.length && !S.echoes.length) { S.echoes = []; }
renderAll();
requestAnimationFrame(habitatFrame);
console.log('lantern-minute-menagerie ready', { beasts: S.beasts.length });
