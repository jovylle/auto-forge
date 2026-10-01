// Thistle Drum Corps — pixel rhythm march
// Features: drum march (4-lane rhythm) · parade field (canvas) · corps score (combo/rank/best)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 480, H = 270;

const $ = (id) => document.getElementById(id);
const hudScore = $('hudScore'), hudCombo = $('hudCombo'), hudRank = $('hudRank');
const judgeEl = $('judge'), overlay = $('overlay');
const ovKicker = $('ovKicker'), ovTitle = $('ovTitle'), ovText = $('ovText'), ovBest = $('ovBest');
const btnStart = $('btnStart'), btnMute = $('btnMute');
const progressFill = $('progressFill'), accFill = $('accFill'), accVal = $('accVal');
const footStat = $('footStat');

const BPM = 112, BEAT = 60 / BPM, SONG = 52; // seconds
const STRIKE_X = 92, SPAWN_X = 500, SPEED = 150; // px per second (scroll)
const LANES = [
  { name: 'SNARE', key: 'd', color: '#b678f0', drum: 0 },
  { name: 'TENOR', key: 'f', color: '#3ddc84', drum: 1 },
  { name: 'BASS',  key: 'j', color: '#ffc233', drum: 2 },
  { name: 'CRASH', key: 'k', color: '#fff6e3', drum: 3 },
];
const LANE_Y = [196, 218, 240, 174]; // note track rows (low area)
const BEST_KEY = 'thistle-drum-corps-best';

let state = 'ready';
let notes = [], particles = [], puffs = [], floaters = [];
let t = 0, score = 0, combo = 0, maxCombo = 0, hits = 0, total = 0;
let perfects = 0, goods = 0, misses = 0, missStreak = 0;
let muted = false, audio = null, startAt = 0, raf = 0, last = 0;
let baton = 0, stepPhase = 0, shake = 0;
let best = 0, bestRank = '—';
try {
  const b = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
  if (b) { best = b.score | 0; bestRank = b.rank || '—'; }
} catch { /* ignore */ }

function rankFor(s) {
  if (s >= 26000) return 'DRUM MAJOR';
  if (s >= 18000) return 'SECTION LEAD';
  if (s >= 11000) return 'MARCHER';
  if (s >= 5000) return 'PLEDGE';
  return 'CADET';
}

