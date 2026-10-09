/* Meridian Ghost Loops — clockwork 8s loop engine (WebAudio + canvas, no assets) */
'use strict';

var LOOP_MS = 8000;        // 8-second time loops
var QUANT_MS = 125;        // tick grid: 64 slots per loop
var TICK_MS = 500;         // escapement tick, 120 bpm -> 16 ticks per loop
var MAX_LOOPS = 6;         // spiral turns
var DECAY_BASE = 0.8;      // echo strength per passing hour
var LS_KEY = 'mgl-v1';

// Pentatonic chimes (music-box register)
var NOTES = [
  { n: 'C5', f: 523.25, k: 'A' },
  { n: 'D5', f: 587.33, k: 'S' },
  { n: 'E5', f: 659.25, k: 'D' },
  { n: 'G5', f: 783.99, k: 'F' },
  { n: 'A5', f: 880.00, k: 'G' }
];

function $(id) { return document.getElementById(id); }
function uid() { return 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

var state = {
  loops: [],        // {id,name,events:[{t,note,vel}],createdAt,muted}
  vault: [],        // {d,count,names}
  playing: false,
  songStartPerf: 0, // performance.now() of loop-zero downbeat
  horizonPerf: 0,   // scheduler horizon (perf clock ms)
  iterCount: 0,
  rec: null,        // {startPerf, events}
  lastDay: dayStr(new Date()),
  shared: false
};

var ctx = null, master = null, schedTimer = null;
var els = {};
var toastTimer = null;

function dayStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

/* ---------- persistence ---------- */
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ loops: state.loops, vault: state.vault }));
  } catch (e) { /* private mode: engine still runs, memory only */ }
}
function load() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    if (d && Array.isArray(d.loops)) state.loops = d.loops.slice(0, MAX_LOOPS);
    if (d && Array.isArray(d.vault)) state.vault = d.vault.slice(0, 30);
  } catch (e) { /* corrupt: start empty */ }
}

/* ---------- decay: echoes fade with each passing hour ---------- */
function fullHours(loop) {
  return Math.max(0, Math.floor((Date.now() - loop.createdAt) / 3600000));
}
function echoFactor(loop) {
  return Math.max(0.05, Math.pow(DECAY_BASE, fullHours(loop)));
}

/* ---------- audio ---------- */
function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { toast('This engine needs WebAudio — try a modern browser.'); return false; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  return true;
}

function playTick(when, accent) {
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1900 : 1250;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.09, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  o.connect(g); g.connect(master);
  o.start(when); o.stop(when + 0.06);
}

function playChime(freq, when, vel) {
  vel = clamp(vel == null ? 1 : vel, 0.05, 1);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.5 * vel + 0.02, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
  var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'triangle'; o1.frequency.value = freq;
  o2.type = 'sine'; o2.frequency.value = freq * 2;
  var g2 = ctx.createGain(); g2.gain.value = 0.25;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
  o1.start(when); o2.start(when);
  o1.stop(when + 1.5); o2.stop(when + 1.5);
}

/* Schedule one 8s iteration starting at perf-time iterPerf (ms). */
function scheduleIteration(iterPerf) {
  var nowPerf = performance.now();
  var baseCtx = ctx.currentTime + Math.max(0, (iterPerf - nowPerf) / 1000);
  var tickOn = els.tick.checked;
  for (var i = 0; i < LOOP_MS / TICK_MS; i++) {
    if (tickOn) playTick(baseCtx + (i * TICK_MS) / 1000, i % 4 === 0);
  }
  state.loops.forEach(function (loop) {
    if (loop.muted) return;
    var f = echoFactor(loop);
    loop.events.forEach(function (ev) {
      var note = NOTES[ev.note];
      if (!note) return;
      playChime(note.f, baseCtx + ev.t / 1000, ev.vel * f);
    });
  });
}

function schedulerTick() {
  if (!state.playing || !ctx) return;
  var nowPerf = performance.now();
  while (state.horizonPerf < nowPerf + 1000) {
    scheduleIteration(state.horizonPerf);
    state.horizonPerf += LOOP_MS;
    state.iterCount++;
  }
}

