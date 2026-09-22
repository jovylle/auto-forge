/* Glass Arp Playground — 16-tile tap arpeggiator, WebAudio only, no assets. */
'use strict';

var LS_KEY = 'glass-arp-v1';

/* ---------- scales (semitone offsets from root, with kanji) ---------- */
var SCALES = [
  { id: 'yo',       name: 'Yo Pentatonic',      kanji: '陽', iv: [0, 2, 4, 7, 9] },
  { id: 'in',       name: 'In / Miyako-bushi',  kanji: '陰', iv: [0, 1, 5, 7, 8] },
  { id: 'hirajoshi',name: 'Hirajoshi',          kanji: '平調', iv: [0, 2, 3, 7, 8] },
  { id: 'iwato',    name: 'Iwato',              kanji: '岩戸', iv: [0, 1, 5, 6, 10] },
  { id: 'kumoi',    name: 'Kumoi',              kanji: '雲井', iv: [0, 2, 3, 7, 9] },
  { id: 'minor',    name: 'Minor Pentatonic',   kanji: '羽', iv: [0, 3, 5, 7, 10] }
];
var ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
var DEG_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '空', '月', '雪'];
var KEYS = '12345678qwertyui'.split('');
var N = 16;

function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m) {
  var names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}
function load() {
  try {
    var s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (s && Array.isArray(s.pattern)) return s;
  } catch (e) {}
  return null;
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      pattern: state.pattern, tempo: state.tempo, fb: state.fb,
      scaleId: state.scale.id, root: state.root
    }));
  } catch (e) {}
}

var saved = load() || {};
var state = {
  pattern: saved.pattern && saved.pattern.length === N ? saved.pattern.map(Boolean)
    : [true, false, false, true, false, false, true, false, false, false, true, false, false, true, false, false],
  tempo: saved.tempo || 112,
  fb: (saved.fb != null ? saved.fb : 0.38),
  scale: SCALES.filter(function (s) { return s.id === saved.scaleId; })[0] || SCALES[0],
  root: (saved.root != null ? saved.root : 0),
  playing: false,
  step: 0
};

/* ---------- dom ---------- */
function $(id) { return document.getElementById(id); }
var board = $('board'), btnPlay = $('btnPlay'), playGlyph = $('playGlyph'),
    playLabel = $('playLabel'), btnClear = $('btnClear'), btnDemo = $('btnDemo'),
    btnScale = $('btnScale'), tempoEl = $('tempo'), fbEl = $('feedback'),
    tempoVal = $('tempoVal'), fbVal = $('fbVal'), scaleKanji = $('scaleKanji'),
    scaleName = $('scaleName'), scaleNotes = $('scaleNotes'),
    activeCount = $('activeCount'), stepReadout = $('stepReadout'),
    btnRec = $('btnRec'), recBar = $('recBar'), recStatus = $('recStatus'),
    takeWrap = $('takeWrap'), take = $('take'), takeDl = $('takeDl');

function tileMidi(i) {
  var iv = state.scale.iv;
  return 60 + state.root + iv[i % 5] + 12 * Math.floor(i / 5);
}

function renderScale() {
  scaleKanji.textContent = state.scale.kanji;
  scaleName.textContent = ROOTS[state.root] + ' · ' + state.scale.name;
  var names = [];
  for (var o = 0; o < 2; o++)
    for (var d = 0; d < 5; d++)
      names.push(ROOTS[(state.root + state.scale.iv[d]) % 12]);
  scaleNotes.textContent = names.slice(0, 5).join(' · ') + ' …';
}

function buildBoard() {
  board.innerHTML = '';
  for (var i = 0; i < N; i++) {
    (function (i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile' + (state.pattern[i] ? ' on' : '');
      b.setAttribute('aria-pressed', state.pattern[i] ? 'true' : 'false');
      b.setAttribute('aria-label', 'tile ' + (i + 1) + ' ' + midiName(tileMidi(i)));
      b.innerHTML = '<span class="key">' + KEYS[i].toUpperCase() + '</span>' +
        '<span class="deg">' + DEG_KANJI[i] + '</span>' +
        '<span class="note">' + midiName(tileMidi(i)) + '</span>';
      b.addEventListener('pointerdown', function (ev) { tapTile(i, b, ev); });
      board.appendChild(b);
    })(i);
  }
  updateCount();
}
function refreshNotes() {
  var kids = board.children;
  for (var i = 0; i < N; i++) {
    kids[i].querySelector('.note').textContent = midiName(tileMidi(i));
    kids[i].setAttribute('aria-label', 'tile ' + (i + 1) + ' ' + midiName(tileMidi(i)));
  }
}
function updateCount() {
  var n = state.pattern.filter(Boolean).length;
  activeCount.textContent = n;
}
function ripple(el, ev) {
  var r = document.createElement('span');
  r.className = 'ripple';
  var box = el.getBoundingClientRect();
  var x = (ev && ev.clientX != null ? ev.clientX - box.left : box.width / 2);
  var y = (ev && ev.clientY != null ? ev.clientY - box.top : box.height / 2);
  r.style.left = x + 'px'; r.style.top = y + 'px';
  el.appendChild(r);
  setTimeout(function () { r.remove(); }, 600);
}
function tapTile(i, el, ev) {
  ensureAudio();
  state.pattern[i] = !state.pattern[i];
  el = el || board.children[i];
  el.classList.toggle('on', state.pattern[i]);
  el.setAttribute('aria-pressed', state.pattern[i] ? 'true' : 'false');
  ripple(el, ev);
  if (state.pattern[i]) pluck(tileMidi(i), ctx.currentTime, 0.9); // audition on light
  updateCount(); save();
}

