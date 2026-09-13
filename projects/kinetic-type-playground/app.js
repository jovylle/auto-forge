/* Kinetic Type Playground — vaporwave kinetic typography
   Plain JS, no deps. Works from file://. */
(function () {
  'use strict';

  /* ---------------- presets ---------------- */
  var FONTS = [
    { id: 'chrome',   label: 'CHROME',   family: "'Orbitron','Space Grotesk',sans-serif", weight: 900 },
    { id: 'plaza',    label: 'PLAZA',    family: "'Monoton','Orbitron',cursive",           weight: 400 },
    { id: 'mallsoft', label: 'MALLSOFT', family: "'Pacifico',cursive",                    weight: 400 },
    { id: 'laser',    label: 'LASER',    family: "'Bebas Neue','Arial Narrow',sans-serif", weight: 400 },
    { id: 'arcade',   label: 'ARCADE',   family: "'Press Start 2P',monospace",            weight: 400 },
    { id: 'wide',     label: 'WIDE',     family: "'Unbounded','Orbitron',sans-serif",     weight: 900 }
  ];
  var MOTIONS = [
    { id: 'wave',    label: 'WAVE' },
    { id: 'bounce',  label: 'BOUNCE' },
    { id: 'glitch',  label: 'GLITCH' },
    { id: 'spin',    label: 'SPIN' },
    { id: 'scatter', label: 'EXPLODE' },
    { id: 'cascade', label: 'CASCADE' },
    { id: 'flow',    label: 'FLOW' }
  ];
  var PALETTES = [
    { id: 'sunset',   label: 'SUNSET',   letters: ['#ff71ce', '#fffb96', '#01cdfe'] },
    { id: 'chrome',   label: 'CHROME',   letters: ['#ffffff', '#01cdfe', '#ff71ce'] },
    { id: 'midnight', label: 'MIDNIGHT', letters: ['#b967ff', '#01cdfe', '#05ffa1'] },
    { id: 'slime',    label: 'SLIME',    letters: ['#05ffa1', '#fffb96', '#ff71ce'] }
  ];
  var DEFAULTS = { text: 'NEON DREAMS', font: 'chrome', weight: 900, size: 84,
                   motion: 'wave', speed: 1, palette: 'sunset',
                   glow: true, outline: true, grid: true, trail: false };
  var LS_KEY = 'ktp-state-v1';

  /* ---------------- state ---------------- */
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  var state = loadState();
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    }, 250);
  }

  /* ---------------- dom ---------------- */
  function $(id) { return document.getElementById(id); }
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var textInput = $('textInput'), charCount = $('charCount');
  var weightEl = $('weight'), sizeEl = $('size'), speedEl = $('speed');
  var weightVal = $('weightVal'), sizeVal = $('sizeVal'), speedVal = $('speedVal');
  var hudMotion = $('hudMotion'), ticker = $('ticker'), toastEl = $('toast');
  var banner = $('aestheticBanner'), exportBar = $('exportBar');
  var btnRandom = $('btnRandom'), btnExport = $('btnExport'), btnReset = $('btnReset');

  var W = 960, H = 540;
  function fitCanvas() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trail = document.createElement('canvas');
    trail.width = W; trail.height = H;
    trailCtx = trail.getContext('2d');
  }
  var trail = document.createElement('canvas');
  var trailCtx = trail.getContext('2d');

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function fontById(id) { for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i]; return FONTS[0]; }
  function paletteById(id) { for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i]; return PALETTES[0]; }
  function fontString(st) { return st.weight + ' ' + st.size + 'px ' + fontById(st.font).family; }

  /* ---------------- chips ---------------- */
  function buildChips(el, items, get, set, swatch) {
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (swatch ? ' swatch' : '');
      b.textContent = swatch ? '' : it.label;
      b.title = it.label;
      if (swatch) b.style.background = 'linear-gradient(135deg,' + it.letters.join(',') + ')';
      b.dataset.id = it.id;
      b.addEventListener('click', function () { set(it.id); syncUI(); save(); });
      el.appendChild(b);
    });
    function refresh() {
      var cur = get();
      Array.prototype.forEach.call(el.children, function (c) {
        c.classList.toggle('active', c.dataset.id === cur);
      });
    }
    refresh();
    return refresh;
  }
  var refreshFonts = buildChips($('fontChips'), FONTS,
    function () { return state.font; },
    function (id) { state.font = id; state.weight = fontById(id).weight; });
  var refreshMotions = buildChips($('motionChips'), MOTIONS,
    function () { return state.motion; },
    function (id) { state.motion = id; });
  var refreshPalettes = buildChips($('paletteChips'), PALETTES,
    function () { return state.palette; },
    function (id) { state.palette = id; }, true);

  /* ---------------- inputs ---------------- */
  textInput.addEventListener('input', function () {
    state.text = textInput.value;
    charCount.textContent = textInput.value.length + ' / 120';
    ticker.textContent = '▲ now playing: ' + (textInput.value.trim() || 'silence') + ' ▲\u00a0';
    checkEggWord();
    save();
  });
  weightEl.addEventListener('input', function () { state.weight = +weightEl.value; weightVal.textContent = weightEl.value; save(); });
  sizeEl.addEventListener('input', function () { state.size = +sizeEl.value; sizeVal.textContent = sizeEl.value; save(); });
  speedEl.addEventListener('input', function () { state.speed = +speedEl.value; speedVal.textContent = (+speedEl.value).toFixed(1) + '×'; save(); });
  $('tglGlow').addEventListener('change', function (e) { state.glow = e.target.checked; save(); });
  $('tglOutline').addEventListener('change', function (e) { state.outline = e.target.checked; save(); });
  $('tglGrid').addEventListener('change', function (e) { state.grid = e.target.checked; save(); });
  $('tglTrail').addEventListener('change', function (e) { state.trail = e.target.checked; if (!state.trail) trailCtx.clearRect(0, 0, W, H); save(); });

  function syncUI() {
    textInput.value = state.text;
    charCount.textContent = state.text.length + ' / 120';
    weightEl.value = state.weight; weightVal.textContent = state.weight;
    sizeEl.value = state.size; sizeVal.textContent = state.size;
    speedEl.value = state.speed; speedVal.textContent = (+state.speed).toFixed(1) + '×';
    $('tglGlow').checked = state.glow;
    $('tglOutline').checked = state.outline;
    $('tglGrid').checked = state.grid;
    $('tglTrail').checked = state.trail;
    hudMotion.textContent = state.motion.toUpperCase() + ' // ' + fontById(state.font).label;
    ticker.textContent = '▲ now playing: ' + (state.text.trim() || 'silence') + ' ▲\u00a0';
    refreshFonts(); refreshMotions(); refreshPalettes();
  }

  btnReset.addEventListener('click', function () {
    state = Object.assign({}, DEFAULTS);
    if (secretOn) setSecret(false);
    trailCtx.clearRect(0, 0, W, H);
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    syncUI(); toast('deck reset to factory chrome');
  });

  /* ---------------- randomize ---------------- */
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  btnRandom.addEventListener('click', function () {
    var f = pick(FONTS);
    state.font = f.id;
    state.weight = Math.random() < 0.45 ? f.weight : pick([400, 700, 900]);
    state.size = 52 + Math.floor(Math.random() * 80);
    state.motion = pick(MOTIONS).id;
    state.palette = pick(PALETTES).id;
    state.glow = Math.random() < 0.85;
    state.outline = Math.random() < 0.8;
    state.grid = Math.random() < 0.8;
    btnRandom.classList.remove('rolling');
    void btnRandom.offsetWidth;
    btnRandom.classList.add('rolling');
    syncUI(); save();
    toast('🎲 ' + f.label + ' + ' + state.motion.toUpperCase() + ' + ' + paletteById(state.palette).label);
  });

  /* ---------------- easter egg ---------------- */
  var secretOn = false, secretBackup = null;
  function toFullwidth(s) {
    return s.replace(/[!-~]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0xFEE0); })
            .replace(/ /g, '\u3000');
  }
  function setSecret(on) {
    if (on === secretOn) return;
    secretOn = on;
    if (on) {
      secretBackup = { motion: state.motion, palette: state.palette };
      state.motion = 'flow'; state.palette = 'sunset';
      banner.classList.remove('hidden');
      syncUI();
      toast('🌴 ａｅｓｔｈｅｔｉｃ ｍｏｄｅ ｅｎｇａｇｅｄ 🌴');
      try { console.log('%c🌴 you found the chrome zone — stay a while 🌴', 'color:#ff71ce;font-size:16px'); } catch (e) {}
    } else {
      if (secretBackup) { state.motion = secretBackup.motion; state.palette = secretBackup.palette; }
      secretBackup = null;
      banner.classList.add('hidden');
      syncUI();
    }
  }
  function checkEggWord() {
    if (state.text.toLowerCase().indexOf('vaporwave') !== -1 && !secretOn) setSecret(true);
    else if (state.text.toLowerCase().indexOf('vaporwave') === -1 && secretOn && eggByKey) { /* stay until Esc */ }
  }
  var eggByKey = false;
  var konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var kPos = 0;
  document.addEventListener('keydown', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === konami[kPos] || (kPos >= 8 && k === konami[kPos])) {
      kPos++;
      if (kPos === konami.length) { kPos = 0; eggByKey = true; setSecret(!secretOn); if (!secretOn) eggByKey = false; }
    } else kPos = (k === konami[0]) ? 1 : 0;
    if (e.key === 'Escape' && secretOn) { eggByKey = false; setSecret(false); }
  });

  /* ---------------- engine ---------------- */
  var stars = [];
  for (var s = 0; s < 90; s++) stars.push({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6.28 });
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function motionFor(id, i, t, size) {
    var m = { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1, split: 0 };
    switch (id) {
      case 'bounce':
        m.dy = -Math.abs(Math.sin(t * 3.2 + i * 0.5)) * size * 0.55;
        m.scale = 1 + 0.08 * Math.sin(t * 6 + i);
        m.rot = Math.sin(t * 2 + i * 0.4) * 0.05;
        break;
      case 'glitch': {
        var g = hash(i * 91 + Math.floor(t * 10) * 57);
        if (g < 0.2) { m.dx = (hash(i + Math.floor(t * 10)) - 0.5) * size * 0.5; m.dy = (hash(i * 3 + Math.floor(t * 13)) - 0.5) * size * 0.2; m.split = 1; }
        m.dy += Math.sin(t * 1.5 + i) * size * 0.03;
        break;
      }
      case 'spin':
        m.rot = t * 1.6 + i * 0.35;
        m.scale = 0.85 + 0.25 * Math.abs(Math.sin(t * 2 + i));
        m.dy = Math.sin(t * 2.4 + i * 0.7) * size * 0.12;
        break;
      case 'scatter': {
        var ang = t * (0.6 + 0.13 * (i % 5)) + i * 2.4;
        var rad = size * (0.45 + 0.45 * Math.sin(t * 0.9 + i * 2.399));
        m.dx = Math.cos(ang) * rad * 1.7;
        m.dy = Math.sin(ang) * rad;
        m.rot = t * (i % 2 ? 0.9 : -0.9) + i;
        m.scale = 0.9 + 0.2 * Math.sin(t * 1.7 + i * 1.3);
        break;
      }
      case 'cascade': {
        var c = (Math.sin(t * 2.2 - i * 0.55) + 1) / 2;
        m.dy = (1 - c) * -size * 0.9;
        m.alpha = 0.25 + 0.75 * c;
        m.scale = 0.7 + 0.5 * c;
        break;
      }
      case 'flow':
        m.dy = Math.sin(t * 2 + i * 0.6) * size * 0.14;
        m.dx = Math.cos(t * 1.3 + i * 0.45) * size * 0.08;
        m.rot = Math.sin(t * 1.8 + i * 0.5) * 0.1;
        break;
      default: /* wave */
        m.dy = Math.sin(t * 3 + i * 0.55) * size * 0.28;
        m.rot = Math.sin(t * 2 + i * 0.4) * 0.09;
        m.scale = 1 + 0.06 * Math.sin(t * 4 + i * 0.8);
    }
    return m;
  }

  function drawBackground(c, w, h, t) {
    var sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d0221');
    sky.addColorStop(0.45, '#2b0a54');
    sky.addColorStop(0.62, '#7b2f8f');
    sky.addColorStop(0.72, '#ff71ce');
    sky.addColorStop(0.78, '#1a0533');
    sky.addColorStop(1, '#05010f');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    var i, sx, sy;
    c.save();
    for (i = 0; i < stars.length; i++) {
      sx = stars[i].x * w; sy = stars[i].y * h;
      c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + stars[i].p));
      c.fillStyle = '#fff';
      c.fillRect(sx, sy, stars[i].r, stars[i].r);
    }
    c.restore();
    /* sun */
    var sunX = w / 2, sunY = h * 0.58, sunR = h * 0.26;
    var glow = c.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.1);
    glow.addColorStop(0, 'rgba(255,113,206,.55)');
    glow.addColorStop(1, 'rgba(255,113,206,0)');
    c.fillStyle = glow;
    c.fillRect(sunX - sunR * 2.1, sunY - sunR * 2.1, sunR * 4.2, sunR * 4.2);
    var sun = c.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sun.addColorStop(0, '#fffb96');
    sun.addColorStop(0.55, '#ff9e00');
    sun.addColorStop(1, '#ff71ce');
    c.fillStyle = sun;
    c.beginPath(); c.arc(sunX, sunY, sunR, 0, 6.2832); c.fill();
    if (secretOn) { /* chrome ring for the chosen ones */
      c.strokeStyle = '#01cdfe'; c.lineWidth = Math.max(2, h * 0.008);
      c.shadowColor = '#01cdfe'; c.shadowBlur = 24;
      c.beginPath(); c.arc(sunX, sunY, sunR * 1.12, 0, 6.2832); c.stroke();
      c.shadowBlur = 0;
    }
    c.fillStyle = '#1a0533';
    var slitY = sunY + sunR * 0.05, slitH = sunR * 0.045;
    for (i = 0; i < 5; i++) {
      c.fillRect(sunX - sunR - 2, slitY, sunR * 2 + 4, slitH);
      slitY += sunR * 0.17; slitH *= 1.55;
    }
    /* grid floor */
    var horizon = h * 0.72;
    c.fillStyle = '#0d0221';
    c.fillRect(0, horizon, w, h - horizon);
    if (state.grid) {
      c.save();
      c.strokeStyle = 'rgba(1,205,254,.75)';
      c.shadowColor = '#01cdfe'; c.shadowBlur = 8;
      c.lineWidth = Math.max(1, h * 0.002);
      var vpx = w / 2;
      c.beginPath();
      for (i = -12; i <= 12; i++) { c.moveTo(vpx + i * w * 0.03, horizon); c.lineTo(vpx + i * w * 0.16, h); }
      c.stroke();
      var speed = (t * 0.5) % 1;
      c.beginPath();
      for (i = 0; i < 8; i++) {
        var p = ((i + speed) / 8);
        var y = horizon + (h - horizon) * p * p;
        c.moveTo(0, y); c.lineTo(w, y);
      }
      c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,113,206,.9)';
      c.fillRect(0, horizon - 1, w, 2);
    }
  }

  function layoutLetters(c, text, st) {
    c.font = fontString(st);
    var maxW = W * 0.86, lines = [], line = '', li = 0;
    var words = text.split(/(\s+)/);
    if (!text.trim()) words = [];
    words.forEach(function (part) {
      var trial = line + part;
      if (c.measureText(trial).width > maxW && line) { lines.push(line); line = part.trimStart ? part.replace(/^\s+/, '') : part; }
      else line = trial;
    });
    if (line) lines.push(line);
    if (!lines.length) lines = [''];
    var lineH = st.size * 1.18;
    var y0 = H * 0.52 - ((lines.length - 1) * lineH) / 2;
    var out = [];
    lines.forEach(function (ln, r) {
      var total = c.measureText(ln).width;
      var x = W / 2 - total / 2;
      for (var k = 0; k < ln.length; k++) {
        var ch = ln[k];
        var chw = c.measureText(ch).width;
        if (ch !== ' ') out.push({ ch: ch, x: x + chw / 2, y: y0 + r * lineH });
        x += chw;
      }
    });
    return out;
  }

  function drawLetters(c, letters, st, t) {
    var pal = paletteById(st.palette).letters;
    c.save();
    c.font = fontString(st);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(1.5, st.size * 0.035);
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i];
      var m = motionFor(st.motion, i, t, st.size);
      var col = (st.motion === 'flow' || secretOn)
        ? 'hsl(' + (Math.floor(t * 70 + i * 26) % 360) + ',100%,68%)'
        : pal[(i + Math.floor(t * 2)) % pal.length];
      c.save();
      c.globalAlpha = m.alpha;
      c.translate(L.x + m.dx, L.y + m.dy);
      c.rotate(m.rot);
      c.scale(m.scale, m.scale);
      if (st.glow) { c.shadowColor = col; c.shadowBlur = st.size * 0.35; }
      if (m.split) { /* chromatic aberration slices */
        c.fillStyle = '#01cdfe'; c.fillText(L.ch, -3, 0);
        c.fillStyle = '#ff71ce'; c.fillText(L.ch, 3, 0);
      }
      if (st.outline) { c.strokeStyle = '#1a0533'; c.strokeText(L.ch, 0, 0); }
      c.fillStyle = col;
      c.fillText(L.ch, 0, 0);
      c.restore();
    }
    c.restore();
  }

  function drawFrame(c, w, h, t, st, useTrail) {
    var scaleX = w / W, scaleY = h / H;
    var letters;
    if (w === W && h === H) {
      drawBackground(c, w, h, t);
      letters = layoutLetters(c, st.text, st);
      if (useTrail && st.trail) {
        trailCtx.save();
        trailCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        trailCtx.globalCompositeOperation = 'destination-out';
        trailCtx.fillStyle = 'rgba(0,0,0,0.14)';
        trailCtx.fillRect(0, 0, W, H);
        trailCtx.restore();
        trailCtx.save();
        trailCtx.font = fontString(st);
        trailCtx.textAlign = 'center'; trailCtx.textBaseline = 'middle';
        trailCtx.lineJoin = 'round';
        /* paint letters into trail layer */
        var pal = paletteById(st.palette).letters;
        trailCtx.font = fontString(st);
        for (var i = 0; i < letters.length; i++) {
          var L = letters[i], m = motionFor(st.motion, i, t, st.size);
          var col = (st.motion === 'flow' || secretOn)
            ? 'hsl(' + (Math.floor(t * 70 + i * 26) % 360) + ',100%,68%)'
            : pal[(i + Math.floor(t * 2)) % pal.length];
          trailCtx.save();
          trailCtx.globalCompositeOperation = 'source-over';
          trailCtx.globalAlpha = m.alpha * 0.9;
          trailCtx.translate(L.x + m.dx, L.y + m.dy);
          trailCtx.rotate(m.rot); trailCtx.scale(m.scale, m.scale);
          if (st.glow) { trailCtx.shadowColor = col; trailCtx.shadowBlur = st.size * 0.3; }
          if (st.outline) { trailCtx.strokeStyle = '#1a0533'; trailCtx.lineWidth = Math.max(1.5, st.size * 0.035); trailCtx.strokeText(L.ch, 0, 0); }
          trailCtx.fillStyle = col;
          trailCtx.fillText(L.ch, 0, 0);
          trailCtx.restore();
        }
        c.save();
        c.globalAlpha = 0.85;
        c.drawImage(trail, 0, 0, w, h);
        c.restore();
        drawLetters(c, letters, Object.assign({}, st, { glow: false }), t);
      } else {
        drawLetters(c, letters, st, t);
      }
    } else {
      /* export-size render: same scene, scaled coordinates */
      c.save();
      c.scale(scaleX, scaleY);
      drawBackground(c, W, H, t);
      letters = layoutLetters(c, st.text, st);
      drawLetters(c, letters, st, t);
      c.restore();
    }
    if (!letters || !letters.length) {
      c.save();
      c.globalAlpha = 0.5;
      c.fillStyle = '#9d8dd6';
      c.font = "400 " + Math.round(h * 0.05) + "px 'Space Grotesk',sans-serif";
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(secretOn ? '\u3000type to feel the chrome\u3000' : 'type above to make it move', w / 2, h * 0.52);
      c.restore();
    }
  }

  /* ---------------- main loop ---------------- */
  var t0 = performance.now(), frames = 0, lastFps = performance.now(), fps = 0;
  function loop(now) {
    var t = ((now - t0) / 1000) * state.speed;
    drawFrame(ctx, W, H, t, state, true);
    frames++;
    if (now - lastFps > 500) {
      fps = Math.round(frames * 1000 / (now - lastFps));
      frames = 0; lastFps = now;
      hudMotion.textContent = state.motion.toUpperCase() + ' // ' + fontById(state.font).label + ' // ' + fps + 'fps';
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- GIF export (self-contained encoder, no deps) ---------------- */
  function buildPalette() {
    var p = [];
    var i, r, g, b;
    for (r = 0; r < 6; r++) for (g = 0; g < 6; g++) for (b = 0; b < 6; b++)
      p.push([Math.round(r * 255 / 5), Math.round(g * 255 / 5), Math.round(b * 255 / 5)]);
    var stops = [[255, 113, 206], [185, 103, 255], [43, 10, 84], [1, 205, 254], [255, 251, 150], [5, 255, 161]];
    for (i = 0; i < 24; i++) {
      var seg = (i / 24) * (stops.length - 1), s0 = Math.floor(seg), f = seg - s0, s1 = Math.min(stops.length - 1, s0 + 1);
      p.push([0, 1, 2].map(function (k) { return Math.round(stops[s0][k] + (stops[s1][k] - stops[s0][k]) * f); }));
    }
    for (i = 0; i < 16; i++) { var v = Math.round(i * 255 / 15); p.push([v, v, v]); }
    return p; /* 216 + 24 + 16 = 256 */
  }
  var GPal = buildPalette();
  var GLut = null;
  function buildLut() {
    if (GLut) return GLut;
    GLut = new Uint8Array(32768);
    for (var q = 0; q < 32768; q++) {
      var r = ((q >> 10) & 31) * 255 / 31, g = ((q >> 5) & 31) * 255 / 31, b = (q & 31) * 255 / 31;
      var best = 0, bd = 1e12;
      for (var i = 0; i < 256; i++) {
        var dr = r - GPal[i][0], dg = g - GPal[i][1], db = b - GPal[i][2];
        var d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = i; if (!d) break; }
      }
      GLut[q] = best;
    }
    return GLut;
  }
  function lzwEncode(minCode, idx) {
    var clear = 1 << minCode, eoi = clear + 1, next = eoi + 1;
    var width = minCode + 1;
    var dict = new Map();
    var out = [], acc = 0, bits = 0;
    function emit(code) {
      acc |= code << bits; bits += width;
      while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; }
    }
    emit(clear);
    var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = prefix * 256 + k;
      if (dict.has(key)) prefix = dict.get(key);
      else {
        emit(prefix);
        if (next < 4096) {
          dict.set(key, next); next++;
          if (next === (1 << width) && width < 12) width++;
        } else { emit(clear); dict.clear(); width = minCode + 1; next = eoi + 1; }
        prefix = k;
      }
    }
    emit(prefix); emit(eoi);
    /* width may have grown past what trailing codes need — emit() already used current width per code; ok */
    if (bits > 0) out.push(acc & 255);
    return out;
  }
  function encodeGif(w, h, framesIdx, delayCs) {
    var bytes = [];
    function str(s) { for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); }
    function u16(v) { bytes.push(v & 255, (v >> 8) & 255); }
    str('GIF89a');
    u16(w); u16(h);
    bytes.push(0xF7, 0, 0); /* GCT flag, 256 colors */
    for (var i = 0; i < 256; i++) bytes.push(GPal[i][0], GPal[i][1], GPal[i][2]);
    str('!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00'); /* loop forever */
    framesIdx.forEach(function (idx) {
      str('!\xF9\x04\x09'); u16(delayCs); bytes.push(0, 0); /* GCE: disposal=2, no transparency */
      bytes.push(0x2C); u16(0); u16(0); u16(w); u16(h); bytes.push(0);
      var minCode = 8;
      bytes.push(minCode);
      var data = lzwEncode(minCode, idx);
      for (var o = 0; o < data.length; o += 255) {
        var n = Math.min(255, data.length - o);
        bytes.push(n);
        for (var j = 0; j < n; j++) bytes.push(data[o + j]);
      }
      bytes.push(0);
    });
    bytes.push(0x3B);
    return new Uint8Array(bytes);
  }

  btnExport.addEventListener('click', function () {
    if (btnExport.disabled) return;
    btnExport.disabled = true;
    exportBar.classList.remove('hidden');
    var fill = exportBar.querySelector('.fill');
    var label = exportBar.querySelector('span');
    var EW = 480, EH = 270, FPS = 12, N = 24;
    var off = document.createElement('canvas');
    off.width = EW; off.height = EH;
    var octx = off.getContext('2d');
    var lut = buildLut();
    var st = Object.assign({}, state, { trail: false });
    var baseT = ((performance.now() - t0) / 1000) * state.speed;
    var framesIdx = [];
    var f = 0;
    toast('rendering ' + N + ' frames…');
    function step() {
      try {
        drawFrame(octx, EW, EH, baseT + f / FPS, st, false);
        var d = octx.getImageData(0, 0, EW, EH).data;
        var idx = new Uint8Array(EW * EH);
        for (var p = 0; p < idx.length; p++) {
          var q = ((d[p * 4] >> 3) << 10) | ((d[p * 4 + 1] >> 3) << 5) | (d[p * 4 + 2] >> 3);
          idx[p] = lut[q];
        }
        framesIdx.push(idx);
      } catch (err) {
        btnExport.disabled = false;
        exportBar.classList.add('hidden');
        toast('export failed: ' + err.message);
        return;
      }
      f++;
      var pct = Math.round((f / N) * 100);
      fill.style.width = pct + '%';
      label.textContent = 'rendering… ' + pct + '%';
      if (f < N) { setTimeout(step, 0); return; }
      label.textContent = 'encoding…';
      setTimeout(function () {
        try {
          var gif = encodeGif(EW, EH, framesIdx, Math.round(100 / FPS));
          var blob = new Blob([gif], { type: 'image/gif' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'kinetic-type.gif';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          toast('⬇ kinetic-type.gif saved — stay chrome ✦');
        } catch (err) { toast('export failed: ' + err.message); }
        btnExport.disabled = false;
        exportBar.classList.add('hidden');
        fill.style.width = '0';
      }, 30);
    }
    setTimeout(step, 30);
  });

  /* ---------------- boot ---------------- */
  window.addEventListener('resize', function () { /* canvas is fixed-res, CSS scales it */ });
  fitCanvas();
  syncUI();
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { /* crisper once webfonts land */ }); }
  try { console.log('%cKINETIC TYPE PLAYGROUND%c psst… type "vaporwave"',
    'background:#ff71ce;color:#0d0221;font-weight:bold;padding:2px 6px', 'color:#01cdfe'); } catch (e) {}
  requestAnimationFrame(loop);
})();