// ---- procedural beatmap: parade cadence, seeded ----
function buildChart() {
  const out = [];
  let id = 0;
  const push = (beat, lane) => out.push({ id: id++, beat, time: 2 + beat * BEAT, lane, hit: false, judged: false });
  const bar = 4; // beats per bar
  const bars = Math.floor((SONG - 4) / (BEAT * bar));
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let b = 0; b < bars; b++) {
    const base = b * bar;
    const energy = b / bars; // ramps up
    // backbeat skeleton: snare on 2 & 4
    push(base + 1, 0); push(base + 3, 0);
    push(base + 0, 2); // bass on 1
    if (b % 2 === 1) push(base + 2, 2);
    if (energy > 0.25 && rnd() > 0.4) push(base + (rnd() > 0.5 ? 0.5 : 2.5), 1);
    if (energy > 0.5 && rnd() > 0.5) push(base + 3.5, 1);
    if (b % 4 === 3) push(base + 0, 3); // crash on phrase starts
    if (energy > 0.7 && rnd() > 0.6) push(base + 1.5, rnd() > 0.5 ? 0 : 1);
    // finale: roll
    if (b === bars - 1) { push(base + 2, 0); push(base + 2.5, 0); push(base + 3, 3); push(base + 3.5, 0); }
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

// ---- audio: tiny synth drums ----
function ensureAudio() {
  if (audio) return audio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audio = new AC();
  return audio;
}
function noiseBuf(ac, dur) {
  const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function playDrum(lane, when = 0) {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();
  const t0 = ac.currentTime + when;
  const g = ac.createGain();
  g.connect(ac.destination);
  if (lane === 2) { // bass kick
    const o = ac.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    g.gain.setValueAtTime(0.9, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    o.connect(g); o.start(t0); o.stop(t0 + 0.25);
  } else if (lane === 0) { // snare
    const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, 0.15);
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.55, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    n.connect(f); f.connect(g); n.start(t0); n.stop(t0 + 0.16);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0.4, t0);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    o.connect(g2); g2.connect(ac.destination); o.start(t0); o.stop(t0 + 0.12);
  } else if (lane === 1) { // tenor tom
    const o = ac.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(330, t0); o.frequency.exponentialRampToValueAtTime(220, t0 + 0.12);
    g.gain.setValueAtTime(0.28, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
    o.connect(g); o.start(t0); o.stop(t0 + 0.18);
  } else { // crash
    const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, 0.5);
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    g.gain.setValueAtTime(0.35, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    n.connect(f); f.connect(g); n.start(t0); n.stop(t0 + 0.5);
  }
}
function playJudge(kind) {
  if (muted || !audio) return;
  const ac = audio, t0 = ac.currentTime;
  if (kind === 'miss') {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 110;
    const g = ac.createGain(); g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.16);
  }
}

// ---- game flow ----
function startGame() {
  ensureAudio();
  notes = buildChart();
  total = notes.length;
  particles = []; puffs = [];
  t = 0; score = 0; combo = 0; maxCombo = 0; hits = 0;
  perfects = 0; goods = 0; misses = 0; missStreak = 0; shake = 0;
  // thistledown floaters
  floaters = Array.from({ length: 26 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: 1 + Math.floor(Math.random() * 2), v: 4 + Math.random() * 10, ph: Math.random() * 9,
  }));
  state = 'playing';
  overlay.classList.add('hidden');
  judge('ON THE MARK');
  footStat.textContent = `${total} NOTES · 112 BPM`;
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
function endGame(win) {
  state = win ? 'clear' : 'fail';
  cancelAnimationFrame(raf);
  const acc = hits + misses === 0 ? 100 : Math.round((hits / (hits + misses)) * 100);
  const rank = rankFor(score);
  const grade = score >= 26000 ? 'S' : score >= 18000 ? 'A' : score >= 11000 ? 'B' : score >= 5000 ? 'C' : 'D';
  if (score > best) {
    best = score; bestRank = rank;
    try { localStorage.setItem(BEST_KEY, JSON.stringify({ score: best, rank: bestRank })); } catch { /* ignore */ }
  }
  ovKicker.textContent = win ? '★ PARADE COMPLETE ★' : '✖ LINE HALTED ✖';
  ovTitle.textContent = win ? `SCORE ${score} · ${rank}` : `SCORE ${score} · ${rank}`;
  ovText.innerHTML = win
    ? `Grade <b>${grade}</b> · ${perfects} perfect / ${goods} good / ${misses} miss · max combo <b>×${maxCombo}</b>. The thistledown settles. March again?`
    : `8 drops broke the step (${misses} misses). Max combo <b>×${maxCombo}</b>. The corps regroups — try again?`;
  btnStart.textContent = win ? '↻ MARCH AGAIN' : '↻ REGROUP & MARCH';
  overlay.classList.remove('hidden');
  updateBest();
}
function updateBest() {
  ovBest.textContent = `BEST: ${best} · RANK: ${bestRank} · ACC: ${accFill ? accVal.textContent : ''}`;
}

// ---- judging ----
function judge(text, cls) {
  judgeEl.textContent = text;
  judgeEl.style.color = cls || '';
  judgeEl.style.borderColor = cls || '';
  judgeEl.classList.remove('pop');
  void judgeEl.offsetWidth;
  judgeEl.classList.add('pop');
}
function strike(lane) {
  // pad flash
  const pad = document.querySelector(`.pad[data-lane="${lane}"]`);
  if (pad) { pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 120); }
  if (state !== 'playing') { playDrum(lane); puffAtLane(lane, false); return; }
  // find nearest unjudged note in lane
  let bestN = null, bestDx = 1e9;
  for (const n of notes) {
    if (n.lane !== lane || n.judged) continue;
    const x = noteX(n);
    const dx = Math.abs(x - STRIKE_X);
    if (dx < bestDx) { bestDx = dx; bestN = n; }
  }
  playDrum(lane);
  const PERFECT = 13, GOOD = 26;
  if (bestN && bestDx <= GOOD) {
    bestN.judged = true; bestN.hit = true;
    const perfect = bestDx <= PERFECT;
    combo++; maxCombo = Math.max(maxCombo, combo); hits++;
    missStreak = 0;
    const mult = 1 + Math.floor(combo / 10) * 0.5;
    const gain = Math.round((perfect ? 300 : 100) * mult);
    score += gain;
    if (perfect) perfects++; else goods++;
    puffAtLane(lane, true);
    judge(perfect ? 'PERFECT!' : 'GOOD', perfect ? '#ffc233' : '#3ddc84');
    stepPhase += 0.9;
  } else {
    combo = 0; misses++; missStreak++;
    playJudge('miss'); shake = 5;
    judge('MISS', '#b678f0');
    if (misses >= 8 || missStreak >= 4) { render(t); endGame(false); return; }
  }
  updateHud();
}
function updateHud() {
  hudScore.textContent = String(score).padStart(6, '0');
  hudCombo.textContent = `COMBO ×${combo}`;
  hudRank.textContent = rankFor(score);
  const done = hits + misses;
  const acc = done === 0 ? 100 : Math.round((perfects + goods * 0.6) / done * 100);
  accVal.textContent = acc + '%';
  accFill.style.width = Math.max(0, Math.min(100, acc)) + '%';
  progressFill.style.width = Math.min(100, (t / SONG) * 100) + '%';
}

