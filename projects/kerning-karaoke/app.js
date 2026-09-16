// Kerning Karaoke — mic pitch -> letter-spacing, kinetic lyrics, combo scoring, encore cards.
// No backend. localStorage for best scores. Works from file://.

const $ = (id) => document.getElementById(id);
const els = {
  chips: $('songChips'), kicker: $('songKicker'), title: $('songTitle'),
  target: $('targetNote'), prev: $('prevLine'), cur: $('curLine'), next: $('nextLine'),
  kern: $('kernVal'), prog: $('lineProgress'), grade: $('gradeChip'),
  score: $('scoreVal'), combo: $('comboVal'), fire: $('comboFire'), perfect: $('perfectVal'),
  mic: $('micBtn'), start: $('startBtn'), demo: $('demoBtn'),
  pitch: $('pitchVal'), needle: $('pitchNeedle'), cents: $('centsVal'),
  pad: $('humPad'), glow: $('humGlow'), slider: $('humSlider'), humMode: $('humMode'),
  chart: $('chartList'), best: $('bestBadge'), micBadge: $('micBadge'),
  modal: $('encoreModal'), canvas: $('encoreCanvas'), stats: $('encoreStats'),
  note: $('encoreNote'), encoreTitle: $('encoreTitle'),
};

const SONGS = [
  {
    title: 'Neon Leading', sub: 'Track 01 · warm up in C major',
    lines: [
      { text: 'TIGHTEN UP THE NIGHT', note: 'C4', freq: 261.63, dur: 3.0 },
      { text: 'LET THE VOWELS GLOW', note: 'D4', freq: 293.66, dur: 3.0 },
      { text: 'SING THE SPACE BETWEEN', note: 'E4', freq: 329.63, dur: 3.2 },
      { text: 'KERN ME LIKE YOU MEAN IT', note: 'G4', freq: 392.0, dur: 3.6 },
    ],
  },
  {
    title: 'Glass Choir', sub: 'Track 02 · floaty & fragile',
    lines: [
      { text: 'FROSTED AIR HUMS SOFT', note: 'A3', freq: 220.0, dur: 3.0 },
      { text: 'BLUR THE EDGES SLOW', note: 'C4', freq: 261.63, dur: 3.0 },
      { text: 'HOLD THE GLASS TOGETHER', note: 'F4', freq: 349.23, dur: 3.4 },
      { text: 'SHATTER INTO STARDUST', note: 'A4', freq: 440.0, dur: 3.8 },
    ],
  },
  {
    title: 'Bassline Ballet', sub: 'Track 03 · low & brave',
    lines: [
      { text: 'DROP IT LOW AND WIDE', note: 'G3', freq: 196.0, dur: 3.0 },
      { text: 'WOBBLE THEN ALIGN', note: 'A3', freq: 220.0, dur: 3.0 },
      { text: 'GLUE EACH GLYPH WITH AIR', note: 'C4', freq: 261.63, dur: 3.2 },
      { text: 'PERFECT KERN FOREVER', note: 'D4', freq: 293.66, dur: 3.8 },
    ],
  },
];

const BEST_KEY = 'kerning-karaoke-best-v1';
const state = {
  song: 0, playing: false, lineIdx: 0, lineT0: 0, raf: 0,
  score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0,
  lineVotes: [], // per-frame 'perfect'|'good'|'miss' for current line
  pitchHz: 0, humHz: 220, voiced: false,
  audio: null, analyser: null, micStream: null, buf: null,
  demo: false, demoT: 0,
  best: loadBest(),
};

function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || 'null'); }
  catch { return null; }
}
function saveBest(b) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* file:// private mode */ }
}