/* ---------- audio ---------- */
var ctx = null, master, delaySend, delayNode, fbGain, dampen, comp, recDest;
function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  var AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8;
  comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  // shimmering dotted-eighth-ish delay trail
  delaySend = ctx.createGain(); delaySend.gain.value = 1;
  delayNode = ctx.createDelay(2.0);
  fbGain = ctx.createGain(); fbGain.gain.value = state.fb;
  dampen = ctx.createBiquadFilter(); dampen.type = 'lowpass'; dampen.frequency.value = 3200;
  var wet = ctx.createGain(); wet.gain.value = 0.5;
  master.connect(delaySend); delaySend.connect(delayNode);
  delayNode.connect(dampen); dampen.connect(fbGain); fbGain.connect(delayNode);
  dampen.connect(wet); wet.connect(master);
  syncDelayTime();
  // record tap
  recDest = ctx.createMediaStreamDestination();
  master.connect(recDest);
}
function syncDelayTime() {
  if (!ctx) return;
  var beat = 60 / state.tempo;
  delayNode.delayTime.setTargetAtTime(Math.min(1.5, beat * 0.75), ctx.currentTime, 0.05);
}
function pluck(midi, t, vel) {
  if (!ctx) return;
  var f = midiHz(midi);
  var g = ctx.createGain();
  var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sine'; o1.frequency.value = f;
  o2.type = 'triangle'; o2.frequency.value = f * 2; // glassy octave shimmer
  var g2 = ctx.createGain(); g2.gain.value = 0.18;
  var peak = 0.5 * (vel || 1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
  o1.start(t); o2.start(t);
  o1.stop(t + 1.5); o2.stop(t + 1.5);
}

/* ---------- sequencer (lookahead scheduler) ---------- */
var timer = null, nextT = 0;
function stepDur() { return 60 / state.tempo / 2; } // eighth notes
function scheduler() {
  while (nextT < ctx.currentTime + 0.12) {
    (function (s, t) {
      setTimeout(function () { paintStep(s); }, Math.max(0, (t - ctx.currentTime) * 1000));
    })(state.step, nextT);
    if (state.pattern[state.step]) pluck(tileMidi(state.step), nextT, 1);
    nextT += stepDur();
    state.step = (state.step + 1) % N;
  }
}
function paintStep(s) {
  var kids = board.children;
  for (var i = 0; i < N; i++) kids[i].classList.remove('now');
  if (kids[s]) kids[s].classList.add('now');
  stepReadout.textContent = 'step ' + (s + 1) + ' / 16';
}
function setPlaying(p) {
  ensureAudio();
  state.playing = p;
  btnPlay.classList.toggle('playing', p);
  btnPlay.setAttribute('aria-pressed', p ? 'true' : 'false');
  playGlyph.textContent = p ? '❚❚' : '▶';
  playLabel.textContent = p ? 'stop 止' : 'play 演奏';
  if (p) {
    state.step = 0; nextT = ctx.currentTime + 0.06;
    timer = setInterval(scheduler, 25);
  } else {
    clearInterval(timer); timer = null;
    var kids = board.children;
    for (var i = 0; i < N; i++) kids[i].classList.remove('now');
    stepReadout.textContent = 'step –';
  }
}

/* ---------- controls ---------- */
function paintFill(el) {
  var pc = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.setProperty('--fill', pc + '%');
}
function bindControls() {
  tempoEl.value = state.tempo; fbEl.value = Math.round(state.fb * 100);
  tempoVal.textContent = state.tempo + ' bpm';
  fbVal.textContent = Math.round(state.fb * 100) + '%';
  paintFill(tempoEl); paintFill(fbEl);

  tempoEl.addEventListener('input', function () {
    state.tempo = +tempoEl.value;
    tempoVal.textContent = state.tempo + ' bpm';
    paintFill(tempoEl); syncDelayTime(); save();
  });
  fbEl.addEventListener('input', function () {
    state.fb = (+fbEl.value) / 100;
    fbVal.textContent = fbEl.value + '%';
    paintFill(fbEl);
    if (ctx) fbGain.gain.setTargetAtTime(state.fb, ctx.currentTime, 0.03);
    save();
  });

  btnPlay.addEventListener('click', function () { setPlaying(!state.playing); });
  btnClear.addEventListener('click', function () {
    state.pattern = state.pattern.map(function () { return false; });
    buildBoard(); save();
  });
  btnDemo.addEventListener('click', function () {
    state.pattern = [true,false,true,false, true,false,false,true, false,true,false,false, true,false,true,false];
    buildBoard(); save();
    if (!state.playing) setPlaying(true);
  });
  btnScale.addEventListener('click', randomizeScale);
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    var i = KEYS.indexOf(k);
    if (i >= 0) { tapTile(i, board.children[i], null); e.preventDefault(); return; }
    if (k === ' ') { setPlaying(!state.playing); e.preventDefault(); }
  });
}
function randomizeScale() {
  ensureAudio();
  state.scale = SCALES[Math.floor(Math.random() * SCALES.length)];
  state.root = Math.floor(Math.random() * 12);
  renderScale(); refreshNotes(); save();
  // sparkle: audition the new scale ascending
  if (!ctx) return;
  var t = ctx.currentTime + 0.02;
  for (var d = 0; d < 8; d++) {
    pluck(60 + state.root + state.scale.iv[d % 5] + 12 * Math.floor(d / 5), t + d * 0.09, 0.7);
  }
}

