/* Emberline Islet Cartography — 浮島海図
   Paintable hex islands · beacon claims · auto-routed trade winds · postcard export.
   Plain script (no modules) so it works from file:// and any static host.
   Palette: ember #ff4d2e, lagoon #27e6c4, gold #ffb627 + black #0a0a12 & white #f7f2e7.
*/
(function () {
  'use strict';

  var COLS = 13, ROWS = 9, MAX_BEACONS = 6, CLAIM_R = 2, LS_KEY = 'emberline-islet-v1';
  var EMBER = '#ff4d2e', LAGOON = '#27e6c4', GOLD = '#ffb627';
  var INK = '#0a0a12', PAPER = '#f7f2e7';
  var SQ3 = Math.sqrt(3);

  var canvas = document.getElementById('sea');
  var ctx = canvas.getContext('2d');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  var state = { terrain: new Array(COLS * ROWS).fill(0), beacons: [], captain: '' };
  var claimed = {};   // idx -> true
  var routes = [];    // array of paths, each path = [{c,r},...]
  var brush = 'island';
  var hover = null;
  var painting = false;
  var size = 20, pad = 14, W = 300, H = 200, DPR = 1;

  var KANJI = ['浮', '灯', '潮', '風', '波', '島', '渚', '蛍'];
  var ADJ = ['Neon', 'Ember', 'Paper', 'Lantern', 'Koi', 'Foam', 'Torii', 'Drift', 'Hazy', 'Static'];
  var NOUN = ['Reach', 'Shallows', 'Circuit', 'Islets', 'Crossing', 'Wake', 'Belt', 'Mirage'];

  function idx(c, r) { return r * COLS + c; }
  function inBounds(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }

  // odd-r offset neighbours
  var EVEN_D = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  var ODD_D = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
  function neighbours(c, r) {
    var d = (r & 1) ? ODD_D : EVEN_D, out = [];
    for (var i = 0; i < 6; i++) {
      var nc = c + d[i][0], nr = r + d[i][1];
      if (inBounds(nc, nr)) out.push({ c: nc, r: nr });
    }
    return out;
  }
  // odd-r -> axial for hex distance
  function axial(c, r) { return { q: c - ((r - (r & 1)) >> 1), s: r }; }
  function hexDist(a, b) {
    var A = axial(a.c, a.r), B = axial(b.c, b.r);
    var dq = A.q - B.q, dr = A.s - B.s;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) >> 1;
  }

  function center(c, r) {
    return {
      x: pad + SQ3 * size * (c + 0.5) + ((r & 1) ? SQ3 * size / 2 : 0),
      y: pad + size + 1.5 * size * r
    };
  }

  function hexPath(g, x, y, s) {
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 30);
      var px = x + s * Math.cos(a), py = y + s * Math.sin(a);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  /* ---------- map logic ---------- */

  function genIslands() {
    state.terrain = new Array(COLS * ROWS).fill(0);
    var blobs = 3 + Math.floor(Math.random() * 2);
    for (var b = 0; b < blobs; b++) {
      var c = 1 + Math.floor(Math.random() * (COLS - 2));
      var r = 1 + Math.floor(Math.random() * (ROWS - 2));
      var steps = 6 + Math.floor(Math.random() * 5);
      for (var s = 0; s < steps; s++) {
        if (inBounds(c, r)) state.terrain[idx(c, r)] = 1;
        var nb = neighbours(c, r);
        if (!nb.length) break;
        var n = nb[Math.floor(Math.random() * nb.length)];
        c = n.c; r = n.r;
      }
    }
    state.beacons = [];
    autoBeacons();
    recompute();
  }

  function autoBeacons() {
    // stake up to 2 beacons on the two largest landmasses so routes appear in <30s
    var seen = {}, masses = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (state.terrain[idx(c, r)] !== 1 || seen[idx(c, r)]) continue;
      var mass = [], stack = [{ c: c, r: r }];
      seen[idx(c, r)] = true;
      while (stack.length) {
        var t = stack.pop(); mass.push(t);
        var nb = neighbours(t.c, t.r);
        for (var i = 0; i < nb.length; i++) {
          var k = idx(nb[i].c, nb[i].r);
          if (state.terrain[k] === 1 && !seen[k]) { seen[k] = true; stack.push(nb[i]); }
        }
      }
      masses.push(mass);
    }
    masses.sort(function (a, b) { return b.length - a.length; });
    state.beacons = [];
    for (var m = 0; m < Math.min(2, masses.length); m++) {
      var pick = masses[m][Math.floor(masses[m].length / 2)];
      state.beacons.push({ c: pick.c, r: pick.r });
    }
  }

  function recompute() {
    claimed = {};
    for (var i = 0; i < state.beacons.length; i++) {
      var bc = state.beacons[i];
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (state.terrain[idx(c, r)] !== 1) continue;
        if (hexDist({ c: c, r: r }, bc) <= CLAIM_R) claimed[idx(c, r)] = true;
      }
    }
    routes = [];
    for (var b = 1; b < state.beacons.length; b++) {
      var p = findRoute(state.beacons[b - 1], state.beacons[b]);
      if (p) routes.push(p);
    }
    renderStats();
    save();
  }

  // Dijkstra: ships prefer open water (sea 1, land 4) so routes curl around isles
  function findRoute(a, b) {
    var key = function (c, r) { return r * COLS + c; };
    var dist = {}, prev = {}, visited = {};
    dist[key(a.c, a.r)] = 0;
    var open = [{ c: a.c, r: a.r, d: 0 }];
    while (open.length) {
      var bi = 0;
      for (var i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
      var cur = open.splice(bi, 1)[0];
      var k = key(cur.c, cur.r);
      if (visited[k]) continue;
      visited[k] = true;
      if (cur.c === b.c && cur.r === b.r) break;
      var nb = neighbours(cur.c, cur.r);
      for (var n = 0; n < nb.length; n++) {
        var nk = key(nb[n].c, nb[n].r);
        if (visited[nk]) continue;
        var w = state.terrain[nk] === 1 ? 4 : 1;
        var nd = cur.d + w;
        if (dist[nk] === undefined || nd < dist[nk]) {
          dist[nk] = nd; prev[nk] = k;
          open.push({ c: nb[n].c, r: nb[n].r, d: nd });
        }
      }
    }
    if (dist[key(b.c, b.r)] === undefined) return null;
    var path = [], ck = key(b.c, b.r);
    var guard = COLS * ROWS + 5;
    while (ck !== undefined && guard-- > 0) {
      path.unshift({ c: ck % COLS, r: Math.floor(ck / COLS) });
      if (ck === key(a.c, a.r)) break;
      ck = prev[ck];
    }
    return path;
  }

  function applyBrush(c, r) {
    if (!inBounds(c, r)) return;
    var k = idx(c, r);
    if (brush === 'island') {
      if (state.terrain[k] !== 1) { state.terrain[k] = 1; recompute(); }
    } else if (brush === 'sea') {
      var changed = false;
      if (state.terrain[k] !== 0) { state.terrain[k] = 0; changed = true; }
      var bi = beaconAt(c, r);
      if (bi >= 0) { state.beacons.splice(bi, 1); changed = true; toast('Beacon lifted — the tide forgets.'); }
      if (changed) recompute();
    }
  }

  function tapBeacon(c, r) {
    var bi = beaconAt(c, r);
    if (bi >= 0) {
      state.beacons.splice(bi, 1);
      toast('Beacon 燈 lifted.');
      recompute();
      return;
    }
    if (state.terrain[idx(c, r)] !== 1) { toast('Beacons need dry land — paint 島 first.', true); return; }
    if (state.beacons.length >= MAX_BEACONS) { toast('Six beacons is all the survey allows.', true); return; }
    state.beacons.push({ c: c, r: r });
    toast(state.beacons.length >= 2 ? 'Trade winds are re-routing… ⛵' : 'Beacon 燈 staked! Drop one more to summon a route.');
    recompute();
  }

  function beaconAt(c, r) {
    for (var i = 0; i < state.beacons.length; i++) {
      if (state.beacons[i].c === c && state.beacons[i].r === r) return i;
    }
    return -1;
  }

  /* ---------- persistence ---------- */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        terrain: state.terrain, beacons: state.beacons, captain: state.captain
      }));
    } catch (e) { /* private mode — sail on without saving */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (!d || !d.terrain || d.terrain.length !== COLS * ROWS) return false;
      state.terrain = d.terrain.map(function (v) { return v ? 1 : 0; });
      state.beacons = (d.beacons || []).filter(function (b) {
        return inBounds(b.c, b.r) && state.terrain[idx(b.c, b.r)] === 1;
      }).slice(0, MAX_BEACONS);
      state.captain = d.captain || '';
      return true;
    } catch (e) { return false; }
  }

  /* ---------- sizing ---------- */
  function fit() {
    var wrap = canvas.parentElement;
    var cssW = Math.max(240, wrap.clientWidth - 20);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    pad = 14;
    size = (cssW - pad * 2) / (SQ3 * (COLS + 0.5));
    W = cssW;
    H = 1.5 * size * (ROWS - 1) + 2 * size + pad * 2;
    canvas.style.height = H + 'px';
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }

  function eventCell(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * (W / rect.width);
    var y = (ev.clientY - rect.top) * (H / rect.height);
    var best = null, bestD = 1e9;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var p = center(c, r);
      var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bestD) { bestD = d; best = { c: c, r: r }; }
    }
    if (best && bestD < (size * 1.15) * (size * 1.15)) return best;
    return null;
  }

  /* ---------- render ---------- */
  function isShoal(c, r) {
    if (state.terrain[idx(c, r)] !== 0) return false;
    var nb = neighbours(c, r);
    for (var i = 0; i < nb.length; i++) {
      if (state.terrain[idx(nb[i].c, nb[i].r)] === 1) return true;
    }
    return false;
  }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var t = now || 0;
    var r, c, p, k;

    // sea tiles
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      k = idx(c, r);
      p = center(c, r);
      if (state.terrain[k] === 1) continue;
      hexPath(ctx, p.x, p.y, size - 0.8);
      ctx.fillStyle = '#0a0e1c';
      ctx.fill();
      if (isShoal(c, r)) {
        hexPath(ctx, p.x, p.y, size - 0.8);
        ctx.fillStyle = 'rgba(39,230,196,0.16)';
        ctx.fill();
      }
      // drifting wave ticks
      var wob = (Math.sin(t / 1400 + (c * 1.7 + r * 2.3)) + 1) / 2;
      ctx.fillStyle = 'rgba(39,230,196,' + (0.05 + wob * 0.09).toFixed(3) + ')';
      ctx.fillRect(p.x - size * 0.28, p.y + Math.sin(t / 900 + c + r) * 1.5, size * 0.56, 1);
    }

    // land tiles (bob like drifting islets)
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      k = idx(c, r);
      if (state.terrain[k] !== 1) continue;
      p = center(c, r);
      var bobY = p.y + Math.sin(t / 800 + (c * 3.1 + r * 7.7)) * 1.8;
      hexPath(ctx, p.x, bobY, size - 0.6);
      ctx.fillStyle = PAPER;
      ctx.fill();
      if (claimed[k]) {
        hexPath(ctx, p.x, bobY, size - 0.6);
        ctx.fillStyle = 'rgba(255,182,39,0.42)';
        ctx.fill();
      }
      hexPath(ctx, p.x, bobY, size - 0.6);
      ctx.strokeStyle = claimed[k] ? EMBER : 'rgba(10,10,18,0.55)';
      ctx.lineWidth = claimed[k] ? 2 : 1;
      ctx.stroke();
      // inner peak dot
      ctx.fillStyle = claimed[k] ? EMBER : 'rgba(10,10,18,0.5)';
      ctx.beginPath();
      ctx.arc(p.x, bobY, Math.max(1.4, size * 0.07), 0, Math.PI * 2);
      ctx.fill();
    }

    // hover cursor
    if (hover && inBounds(hover.c, hover.r)) {
      p = center(hover.c, hover.r);
      hexPath(ctx, p.x, p.y, size - 0.6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // trade routes
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var i = 0; i < routes.length; i++) {
      var path = routes[i];
      if (!path || path.length < 2) continue;
      ctx.beginPath();
      for (var j = 0; j < path.length; j++) {
        var q = center(path[j].c, path[j].r);
        if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = 'rgba(39,230,196,0.28)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      for (var m = 0; m < path.length; m++) {
        var v = center(path[m].c, path[m].r);
        if (m === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
      }
      ctx.strokeStyle = LAGOON;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -(t / 60);
      ctx.shadowColor = LAGOON; ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      // waypoints
      for (var w = 1; w < path.length - 1; w += 2) {
        var s = center(path[w].c, path[w].r);
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // beacons — neon lanterns
    var numerals = ['一', '二', '三', '四', '五', '六'];
    for (var b = 0; b < state.beacons.length; b++) {
      var bc = state.beacons[b];
      p = center(bc.c, bc.r);
      var pulse = (Math.sin(t / 500 + b * 1.3) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = EMBER;
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * (0.42 + pulse * 0.14), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // lantern body
      ctx.save();
      ctx.shadowColor = EMBER; ctx.shadowBlur = 14;
      ctx.fillStyle = EMBER;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size * 0.52);
      ctx.lineTo(p.x + size * 0.3, p.y);
      ctx.lineTo(p.x, p.y + size * 0.52);
      ctx.lineTo(p.x - size * 0.3, p.y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      // cap + numeral
      ctx.fillStyle = INK;
      ctx.fillRect(p.x - size * 0.2, p.y - size * 0.62, size * 0.4, size * 0.14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.max(10, size * 0.42) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(numerals[b] || (b + 1), p.x, p.y + 0.5);
    }
  }

  function loop(now) { draw(now); requestAnimationFrame(loop); }

  /* ---------- hud ---------- */
  function isleName() {
    var h = 0;
    for (var i = 0; i < state.terrain.length; i++) h = (h * 31 + state.terrain[i] * 7 + i) >>> 0;
    for (var b = 0; b < state.beacons.length; b++) h = (h * 31 + state.beacons[b].c * 13 + state.beacons[b].r * 29) >>> 0;
    var a = ADJ[h % ADJ.length], n = NOUN[(h >> 4) % NOUN.length];
    var k1 = KANJI[(h >> 8) % KANJI.length], k2 = KANJI[(h >> 12) % KANJI.length];
    return '“' + a + ' ' + n + '” · ' + k1 + k2 + '諸島';
  }

  function renderStats() {
    var land = 0, i;
    for (i = 0; i < state.terrain.length; i++) if (state.terrain[i] === 1) land++;
    var claimedN = 0;
    for (var k in claimed) if (claimed[k]) claimedN++;
    var miles = 0;
    for (i = 0; i < routes.length; i++) miles += Math.max(0, routes[i].length - 1);
    document.getElementById('statLand').textContent = land;
    document.getElementById('statBeacons').textContent = state.beacons.length + '/' + MAX_BEACONS;
    document.getElementById('statRoutes').textContent = routes.length;
    document.getElementById('statMiles').textContent = miles;
    document.getElementById('statClaimed').textContent = claimedN;
    document.getElementById('isleName').textContent = isleName();
    var list = document.getElementById('beaconList');
    list.innerHTML = '';
    var numerals = ['一', '二', '三', '四', '五', '六'];
    if (!state.beacons.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No beacons yet — tap 灯 then tap dry land.';
      list.appendChild(li);
      return;
    }
    state.beacons.forEach(function (bc, bi) {
      var item = document.createElement('li');
      var label = document.createElement('span');
      var tiles = 0;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (state.terrain[idx(c, r)] === 1 && claimed[idx(c, r)] &&
            hexDist({ c: c, r: r }, bc) <= CLAIM_R) tiles++;
      }
      label.innerHTML = '<span class="n">燈' + (numerals[bi] || (bi + 1)) + '</span> col ' +
        (bc.c + 1) + ' · row ' + (bc.r + 1) + ' — holds ' + tiles + ' tiles';
      var btn = document.createElement('button');
      btn.textContent = 'lift';
      btn.setAttribute('aria-label', 'Lift beacon ' + (bi + 1));
      btn.addEventListener('click', function () {
        state.beacons.splice(bi, 1);
        toast('Beacon lifted.');
        recompute();
      });
      item.appendChild(label);
      item.appendChild(btn);
      list.appendChild(item);
    });
  }

  function toast(msg, isEmber) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('ember', !!isEmber);
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------- postcard export ---------- */
  function exportPostcard() {
    var cap = document.getElementById('captain').value.trim();
    state.captain = cap; save();
    var PW = 1200, PH = 880;
    var off = document.createElement('canvas');
    off.width = PW; off.height = PH;
    var g = off.getContext('2d');

    // washi paper
    g.fillStyle = PAPER; g.fillRect(0, 0, PW, PH);
    g.strokeStyle = INK; g.lineWidth = 26; g.strokeRect(13, 13, PW - 26, PH - 26);
    g.strokeStyle = EMBER; g.lineWidth = 3; g.strokeRect(44, 44, PW - 88, PH - 88);

    // header
    g.fillStyle = INK; g.textAlign = 'left';
    g.font = '900 44px sans-serif';
    g.fillText('浮島海図  EMBERLINE ISLET CARTOGRAPHY', 80, 120);
    g.font = '28px sans-serif';
    g.fillStyle = '#333';
    var name = isleName();
    g.fillText(name + '   ·   surveyed by ' + (cap || 'an unknown captain'), 80, 162);

    // map frame
    var mx = 80, my = 190, mw = 760, mh = 560;
    g.fillStyle = '#0a0e1c'; g.fillRect(mx, my, mw, mh);
    var s2 = Math.min(mw / (SQ3 * (COLS + 0.5)), mh / (1.5 * (ROWS - 1) + 2)) * 0.94;
    var ox = mx + (mw - SQ3 * s2 * (COLS + 0.5)) / 2;
    var oy = my + (mh - (1.5 * s2 * (ROWS - 1) + 2 * s2)) / 2;
    var numerals = ['一', '二', '三', '四', '五', '六'];
    function cc(c, r) {
      return {
        x: ox + SQ3 * s2 * (c + 0.5) + ((r & 1) ? SQ3 * s2 / 2 : 0),
        y: oy + s2 + 1.5 * s2 * r
      };
    }
    function hp(x, y, s) {
      g.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        var px = x + s * Math.cos(a), py = y + s * Math.sin(a);
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
    }
    var r, c, k, p;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      k = idx(c, r); p = cc(c, r);
      if (state.terrain[k] !== 1) continue;
      hp(p.x, p.y, s2 - 0.7);
      g.fillStyle = '#f7f2e7'; g.fill();
      if (claimed[k]) { hp(p.x, p.y, s2 - 0.7); g.fillStyle = 'rgba(255,182,39,0.55)'; g.fill(); }
      hp(p.x, p.y, s2 - 0.7);
      g.strokeStyle = claimed[k] ? EMBER : INK; g.lineWidth = claimed[k] ? 3 : 1.4; g.stroke();
    }
    g.strokeStyle = LAGOON; g.lineWidth = 4; g.setLineDash([12, 9]);
    for (var i = 0; i < routes.length; i++) {
      var path = routes[i];
      if (!path || path.length < 2) continue;
      g.beginPath();
      for (var j = 0; j < path.length; j++) {
        var q = cc(path[j].c, path[j].r);
        if (j === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
      }
      g.stroke();
    }
    g.setLineDash([]);
    for (var b = 0; b < state.beacons.length; b++) {
      p = cc(state.beacons[b].c, state.beacons[b].r);
      g.fillStyle = EMBER;
      g.beginPath();
      g.moveTo(p.x, p.y - s2 * 0.52);
      g.lineTo(p.x + s2 * 0.3, p.y);
      g.lineTo(p.x, p.y + s2 * 0.52);
      g.lineTo(p.x - s2 * 0.3, p.y);
      g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(s2 * 0.42) + 'px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(numerals[b] || String(b + 1), p.x, p.y);
    }
    g.strokeStyle = LAGOON; g.lineWidth = 3; g.strokeRect(mx, my, mw, mh);

    // manifest column
    var tx = 880;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = INK; g.font = '900 30px sans-serif';
    g.fillText('航路 MANIFEST', tx, 230);
    g.font = '24px sans-serif';
    var land = 0; for (var li = 0; li < state.terrain.length; li++) if (state.terrain[li] === 1) land++;
    var claimedN = 0; for (var kk in claimed) if (claimed[kk]) claimedN++;
    var miles = 0; for (var ri = 0; ri < routes.length; ri++) miles += Math.max(0, routes[ri].length - 1);
    var rows = ['land tiles ··· ' + land, 'claimed ··· ' + claimedN,
      'beacons ··· ' + state.beacons.length + '/' + MAX_BEACONS,
      'trade legs ··· ' + routes.length, 'wind-miles ··· ' + miles];
    for (var vi = 0; vi < rows.length; vi++) g.fillText(rows[vi], tx, 275 + vi * 40);
    g.font = '22px sans-serif'; g.fillStyle = '#333';
    g.fillText('winds prefer open water,', tx, 520);
    g.fillText('linking beacons in order.', tx, 548);

    // hanko stamp
    g.save();
    g.translate(1015, 660); g.rotate(-0.12);
    g.fillStyle = EMBER; g.fillRect(-62, -62, 124, 124);
    g.fillStyle = '#fff'; g.font = '900 62px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('燈', 0, 4);
    g.restore();
    g.fillStyle = INK; g.font = '24px sans-serif'; g.textAlign = 'left';
    g.fillText('電脳諸島測量所 · EMBERLINE 03', 80, PH - 66);
    g.textAlign = 'right';
    g.fillText(new Date().toISOString().slice(0, 10), PW - 80, PH - 66);

    var slug = name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'islet';
    function done(url) {
      var a = document.createElement('a');
      a.href = url;
      a.download = 'emberline-' + slug + '-postcard.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); }, 500);
      toast('Postcard stamped ⛩ — check your downloads.');
    }
    if (off.toBlob) off.toBlob(function (blob) {
      if (!blob) { done(off.toDataURL('image/png')); return; }
      done(URL.createObjectURL(blob));
    }, 'image/png');
    else done(off.toDataURL('image/png'));
  }

  /* ---------- events ---------- */
  function bind() {
    var brushes = document.querySelectorAll('.brush');
    for (var i = 0; i < brushes.length; i++) {
      brushes[i].addEventListener('click', function () {
        brush = this.getAttribute('data-brush');
        for (var j = 0; j < brushes.length; j++) brushes[j].classList.remove('is-active');
        this.classList.add('is-active');
        canvas.style.cursor = brush === 'beacon' ? 'pointer' : 'crosshair';
      });
    }
    canvas.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      painting = true;
      var cell = eventCell(ev);
      if (!cell) return;
      if (brush === 'beacon') tapBeacon(cell.c, cell.r);
      else applyBrush(cell.c, cell.r);
    });
    canvas.addEventListener('pointermove', function (ev) {
      hover = eventCell(ev);
      if (painting && brush !== 'beacon' && hover) applyBrush(hover.c, hover.r);
    });
    function endPaint() { painting = false; }
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);
    canvas.addEventListener('pointerleave', function () { hover = null; });

    document.getElementById('btnDrift').addEventListener('click', function () {
      genIslands();
      toast('A new drift surfaces… 🌊');
    });
    document.getElementById('btnClear').addEventListener('click', function () {
      state.terrain = new Array(COLS * ROWS).fill(0);
      state.beacons = [];
      recompute();
      toast('Still sea. Paint 島 to begin again.');
    });
    document.getElementById('btnExport').addEventListener('click', exportPostcard);
    document.getElementById('btnExport2').addEventListener('click', exportPostcard);
    document.getElementById('captain').addEventListener('input', function () {
      state.captain = this.value; save();
    });
    window.addEventListener('resize', fit);
  }

  /* ---------- boot ---------- */
  function boot() {
    var had = load();
    document.getElementById('captain').value = state.captain || '';
    if (!had) genIslands();
    else recompute();
    fit();
    bind();
    renderStats();
    requestAnimationFrame(loop);
    if (!had) {
      setTimeout(function () {
        toast(state.beacons.length >= 2
          ? 'Two beacons pre-staked — drag 島 to reshape, tap 灯 for more!'
          : 'Drag 島 to raise islands, then tap 灯 twice!');
      }, 600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