// ---------- song UI ----------
function renderChips() {
  els.chips.innerHTML = '';
  SONGS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'chip' + (i === state.song ? ' active' : '');
    b.textContent = `${String(i + 1).padStart(2, '0')} · ${s.title}`;
    b.setAttribute('role', 'tab');
    b.onclick = () => { if (!state.playing) selectSong(i); };
    els.chips.appendChild(b);
  });
}
function selectSong(i) {
  state.song = i;
  renderChips();
  const s = SONGS[i];
  els.kicker.textContent = s.sub;
  els.title.textContent = s.title;
  renderChart();
  showLine(-1);
  resetScore();
  setTarget(s.lines[0]);
}
function renderChart() {
  els.chart.innerHTML = '';
  SONGS[state.song].lines.forEach((l, i) => {
    const li = document.createElement('li');
    li.id = 'chart-' + i;
    li.innerHTML = `<b>${l.note}</b> · ${escapeHtml(l.text)} · <span>${l.freq.toFixed(1)} Hz</span>`;
    els.chart.appendChild(li);
  });
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function setTarget(line) {
  els.target.textContent = `${line.note} · ${line.freq.toFixed(1)} Hz`;
}
function renderBest() {
  els.best.textContent = state.best ? `★ best ${state.best.score} · ${SONGS[state.best.song]?.title || ''}` : '★ best —';
}

// Split current line into per-char spans for kinetic motion
function showLine(idx) {
  const lines = SONGS[state.song].lines;
  els.prev.textContent = idx > 0 ? lines[idx - 1].text : (state.playing ? '♪' : 'pick a track · hit start · sing!');
  els.next.textContent = idx + 1 < lines.length ? lines[idx + 1].text : (state.playing ? '✨ encore incoming…' : 'four lines · one encore');
  els.cur.innerHTML = '';
  els.cur.classList.remove('fire');
  if (idx < 0 || idx >= lines.length) {
    els.cur.textContent = state.playing ? '' : 'READY TO KERN?';
    return;
  }
  const line = lines[idx];
  setTarget(line);
  [...line.text].forEach((ch, i) => {
    const sp = document.createElement('span');
    sp.className = 'ch';
    sp.textContent = ch === ' ' ? '\u00A0' : ch;
    sp.style.setProperty('--i', i);
    els.cur.appendChild(sp);
  });
  document.querySelectorAll('.chart li').forEach((li, i) => li.classList.toggle('done', i < idx));
}

// ---------- audio: mic pitch ----------
async function enableMic() {
  try {
    if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
    await state.audio.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    state.micStream = stream;
    const src = state.audio.createMediaStreamSource(stream);
    state.analyser = state.audio.createAnalyser();
    state.analyser.fftSize = 2048;
    src.connect(state.analyser);
    state.buf = new Float32Array(state.analyser.fftSize);
    els.humMode.checked = false;
    els.micBadge.textContent = '● mic live';
    els.micBadge.classList.add('live');
    els.micBadge.classList.remove('dim');
    els.mic.textContent = '🎙 Mic live ✓';
  } catch (e) {
    els.micBadge.textContent = '○ mic blocked — hum pad on';
    els.humMode.checked = true;
    els.note && (els.note.textContent = '');
    alert('Mic blocked — no worries! The hum pad is on. Drag it to sing.');
  }
}

function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length, rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return { freq: 0, voiced: false };
  let r1 = 0, r2 = SIZE - 1;
  const th = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < th) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < th) { r2 = SIZE - i; break; }
  const b = buf.slice(r1, r2);
  SIZE = b.length;
  if (SIZE < 64) return { freq: 0, voiced: false };
  const c = new Array(SIZE).fill(0);
  for (let lag = 0; lag < SIZE; lag++)
    for (let i = 0; i < SIZE - lag; i++) c[lag] += b[i] * b[i + lag];
  let d = 0;
  while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  let maxv = -1, maxp = -1;
  for (let i = d; i < SIZE; i++) if (c[i] > maxv) { maxv = c[i]; maxp = i; }
  if (maxp <= 0) return { freq: 0, voiced: false };
  // parabolic interpolation
  const x1 = c[maxp - 1] || 0, x2 = c[maxp], x3 = c[maxp + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2, b2 = (x3 - x1) / 2;
  let shift = 0;
  if (a) shift = -b2 / (2 * a);
  const freq = sampleRate / (maxp + shift);
  if (freq < 60 || freq > 1000) return { freq: 0, voiced: false };
  return { freq, voiced: true };
}