/* Start playback snapped to the next tick (tick-synced). */
function startWorks() {
  if (!ensureAudio()) return;
  if (state.playing) return;
  var nowPerf = performance.now();
  var grid = Math.ceil(nowPerf / TICK_MS) * TICK_MS;
  state.songStartPerf = grid;
  state.horizonPerf = grid;
  state.iterCount = 0;
  state.playing = true;
  setStatus('Syncing to the escapement…');
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = setInterval(schedulerTick, 200);
  schedulerTick();
  els.play.textContent = '⏸ Halt works';
  setTimeout(function () {
    if (state.playing && !state.rec) setStatus('Playing — ' + state.loops.length + ' echo' + (state.loops.length === 1 ? '' : 'es') + ' turning.');
  }, Math.max(60, grid - performance.now() + 30));
}

function stopWorks(cancelRec) {
  state.playing = false;
  if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  els.play.textContent = '▶ Start works';
  if (state.rec && cancelRec !== false) {
    state.rec = null;
    els.rec.classList.remove('armed');
    els.rec.textContent = '● Record 8s loop';
  }
  setStatus(state.loops.length ? 'Silent. The gears rest.' : 'Silent. Press play, then record an 8-second loop.');
}

/* ---------- recording 8-second time loops ---------- */
function startRecording() {
  if (!ensureAudio()) return;
  if (state.rec) return;
  if (state.loops.length >= MAX_LOOPS) {
    toast('The spiral is full (6 turns). Erase a loop or perform the midnight ritual.');
    return;
  }
  if (!state.playing) startWorks();
  // begin capture on the next loop downbeat: tick-synced
  var nowPerf = performance.now();
  var startPerf = state.songStartPerf + Math.ceil((nowPerf - state.songStartPerf) / LOOP_MS) * LOOP_MS;
  state.rec = { startPerf: startPerf, events: [] };
  els.rec.classList.add('armed');
  els.rec.textContent = '● Inscribing…';
  var wait = Math.max(0, startPerf - performance.now());
  setStatus(wait > 60 ? 'Needle poised — capture starts on the next downbeat…' : 'Inscribe! Strike the chime keys.');
}

function finishRecording() {
  var rec = state.rec;
  state.rec = null;
  els.rec.classList.remove('armed');
  els.rec.textContent = '● Record 8s loop';
  if (!rec) return;
  if (!rec.events.length) {
    setStatus('Empty loop dissolved — no notes were struck.');
    toast('Empty loop dissolved. Strike keys while the needle turns.');
    return;
  }
  rec.events.sort(function (a, b) { return a.t - b.t; });
  var n = state.loops.length + 1;
  state.loops.push({
    id: uid(),
    name: 'Loop No. ' + n,
    events: rec.events,
    createdAt: Date.now(),
    muted: false
  });
  save(); renderLoops();
  setStatus('Loop No. ' + n + ' sealed with ' + rec.events.length + ' notes. It now decays hourly.');
  toast('Loop No. ' + n + ' sealed into the spiral.');
}

function strike(idx, vel) {
  if (idx < 0 || idx >= NOTES.length) return;
  var nowPerf = performance.now();
  if (state.rec && nowPerf >= state.rec.startPerf) {
    var t = nowPerf - state.rec.startPerf;
    if (t <= LOOP_MS) {
      var q = clamp(Math.round(t / QUANT_MS) * QUANT_MS, 0, LOOP_MS - QUANT_MS);
      var last = state.rec.events[state.rec.events.length - 1];
      if (!(last && last.t === q && last.note === idx)) {
        state.rec.events.push({ t: q, note: idx, vel: vel || 1 });
      }
    }
  }
  // always audible (audition + capture share the same hammer)
  if (ensureAudio()) playChime(NOTES[idx].f, ctx.currentTime, (vel || 1));
  var pad = els.pads.children[idx];
  if (pad) {
    pad.classList.add('struck');
    setTimeout(function () { pad.classList.remove('struck'); }, 120);
  }
}

