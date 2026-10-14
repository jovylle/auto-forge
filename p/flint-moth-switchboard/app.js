/* FLINT MOTH SWITCHBOARD — night-shift patchboard logic (localStorage only) */
(function () {
  'use strict';

  var LOG_KEY = 'flintmoth.log.v1';
  var FLAG_KEY = 'flintmoth.deadjack';
  var MUTE_KEY = 'flintmoth.muted';

  var OPERATORS = [
    { id: 'MO-1', name: 'LUNA', note: 'long-distance · patient' },
    { id: 'MO-2', name: 'ATLAS', note: 'heavy lines · calm' },
    { id: 'MO-3', name: 'CECROPIA', note: 'night bus depot' },
    { id: 'MO-4', name: 'POLYPHEMUS', note: 'one-eyed focus' },
    { id: 'MO-5', name: 'IO', note: 'short hops · fast' },
    { id: 'MO-6', name: 'SPHINX', note: 'riddles desk' }
  ];

  var CALLERS = [
    'Lighthouse keeper', 'Night bus depot', 'All-night diner', 'Observatory dome',
    'Freight yard office', 'Moth collector', 'Late train platform', 'Harbor fog horn',
    'Bakery (4am shift)', 'Taxi stand nº 9', 'Unknown — heavy breathing', 'Owl surveyor'
  ];

  var LINES = [1, 2, 3, 4, 5].map(function (n) {
    return { n: n, state: 'idle', caller: '', opId: null, since: 0, holdAcc: 0, holdSince: 0 };
  });

  var selectedLine = null;
  var patchedTotal = 0;
  var talkSecs = 0;
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

  /* ---------- dom ---------- */
  function $(id) { return document.getElementById(id); }
  var lineList = $('lineList'), jackList = $('jackList'), logList = $('logList');
  var hint = $('patchHint'), clockEl = $('clock'), muteBtn = $('muteBtn');
  var statPatched = $('statPatched'), statTalk = $('statTalk');
  var board = $('board'), cords = $('cords');

  /* ---------- audio (webaudio, no files) ---------- */
  var actx = null;
  function tone(freq, t0, dur, type, gain) {
    if (muted) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      var t = actx.currentTime + (t0 || 0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function sndRing() { tone(440, 0, 0.28, 'square', 0.04); tone(480, 0.32, 0.28, 'square', 0.04); }
  function sndSnap() { tone(880, 0, 0.08, 'triangle', 0.1); tone(1320, 0.06, 0.1, 'triangle', 0.08); }
  function sndDrop() { tone(220, 0, 0.16, 'sawtooth', 0.07); }
  function sndHold() { tone(660, 0, 0.12, 'sine', 0.09); }

  /* ---------- log (persisted) ---------- */
  function loadLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLog(entries) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 50))); } catch (e) {}
  }
  function stamp(d) {
    d = d || new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function addLog(text, sys) {
    var entries = loadLog();
    entries.unshift({ t: stamp(), text: text, sys: !!sys });
    saveLog(entries);
    renderLog();
  }
  function renderLog() {
    var entries = loadLog();
    logList.innerHTML = '';
    if (!entries.length) {
      var li = document.createElement('li');
      li.className = 'log-empty';
      li.textContent = '— no calls yet tonight. the moths wait. —';
      logList.appendChild(li);
      return;
    }
    entries.forEach(function (en) {
      var li = document.createElement('li');
      if (en.sys) li.className = 'sys';
      var tm = document.createElement('time');
      tm.textContent = en.t;
      li.appendChild(tm);
      li.appendChild(document.createTextNode(en.text));
      logList.appendChild(li);
    });
  }
  $('clearLog').addEventListener('click', function () {
    saveLog([]);
    renderLog();
    addLog('log wiped by operator. night forgets.', true);
  });

  /* ---------- lines ---------- */
  function opName(id) {
    var o = OPERATORS.filter(function (x) { return x.id === id; })[0];
    return o ? o.name : '?';
  }
  function renderLines() {
    lineList.innerHTML = '';
    LINES.forEach(function (L) {
      var li = document.createElement('li');
      li.className = 'line-card' + (selectedLine === L.n ? ' selected' : '');
      li.setAttribute('data-state', L.state);
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      var label = 'LINE 0' + L.n + ' — ' + L.state.toUpperCase();
      li.setAttribute('aria-label', label + (L.caller ? ', ' + L.caller : ''));

      var lamp = document.createElement('span');
      lamp.className = 'lamp';
      lamp.setAttribute('aria-hidden', 'true');

      var name = document.createElement('span');
      name.className = 'line-name';
      name.textContent = 'LINE 0' + L.n;

      var st = document.createElement('span');
      st.className = 'line-status';
      st.textContent = L.state === 'idle' ? 'OPEN' : L.state.toUpperCase();

      var caller = document.createElement('span');
      caller.className = 'line-caller';
      caller.textContent = L.caller ? '“' + L.caller + '”' + (L.opId ? ' ⇄ ' + opName(L.opId) : '') : '— line quiet —';

      var btns = document.createElement('span');
      btns.className = 'line-btns';
      if (L.state === 'active' || L.state === 'hold') {
        var hb = document.createElement('button');
        hb.className = 'mini-btn' + (L.state === 'hold' ? ' hold-on' : '');
        hb.textContent = L.state === 'hold' ? 'RESUME' : 'HOLD';
        hb.setAttribute('aria-label', (L.state === 'hold' ? 'Resume' : 'Hold') + ' line ' + L.n);
        hb.addEventListener('click', function (ev) { ev.stopPropagation(); toggleHold(L); });
        var db = document.createElement('button');
        db.className = 'mini-btn';
        db.textContent = 'DROP';
        db.setAttribute('aria-label', 'Drop call on line ' + L.n);
        db.addEventListener('click', function (ev) { ev.stopPropagation(); dropCall(L, 'completed'); });
        btns.appendChild(hb);
        btns.appendChild(db);
      }

      li.appendChild(lamp);
      li.appendChild(name);
      li.appendChild(st);
      li.appendChild(caller);
      li.appendChild(btns);

      li.addEventListener('click', function () { tapLine(L); });
      li.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tapLine(L); }
      });
      lineList.appendChild(li);
    });
  }

  function tapLine(L) {
    if (L.state === 'ringing') {
      selectedLine = L.n;
      hint.textContent = 'LINE 0' + L.n + ' SELECTED — TAP A FREE MOTH JACK';
      hint.className = 'patch-hint urgent';
      sndHold();
      renderLines();
    } else if (L.state === 'idle') {
      selectedLine = null;
      hint.textContent = 'LINE 0' + L.n + ' IS QUIET — NOTHING TO PATCH';
      hint.className = 'patch-hint';
      renderLines();
    } else {
      selectedLine = null;
      hint.textContent = 'LINE 0' + L.n + ' ⇄ ' + opName(L.opId) + ' — PATCHED, TALKING';
      hint.className = 'patch-hint';
      renderLines();
    }
  }

  function toggleHold(L) {
    if (L.state === 'active') {
      L.state = 'hold';
      L.holdSince = Date.now();
      sndHold();
      addLog('LINE 0' + L.n + ' on hold — moth hums.', false);
    } else if (L.state === 'hold') {
      L.state = 'active';
      L.holdAcc += Date.now() - L.holdSince;
      sndSnap();
      addLog('LINE 0' + L.n + ' resumed.', false);
    }
    renderLines();
    drawCords();
  }

  function fmtDur(ms) {
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }

  function dropCall(L, why) {
    if (L.state !== 'active' && L.state !== 'hold') return;
    var durMs = Date.now() - L.since - (L.holdAcc + (L.state === 'hold' ? Date.now() - L.holdSince : 0));
    talkSecs += Math.max(0, Math.round(durMs / 1000));
    addLog('LINE 0' + L.n + ' ⇄ ' + opName(L.opId) + ' ' + why + ' (' + fmtDur(durMs) + ') — “' + L.caller + '”', false);
    sndDrop();
    freeOperator(L.opId);
    L.state = 'idle'; L.caller = ''; L.opId = null; L.since = 0; L.holdAcc = 0;
    selectedLine = null;
    hint.textContent = 'CALL ENDED — BOARD IDLE';
    hint.className = 'patch-hint';
    updateStats();
    renderLines();
    renderJacks();
    drawCords();
  }

  /* ---------- jacks / moth plugs ---------- */
  var busyOps = {}; // opId -> lineN

  function freeOperator(opId) { delete busyOps[opId]; }

  function renderJacks() {
    jackList.innerHTML = '';
    OPERATORS.forEach(function (op, i) {
      var row = document.createElement('li');
      var busy = !!busyOps[op.id];
      row.className = 'jack-row' + (busy ? ' busy' : '');
      row.style.marginLeft = (i * 20) + 'px'; // diagonal cascade

      var moth = document.createElement('span');
      moth.className = 'moth';
      moth.setAttribute('aria-hidden', 'true');
      moth.innerHTML = '<span class="wing l"></span><span class="wing r"></span><span class="body"></span><span class="eye"></span>';

      var btn = document.createElement('button');
      btn.className = 'jack-btn' + (busy ? ' busy' : '');
      btn.setAttribute('aria-label', 'Moth jack ' + op.name + (busy ? ', busy on line ' + busyOps[op.id] : ', free'));
      btn.dataset.op = op.id;
      btn.addEventListener('click', function () { tapJack(op); });

      var meta = document.createElement('span');
      meta.className = 'jack-meta';
      var b = document.createElement('b');
      b.textContent = op.name + ' · ' + op.id;
      var s = document.createElement('span');
      s.textContent = busy ? 'patched ⇄ LINE 0' + busyOps[op.id] : op.note + ' — free';
      meta.appendChild(b);
      meta.appendChild(s);

      row.appendChild(moth);
      row.appendChild(btn);
      row.appendChild(meta);
      jackList.appendChild(row);
    });
    requestAnimationFrame(drawCords);
  }

  function tapJack(op) {
    if (busyOps[op.id]) {
      var L = LINES.filter(function (x) { return x.n === busyOps[op.id]; })[0];
      hint.textContent = op.name + ' IS BUSY — LINE 0' + busyOps[op.id] + (L && L.state === 'hold' ? ' (ON HOLD)' : ' TALKING');
      hint.className = 'patch-hint';
      return;
    }
    var line = LINES.filter(function (x) { return x.n === selectedLine && x.state === 'ringing'; })[0];
    if (!line) {
      hint.textContent = 'SELECT A RINGING LINE FIRST, THEN TAP ' + op.name;
      hint.className = 'patch-hint urgent';
      return;
    }
    // patch!
    busyOps[op.id] = line.n;
    line.state = 'active';
    line.opId = op.id;
    line.since = Date.now();
    line.holdAcc = 0;
    selectedLine = null;
    patchedTotal++;
    sndSnap();
    addLog('LINE 0' + line.n + ' patched ⇄ ' + op.name + ' — “' + line.caller + '”', false);
    hint.textContent = 'PATCHED: LINE 0' + line.n + ' ⇄ ' + op.name;
    hint.className = 'patch-hint';
    updateStats();
    renderLines();
    renderJacks();
  }

  /* ---------- cords (svg curves jack → line card) ---------- */
  function drawCords() {
    var bRect = board.getBoundingClientRect();
    cords.setAttribute('viewBox', '0 0 ' + bRect.width + ' ' + bRect.height);
    cords.innerHTML = '';
    Object.keys(busyOps).forEach(function (opId) {
      var lineN = busyOps[opId];
      var jack = jackList.querySelector('[data-op="' + opId + '"]');
      var card = lineList.children[lineN - 1];
      if (!jack || !card) return;
      var j = jack.getBoundingClientRect();
      // cord runs from jack leftwards to the board edge (toward the lines rail)
      var x1 = j.left + j.width / 2 - bRect.left;
      var y1 = j.top + j.height / 2 - bRect.top;
      var x2 = 6;
      var y2 = Math.max(30, y1 - 60 - lineN * 14);
      var L = LINES[lineN - 1];
      var color = L && L.state === 'hold' ? '#FFB454' : '#29E0D8';
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var mx = (x1 + x2) / 2;
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + x2 + ' ' + y2);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('opacity', '0.9');
      cords.appendChild(path);
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x2);
      dot.setAttribute('cy', y2);
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', color);
      cords.appendChild(dot);
    });
  }
  window.addEventListener('resize', drawCords);

  /* ---------- ring simulation ---------- */
  function freeIdle() { return LINES.filter(function (L) { return L.state === 'idle'; }); }
  function anyRinging() { return LINES.some(function (L) { return L.state === 'ringing'; }); }

  function ringOne() {
    var idle = freeIdle();
    if (!idle.length) return;
    var L = idle[Math.floor(Math.random() * idle.length)];
    L.state = 'ringing';
    L.caller = CALLERS[Math.floor(Math.random() * CALLERS.length)];
    L.ringAt = Date.now();
    sndRing();
    hint.textContent = 'INCOMING — LINE 0' + L.n + ' RINGING. TAP IT, THEN A FREE JACK.';
    hint.className = 'patch-hint urgent';
    renderLines();
    // missed call if ignored ~25s
    setTimeout(function () {
      if (L.state === 'ringing') {
        addLog('LINE 0' + L.n + ' missed — “' + L.caller + '” hung up.', false);
        L.state = 'idle'; L.caller = '';
        if (selectedLine === L.n) selectedLine = null;
        renderLines();
      }
    }, 25000);
  }

  function simLoop() {
    if (!anyRinging() && Math.random() < 0.75) ringOne();
    else if (freeIdle().length && Math.random() < 0.3) ringOne();
    setTimeout(simLoop, 5000 + Math.random() * 6000);
  }

  // auto-drop very long calls so the board keeps breathing
  setInterval(function () {
    var now = Date.now();
    LINES.forEach(function (L) {
      if (L.state === 'active' && now - L.since > 120000) dropCall(L, 'timed out');
    });
    // live talk clock
    var live = 0;
    LINES.forEach(function (L) {
      if (L.state === 'active') live += Math.floor((now - L.since) / 1000);
    });
    statTalk.textContent = Math.floor((talkSecs + live) / 60) + 'm';
  }, 5000);

  /* ---------- stats / clock / mute ---------- */
  function updateStats() { statPatched.textContent = patchedTotal; }
  setInterval(function () {
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    clockEl.textContent = p(d.getHours()) + ':' + p(d.getMinutes());
  }, 1000);

  function renderMute() {
    muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
  muteBtn.addEventListener('click', function () {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    renderMute();
  });

  /* ---------- canvas scene: amber sun + cyan grid ---------- */
  var canvas = $('scene'), ctx = canvas.getContext('2d');
  function sizeCanvas() {
    var r = board.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', function () { sizeCanvas(); drawCords(); });

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t0 = Date.now();
  function scene() {
    var W = canvas.width / Math.min(2, window.devicePixelRatio || 1);
    var H = canvas.height / Math.min(2, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, W, H);
    var t = reduceMotion ? 0 : (Date.now() - t0) / 1000;
    // sun
    var sx = W * 0.62, sy = H * 0.34, sr = Math.min(W, H) * 0.2;
    var grad = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    grad.addColorStop(0, '#FFB454');
    grad.addColorStop(1, '#FF3D6E');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(sx - sr, sy, sr * 2, sr * 0.28);
    // scanline slits
    ctx.fillStyle = '#0D0B08';
    for (var i = 0; i < 5; i++) {
      var yy = sy + 6 + i * (sr * 0.16);
      ctx.fillRect(sx - sr - 2, yy, sr * 2 + 4, 2 + i);
    }
    // perspective grid
    ctx.strokeStyle = '#29E0D8';
    ctx.lineWidth = 1;
    var horizon = sy + sr * 0.34;
    for (var g = 0; g <= 12; g++) {
      var gx = (W / 12) * g;
      ctx.beginPath();
      ctx.moveTo(W / 2 + (gx - W / 2) * 0.15, horizon);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    var off = reduceMotion ? 0 : (t * 26) % 26;
    for (var yy2 = horizon; yy2 < H + 26; yy2 += 26) {
      ctx.beginPath();
      ctx.moveTo(0, yy2 - off);
      ctx.lineTo(W, yy2 - off);
      ctx.stroke();
    }
    if (!reduceMotion) requestAnimationFrame(scene);
  }

  /* ---------- easter egg: the dead jack ---------- */
  var deadClicks = 0, deadTimer = null;
  $('deadJack').addEventListener('click', function () {
    deadClicks++;
    tone(1200 + deadClicks * 200, 0, 0.1, 'sine', 0.08);
    clearTimeout(deadTimer);
    deadTimer = setTimeout(function () { deadClicks = 0; }, 1600);
    if (deadClicks >= 3) {
      deadClicks = 0;
      mothSwarm();
    }
  });

  function mothSwarm() {
    try { localStorage.setItem(FLAG_KEY, '1'); } catch (e) {}
    var title = document.querySelector('.rail-title');
    title.textContent = 'MOTHS TAKE THE SHIFT';
    title.classList.add('flicker');
    setTimeout(function () {
      title.innerHTML = 'FLINT&nbsp;MOTH';
      title.classList.remove('flicker');
    }, 8000);
    addLog('23:57 OPERATOR ACK — the moths take the shift.', true);
    tone(523, 0, 0.15, 'triangle', 0.1);
    tone(659, 0.15, 0.15, 'triangle', 0.1);
    tone(784, 0.3, 0.3, 'triangle', 0.1);
    var bRect = board.getBoundingClientRect();
    var cx = bRect.width * 0.62, cy = bRect.height * 0.34;
    for (var i = 0; i < 6; i++) {
      (function (i) {
        var m = document.createElement('div');
        m.className = 'swarm-moth';
        m.innerHTML = '<span class="wing l"></span><span class="wing r"></span>';
        board.appendChild(m);
        var start = Date.now();
        (function orbit() {
          var el = (Date.now() - start) / 8000; // 8s
          if (el >= 1) { m.remove(); return; }
          var a = el * Math.PI * 4 + (i * Math.PI / 3);
          var r = 40 + i * 16;
          m.style.left = (cx + Math.cos(a) * r - 20) + 'px';
          m.style.top = (cy + Math.sin(a) * r * 0.6 - 13) + 'px';
          requestAnimationFrame(orbit);
        })();
      })(i);
    }
  }

  /* ---------- init ---------- */
  renderMute();
  renderLog();
  renderLines();
  renderJacks();
  sizeCanvas();
  scene();
  updateStats();
  addLog('night shift begins. six moths on duty.', true);
  try {
    if (localStorage.getItem(FLAG_KEY) === '1') {
      document.body.classList.add('greet'); // veteran moths flap once
      setTimeout(function () { document.body.classList.remove('greet'); }, 1200);
    }
  } catch (e) {}
  setTimeout(ringOne, 1800);
  setTimeout(simLoop, 7000);
})();