function readPitch() {
  if (state.demo) { // auto-demo: glide onto target with tiny wobble
    const t = performance.now() / 1000;
    const target = SONGS[state.song].lines[Math.min(state.lineIdx, SONGS[state.song].lines.length - 1)].freq;
    const f = target * (1 + 0.004 * Math.sin(t * 5) + 0.002 * Math.sin(t * 13));
    return { freq: f, voiced: true };
  }
  if (!els.humMode.checked && state.analyser) {
    state.analyser.getFloatTimeDomainData(state.buf);
    return autoCorrelate(state.buf, state.audio.sampleRate);
  }
  // hum pad synth: add gentle vibrato so letters feel alive
  const t = performance.now() / 1000;
  return { freq: state.humHz * (1 + 0.006 * Math.sin(t * 6)), voiced: true };
}

// ---------- scoring / game loop ----------
function centsOff(freq, target) {
  if (!freq || freq <= 0) return null;
  return 1200 * Math.log2(freq / target);
}
function resetScore() {
  state.score = 0; state.combo = 0; state.maxCombo = 0;
  state.perfects = 0; state.goods = 0; state.misses = 0;
  paintScore();
}
function paintScore() {
  els.score.textContent = state.score.toLocaleString();
  els.combo.textContent = '×' + state.combo;
  els.perfect.textContent = `${state.perfects}/${SONGS[state.song].lines.length} lines`;
  const fire = state.combo >= 4;
  els.fire.classList.toggle('hidden', !fire);
  els.cur.classList.toggle('fire', fire);
}

function startSong() {
  if (state.playing) return;
  state.demo = false;
  els.demo.classList.remove('active');
  beginRun();
}
function startDemo() {
  if (state.playing) return;
  state.demo = true;
  els.humMode.checked = true;
  beginRun();
}
function beginRun() {
  state.playing = true;
  state.lineIdx = 0; state.lineVotes = [];
  resetScore();
  showLine(0);
  state.lineT0 = performance.now();
  els.start.disabled = true;
  els.demo.disabled = true;
  setGrade('SING!', 'good');
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(tick);
}

function setGrade(text, kind) {
  els.grade.textContent = text;
  els.grade.className = 'grade ' + (kind || 'idle');
}

function finishLine() {
  const votes = state.lineVotes;
  const p = votes.filter((v) => v === 'perfect').length;
  const g = votes.filter((v) => v === 'good').length;
  const total = Math.max(1, votes.length);
  const ratio = (p + g * 0.5) / total;
  const fireMult = state.combo >= 4 ? 2 : 1;
  let verdict, cls, pts;
  if (ratio > 0.62 && p / total > 0.4) {
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.perfects += 1;
    pts = 300 * state.combo * fireMult;
    verdict = state.combo >= 4 ? `PERFECT KERN ×${state.combo} 🔥` : `PERFECT KERN ×${state.combo}`;
    cls = 'perfect';
  } else if (ratio > 0.34) {
    state.combo = 0;
    state.goods += 1;
    pts = 100;
    verdict = 'TIGHT ✓'; cls = 'good';
  } else {
    state.combo = 0;
    state.misses += 1;
    pts = 10;
    verdict = 'WIDE DRIFT'; cls = 'miss';
  }
  state.score += pts;
  paintScore();
  setGrade(verdict, cls);
  const li = $('chart-' + state.lineIdx);
  if (li) li.classList.add('done');
}

function endSong() {
  state.playing = false;
  cancelAnimationFrame(state.raf);
  els.start.disabled = false;
  els.demo.disabled = false;
  setGrade('ENCORE!', 'perfect');
  showEncore();
}