/* ---------- 8s loop export ---------- */
var rec = null, chunks = [], recTimer = null, recStart = 0;
function bindRecord() {
  btnRec.addEventListener('click', function () {
    if (rec) return; // already recording
    ensureAudio();
    chunks = [];
    var mime = 'audio/webm';
    try { rec = new MediaRecorder(recDest.stream, { mimeType: mime }); }
    catch (e) { try { rec = new MediaRecorder(recDest.stream); } catch (e2) { recStatus.textContent = 'recording not supported here'; return; } }
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      clearInterval(recTimer); rec = null;
      recBar.style.width = '0%';
      recStatus.classList.remove('hot'); recStatus.textContent = 'ready';
      btnRec.disabled = false; btnRec.textContent = '● record 8s';
      var type = (chunks[0] && chunks[0].type) || 'audio/webm';
      var blob = new Blob(chunks, { type: type });
      var url = URL.createObjectURL(blob);
      take.src = url; takeWrap.hidden = false;
      var ext = type.indexOf('ogg') >= 0 ? 'ogg' : 'webm';
      takeDl.href = url; takeDl.download = 'glass-arp-loop.' + ext;
    };
    if (!state.playing) setPlaying(true);
    rec.start();
    recStart = Date.now();
    btnRec.disabled = true; btnRec.textContent = '● recording…';
    recStatus.classList.add('hot');
    recTimer = setInterval(function () {
      var el = Date.now() - recStart, total = 8000;
      recBar.style.width = Math.min(100, el / total * 100) + '%';
      recStatus.textContent = (el / 1000).toFixed(1) + 's / 8.0s';
      if (el >= total && rec) rec.stop();
    }, 100);
  });
}

/* ---------- ink-wash canvas ---------- */
function wash() {
  var c = $('wash'), x = c.getContext('2d'), W, H, petals = [];
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() {
    W = c.width = Math.floor(innerWidth * (devicePixelRatio || 1));
    H = c.height = Math.floor(innerHeight * (devicePixelRatio || 1));
  }
  size(); addEventListener('resize', size);
  function mk(top) {
    return { x: Math.random() * W, y: top ? -20 : Math.random() * H,
      r: (2 + Math.random() * 5) * (devicePixelRatio || 1),
      vy: (0.15 + Math.random() * 0.4) * (devicePixelRatio || 1),
      vx: (Math.random() - 0.5) * 0.3, a: 0.05 + Math.random() * 0.10,
      pink: Math.random() < 0.35 };
  }
  for (var i = 0; i < 40; i++) petals.push(mk(false));
  var g = x.createLinearGradient(0, 0, 0, H);
  function frame() {
    x.clearRect(0, 0, W, H);
    var bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f7f2e6'); bg.addColorStop(0.6, '#f5f0e4'); bg.addColorStop(1, '#ece2cb');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    var i, p;
    for (i = 0; i < petals.length; i++) {
      p = petals[i];
      x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7);
      x.fillStyle = p.pink ? 'rgba(199,62,46,' + p.a + ')' : 'rgba(95,113,97,' + p.a + ')';
      x.fill();
      if (!reduced) {
        p.y += p.vy; p.x += p.vx + Math.sin((p.y + i * 40) / 160) * 0.3;
        if (p.y > H + 20) petals[i] = mk(true);
      }
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  frame();
  void g;
}

/* ---------- init ---------- */
buildBoard(); renderScale(); bindControls(); bindRecord(); wash();