/* ---------- loop stack UI ---------- */
function renderLoops() {
  var list = els.list;
  list.innerHTML = '';
  if (!state.loops.length) {
    var p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No echoes turning. Record your first 8-second loop.';
    list.appendChild(p);
    return;
  }
  state.loops.forEach(function (loop) {
    var f = echoFactor(loop);
    var li = document.createElement('li');
    li.className = 'loopitem' + (loop.muted ? ' muted' : '');
    var head = document.createElement('div');
    head.className = 'loophead';
    var nm = document.createElement('span');
    nm.className = 'loopname';
    nm.textContent = (loop.muted ? '◌ ' : '◉ ') + loop.name + ' · ' + loop.events.length + ' notes';
    var age = document.createElement('span');
    age.className = 'loopage';
    var h = fullHours(loop);
    age.textContent = h === 0 ? 'freshly wound' : h + 'h old';
    head.appendChild(nm); head.appendChild(age);
    var bar = document.createElement('div');
    bar.className = 'echobar';
    var fill = document.createElement('i');
    fill.style.width = Math.round(f * 100) + '%';
    bar.appendChild(fill);
    var row = document.createElement('div');
    row.className = 'echorow';
    var es = document.createElement('span');
    es.textContent = 'echo ' + Math.round(f * 100) + '%';
    var ev = document.createElement('span');
    ev.textContent = loop.muted ? 'muffled' : 'sounding';
    row.appendChild(es); row.appendChild(ev);
    var btns = document.createElement('div');
    btns.className = 'loopbtns';
    var bMute = document.createElement('button');
    bMute.className = 'chip'; bMute.type = 'button';
    bMute.textContent = loop.muted ? 'Unmuffle' : 'Muffle';
    bMute.onclick = function () { loop.muted = !loop.muted; save(); renderLoops(); };
    var bPol = document.createElement('button');
    bPol.className = 'chip'; bPol.type = 'button';
    bPol.textContent = '✦ Polish brass';
    bPol.title = 'Rewind this loop\'s decay (restores echo to 100%)';
    bPol.onclick = function () { loop.createdAt = Date.now(); save(); renderLoops(); toast(loop.name + ' polished — echo restored.'); };
    var bDel = document.createElement('button');
    bDel.className = 'chip warn'; bDel.type = 'button';
    bDel.textContent = '✕ Dissolve';
    bDel.onclick = function () {
      state.loops = state.loops.filter(function (l) { return l.id !== loop.id; });
      save(); renderLoops();
      if (!state.loops.length && !state.playing) setStatus('Silent. Press play, then record an 8-second loop.');
    };
    btns.appendChild(bMute); btns.appendChild(bPol); btns.appendChild(bDel);
    li.appendChild(head); li.appendChild(bar); li.appendChild(row); li.appendChild(btns);
    list.appendChild(li);
  });
}

function renderVault() {
  var list = els.vault;
  list.innerHTML = '';
  var total = 0;
  state.vault.forEach(function (v) { total += v.count; });
  els.ghosts.textContent = String(total);
  if (!state.vault.length) {
    var p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No midnights sealed yet. Ghosts gather here after each reset.';
    list.appendChild(p);
    return;
  }
  state.vault.forEach(function (v) {
    var li = document.createElement('li');
    var b = document.createElement('b');
    b.textContent = 'Night of ' + v.d + ' — ';
    li.appendChild(b);
    li.appendChild(document.createTextNode(v.count + ' ghost' + (v.count === 1 ? '' : 's') + ' sealed' + (v.names ? ' (' + v.names + ')' : '')));
    list.appendChild(li);
  });
}