function tick() {
  if (!state.playing) return;
  const lines = SONGS[state.song].lines;
  const line = lines[state.lineIdx];
  const now = performance.now();
  const el = (now - state.lineT0) / 1000;
  const { freq, voiced } = readPitch();
  state.pitchHz = freq; state.voiced = voiced;

  // score this frame (skip first 0.35s grace)
  if (el > 0.35 && voiced && freq > 0) {
    const c = centsOff(freq, line.freq);
    const a = Math.abs(c);
    state.lineVotes.push(a <= 50 ? 'perfect' : a <= 150 ? 'good' : 'miss');
    if (state.lineVotes.length > 240) state.lineVotes.shift();
  } else if (el > 0.35) {
    state.lineVotes.push('miss');
    if (state.lineVotes.length > 240) state.lineVotes.shift();
  }

  paintLive(freq, voiced, line, el);
  els.prog.style.width = Math.min(100, (el / line.dur) * 100) + '%';

  if (el >= line.dur) {
    finishLine();
    state.lineIdx += 1;
    state.lineVotes = [];
    if (state.lineIdx >= lines.length) { paintLive(freq, voiced, line, el); endSong(); return; }
    showLine(state.lineIdx);
    state.lineT0 = now;
  }
  state.raf = requestAnimationFrame(tick);
}

// Map pitch error -> letter-spacing + variable font + glow (the core toy, always live)
function paintLive(freq, voiced, line, el) {
  const c = centsOff(freq || 0, line.freq);
  const a = c === null ? 600 : Math.min(600, Math.abs(c));
  // spacing: perfect ~ -0.02em, off -> up to 0.55em
  const spacing = c === null ? 0.32 : -0.02 + (a / 600) * 0.57;
  els.kern.textContent = spacing.toFixed(2);

  const chars = els.cur.querySelectorAll('.ch');
  const wob = voiced ? 1 : 2.2;
  chars.forEach((sp, i) => {
    sp.style.letterSpacing = '0px'; // spacing handled on parent for layout stability
    const wave = Math.sin(performance.now() / 280 + i * 0.55);
    const jitter = c === null ? 2 : (a / 600) * 7 * wob;
    sp.style.transform = `translateY(${(wave * (1 + jitter * 0.55)).toFixed(2)}px) rotate(${(wave * jitter * 0.35).toFixed(2)}deg) scale(${(1 + Math.max(0, 0.12 - a / 2500)).toFixed(3)})`;
    const wt = Math.round(900 - Math.min(600, a) * 0.9 - Math.abs(wave) * 40);
    sp.style.fontVariationSettings = `'opsz' 100, 'wght' ${Math.max(300, wt)}`;
    sp.style.color = a <= 50 ? '#eaffea' : a <= 150 ? '#dff6ff' : '#ffd9e8';
    sp.style.textShadow = a <= 50
      ? '0 0 14px rgba(141,255,122,.95),0 0 40px rgba(255,209,102,.55)'
      : a <= 150 ? '0 0 14px rgba(94,242,255,.8)' : '0 0 14px rgba(255,94,168,.55)';
  });
  els.cur.style.letterSpacing = spacing.toFixed(3) + 'em';
  els.cur.style.fontStyle = a > 300 ? 'italic' : 'normal';

  // meters
  els.pitch.textContent = voiced && freq ? Math.round(freq) + ' Hz' : '— Hz';
  const clamped = c === null ? 0 : Math.max(-600, Math.min(600, c));
  els.needle.style.left = `calc(${(50 + (clamped / 600) * 48).toFixed(2)}% - 5px)`;
  els.cents.textContent = c === null ? '±— · silent' : `${c >= 0 ? '+' : ''}${Math.round(c)}¢ · ${a <= 50 ? 'PERFECT' : a <= 150 ? 'tight' : 'wide'}`;
  els.cents.style.color = a <= 50 ? '#8dff7a' : a <= 150 ? '#5ef2ff' : '#ff5ea8';

  // live grade flicker
  if (state.playing && el > 0.35) {
    if (a <= 50) setGrade('● PERFECT', 'perfect');
    else if (a <= 150) setGrade('● TIGHT', 'good');
    else setGrade(c === null ? '○ SING!' : '○ WIDE', 'miss');
  }
}

