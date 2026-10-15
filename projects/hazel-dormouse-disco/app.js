// Hazel Dormouse Disco — pocket neon step-sequencer
// CLICK ONLY: every interaction is a <button> click. No keys, no drag, no text inputs.
// Sound: 100% synthesized WebAudio, zero assets.

const TRACKS = [
  { id: 'kick', en: 'TAIKO', jp: 'ドン',  color: '#ff2e88' },
  { id: 'hat',  en: 'HAT',   jp: 'シャン', color: '#22e6ff' },
  { id: 'bass', en: 'BASS',  jp: 'ベース', color: '#c6ff3e' },
  { id: 'lead', en: 'STAR',  jp: '星',    color: '#ffd23e' },
];
const STEPS = 8;
const MIN_BPM = 80, MAX_BPM = 160;
const STORE_KEY = 'hazel-dormouse-disco:v1';
// A-minor pentatonic ladder for the STAR track, one rung per step
const LEAD_FREQS = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5];
// Bass roots per step (A A A A F F G G) — classic neon-drive progression
const BASS_FREQS = [55, 55, 55, 55, 43.65, 43.65, 49, 49];

const PRESETS = [
  { name: 'midnight', bpm: 96,
    grid: [[1,0,0,0,1,0,0,0],[0,0,1,0,0,0,1,0],[1,0,0,0,0,0,1,0],[0,0,0,0,1,0,0,1]] },
  { name: 'last-train', bpm: 128,
    grid: [[1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1],[1,0,0,1,0,0,1,0],[1,0,0,0,0,1,0,0]] },
  { name: 'matsuri', bpm: 140,
    grid: [[1,0,1,1,0,1,0,1],[1,1,0,1,1,0,1,0],[0,0,1,0,0,0,1,1],[0,1,0,0,1,0,1,0]] },
];

const RANKS = [
  [0,  '見習い apprentice'],
  [25, '灯ともしび lighter'],
  [45, '踊り子 dancer'],
  [60, '電飾職人 neon-smith'],
  [75, '將軍ディスコ disco-shogun'],
  [90, '神 neon-kami'],
];

// ── state ──
let grid = PRESETS[0].grid.map(r => r.slice());
let bpm = PRESETS[0].bpm;
let playing = false;
let step = 0;
let nextTime = 0;
let timer = null;

// ── dom ──
const $ = id => document.getElementById(id);
const gridEl = $('grid'), dotsEl = $('step-dots');
const btnPlay = $('btn-play'), bpmEl = $('bpm');
const dormouse = $('dormouse'), moodEl = $('dj-mood');
const scoreEl = $('groove-score'), fillEl = $('groove-fill');
const rankEl = $('groove-rank'), feverEl = $('fever');
const shareMsg = $('share-msg');

const padBtns = [];
const dotEls = [];

// ── build grid (buttons = clicks only) ──
TRACKS.forEach((t, r) => {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.track = String(r);
  const label = document.createElement('div');
  label.className = 'track-name';
  label.innerHTML = `<b>${t.en}</b><span class="jp">${t.jp}</span>`;
  row.appendChild(label);
  padBtns[r] = [];
  for (let s = 0; s < STEPS; s++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pad' + (s % 2 === 0 ? ' beat' : '');
    b.style.setProperty('--c', t.color);
    b.setAttribute('aria-label', `${t.en} step ${s + 1} ${grid[r][s] ? 'on' : 'off'}`);
    b.addEventListener('click', () => togglePad(r, s));
    row.appendChild(b);
    padBtns[r][s] = b;
  }
  gridEl.appendChild(row);
});
for (let s = 0; s < STEPS; s++) {
  const d = document.createElement('i');
  dotsEl.appendChild(d);
  dotEls.push(d);
}