// ---- helpers ----
// simpler: position from time difference
function noteX(n) { return STRIKE_X + (n.time - t) * SPEED; }
function puffAtLane(lane, gold) {
  for (let i = 0; i < 8; i++) {
    puffs.push({
      x: STRIKE_X + (Math.random() - 0.5) * 14,
      y: LANE_Y[lane] + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.3) * 60, vy: -30 - Math.random() * 60,
      life: 0.5, age: 0, gold,
    });
  }
}

// ---- pixel drawing ----
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawCrowd(step) {
  // stands: two bands with bouncing pixel heads
  px(0, 0, W, 64, '#14091f');
  px(0, 60, W, 4, '#ffc233');
  const cols = ['#b678f0', '#3ddc84', '#fff6e3'];
  for (let i = 0; i < 40; i++) {
    const x = i * 12 + 3;
    const bounce = ((i * 7 + Math.floor(step * 4)) % 3 === 0) ? -2 : 0;
    px(x, 34 + bounce, 8, 10, '#14091f'); // body
    px(x + 1, 28 + bounce, 6, 6, cols[i % 3]); // head
    if (i % 5 === 0) px(x + 2, 44 + bounce, 4, 2, '#ffc233'); // pennant
  }
  // bunting
  for (let i = 0; i < 12; i++) px(i * 40 + (Math.floor(step * 2) % 2) * 4, 52, 14, 6, i % 2 ? '#b678f0' : '#3ddc84');
}
function drawField(step) {
  px(0, 64, W, H - 64, '#14091f');
  // mowed stripes
  for (let i = 0; i < 8; i++) if (i % 2 === 0) px(0, 64 + i * 26, W, 26, 'rgba(61,220,132,.14)');
  // yard lines scroll slowly as corps marches (parallax)
  const off = state === 'playing' ? (t * 22) % 60 : 0;
  ctx.fillStyle = '#fff6e3';
  ctx.font = '8px monospace';
  for (let x = -60 + (60 - off); x < W + 60; x += 60) {
    px(x, 64, 2, H - 64, '#fff6e3');
  }
  px(0, 150, W, 2, 'rgba(255,246,227,.5)');
  // strike line (gold, glowing)
  const glow = 2 + Math.sin(baton * 6) * 1;
  px(STRIKE_X - 2, 150, 4 + glow, 110, '#ffc233');
  px(STRIKE_X - 2, 150, 4 + glow, 4, '#fff6e3');
  // lane labels
  ctx.fillStyle = '#14091f';
  LANES.forEach((l, i) => {
    px(6, LANE_Y[i] - 7, 10, 10, l.color);
    ctx.fillStyle = '#fff6e3';
    ctx.fillText(l.key.toUpperCase(), 22, LANE_Y[i] + 1);
    ctx.fillStyle = '#14091f';
  });
}
function drawDrummer(x, y, color, march, drum, hitting) {
  const b = Math.floor(march * 6) % 2 ? 1 : 0;
  const lift = hitting ? -3 : (b ? -1 : 0);
  // shadow
  px(x - 7, y + 16, 18, 3, 'rgba(0,0,0,.4)');
  // legs
  px(x - 4, y + 8 + (b ? -2 : 0), 3, 8 - (b ? -2 : 0), '#14091f');
  px(x + 2, y + 8 + (b ? 0 : -2), 3, 8 - (b ? 0 : -2), '#14091f');
  // body (uniform)
  px(x - 6, y - 2 + lift, 14, 11, color);
  px(x - 6, y + 4 + lift, 14, 2, '#14091f'); // belt
  px(x - 2, y - 2 + lift, 2, 5, '#fff6e3'); // strap
  // head + shako hat
  px(x - 4, y - 9 + lift, 10, 7, '#fff6e3');
  px(x - 5, y - 13 + lift, 12, 5, '#14091f');
  px(x + 3, y - 16 + lift, 3, 4, '#ffc233'); // plume
  // drum
  const dw = drum === 2 ? 12 : 9;
  px(x - dw / 2 + 1, y + 2 + lift, dw, drum === 2 ? 9 : 7, '#fff6e3');
  px(x - dw / 2 + 1, y + 2 + lift, dw, 2, drum === 2 ? '#ffc233' : color);
  // sticks (raise when hitting)
  const sa = hitting ? -6 : 2;
  px(x - 8, y - 4 + lift + sa, 3, 3, '#ffc233');
  px(x + 7, y - 4 + lift - sa, 3, 3, '#ffc233');
}
function drawMajor(x, y, march) {
  const wave = Math.sin(march * 6) * 4;
  px(x - 6, y + 14, 16, 3, 'rgba(0,0,0,.4)');
  px(x - 4, y + 6, 3, 8, '#14091f');
  px(x + 2, y + 6, 3, 8, '#14091f');
  px(x - 6, y - 4, 14, 11, '#ffc233');
  px(x - 6, y + 1, 14, 2, '#14091f');
  px(x - 4, y - 11, 10, 7, '#fff6e3');
  px(x - 5, y - 16, 12, 6, '#b678f0');
  // baton twirl
  const bx = x + 14, by = y - 12 + wave;
  px(bx - 1, by - 8, 3, 16, '#fff6e3');
  px(bx - 1, by - 8, 3, 4, '#b678f0');
  px(bx - 1, by + 4, 3, 4, '#b678f0');
}
function drawNote(n) {
  const x = noteX(n), y = LANE_Y[n.lane];
  if (x < -20 || x > W + 20 || n.judged) return;
  const c = LANES[n.lane].color;
  const near = Math.abs(x - STRIKE_X) < 13;
  const s = near ? 2 : 0;
  // pixel drum diamond
  px(x - 7 - s / 2, y - 7 - s / 2, 14 + s, 14 + s, '#14091f');
  px(x - 5 - s / 2, y - 5 - s / 2, 10 + s, 10 + s, c);
  px(x - 2, y - 2, 4, 4, '#14091f');
  if (n.lane === 3) { px(x - 6, y - 1, 12, 2, '#14091f'); px(x - 1, y - 6, 2, 12, '#14091f'); }
}
function render(dt) {
  ctx.save();
  ctx.fillStyle = '#14091f';
  ctx.fillRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawCrowd(t);
  drawField(t);
  // floaters (thistledown)
  ctx.fillStyle = '#fff6e3';
  for (const f of floaters) {
    const yy = (f.y + Math.sin(t * 1.5 + f.ph) * 6 + H) % H;
    px(f.x, yy, f.s, f.s, 'rgba(255,246,227,.8)');
  }
  // notes behind drummers
  for (const n of notes) drawNote(n);
  // strike flash
  // corps: major + 4 drummers marching in place (field scrolls)
  const mx = 150 + Math.sin(t * 0.8) * 2;
  drawMajor(mx, 150, t + stepPhase * 0.15);
  const cols = ['#b678f0', '#3ddc84', '#ffc233', '#fff6e3'];
  LANES.forEach((l, i) => {
    const recent = puffs.some((p) => p.age < 0.15 && Math.abs(p.y - LANE_Y[i]) < 12);
    drawDrummer(200 + i * 52, 168 + (i % 2) * 6, cols[i], t + stepPhase * 0.12 + i * 0.3, i, recent);
  });
  // puffs
  for (const p of puffs) {
    const a = 1 - p.age / p.life;
    px(p.x, p.y, 3, 3, p.gold ? '#ffc233' : '#fff6e3');
    if (a > 0.5) px(p.x + 4, p.y - 3, 2, 2, p.gold ? '#fff6e3' : '#b678f0');
  }
  // beat baton marker on strike line + countdown text
  const beatPos = (t / BEAT) % 1;
  px(STRIKE_X - 4, 154 + beatPos * 100, 8, 3, '#fff6e3');
  // progress flag + yard text
  ctx.fillStyle = '#ffc233';
  ctx.font = 'bold 9px monospace';
  const yards = Math.floor((t / SONG) * 100);
  ctx.fillText(yards + ' YD', 8, 76);
  ctx.restore();
}