// idle animation when not playing: gentle kinetic breathing + hum pad still live
function idleLoop() {
  if (!state.playing) {
    const { freq, voiced } = readPitchSafe();
    const line = SONGS[state.song].lines[0];
    if (els.cur.querySelectorAll('.ch').length) paintLive(voiced ? freq : 0, voiced, line, 1);
  }
  requestAnimationFrame(idleLoop);
}
function readPitchSafe() {
  try { return readPitch(); } catch { return { freq: 0, voiced: false }; }
}

// ---------- hum pad ----------
function padSet(clientY) {
  const r = els.pad.getBoundingClientRect();
  const t = Math.max(0, Math.min(1, (clientY - r.top) / r.height)); // top = high pitch
  const f = 600 - t * (600 - 80);
  state.humHz = f;
  els.slider.value = Math.round(f);
  els.pad.style.setProperty('--py', (t * 100).toFixed(1) + '%');
  els.pad.setAttribute('aria-valuenow', Math.round(f));
}
let padDown = false;
els.pad.addEventListener('pointerdown', (e) => { padDown = true; els.pad.setPointerCapture(e.pointerId); els.humMode.checked = true; padSet(e.clientY); });
els.pad.addEventListener('pointermove', (e) => { if (padDown) padSet(e.clientY); });
els.pad.addEventListener('pointerup', () => { padDown = false; });
els.pad.addEventListener('keydown', (e) => {
  const step = e.key === 'ArrowUp' ? 12 : e.key === 'ArrowDown' ? -12 : 0;
  if (step) { e.preventDefault(); state.humHz = Math.max(80, Math.min(600, state.humHz + step)); els.slider.value = state.humHz; }
});
els.slider.addEventListener('input', () => {
  state.humHz = +els.slider.value;
  const t = 1 - (state.humHz - 80) / 520;
  els.pad.style.setProperty('--py', (t * 100).toFixed(1) + '%');
});

// ---------- encore card (canvas only, no images) ----------
function gradeFor(ratio, maxCombo) {
  if (ratio >= 0.85 || maxCombo >= 4) return 'S';
  if (ratio >= 0.6) return 'A';
  if (ratio >= 0.35) return 'B';
  return 'C';
}
function showEncore() {
  const total = SONGS[state.song].lines.length;
  const ratio = (state.perfects + state.goods * 0.5) / total;
  const grade = gradeFor(ratio, state.maxCombo);
  const titles = { S: 'KERN ROYALTY', A: 'HOUSE HEADLINER', B: 'SOLID OPENER', C: 'BRAVE DEBUT' };
  els.encoreTitle.textContent = `${grade} · ${titles[grade]}`;
  els.stats.innerHTML =
    `<span>🏆 ${state.score.toLocaleString()} pts</span>` +
    `<span>🔥 ×${state.maxCombo} combo</span>` +
    `<span>✨ ${state.perfects}/${total} perfect</span>`;
  drawCard(grade);
  els.modal.classList.remove('hidden');
  els.note.textContent = '';
  if (!state.best || state.score > state.best.score) {
    state.best = { score: state.score, song: state.song, grade, when: Date.now() };
    saveBest(state.best);
    renderBest();
    els.note.textContent = 'New house best — saved on this device.';
  }
}

