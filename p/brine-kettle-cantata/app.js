// Brine Kettle Cantata — click-only salt-water synth.
// boil voices = 4 WebAudio voices fed by bubble pops + auto-sequencer
// salt chorus = detune/shimmer depth driven by SALT (click +/-)
// cantata export = MediaRecorder audio + JSON score + PNG poster

const $ = (s) => document.querySelector(s);
const canvas = $('#boil'), ctx = canvas.getContext('2d');
const els = {
  audio: $('#audioState'), temp: $('#roTemp'), heat: $('#roHeat'), salt: $('#roSalt'),
  mov: $('#roMov'), voices: $('#voices'), score: $('#score'), saltFill: $('#saltFill'),
  saltPct: $('#saltPct'), rec: $('#recState'), stats: $('#statLine'), count: $('#voiceCount'),
};

// --- state (persisted) ---
const store = (() => {
  try { return JSON.parse(localStorage.getItem('bkc') || '{}'); } catch { return {}; }
})();
const S = {
  heat: store.heat ?? 2, salt: store.salt ?? 15, temp: 20,
  movement: store.movement ?? 0, choir: true, auto: false,
  pops: 0, notes: 0, score: [], takeStart: 0,
};
const save = () => { try { localStorage.setItem('bkc', JSON.stringify({ heat: S.heat, salt: S.salt, movement: S.movement })); } catch {} };

// --- movements = scales (click chips) ---
const MOVS = [
  { name: 'I · SIMMER', base: 110.0, scale: [0, 3, 5, 7, 10, 12, 15], bpm: 72 },
  { name: 'II · ROLL', base: 130.81, scale: [0, 2, 3, 7, 9, 12, 14], bpm: 104 },
  { name: 'III · BRINE STORM', base: 98.0, scale: [0, 1, 5, 6, 7, 11, 12], bpm: 140 },
];
const VOICE_NAMES = ['KETTLE', 'BRINE', 'STEAM', 'SALT'];
const VOICE_TYPE = ['sawtooth', 'square', 'triangle', 'sine'];

// --- audio graph (lazy, click-created) ---
let AC = null, master, chorusBus, delaySend, streamDest, recorder = null, chunks = [];
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return true; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  AC = new Ctx();
  master = AC.createGain(); master.gain.value = 0.7;
  const comp = AC.createDynamicsCompressor();
  master.connect(comp); comp.connect(AC.destination);
  streamDest = AC.createMediaStreamDestination();
  comp.connect(streamDest);
  // salt chorus: parallel detuned delays + shimmer
  chorusBus = AC.createGain(); chorusBus.gain.value = 0.5;
  chorusBus.connect(master);
  delaySend = AC.createDelay(1); delaySend.delayTime.value = 0.28;
  const fb = AC.createGain(); fb.gain.value = 0.35;
  const damp = AC.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2200;
  delaySend.connect(damp); damp.connect(fb); fb.connect(delaySend);
  damp.connect(master);
  els.audio.textContent = 'AUDIO: LIVE'; els.audio.classList.add('on');
  return true;
}
const semi = (base, st) => base * Math.pow(2, st / 12);

function pluck(voiceIdx, semitone, vel = 0.5, reason = 'pop') {
  if (!ensureAudio()) return;
  const t = AC.currentTime;
  const mov = MOVS[S.movement];
  const f = semi(mov.base * (voiceIdx === 3 ? 2 : 1), semitone);
  const saltAmt = S.salt / 100;
  // dry voice
  const o = AC.createOscillator(); o.type = VOICE_TYPE[voiceIdx % 4]; o.frequency.value = f;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.001 + vel * 0.5, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + saltAmt * 0.8);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = 600 + S.temp * 30 + saltAmt * 2500;
  o.connect(g); g.connect(lp); lp.connect(master);
  o.start(t); o.stop(t + 2);
  // salt chorus layers (detuned), only when choir on
  const layers = S.choir ? 2 + Math.round(saltAmt * 6) : 0;
  for (let i = 0; i < layers; i++) {
    const c = AC.createOscillator(); c.type = 'sine';
    c.frequency.value = f * (1 + (i % 2 ? 1 : -1) * (0.002 + saltAmt * 0.012));
    const cg = AC.createGain();
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(vel * 0.12, t + 0.03 + i * 0.02);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    c.connect(cg); cg.connect(chorusBus);
    if (i % 3 === 0) { const ds = AC.createGain(); ds.gain.value = 0.4; cg.connect(ds); ds.connect(delaySend); }
    c.start(t); c.stop(t + 1.5);
  }
  // bubble wobble LFO on filter
  const lfo = AC.createOscillator(); lfo.frequency.value = 6 + S.temp / 12;
  const lg = AC.createGain(); lg.gain.value = 200 + saltAmt * 900;
  lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(t + 1.2);

  S.notes++;
  S.score.push({ t: +(AC.currentTime - S.takeStart || performance.now() / 1000).toFixed(2), mov: MOVS[S.movement].name, voice: VOICE_NAMES[voiceIdx % 4], freq: +f.toFixed(1), semi: semitone, salt: S.salt, temp: Math.round(S.temp), why: reason });
  if (S.score.length > 220) S.score.shift();
  renderScore(); renderStats();
  flashVoice(voiceIdx);
}

