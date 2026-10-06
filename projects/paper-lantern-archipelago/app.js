// Paper Lantern Archipelago — pop-art 30-second sailing sprint.
// Features: procedural island grid / lantern trade routes / tide-shifted navigation / hand-drawn fog reveal.
(function () {
  'use strict';

  var N = 6, SIZE = 600, CELL = SIZE / N;
  var ROUND_TIME = 45;          // seconds of tide-clock per round (winnable in <30s)
  var TIDE_LEN = 9;             // seconds per tide phase
  var TIDES = ['LOW', 'RISING', 'HIGH', 'EBB'];
  var TIDE_COLORS = { LOW: '#ff9d00', RISING: '#00d4ff', HIGH: '#00e676', EBB: '#c26bff' };

  var map = document.getElementById('map');
  var fogC = document.getElementById('fog');
  var mctx = map.getContext('2d');
  var fctx = fogC.getContext('2d');
  var clockEl = document.getElementById('clock');
  var clockFill = document.getElementById('clockFill');
  var tideName = document.getElementById('tideName');
  var tideFill = document.getElementById('tideFill');
  var chipRoutes = document.getElementById('chipRoutes');
  var chipChart = document.getElementById('chipChart');
  var chipBest = document.getElementById('chipBest');
  var overlay = document.getElementById('overlay');
  var overlayKicker = document.getElementById('overlayKicker');
  var overlayTitle = document.getElementById('overlayTitle');
  var overlayText = document.getElementById('overlayText');
  var againBtn = document.getElementById('againBtn');
  var newBtn = document.getElementById('newBtn');
  var soundBtn = document.getElementById('soundBtn');
  var burst = document.getElementById('burst');
  var toastEl = document.getElementById('toast');

  // ---------- tiny utils ----------
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function cellXY(c) { return { x: (c % N) * CELL + CELL / 2, y: Math.floor(c / N) * CELL + CELL / 2 }; }
  function neighbors(c) {
    var x = c % N, y = Math.floor(c / N), out = [];
    if (x > 0) out.push(c - 1);
    if (x < N - 1) out.push(c + 1);
    if (y > 0) out.push(c - N);
    if (y < N - 1) out.push(c + N);
    return out;
  }
  function manhattan(a, b) {
    return Math.abs((a % N) - (b % N)) + Math.abs(Math.floor(a / N) - Math.floor(b / N));
  }

  // ---------- sound (tiny webaudio blips, no assets) ----------
  var soundOn = true, actx = null;
  function beep(freq, dur, type, vol) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* audio unavailable — stay silent */ }
  }
  function sfx(name) {
    if (name === 'sail') beep(330, 0.12, 'triangle', 0.08);
    else if (name === 'lit') { beep(523, 0.12, 'square', 0.07); setTimeout(function () { beep(784, 0.18, 'square', 0.07); }, 110); }
    else if (name === 'tide') beep(196, 0.25, 'sine', 0.09);
    else if (name === 'bump') beep(120, 0.15, 'sawtooth', 0.06);
    else if (name === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.2, 'square', 0.07); }, i * 120); }); }
    else if (name === 'lose') { [400, 300, 200].forEach(function (f, i) { setTimeout(function () { beep(f, 0.2, 'sawtooth', 0.06); }, i * 140); }); }
  }

  // ---------- toast + burst ----------
  var toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }
  function pow(text) {
    burst.textContent = text;
    burst.classList.remove('pop');
    void burst.offsetWidth;
    burst.classList.add('pop');
  }

  // ---------- game state ----------
  var G = null;
  function best() {
    try { return JSON.parse(localStorage.getItem('pla-best') || 'null'); }
    catch (e) { return null; }
  }
  function saveBest(b) {
    try { localStorage.setItem('pla-best', JSON.stringify(b)); } catch (e) {}
  }
  function refreshBestChip() {
    var b = best();
    chipBest.textContent = b ? ('⭐ best ' + b.time + 's') : '⭐ best —';
  }

  function genGrid(seed) {
    var rnd = mulberry(seed);
    var cells = [];
    for (var i = 0; i < N * N; i++) {
      var r = rnd();
      // reef (never passable) ~10%, shoal (tide-gated) ~22%, else open/isle
      var kind = r < 0.10 ? 'reef' : (r < 0.32 ? 'shoal' : 'isle');
      cells.push({ kind: kind, trade: null, lit: false, seen: false, wob: [] });
    }
    // home: random non-reef cell near a corner-ish region
    var home = -1, guard = 0;
    while (home < 0 && guard++ < 500) {
      var c = Math.floor(rnd() * N * N);
      if (cells[c].kind !== 'reef') home = c;
    }
    cells[home].kind = 'isle'; cells[home].home = true;
    // 3 trade islands, spread out (far from home & each other)
    var trades = [];
    guard = 0;
    var colors = ['#ff2e88', '#00d4ff', '#ffd500'];
    while (trades.length < 3 && guard++ < 2000) {
      var t = Math.floor(rnd() * N * N);
      if (t === home || cells[t].kind === 'reef' || cells[t].trade) continue;
      if (manhattan(t, home) < 3) continue;
      var ok = trades.every(function (o) { return manhattan(t, o) >= 3; });
      if (!ok) continue;
      trades.push(t);
      cells[t].kind = 'isle';
      cells[t].trade = { color: colors[trades.length - 1], name: ['ROSE', 'AZURE', 'GOLD'][trades.length - 1] };
    }
    // fallback if spread failed (tiny chance): relax distance
    guard = 0;
    while (trades.length < 3 && guard++ < 500) {
      var t2 = Math.floor(rnd() * N * N);
      if (t2 === home || cells[t2].kind === 'reef' || cells[t2].trade) continue;
      trades.push(t2); cells[t2].kind = 'isle';
      cells[t2].trade = { color: colors[trades.length - 1], name: ['ROSE', 'AZURE', 'GOLD'][trades.length - 1] };
    }
    // hand-drawn wobble per island (stable for the round)
    cells.forEach(function (cell) {
      for (var k = 0; k < 10; k++) cell.wob.push(0.82 + rnd() * 0.36);
    });
    return { cells: cells, home: home, trades: trades };
  }

  function newGame() {
    var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    var g = genGrid(seed);
    G = {
      cells: g.cells, home: g.home, trades: g.trades,
      boat: g.home, lit: 0, timeLeft: ROUND_TIME,
      tideIdx: 1, tideT: 0, // start RISING
      over: false, won: false, elapsed: 0,
      wake: [], // trail sparkles
      shake: 0
    };
    revealAround(G.boat);
    overlay.classList.add('hidden');
    refreshBestChip();
    updateHUD();
    toast('🌊 Tide is RISING — shoals are open! Sail!');
  }

  function tide() { return TIDES[G.tideIdx]; }
  function shoalOpen() { return tide() === 'HIGH' || tide() === 'RISING'; }

  function passable(c) {
    var cell = G.cells[c];
    if (cell.kind === 'reef') return false;
    if (cell.kind === 'shoal' && !shoalOpen()) return false;
    return true;
  }
  function reachable() {
    return neighbors(G.boat).filter(passable);
  }

  function revealAround(c) {
    var r = 1; // chebyshev radius
    var cx = c % N, cy = Math.floor(c / N);
    for (var i = 0; i < N * N; i++) {
      var ix = i % N, iy = Math.floor(i / N);
      if (Math.max(Math.abs(ix - cx), Math.abs(iy - cy)) <= r) G.cells[i].seen = true;
    }
  }

  function chartPct() {
    var s = G.cells.filter(function (c) { return c.seen; }).length;
    return Math.round((s / (N * N)) * 100);
  }

  function sailTo(c) {
    if (!G || G.over) return;
    if (c === G.boat) return;
    if (neighbors(G.boat).indexOf(c) < 0) { return; } // only orthogonal steps
    var cell = G.cells[c];
    if (cell.kind === 'reef') { toast('🪨 Reef! No passage.'); sfx('bump'); G.shake = 6; return; }
    if (cell.kind === 'shoal' && !shoalOpen()) {
      toast('🏜 Shoal dry at ' + tide() + ' tide — wait for RISING!');
      sfx('bump'); G.shake = 6; return;
    }
    G.boat = c;
    G.wake.push({ c: c, a: 1 });
    revealAround(c);
    sfx('sail');
    if (cell.trade && !cell.lit) {
      cell.lit = true; G.lit++;
      pow('LIT!');
      sfx('lit');
      toast('🏮 ' + cell.trade.name + ' lantern lit! (' + G.lit + '/3)');
      if (G.lit >= 3) endGame(true);
    }
    updateHUD();
  }

  function endGame(won) {
    G.over = true; G.won = won;
    var used = Math.round(G.elapsed);
    if (won) {
      sfx('win'); pow('ZAP! POW!');
      var b = best();
      var isBest = !b || used < b.time;
      if (isBest) saveBest({ time: used, date: Date.now() });
      overlayKicker.textContent = '★ CHART COMPLETE ★';
      overlayTitle.textContent = 'ALL LANTERNS LIT!';
      overlayText.textContent = 'Finished in ' + used + 's with ' + chartPct() + '% charted.' +
        (isBest ? ' NEW BEST! 🏆' : '');
    } else {
      sfx('lose');
      overlayKicker.textContent = '★ TIDE WINS ★';
      overlayTitle.textContent = 'ROUTES ERASED…';
      overlayText.textContent = 'You lit ' + G.lit + '/3 lanterns and charted ' + chartPct() + '%. Sail again!';
    }
    setTimeout(function () { overlay.classList.remove('hidden'); refreshBestChip(); }, won ? 700 : 400);
    updateHUD();
  }

  function updateHUD() {
    if (!G) return;
    clockEl.textContent = Math.ceil(G.timeLeft);
    clockFill.style.width = (100 * G.timeLeft / ROUND_TIME) + '%';
    tideName.textContent = tide();
    tideFill.style.width = (100 * (1 - G.tideT / TIDE_LEN)) + '%';
    tideName.style.color = TIDE_COLORS[tide()];
    chipRoutes.textContent = '🏮 ' + G.lit + '/3 lit';
    chipChart.textContent = '🗺 ' + chartPct() + '% charted';
  }

  // ---------- drawing ----------
  function blobPath(ctx, cx, cy, rad, wob, rot) {
    ctx.beginPath();
    for (var k = 0; k <= 10; k++) {
      var a = rot + (k / 10) * Math.PI * 2;
      var rr = rad * wob[k % 10];
      var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.86;
      if (k === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(
        cx + Math.cos(a - 0.31) * rr * 1.06, cy + Math.sin(a - 0.31) * rr * 0.92, px, py);
    }
    ctx.closePath();
  }

  function drawMap(t) {
    var sx = G && G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    var sy = G && G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    mctx.save();
    mctx.clearRect(0, 0, SIZE, SIZE);
    mctx.translate(sx, sy);

    // sea: deep gradient + animated wave dashes
    var grad = mctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, '#1b2a6b'); grad.addColorStop(1, '#0d1440');
    mctx.fillStyle = grad;
    mctx.fillRect(-10, -10, SIZE + 20, SIZE + 20);
    mctx.strokeStyle = 'rgba(0,212,255,.25)';
    mctx.lineWidth = 2;
    mctx.setLineDash([10, 14]);
    mctx.lineDashOffset = -t * 30;
    for (var w = 0; w < 7; w++) {
      mctx.beginPath();
      mctx.moveTo(-10, w * 90 + 40);
      mctx.lineTo(SIZE + 10, w * 90 + 40);
      mctx.stroke();
    }
    mctx.setLineDash([]);

    // grid dots (pop-art chart feel)
    mctx.fillStyle = 'rgba(255,255,255,.14)';
    for (var gx = 0; gx <= N; gx++) for (var gy = 0; gy <= N; gy++) {
      mctx.beginPath(); mctx.arc(gx * CELL, gy * CELL, 2, 0, 7); mctx.fill();
    }

    if (!G) { mctx.restore(); return; }

    // lantern trade routes: glowing curves home -> each lit trade isle
    G.trades.forEach(function (tc) {
      var cell = G.cells[tc];
      if (!cell.lit) return;
      var a = cellXY(G.home), b = cellXY(tc);
      var mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.18;
      var my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
      mctx.save();
      mctx.shadowColor = cell.trade.color; mctx.shadowBlur = 18;
      mctx.strokeStyle = cell.trade.color; mctx.lineWidth = 6; mctx.lineCap = 'round';
      mctx.setLineDash([14, 10]); mctx.lineDashOffset = -t * 60;
      mctx.beginPath(); mctx.moveTo(a.x, a.y);
      mctx.quadraticCurveTo(mx, my, b.x, b.y); mctx.stroke();
      mctx.restore();
    });

    // cells
    for (var i = 0; i < N * N; i++) {
      var cell2 = G.cells[i];
      var p = cellXY(i);
      var bob = Math.sin(t * 2 + i * 1.7) * 2.5;
      if (cell2.kind === 'reef') {
        // jagged reef: dark triangles with white caps
        mctx.save();
        mctx.fillStyle = '#0a0d26';
        mctx.strokeStyle = '#ff1744'; mctx.lineWidth = 3;
        mctx.beginPath();
        mctx.moveTo(p.x - 26, p.y + 16); mctx.lineTo(p.x - 8, p.y - 20);
        mctx.lineTo(p.x + 6, p.y + 8); mctx.lineTo(p.x + 24, p.y - 14);
        mctx.lineTo(p.x + 28, p.y + 18); mctx.lineTo(p.x - 26, p.y + 18);
        mctx.closePath(); mctx.fill(); mctx.stroke();
        mctx.fillStyle = '#fff'; mctx.font = 'bold 20px sans-serif';
        mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
        mctx.fillText('✕', p.x, p.y + 2);
        mctx.restore();
        continue;
      }
      if (cell2.kind === 'shoal') {
        // pale dotted shoal; pulses when open
        var open = shoalOpen();
        mctx.save();
        mctx.globalAlpha = open ? 1 : 0.45;
        blobPath(mctx, p.x, p.y + bob, 30, cell2.wob, i);
        mctx.fillStyle = open ? '#ffe9a8' : '#8a7f5c';
        mctx.fill();
        mctx.lineWidth = 3; mctx.strokeStyle = '#14101f';
        mctx.setLineDash([7, 5]); mctx.stroke(); mctx.setLineDash([]);
        mctx.fillStyle = 'rgba(20,16,31,.5)';
        for (var d = -1; d <= 1; d++) for (var e = -1; e <= 1; e++) {
          mctx.beginPath(); mctx.arc(p.x + d * 12, p.y + bob + e * 10, 2.4, 0, 7); mctx.fill();
        }
        mctx.restore();
        continue;
      }
      // isle
      var isHome = !!cell2.home;
      var isTrade = !!cell2.trade;
      var base = isHome ? '#ffd500' : (isTrade ? '#ffffff' : '#7bf59b');
      blobPath(mctx, p.x, p.y + bob, isHome || isTrade ? 40 : 33, cell2.wob, i * 0.7);
      mctx.save();
      mctx.shadowColor = 'rgba(0,0,0,.45)'; mctx.shadowBlur = 0; mctx.shadowOffsetY = 4;
      mctx.fillStyle = base; mctx.fill();
      mctx.restore();
      mctx.lineWidth = 4; mctx.strokeStyle = '#14101f'; mctx.stroke();
      // halftone dots on isle
      mctx.save();
      mctx.clip();
      mctx.fillStyle = 'rgba(255,46,136,.20)';
      for (var hx = -3; hx <= 3; hx++) for (var hy = -2; hy <= 2; hy++) {
        mctx.beginPath(); mctx.arc(p.x + hx * 11, p.y + bob + hy * 11, 2.2, 0, 7); mctx.fill();
      }
      mctx.restore();
      if (isHome) {
        mctx.font = '30px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
        mctx.fillText('🏮', p.x, p.y + bob + 1);
        mctx.font = 'bold 11px sans-serif';
        mctx.fillStyle = '#14101f';
        mctx.fillText('HOME', p.x, p.y + bob + 30);
      } else if (isTrade) {
        var glow = cell2.lit ? 1 : (0.55 + 0.45 * Math.sin(t * 4 + i));
        mctx.save();
        mctx.globalAlpha = glow;
        mctx.shadowColor = cell2.trade.color; mctx.shadowBlur = cell2.lit ? 26 : 14;
        mctx.font = '30px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
        mctx.fillText(cell2.lit ? '💡' : '🏮', p.x, p.y + bob + 1);
        mctx.restore();
        mctx.font = 'bold 11px sans-serif';
        mctx.fillStyle = cell2.lit ? '#0a7a3d' : '#14101f';
        mctx.textAlign = 'center';
        mctx.fillText(cell2.lit ? '✓ LIT' : cell2.trade.name, p.x, p.y + bob + 30);
      } else {
        mctx.font = '20px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
        mctx.fillText('🌴', p.x, p.y + bob + 1);
      }
    }

    // reachable highlights
    if (!G.over) {
      var reach = reachable();
      reach.forEach(function (c, k) {
        var q = cellXY(c);
        var pulse = 3 + Math.sin(t * 5 + k) * 1.5;
        mctx.save();
        mctx.strokeStyle = '#ffd500'; mctx.lineWidth = 3 + pulse;
        mctx.shadowColor = '#ffd500'; mctx.shadowBlur = 16;
        mctx.globalAlpha = 0.9;
        mctx.strokeRect(q.x - CELL / 2 + 8, q.y - CELL / 2 + 8, CELL - 16, CELL - 16);
        mctx.restore();
      });
    }

    // wake sparkles
    G.wake = G.wake.filter(function (wk) { return wk.a > 0; });
    G.wake.forEach(function (wk) {
      var q2 = cellXY(wk.c);
      mctx.save(); mctx.globalAlpha = wk.a * 0.8;
      mctx.fillStyle = '#fff';
      mctx.font = '16px sans-serif'; mctx.textAlign = 'center';
      mctx.fillText('✦', q2.x + 18, q2.y - 18);
      mctx.restore();
      wk.a -= 0.03;
    });

    // boat on current cell
    var bp = cellXY(G.boat);
    var bb = Math.sin(t * 3) * 3;
    mctx.save();
    mctx.font = '34px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.shadowColor = '#000'; mctx.shadowBlur = 10;
    mctx.fillText('⛵', bp.x, bp.y + bb - 24);
    // thick ring marks the boat
    mctx.shadowBlur = 0;
    mctx.strokeStyle = '#14101f'; mctx.lineWidth = 4;
    mctx.beginPath(); mctx.arc(bp.x, bp.y + bb, 44, 0, 7); mctx.stroke();
    mctx.strokeStyle = '#ffd500'; mctx.lineWidth = 2.5;
    mctx.beginPath(); mctx.arc(bp.x, bp.y + bb, 44, 0, 7); mctx.stroke();
    mctx.restore();

    // tide banner tint at LOW (danger) / HIGH (opportunity)
    if (tide() === 'LOW') {
      mctx.fillStyle = 'rgba(255,23,68,.08)';
      mctx.fillRect(0, 0, SIZE, SIZE);
    }
    mctx.restore();
  }

  // hand-drawn fog: dark cover with wobbly punched holes over seen cells
  function drawFog() {
    fctx.clearRect(0, 0, SIZE, SIZE);
    if (!G) return;
    fctx.save();
    fctx.fillStyle = 'rgba(16,12,34,.88)';
    fctx.fillRect(0, 0, SIZE, SIZE);
    // paper-grain speckles
    fctx.fillStyle = 'rgba(255,255,255,.06)';
    var rnd = mulberry(1234);
    for (var s = 0; s < 120; s++) {
      fctx.fillRect(rnd() * SIZE, rnd() * SIZE, 2, 2);
    }
    // punch revealed holes
    fctx.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < N * N; i++) {
      if (!G.cells[i].seen) continue;
      var p = cellXY(i);
      var g = fctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, CELL * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.75, 'rgba(0,0,0,.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = g;
      fctx.beginPath(); fctx.arc(p.x, p.y, CELL * 0.95, 0, 7); fctx.fill();
      // wobbly hand-drawn rim: erase extra jags so edges look sketched
      fctx.strokeStyle = 'rgba(0,0,0,.9)';
      fctx.lineWidth = 9; fctx.lineCap = 'round';
      fctx.beginPath();
      for (var k = 0; k <= 12; k++) {
        var a = (k / 12) * Math.PI * 2;
        var rr = CELL * 0.88 * G.cells[i].wob[k % 10];
        var px = p.x + Math.cos(a) * rr, py = p.y + Math.sin(a) * rr;
        if (k === 0) fctx.moveTo(px, py);
        else fctx.quadraticCurveTo(
          p.x + Math.cos(a - 0.26) * rr * 1.08, p.y + Math.sin(a - 0.26) * rr * 1.08, px, py);
      }
      fctx.closePath(); fctx.stroke();
    }
    fctx.restore();
    fctx.globalCompositeOperation = 'source-over';
    // sketchy fog label on unseen corners
    fctx.save();
    fctx.fillStyle = 'rgba(255,246,233,.75)';
    fctx.font = 'bold 15px sans-serif'; fctx.textAlign = 'center';
    if (chartPct() < 100) fctx.fillText('✎ uncharted waters…', SIZE / 2, 22);
    fctx.restore();
  }

  // ---------- loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (G && !G.over) {
      var t = now / 1000;
      G.elapsed += dt;
      G.timeLeft -= dt;
      G.tideT += dt;
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
      if (G.tideT >= TIDE_LEN) {
        G.tideT = 0;
        G.tideIdx = (G.tideIdx + 1) % TIDES.length;
        sfx('tide');
        var td = tide();
        if (td === 'HIGH') { toast('🌊 HIGH tide — shoals OPEN! Shortcuts!'); pow('SPLASH!'); }
        else if (td === 'LOW') { toast('🏜 LOW tide — shoals CLOSED!'); pow('DRY!'); }
        else toast('🌊 Tide: ' + td);
      }
      if (G.timeLeft <= 0) { G.timeLeft = 0; endGame(G.lit >= 3); }
      if (Math.floor(now / 300) !== Math.floor((now - dt * 1000) / 300)) updateHUD();
      drawMap(t);
      drawFog();
    } else if (G && G.over) {
      drawMap(now / 1000);
      drawFog();
    }
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  function eventCell(ev) {
    var r = map.getBoundingClientRect();
    var cx = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    var cy = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY);
    var x = clamp(Math.floor(((cx - r.left) / r.width) * N), 0, N - 1);
    var y = clamp(Math.floor(((cy - r.top) / r.height) * N), 0, N - 1);
    return y * N + x;
  }
  map.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    sailTo(eventCell(ev));
  });
  document.addEventListener('keydown', function (ev) {
    if (!G || G.over) { if (ev.key === 'Enter' && !overlay.classList.contains('hidden')) { newGame(); } return; }
    var x = G.boat % N, y = Math.floor(G.boat / N);
    var k = ev.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') y--;
    else if (k === 'arrowdown' || k === 's') y++;
    else if (k === 'arrowleft' || k === 'a') x--;
    else if (k === 'arrowright' || k === 'd') x++;
    else return;
    ev.preventDefault();
    if (x < 0 || x >= N || y < 0 || y >= N) return;
    sailTo(y * N + x);
  });
  newBtn.addEventListener('click', function () { newGame(); });
  againBtn.addEventListener('click', function () { newGame(); });
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊 SOUND' : '🔇 MUTED';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  });

  refreshBestChip();
  newGame();
  requestAnimationFrame(frame);
})();