function togglePad(r, s) {
  ensureAudio();
  grid[r][s] = grid[r][s] ? 0 : 1;
  // preview the voice on toggle-on: instant click = instant sound (constraint)
  if (grid[r][s]) playVoice(r, s, actx.currentTime);
  else blip(220, 0.05, 'sine', 0.08);
  refresh();
  persist();
}

function refresh() {
  TRACKS.forEach((_, r) => {
    for (let s = 0; s < STEPS; s++) {
      const b = padBtns[r][s];
      b.classList.toggle('on', !!grid[r][s]);
      b.setAttribute('aria-label', `${TRACKS[r].en} step ${s + 1} ${grid[r][s] ? 'on' : 'off'}`);
    }
  });
  bpmEl.textContent = String(bpm);
  const score = grooveScore();
  scoreEl.textContent = String(score);
  fillEl.style.width = score + '%';
  const rank = [...RANKS].reverse().find(([t]) => score >= t);
  rankEl.innerHTML = `RANK: <strong>${rank[1]}</strong>`;
  const fever = score >= 70;
  feverEl.hidden = !fever;
  dormouse.classList.toggle('fever', fever);
}

// ── groove scoring (the "game") ──
function grooveScore() {
  const total = STEPS * TRACKS.length;
  let hits = 0;
  const perTrack = [0, 0, 0, 0];
  grid.forEach((row, r) => row.forEach(v => { hits += v; perTrack[r] += v; }));
  const density = hits / total;
  // sweet-spot density curve: peaks ~0.45, dead at 0 or 1
  const densityPts = Math.round(40 * Math.max(0, 1 - Math.abs(density - 0.45) / 0.45));
  // all four voices in the mix?
  const spreadPts = perTrack.filter(c => c > 0).length * 7; // max 28
  // taiko on the downbeat = the dormouse nods approvingly
  const downbeatPts = (grid[0][0] ? 12 : 0) + (grid[0][4] ? 8 : 0);
  // no two identical adjacent columns (boring = sleepy)
  let variety = 0;
  for (let s = 0; s < STEPS; s++) {
    const a = grid.map(row => row[s]).join('');
    const b = grid.map(row => row[(s + 1) % STEPS]).join('');
    if (a !== b) variety += 1;
  }
  const varietyPts = Math.round((variety / STEPS) * 12);
  return Math.min(100, densityPts + spreadPts + downbeatPts + varietyPts);
}

// ── WebAudio: everything synthesized ──
let actx = null, master = null, noiseBuf = null;

function ensureAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.85;
  const comp = actx.createDynamicsCompressor();
  master.connect(comp).connect(actx.destination);
  noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.3, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(g, t, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
}

function kick(t) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  env(g, t, 0.9, 0.24);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.26);
}

function hat(t) {
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
  const g = actx.createGain();
  env(g, t, 0.32, 0.07);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + 0.1);
}

function bass(t, freq) {
  const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
  o.type = 'sawtooth'; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(220, t + 0.18);
  env(g, t, 0.5, 0.22);
  o.connect(f).connect(g).connect(master);
  o.start(t); o.stop(t + 0.24);
}

function lead(t, freq) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  const o2 = actx.createOscillator(), g2 = actx.createGain();
  o2.type = 'sine'; o2.frequency.value = freq * 2;
  env(g, t, 0.34, 0.2); env(g2, t, 0.1, 0.14);
  o.connect(g).connect(master); o2.connect(g2).connect(master);
  o.start(t); o.stop(t + 0.22); o2.start(t); o2.stop(t + 0.16);
  // neon sparkle: short delay echo
  const dl = actx.createDelay(0.5); dl.delayTime.value = 0.22;
  const fb = actx.createGain(); fb.gain.value = 0.3;
  const wet = actx.createGain(); wet.gain.value = 0.25;
  g.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(master);
}