/* ---------- share tick-synced mixes ---------- */
function encodeMix() {
  var data = {
    v: 1,
    loops: state.loops.map(function (l) {
      return { n: l.name, e: l.events.map(function (ev) { return [ev.t, ev.note, ev.vel]; }) };
    })
  };
  var json = JSON.stringify(data);
  var b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeMix(s) {
  var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  var json = decodeURIComponent(escape(atob(b64)));
  var d = JSON.parse(json);
  if (!d || !Array.isArray(d.loops)) throw new Error('bad mix');
  return d.loops.slice(0, MAX_LOOPS).map(function (l, i) {
    return {
      id: uid(),
      name: String(l.n || 'Shared No. ' + (i + 1)).slice(0, 40),
      events: (Array.isArray(l.e) ? l.e : []).filter(function (e) {
        return Array.isArray(e) && e[0] >= 0 && e[0] < LOOP_MS && NOTES[e[1]];
      }).map(function (e) { return { t: e[0], note: e[1], vel: clamp(+e[2] || 1, 0.1, 1) }; }),
      createdAt: Date.now(),
      muted: false
    };
  }).filter(function (l) { return l.events.length; });
}
function shareURL() {
  return location.href.split('#')[0] + '#m=' + encodeMix();
}
function copyLink() {
  if (!state.loops.length) { toast('Nothing to share yet — record a loop first.'); return; }
  var url = shareURL();
  function done() {
    els.shareNote.textContent = 'Link copied — it carries ' + state.loops.length + ' loop(s), synced to the downbeat.';
    toast('Tick-synced link copied. The mix starts on the downbeat.');
    state.shared = true;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
  } else { fallbackCopy(url); done(); }
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard unavailable */ }
  document.body.removeChild(ta);
}
function importFromHash() {
  if (!location.hash || location.hash.indexOf('#m=') !== 0) return;
  try {
    var loops = decodeMix(location.hash.slice(3));
    if (!loops.length) throw new Error('empty');
    var room = MAX_LOOPS - state.loops.length;
    if (room <= 0) { toast('Spiral full — shared mix could not dock. Dissolve a loop first.'); return; }
    var added = loops.slice(0, room);
    added.forEach(function (l) { state.loops.push(l); });
    save(); renderLoops();
    els.shareNote.textContent = 'Shared mix docked: ' + added.length + ' loop(s), synced to the downbeat.';
    toast('Shared mix loaded — press play; it snaps to the next downbeat.');
    setStatus('Shared mix turning on the spiral — press play to sound it, synced to the tick.');
  } catch (e) {
    toast('That share scroll is illegible — the mix could not be read.');
  }
}

/* ---------- midnight reset ritual ---------- */
var ritualTimers = [];
function openRitual(auto) {
  var r = els.ritual;
  r.classList.add('open');
  r.setAttribute('aria-hidden', 'false');
  els.ritualTitle.textContent = auto ? 'The bells toll twelve.' : 'You turn the midnight key.';
  var lines = [
    'Loosening the mainspring…',
    'Echoes fade into the vault…',
    'The works are silent. A new day begins.'
  ];
  els.ritualText.textContent = lines[0];
  ritualTimers.forEach(clearTimeout);
  ritualTimers = [];
  ritualTimers.push(setTimeout(function () { els.ritualText.textContent = lines[1]; }, 1100));
  ritualTimers.push(setTimeout(function () {
    els.ritualText.textContent = lines[2];
    sealMidnight();
  }, 2200));
  ritualTimers.push(setTimeout(closeRitual, 3800));
}
function closeRitual() {
  els.ritual.classList.remove('open');
  els.ritual.setAttribute('aria-hidden', 'true');
}
function sealMidnight() {
  var d = new Date();
  if (state.loops.length) {
    state.vault.unshift({
      d: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: state.loops.length,
      names: state.loops.map(function (l) { return l.name; }).join(', ').slice(0, 80)
    });
    state.vault = state.vault.slice(0, 30);
    state.loops = [];
  }
  state.lastDay = dayStr(d);
  save(); renderLoops(); renderVault();
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
  if (!state.playing) setStatus('Silent. A new day — record the first loop.');
  else setStatus('Playing on an empty spiral — the ghosts are sealed.');
}
function msToMidnight() {
  var n = new Date();
  var mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0);
  return mid - n;
}
function fmtDur(ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  function p(x) { return (x < 10 ? '0' : '') + x; }
  return p(h) + ':' + p(m) + ':' + p(ss);
}

