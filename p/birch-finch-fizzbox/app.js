/* Birch Finch Fizzbox — Memphis bubble synth + 4-bar looper.
   Plain script (file:// safe). All sound = WebAudio, no assets. */
(function () {
  'use strict';

  /* ---------- config ---------- */
  var VOICES = [
    { id: 'chirpA', kind: 'chirp', label: 'CHIRP', sub: 'sine bird', midi: 79, color: '#ffc700', x: 8,  y: 8,   key: '1' },
    { id: 'chirpB', kind: 'chirp', label: 'TWEET', sub: 'high bird', midi: 84, color: '#ff5ca8', x: 62, y: 4,   key: '2' },
    { id: 'kickA',  kind: 'kick',  label: 'KICK',  sub: 'boom',      midi: 36, color: '#7b5cff', x: 36, y: 30,  key: '3' },
    { id: 'kickB',  kind: 'kick',  label: 'THUMP', sub: 'tight',     midi: 43, color: '#ff6b35', x: 66, y: 44,  key: '4' },
    { id: 'fizzA',  kind: 'fizz',  label: 'FIZZ',  sub: 'sparkle',   midi: 91, color: '#2ec4b6', x: 10, y: 52,  key: '5' },
    { id: 'fizzB',  kind: 'fizz',  label: 'SIZZ',  sub: 'wash',      midi: 86, color: '#3ec1ff', x: 42, y: 64,  key: '6' },
    { id: 'pluckA', kind: 'pluck', label: 'PLUCK', sub: 'bass pop',  midi: 55, color: '#b8f135', x: 72, y: 68,  key: '7' }
  ];
  var STORE_KEY = 'birch-finch-fizzbox-v1';
  var N_BEATS = 16; // 4 bars x 4/4

  /* ---------- dom ---------- */
  function $(id) { return document.getElementById(id); }
  var pond = $('pond'), barsEl = $('bars'), roll = $('roll'), playhead = $('playhead'),
    statusEl = $('status'), tapeList = $('tapeList'), statEvents = $('statEvents'),
    bpmEl = $('bpm'), bpmVal = $('bpmVal'), topBpm = $('topBpm'), loopSecs = $('loopSecs'),
    btnPlay = $('btnPlay'), btnRec = $('btnRec'), btnDice = $('btnDice'),
    btnUndo = $('btnUndo'), btnClear = $('btnClear'), chkOverdub = $('chkOverdub'),
    ctaPlay = $('ctaPlay'), ctaDice = $('ctaDice'),
    knobFilter = $('knobFilter'), knobEcho = $('knobEcho'), knobVol = $('knobVol'),
    filterVal = $('filterVal'), echoVal = $('echoVal'), volVal = $('volVal'),
    washVal = $('washVal'), washFill = $('washFill'), scrollfill = $('scrollfill');

  /* ---------- state ---------- */
  var state = {
    bpm: 112, playing: false, recording: false, overdub: true,
    events: [], // {t, v, b, dice}
    grooveName: 'untitled jam',
    filter: 70, echo: 30, vol: 80, scrollWash: 0
  };
  function loopDur() { return N_BEATS * 60 / state.bpm; }

  /* ---------- audio engine ---------- */
  var ctx = null, master = null, filter = null, echoSend = null, echoGain = null, noiseBuf = null;
  var loopStart = 0, timer = null, recTakeEnd = 0;

  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = state.vol / 100 * 0.9;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 4000; filter.Q.value = 0.8;
    var comp = ctx.createDynamicsCompressor();
    filter.connect(master); master.connect(comp); comp.connect(ctx.destination);
    // wobble echo
    echoSend = ctx.createGain(); echoGain = ctx.createGain();
    var dly = ctx.createDelay(1); dly.delayTime.value = 0.32;
    var fb = ctx.createGain(); fb.gain.value = 0.35;
    echoSend.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(echoGain); echoGain.connect(master);
    echoGain.gain.value = state.echo / 100 * 0.5;
    // shared noise buffer for fizz
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyWash();
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function bendFreq(midi, bend) { return mtof(midi + bend); }

  function playChirp(when, midi, bend, vol) {
    var f = bendFreq(midi, bend), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.setValueAtTime(f * 0.9, when);
    o1.frequency.exponentialRampToValueAtTime(f * 1.6, when + 0.09);
    o1.frequency.exponentialRampToValueAtTime(f * 1.1, when + 0.22);
    o2.frequency.setValueAtTime(f * 2.02, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5 * vol, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);
    o1.connect(g); o2.connect(g); g.connect(filter); g.connect(echoSend);
    o1.start(when); o2.start(when); o1.stop(when + 0.4); o2.stop(when + 0.4);
  }
  function playKick(when, midi, bend, vol) {
    var f = Math.max(30, bendFreq(midi, bend) * 2), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 3.2, when);
    o.frequency.exponentialRampToValueAtTime(Math.max(32, f * 0.7), when + 0.11);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.9 * vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    o.connect(g); g.connect(filter);
    o.start(when); o.stop(when + 0.35);
  }
  function playFizz(when, midi, bend, vol) {
    var f = bendFreq(midi, bend) * 2, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    bp.type = 'bandpass'; bp.frequency.value = Math.min(12000, f); bp.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.4 * vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
    src.connect(bp); bp.connect(g); g.connect(filter); g.connect(echoSend);
    src.start(when); src.stop(when + 0.3);
    var o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = Math.min(12000, f * 1.5);
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.exponentialRampToValueAtTime(0.12 * vol, when + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    o.connect(g2); g2.connect(filter); o.start(when); o.stop(when + 0.2);
  }
  function playPluck(when, midi, bend, vol) {
    var f = bendFreq(midi, bend), o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'square'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, when);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, when + 0.25);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.42 * vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    o.connect(lp); lp.connect(g); g.connect(filter); g.connect(echoSend);
    o.start(when); o.stop(when + 0.4);
  }
  function voiceById(id) { for (var i = 0; i < VOICES.length; i++) if (VOICES[i].id === id) return VOICES[i]; return VOICES[0]; }
  function playVoice(when, id, bend, vol) {
    var v = voiceById(id);
    if (v.kind === 'chirp') playChirp(when, v.midi, bend, vol);
    else if (v.kind === 'kick') playKick(when, v.midi, bend, vol);
    else if (v.kind === 'fizz') playFizz(when, v.midi, bend, vol);
    else playPluck(when, v.midi, bend, vol);
  }

  /* ---------- transport + loop scheduler ---------- */
  function nowLoopPos() {
    if (!ctx || !state.playing) return 0;
    var d = loopDur();
    return ((ctx.currentTime - loopStart) % d + d) % d;
  }
  function scheduleTick() {
    if (!ctx || !state.playing) return;
    var now = ctx.currentTime, dur = loopDur();
    for (var i = 0; i < state.events.length; i++) {
      var ev = state.events[i];
      var loops = Math.floor((now - loopStart) / dur);
      var next = loopStart + loops * dur + ev.t;
      if (next < now + 0.03) next += dur; // already passed: catch it next lap
      if (next < now + 0.22 && ev._at !== next) {
        ev._at = next;
        playVoice(next, ev.v, ev.b, 1);
      }
    }
    // end a REC take after exactly one full lap
    if (state.recording && now >= recTakeEnd) {
      state.recording = false;
      btnRec.classList.remove('armed'); btnRec.textContent = '● REC 4-BAR TAKE';
      setStatus('take taped — looping <b>' + state.events.length + ' notes</b> as “' + state.grooveName + '”. overdub more or roll the dice.');
      save();
    }
    drawPlayhead();
  }
  function startTransport() {
    ensureAudio(); if (!ctx) return;
    if (!state.playing) {
      state.playing = true;
      var dur = loopDur();
      loopStart = ctx.currentTime + 0.06;
      for (var i = 0; i < state.events.length; i++) state.events[i]._at = -1;
      timer = setInterval(scheduleTick, 40);
      btnPlay.textContent = '⏸ STOP'; ctaPlay.textContent = '⏸ STOP THE FIZZ';
      setStatus(state.events.length ? 'looping <b>' + state.events.length + ' notes</b> — tap to overdub, drag to bend.' : 'loop rolling, pond is live — tap bubbles to tape notes.');
    } else stopTransport();
  }
  function stopTransport() {
    state.playing = false; state.recording = false;
    if (timer) clearInterval(timer); timer = null;
    btnPlay.textContent = '▶ PLAY'; ctaPlay.textContent = '▶ START THE FIZZ';
    btnRec.classList.remove('armed'); btnRec.textContent = '● REC 4-BAR TAKE';
    setStatus('paused. press PLAY — the tape keeps everything.');
    drawPlayhead();
  }
  function setStatus(html) { statusEl.innerHTML = html; }

  function tapeNote(id, bend, dice) {
    ensureAudio(); if (!ctx) return;
    playVoice(ctx.currentTime, id, bend, 1);
    popBubble(id);
    if (state.playing && (state.recording || state.overdub)) {
      var ev = { t: nowLoopPos(), v: id, b: bend, dice: !!dice };
      state.events.push(ev); state.events.sort(function (a, b) { return a.t - b.t; });
      renderRoll(); renderTape(); updateCounts(); save();
    }
  }

  /* ---------- bubbles: tap + drag-bend ---------- */
  var bubbleEls = {};
  function buildPond() {
    pond.innerHTML = '';
    VOICES.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'bubble'; b.dataset.id = v.id;
      b.style.background = v.color;
      b.style.left = v.x + '%'; b.style.top = v.y + '%';
      b.style.setProperty('--bob', (2.6 + (i % 4) * 0.5) + 's');
      b.setAttribute('aria-label', v.label + ' bubble, ' + v.sub + '. Tap to play, drag up or down to bend pitch.');
      b.innerHTML = '<span>' + v.label + '<small>' + v.sub + ' · ' + v.key + '</small></span><span class="bend" hidden>0</span>';
      pond.appendChild(b); bubbleEls[v.id] = b;
      attachBend(b, v);
    });
  }
  function bendBadge(id, bend) {
    var el = bubbleEls[id]; if (!el) return;
    var tag = el.querySelector('.bend');
    if (!bend) { tag.hidden = true; return; }
    tag.hidden = false;
    tag.textContent = (bend > 0 ? '+' : '') + bend + 'st';
  }
  function popBubble(id) {
    var el = bubbleEls[id]; if (!el) return;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  // shortcut: known limit — bend preview re-triggers quietly; upgrade to live osc detune if voices sustain.
  function attachBend(el, voice) {
    var startY = 0, bend = 0, down = false, lastPrev = 0;
    el.addEventListener('pointerdown', function (e) {
      ensureAudio();
      down = true; startY = e.clientY; bend = 0;
      el.classList.add('dragging'); el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      bend = Math.max(-7, Math.min(7, Math.round((startY - e.clientY) / 26)));
      bendBadge(voice.id, bend);
      var now = Date.now();
      if (now - lastPrev > 140 && ctx) { lastPrev = now; playVoice(ctx.currentTime, voice.id, bend, 0.7); }
    });
    function commit(e) {
      if (!down) return;
      down = false; el.classList.remove('dragging');
      bendBadge(voice.id, 0);
      tapeNote(voice.id, bend, false);
      if (bend !== 0) setStatus('<b>' + voice.label + '</b> bent <b>' + (bend > 0 ? '+' : '') + bend + ' st</b> and taped. nice ear.');
    }
    el.addEventListener('pointerup', commit);
    el.addEventListener('pointercancel', function () { down = false; el.classList.remove('dragging'); bendBadge(voice.id, 0); });
  }

  /* ---------- one-click random groove ---------- */
  var ADJ = ['FIZZY', 'WOBBLY', 'SOGGY', 'SPARKLY', 'JUMPY', 'DIZZY', 'PEPPY', 'SASSY'];
  var BIRD = ['FINCH', 'WREN', 'SPARROW', 'STARLING', 'BUNTING', 'PIPIT'];
  function randomGroove() {
    ensureAudio(); if (!ctx) return;
    var scale = [57, 60, 62, 64, 67, 69, 72, 76]; // A minor pentatonic-ish
    var dur = loopDur(), beat = dur / 16, evs = [];
    var name = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + BIRD[Math.floor(Math.random() * BIRD.length)];
    state.bpm = 96 + Math.floor(Math.random() * 31);
    syncBpmUI();
    // kicks: four on the floor + swing extras
    [0, 4, 8, 12].forEach(function (b) { evs.push({ t: b * beat, v: 'kickA', b: 0, dice: true }); });
    if (Math.random() < 0.8) evs.push({ t: 14 * beat, v: 'kickB', b: 0, dice: true });
    if (Math.random() < 0.6) evs.push({ t: 7 * beat, v: 'kickB', b: 2, dice: true });
    // pluck bass on bar starts
    [0, 4, 8, 12].forEach(function (b, i) {
      evs.push({ t: b * beat + beat / 2, v: 'pluckA', b: [-5, -2, 0, -3][i % 4], dice: true });
    });
    // chirp melody: 8th-note random walk
    var deg = 3 + Math.floor(Math.random() * 3);
    for (var s = 0; s < 16; s += 1) {
      if (Math.random() < 0.62) {
        deg = Math.max(0, Math.min(scale.length - 1, deg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        var chirpId = Math.random() < 0.5 ? 'chirpA' : 'chirpB';
        evs.push({ t: (s * beat + (Math.random() < 0.25 ? beat / 2 : 0)) % dur, v: chirpId, b: scale[deg] - voiceById(chirpId).midi, dice: true });
      }
    }
    // fizz offbeats
    for (var f = 0; f < 16; f++) {
      if (f % 2 === 1 && Math.random() < 0.55) evs.push({ t: f * beat + beat / 2, v: Math.random() < 0.5 ? 'fizzA' : 'fizzB', b: Math.floor(Math.random() * 8) - 2, dice: true });
    }
    evs.sort(function (a, b) { return a.t - b.t; });
    state.events = evs; state.grooveName = name;
    for (var i = 0; i < state.events.length; i++) state.events[i]._at = -1;
    if (!state.playing) startTransport(); else { loopStart = ctx.currentTime + 0.06; }
    renderRoll(); renderTape(); updateCounts(); save();
    setStatus('🎲 <b>' + name + '</b> · ' + state.bpm + ' BPM · ' + evs.length + ' notes — looping now. tap to overdub, REC to retape.');
  }

  /* ---------- timeline / tape / counts ---------- */
  function buildBars() {
    barsEl.innerHTML = '';
    for (var bar = 0; bar < 4; bar++) {
      var d = document.createElement('div'); d.className = 'bar'; d.id = 'bar' + bar;
      d.innerHTML = '<h3>BAR ' + (bar + 1) + '</h3><div class="beats">' +
        '<span class="beat"></span>'.repeat(4) + '</div>';
      barsEl.appendChild(d);
    }
  }
  function renderRoll() {
    var olds = roll.querySelectorAll('.ev');
    for (var i = 0; i < olds.length; i++) olds[i].remove();
    var dur = loopDur();
    state.events.forEach(function (ev) {
      var s = document.createElement('span');
      s.className = 'ev ' + (ev.dice ? 'dice' : 'mine');
      s.style.left = (ev.t / dur * 100).toFixed(2) + '%';
      s.title = voiceById(ev.v).label + ' ' + (ev.b > 0 ? '+' : '') + ev.b + 'st';
      roll.appendChild(s);
    });
  }
  function drawPlayhead() {
    if (!state.playing || !ctx) { playhead.style.left = '0%'; return; }
    var dur = loopDur(), pos = nowLoopPos(), pct = pos / dur * 100;
    playhead.style.left = pct.toFixed(2) + '%';
    var beat = Math.floor(pos / dur * 16), bar = Math.floor(beat / 4);
    for (var i = 0; i < 4; i++) {
      var b = $('bar' + i);
      if (b) b.classList.toggle('playing', i === bar);
      if (b) {
        var dots = b.querySelectorAll('.beat');
        for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('now', i === bar && (beat % 4) === j);
      }
    }
    if (state.playing && !drawPlayhead._t) {
      drawPlayhead._t = true;
      requestAnimationFrame(function () { drawPlayhead._t = false; drawPlayhead(); });
    }
  }
  function barBeat(t) {
    var beat = Math.floor(t / loopDur() * 16);
    return 'bar ' + (Math.floor(beat / 4) + 1) + ' · beat ' + ((beat % 4) + 1);
  }
  function renderTape() {
    if (!state.events.length) { tapeList.innerHTML = '<li class="empty">nothing taped yet — pop a bubble or roll the dice.</li>'; return; }
    var html = state.events.map(function (ev) {
      var v = voiceById(ev.v);
      return '<li><span class="tag ' + v.kind + '">' + v.label + '</span>' + barBeat(ev.t) +
        ' · bend ' + (ev.b > 0 ? '+' : '') + ev.b + 'st' + (ev.dice ? ' · ◇ dice' : '') + '</li>';
    }).join('');
    tapeList.innerHTML = html;
  }
  function updateCounts() {
    statEvents.textContent = state.events.length;
    loopSecs.textContent = loopDur().toFixed(1) + 's loop';
  }

  /* ---------- persistence ---------- */
  var saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          bpm: state.bpm, events: state.events.map(function (e) { return { t: e.t, v: e.v, b: e.b, dice: e.dice }; }),
          grooveName: state.grooveName, filter: state.filter, echo: state.echo, vol: state.vol
        }));
      } catch (e) { /* private mode: ignore */ }
    }, 300);
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY); if (!raw) return;
      var s = JSON.parse(raw);
      if (typeof s.bpm === 'number') state.bpm = Math.max(84, Math.min(140, s.bpm));
      if (Array.isArray(s.events)) state.events = s.events.filter(function (e) { return e && typeof e.t === 'number' && voiceById(e.v); });
      if (s.grooveName) state.grooveName = s.grooveName;
      ['filter', 'echo', 'vol'].forEach(function (k) { if (typeof s[k] === 'number') state[k] = s[k]; });
    } catch (e) { /* corrupt save: start fresh */ }
  }

  /* ---------- mixer ---------- */
  function applyMixer() {
    filterVal.textContent = state.filter; echoVal.textContent = state.echo; volVal.textContent = state.vol;
    if (!ctx) return;
    master.gain.setTargetAtTime(state.vol / 100 * 0.9, ctx.currentTime, 0.03);
    echoGain.gain.setTargetAtTime(state.echo / 100 * 0.5, ctx.currentTime, 0.03);
    applyWash();
  }
  // scroll wash: deeper scroll = brighter filter (base knob blended with scroll)
  function applyWash() {
    if (!ctx || !filter) return;
    var base = 700 + (state.filter / 100) * 4200;
    var wash = base + state.scrollWash * 6500;
    filter.frequency.setTargetAtTime(Math.min(14000, wash), ctx.currentTime, 0.08);
    washVal.textContent = (wash / 1000).toFixed(1) + 'kHz';
  }

  /* ---------- scroll reaction (hard constraint) ---------- */
  var scrollVel = 0, lastY = 0, ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || 0;
      var max = Math.max(1, document.body.scrollHeight - window.innerHeight);
      var p = Math.min(1, y / max);
      scrollVel = scrollVel * 0.85 + Math.min(60, Math.abs(y - lastY)) * 0.15;
      lastY = y;
      state.scrollWash = p;
      document.documentElement.style.setProperty('--sp', p.toFixed(3));
      scrollfill.style.width = (p * 100).toFixed(1) + '%';
      washFill.style.width = Math.round(15 + p * 85) + '%';
      if (ctx && state.playing) applyWash();
      else washVal.textContent = ((700 + (state.filter / 100) * 4200 + p * 6500) / 1000).toFixed(1) + 'kHz';
      // parallax shapes
      var els = document.querySelectorAll('[data-float]');
      var mid = y + window.innerHeight / 2;
      for (var i = 0; i < els.length; i++) {
        var sp = parseFloat(els[i].dataset.float || 0.1);
        els[i].style.translate = '0 ' + ((mid * sp * -0.4) % 120).toFixed(1) + 'px';
      }
      // pond squashes a little with scroll velocity
      if (pond) pond.style.transform = 'scale(' + (1 + Math.min(0.04, scrollVel / 2500)).toFixed(3) + ',' +
        (1 - Math.min(0.05, scrollVel / 2000)).toFixed(3) + ')';
    });
  }

  /* ---------- events ---------- */
  function syncBpmUI() {
    bpmEl.value = state.bpm; bpmVal.textContent = state.bpm; topBpm.textContent = state.bpm;
    loopSecs.textContent = loopDur().toFixed(1) + 's loop';
  }
  function wire() {
    btnPlay.addEventListener('click', startTransport);
    ctaPlay.addEventListener('click', function () { startTransport(); document.getElementById('console').scrollIntoView({ behavior: 'smooth' }); });
    btnDice.addEventListener('click', randomGroove);
    ctaDice.addEventListener('click', function () { randomGroove(); document.getElementById('console').scrollIntoView({ behavior: 'smooth' }); });
    btnRec.addEventListener('click', function () {
      ensureAudio(); if (!ctx) return;
      state.events = []; renderRoll(); renderTape(); updateCounts();
      state.grooveName = 'live take ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!state.playing) startTransport();
      else { loopStart = ctx.currentTime + 0.06; for (var i = 0; i < state.events.length; i++) state.events[i]._at = -1; }
      state.recording = true;
      recTakeEnd = ctx.currentTime + 0.06 + loopDur();
      btnRec.classList.add('armed'); btnRec.textContent = '● TAPING… (1 lap)';
      setStatus('taping — play the pond for one 4-bar lap. it auto-loops after.');
    });
    btnUndo.addEventListener('click', function () {
      state.events.pop(); renderRoll(); renderTape(); updateCounts(); save();
      setStatus(state.events.length ? 'undid that. <b>' + state.events.length + ' notes</b> left on tape.' : 'tape wiped clean. fresh pond.');
    });
    btnClear.addEventListener('click', function () {
      state.events = []; renderRoll(); renderTape(); updateCounts(); save();
      setStatus('tape cleared. the pond forgives you.');
    });
    chkOverdub.addEventListener('change', function () { state.overdub = chkOverdub.checked; });
    bpmEl.addEventListener('input', function () {
      var oldDur = loopDur();
      var frac = (state.playing && ctx) ? nowLoopPos() / oldDur : 0;
      state.bpm = +bpmEl.value; syncBpmUI(); updateCounts(); renderRoll(); save();
      if (state.playing && ctx) loopStart = ctx.currentTime + 0.03 - frac * loopDur();
    });
    knobFilter.addEventListener('input', function () { state.filter = +knobFilter.value; applyMixer(); save(); });
    knobEcho.addEventListener('input', function () { state.echo = +knobEcho.value; applyMixer(); save(); });
    knobVol.addEventListener('input', function () { state.vol = +knobVol.value; applyMixer(); save(); });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName || '')) return;
      for (var i = 0; i < VOICES.length; i++) {
        if (e.key === VOICES[i].key) { tapeNote(VOICES[i].id, 0, false); break; }
      }
      if (e.key === ' ') { e.preventDefault(); startTransport(); }
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    // reveal-on-scroll
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.12 });
      document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    } else {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ---------- boot ---------- */
  load();
  buildPond(); buildBars(); wire();
  syncBpmUI(); renderRoll(); renderTape(); updateCounts();
  knobFilter.value = state.filter; knobEcho.value = state.echo; knobVol.value = state.vol;
  filterVal.textContent = state.filter; echoVal.textContent = state.echo; volVal.textContent = state.vol;
  chkOverdub.checked = state.overdub;
  onScroll();
  if (state.events.length) setStatus('restored <b>' + state.events.length + ' notes</b> (“' + state.grooveName + '”) — press PLAY.');
})();
