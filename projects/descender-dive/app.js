// Descender Dive 潜水降下 — depth bends variable type, bubbles rise, tide breathes.
// Plain script (no modules) so it works from file:// and any static host.
(function () {
  "use strict";
  var LS_KEY = "descender-dive-v1";

  var ocean = document.getElementById("ocean");
  var headline = document.getElementById("headline");
  var sublineText = document.getElementById("sublineText");
  var textInput = document.getElementById("textInput");
  var depthSlider = document.getElementById("depth");
  var depthVal = document.getElementById("depthVal");
  var depthHint = document.getElementById("depthHint");
  var zoneName = document.getElementById("zoneName");
  var varRead = document.getElementById("varRead");
  var tideBtn = document.getElementById("tideBtn");
  var soundBtn = document.getElementById("soundBtn");
  var burstBtn = document.getElementById("burstBtn");
  var exportBtn = document.getElementById("exportBtn");
  var canvas = document.getElementById("bubbles");
  var ctx = canvas.getContext("2d");

  var state = { text: "沈め、文字を。", depth: 18, tide: false, sound: true };
  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (saved && typeof saved === "object") {
      if (typeof saved.text === "string" && saved.text) state.text = saved.text.slice(0, 60);
      if (isFinite(saved.depth)) state.depth = Math.min(100, Math.max(0, +saved.depth));
      if (typeof saved.tide === "boolean") state.tide = saved.tide;
      if (typeof saved.sound === "boolean") state.sound = saved.sound;
    }
  } catch (e) { /* fresh dive */ }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- sound: WebAudio only, zero assets ---------------- */
  var AC = null, master = null;
  function audio() {
    if (!state.sound) return null;
    try {
      if (!AC) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        AC = new Ctor();
        master = AC.createGain();
        master.gain.value = 0.35;
        master.connect(AC.destination);
      }
      if (AC.state === "suspended") AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    var ac = audio();
    if (!ac) return;
    try {
      var t = ac.currentTime + (delay || 0);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(Math.max(30, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.5, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  var sfx = {
    blip: function () { tone(420 + Math.random() * 500, 900 + Math.random() * 900, 0.22, "sine", 0.4); },
    pop: function () { tone(700 + Math.random() * 300, 180, 0.12, "triangle", 0.3); },
    tick: function () { tone(1200, 900, 0.05, "square", 0.08); },
    whoosh: function () { tone(160, 640, 0.5, "sawtooth", 0.12); tone(640, 160, 0.5, "sine", 0.15, 0.05); },
    shutter: function () { tone(2400, 2400, 0.06, "square", 0.2); tone(1200, 1200, 0.09, "square", 0.2, 0.09); tone(300, 900, 0.4, "sine", 0.2, 0.2); }
  };
  window.addEventListener("pointerdown", function init() { if (state.sound) audio(); }, { once: true });

  /* ---------------- variable-type depth engine ---------------- */
  function zoneFor(d) {
    if (d < 25) return ["表層 · SUNLIT SURFACE", "surface — light, wide, featherweight"];
    if (d < 50) return ["中層 · TWILIGHT DRIFT", "twilight — squeeze begins"];
    if (d < 78) return ["深海 · MIDNIGHT PRESSURE", "midnight — heavy, narrow, wobbling"];
    return ["海溝 · HADAL CRUSH", "trench — maximum crush"];
  }
  function applyDepth(d, silent) {
    state.depth = Math.min(100, Math.max(0, Math.round(d)));
    var wght = Math.round(200 + state.depth * 7.5);      // 200 → 950
    var wdth = Math.round(130 - state.depth * 0.9);      // 130 → 40
    var wob = (state.depth / 100) * 8;                   // wobble px
    var root = document.documentElement;
    root.style.setProperty("--depth", state.depth);
    root.style.setProperty("--wght", wght);
    root.style.setProperty("--wdth", wdth);
    root.style.setProperty("--wob", wob.toFixed(1) + "px");
    root.style.setProperty("--glow", (0.35 + state.depth / 100 * 0.65).toFixed(2));
    depthSlider.value = state.depth;
    depthSlider.style.setProperty("--p", state.depth + "%");
    depthVal.textContent = state.depth * 11; // metres, playful: 0 → 1100m
    var z = zoneFor(state.depth);
    zoneName.textContent = z[0];
    depthHint.textContent = "— " + z[1];
    varRead.textContent = "wght " + wght + " · wdth " + wdth + " · wob ±" + wob.toFixed(1) + "px";
    sublineText.textContent = "wght " + wght + " · wdth " + wdth + " — 生きている文字 (" + z[0] + ")";
    if (!silent) persist();
  }

  /* ---------------- kinetic headline ---------------- */
  function renderHeadline() {
    var s = state.text || "沈め";
    headline.textContent = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < s.length; i++) {
      var sp = document.createElement("span");
      sp.className = "ch";
      sp.textContent = s[i];
      sp.style.setProperty("--i", i);
      frag.appendChild(sp);
    }
    headline.appendChild(frag);
  }
  function chars() { return headline.querySelectorAll(".ch"); }

  var t0 = performance.now();
  var tidePhase = 0;
  function frame(now) {
    var t = (now - t0) / 1000;
    if (state.tide) {
      // tide breathes depth on its own
      tidePhase += 0.016;
      var auto = 50 + 48 * Math.sin(tidePhase * 0.7);
      applyDepth(auto, true);
      var list = chars();
      var amp = 4 + state.depth / 100 * 14;
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        var y = Math.sin(t * 2.2 + i * 0.55) * amp;
        var r = Math.sin(t * 1.6 + i * 0.4) * (1 + state.depth / 40);
        el.style.transform = "translateY(" + y.toFixed(1) + "px) rotate(" + r.toFixed(2) + "deg)";
      }
    } else {
      // idle micro-wobble scaled by depth (cheap: only when deep enough)
      if (state.depth > 4) {
        var list2 = chars();
        var a2 = state.depth / 100 * 5;
        for (var j = 0; j < list2.length; j++) {
          var el2 = list2[j];
          el2.style.transform = "translateY(" + (Math.sin(t * 1.4 + j * 0.7) * a2).toFixed(1) + "px)";
        }
      }
    }
    updateBubbles();
    requestAnimationFrame(frame);
  }

  /* ---------------- bubble letters (canvas) ---------------- */
  var KANA = "あカサタナハマヤラワ0123456789ABC沈潜泡海潮音降 Dive".replace(/ /g, "").split("");
  var bubbles = [];
  function sizeCanvas() {
    var r = ocean.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawnBubble(x, y, big) {
    var r = ocean.getBoundingClientRect();
    var pool = (state.text || "") + KANA.join("");
    var ch = pool[Math.floor(Math.random() * pool.length)] || "泡";
    bubbles.push({
      ch: ch,
      x: x !== undefined ? x : Math.random() * r.width,
      y: y !== undefined ? y : r.height * (0.55 + Math.random() * 0.4),
      rad: big ? 20 + Math.random() * 22 : 9 + Math.random() * 16,
      vy: 0.5 + Math.random() * 1.1 + state.depth / 130,
      ph: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.25 ? "255,45,120" : "0,240,255",
      born: performance.now()
    });
    if (bubbles.length > 140) bubbles.splice(0, bubbles.length - 140);
  }
  function updateBubbles() {
    var r = ocean.getBoundingClientRect();
    // fade canvas slightly differently: full clear, redraw
    ctx.clearRect(0, 0, r.width, r.height);
    var now = performance.now();
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i];
      b.y -= b.vy;
      b.ph += 0.03;
      b.x += Math.sin(b.ph) * 0.5;
      var age = (now - b.born) / 1000;
      var alpha = b.y < 60 ? Math.max(0, b.y / 60) : Math.min(1, age * 3 + 0.25);
      if (b.y < -30 || alpha <= 0) {
        if (b.y < 40 && b.y > -30) sfx.pop();
        bubbles.splice(i, 1);
        continue;
      }
      // bubble sphere
      ctx.globalAlpha = alpha * 0.9;
      var g = ctx.createRadialGradient(b.x - b.rad * 0.3, b.y - b.rad * 0.3, b.rad * 0.1, b.x, b.y, b.rad);
      g.addColorStop(0, "rgba(255,255,255,.85)");
      g.addColorStop(0.35, "rgba(" + b.hue + ",.28)");
      g.addColorStop(1, "rgba(" + b.hue + ",.06)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.rad, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(" + b.hue + ",.8)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.rad, 0, Math.PI * 2); ctx.stroke();
      // glyph inside
      ctx.fillStyle = "rgba(234,246,255," + (alpha * 0.95).toFixed(2) + ")";
      ctx.font = "700 " + Math.max(10, Math.round(b.rad * 0.95)) + 'px "Zen Kaku Gothic New", sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.ch, b.x, b.y + 1);
      // specular dot
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(b.x - b.rad * 0.32, b.y - b.rad * 0.34, Math.max(1, b.rad * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- poster export (PNG 1080×1350) ---------------- */
  function exportPoster() {
    sfx.shutter();
    var W = 1080, H = 1350;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g2 = c.getContext("2d");
    var d = state.depth / 100;
    var bg = g2.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgb(" + Math.round(30 - d * 22) + "," + Math.round(60 - d * 40) + "," + Math.round(140 - d * 90) + ")");
    bg.addColorStop(0.5, "#0a1230");
    bg.addColorStop(1, "#03040c");
    g2.fillStyle = bg; g2.fillRect(0, 0, W, H);
    // neon grid sea floor
    g2.strokeStyle = "rgba(0,240,255,.35)"; g2.lineWidth = 2;
    for (var i = 0; i <= 12; i++) {
      g2.beginPath(); g2.moveTo(0, 950 + i * 32); g2.lineTo(W, 950 + i * 32); g2.stroke();
    }
    // moon
    var moon = g2.createRadialGradient(W / 2, 220, 10, W / 2, 220, 200);
    moon.addColorStop(0, "rgba(255,255,255,.95)");
    moon.addColorStop(0.4, "rgba(0,240,255,.5)");
    moon.addColorStop(1, "rgba(0,240,255,0)");
    g2.fillStyle = moon; g2.beginPath(); g2.arc(W / 2, 220, 200, 0, Math.PI * 2); g2.fill();
    // vertical JP
    g2.save();
    g2.fillStyle = "rgba(234,246,255,.8)";
    g2.font = "700 44px 'Zen Kaku Gothic New', sans-serif";
    g2.translate(90, 320);
    g2.fillText("デ", 0, 0); g2.fillText("ィ", 0, 60); g2.fillText("セ", 0, 120);
    g2.fillText("ン", 0, 180); g2.fillText("ダ", 0, 240); g2.fillText("｜", 0, 300); g2.fillText("ダ", 0, 360); g2.fillText("イ", 0, 420); g2.fillText("ブ", 0, 480);
    g2.restore();
    g2.save();
    g2.translate(W - 110, 320);
    g2.fillStyle = "rgba(249,240,2,.85)";
    g2.font = "700 40px 'Zen Kaku Gothic New', sans-serif";
    var rv = "海溝一一〇〇米".split("");
    for (var vi = 0; vi < rv.length; vi++) g2.fillText(rv[vi], 0, vi * 58);
    g2.restore();
    // headline wrapped, squeezed by depth
    var wght = Math.round(200 + state.depth * 7.5);
    var squeeze = 1 - d * 0.35;
    g2.save();
    g2.translate(W / 2, 640);
    g2.scale(squeeze, 1);
    g2.textAlign = "center";
    g2.fillStyle = "#fff";
    g2.shadowColor = "#00f0ff"; g2.shadowBlur = 40;
    g2.font = wght + " 120px 'Roboto Flex','Zen Kaku Gothic New',sans-serif";
    var words = (state.text || "沈め").split(" ");
    var lines = [], line = "";
    words.forEach(function (w) {
      var t = line ? line + " " + w : w;
      if (g2.measureText(t).width > W * 0.86 / squeeze && line) { lines.push(line); line = w; }
      else line = t;
    });
    if (line) lines.push(line);
    if (lines.join("").length > 24) { // hard wrap long unbroken strings
      lines = []; var s = state.text || "沈め";
      for (var k = 0; k < s.length; k += 8) lines.push(s.slice(k, k + 8));
    }
    lines.slice(0, 4).forEach(function (ln, idx) {
      g2.fillText(ln, 0, idx * 140 - (lines.length - 1) * 40);
    });
    g2.restore();
    // stamp
    g2.save();
    g2.translate(W - 250, H - 250); g2.rotate(0.1);
    g2.strokeStyle = "#ff2d78"; g2.lineWidth = 6; g2.strokeRect(-90, -90, 180, 180);
    g2.fillStyle = "#ff5c8a"; g2.textAlign = "center";
    g2.font = "800 72px serif";
    g2.fillText("潜", 0, -8); g2.fillText("降", 0, 68);
    g2.restore();
    // meta footer
    g2.fillStyle = "rgba(234,246,255,.75)";
    g2.font = "700 30px sans-serif"; g2.textAlign = "center";
    g2.fillText("DESCENDER DIVE · DEPTH " + (state.depth * 11) + "m · " + zoneFor(state.depth)[0], W / 2, H - 90);
    // sprinkle bubbles
    bubbles.slice(0, 40).forEach(function (b) {
      var bx = (b.x / Math.max(1, ocean.clientWidth)) * W;
      var by = (b.y / Math.max(1, ocean.clientHeight)) * H * 0.8 + 120;
      g2.strokeStyle = "rgba(0,240,255,.7)"; g2.lineWidth = 2;
      g2.beginPath(); g2.arc(bx, by, b.rad * 2.2, 0, Math.PI * 2); g2.stroke();
      g2.fillStyle = "rgba(255,255,255,.85)"; g2.font = "700 28px sans-serif"; g2.textAlign = "center";
      g2.fillText(b.ch, bx, by + 9);
    });
    c.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "descender-dive-poster.png";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, "image/png");
  }

  /* ---------------- events ---------------- */
  textInput.value = state.text;
  renderHeadline();
  applyDepth(state.depth, true);
  depthSlider.style.setProperty("--p", state.depth + "%");

  function syncTideBtn() {
    tideBtn.textContent = state.tide ? "🌊 TIDE: ON" : "🌊 TIDE: OFF";
    tideBtn.setAttribute("aria-pressed", state.tide ? "true" : "false");
  }
  function syncSoundBtn() {
    soundBtn.textContent = state.sound ? "🔊 SOUND ON" : "🔇 MUTED";
    soundBtn.setAttribute("aria-pressed", state.sound ? "true" : "false");
  }
  syncTideBtn(); syncSoundBtn();

  textInput.addEventListener("input", function () {
    state.text = textInput.value.slice(0, 60) || "沈め";
    renderHeadline(); persist();
  });
  textInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { sfx.blip(); spawnBubble(undefined, undefined, true); textInput.blur(); }
  });
  headline.addEventListener("input", function () {
    state.text = headline.textContent.slice(0, 60) || "沈め";
    textInput.value = state.text;
    renderHeadline();
    // keep caret at end
    var range = document.createRange(); range.selectNodeContents(headline); range.collapse(false);
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    persist();
  });

  var lastTick = 0;
  depthSlider.addEventListener("input", function () {
    applyDepth(+depthSlider.value);
    var now = performance.now();
    if (now - lastTick > 90) { lastTick = now; sfx.tick(); }
  });
  depthSlider.addEventListener("change", persist);

  tideBtn.addEventListener("click", function () {
    state.tide = !state.tide;
    syncTideBtn(); persist(); sfx.whoosh();
    if (state.tide) for (var i = 0; i < 8; i++) spawnBubble();
  });
  soundBtn.addEventListener("click", function () {
    state.sound = !state.sound;
    syncSoundBtn(); persist();
    if (state.sound) sfx.blip();
  });
  burstBtn.addEventListener("click", function () {
    var r = ocean.getBoundingClientRect();
    for (var i = 0; i < 14; i++) spawnBubble(Math.random() * r.width, r.height * (0.4 + Math.random() * 0.5), i % 4 === 0);
    sfx.blip(); setTimeout(function () { sfx.pop(); }, 120);
  });
  exportBtn.addEventListener("click", exportPoster);

  ocean.addEventListener("pointerdown", function (e) {
    if (e.target === headline || headline.contains(e.target)) return; // let editing win
    var r = ocean.getBoundingClientRect();
    spawnBubble(e.clientX - r.left, e.clientY - r.top, false);
    sfx.blip();
  });

  window.addEventListener("resize", sizeCanvas);
  sizeCanvas();
  for (var i = 0; i < 10; i++) spawnBubble();
  requestAnimationFrame(frame);
  console.log("descender-dive ready — depth bends type. click the ocean.");
})();
