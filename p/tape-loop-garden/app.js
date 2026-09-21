/* Tape Loop Garden — steampunk ambient conservatory (no deps, WebAudio only) */
(function () {
  'use strict';

  var LS_KEY = 'tlg-garden-v1';

  var SEEDS = {
    bass:  { name: 'Bass Reel',   glyph: '◉', root: 65.41, scale: [0, 3, 5, 7, 10, 12], density: 0.34, spin: '5s' },
    chime: { name: 'Chime Spool', glyph: '◎', root: 523.25, scale: [0, 2, 4, 7, 9, 12, 14], density: 0.30, spin: '3s' },
    hiss:  { name: 'Hiss Valve',  glyph: '◍', root: 0, scale: [0], density: 0.42, spin: '2.2s' },
    thump: { name: 'Piston Drum', glyph: '⬢', root: 110, scale: [0, 0, 0, 7], density: 0.38, spin: '4s' }
  };

  // ---------- DOM ----------
  var bed = document.getElementById('bed');
  var bedEmpty = document.getElementById('bedEmpty');
  var readout = document.getElementById('readout');
  var powerBtn = document.getElementById('powerBtn');
  var rainBtn = document.getElementById('rainBtn');
  var pruneBtn = document.getElementById('pruneBtn');
  var tempoEl = document.getElementById('tempo');
  var tempoVal = document.getElementById('tempoVal');
  var xfEl = document.getElementById('crossfade');
  var xfVal = document.getElementById('xfVal');
  var wetEl = document.getElementById('wet');
  var wetVal = document.getElementById('wetVal');
  var recBtn = document.getElementById('recBtn');
  var recStatus = document.getElementById('recStatus');
  var dlBtn = document.getElementById('dlBtn');
  var shareBtn = document.getElementById('shareBtn');
  var copyBtn = document.getElementById('copyBtn');
  var playback = document.getElementById('playback');
  var plantCount = document.getElementById('plantCount');
  var stepGrid = document.getElementById('stepGrid');
  var pressureFill = document.getElementById('pressureFill');
  var pressureVal = document.getElementById('pressureVal');
  var fog = document.getElementById('fog');

  var plants = [];
  var uid = 0;
  var audioOn = false;
  var raining = false;
  var tempo = 96;

  // ---------- Audio graph (lazy) ----------
  var ctx = null, master = null, masterFilter = null;
  var busA = null, busB = null, wetGain = null, delayNode = null, recDest = null;
  var noiseBuf = null;

  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 2400;
    masterFilter.Q.value = 0.6;
    master = ctx.createGain();
    master.gain.value = 0.8;
    masterFilter.connect(master);
    master.connect(ctx.destination);
    busA = ctx.createGain(); busB = ctx.createGain();
    busA.connect(masterFilter); busB.connect(masterFilter);
    applyCrossfade();
    // aether delay
    delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = 0.34;
    var fb = ctx.createGain(); fb.gain.value = 0.35;
    wetGain = ctx.createGain(); wetGain.gain.value = 0.25;
    delayNode.connect(fb); fb.connect(delayNode);
    delayNode.connect(wetGain); wetGain.connect(masterFilter);
    // recorder tap
    recDest = ctx.createMediaStreamDestination();
    master.connect(recDest);
    // noise buffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startScheduler();
  }

  function applyCrossfade() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var xf = (parseInt(xfEl.value, 10) || 50) / 100;
    busA.gain.setTargetAtTime(Math.cos(xf * Math.PI / 2), t, 0.05);
    busB.gain.setTargetAtTime(Math.sin(xf * Math.PI / 2), t, 0.05);
  }

  // ---------- Sequencer ----------
  var step = 0, nextTime = 0, schedTimer = null;
  function stepDur() { return 60 / tempo / 4; }
  function startScheduler() {
    nextTime = ctx.currentTime + 0.1;
    if (schedTimer) clearInterval(schedTimer);
    schedTimer = setInterval(function () {
      while (nextTime < ctx.currentTime + 0.25) {
        scheduleStep(step, nextTime);
        nextTime += stepDur();
        step = (step + 1) % 16;
        if (step === 0 && raining) rainMutate();
      }
    }, 90);
  }

  function scheduleStep(s, when) {
    var sounded = false;
    plants.forEach(function (p, idx) {
      if (p.muted || !p.pattern[s]) return;
      sounded = true;
      triggerVoice(p, idx, when);
      flashPlant(p);
    });
    paintSteps(s, sounded);
  }

  function semiRatio(semi) { return Math.pow(2, semi / 12); }

  function adsr(param, when, peak, a, dec) {
    param.setValueAtTime(0.0001, when);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + a);
    param.exponentialRampToValueAtTime(0.0001, when + a + dec);
  }

  function triggerVoice(p, idx, when) {
    var cfg = SEEDS[p.type];
    var g = ctx.createGain();
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.connect(pan || (idx % 2 ? busB : busA));
    if (pan) { pan.pan.value = p.pan; pan.connect(idx % 2 ? busB : busA); }
    var ratio = semiRatio(p.semi);
    var dur = stepDur();

    if (p.type === 'hiss') {
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      src.playbackRate.value = 0.8 + Math.random() * 0.7;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 2500 * ratio + 400; bp.Q.value = 1.2;
      src.connect(bp); bp.connect(g);
      adsr(g.gain, when, 0.20 * p.vel, 0.005, dur * 1.2);
      src.start(when); src.stop(when + dur * 2);
    } else if (p.type === 'thump') {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130 * ratio, when);
      o.frequency.exponentialRampToValueAtTime(Math.max(34, 38 * ratio), when + 0.12);
      o.connect(g);
      adsr(g.gain, when, 0.55 * p.vel, 0.004, dur * 2.4);
      o.start(when); o.stop(when + dur * 3);
    } else if (p.type === 'chime') {
      [1, 2.01].forEach(function (m, k) {
        var oo = ctx.createOscillator(); oo.type = 'sine';
        oo.frequency.value = cfg.root * ratio * m;
        var gg = ctx.createGain(); oo.connect(gg); gg.connect(g);
        adsr(gg.gain, when, (k ? 0.10 : 0.24) * p.vel, 0.005, dur * 6);
        oo.start(when); oo.stop(when + dur * 7);
      });
    } else { // bass
      var ob = ctx.createOscillator(); ob.type = 'triangle';
      ob.frequency.value = cfg.root * ratio;
      ob.connect(g);
      adsr(g.gain, when, 0.34 * p.vel, 0.01, dur * 3.2);
      ob.start(when); ob.stop(when + dur * 4);
    }
    // aether send
    var send = ctx.createGain(); send.gain.value = 0.4;
    g.connect(send); send.connect(delayNode);
  }

  // ---------- Patterns ----------
  function seedPattern(type) {
    var cfg = SEEDS[type], pat = [];
    for (var i = 0; i < 16; i++) {
      var downbeat = (i % 4 === 0) ? 1.6 : 1;
      pat.push(Math.random() < cfg.density * downbeat ? 0.6 + Math.random() * 0.4 : 0);
    }
    if (!pat.some(Boolean)) pat[0] = 1;
    return pat;
  }

  function rainMutate() {
    if (!plants.length) return;
    var p = plants[Math.floor(Math.random() * plants.length)];
    var a = Math.floor(Math.random() * 16), b = Math.floor(Math.random() * 16);
    p.pattern[a] = p.pattern[a] ? 0 : 0.6 + Math.random() * 0.4;
    if (Math.random() < 0.5) p.pattern[b] = p.pattern[b] ? 0 : 0.6 + Math.random() * 0.4;
    if (Math.random() < 0.3) p.semi = Math.max(-12, Math.min(12, p.semi + (Math.random() < 0.5 ? -2 : 2)));
    derivePanSemi(p);
    renderTags();
    save();
    note(p.name + ' rusted into a new rhythm 🌧');
  }

  // ---------- Plants ----------
  function addPlant(type, x01, y01, opts) {
    opts = opts || {};
    var cfg = SEEDS[type];
    if (!cfg) return null;
    var p = {
      id: ++uid, type: type, name: cfg.name,
      x: clamp01(x01 == null ? Math.random() * 0.8 + 0.1 : x01),
      y: clamp01(y01 == null ? Math.random() * 0.6 + 0.2 : y01),
      muted: !!opts.muted,
      pattern: opts.pattern || seedPattern(type),
      semi: opts.semi != null ? opts.semi : 0,
      vel: 1, pan: 0, el: null
    };
    derivePanSemi(p, true);
    plants.push(p);
    mountPlant(p);
    refreshEmpty(); updateCounts(); save();
    note(cfg.name + ' planted — drag stem: ⇕ pitch · ⟷ pan');
    return p;
  }

  function derivePanSemi(p, keepSemi) {
    p.pan = +(p.x * 2 - 1).toFixed(2);
    if (!keepSemi || p.semi == null) p.semi = Math.round((1 - p.y) * 24 - 12);
  }

  function clamp01(v) { return Math.max(0.02, Math.min(0.98, +v)); }

  function mountPlant(p) {
    var cfg = SEEDS[p.type];
    var el = document.createElement('div');
    el.className = 'plant' + (p.muted ? ' muted' : '');
    el.style.left = (p.x * 100) + '%';
    el.style.top = (p.y * 100) + '%';
    el.dataset.id = p.id;
    el.title = cfg.name + ' — drag to bend, double-click to prune, tap reel to mute';
    el.innerHTML = '<button class="prune" aria-label="Prune plant">✕</button>' +
      '<span class="reel" style="--spin:' + cfg.spin + '">' + cfg.glyph + '</span>' +
      '<span class="stem"></span><span class="tag"></span>';
    bed.appendChild(el);
    p.el = el;
    renderTag(p);

    el.querySelector('.prune').addEventListener('click', function (e) {
      e.stopPropagation(); removePlant(p); note(p.name + ' pruned ✂');
    });

    // drag stem (pointer), tap = mute, double-tap = prune
    var sx, sy, ox, oy, moved, downT, tapTimer = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('prune')) return;
      e.preventDefault();
      ensureAudio();
      el.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      var r = bed.getBoundingClientRect();
      ox = p.x * r.width; oy = p.y * r.height;
      moved = false; downT = Date.now();
    });
    el.addEventListener('pointermove', function (e) {
      if (sx == null) return;
      var r = bed.getBoundingClientRect();
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (!moved) return;
      p.x = clamp01((ox + dx) / r.width);
      p.y = clamp01((oy + dy) / r.height);
      el.style.left = (p.x * 100) + '%';
      el.style.top = (p.y * 100) + '%';
      derivePanSemi(p, false);
      renderTag(p);
      liveReadout(p);
    });
    el.addEventListener('pointerup', function () {
      if (sx == null) return;
      var wasTap = !moved && (Date.now() - downT < 400);
      sx = null;
      if (!wasTap) { save(); return; }
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; removePlant(p); note(p.name + ' pruned ✂'); return; }
      tapTimer = setTimeout(function () {
        tapTimer = null;
        p.muted = !p.muted;
        el.classList.toggle('muted', p.muted);
        renderTag(p); save();
        note(p.name + (p.muted ? ' stoppered (muted)' : ' unstoppered'));
      }, 260);
    });
  }

  function renderTag(p) {
    if (!p.el) return;
    var t = p.el.querySelector('.tag');
    var st = p.semi > 0 ? '+' + p.semi : '' + p.semi;
    var pn = p.pan < -0.15 ? 'L' : (p.pan > 0.15 ? 'R' : 'C');
    t.textContent = (p.muted ? '∅ ' : '') + p.name + ' ' + st + ' · ' + pn;
  }
  function renderTags() { plants.forEach(renderTag); }

  function flashPlant(p) {
    if (!p.el || p.muted) return;
    p.el.classList.add('playing');
    setTimeout(function () { if (p.el) p.el.classList.remove('playing'); }, 140);
  }

  function removePlant(p) {
    plants = plants.filter(function (q) { return q !== p; });
    if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el);
    refreshEmpty(); updateCounts(); save();
  }

  function refreshEmpty() { bedEmpty.style.display = plants.length ? 'none' : 'grid'; }
  function updateCounts() {
    plantCount.textContent = plants.length;
  }

  var noteTimer = null;
  function note(msg) {
    readout.textContent = msg;
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(idleReadout, 6000);
  }
  function idleReadout() {
    if (!plants.length) { readout.textContent = 'No plants yet. The boiler is cold.'; return; }
    readout.textContent = plants.length + ' reel' + (plants.length > 1 ? 's' : '') +
      ' turning · ' + tempo + ' BPM' + (raining ? ' · rain editing the score 🌧' : '') +
      ' · scroll to stoke the boiler';
  }
  function liveReadout(p) {
    var st = p.semi > 0 ? '+' + p.semi : '' + p.semi;
    readout.textContent = p.name + ': pitch ' + st + ' st · pan ' + p.pan;
  }

  // ---------- Seed tray: click to plant, drag to place ----------
  var tray = document.getElementById('seedTray');
  tray.querySelectorAll('.seed').forEach(function (btn) {
    var type = btn.dataset.seed, ghost = null, gx, gy, gmoved;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      gx = e.clientX; gy = e.clientY; gmoved = false;
      ghost = document.createElement('div');
      ghost.className = 'plant';
      ghost.style.cssText = 'position:fixed;z-index:50;pointer-events:none;left:' + gx + 'px;top:' + gy + 'px';
      ghost.innerHTML = '<span class="reel">' + SEEDS[type].glyph + '</span>';
      document.body.appendChild(ghost);
      btn.classList.add('drag-src');
      var move = function (ev) {
        if (Math.abs(ev.clientX - gx) + Math.abs(ev.clientY - gy) > 8) gmoved = true;
        ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      };
      var up = function (ev) {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        btn.classList.remove('drag-src');
        ensureAudio(); powerOnUI();
        var r = bed.getBoundingClientRect();
        if (ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
          addPlant(type, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
        } else if (!gmoved) {
          addPlant(type); // plain tap: plant wild
          bed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  });

  // ---------- Console ----------
  function powerOnUI() {
    if (!audioOn) { audioOn = true; powerBtn.setAttribute('aria-pressed', 'true'); powerBtn.textContent = '⚙ Boiler Lit — garden sounding'; idleReadout(); }
  }
  powerBtn.addEventListener('click', function () {
    ensureAudio();
    if (ctx.state === 'suspended') { ctx.resume(); }
    powerOnUI();
    note(audioOn && plants.length ? 'The garden plays on.' : 'Boiler lit. Plant a seed to begin.');
  });
  tempoEl.addEventListener('input', function () {
    tempo = parseInt(tempoEl.value, 10); tempoVal.textContent = tempo; idleReadout(); save();
  });
  xfEl.addEventListener('input', function () {
    xfVal.textContent = xfEl.value; applyCrossfade(); save();
  });
  wetEl.addEventListener('input', function () {
    wetVal.textContent = wetEl.value;
    if (ctx && wetGain) wetGain.gain.setTargetAtTime(wetEl.value / 100, ctx.currentTime, 0.05);
    save();
  });
  rainBtn.addEventListener('click', function () {
    raining = !raining;
    rainBtn.setAttribute('aria-pressed', String(raining));
    document.body.classList.toggle('raining', raining);
    bed.classList.toggle('raining', raining);
    rainBtn.textContent = raining ? '🌧 Rain Falling — tap to shelter' : '🌧 Summon Rain';
    note(raining ? 'Rain summoned — the storm rewrites rhythms each chorus.' : 'Skies clear. Rhythms hold their shape.');
    idleReadoutSoon();
  });
  function idleReadoutSoon() { setTimeout(idleReadout, 2500); }
  pruneBtn.addEventListener('click', function () {
    plants.slice().forEach(removePlant);
    note('Bed pruned to bare soil. The compost remembers.');
  });

  // ---------- Record + share (one tap) ----------
  var recorder = null, chunks = [], lastBlobUrl = null;
  recBtn.addEventListener('click', function () {
    ensureAudio(); powerOnUI();
    if (!recorder || recorder.state === 'inactive') startRec();
    else recorder.stop();
  });
  function startRec() {
    chunks = [];
    try {
      recorder = new MediaRecorder(recDest.stream);
    } catch (err) {
      recStatus.textContent = 'This browser cannot engrave (no MediaRecorder). Try Chrome or Firefox.';
      return;
    }
    recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = finishRec;
    recorder.start();
    recBtn.setAttribute('aria-pressed', 'true');
    recBtn.textContent = '■ Cut the Wax (tap to stop)';
    recStatus.textContent = 'Engraving… play, drag stems, summon rain — it all goes on the cylinder.';
  }
  function finishRec() {
    recBtn.setAttribute('aria-pressed', 'false');
    recBtn.textContent = '● Engrave Mix (one tap)';
    var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = URL.createObjectURL(blob);
    playback.src = lastBlobUrl; playback.hidden = false;
    dlBtn.disabled = false; shareBtn.disabled = false;
    dlBtn.onclick = function () {
      var a = document.createElement('a');
      a.href = lastBlobUrl;
      a.download = 'tape-loop-garden-mix.webm';
      document.body.appendChild(a); a.click(); a.remove();
    };
    recStatus.textContent = 'Engraving complete (' + Math.round(blob.size / 1024) + ' KB). Listen above, download, or share.';
  }
  function gardenLink() {
    var state = { v: 1, tempo: tempo, xf: xfEl.value, wet: wetEl.value, rain: raining ? 1 : 0,
      plants: plants.map(function (p) {
        return { t: p.type, x: +p.x.toFixed(3), y: +p.y.toFixed(3), m: p.muted ? 1 : 0, s: p.semi, pt: p.pattern.map(function (v) { return Math.round(v * 10) / 10; }) };
      }) };
    var enc = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    return location.origin === 'null' || location.protocol === 'file:'
      ? location.href.split('#')[0] + '#g=' + enc
      : location.origin + location.pathname + '#g=' + enc;
  }
  copyBtn.addEventListener('click', function () {
    var link = gardenLink();
    copyText(link).then(function () { note('Garden coordinates copied — send them; a friend’s bed will bloom as yours.'); });
  });
  shareBtn.addEventListener('click', function () {
    var link = gardenLink();
    if (navigator.share) {
      navigator.share({ title: 'Tape Loop Garden mix', text: 'Hear my overgrown tape-loop garden:', url: link }).catch(function () {});
    } else {
      copyText(link).then(function () { note('No town crier (Web Share) here — link copied instead.'); });
    }
  });
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () { fallbackCopy(t); });
    return Promise.resolve(fallbackCopy(t));
  }
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  // ---------- Persistence + shared links ----------
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        tempo: tempo, xf: xfEl.value, wet: wetEl.value,
        plants: plants.map(function (p) {
          return { t: p.type, x: p.x, y: p.y, m: p.muted, s: p.semi, pt: p.pattern };
        })
      }));
    } catch (e) {}
  }
  function restoreState(s) {
    if (!s) return false;
    try {
      if (s.tempo) { tempo = s.tempo; tempoEl.value = tempo; tempoVal.textContent = tempo; }
      if (s.xf != null) { xfEl.value = s.xf; xfVal.textContent = s.xf; }
      if (s.wet != null) { wetEl.value = s.wet; wetVal.textContent = s.wet; }
      (s.plants || []).slice(0, 12).forEach(function (sp) {
        if (SEEDS[sp.t]) addPlant(sp.t, sp.x, sp.y, { muted: sp.m, semi: sp.s, pattern: sp.pt });
      });
      return true;
    } catch (e) { return false; }
  }
  function boot() {
    var h = location.hash;
    if (h.indexOf('#g=') === 0) {
      try {
        var s = JSON.parse(decodeURIComponent(escape(atob(h.slice(3)))));
        if (restoreState(s)) { note('A traveller’s garden blooms here — press the boiler and listen.'); refreshEmpty(); updateCounts(); idleReadoutSoon(); initScroll(); initSteps(); return; }
      } catch (e) {}
    }
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) restoreState(JSON.parse(raw));
    } catch (e) {}
    if (!plants.length) { addPlantSilent('chime', 0.3, 0.35); addPlantSilent('bass', 0.65, 0.6); }
    refreshEmpty(); updateCounts(); idleReadout();
    initScroll(); initSteps();
  }
  function addPlantSilent(type, x, y) {
    var cfg = SEEDS[type];
    var p = { id: ++uid, type: type, name: cfg.name, x: x, y: y, muted: false, pattern: seedPattern(type), semi: 0, vel: 1, pan: 0, el: null };
    derivePanSemi(p, true);
    plants.push(p); mountPlant(p);
  }

  // ---------- Step grid ----------
  var cells = [];
  function initSteps() {
    stepGrid.innerHTML = '';
    cells = [];
    for (var i = 0; i < 16; i++) { var c = document.createElement('i'); stepGrid.appendChild(c); cells.push(c); }
  }
  function paintSteps(s, sounded) {
    cells.forEach(function (c, i) {
      c.classList.toggle('now', i === s);
      var any = plants.some(function (p) { return !p.muted && p.pattern[i]; });
      c.classList.toggle('on', !!any);
    });
  }

  // ---------- Scroll reaction (constraint) ----------
  function initScroll() {
    var gears = document.querySelectorAll('.gear');
    var entries = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('shown'); });
      }, { threshold: 0.2 });
      entries.forEach(function (el) { io.observe(el); });
    } else {
      entries.forEach(function (el) { el.classList.add('shown'); });
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        var k = Math.min(1, (window.scrollY || 0) / max);
        pressureFill.style.width = Math.round(k * 100) + '%';
        pressureVal.textContent = Math.round(k * 100);
        gears.forEach(function (g, i) { g.style.transform = 'rotate(' + (window.scrollY * (i ? -0.4 : 0.25)) + 'deg)'; });
        fog.style.opacity = String(1 - k * 0.7);
        if (ctx && masterFilter) {
          masterFilter.frequency.setTargetAtTime(700 + k * 5200, ctx.currentTime, 0.1);
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  boot();
})();