function blip(freq, dur, type, vol) {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  env(g, t, vol, dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function playVoice(r, s, t) {
  if (!actx) return;
  if (r === 0) kick(t);
  else if (r === 1) hat(t);
  else if (r === 2) bass(t, BASS_FREQS[s]);
  else lead(t, LEAD_FREQS[s]);
}

// ── sequencer: lookahead scheduler ──
function stepDur() { return 60 / bpm / 2; } // 8th notes: 8 steps = 1 bar

function scheduler() {
  while (nextTime < actx.currentTime + 0.12) {
    const s = step;
    for (let r = 0; r < TRACKS.length; r++) {
      if (grid[r][s]) { playVoice(r, s, nextTime); burst(r); }
    }
    const delay = Math.max(0, (nextTime - actx.currentTime) * 1000);
    setTimeout(((ss) => () => paintPlayhead(ss))(s), delay);
    nextTime += stepDur();
    step = (step + 1) % STEPS;
  }
}

function paintPlayhead(s) {
  document.querySelectorAll('.pad.now').forEach(el => el.classList.remove('now'));
  document.querySelectorAll('.row').forEach(row => {
    const cells = row.children;
    if (cells[s + 1]) cells[s + 1].classList.add('now');
  });
  dotEls.forEach((d, i) => d.classList.toggle('on', i === s));
}

function start() {
  ensureAudio();
  if (!actx) { say('WebAudio is not available in this browser.', true); return; }
  playing = true; step = 0;
  nextTime = actx.currentTime + 0.06;
  timer = setInterval(scheduler, 25);
  btnPlay.innerHTML = '■ STOP <span class="jp">停止</span>';
  btnPlay.classList.add('stop');
  dormouse.classList.add('dancing');
  moodEl.innerHTML = '<span class="jp">絶好調</span> · the dormouse is AWAKE';
  say('');
}

function stop() {
  playing = false;
  clearInterval(timer); timer = null;
  btnPlay.innerHTML = '▶ PLAY <span class="jp">再生</span>';
  btnPlay.classList.remove('stop');
  dormouse.classList.remove('dancing');
  moodEl.innerHTML = '<span class="jp">睡眠中</span> · asleep… click PLAY';
  document.querySelectorAll('.pad.now').forEach(el => el.classList.remove('now'));
  dotEls.forEach(d => d.classList.remove('on'));
}

btnPlay.addEventListener('click', () => { playing ? stop() : start(); });
$('btn-slower').addEventListener('click', () => {
  ensureAudio(); bpm = Math.max(MIN_BPM, bpm - 4); blip(330, 0.06, 'square', 0.1); refresh(); persist();
});
$('btn-faster').addEventListener('click', () => {
  ensureAudio(); bpm = Math.min(MAX_BPM, bpm + 4); blip(494, 0.06, 'square', 0.1); refresh(); persist();
});
$('btn-clear').addEventListener('click', () => {
  ensureAudio(); grid = grid.map(r => r.map(() => 0)); blip(180, 0.09, 'sine', 0.12); refresh(); persist();
  say('Grid cleared. The floor is dark — light it up.');
});
$('btn-dice').addEventListener('click', () => {
  ensureAudio();
  grid = grid.map(row => row.map(() => (Math.random() < 0.42 ? 1 : 0)));
  if (!grid.some(r => r.some(Boolean))) grid[0][0] = 1;
  // lucky arpeggio
  [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.08, 'triangle', 0.12), i * 70));
  refresh(); persist();
  say(`The dormouse rolled the bones — groove ${grooveScore()}.`);
});
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureAudio();
    const p = PRESETS[Number(btn.dataset.preset)];
    grid = p.grid.map(r => r.slice()); bpm = p.bpm;
    blip(660, 0.07, 'triangle', 0.12);
    document.querySelectorAll('[data-preset]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    refresh(); persist();
    say(`House pattern “${p.name}” loaded at ${p.bpm} BPM.`);
  });
});

