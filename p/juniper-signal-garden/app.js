// Juniper Signal Garden — plant signal seeds, pulse sprouts, harvest flashing shrubs for a 6-rune code.
// Stack: plain HTML/CSS/JS. Sound: WebAudio only, no assets. Persistence: localStorage best.
const SEEDS = {
  pulse:  { name: 'Ember Pulse',   rune: '◉', color: '#ff7a59', freq: 392, growMs: 5000,  score: 10, blurb: 'fast · 5s' },
  chime:  { name: 'Frost Chime',   rune: '▲', color: '#5ee7ff', freq: 587, growMs: 8000,  score: 20, blurb: 'bright · 8s' },
  spiral: { name: 'Verdant Spiral', rune: '✦', color: '#9dff8a', freq: 784, growMs: 11000, score: 30, blurb: 'rare · 11s' },
};
const SIZE = 16, CODE_LEN = 6, BOOST_MS = 1800, STORE_KEY = 'juniper-signal-garden-best';

const $ = (s) => document.querySelector(s);
const gridEl = $('#grid'), seedsEl = $('#seeds'), slotsEl = $('#codeSlots');
const timeEl = $('#time'), scoreEl = $('#score'), bestEl = $('#best');
const msgEl = $('#codeMsg'), copyBtn = $('#copyCode'), toastEl = $('#toast');
const winBanner = $('#winBanner'), winCode = $('#winCode'), winSub = $('#winSub');

let selected = 'pulse';
let cells = [];       // { seed, plantedAt, matureAt } | null
let code = [];
let score = 0;
let startAt = performance.now();
let done = false;
let best = null;
try { best = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { best = null; }

// ---------- sound (WebAudio, lazy init on first gesture) ----------
let ctx = null, muted = false;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur = 0.12, type = 'sine', gain = 0.16, when = 0, slide = 0) {
  if (muted) return;
  try {
    const c = ac(), t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  } catch { /* audio unavailable — stay silent */ }
}
const sfx = {
  ui: () => tone(660, 0.06, 'triangle', 0.08),
  plant: (f) => { tone(f * 0.5, 0.1, 'sine', 0.14); tone(f, 0.14, 'triangle', 0.1, 0.07); },
  boost: (f) => tone(f * 1.5, 0.08, 'square', 0.05, 0, f),
  deny: () => tone(160, 0.12, 'sawtooth', 0.07),
  harvest: (f) => { tone(f, 0.12, 'sine', 0.16); tone(f * 1.25, 0.12, 'sine', 0.14, 0.09); tone(f * 1.5, 0.2, 'triangle', 0.12, 0.18); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.11)),
};

// ---------- ui helpers ----------
let toastT = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
function fmtTime(ms) { return (ms / 1000).toFixed(1) + 's'; }
function renderBest() { bestEl.textContent = best ? `${best.score}pts · ${fmtTime(best.ms)}` : '—'; }