// --- bubbles (visual + click targets) ---
let bubbles = [], crystals = [], steam = [];
function spawnBubble(pop = false) {
  const r = 4 + Math.random() * (10 + S.temp / 8);
  bubbles.push({ x: 30 + Math.random() * (canvas.width - 60), y: canvas.height - 20, r, vy: 0.6 + S.temp / 60 + Math.random(), wob: Math.random() * 6.28, v: Math.floor(Math.random() * 4), s: MOVS[S.movement].scale[Math.floor(Math.random() * MOVS[S.movement].scale.length)], born: performance.now() });
  if (bubbles.length > 90) bubbles.shift();
}
function draw(now) {
  // simmer physics
  S.temp += ((18 + S.heat * 16) - S.temp) * 0.004;
  if (Math.random() < 0.02 + S.heat * 0.03 + S.temp / 2500) spawnBubble();
  if (Math.random() < S.temp / 9000) steam.push({ x: canvas.width / 2 + (Math.random() - 0.5) * 160, y: 110, r: 8 + Math.random() * 14, a: 0.5 });
  steam.forEach((p) => { p.y -= 0.7; p.r += 0.25; p.a -= 0.006; });
  steam = steam.filter((p) => p.a > 0);

  const W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0620'); g.addColorStop(0.55, '#101a3a'); g.addColorStop(1, '#2b0f3f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // salt glow floor
  const sg = ctx.createRadialGradient(W / 2, H - 30, 10, W / 2, H - 30, 260);
  sg.addColorStop(0, `rgba(255,43,214,${0.25 + S.salt / 400})`); sg.addColorStop(1, 'transparent');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  // kettle silhouette
  ctx.strokeStyle = 'rgba(0,240,255,.75)'; ctx.lineWidth = 3;
  ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, 130); ctx.lineTo(W / 2 - 150, 300);
  ctx.quadraticCurveTo(W / 2 - 155, 340, W / 2 - 110, 345);
  ctx.lineTo(W / 2 + 110, 345); ctx.quadraticCurveTo(W / 2 + 155, 340, W / 2 + 150, 300);
  ctx.lineTo(W / 2 + 120, 130); ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;
  // water line
  const wl = 150 + Math.sin(now / 500) * 4;
  ctx.strokeStyle = 'rgba(255,233,74,.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - 118, wl); ctx.lineTo(W / 2 + 118, wl); ctx.stroke();
  // bubbles
  bubbles.forEach((b) => {
    b.y -= b.vy; b.wob += 0.08; b.x += Math.sin(b.wob) * 0.7;
    const heatGlow = Math.min(1, S.temp / 100);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29);
    ctx.fillStyle = `rgba(0,240,255,${0.08 + heatGlow * 0.15})`; ctx.fill();
    ctx.strokeStyle = b.r > 13 ? '#ffe94a' : '#00f0ff'; ctx.lineWidth = b.r > 13 ? 2.5 : 1.5;
    ctx.shadowColor = b.r > 13 ? '#ffe94a' : '#00f0ff'; ctx.shadowBlur = 10;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, 6.29);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
  });
  bubbles = bubbles.filter((b) => b.y > 120);
  // salt crystals
  ctx.fillStyle = '#ff2bd6';
  crystals.forEach((c) => {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 8;
    ctx.fillRect(-c.s / 2, -c.s / 2, c.s, c.s); ctx.restore();
  });
  // steam
  steam.forEach((p) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29);
    ctx.fillStyle = `rgba(234,246,255,${Math.max(0, p.a) * 0.25})`; ctx.fill();
  });
  // temp shimmer text
  ctx.fillStyle = 'rgba(0,240,255,.9)'; ctx.font = '12px monospace';
  ctx.fillText(S.temp > 96 ? '!! ROLLING BOIL — CLICK THE BIG BUBBLES !!' : S.temp > 60 ? '~ simmer rising ~' : '· cold brine ·', 14, 24);

  els.temp.textContent = `${Math.round(S.temp)}°C`;
  requestAnimationFrame(draw);
}
function seedCrystals() {
  crystals = [];
  const n = Math.round(S.salt / 4);
  for (let i = 0; i < n; i++) crystals.push({ x: 40 + Math.random() * (canvas.width - 80), y: canvas.height - 60 + Math.random() * 40, s: 2 + Math.random() * 4, a: Math.random() * 3 });
}