// ---- loop ----
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'playing') {
    t += dt;
    baton += dt;
    // auto-miss notes that sailed past
    for (const n of notes) {
      if (!n.judged && noteX(n) < STRIKE_X - 28) {
        n.judged = true; n.hit = false;
        combo = 0; misses++; missStreak++;
        playJudge('miss'); shake = 5;
        judge('MISS', '#b678f0');
        updateHud();
        if (misses >= 8 || missStreak >= 4) { render(dt); endGame(false); return; }
      }
    }
    // particles
    for (const f of floaters) { f.x -= f.v * dt; if (f.x < -4) { f.x = W + 4; f.y = Math.random() * H; } }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.age >= p.life) puffs.splice(i, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    updateHud();
    if (t >= SONG) {
      // tally remaining as hits (they scrolled out judged already); finish
      const unjudged = notes.filter((n) => !n.judged);
      misses += unjudged.length;
      render(dt); endGame(misses < 8 && score > 0); return;
    }
  }
  render(dt);
  raf = requestAnimationFrame(frame);
}

// ---- input ----
const KEYMAP = { d: 0, f: 1, j: 2, k: 3 };
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') {
    if (state !== 'playing') { e.preventDefault(); startGame(); }
    return;
  }
  if (k in KEYMAP) { e.preventDefault(); strike(KEYMAP[k]); }
});
document.querySelectorAll('.pad').forEach((p) => {
  p.addEventListener('pointerdown', (e) => { e.preventDefault(); strike(Number(p.dataset.lane)); });
});
btnStart.addEventListener('click', startGame);
btnMute.addEventListener('click', () => {
  muted = !muted;
  btnMute.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  btnMute.setAttribute('aria-pressed', String(muted));
});

// idle attract: gentle render behind overlay
floaters = Array.from({ length: 26 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  s: 1 + Math.floor(Math.random() * 2), v: 4 + Math.random() * 10, ph: Math.random() * 9,
}));
notes = [];
updateBest();
updateHud();
(function idle() {
  if (state === 'ready') { t += 0.016; render(0.016); requestAnimationFrame(idle); }
})();
