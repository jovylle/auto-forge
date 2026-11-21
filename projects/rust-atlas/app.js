/* Rust Atlas — log slow decay as a beautiful oxidation map. */
(function () {
  'use strict';

  var STORE_KEY = 'rust-atlas.v1';
  var DAY_MS = 86400000;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var map = document.getElementById('map');
  var ctx = map.getContext('2d');
  var form = document.getElementById('composer');
  var nameInput = document.getElementById('siteName');
  var rateInput = document.getElementById('rate');
  var rateOut = document.getElementById('rateOut');
  var placeNote = document.getElementById('placeNote');
  var entriesEl = document.getElementById('entries');
  var countEl = document.getElementById('entryCount');
  var statusEl = document.getElementById('status');
  var statSites = document.getElementById('statSites');
  var statPatina = document.getElementById('statPatina');
  var statOldest = document.getElementById('statOldest');
  var exportJsonBtn = document.getElementById('exportJson');
  var exportPngBtn = document.getElementById('exportPng');

  var SEEDS = [
    ['Hull plate', 0.22, 0.62, 7, 340],
    ['Gate hinge', 0.68, 0.3, 5, 210],
    ['Lantern frame', 0.48, 0.72, 4, 96],
    ['Anvil jaw', 0.82, 0.66, 8, 38],
    ['Bridge bolt', 0.36, 0.24, 3, 12]
  ];

  var sites = [];
  var selected = null;
  var pendingPlace = null;
  var cursor = { x: 0.5, y: 0.5, on: false };

  /* ---------- data ---------- */

  function makeSite(name, x, y, rate, ageDays) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      x: clamp(x, 0.04, 0.96),
      y: clamp(y, 0.06, 0.94),
      rate: rate,
      createdAt: Date.now() - (ageDays || 0) * DAY_MS
    };
  }

  function isSite(s) {
    return s && typeof s.name === 'string' &&
      typeof s.x === 'number' && typeof s.y === 'number' &&
      typeof s.rate === 'number' && typeof s.createdAt === 'number';
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && Array.isArray(data.sites)) {
          var clean = data.sites.filter(isSite);
          if (clean.length === data.sites.length) return { sites: clean, fresh: false };
        }
      }
    } catch (err) { /* storage can be blocked on file:// — fall through to seeds */ }
    return { sites: SEEDS.map(function (s) { return makeSite(s[0], s[1], s[2], s[3], s[4]); }), fresh: true };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, sites: sites }));
    } catch (err) { /* private mode: stay ephemeral */ }
  }

  function ageOf(site) {
    return Math.max(0, (Date.now() - site.createdAt) / DAY_MS);
  }

  function exposure(site) {
    var age = ageOf(site);
    return clamp((site.rate * Math.pow(age + 1, 0.62)) / 160, 0, 1);
  }

  function baseRadius(age, rate) {
    return 8 + 62 * Math.pow((age + 1) / 400, 0.45) * Math.pow(rate / 6, 0.7);
  }

  function stageOf(exp) {
    if (exp < 0.18) return 'Fresh';
    if (exp < 0.45) return 'Blooming';
    if (exp < 0.72) return 'Oxidized';
    return 'Patina';
  }

  function ageLabel(site) {
    var age = ageOf(site);
    if (age < 1) return 'new';
    if (age < 2) return '1 day';
    return Math.round(age) + ' days';
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- colour ---------- */

  var RUST_STOPS = [
    [0.0, [255, 160, 92]],
    [0.28, [245, 104, 52]],
    [0.52, [186, 74, 56]],
    [0.7, [126, 92, 80]],
    [0.86, [62, 150, 148]],
    [1.0, [92, 240, 224]]
  ];

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function rustColor(t) {
    t = clamp(t, 0, 1);
    for (var i = 1; i < RUST_STOPS.length; i++) {
      if (t <= RUST_STOPS[i][0]) {
        var a = RUST_STOPS[i - 1], b = RUST_STOPS[i];
        return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return RUST_STOPS[RUST_STOPS.length - 1][1];
  }

  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }

  function cssColor(c) {
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }

  /* ---------- deterministic noise ---------- */

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- drawing ---------- */

  var starCache = { key: '', pts: [] };

  function stars(w, h) {
    var key = w + 'x' + h;
    if (starCache.key !== key) {
      var rnd = mulberry32(1234);
      var pts = [];
      for (var i = 0; i < 70; i++) {
        pts.push({ x: rnd() * w, y: rnd() * h * 0.55, r: 0.4 + rnd() * 1.2, a: 0.2 + rnd() * 0.6 });
      }
      starCache = { key: key, pts: pts };
    }
    return starCache.pts;
  }

  function drawBackdrop(w, h) {
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a0420');
    sky.addColorStop(0.6, '#100726');
    sky.addColorStop(1, '#060210');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    var pts = stars(w, h);
    ctx.fillStyle = '#dff9ff';
    for (var i = 0; i < pts.length; i++) {
      ctx.globalAlpha = pts[i].a;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var hz = h * 0.66;
    var sunR = Math.min(w, h) * 0.16;
    var sx = w * 0.5;
    var sy = hz - sunR * 0.28;

    var halo = ctx.createRadialGradient(sx, sy, sunR * 0.35, sx, sy, sunR * 2.1);
    halo.addColorStop(0, 'rgba(255,79,216,0.22)');
    halo.addColorStop(0.55, 'rgba(255,79,216,0.06)');
    halo.addColorStop(1, 'rgba(255,79,216,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, hz + sunR * 0.4);

    var sunGrad = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR);
    sunGrad.addColorStop(0, '#ffe7a8');
    sunGrad.addColorStop(0.35, '#ff9a4a');
    sunGrad.addColorStop(0.68, '#ff4fd8');
    sunGrad.addColorStop(1, '#7b5cff');

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(sx, sy, sunR, 0, TAU);
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#0b0620';
    for (var s = 0; s < 9; s++) {
      var yy = sy + sunR * 0.06 + s * sunR * 0.095;
      ctx.fillRect(sx - sunR, yy, sunR * 2, sunR * 0.012 + s * sunR * 0.009);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(63,242,224,0.42)';
    ctx.fillRect(0, hz, w, 1);

    ctx.strokeStyle = 'rgba(63,242,224,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var v = -10; v <= 10; v++) {
      var x = w * 0.5 + v * (w / 7);
      ctx.moveTo(w * 0.5, hz);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    for (var k = 1; k <= 9; k++) {
      var t = Math.pow(k / 9, 2.2);
      ctx.fillStyle = 'rgba(255,79,216,' + (0.05 + t * 0.22).toFixed(3) + ')';
      ctx.fillRect(0, hz + (h - hz) * t, w, 1);
    }
  }

  function bloomPath(x, y, R, rnd, wobble) {
    var pts = [];
    for (var i = 0; i < 26; i++) {
      var a = (i / 26) * TAU;
      var rr = R * (1 - wobble + rnd() * wobble * 2);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.94]);
    }
    ctx.beginPath();
    var start = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    ctx.moveTo(start[0], start[1]);
    for (var j = 1; j <= pts.length; j++) {
      var p = pts[j % pts.length];
      var n = pts[(j + 1) % pts.length];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
    }
    ctx.closePath();
  }

  function drawSite(site, w, h, scale, ts) {
    var age = ageOf(site);
    var exp = exposure(site);
    var x = site.x * w;
    var y = site.y * h;
    var s = Math.max(0.42, scale);
    var R = Math.max(7, baseRadius(age, site.rate) * s);
    var col = rustColor(exp);
    var seed = hashString(site.id);
    var rnd = mulberry32(seed);
    var breathe = 1 + 0.02 * Math.sin(ts / 1200 + (seed % 100));
    R *= breathe;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var glow = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 1.85);
    glow.addColorStop(0, rgba(col, 0.3));
    glow.addColorStop(0.55, rgba(col, 0.1));
    glow.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, R * 1.85, 0, TAU);
    ctx.fill();
    ctx.restore();

    // dark scab lumps peeking out from under the crust
    for (var i = 0; i < 9; i++) {
      var a = rnd() * TAU;
      var d = R * (0.5 + rnd() * 0.38);
      var cr = R * (0.18 + rnd() * 0.26);
      ctx.fillStyle = rgba(mix(col, [32, 12, 20], 0.55), 0.5);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, cr, 0, TAU);
      ctx.fill();
    }

    // lumpy oxidised body
    bloomPath(x, y, R, rnd, 0.26);
    var core = ctx.createRadialGradient(x - R * 0.15, y - R * 0.18, R * 0.05, x, y, R * 1.05);
    core.addColorStop(0, rgba(mix(col, [255, 216, 170], 0.18), 0.96));
    core.addColorStop(0.55, rgba(col, 0.96));
    core.addColorStop(0.85, rgba(mix(col, [44, 16, 22], 0.4), 0.92));
    core.addColorStop(1, rgba(mix(col, [26, 10, 16], 0.6), 0));
    ctx.fillStyle = core;
    ctx.fill();
    ctx.strokeStyle = rgba(mix(col, [30, 12, 18], 0.55), 0.5);
    ctx.lineWidth = Math.max(1, s * 1.2);
    ctx.stroke();

    // mottled speckle field, clipped to the bloom silhouette
    ctx.save();
    bloomPath(x, y, R * 0.93, mulberry32(seed ^ 0x9e3779b9), 0.28);
    ctx.clip();
    for (var p = 0; p < 14; p++) {
      var pa = rnd() * TAU;
      var pd = Math.sqrt(rnd()) * R * 0.8;
      var patch;
      if (exp > 0.42 && rnd() > 0.55) patch = mix(col, [70, 235, 214], 0.42);
      else patch = rnd() > 0.5 ? mix(col, [255, 214, 172], 0.35) : mix(col, [38, 14, 20], 0.42);
      ctx.fillStyle = rgba(patch, 0.12 + rnd() * 0.18);
      ctx.beginPath();
      ctx.arc(x + Math.cos(pa) * pd, y + Math.sin(pa) * pd * 0.94, R * (0.12 + rnd() * 0.24), 0, TAU);
      ctx.fill();
    }
    for (var j = 0; j < 46; j++) {
      var sa = rnd() * TAU;
      var sd = Math.sqrt(rnd()) * R * 0.94;
      var speck;
      var roll = rnd();
      if (exp > 0.5 && roll > 0.72) speck = mix(col, [70, 235, 214], 0.5);
      else if (roll > 0.5) speck = mix(col, [255, 226, 190], 0.55);
      else speck = mix(col, [34, 12, 18], 0.5);
      ctx.fillStyle = rgba(speck, 0.14 + rnd() * 0.32);
      ctx.beginPath();
      ctx.arc(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, R * (0.03 + rnd() * 0.11), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // flakes and patina crust along the edge
    for (var k = 0; k < 11; k++) {
      var fa = rnd() * TAU;
      var fd = R * (0.82 + rnd() * 0.22);
      var fr = R * (0.04 + rnd() * 0.1);
      var flake = exp > 0.5 && rnd() > 0.5 ? mix(col, [70, 235, 214], 0.55) : mix(col, [30, 11, 18], 0.45);
      ctx.fillStyle = rgba(flake, 0.32 + rnd() * 0.3);
      ctx.beginPath();
      ctx.arc(x + Math.cos(fa) * fd, y + Math.sin(fa) * fd * 0.94, fr, 0, TAU);
      ctx.fill();
    }

    if (exp > 0.45) {
      var pk = (exp - 0.45) / 0.55;
      ctx.strokeStyle = rgba([70, 235, 215], 0.1 + pk * 0.3);
      ctx.lineWidth = 1 + pk * 1.4;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.97, -2.6 + pk * 1.2, -2.6 + pk * 1.2 + 4.1);
      ctx.stroke();
    }
  }

  function drawSelection(site, w, h, scale, ts) {
    var R = Math.max(9, baseRadius(ageOf(site), site.rate) * Math.max(0.42, scale)) + 9;
    var x = site.x * w;
    var y = site.y * h;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,196,107,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -ts / 70;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,196,107,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - R - 7, y); ctx.lineTo(x - R - 2, y);
    ctx.moveTo(x + R + 2, y); ctx.lineTo(x + R + 7, y);
    ctx.moveTo(x, y - R - 7); ctx.lineTo(x, y - R - 2);
    ctx.moveTo(x, y + R + 2); ctx.lineTo(x, y + R + 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawCursor(w, h) {
    var x = cursor.x * w;
    var y = cursor.y * h;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,242,224,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(w, y);
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(63,242,224,0.9)';
    ctx.strokeRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = 'rgba(63,242,224,0.9)';
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.restore();
  }

  function draw(ts) {
    ts = ts || 0;
    var w = map.clientWidth;
    var h = map.clientHeight;
    if (!w || !h) return;

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pw = Math.round(w * dpr);
    var ph = Math.round(h * dpr);
    if (map.width !== pw || map.height !== ph) {
      map.width = pw;
      map.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackdrop(w, h);

    var scale = Math.min(w, h) / 620;
    var ordered = sites.slice().sort(function (a, b) { return exposure(a) - exposure(b); });
    for (var i = 0; i < ordered.length; i++) drawSite(ordered[i], w, h, scale, ts);

    var sel = null;
    for (var j = 0; j < sites.length; j++) if (sites[j].id === selected) sel = sites[j];
    if (sel) drawSelection(sel, w, h, scale, ts);

    if (cursor.on) drawCursor(w, h);
  }

  var rafId = 0;
  var lastFrame = 0;

  function loop(ts) {
    rafId = window.requestAnimationFrame(loop);
    if (ts - lastFrame < 33) return;
    lastFrame = ts;
    draw(ts);
  }

  function startLoop() {
    if (!reduceMotion && !rafId) rafId = window.requestAnimationFrame(loop);
  }

  function redraw() {
    if (reduceMotion) draw(performance.now());
  }

  /* ---------- ui ---------- */

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function syncNote() {
    if (pendingPlace) {
      placeNote.hidden = false;
      placeNote.textContent = 'Anchored at ' + Math.round(pendingPlace.x * 100) + '% · ' +
        Math.round(pendingPlace.y * 100) + '% — esc to release';
    } else if (cursor.on) {
      placeNote.hidden = false;
      placeNote.textContent = 'Cursor at ' + Math.round(cursor.x * 100) + '% · ' +
        Math.round(cursor.y * 100) + '% — ↵ to anchor here';
    } else {
      placeNote.hidden = true;
      placeNote.textContent = '';
    }
  }

  function renderStats() {
    statSites.textContent = String(sites.length);
    var mean = 0;
    if (sites.length) {
      var sum = 0;
      for (var i = 0; i < sites.length; i++) sum += exposure(sites[i]);
      mean = Math.round((sum / sites.length) * 100);
    }
    statPatina.textContent = mean + '%';

    var oldest = null;
    for (var j = 0; j < sites.length; j++) {
      if (!oldest || sites[j].createdAt < oldest.createdAt) oldest = sites[j];
    }
    statOldest.textContent = oldest ? oldest.name : '—';
    statOldest.title = oldest ? Math.round(ageOf(oldest)) + ' days under observation' : '';
    countEl.textContent = sites.length + (sites.length === 1 ? ' site' : ' sites');
  }

  function renderEntries() {
    entriesEl.textContent = '';

    if (!sites.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No sites logged. The atlas is stainless — for now.';
      entriesEl.appendChild(empty);
      return;
    }

    var sorted = sites.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    sorted.forEach(function (site) {
      var exp = exposure(site);
      var col = rustColor(exp);
      var li = document.createElement('li');
      li.className = 'entry';
      li.dataset.id = site.id;
      li.style.setProperty('--stage', cssColor(col));

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'entry-btn';
      btn.dataset.id = site.id;
      btn.setAttribute('aria-pressed', String(site.id === selected));
      btn.setAttribute('aria-label', site.name + ', ' + stageOf(exp) + ', ' + ageLabel(site) +
        ', corrosion rate ' + site.rate + ' of 10. Select site on map.');

      var name = document.createElement('span');
      name.className = 'entry-name';
      name.textContent = site.name;

      var meta = document.createElement('span');
      meta.className = 'entry-meta';
      meta.textContent = stageOf(exp) + ' · ' + ageLabel(site) + ' · rate ' + site.rate;

      var pct = document.createElement('span');
      pct.className = 'entry-pct';
      pct.textContent = Math.round(exp * 100) + '%';

      btn.append(name, meta, pct);
      btn.addEventListener('click', function () { selectSite(site.id); });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeSite(site.id);
        }
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Erase ' + site.name);
      del.addEventListener('click', function () { removeSite(site.id); });

      li.append(btn, del);
      if (site.id === selected) li.classList.add('is-selected');
      entriesEl.appendChild(li);
    });
  }

  function updateSelectionUI() {
    var items = entriesEl.querySelectorAll('.entry');
    for (var i = 0; i < items.length; i++) {
      var isSel = items[i].dataset.id === selected;
      items[i].classList.toggle('is-selected', isSel);
      var btn = items[i].querySelector('.entry-btn');
      if (btn) btn.setAttribute('aria-pressed', String(isSel));
    }
  }

  function selectSite(id) {
    selected = id;
    updateSelectionUI();
    redraw();
    var site = null;
    for (var i = 0; i < sites.length; i++) if (sites[i].id === id) site = sites[i];
    if (site) {
      setStatus(site.name + ' selected — ' + Math.round(exposure(site) * 100) + '% patina, ' +
        stageOf(exposure(site)).toLowerCase() + '.');
    }
  }

  function removeSite(id) {
    var site = null;
    for (var i = 0; i < sites.length; i++) if (sites[i].id === id) site = sites[i];
    if (!site) return;
    if (!window.confirm('Erase "' + site.name + '" from the atlas?')) return;

    sites = sites.filter(function (s) { return s.id !== id; });
    if (selected === id) selected = sites.length ? sites[0].id : null;
    save();
    renderStats();
    renderEntries();
    redraw();
    setStatus(site.name + ' erased. Its patina fades from the atlas.');
    var nextFocus = entriesEl.querySelector('.entry-btn');
    if (nextFocus) nextFocus.focus();
    else nameInput.focus();
  }

  function addSite(name, x, y, rate) {
    var site = makeSite(name, x, y, rate, 0);
    sites.push(site);
    selected = site.id;
    save();
    renderStats();
    renderEntries();
    entriesEl.scrollTop = 0;
    redraw();
    return site;
  }

  function clearPending() {
    pendingPlace = null;
    syncNote();
  }

  /* ---------- export ---------- */

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportDecay() {
    var payload = {
      app: 'Rust Atlas',
      exportedAt: new Date().toISOString(),
      note: 'Decay archive — ages are measured from each site\'s createdAt.',
      sites: sites.slice().sort(function (a, b) { return a.createdAt - b.createdAt; }).map(function (s) {
        var exp = exposure(s);
        return {
          name: s.name,
          x: Number(s.x.toFixed(3)),
          y: Number(s.y.toFixed(3)),
          rate: s.rate,
          ageDays: Number(ageOf(s).toFixed(1)),
          patina: Number(exp.toFixed(3)),
          stage: stageOf(exp),
          createdAt: new Date(s.createdAt).toISOString()
        };
      })
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      'rust-atlas-decay-' + stamp() + '.json');
    setStatus('Decay archive exported — ' + sites.length + ' sites of oxidation, ' + stamp() + '.');
  }

  function exportMap() {
    draw(performance.now());
    map.toBlob(function (blob) {
      if (!blob) {
        setStatus('Map export failed — this browser could not read the canvas.');
        return;
      }
      download(blob, 'rust-atlas-map-' + stamp() + '.png');
      setStatus('Patina map exported as PNG — ' + stamp() + '.');
    }, 'image/png');
  }

  /* ---------- events ---------- */

  rateInput.addEventListener('input', function () {
    rateOut.textContent = rateInput.value;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var typed = nameInput.value.trim();
    var name = (typed || 'Site ' + String(sites.length + 1).padStart(2, '0')).slice(0, 40);
    var rate = clamp(Number(rateInput.value) || 5, 1, 10);
    var spot = pendingPlace || { x: 0.15 + Math.random() * 0.7, y: 0.18 + Math.random() * 0.64 };

    var site = addSite(name, spot.x, spot.y, rate);
    pendingPlace = null;
    nameInput.value = '';
    syncNote();
    nameInput.focus();
    setStatus('Logged ' + site.name + ' at ' + Math.round(spot.x * 100) + '% · ' +
      Math.round(spot.y * 100) + '% — fresh oxidation. ' + sites.length + ' sites in the atlas.');
  });

  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') clearPending();
  });

  map.addEventListener('focus', function () {
    cursor.on = true;
    syncNote();
    redraw();
  });

  map.addEventListener('blur', function () {
    cursor.on = false;
    syncNote();
    redraw();
  });

  map.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 0.015 : 0.045;
    var moved = false;

    if (e.key === 'ArrowLeft') { cursor.x = clamp(cursor.x - step, 0.06, 0.94); moved = true; }
    else if (e.key === 'ArrowRight') { cursor.x = clamp(cursor.x + step, 0.06, 0.94); moved = true; }
    else if (e.key === 'ArrowUp') { cursor.y = clamp(cursor.y - step, 0.08, 0.92); moved = true; }
    else if (e.key === 'ArrowDown') { cursor.y = clamp(cursor.y + step, 0.08, 0.92); moved = true; }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pendingPlace = { x: cursor.x, y: cursor.y };
      syncNote();
      nameInput.focus();
      setStatus('Placement anchored at ' + Math.round(cursor.x * 100) + '% · ' +
        Math.round(cursor.y * 100) + '%. Name the site, then oxidize.');
      return;
    } else {
      return;
    }

    e.preventDefault();
    cursor.on = true;
    syncNote();
    redraw();
    if (moved) setStatus('Cursor at ' + Math.round(cursor.x * 100) + '% · ' +
      Math.round(cursor.y * 100) + '%. Press Enter to anchor.');
  });

  map.addEventListener('click', function (e) {
    var rect = map.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var px = e.clientX - rect.left;
    var py = e.clientY - rect.top;
    var tx = px / rect.width;
    var ty = py / rect.height;
    var scale = Math.max(0.42, Math.min(rect.width, rect.height) / 620);
    var best = null;
    var bestDist = Infinity;

    for (var i = 0; i < sites.length; i++) {
      var dist = Math.hypot((sites[i].x - tx) * rect.width, (sites[i].y - ty) * rect.height);
      if (dist < bestDist) { bestDist = dist; best = sites[i]; }
    }
    if (best) {
      var hitR = Math.max(24, baseRadius(ageOf(best), best.rate) * scale + 10);
      if (bestDist <= hitR) selectSite(best.id);
    }
  });

  exportJsonBtn.addEventListener('click', exportDecay);
  exportPngBtn.addEventListener('click', exportMap);

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!pendingPlace) return;
    clearPending();
    setStatus('Placement released. New sites will land at random coordinates.');
  });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () { redraw(); }).observe(map);
  } else {
    window.addEventListener('resize', redraw);
  }

  /* ---------- init ---------- */

  var loaded = load();
  sites = loaded.sites;
  if (loaded.fresh) save();

  if (sites.length) {
    var newest = sites[0];
    for (var i = 1; i < sites.length; i++) if (sites[i].createdAt > newest.createdAt) newest = sites[i];
    selected = newest.id;
  }

  renderStats();
  renderEntries();
  draw(0);
  startLoop();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(redraw).catch(function () {});
  }

  setStatus('Atlas loaded — ' + sites.length + ' sites under observation. Patina accumulates daily.');
})();