/* ---------- spiral timeline (canvas, no images) ---------- */
var spiral = null, sctx = null;
function sizeCanvas() {
  var w = Math.min(els.canvasWrap.clientWidth || 480, 480);
  var dpr = window.devicePixelRatio || 1;
  spiral.width = w * dpr; spiral.height = w * dpr;
  spiral.style.aspectRatio = '1';
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawGear(g, x, y, r, teeth, ang, col, spokes) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.strokeStyle = col; g.lineWidth = Math.max(1.5, r * 0.05);
  for (var i = 0; i < teeth; i++) {
    var a = (i / teeth) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96);
    g.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
    g.stroke();
  }
  g.beginPath(); g.arc(0, 0, r * 0.94, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.28, 0, Math.PI * 2); g.stroke();
  if (spokes !== false) {
    for (var s = 0; s < 4; s++) {
      var b = (s / 4) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(b) * r * 0.28, Math.sin(b) * r * 0.28);
      g.lineTo(Math.cos(b) * r * 0.9, Math.sin(b) * r * 0.9);
      g.stroke();
    }
  }
  g.restore();
}
function spiralPoint(cx, cy, turns, R0, R1, phase) {
  var th = phase * turns * Math.PI * 2;
  var r = R0 + (R1 - R0) * phase;
  return { x: cx + r * Math.cos(th - Math.PI / 2), y: cy + r * Math.sin(th - Math.PI / 2), th: th, r: r };
}
function draw(now) {
  var w = spiral.clientWidth || 480;
  var cx = w / 2, cy = w / 2;
  var R = w / 2 - 14;
  var g = sctx;
  g.clearRect(0, 0, w, w);

  // backdrop glow
  var bg = g.createRadialGradient(cx, cy, 4, cx, cy, R + 10);
  bg.addColorStop(0, 'rgba(210,162,76,0.10)');
  bg.addColorStop(0.7, 'rgba(168,91,42,0.05)');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, w);

  // slow outer gear ring + corner gears
  var t = now / 1000;
  drawGear(g, cx, cy, R - 10, 48, t * 0.05, 'rgba(210,162,76,0.5)', false);
  drawGear(g, 34, 34, 20, 10, -t * 0.3, 'rgba(168,91,42,0.7)');
  drawGear(g, w - 34, w - 30, 15, 9, t * 0.4, 'rgba(210,162,76,0.55)');

  var turns = MAX_LOOPS;
  var R0 = 26, R1 = R - 26;

  // base spiral (faint brass)
  g.strokeStyle = 'rgba(210,162,76,0.28)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (var s = 0; s <= 220; s++) {
    var p0 = spiralPoint(cx, cy, turns, R0, R1, s / 220);
    if (s === 0) g.moveTo(p0.x, p0.y); else g.lineTo(p0.x, p0.y);
  }
  g.stroke();

  // playhead phase (idle drift when halted)
  var phase;
  if (state.playing) {
    phase = ((performance.now() - state.songStartPerf) / LOOP_MS) % 1;
    if (phase < 0) phase += 1;
  } else {
    phase = (t * 0.03) % 1;
  }

  // per-loop turns with decay alpha
  state.loops.forEach(function (loop, li) {
    var f = echoFactor(loop);
    var a0 = li / turns, a1 = (li + 1) / turns;
    g.strokeStyle = loop.muted
      ? 'rgba(234,217,172,0.18)'
      : 'rgba(210,162,76,' + (0.25 + 0.65 * f).toFixed(3) + ')';
    g.lineWidth = 5;
    g.beginPath();
    for (var s2 = 0; s2 <= 60; s2++) {
      var pp = spiralPoint(cx, cy, turns, R0, R1, a0 + (a1 - a0) * (s2 / 60));
      if (s2 === 0) g.moveTo(pp.x, pp.y); else g.lineTo(pp.x, pp.y);
    }
    g.stroke();
    // note dots
    loop.events.forEach(function (ev) {
      var ep = spiralPoint(cx, cy, turns, R0, R1, a0 + (ev.t / LOOP_MS) * (a1 - a0));
      g.save();
      g.globalAlpha = loop.muted ? 0.25 : (0.3 + 0.7 * f);
      g.fillStyle = '#ead9ac';
      g.shadowColor = '#d2a24c'; g.shadowBlur = 8;
      g.beginPath(); g.arc(ep.x, ep.y, 3.4, 0, Math.PI * 2); g.fill();
      g.restore();
    });
    // playhead dot on this turn
    var hp = spiralPoint(cx, cy, turns, R0, R1, a0 + phase * (a1 - a0));
    g.save();
    g.fillStyle = state.playing ? '#fffdf4' : 'rgba(255,253,244,0.4)';
    g.shadowColor = '#d2a24c'; g.shadowBlur = state.playing ? 12 : 0;
    g.beginPath(); g.arc(hp.x, hp.y, 4.2, 0, Math.PI * 2); g.fill();
    g.restore();
  });

  // clock hand + hub
  var ha = phase * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = state.playing ? 'rgba(255,253,244,0.85)' : 'rgba(234,217,172,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(ha) * (R1 + 4), cy + Math.sin(ha) * (R1 + 4));
  g.stroke();
  g.fillStyle = '#a85b2a';
  g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d2a24c';
  g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();

  // tick pips (16 per loop) + record progress
  var tickIdx = Math.floor(phase * 16) % 16;
  if (tickIdx !== draw._lastTick) {
    draw._lastTick = tickIdx;
    var kids = els.ticks.children;
    for (var k = 0; k < kids.length; k++) {
      kids[k].className = (state.playing && k === tickIdx ? 'on' : '') + (k % 4 === 0 ? ' acc' : '');
    }
  }
  if (state.rec) {
    var nowP = performance.now();
    if (nowP < state.rec.startPerf) {
      setStatus('Needle poised — capture starts on the next downbeat…');
    } else if (nowP >= state.rec.startPerf + LOOP_MS) {
      finishRecording();
    } else {
      setStatus('● Inscribing… ' + ((state.rec.startPerf + LOOP_MS - nowP) / 1000).toFixed(1) + 's of wax left');
    }
  }

  requestAnimationFrame(draw);
}
draw._lastTick = -1;