// click on chamber = pop nearest bubble -> boil voice (CLICK ONLY)
function chamberClick(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  let best = -1, bd = 1e9;
  bubbles.forEach((b, i) => {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < b.r + 26 && d < bd) { bd = d; best = i; }
  });
  ensureAudio();
  if (best >= 0) {
    const [b] = bubbles.splice(best, 1);
    S.pops++;
    const vel = Math.min(1, 0.3 + b.r / 22 + S.heat * 0.08);
    pluck(b.v, b.s, vel, 'pop');
    // pop ring
    steam.push({ x: b.x, y: b.y, r: b.r * 0.6, a: 0.6 });
  } else {
    // clicked water, not a bubble: soft steam hiss note
    pluck(Math.floor(Math.random() * 4), MOVS[S.movement].scale[0], 0.18, 'tap');
  }
  renderStats();
}

// --- auto-cantata sequencer ---
let seqTimer = null;
function setAuto(on) {
  S.auto = on;
  $('#btnAuto').setAttribute('aria-pressed', String(on));
  $('#btnAuto').textContent = on ? '⏸ AUTO-CANTATA' : '▶ AUTO-CANTATA';
  clearInterval(seqTimer); seqTimer = null;
  if (on) {
    ensureAudio();
    const step = () => {
      if (!S.auto) return;
      const mov = MOVS[S.movement];
      const v = Math.floor(Math.random() * 4);
      const s = mov.scale[Math.floor(Math.random() * mov.scale.length)];
      pluck(v, s, 0.35 + Math.random() * 0.4 + S.salt / 300, 'auto');
      if (Math.random() < 0.25) spawnBubble();
    };
    step();
    seqTimer = setInterval(step, 60000 / MOVS[S.movement].bpm / 2);
  }
}

