/* KERN PANIC — kinetic type physics + mic-reactive weight + PNG poster export.
   Plain script (file:// safe). System fonts only. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("stage"), ctx = canvas.getContext("2d");
  var wordInput = $("word"), toastEl = $("toast"), countEl = $("count"),
      clockEl = $("clock"), meterFill = $("meterFill"), levelPct = $("levelPct"),
      soundDot = $("soundDot"), captionEl = $("caption");

  var P = { gravity: 0.55, wind: 0, bounce: 0.72, size: 64, react: 1.0,
            ink: "#111111", paper: "#F4F1EA", title: "KERN PANIC N°001" };
  try {
    var saved = JSON.parse(localStorage.getItem("kern-panic") || "{}");
    for (var k in saved) if (k in P) P[k] = saved[k];
  } catch (e) {}
  function persist() {
    try { localStorage.setItem("kern-panic", JSON.stringify({
      gravity: P.gravity, wind: P.wind, bounce: P.bounce, size: P.size,
      react: P.react, ink: P.ink, paper: P.paper, title: P.title })); } catch (e) {}
  }

  // ---- state ----
  var letters = [], frozen = false, W = 900, H = 560, DPR = 1;
  var level = 0, levelSmooth = 0, panikMode = false, panikTimer = 0;
  var paletteMix = ["#111111", "#E30613", "#111111", "#0B3D91", "#111111"];

  function resize() {
    var r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(r.width)); H = Math.round(r.height);
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);

  function pickInk(i) {
    if (P.ink === "#111111|mix") return paletteMix[i % paletteMix.length];
    if (P.paper === "#111111" && P.ink === "#111111") return "#F4F1EA";
    if (P.paper === "#E30613" && P.ink === "#111111") return "#FFFFFF";
    return P.ink;
  }

  function spawnWord(word, opts) {
    opts = opts || {};
    word = (word || "").slice(0, 24);
    if (!word.trim()) return;
    // EASTER EGG — typing "panik" detonates PANIK MODE
    if (/^panik$/i.test(word.trim())) { triggerPanik(); return; }
    var n = letters.length;
    for (var i = 0; i < word.length; i++) {
      var ch = word[i];
      if (ch === " ") continue;
      var size = P.size * (0.8 + Math.random() * 0.55);
      letters.push({
        ch: ch.toUpperCase(),
        x: W * 0.15 + Math.random() * W * 0.7,
        y: opts.fromTop ? -30 - i * 34 : 40 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 9 + (opts.kick || 0),
        vy: 1 + Math.random() * 3,
        angle: (Math.random() - 0.5) * 0.6,
        va: (Math.random() - 0.5) * 0.15,
        size: size, r: size * 0.42,
        jitter: Math.random() * 1000,
        ink: pickInk(n + i)
      });
    }
    if (letters.length > 220) letters.splice(0, letters.length - 220);
    updateCount();
  }

  function updateCount() { countEl.textContent = letters.length + " GLYPHS"; }

  function triggerPanik() {
    panikMode = true; panikTimer = 60 * 6;
    document.body.classList.add("panik");
    toast("◦◦◦ PANIK MODE — GRID IS LAWLESS ◦◦◦", true);
    var words = ["PANIK", "HELVETICA", "RASTER", "AKZIDENZ"];
    for (var w = 0; w < words.length; w++) {
      for (var i = 0; i < words[w].length; i++) {
        letters.push({ ch: words[w][i], x: Math.random() * W, y: -40 - Math.random() * 300,
          vx: (Math.random() - 0.5) * 16, vy: Math.random() * 4,
          angle: (Math.random() - 0.5), va: (Math.random() - 0.5) * 0.4,
          size: 50 + Math.random() * 90, r: 34, jitter: Math.random() * 999,
          ink: Math.random() < 0.5 ? "#FFFFFF" : "#111111" });
      }
    }
    if (letters.length > 260) letters.splice(0, letters.length - 260);
    updateCount();
    setTimeout(function () {
      document.body.classList.remove("panik"); panikMode = false;
    }, 6000);
  }
  // Konami backup easter egg
  var konami = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"], ki = 0;
  document.addEventListener("keydown", function (e) {
    if (e.key === konami[ki]) { ki++; if (ki === konami.length) { ki = 0; triggerPanik(); } }
    else ki = 0;
  });

  // ---- physics ----
  function step() {
    var g = P.gravity, windF = P.wind * 0.12, b = P.bounce;
    var excite = levelSmooth * P.react;
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i];
      L.vy += g * (0.35 + L.size / 140);
      L.vx += windF + (panikMode ? (Math.random() - 0.5) * 1.4 : 0);
      // sound push: loud = letters hop + spread
      L.vx += (Math.random() - 0.5) * excite * 0.55;
      L.vy -= excite * 0.9;
      L.vx *= 0.992; L.vy *= 0.999; L.va *= 0.99;
      L.x += L.vx; L.y += L.vy; L.angle += L.va + L.vx * 0.002;
      var r = L.r;
      if (L.x < r) { L.x = r; L.vx = Math.abs(L.vx) * b; L.va *= -0.8; }
      if (L.x > W - r) { L.x = W - r; L.vx = -Math.abs(L.vx) * b; L.va *= -0.8; }
      if (L.y > H - r) { L.y = H - r; L.vy = -Math.abs(L.vy) * b;
        L.vx *= 0.96;
        if (Math.abs(L.vy) < 0.6) L.vy = 0; }
      if (L.y < -200) { L.y = -200; L.vy = Math.abs(L.vy) * 0.5; }
    }
    // pairwise collide (circle approx, spatial shortcut: cap cost)
    for (var a = 0; a < letters.length; a++) {
      for (var c = a + 1; c < letters.length; c++) {
        var A = letters[a], B = letters[c];
        var dx = B.x - A.x, dy = B.y - A.y;
        var rr = A.r + B.r;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        var d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < rr * rr) {
          var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = (rr - d) / 2;
          A.x -= nx * overlap; A.y -= ny * overlap;
          B.x += nx * overlap; B.y += ny * overlap;
          var rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
          if (rel < 0) {
            var imp = -rel * (0.5 + b * 0.5) / 2;
            A.vx -= nx * imp; A.vy -= ny * imp;
            B.vx += nx * imp; B.vy += ny * imp;
          }
        }
      }
    }
  }

  // ---- render ----
  var t = 0;
  function draw() {
    t++;
    ctx.fillStyle = panikMode ? "#E30613" : P.paper;
    ctx.fillRect(0, 0, W, H);
    // swiss grid
    ctx.strokeStyle = panikMode ? "rgba(255,255,255,.35)" : "rgba(17,17,17,.14)";
    ctx.lineWidth = 1;
    for (var gx = 1; gx < 6; gx++) {
      ctx.beginPath(); ctx.moveTo(W * gx / 6, 0); ctx.lineTo(W * gx / 6, H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.lineTo(W, H * 0.72); ctx.stroke();
    // red baseline bar
    ctx.fillStyle = "#E30613"; ctx.fillRect(0, 0, W, 8);

    var excite = levelSmooth * P.react;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i];
      var jx = panikMode ? (Math.random() - 0.5) * 14 : Math.sin(t * 0.11 + L.jitter) * excite * 7;
      var jy = panikMode ? (Math.random() - 0.5) * 14 : Math.cos(t * 0.09 + L.jitter) * excite * 5;
      var weight = Math.round(Math.min(900, Math.max(150, 560 + excite * 320 + (panikMode ? 200 : 0))));
      var stretch = 1 + Math.min(0.45, excite * 0.35);
      ctx.save();
      ctx.translate(L.x + jx, L.y + jy);
      ctx.rotate(L.angle);
      ctx.scale(1, stretch);
      ctx.font = "900 " + weight + " " + Math.round(L.size) + "px " + swissStack();
      ctx.fillStyle = L.ink;
      if (excite > 0.45) { ctx.shadowColor = "rgba(227,6,19,.55)"; ctx.shadowBlur = 18 * excite; }
      ctx.fillText(L.ch, 0, 0);
      ctx.restore();
    }
    // floor line
    ctx.fillStyle = panikMode ? "#fff" : "#111";
    ctx.fillRect(0, H - 4, W, 4);
  }
  function swissStack() {
    return "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', system-ui, sans-serif";
  }

  function loop() {
    requestAnimationFrame(loop);
    if (frozen) { drawFrozenBadge(); return; }
    step(); draw();
    // ease level
    levelSmooth += (level - levelSmooth) * 0.2;
    meterFill.style.width = Math.round(levelSmooth * 100) + "%";
    levelPct.textContent = Math.round(levelSmooth * 100) + "%";
    soundDot.style.transform = "scale(" + (1 + levelSmooth * 1.6) + ")";
    soundDot.style.background = levelSmooth > 0.5 ? "#E30613" : "#222";
  }

  function drawFrozenBadge() {
    ctx.save();
    ctx.fillStyle = "#111"; ctx.fillRect(W - 178, 20, 158, 30);
    ctx.fillStyle = "#F4F1EA"; ctx.font = "700 12px " + swissStack();
    ctx.textAlign = "center"; ctx.fillText("❚❚ FROZEN — EXPORT READY", W - 99, 40);
    ctx.restore();
  }

  // ---- sound ----
  var audioCtx = null, analyser = null, micStream = null, toneNodes = null;
  function getLevel() {
    if (!analyser) return 0;
    var arr = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(arr);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) { var v = (arr[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / arr.length) * 3.2);
  }
  setInterval(function () { if (!frozen) level = getLevel(); }, 60);

  $("mic").addEventListener("click", function () {
    var btn = this;
    if (micStream) {
      micStream.getTracks().forEach(function (tr) { tr.stop(); });
      micStream = null; analyser = null; level = 0;
      btn.textContent = "⊙ MIC ON"; btn.setAttribute("aria-pressed", "false");
      toast("MIC OFF."); return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("NO MIC API — USE TEST TONE."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      micStream = s;
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var src = audioCtx.createMediaStreamSource(s);
      analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024;
      src.connect(analyser);
      btn.textContent = "⊙ MIC OFF"; btn.setAttribute("aria-pressed", "true");
      toast("MIC LIVE — SHOUT TO BOLDEN TYPE.");
    }).catch(function () { toast("MIC BLOCKED — USE TEST TONE."); });
  });

  $("tone").addEventListener("click", function () {
    var btn = this;
    if (toneNodes) {
      toneNodes.osc.stop(); toneNodes = null; analyser = null; level = 0;
      btn.setAttribute("aria-pressed", "false"); toast("TONE OFF."); return;
    }
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = "sawtooth"; osc.frequency.value = 110;
      gain.gain.value = 0.0; // silent-ish: we analyse pre-gain? use audible low instead
      gain.gain.value = 0.04;
      analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024;
      osc.connect(gain); gain.connect(analyser); analyser.connect(audioCtx.destination);
      osc.start();
      // wobble the frequency so level dances
      var LFO = audioCtx.createOscillator(), LG = audioCtx.createGain();
      LFO.frequency.value = 2.2; LG.gain.value = 60;
      LFO.connect(LG); LG.connect(osc.frequency); LFO.start();
      toneNodes = { osc: osc, lfo: LFO };
      btn.setAttribute("aria-pressed", "true"); toast("TEST TONE ON — TYPE IS DANCING.");
    } catch (e) { toast("AUDIO UNAVAILABLE HERE."); }
  });

  // ---- controls ----
  function bindRange(id, key, fmt, apply) {
    var el = $(id), val = $(id + "Val");
    el.value = P[key];
    if (val) val.textContent = fmt(P[key]);
    el.addEventListener("input", function () {
      P[key] = parseFloat(el.value);
      if (val) val.textContent = fmt(P[key]);
      if (apply) apply();
      persist();
    });
  }
  var f2 = function (v) { return (+v).toFixed(2); };
  bindRange("gravity", "gravity", f2);
  bindRange("wind", "wind", f2);
  bindRange("bounce", "bounce", f2);
  bindRange("size", "size", function (v) { return Math.round(v); });
  bindRange("react", "react", f2);

  $("ink").value = P.ink; $("paper").value = P.paper; $("title").value = P.title;
  captionEl.textContent = "SET IN SYSTEM GROTESK — " + P.title;
  $("ink").addEventListener("change", function () { P.ink = this.value; reink(); persist(); });
  $("paper").addEventListener("change", function () { P.paper = this.value; persist(); });
  $("title").addEventListener("input", function () {
    P.title = this.value; captionEl.textContent = "SET IN SYSTEM GROTESK — " + P.title; persist();
  });
  function reink() { for (var i = 0; i < letters.length; i++) letters[i].ink = pickInk(i); }

  // ---- actions ----
  function toast(msg, panik) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (panik ? " panik" : "");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.className = "toast" + (panik ? " panik" : ""); }, 2600);
  }

  function erupt() {
    var w = wordInput.value || "KERN";
    spawnWord(w, { fromTop: true });
    wordInput.value = ""; wordInput.focus();
  }
  $("erupt").addEventListener("click", erupt);
  wordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); erupt(); }
    e.stopPropagation();
  });
  // global typing spawns too (when not in an input)
  document.addEventListener("keydown", function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key && e.key.length === 1 && /[a-zA-Z0-9?!#*]/.test(e.key)) {
      spawnLetter(e.key, { poke: true });
    } else if (e.key === "Enter") {
      spawnWord(["SWISS", "GRID", "RASTER", "FORM"][Math.floor(Math.random() * 4)], { fromTop: true });
    }
  });
  function spawnLetter(ch, opts) {
    var size = P.size * (0.8 + Math.random() * 0.55);
    letters.push({ ch: ch.toUpperCase(), x: W / 2 + (Math.random() - 0.5) * 200,
      y: 30, vx: (Math.random() - 0.5) * 10, vy: 1 + Math.random() * 2,
      angle: (Math.random() - 0.5) * 0.6, va: (Math.random() - 0.5) * 0.15,
      size: size, r: size * 0.42, jitter: Math.random() * 1000, ink: pickInk(letters.length) });
    if (letters.length > 220) letters.splice(0, letters.length - 220);
    updateCount();
  }

  canvas.addEventListener("pointerdown", function (e) {
    var r = canvas.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i], dx = L.x - px, dy = L.y - py, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var f = Math.max(0, 260 - d) / 260;
      L.vx += (dx / d) * f * 16; L.vy += (dy / d) * f * 16 - f * 4; L.va += (Math.random() - 0.5) * 0.3 * f;
    }
    if (!letters.length) spawnWord("POKE", { fromTop: true });
  });

  $("shake").addEventListener("click", function () {
    letters.forEach(function (L) { L.vx += (Math.random() - 0.5) * 14; L.vy -= 3 + Math.random() * 7; });
    toast("DURCHSCHÜTTELT.");
  });
  $("settle").addEventListener("click", function () {
    letters.forEach(function (L) { L.vx *= 0.2; L.vy = Math.min(L.vy, 1); L.va *= 0.2; L.angle *= 0.5; });
    toast("GESETZT — LETTERS SETTLE.");
  });
  $("clear").addEventListener("click", function () { letters = []; updateCount(); toast("LEER — STAGE CLEARED."); });

  $("freeze").addEventListener("click", function () {
    frozen = !frozen;
    this.textContent = frozen ? "MELT ▶" : "FREEZE ❚❚";
    this.setAttribute("aria-pressed", String(frozen));
    toast(frozen ? "FROZEN — EXPORT YOUR POSTER." : "MELTED — PHYSICS LIVE.");
  });

  // ---- export PNG poster 1200x1500 ----
  $("export").addEventListener("click", function () {
    var EW = 1200, EH = 1500;
    var off = document.createElement("canvas"); off.width = EW; off.height = EH;
    var c = off.getContext("2d");
    var paper = P.paper === "#111111|mix" ? "#F4F1EA" : P.paper;
    c.fillStyle = paper; c.fillRect(0, 0, EW, EH);
    // grid
    c.strokeStyle = "rgba(17,17,17,.16)"; c.lineWidth = 1;
    for (var i = 1; i < 6; i++) { c.beginPath(); c.moveTo(EW * i / 6, 0); c.lineTo(EW * i / 6, EH); c.stroke(); }
    c.fillStyle = "#E30613"; c.fillRect(0, 0, EW, 22);
    // letters mapped from stage coords
    var sx = EW / W, sy = (EH - 300) / H, s = Math.min(sx, sy);
    var ox = (EW - W * s) / 2, oy = 190;
    c.textAlign = "center"; c.textBaseline = "middle";
    var excite = Math.max(levelSmooth, 0.15);
    letters.forEach(function (L) {
      c.save();
      c.translate(ox + L.x * s, oy + L.y * s);
      c.rotate(L.angle); c.scale(1, 1 + Math.min(0.4, excite * 0.3));
      var wgt = Math.round(Math.min(900, Math.max(200, 560 + excite * 300)));
      c.font = "900 " + wgt + " " + Math.round(L.size * s) + "px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      c.fillStyle = (paper === "#111111" && L.ink === "#111111") ? "#F4F1EA" : L.ink;
      c.fillText(L.ch, 0, 0);
      c.restore();
    });
    // swiss footer
    c.fillStyle = "#111"; c.fillRect(80, EH - 190, EW - 160, 4);
    c.fillStyle = paper === "#111111" ? "#F4F1EA" : "#111";
    c.textAlign = "left";
    c.font = "900 64px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    c.fillText((P.title || "KERN PANIC").toUpperCase().slice(0, 28), 80, EH - 120);
    c.font = "400 24px ui-monospace, Menlo, monospace";
    var d = new Date();
    c.fillText("KERN PANIC · " + letters.length + " GLYPHS · " + d.toISOString().slice(0, 10) +
      " · GRID IS LAW", 80, EH - 70);
    c.fillStyle = "#E30613"; c.fillRect(EW - 160, EH - 170, 80, 80);
    try {
      var a = document.createElement("a");
      a.download = "kern-panic-" + Date.now() + ".png";
      a.href = off.toDataURL("image/png");
      document.body.appendChild(a); a.click(); a.remove();
      toast("PLAKAT EXPORTIERT ↓ PNG SAVED.");
    } catch (e) { toast("EXPORT FAILED IN THIS BROWSER."); }
  });

  // ---- clock ----
  setInterval(function () {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    clockEl.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }, 1000);

  // ---- boot ----
  resize();
  setTimeout(resize, 60);
  spawnWord("KERN", { fromTop: true });
  setTimeout(function () { spawnWord("PANIC", { fromTop: true }); }, 450);
  updateCount();
  loop();
})();
