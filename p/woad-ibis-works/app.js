/* Woad Ibis Works — river canvas + flight dye + pigment export
   Palette (hard constraint: 3 colors + black/white ONLY):
   paper #FFFEF7 · ink #111111 · woad #2447F9 · rust #FF4D00 · reed #FFD02B
   All translucency is rgba() of those five. No other color literals anywhere. */
(function () {
  "use strict";

  var PAPER = "#FFFEF7";
  var INK = "#111111";
  var PIGMENTS = {
    woad: { name: "WOAD", hex: "#2447F9" },
    rust: { name: "IBIS RUST", hex: "#FF4D00" },
    reed: { name: "REED GOLD", hex: "#FFD02B" }
  };
  var PIG_IDS = ["woad", "rust", "reed"];
  var MAX_DYE = 3500;
  var STORE_KEY = "woad-ibis-works-v1";

  // ---------- dom ----------
  function $(id) { return document.getElementById(id); }
  var canvas = $("river"), wrap = $("riverWrap");
  var ctx = canvas.getContext("2d");
  var satChip = $("satChip"), dyeChip = $("dyeChip"), stamp = $("stamp");
  var flightBadge = $("flightBadge"), ledger = $("ledger");
  var toastEl = $("toast");

  // ---------- state ----------
  var W = 0, H = 0, DPR = 1, T = 0;
  var paused = false;
  var selected = "woad";
  var ibis = [];
  var dye = [];
  var counts = { woad: 0, rust: 0, reed: 0 };
  var flights = 0;
  var gusts = [];
  var settings = { flow: 1.1, wind: 0, dyeLoad: 1.2, trails: true, auto: true };
  var uid = 0;

  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      if (s && typeof s === "object") {
        if (s.settings) {
          if (isFinite(+s.settings.flow)) settings.flow = Math.min(3, Math.max(0.2, +s.settings.flow));
          if (isFinite(+s.settings.wind)) settings.wind = Math.min(100, Math.max(-100, +s.settings.wind));
          if (isFinite(+s.settings.dyeLoad)) settings.dyeLoad = Math.min(2.5, Math.max(0.1, +s.settings.dyeLoad));
          if (typeof s.settings.trails === "boolean") settings.trails = s.settings.trails;
          if (typeof s.settings.auto === "boolean") settings.auto = s.settings.auto;
        }
        if (isFinite(+s.flights)) flights = Math.max(0, Math.min(99999, +s.flights | 0));
        if (s.counts) PIG_IDS.forEach(function (k) {
          if (isFinite(+s.counts[k])) counts[k] = Math.max(0, Math.min(99999, +s.counts[k] | 0));
        });
        if (PIG_IDS.indexOf(s.selected) > -1) selected = s.selected;
      }
    }
  } catch (e) { /* storage unavailable — run fresh */ }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        settings: settings, counts: counts, flights: flights, selected: selected
      }));
    } catch (e) { /* ignore */ }
  }
  var persistSoon = (function () {
    var t = 0;
    return function () { clearTimeout(t); t = setTimeout(persist, 400); };
  })();

  // ---------- river geometry ----------
  function centerY(x, t) { return H * 0.52 + Math.sin(x * 0.004 + t * 0.00042) * H * 0.075; }
  function halfW() { return Math.max(46, H * 0.21); }
  function inRiver(x, y, t) { return Math.abs(y - centerY(x, t)) < halfW(); }

  // ---------- flock ----------
  function spawnIbis(pig, x, y) {
    var sx = (x === undefined) ? -30 : x;
    var sy = (y === undefined) ? centerY(20, T) + (Math.random() * 2 - 1) * halfW() * 0.7 : y;
    ibis.push({
      id: ++uid,
      x: sx, y: sy,
      speed: 1.3 + Math.random() * 1.1,
      bobA: 14 + Math.random() * 26,
      bobF: 0.004 + Math.random() * 0.005,
      ph: Math.random() * Math.PI * 2,
      flap: 6 + Math.random() * 5,
      pig: PIG_IDS.indexOf(pig) > -1 ? pig : PIG_IDS[(Math.random() * 3) | 0],
      trail: []
    });
  }
  function releaseFlock(n, mixed) {
    for (var i = 0; i < n; i++) {
      var pig = mixed ? PIG_IDS[i % 3] : selected;
      setTimeout((function (p, k) {
        return function () { spawnIbis(p, -30 - k * 46, undefined); };
      })(pig, i), i * 160);
    }
    toast("Flock away — " + n + " ibis on " + (mixed ? "MIXED" : PIGMENTS[selected].name) + " dye.");
  }

  // ---------- dye ----------
  function deposit(x, y, pig) {
    if (dye.length >= MAX_DYE) {
      var gone = dye.splice(0, 24);
      gone.forEach(function (p) { counts[p.pig] = Math.max(0, counts[p.pig] - 1); });
    }
    dye.push({
      x: x + (Math.random() * 6 - 3),
      y: y + (Math.random() * 6 - 3),
      pig: pig,
      size: 1.6 + Math.random() * 3.4,
      life: 1,
      seed: Math.random() * 10
    });
    counts[pig]++;
  }

  function gustAt(x, y, power) {
    gusts.push({ x: x, y: y, r: 8, max: 90 + power * 40, a: 0.9 });
    var R = 130;
    ibis.forEach(function (b) {
      var dx = b.x - x, dy = b.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < R && d > 1) {
        b.y += (dy / d) * power * 26;
        b.x += (dx / d) * power * 10;
      }
    });
    dye.forEach(function (p) {
      var dx = p.x - x, dy = p.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 110 && d > 1) {
        p.x += (dx / d) * power * 14;
        p.y += (dy / d) * power * 14;
      }
    });
  }

  // ---------- update ----------
  function update() {
    T += 16;
    var flow = settings.flow;

    for (var i = ibis.length - 1; i >= 0; i--) {
      var b = ibis[i];
      b.x += b.speed * (0.55 + flow * 0.55);
      b.y += Math.sin(T * b.bobF + b.ph) * 0.9 + settings.wind * 0.012;
      b.ph += 0.09;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 46) b.trail.shift();
      if (inRiver(b.x, b.y, T) && Math.random() < 0.62 * settings.dyeLoad) {
        deposit(b.x, b.y, b.pig);
      }
      if (b.y < 8) b.y = 8;
      if (b.y > H - 8) b.y = H - 8;
      if (b.x > W + 40) {
        ibis.splice(i, 1);
        flights++;
        logFlight(b);
      }
    }

    for (var j = dye.length - 1; j >= 0; j--) {
      var p = dye[j];
      p.x += (0.5 + flow * 1.05) + Math.sin(p.y * 0.02 + T * 0.001 + p.seed) * 0.5;
      p.y += Math.sin(p.x * 0.008 + T * 0.0012 + p.seed) * 0.35 + settings.wind * 0.004;
      p.life -= 0.00045;
      if (p.x > W + 12 || p.life <= 0) {
        counts[p.pig] = Math.max(0, counts[p.pig] - 1);
        dye.splice(j, 1);
      }
    }

    for (var g = gusts.length - 1; g >= 0; g--) {
      gusts[g].r += 3.2;
      gusts[g].a -= 0.03;
      if (gusts[g].a <= 0 || gusts[g].r > gusts[g].max) gusts.splice(g, 1);
    }

    if (settings.auto && !paused && ibis.length < 7 && Math.random() < 0.008) {
      spawnIbis(Math.random() < 0.62 ? "woad" : PIG_IDS[(Math.random() * 3) | 0]);
    }
  }

  // ---------- render ----------
  function hexA(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function draw() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // graph-paper grid (ink at low alpha)
    ctx.strokeStyle = "rgba(17,17,17,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx < W; gx += 28) { ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); }
    for (var gy = 0; gy < H; gy += 28) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); }
    ctx.stroke();

    var hw = halfW();

    // river wash
    ctx.beginPath();
    for (var x = 0; x <= W; x += 8) {
      var c = centerY(x, T);
      if (x === 0) ctx.moveTo(x, c - hw); else ctx.lineTo(x, c - hw);
    }
    for (var x2 = W; x2 >= 0; x2 -= 8) ctx.lineTo(x2, centerY(x2, T) + hw);
    ctx.closePath();
    ctx.fillStyle = hexA(PIGMENTS.woad.hex, 0.10);
    ctx.fill();

    // inner current
    ctx.beginPath();
    var hw2 = hw * 0.55;
    for (var x3 = 0; x3 <= W; x3 += 8) {
      var c3 = centerY(x3, T);
      if (x3 === 0) ctx.moveTo(x3, c3 - hw2); else ctx.lineTo(x3, c3 - hw2);
    }
    for (var x4 = W; x4 >= 0; x4 -= 8) ctx.lineTo(x4, centerY(x4, T) + hw2);
    ctx.closePath();
    ctx.fillStyle = hexA(PIGMENTS.woad.hex, 0.10);
    ctx.fill();

    // flow streaks
    ctx.strokeStyle = hexA(PIGMENTS.woad.hex, 0.35);
    ctx.lineWidth = 2;
    for (var s = 0; s < 5; s++) {
      var yy = centerY(((T * (0.4 + settings.flow * 0.5) + s * W / 5) % W + W) % W, T);
      var sx = ((T * (0.4 + settings.flow * 0.5) + s * W / 5) % W + W) % W;
      ctx.beginPath();
      ctx.moveTo(sx - 34, yy);
      ctx.lineTo(sx + 34, yy);
      ctx.stroke();
    }

    // dye particles
    for (var d = 0; d < dye.length; d++) {
      var p = dye[d];
      ctx.globalAlpha = Math.max(0.12, Math.min(0.62, 0.28 + p.life * 0.34));
      ctx.fillStyle = PIGMENTS[p.pig].hex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // banks: twin ink lines + reed ticks
    [1, -1].forEach(function (side) {
      ctx.beginPath();
      for (var bx = 0; bx <= W; bx += 8) {
        var by = centerY(bx, T) + side * hw;
        if (bx === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = PIGMENTS.reed.hex;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (var tx = (side > 0 ? 14 : 42); tx < W; tx += 64) {
        var ty = centerY(tx, T) + side * (hw + 7);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + 12, ty);
      }
      ctx.stroke();
    });

    // flight trails
    if (settings.trails) {
      ibis.forEach(function (b) {
        if (b.trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (var k = 1; k < b.trail.length; k++) ctx.lineTo(b.trail[k].x, b.trail[k].y);
        ctx.strokeStyle = hexA(PIGMENTS[b.pig].hex, 0.85);
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // ibis
    ibis.forEach(function (b) {
      var flap = Math.sin(b.ph * 3) * (7 + b.flap * 0.4);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      // wings
      ctx.beginPath();
      ctx.moveTo(b.x - 13, b.y - flap * 0.5);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + 13, b.y - flap * 0.5);
      ctx.stroke();
      // body
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 3, 7, 4.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.stroke();
      // beak (rust)
      ctx.beginPath();
      ctx.moveTo(b.x + 7, b.y + 2);
      ctx.lineTo(b.x + 13, b.y + 4);
      ctx.lineTo(b.x + 7, b.y + 6);
      ctx.closePath();
      ctx.fillStyle = PIGMENTS.rust.hex;
      ctx.fill();
      // dye-load dot
      ctx.beginPath();
      ctx.arc(b.x, b.y + 3, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = PIGMENTS[b.pig].hex;
      ctx.fill();
    });

    // gust rings
    gusts.forEach(function (rg) {
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(17,17,17," + Math.max(0, rg.a).toFixed(3) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  // ---------- hud / ledger ----------
  var lastHud = 0;
  function refreshHud(force) {
    var now = Date.now();
    if (!force && now - lastHud < 250) return;
    lastHud = now;
    var total = counts.woad + counts.rust + counts.reed;
    var sat = Math.round((dye.length / MAX_DYE) * 100);
    satChip.textContent = "SATURATION " + sat + "%";
    dyeChip.textContent = "DYE " + total;
    flightBadge.textContent = flights + " FLIGHTS";
    if (sat >= 66) { stamp.hidden = false; } else { stamp.hidden = true; }
    $("recipeTotal").textContent = total + " UNITS";
    function pct(n) { return total ? Math.round((n / total) * 100) : 0; }
    $("pctWoad").textContent = pct(counts.woad) + "%";
    $("pctRust").textContent = pct(counts.rust) + "%";
    $("pctReed").textContent = pct(counts.reed) + "%";
    $("barWoad").style.width = pct(counts.woad) + "%";
    $("barRust").style.width = pct(counts.rust) + "%";
    $("barReed").style.width = pct(counts.reed) + "%";
    persistSoon();
  }

  function logFlight(b) {
    var empty = ledger.querySelector(".ledger-empty");
    if (empty) empty.remove();
    var li = document.createElement("li");
    var total = counts.woad + counts.rust + counts.reed;
    li.textContent = "⌄ IBIS #" + b.id + " · " + PIGMENTS[b.pig].name + " · river " +
      (total ? Math.round((counts[b.pig] / total) * 100) : 0) + "% " + PIGMENTS[b.pig].name.toLowerCase();
    ledger.insertBefore(li, ledger.firstChild);
    while (ledger.children.length > 9) ledger.removeChild(ledger.lastChild);
    refreshHud(true);
  }

  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.className = "toast ok";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.textContent = ""; toastEl.className = "toast"; }, 2600);
  }

  function copyText(str, label) {
    function done() { toast(label + " copied to clipboard."); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = str;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("Copy blocked — select manually."); }
      document.body.removeChild(ta);
    }
  }

  // ---------- export ----------
  function exportPNG() {
    var a = document.createElement("a");
    a.download = "woad-ibis-river.png";
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("PNG river exported.");
  }

  function exportSVG() {
    var paths = ibis.map(function (b) {
      if (b.trail.length < 2) return "";
      var dAttr = "M" + b.trail.map(function (pt) {
        return Math.round(pt.x) + " " + Math.round(pt.y);
      }).join(" L");
      return '<path d="' + dAttr + '" fill="none" stroke="' + PIGMENTS[b.pig].hex +
        '" stroke-width="2" data-pigment="' + b.pig + '"/>';
    }).join("");
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '">' +
      '<rect width="' + W + '" height="' + H + '" fill="' + PAPER + '"/>' + paths + "</svg>";
    var blob = new Blob([svg], { type: "image/svg+xml" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.download = "woad-ibis-paths.svg";
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast("SVG flight paths exported.");
  }

  function paletteText() {
    return "WOAD IBIS WORKS — PALETTE (3 + black/white)\n" +
      "WOAD #2447F9 · IBIS RUST #FF4D00 · REED GOLD #FFD02B · INK #111111 · PAPER #FFFEF7";
  }

  function recipeText() {
    var total = counts.woad + counts.rust + counts.reed || 1;
    function pct(n) { return Math.round((n / total) * 100); }
    return "WOAD IBIS WORKS — PIGMENT RECIPE\n" +
      "flights: " + flights + " · dye units: " + total + "\n" +
      "WOAD " + pct(counts.woad) + "% (" + counts.woad + ") — #" + "2447F9\n" +
      "IBIS RUST " + pct(counts.rust) + "% (" + counts.rust + ") — #FF4D00\n" +
      "REED GOLD " + pct(counts.reed) + "% (" + counts.reed + ") — #FFD02B\n" +
      "flow " + settings.flow.toFixed(1) + "x · wind " + settings.wind + " · dye load " + settings.dyeLoad.toFixed(1) + "x";
  }

  // ---------- sizing ----------
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    var r = wrap.getBoundingClientRect();
    W = Math.max(280, Math.floor(r.width));
    H = Math.floor(canvas.clientHeight) || 430;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ---------- pointer ----------
  var downPos = null, dragged = false;
  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId);
    var r = canvas.getBoundingClientRect();
    downPos = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragged = false;
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!downPos) return;
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.abs(x - downPos.x) + Math.abs(y - downPos.y) > 8) dragged = true;
    if (dragged) { gustAt(x, y, 0.7); downPos = { x: x, y: y }; }
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!downPos) return;
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (!dragged) {
      spawnIbis(selected, Math.max(6, x - 20), y);
      gustAt(x, y, 0.4);
    }
    downPos = null;
  });

  // ---------- controls ----------
  function syncControls() {
    $("flowRange").value = Math.round(settings.flow * 100);
    $("windRange").value = settings.wind;
    $("dyeRange").value = Math.round(settings.dyeLoad * 100);
    $("flowVal").textContent = settings.flow.toFixed(1) + "×";
    $("windVal").textContent = settings.wind;
    $("dyeVal").textContent = settings.dyeLoad.toFixed(1) + "×";
    $("trailsBox").checked = settings.trails;
    $("autoBox").checked = settings.auto;
    document.querySelectorAll(".pig").forEach(function (el) {
      var on = el.getAttribute("data-pig") === selected;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-checked", on ? "true" : "false");
    });
    $("pauseBtn").textContent = paused ? "▶ RESUME" : "❚❚ PAUSE";
    $("pauseBtn").setAttribute("aria-pressed", paused ? "true" : "false");
  }

  $("flowRange").addEventListener("input", function (e) {
    settings.flow = (+e.target.value) / 100;
    $("flowVal").textContent = settings.flow.toFixed(1) + "×";
    persistSoon();
  });
  $("windRange").addEventListener("input", function (e) {
    settings.wind = +e.target.value;
    $("windVal").textContent = settings.wind;
    persistSoon();
  });
  $("dyeRange").addEventListener("input", function (e) {
    settings.dyeLoad = (+e.target.value) / 100;
    $("dyeVal").textContent = settings.dyeLoad.toFixed(1) + "×";
    persistSoon();
  });
  $("trailsBox").addEventListener("change", function (e) { settings.trails = e.target.checked; persistSoon(); });
  $("autoBox").addEventListener("change", function (e) { settings.auto = e.target.checked; persistSoon(); });

  document.querySelectorAll(".pig").forEach(function (el) {
    el.addEventListener("click", function () {
      selected = el.getAttribute("data-pig");
      syncControls();
      persistSoon();
      toast("Dye load: " + PIGMENTS[selected].name + " " + PIGMENTS[selected].hex);
    });
  });

  $("flockBtn").addEventListener("click", function () { releaseFlock(5, false); });
  $("mixedBtn").addEventListener("click", function () { releaseFlock(3, true); });
  $("gustBtn").addEventListener("click", function () {
    gustAt(Math.random() * W, H * (0.3 + Math.random() * 0.4), 1.4);
    toast("Gust across the river!");
  });
  $("pauseBtn").addEventListener("click", function () { paused = !paused; syncControls(); });
  $("clearBtn").addEventListener("click", function () {
    dye.length = 0;
    counts = { woad: 0, rust: 0, reed: 0 };
    refreshHud(true);
    toast("River scoured clean.");
  });
  $("pngBtn").addEventListener("click", exportPNG);
  $("svgBtn").addEventListener("click", exportSVG);
  $("palBtn").addEventListener("click", function () { copyText(paletteText(), "Palette"); });
  $("recipeBtn").addEventListener("click", function () { copyText(recipeText(), "Recipe"); });
  $("wipeLog").addEventListener("click", function () {
    ledger.innerHTML = '<li class="ledger-empty">No flights yet — release the flock.</li>';
  });

  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "1") { selected = "woad"; syncControls(); }
    else if (e.key === "2") { selected = "rust"; syncControls(); }
    else if (e.key === "3") { selected = "reed"; syncControls(); }
    else if (e.key === " ") { e.preventDefault(); releaseFlock(5, false); }
    else if (e.key === "e" || e.key === "E") { exportPNG(); }
  });

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paused = true;
  }

  // ---------- boot ----------
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) {
    new ResizeObserver(function () { resize(); }).observe(wrap);
  }
  resize();
  syncControls();
  refreshHud(true);
  spawnIbis("woad"); spawnIbis("woad"); spawnIbis("rust");

  (function loop() {
    requestAnimationFrame(loop);
    if (!paused) update();
    draw();
    refreshHud(false);
  })();
})();