/* ---------- toast + status ---------- */
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 3200);
}
function setStatus(msg) {
  els.status.textContent = msg;
  els.status.classList.toggle('rec', msg.indexOf('●') === 0);
}

/* ---------- clocks ---------- */
function clockTick() {
  var n = new Date();
  function p(x) { return (x < 10 ? '0' : '') + x; }
  els.clock.textContent = p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds());
  els.count.textContent = fmtDur(msToMidnight());
  if (dayStr(n) !== state.lastDay) {
    // the midnight reset ritual, performed automatically
    openRitual(true);
  }
}

/* ---------- boot ---------- */
function buildPads() {
  NOTES.forEach(function (note, i) {
    var b = document.createElement('button');
    b.className = 'pad'; b.type = 'button';
    b.setAttribute('aria-label', 'Chime ' + note.n);
    b.innerHTML = '<b></b><small></small><kbd></kbd>';
    b.children[0].textContent = note.n;
    b.children[1].textContent = 'chime ' + (i + 1);
    b.children[2].textContent = note.k;
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); strike(i, 1); });
    els.pads.appendChild(b);
  });
  for (var i = 0; i < 16; i++) {
    var s = document.createElement('span');
    if (i % 4 === 0) s.className = 'acc';
    els.ticks.appendChild(s);
  }
}

function bindKeys() {
  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = (e.key || '').toUpperCase();
    var idx = -1;
    NOTES.forEach(function (n, i) { if (n.k === k) idx = i; });
    if (idx >= 0) { strike(idx, 1); return; }
    if (e.code === 'Space') { e.preventDefault(); state.playing ? stopWorks() : startWorks(); }
    else if (k === 'R') { state.rec ? finishRecording() : startRecording(); }
    else if (k === 'ESCAPE') { closeRitual(); }
  });
}

function boot() {
  els = {
    clock: $('clock'), count: $('countdown'), ghosts: $('ghostCount'),
    canvasWrap: document.querySelector('.canvaswrap'),
    play: $('btnPlay'), rec: $('btnRec'), ritual: $('ritual'),
    ritualTitle: $('ritualTitle'), ritualText: $('ritualText'),
    status: $('status'), pads: $('pads'), ticks: $('ticks'),
    list: $('loopList'), vault: $('vaultList'),
    tick: $('chkTick'), copy: $('btnCopy'), dl: $('btnDownload'),
    shareNote: $('shareNote'), toast: $('toast')
  };
  spiral = $('spiral');
  sctx = spiral.getContext('2d');

  load();
  buildPads();
  bindKeys();
  renderLoops();
  renderVault();
  importFromHash();

  els.play.addEventListener('click', function () { state.playing ? stopWorks() : startWorks(); });
  els.rec.addEventListener('click', function () { state.rec ? finishRecording() : startRecording(); });
  $('btnRitual').addEventListener('click', function () { openRitual(false); });
  els.copy.addEventListener('click', copyLink);
  els.dl.addEventListener('click', function () {
    if (!state.loops.length) { toast('Nothing to inscribe — record a loop first.'); return; }
    var blob = new Blob([JSON.stringify({ engine: 'meridian-ghost-loops', exported: new Date().toISOString(), url: shareURL(), loops: state.loops }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'meridian-ghost-mix.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  });

  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  clockTick();
  setInterval(clockTick, 1000);
  // hourly decay refresh
  setInterval(renderLoops, 60000);
  if (!state.loops.length && !location.hash) {
    setStatus('Silent. Press play, then record an 8-second loop.');
  }
  requestAnimationFrame(draw);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