// ── share / export ──
function encodeState() {
  const masks = grid.map(row => row.reduce((m, v, s) => m | (v << s), 0));
  const payload = JSON.stringify({ v: 1, bpm, m: masks });
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const obj = JSON.parse(atob(b64));
  if (!obj || obj.v !== 1 || !Array.isArray(obj.m) || obj.m.length !== 4) throw new Error('bad payload');
  const bpmNum = Math.min(MAX_BPM, Math.max(MIN_BPM, Number(obj.bpm) || 112));
  const g = obj.m.map(m => Array.from({ length: STEPS }, (_, s) => (Number(m) >> s) & 1));
  return { bpm: bpmNum, grid: g };
}

function shareURL() {
  const url = new URL(location.href.split('#')[0]);
  url.hash = 'd=' + encodeState();
  return url.toString();
}

function say(msg, isErr = false) {
  shareMsg.textContent = msg;
  shareMsg.classList.toggle('err', isErr);
}

$('btn-copy').addEventListener('click', async () => {
  const url = shareURL();
  persist();
  try {
    await navigator.clipboard.writeText(url);
    say('Disco link copied — anyone opening it hears your exact pattern.');
  } catch {
    // file:// fallback: select-free prompt-free path — stash in hash + show it
    location.hash = 'd=' + encodeState();
    say('Clipboard blocked — link is now in the address bar. Copy it from there.', true);
  }
});

$('btn-download').addEventListener('click', () => {
  const data = JSON.stringify({ title: 'Hazel Dormouse Disco', bpm, grid, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hazel-dormouse-disco.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  blip(880, 0.08, 'triangle', 0.12);
  say('Pattern downloaded as JSON. Keep it forever.');
});

// ── persistence: URL hash wins, then localStorage, then preset ──
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ bpm, grid })); } catch { /* private mode */ }
}

function restore() {
  if (location.hash.startsWith('#d=')) {
    try {
      const s = decodeState(location.hash.slice(3));
      bpm = s.bpm; grid = s.grid;
      say('Loaded a shared disco from the link. Press PLAY.');
      return;
    } catch { /* fall through */ }
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.grid) && s.grid.length === 4) { grid = s.grid; bpm = s.bpm || bpm; }
    }
  } catch { /* ignore */ }
}

// ── neon rain canvas (decorative, pointer-events:none → still click-only) ──
const canvas = $('rain'), ctx = canvas.getContext('2d');
let drops = [], sparks = [];
function sizeCanvas() {
  canvas.width = Math.floor(innerWidth * devicePixelRatio);
  canvas.height = Math.floor(innerHeight * devicePixelRatio);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
sizeCanvas();
addEventListener('resize', sizeCanvas);
function seedDrops() {
  drops = Array.from({ length: 60 }, () => ({
    x: Math.random(), y: Math.random(),
    v: 0.001 + Math.random() * 0.004,
    c: Math.random() < 0.5 ? '34,230,255' : '255,46,136',
    a: 0.12 + Math.random() * 0.3,
  }));
}
seedDrops();
function burst(trackIdx) {
  for (let i = 0; i < 10; i++) {
    if (sparks.length > 220) sparks.shift();
    sparks.push({
      x: Math.random() * canvas.width, y: canvas.height * (0.25 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.7) * 260,
      life: 1, c: TRACKS[trackIdx].color,
    });
  }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;
  for (const p of drops) {
    p.y += p.v * dt * 60;
    if (p.y > 1) { p.y = -0.02; p.x = Math.random(); }
    ctx.fillStyle = `rgba(${p.c},${p.a})`;
    ctx.fillRect(p.x * w, p.y * h, 2 * devicePixelRatio, 14 * devicePixelRatio);
  }
  sparks = sparks.filter(p => p.life > 0);
  for (const p of sparks) {
    p.x += p.vx * dt * devicePixelRatio; p.y += p.vy * dt * devicePixelRatio;
    p.vy += 500 * dt * devicePixelRatio; p.life -= dt * 1.6;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── boot ──
restore();
refresh();