// --- recorder / export ---
function toggleRec() {
  ensureAudio();
  if (recorder && recorder.state === 'recording') {
    recorder.stop(); return;
  }
  if (!window.MediaRecorder || !streamDest) { alert('MediaRecorder not supported here — score + poster export still work.'); return; }
  chunks = [];
  S.takeStart = AC.currentTime;
  recorder = new MediaRecorder(streamDest.stream);
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    window._lastTake = blob;
    els.rec.textContent = `● SAVED ${(blob.size / 1024).toFixed(0)}KB — CLICK ⬇ AUDIO`;
    $('#btnRec').classList.remove('rec'); $('#btnRec').textContent = '● RECORD TAKE';
  };
  recorder.start();
  $('#btnRec').classList.add('rec'); $('#btnRec').textContent = '■ STOP TAKE';
  els.rec.textContent = '● RECORDING… CLICK ■ STOP';
}
function dl(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

// --- render helpers ---
function renderVoices() {
  els.voices.innerHTML = VOICE_NAMES.map((n, i) =>
    `<div class="voice" id="v${i}"><span class="vn">V${i + 1} ${n}</span><span class="vbars">${'<i></i>'.repeat(14)}</span><span class="vf">${VOICE_TYPE[i]} · ${semi(MOVS[S.movement].base * (i === 3 ? 2 : 1), 0).toFixed(0)}Hz</span></div>`).join('');
  els.count.textContent = S.choir ? `${4 + Math.round(S.salt / 100 * 6)} VOICES (4+${Math.round(S.salt / 100 * 6)} CHORUS)` : '4 VOICES (DRY)';
}
function flashVoice(i) {
  const v = document.getElementById('v' + (i % 4));
  if (!v) return;
  v.classList.add('singing');
  const bars = v.querySelectorAll('i');
  bars.forEach((b) => b.style.height = (3 + Math.random() * 23) + 'px');
  setTimeout(() => v.classList.remove('singing'), 260);
}
function renderScore() {
  if (!S.score.length) { els.score.innerHTML = '<li class="empty"><span>No notes yet — click bubbles or run AUTO-CANTATA.</span><b>∅</b></li>'; return; }
  els.score.innerHTML = S.score.slice(-8).reverse().map((n) =>
    `<li><span>${n.mov} · ${n.voice} ${n.freq}Hz · salt ${n.salt} · ${n.why}</span><b>+1</b></li>`).join('');
}
function renderStats() {
  els.stats.textContent = `${S.pops} pops · ${S.notes} notes`;
  els.heat.textContent = 'LV.' + S.heat;
  els.salt.textContent = S.salt + '‰';
  els.mov.textContent = ['I', 'II', 'III'][S.movement];
  els.saltFill.style.width = S.salt + '%';
  els.saltPct.textContent = S.salt + '%';
}

// --- CLICK-ONLY wiring (no inputs, no drag) ---
$('#btnIgnite').addEventListener('click', () => { ensureAudio(); pluck(0, 7, 0.5, 'ignite'); pluck(2, 12, 0.4, 'ignite'); });
$('#btnHeatUp').addEventListener('click', () => { S.heat = Math.min(5, S.heat + 1); save(); renderStats(); ensureAudio(); });
$('#btnHeatDown').addEventListener('click', () => { S.heat = Math.max(1, S.heat - 1); save(); renderStats(); });
$('#btnSaltUp').addEventListener('click', () => { S.salt = Math.min(100, S.salt + 5); seedCrystals(); save(); renderStats(); renderVoices(); });
$('#btnSaltDown').addEventListener('click', () => { S.salt = Math.max(0, S.salt - 5); seedCrystals(); save(); renderStats(); renderVoices(); });
$('#btnChoir').addEventListener('click', (e) => {
  S.choir = !S.choir;
  e.currentTarget.setAttribute('aria-pressed', String(S.choir));
  e.currentTarget.textContent = S.choir ? 'CHOIR: ON' : 'CHOIR: OFF';
  renderVoices();
});
$('#btnAuto').addEventListener('click', () => setAuto(!S.auto));
document.querySelectorAll('[data-mov]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-mov]').forEach((x) => x.classList.remove('is-active'));
  b.classList.add('is-active');
  S.movement = +b.dataset.mov; save(); renderStats(); renderVoices();
  if (S.auto) setAuto(true); // re-tempo
  ensureAudio(); pluck(1, MOVS[S.movement].scale[2], 0.4, 'movement');
}));
canvas.addEventListener('click', chamberClick);
$('#btnRec').addEventListener('click', toggleRec);
$('#btnWav').addEventListener('click', () => {
  if (window._lastTake) dl(`brine-kettle-take-${Date.now()}.webm`, window._lastTake);
  else alert('No take yet — click ● RECORD TAKE first, play, then STOP.');
});
$('#btnScore').addEventListener('click', () => {
  const doc = { title: 'Brine Kettle Cantata', movement: MOVS[S.movement].name, heat: S.heat, salt: S.salt, temp: Math.round(S.temp), notes: S.score, exportedAt: new Date().toISOString() };
  dl(`brine-kettle-score-${Date.now()}.json`, new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
});
$('#btnPoster').addEventListener('click', () => {
  canvas.toBlob((b) => b && dl(`brine-kettle-poster-${Date.now()}.png`, b), 'image/png');
});
$('#btnWipe').addEventListener('click', () => { S.score = []; S.pops = 0; S.notes = 0; renderScore(); renderStats(); });

// init
seedCrystals(); renderVoices(); renderScore(); renderStats();
requestAnimationFrame(draw);
console.log('brine-kettle-cantata ready — click-only protocol');