// ---------- build seed tray ----------
function buildSeeds() {
  seedsEl.innerHTML = '';
  for (const [id, s] of Object.entries(SEEDS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seed-btn'; b.dataset.seed = id;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === selected));
    b.innerHTML = `<span class="orb"></span><b>${s.rune} ${s.name}</b><small>${s.blurb} · +${s.score}</small>`;
    b.addEventListener('click', () => {
      selected = id; sfx.ui();
      seedsEl.querySelectorAll('.seed-btn').forEach(x => x.setAttribute('aria-checked', String(x.dataset.seed === id)));
    });
    seedsEl.appendChild(b);
  }
}

// ---------- build grid ----------
function stageOf(c, now) {
  if (!c) return 'empty';
  const total = c.matureAt - c.plantedAt, left = c.matureAt - now;
  if (left <= 0) return 'mature';
  const grown = 1 - left / total;
  return grown < 0.35 ? 'seed' : 'sprout';
}
function buildGrid() {
  gridEl.innerHTML = '';
  cells = Array.from({ length: SIZE }, () => null);
  for (let i = 0; i < SIZE; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cell';
    b.dataset.stage = 'empty';
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-label', `Plot ${i + 1}, empty`);
    b.innerHTML = `<span class="soil"></span>`;
    b.addEventListener('click', () => onCell(i, b));
    gridEl.appendChild(b);
  }
}

function onCell(i, el) {
  const now = performance.now();
  const c = cells[i];
  if (!c) {
    const s = SEEDS[selected];
    cells[i] = { seed: selected, plantedAt: now, matureAt: now + s.growMs };
    sfx.plant(s.freq);
    updateCell(i, now);
    toast(`${s.name} planted — tap sprout to pulse-boost ⚡`);
    return;
  }
  const st = stageOf(c, now);
  if (st === 'mature') return harvest(i, el);
  // boost growing plant
  c.matureAt = Math.max(now, c.matureAt - BOOST_MS);
  sfx.boost(SEEDS[c.seed].freq);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  updateCell(i, now);
}

function harvest(i, el) {
  const c = cells[i];
  const s = SEEDS[c.seed];
  cells[i] = null;
  sfx.harvest(s.freq);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  score += s.score;
  scoreEl.textContent = score;
  updateCell(i, performance.now());
  if (done) { toast(`${s.rune} +${s.score} — garden keeps growing`); return; }
  code.push(s.rune);
  renderCode();
  if (code.length >= CODE_LEN) completeSignal();
  else toast(`${s.rune} harvested +${s.score} (${code.length}/${CODE_LEN})`);
}

function updateCell(i, now = performance.now()) {
  const el = gridEl.children[i];
  const c = cells[i];
  const st = stageOf(c, now);
  el.dataset.stage = st;
  if (!c) {
    el.dataset.seed = '';
    el.innerHTML = `<span class="soil"></span>`;
    el.setAttribute('aria-label', `Plot ${i + 1}, empty. Plant ${SEEDS[selected].name}.`);
    return;
  }
  const s = SEEDS[c.seed];
  el.dataset.seed = c.seed;
  const pct = st === 'mature' ? 'READY ✦ tap!' : `${Math.min(99, Math.round((1 - (c.matureAt - now) / (c.matureAt - c.plantedAt)) * 100))}% · tap=boost`;
  el.innerHTML = `<span class="soil"></span><span class="shrub" aria-hidden="true"><i class="c1"></i><i class="c2"></i><i class="c3"></i></span><span class="rune" style="color:${s.color}">${s.rune}</span><span class="pct">${pct}</span>`;
  el.setAttribute('aria-label', `Plot ${i + 1}, ${s.name}, ${st === 'mature' ? 'ready to harvest' : st + ', tap to boost'}.`);
}

function renderCode() {
  slotsEl.innerHTML = '';
  for (let i = 0; i < CODE_LEN; i++) {
    const d = document.createElement('div');
    d.className = 'slot' + (code[i] ? ' full' : '');
    d.textContent = code[i] || '·';
    slotsEl.appendChild(d);
  }
  const left = CODE_LEN - code.length;
  msgEl.textContent = left > 0 ? `Harvest ${left} more flashing shrub${left > 1 ? 's' : ''} to complete the signal.` : 'Signal complete — copy your code!';
  msgEl.classList.toggle('done', left === 0);
  copyBtn.disabled = code.length === 0;
}

function completeSignal() {
  done = true;
  const ms = performance.now() - startAt;
  const str = code.join('');
  sfx.win();
  winCode.textContent = str;
  winSub.textContent = `${score} pts · grown in ${fmtTime(ms)} · ${ms <= 45000 ? '⚡ under-45s lightning gardener!' : 'steady gardener'}`;
  winBanner.classList.remove('hidden');
  const prev = best;
  if (!prev || score > prev.score || (score === prev.score && ms < prev.ms)) {
    best = { code: str, score, ms: Math.round(ms) };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(best)); } catch { /* private mode */ }
    renderBest();
  }
  renderCode();
}

async function copyText(t, label) {
  try {
    await navigator.clipboard.writeText(t);
    toast(`${label} copied ✓`);
    tone(880, 0.1, 'triangle', 0.1);
  } catch {
    // file:// or no permission — show it so it can be selected manually
    toast(`Copy: ${t}`);
  }
}

// ---------- reset / loop ----------
function reset() {
  cells = Array.from({ length: SIZE }, () => null);
  code = []; score = 0; done = false;
  startAt = performance.now();
  scoreEl.textContent = '0';
  winBanner.classList.add('hidden');
  renderCode();
  const now = performance.now();
  for (let i = 0; i < SIZE; i++) updateCell(i, now);
}

$('#newGarden').addEventListener('click', () => { sfx.ui(); reset(); toast('Fresh soil — plant away 🌱'); });
$('#replay').addEventListener('click', () => { sfx.ui(); reset(); toast('New signal run started'); });
$('#winClose').addEventListener('click', () => { sfx.ui(); winBanner.classList.add('hidden'); });
$('#copyCode').addEventListener('click', () => copyText(code.join('') || '◉▲✦', 'Harvest code'));
$('#muteBtn').addEventListener('click', (e) => {
  muted = !muted;
  e.currentTarget.textContent = muted ? '🔇 muted' : '🔊 sound on';
  e.currentTarget.setAttribute('aria-pressed', String(muted));
  if (!muted) sfx.ui();
});
document.addEventListener('pointerdown', () => { if (!muted) { try { ac(); } catch {} } }, { once: true });

// tick: growth + clock (cheap interval keeps file:// friendly)
buildSeeds(); buildGrid(); renderCode(); renderBest();
setInterval(() => {
  const now = performance.now();
  timeEl.textContent = fmtTime(now - startAt);
  let changed = false;
  for (let i = 0; i < SIZE; i++) {
    const el = gridEl.children[i];
    const st = stageOf(cells[i], now);
    if (el.dataset.stage !== st) { updateCell(i, now); changed = true; }
    else if (cells[i] && st !== 'mature') {
      const c = cells[i];
      const pct = `${Math.min(99, Math.round((1 - (c.matureAt - now) / (c.matureAt - c.plantedAt)) * 100))}% · tap=boost`;
      const p = el.querySelector('.pct');
      if (p && p.textContent !== pct) p.textContent = pct;
    }
  }
  void changed;
}, 200);

console.log('juniper-signal-garden ready: plant → pulse → harvest ×6');