function drawCard(grade) {
  const cv = els.canvas, ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  // bg: deep-space gradient + orbs (all procedural)
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#150a3a'); g.addColorStop(0.5, '#3b1d6e'); g.addColorStop(1, '#7c1d4e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const orb = (x, y, r, c) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  };
  orb(W * 0.15, H * 0.12, 320, 'rgba(123,77,255,.8)');
  orb(W * 0.9, H * 0.3, 380, 'rgba(255,94,168,.7)');
  orb(W * 0.5, H * 0.95, 420, 'rgba(34,211,238,.55)');
  // glass panel
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  roundRect(ctx, 70, 70, W - 140, H - 140, 48); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.stroke();
  // text
  ctx.textAlign = 'center'; ctx.fillStyle = '#5ef2ff';
  ctx.font = '700 34px "Space Grotesk", sans-serif';
  ctx.fillText('★ K E R N I N G   K A R A O K E ★', W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '900 92px Georgia, serif';
  wrapText(ctx, SONGS[state.song].title.toUpperCase(), W / 2, 300, W - 260, 92);
  ctx.fillStyle = '#ffd166';
  ctx.font = '900 300px Georgia, serif';
  ctx.shadowColor = 'rgba(255,209,102,.8)'; ctx.shadowBlur = 60;
  ctx.fillText(grade, W / 2, 640);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '700 56px "Space Grotesk", sans-serif';
  ctx.fillText(`${state.score.toLocaleString()} PTS`, W / 2, 760);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '500 40px "Space Grotesk", sans-serif';
  ctx.fillText(`max combo ×${state.maxCombo}   ·   ${state.perfects}/${SONGS[state.song].lines.length} perfect kerns`, W / 2, 830);
  // lyric quote with kerned spacing = score pride
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = 'italic 700 44px Georgia, serif';
  wrapText(ctx, `“${SONGS[state.song].lines[SONGS[state.song].lines.length - 1].text}”`, W / 2, 930, W - 280, 52);
  // fake letter-spacing ribbon
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  roundRect(ctx, 130, 1080, W - 260, 120, 24); ctx.fill();
  ctx.fillStyle = '#8dff7a'; ctx.font = '700 38px "Space Grotesk", sans-serif';
  const d = new Date(state.best?.when || Date.now());
  ctx.fillText(`ENCORE · ${SONGS[state.song].title} · ${d.toLocaleDateString()}`, W / 2, 1155);
  // confetti: pure rects
  const colors = ['#ffd166', '#5ef2ff', '#ff5ea8', '#8dff7a', '#ffffff'];
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.fillRect(70 + Math.random() * (W - 140), 70 + Math.random() * (H - 140), 8 + Math.random() * 10, 5 + Math.random() * 7);
  }
  ctx.globalAlpha = 1;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  });
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

function captionText() {
  const s = SONGS[state.song];
  const grade = els.encoreTitle.textContent.split(' ')[0];
  return `🎤 KERNING KARAOKE — I scored ${state.score.toLocaleString()} pts on “${s.title}” (grade ${grade}, max combo ×${state.maxCombo}, ${state.perfects}/${s.lines.length} perfect kerns). Think you can kern tighter?`;
}
$('dlBtn').onclick = () => {
  const a = document.createElement('a');
  a.download = `kerning-karaoke-encore-${Date.now()}.png`;
  a.href = els.canvas.toDataURL('image/png');
  a.click();
  els.note.textContent = 'Card downloaded — post it anywhere.';
};
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(captionText()); els.note.textContent = 'Caption copied — paste it with your card.'; }
  catch { prompt('Copy your encore caption:', captionText()); }
};
$('shareBtn').onclick = async () => {
  const data = { title: 'Kerning Karaoke encore', text: captionText() };
  if (navigator.share) { try { await navigator.share(data); } catch { /* dismissed */ } }
  else if (navigator.clipboard) { await navigator.clipboard.writeText(captionText()); els.note.textContent = 'No share sheet here — caption copied instead.'; }
  else prompt('Share your encore:', captionText());
};
$('closeBtn').onclick = () => els.modal.classList.add('hidden');
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.classList.add('hidden'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') els.modal.classList.add('hidden'); });

// ---------- wire up ----------
els.mic.onclick = enableMic;
els.start.onclick = startSong;
els.demo.onclick = startDemo;
document.querySelectorAll('#songChips .chip');

renderChips();
selectSong(0);
renderBest();
padSet(400);
requestAnimationFrame(idleLoop);

console.log('kerning-karaoke ready');
