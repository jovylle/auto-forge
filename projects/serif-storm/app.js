/* Serif Storm — gravity letter rain + cursor wind + type-to-spawn + poster export.
   Plain script (no modules) so it works from file:// with zero build.
   Palette: RED #FF3D00, BLUE #2545FF, YELLOW #FFC900 + INK #131313 + PAPER #FFFDF4. */
(function () {
  "use strict";

  var INK = "#131313", PAPER = "#FFFDF4";
  var RED = "#FF3D00", BLUE = "#2545FF", YELLOW = "#FFC900";
  var LETTER_COLORS = [INK, INK, INK, RED, BLUE, RED, BLUE];

  var CORPUS = (
    "storm serif thunder paper ink wind poem glyph thunder verse stanza " +
    "rain cloud lightning margin folio tempest whirl quill blot cascade " +
    "night basin echo hollow murmur static torrent voltage amber signal"
  ).split(" ");

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");

  var glyphCountEl = document.getElementById("stat-glyphs");
  var wordCountEl = document.getElementById("stat-words");
  var windEl = document.getElementById("stat-wind");
  var poemEl = document.getElementById("poem-line");
  var toastEl = document.getElementById("toast");
  var hintEl = document.getElementById("stage-hint");
  var inputEl = document.getElementById("word-input");

  var settings = { gravity: 1, wind: 1, rain: 1, paused: false };
  try {
    var saved = JSON.parse(localStorage.getItem("serif-storm:v1") || "{}");
    if (typeof saved.gravity === "number") settings.gravity = clamp(saved.gravity, 0.1, 3);
    if (typeof saved.wind === "number") settings.wind = clamp(saved.wind, 0, 3);
    if (typeof saved.rain === "number") settings.rain = clamp(saved.rain, 0, 3);
  } catch (e) { /* fresh start */ }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /* ——— canvas sizing (DPR aware) ——— */
  var W = 0, H = 0, DPR = 1, floorY = 0;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    W = Math.max(280, r.width); H = Math.max(280, r.height);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    floorY = H - 64;
    buildStacks();
  }
  window.addEventListener("resize", resize);

  /* ——— state ——— */
  var parts = [];        // flying letters
  var landed = [];       // settled letters forming the poem bed
  var stacks = [];       // per-column settled heights
  var COLS = 48;
  var wordsSpawned = 0;
  var glyphsSpawned = 0;
  var poemWords = [];
  var cursor = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, down: false, energy: 0 };
  var gust = { x: 0, y: 0, r: 0, power: 0 };

  function buildStacks() {
    var fresh = [];
    for (var i = 0; i < COLS; i++) fresh.push(0);
    // re-project old stacks proportionally
    if (stacks.length) {
      for (var j = 0; j < COLS; j++) {
        var src = stacks[Math.floor((j / COLS) * stacks.length)] || 0;
        fresh[j] = src;
      }
    }
    stacks = fresh;
  }
  function colAt(x) { return clamp(Math.floor((x / W) * COLS), 0, COLS - 1); }

  function spawnWord(word, x, opts) {
    opts = opts || {};
    word = String(word || "").replace(/[^a-zA-Z'’-]/g, "").slice(0, 24);
    if (!word) return;
    var n = word.length;
    var size = opts.size || rand(22, 44);
    var startX = clamp(x !== undefined ? x : rand(40, W - 40), 30, W - 30);
    var y = opts.y !== undefined ? opts.y : rand(-120, -20);
    for (var i = 0; i < n; i++) {
      var ch = word[i];
      parts.push({
        ch: ch,
        x: startX + (i - n / 2) * size * 0.72 + rand(-4, 4),
        y: y + rand(-10, 10),
        vx: rand(-20, 20),
        vy: rand(-30, 30),
        size: size * rand(0.9, 1.1),
        rot: rand(-0.4, 0.4),
        vr: rand(-1.5, 1.5),
        color: pick(LETTER_COLORS),
        italic: Math.random() < 0.3
      });
      glyphsSpawned++;
    }
    wordsSpawned++;
    poemWords.push(word);
    if (poemWords.length > 18) poemWords.splice(0, poemWords.length - 18);
    renderPoem();
    updateStats();
  }

  function renderPoem() {
    if (!poemWords.length) { poemEl.textContent = "— the storm is gathering —"; return; }
    var tail = poemWords.slice(-12);
    // break into two verses for rhythm
    var mid = Math.ceil(tail.length / 2);
    poemEl.textContent = tail.slice(0, mid).join(" ") + "  —  " + tail.slice(mid).join(" ");
  }

  function updateStats() {
    glyphCountEl.textContent = glyphsSpawned;
    wordCountEl.textContent = wordsSpawned;
  }

  /* ——— physics ——— */
  var last = performance.now();
  var rainAcc = 0;

  function step(now) {
    requestAnimationFrame(step);
    var rawDt = (now - last) / 1000;
    var dt = rawDt > 0 ? Math.min(0.05, rawDt) : 0.016;
    last = now;
    if (settings.paused) { draw(dt); return; }

    // ambient rain
    rainAcc += dt * settings.rain * 1.6;
    while (rainAcc >= 1) {
      rainAcc -= 1;
      if (parts.length < 420) spawnWord(pick(CORPUS));
    }

    // cursor velocity + decay
    cursor.vx = (cursor.x - cursor.px) / Math.max(dt, 0.001);
    cursor.vy = (cursor.y - cursor.py) / Math.max(dt, 0.001);
    cursor.px = cursor.x; cursor.py = cursor.y;
    var speed = Math.hypot(cursor.vx, cursor.vy);
    cursor.energy += (clamp(speed / 2500, 0, 1.5) - cursor.energy) * Math.min(1, dt * 6);
    windEl.textContent = Math.round(cursor.energy * 100);

    // gust decay
    if (gust.power > 0) gust.power = Math.max(0, gust.power - dt * 2.2);

    var g = 620 * settings.gravity;
    var windAmp = 1;

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vy += g * dt;
      // gentle sway
      p.vx += Math.sin((now / 900) + p.y * 0.02) * 26 * dt;

      // cursor wind: radial push + drag-direction blow, tight falloff
      var dx = p.x - cursor.x, dy = p.y - cursor.y;
      var d2 = dx * dx + dy * dy;
      var R = 190 * windAmp;
      if (d2 < R * R && d2 > 1) {
        var d = Math.sqrt(d2);
        var fall = 1 - d / R;
        var w = settings.wind * (cursor.down ? 2.2 : 1);
        var push = fall * fall * 2600 * w;
        p.vx += (dx / d) * push * dt;
        p.vy += (dy / d) * push * dt;
        // drag direction blow
        p.vx += clamp(cursor.vx, -2500, 2500) * fall * 1.6 * w * dt;
        p.vy += clamp(cursor.vy, -2500, 2500) * fall * 1.1 * w * dt;
        p.vr += (Math.random() - 0.5) * 6 * fall * w * dt;
      }

      // gust shockwave
      if (gust.power > 0) {
        var gx = p.x - gust.x, gy = p.y - gust.y;
        var gd = Math.hypot(gx, gy) || 1;
        var gr = 320;
        if (gd < gr) {
          var gf = (1 - gd / gr) * gust.power * 2400;
          p.vx += (gx / gd) * gf * dt;
          p.vy += (gy / gd) * gf * dt - 300 * gust.power * dt;
        }
      }

      // drag
      p.vx *= (1 - 0.35 * dt);
      p.vy *= (1 - 0.02 * dt);
      p.vx = clamp(p.vx, -900, 900);
      p.vy = clamp(p.vy, -500, 1400);

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      // walls
      if (p.x < 12) { p.x = 12; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > W - 12) { p.x = W - 12; p.vx = -Math.abs(p.vx) * 0.5; }

      // landing on the poem bed
      var col = colAt(p.x);
      var bedTop = floorY - stacks[col];
      if (p.y >= bedTop && p.vy > 0) {
        p.y = bedTop;
        p.vy = 0; p.vx = 0;
        p.rot = clamp(p.rot, -0.3, 0.3) * 0.3;
        landed.push(p);
        parts.splice(i, 1);
        stacks[col] = Math.min(stacks[col] + p.size * 0.42, floorY - 40);
        if (landed.length > 700) {
          var old = landed.shift();
          stacks[colAt(old.x)] = Math.max(0, stacks[colAt(old.x)] - old.size * 0.42);
        }
      }
      // recycle strays
      if (p.y > H + 80) { parts.splice(i, 1); }
    }

    draw(dt);
  }

  function drawGlyph(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.font = (p.italic ? "italic " : "") + "900 " + p.size + 'px "Playfair Display", Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.color;
    ctx.fillText(p.ch, 0, 0);
    ctx.restore();
  }

  function draw(dt) {
    void dt;
    ctx.clearRect(0, 0, W, H);
    // poem-bed rule line
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, floorY + 24);
    ctx.lineTo(W, floorY + 24);
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.fillRect(0, floorY + 27, W, 5);
    ctx.restore();

    for (var i = 0; i < landed.length; i++) drawGlyph(landed[i]);
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j];
      // wind glow ring on strongly blown glyphs
      drawGlyph(p);
    }

    // cursor wind reticle
    if (cursor.x > -100) {
      var r = 26 + cursor.energy * 60 + (cursor.down ? 14 : 0);
      ctx.save();
      ctx.strokeStyle = cursor.down ? RED : BLUE;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cursor.x, cursor.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cursor.x - r - 8, cursor.y); ctx.lineTo(cursor.x - r + 6, cursor.y);
      ctx.moveTo(cursor.x + r - 6, cursor.y); ctx.lineTo(cursor.x + r + 8, cursor.y);
      ctx.moveTo(cursor.x, cursor.y - r - 8); ctx.lineTo(cursor.x, cursor.y - r + 6);
      ctx.moveTo(cursor.x, cursor.y + r - 6); ctx.lineTo(cursor.x, cursor.y + r + 8);
      ctx.stroke();
      ctx.restore();
    }

    // gust ring
    if (gust.power > 0) {
      ctx.save();
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(gust.x, gust.y, (1 - gust.power) * 340 + 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gust.x, gust.y, (1 - gust.power) * 340 + 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ——— input: cursor wind ——— */
  function pointFromEvent(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener("pointermove", function (e) {
    var pt = pointFromEvent(e);
    cursor.x = pt.x; cursor.y = pt.y;
    hideHint();
  });
  canvas.addEventListener("pointerdown", function (e) {
    var pt = pointFromEvent(e);
    cursor.x = pt.x; cursor.y = pt.y;
    cursor.down = true;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    hideHint();
  });
  window.addEventListener("pointerup", function () { cursor.down = false; });
  canvas.addEventListener("pointerleave", function () {
    cursor.x = -9999; cursor.y = -9999;
  });

  var hintHidden = false;
  function hideHint() {
    if (hintHidden) return; hintHidden = true;
    hintEl.style.transition = "opacity .4s";
    hintEl.style.opacity = "0";
    setTimeout(function () { hintEl.style.display = "none"; }, 450);
  }
  setTimeout(hideHint, 9000);

  /* ——— input: type to spawn ——— */
  var buffer = "";
  window.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var w = (inputEl.value || buffer).trim();
      if (w) { fireWord(w); inputEl.value = ""; buffer = ""; }
      return;
    }
    if (e.target === inputEl) return; // let the box handle its own keys
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " ") { e.preventDefault(); doGust(W / 2, H / 2); return; }
    if (/^[a-zA-Z'’-]$/.test(e.key)) {
      buffer += e.key;
      if (buffer.length > 24) buffer = buffer.slice(-24);
      spawnWord(e.key, rand(W * 0.2, W * 0.8), { y: rand(-60, 10), size: rand(30, 54) });
      if (inputEl && document.activeElement !== inputEl) {
        toast("“" + buffer + "” — Enter to rain the word");
      }
      clearTimeout(window.__serifBufT);
      window.__serifBufT = setTimeout(function () {
        if (buffer.length > 1) fireWord(buffer);
        buffer = "";
      }, 1400);
    }
  });
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var w = inputEl.value.trim();
      if (w) fireWord(w);
      inputEl.value = ""; buffer = "";
    }
    e.stopPropagation();
  });

  function fireWord(w) {
    var cx = (cursor.x > 0 && cursor.x < W) ? cursor.x : rand(W * 0.25, W * 0.75);
    spawnWord(w, cx, { size: rand(30, 52) });
    toast("rained “" + w + "”");
  }

  /* ——— controls ——— */
  function bindSlider(id, valId, key) {
    var el = document.getElementById(id);
    var lab = document.getElementById(valId);
    el.value = settings[key];
    lab.textContent = Number(settings[key]).toFixed(1);
    el.addEventListener("input", function () {
      settings[key] = Number(el.value);
      lab.textContent = Number(el.value).toFixed(1);
      persist();
    });
  }
  bindSlider("ctl-gravity", "v-gravity", "gravity");
  bindSlider("ctl-wind", "v-wind", "wind");
  bindSlider("ctl-rain", "v-rain", "rain");

  function persist() {
    try {
      localStorage.setItem("serif-storm:v1", JSON.stringify({
        gravity: settings.gravity, wind: settings.wind, rain: settings.rain
      }));
    } catch (e) { /* private mode */ }
  }

  document.getElementById("btn-spawn").addEventListener("click", function () {
    var w = (inputEl.value || "").trim() || pick(CORPUS);
    fireWord(w);
    inputEl.value = "";
    inputEl.focus();
  });

  function doGust(x, y) {
    gust.x = x; gust.y = y; gust.power = 1;
    toast("💨 gust!");
  }
  document.getElementById("btn-gust").addEventListener("click", function () {
    doGust(cursor.x > 0 ? cursor.x : W / 2, cursor.y > 0 ? cursor.y : H / 2);
  });

  var pauseBtn = document.getElementById("btn-pause");
  pauseBtn.addEventListener("click", function () {
    settings.paused = !settings.paused;
    pauseBtn.textContent = settings.paused ? "Resume" : "Pause";
    toast(settings.paused ? "frozen ❄" : "storm resumes");
  });

  document.getElementById("btn-clear").addEventListener("click", function () {
    parts.length = 0; landed.length = 0; poemWords.length = 0;
    for (var i = 0; i < COLS; i++) stacks[i] = 0;
    renderPoem(); updateStats();
    toast("swept clean");
  });

  document.getElementById("btn-copy-poem").addEventListener("click", function () {
    var t = poemEl.textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("poem copied"); });
    else toast("copy: " + t);
  });

  var toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  /* ——— poster export (1080 × 1350) ——— */
  document.getElementById("btn-poster").addEventListener("click", function () {
    try {
      var pw = 1080, ph = 1350;
      var off = document.createElement("canvas");
      off.width = pw; off.height = ph;
      var c = off.getContext("2d");

      // paper + frame
      c.fillStyle = PAPER; c.fillRect(0, 0, pw, ph);
      c.strokeStyle = INK; c.lineWidth = 14;
      c.strokeRect(20, 20, pw - 40, ph - 40);
      // masthead
      c.fillStyle = INK; c.fillRect(20, 20, pw - 40, 190);
      c.fillStyle = YELLOW; c.fillRect(60, 60, 96, 96);
      c.fillStyle = INK;
      c.font = "900 72px 'Playfair Display', Georgia, serif";
      c.textBaseline = "middle";
      c.fillText("SS", 74, 112);
      c.fillStyle = PAPER;
      c.font = "900 84px 'Playfair Display', Georgia, serif";
      c.fillText("SERIF STORM", 180, 105);
      c.fillStyle = YELLOW;
      c.font = "700 30px 'Space Grotesk', sans-serif";
      c.fillText("A POEM CAUGHT MID-FALL  ⛈", 182, 168);

      // storm snapshot
      var snapH = 640;
      c.save();
      c.beginPath();
      c.rect(60, 250, pw - 120, snapH);
      c.clip();
      c.fillStyle = "#fff";
      c.fillRect(60, 250, pw - 120, snapH);
      c.drawImage(canvas, 60, 250, pw - 120, snapH);
      c.restore();
      c.strokeStyle = INK; c.lineWidth = 8;
      c.strokeRect(60, 250, pw - 120, snapH);
      c.fillStyle = RED; c.fillRect(60, 250 + snapH, pw - 120, 12);

      // poem text
      c.fillStyle = INK;
      c.font = "italic 700 40px 'Playfair Display', Georgia, serif";
      var words = poemEl.textContent || "";
      wrapText(c, "“" + words + "”", 80, 990, pw - 160, 52);

      // footer strip
      c.fillStyle = BLUE; c.fillRect(20, ph - 160, pw - 40, 140);
      c.fillStyle = PAPER;
      c.font = "700 30px 'Space Grotesk', sans-serif";
      var d = new Date();
      c.fillText("words: " + wordsSpawned + "   glyphs: " + glyphsSpawned, 60, ph - 100);
      c.fillText(pad(d.getFullYear()) + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "  ·  serif storm", 60, ph - 55);

      var a = document.createElement("a");
      a.download = "serif-storm-poster.png";
      a.href = off.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("poster exported ⬇");
    } catch (err) {
      toast("export failed");
    }
  });

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function wrapText(c, text, x, y, maxW, lh) {
    var words = String(text).split(/\s+/);
    var line = "", yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, yy); yy += lh; line = words[i];
      } else line = test;
    }
    if (line) c.fillText(line, x, yy);
  }

  /* ——— boot ——— */
  resize();
  buildStacks();
  updateStats();
  renderPoem();
  // opening volley so first paint is alive
  for (var k = 0; k < 5; k++) spawnWord(pick(CORPUS), rand(40, Math.max(41, W - 40)), { y: rand(-300, -20) });
  draw(0); // synchronous first paint (before rAF kicks in)
  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(step); });
})();
