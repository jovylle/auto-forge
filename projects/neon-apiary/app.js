/* Neon Apiary — Hive Rush. Plain script, no deps. Works from file:// */
(function () {
  "use strict";
  var W = 520, H = 620;
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var el = function (id) { return document.getElementById(id); };
  var statHoney = el("statHoney"), statPollen = el("statPollen"),
      statLives = el("statLives"), statBest = el("statBest"),
      clockBadge = el("clockBadge"), comboBar = el("comboBar"),
      statusLine = el("statusLine"), overlay = el("overlay"),
      ovKicker = el("ovKicker"), ovTitle = el("ovTitle"), ovBody = el("ovBody"),
      ovBtn = el("ovBtn"), logBox = el("log"), shareMsg = el("shareMsg");

  var BEST_KEY = "neon-apiary-best";
  var best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  statBest.textContent = best;

  // ticker
  el("ticker").textContent = ("  🐝 NEON APIARY — HIVE RUSH  •  BANK POLLEN AT THE HIVE  •  DODGE WASPS  •  60 SECONDS  •  3 LIVES  • ").repeat(4);

  // ---- audio (all synthesized, no assets) ----
  var AC = null, buzzOsc = null, buzzGain = null, soundOn = true;
  function audio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === "suspended") AC.resume();
    return AC;
  }
  function blip(freq, dur, type, vol, slide) {
    if (!soundOn) return; var ac = audio(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function startBuzz() {
    if (!soundOn) return; var ac = audio(); if (!ac || buzzOsc) return;
    buzzOsc = ac.createOscillator(); buzzGain = ac.createGain();
    buzzOsc.type = "sawtooth"; buzzOsc.frequency.value = 140;
    buzzGain.gain.value = 0.02;
    buzzOsc.connect(buzzGain); buzzGain.connect(ac.destination);
    buzzOsc.start();
  }
  function stopBuzz() {
    if (buzzOsc) { try { buzzOsc.stop(); } catch (e) {} buzzOsc = null; buzzGain = null; }
  }
  function setBuzz(speed) {
    if (buzzOsc && buzzGain) {
      buzzOsc.frequency.value = 120 + Math.min(160, speed * 40);
      buzzGain.gain.value = soundOn ? 0.02 : 0.0;
    }
  }

  // ---- game state ----
  var S;
  function freshState() {
    return {
      mode: "ready", honey: 0, carried: 0, carriedMax: 5, lives: 3,
      time: 60, combo: 1, comboT: 0, shake: 0, invuln: 0, flash: 0,
      tick: 0, spawnT: 0, waspT: 3, runEvents: [],
      bee: { x: W / 2, y: H - 110, vx: 0, vy: 0, r: 16 },
      target: { x: W / 2, y: H - 110, active: false },
      keys: {},
      pollen: [], wasps: [], parts: [], floats: []
    };
  }
  S = freshState();
  var hive = { x: W / 2, y: 74, r: 44 };

  function log(msg) {
    S.runEvents.push({ t: elapsed(), msg: msg });
    var li = document.createElement("li"); li.textContent = msg;
    logBox.prepend(li);
    while (logBox.children.length > 30) logBox.removeChild(logBox.lastChild);
  }
  function elapsed() { return (60 - S.time).toFixed(1) + "s"; }
  function say(msg, ms) {
    shareMsg.textContent = msg;
    if (ms !== 0) setTimeout(function () { if (shareMsg.textContent === msg) shareMsg.textContent = ""; }, ms || 2600);
  }

  // ---- entities ----
  function spawnPollen(n) {
    for (var i = 0; i < n; i++) {
      S.pollen.push({
        x: 30 + Math.random() * (W - 60),
        y: 150 + Math.random() * (H - 200),
        r: 10 + Math.random() * 4, ph: Math.random() * 6.28, big: Math.random() < 0.18
      });
    }
  }
  function spawnWasp(edge) {
    var diff = 1 + (60 - S.time) / 60; // ramps up
    var x = edge ? (Math.random() < 0.5 ? 20 : W - 20) : 30 + Math.random() * (W - 60);
    var y = edge ? 160 + Math.random() * 300 : H - 40;
    S.wasps.push({
      x: x, y: y, r: 14,
      sp: (70 + Math.random() * 60) * diff,
      ph: Math.random() * 6.28, wob: 2 + Math.random() * 3
    });
  }
  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28;
      S.parts.push({ x: x, y: y, vx: Math.cos(a) * spd * (0.4 + Math.random()), vy: Math.sin(a) * spd * (0.4 + Math.random()), life: 0.6 + Math.random() * 0.4, color: color });
    }
  }
  function floatText(x, y, text, color) { S.floats.push({ x: x, y: y, text: text, color: color, life: 1 }); }

  // ---- flow ----
  function startGame() {
    audio(); // unlock on gesture
    S = freshState();
    S.mode = "play";
    logBox.innerHTML = "";
    spawnPollen(9);
    spawnWasp(true); spawnWasp(true);
    overlay.hidden = true;
    el("btnPause").textContent = "\u23F8 PAUSE";
    startBuzz();
    log("run started — good luck, keeper");
    statusLine.textContent = "FLY! BANK POLLEN AT THE TOP HIVE HEX";
  }
  function endGame(reason) {
    S.mode = "over";
    stopBuzz();
    S.shake = 10;
    var won = S.honey >= best && S.honey > 0;
    if (S.honey > best) { best = S.honey; localStorage.setItem(BEST_KEY, String(best)); statBest.textContent = best; }
    log("run over (" + reason + ") — honey " + S.honey);
    blip(220, 0.5, "sawtooth", 0.12, 60);
    showOverlay(reason === "timeout" ? "TIME UP!" : "HIVE DOWN",
      reason === "timeout" ? "STUNG BY THE CLOCK" : "OUT OF LIVES",
      "You banked <b>" + S.honey + " honey</b>" + (won ? " — <b>NEW BEST! 🏆</b>" : " (best " + best + ")") +
      ".<br>Copy your run card or grab a snapshot below.",
      "↻ FLY AGAIN");
  }
  function showOverlay(title, kicker, bodyHTML, btn) {
    ovTitle.textContent = title; ovKicker.textContent = kicker;
    ovBody.innerHTML = bodyHTML; ovBtn.textContent = btn;
    overlay.hidden = false;
  }

  // ---- input ----
  function ptr(e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX), cy = (e.touches ? e.touches[0].clientY : e.clientY);
    return { x: (cx - r.left) * (W / r.width), y: (cy - r.top) * (H / r.height) };
  }
  function down(e) {
    if (S.mode !== "play") return;
    e.preventDefault();
    var p = ptr(e); S.target.x = p.x; S.target.y = p.y; S.target.active = true;
  }
  function move(e) { if (S.mode === "play" && S.target.active) { e.preventDefault(); var p = ptr(e); S.target.x = p.x; S.target.y = p.y; } }
  function up() { S.target.active = false; }
  canvas.addEventListener("mousedown", down);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  canvas.addEventListener("touchstart", down, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", up);
  window.addEventListener("keydown", function (e) {
    S.keys[e.key.toLowerCase()] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].indexOf(e.key.toLowerCase()) >= 0) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && S.mode !== "play") startGame();
  });
  window.addEventListener("keyup", function (e) { S.keys[e.key.toLowerCase()] = false; });

  el("btnStart").onclick = startGame;
  ovBtn.onclick = function () {
    if (S.mode === "paused") { overlay.hidden = true; S.mode = "play"; startBuzz(); el("btnPause").textContent = "\u23F8 PAUSE"; }
    else startGame();
  };
  el("btnRestart").onclick = startGame;
  el("btnHow").onclick = function () { var h = el("howto"); h.hidden = !h.hidden; if (!h.hidden) h.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  el("btnPause").onclick = function () {
    if (S.mode === "play") { S.mode = "paused"; stopBuzz(); showOverlay("PAUSED", "CATCH YOUR BREATH", "The bees are holding formation.", "▶ RESUME"); el("btnPause").textContent = "▶ RESUME"; S.mode = "paused"; }
    else if (S.mode === "paused") { overlay.hidden = true; S.mode = "play"; startBuzz(); el("btnPause").textContent = "⏸ PAUSE"; }
  };
  el("btnSound").onclick = function () {
    soundOn = !soundOn;
    el("btnSound").textContent = soundOn ? "🔊 SOUND: ON" : "🔇 SOUND: OFF";
    el("btnSound").setAttribute("aria-pressed", String(soundOn));
    if (!soundOn) stopBuzz(); else if (S.mode === "play") startBuzz();
  };
  el("btnWipe").onclick = function () { best = 0; localStorage.removeItem(BEST_KEY); statBest.textContent = "0"; say("best score wiped", 2000); };

  // ---- share / export ----
  function runCard() {
    return "🐝 NEON APIARY — HIVE RUSH\n🍯 Honey: " + S.honey + " · 🌸 Carried: " + S.carried +
      " · ❤ Lives: " + S.lives + " · ⏱ Left: " + Math.ceil(S.time) + "s · ★ Best: " + best +
      "\nThink you can out-keep me? Play Neon Apiary!";
  }
  el("btnCopy").onclick = function () {
    var txt = runCard();
    function done() { say("✓ run card copied — go brag", 2600); log("run card copied"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    } else { fallbackCopy(txt); done(); }
  };
  function fallbackCopy(t) {
    var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta);
    ta.select(); try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  el("btnPNG").onclick = function () {
    render(0); // fresh frame
    var a = document.createElement("a");
    a.download = "neon-apiary-" + S.honey + "honey.png";
    a.href = canvas.toDataURL("image/png"); a.click();
    say("✓ snapshot downloaded", 2600); log("PNG snapshot exported");
  };
  el("btnJSON").onclick = function () {
    var data = { game: "neon-apiary", honey: S.honey, lives: S.lives, timeLeft: Math.ceil(S.time), best: best, exportedAt: new Date().toISOString(), events: S.runEvents };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.download = "neon-apiary-run.json"; a.href = URL.createObjectURL(blob); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    say("✓ run JSON downloaded", 2600); log("JSON log exported");
  };
  el("btnLink").onclick = function () {
    var url = location.href.split("#")[0].split("?")[0] + "?honey=" + S.honey + "&best=" + best;
    function done() { say("✓ share link copied: " + url, 4000); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
    else { fallbackCopy(url); done(); }
    try { history.replaceState(null, "", "?honey=" + S.honey + "&best=" + best); } catch (e) {}
  };
  // inbound share link banner
  (function () {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("honey")) {
        showOverlay("CHALLENGED!", "A KEEPER DARES YOU",
          "Someone banked <b>" + q.get("honey") + " honey</b>. Beat it.", "▶ ACCEPT CHALLENGE");
        log("opened challenge link (honey " + q.get("honey") + ")");
      }
    } catch (e) {}
  })();

  // ---- update ----
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (S.mode === "play") update(dt);
    render(dt);
    requestAnimationFrame(loop);
  }
  function dist(a, b, c, d) { return Math.hypot(a - c, b - d); }

  function update(dt) {
    S.tick += dt; S.time -= dt;
    if (S.time <= 0) { S.time = 0; endGame("timeout"); return; }
    if (S.invuln > 0) S.invuln -= dt;
    if (S.shake > 0) S.shake -= dt * 20;
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 1; } }

    // bee movement: pointer seek + keys
    var b = S.bee, ACC = 1400, MAX = 340;
    var ax = 0, ay = 0;
    if (S.keys["a"] || S.keys["arrowleft"]) ax -= ACC;
    if (S.keys["d"] || S.keys["arrowright"]) ax += ACC;
    if (S.keys["w"] || S.keys["arrowup"]) ay -= ACC;
    if (S.keys["s"] || S.keys["arrowdown"]) ay += ACC;
    if (S.target.active) {
      var dx = S.target.x - b.x, dy = S.target.y - b.y, d = Math.hypot(dx, dy);
      if (d > 6) { ax += dx / d * ACC; ay += dy / d * ACC; }
    }
    b.vx += ax * dt; b.vy += ay * dt;
    b.vx *= (1 - 3.2 * dt); b.vy *= (1 - 3.2 * dt);
    var sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX) { b.vx *= MAX / sp; b.vy *= MAX / sp; }
    b.x = Math.max(16, Math.min(W - 16, b.x + b.vx * dt));
    b.y = Math.max(120, Math.min(H - 16, b.y + b.vy * dt));
    setBuzz(sp / 100);

    // spawns
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.pollen.length < 10) { spawnPollen(2); S.spawnT = 1.1; }
    S.waspT -= dt;
    var maxWasps = 2 + Math.floor((60 - S.time) / 15);
    if (S.waspT <= 0 && S.wasps.length < maxWasps) { spawnWasp(true); S.waspT = Math.max(1.2, 3.4 - (60 - S.time) / 30); }

    // pollen pickup
    for (var i = S.pollen.length - 1; i >= 0; i--) {
      var p = S.pollen[i];
      if (dist(b.x, b.y, p.x, p.y) < b.r + p.r) {
        if (S.carried < S.carriedMax) {
          S.pollen.splice(i, 1);
          S.carried += p.big ? 2 : 1;
          if (S.carried > S.carriedMax) S.carried = S.carriedMax;
          S.combo = Math.min(5, S.combo + (S.comboT > 0 ? 1 : 0));
          if (S.combo === 1) S.combo = 2;
          S.comboT = 4;
          burst(p.x, p.y, "#FF3EA5", 10, 130);
          floatText(p.x, p.y - 14, "+POLLEN", "#FF3EA5");
          blip(660 + S.combo * 90, 0.12, "square", 0.1);
          log("grabbed pollen (" + S.carried + "/" + S.carriedMax + ")");
        } else {
          floatText(b.x, b.y - 24, "FULL! → HIVE", "#FFD02F");
        }
      }
    }

    // deposit at hive
    if (dist(b.x, b.y, hive.x, hive.y) < b.r + hive.r && S.carried > 0) {
      var gain = S.carried * S.combo;
      S.honey += gain;
      burst(hive.x, hive.y + 20, "#FFD02F", 16, 160);
      floatText(hive.x, hive.y + 52, "+" + gain + " HONEY ×" + S.combo, "#FFD02F");
      blip(523, 0.12, "square", 0.12); setTimeout(function () { blip(784, 0.16, "square", 0.12); }, 90);
      log("banked +" + gain + " honey (×" + S.combo + ")");
      S.carried = 0;
    }

    // wasps chase
    for (var j = S.wasps.length - 1; j >= 0; j--) {
      var w = S.wasps[j];
      w.ph += dt * 5;
      var wx = b.x - w.x, wy = b.y - w.y, wd = Math.hypot(wx, wy) || 1;
      w.x += (wx / wd) * w.sp * dt + Math.cos(w.ph) * w.wob * dt * 10;
      w.y += (wy / wd) * w.sp * dt + Math.sin(w.ph) * w.wob * dt * 10;
      if (S.invuln <= 0 && dist(b.x, b.y, w.x, w.y) < b.r + w.r - 4) {
        S.lives--; S.invuln = 1.6; S.shake = 8; S.combo = 1; S.comboT = 0;
        burst(b.x, b.y, "#22E6FF", 18, 200);
        floatText(b.x, b.y - 26, "STUNG!", "#22E6FF");
        blip(180, 0.3, "sawtooth", 0.14, 60);
        log("stung! lives left " + S.lives);
        if (S.carried > 0) { spawnPollen(Math.min(3, S.carried)); S.carried = 0; }
        if (S.lives <= 0) { endGame("stung"); return; }
      }
    }

    // particles / floats
    for (var k = S.parts.length - 1; k >= 0; k--) {
      var pt = S.parts[k];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) S.parts.splice(k, 1);
    }
    for (var f = S.floats.length - 1; f >= 0; f--) {
      var fl = S.floats[f]; fl.y -= 40 * dt; fl.life -= dt * 0.9;
      if (fl.life <= 0) S.floats.splice(f, 1);
    }

    // HUD
    statHoney.textContent = S.honey;
    statPollen.textContent = S.carried + "/" + S.carriedMax;
    statLives.textContent = S.lives >= 3 ? "●●●" : S.lives === 2 ? "●●○" : S.lives === 1 ? "●○○" : "○○○";
    clockBadge.textContent = Math.ceil(S.time) + "s";
    comboBar.textContent = "COMBO ×" + S.combo + (S.comboT > 0 ? " — " + S.comboT.toFixed(1) + "s" : "");
    comboBar.classList.toggle("hot", S.combo >= 3);
    if (S.time < 10) statusLine.textContent = "⚠ " + Math.ceil(S.time) + "s LEFT — BANK IT NOW!";
  }

  // ---- render ----
  function hexPath(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i - Math.PI / 6;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function render(dt) {
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    // bg
    ctx.fillStyle = "#0A0A0A"; ctx.fillRect(-20, -20, W + 40, H + 40);
    // honeycomb ghost grid
    ctx.strokeStyle = "rgba(255,208,47,.14)"; ctx.lineWidth = 1.5;
    for (var gy = 130; gy < H + 30; gy += 52) {
      for (var gx = -20; gx < W + 20; gx += 46) {
        hexPath(gx + ((gy / 52) % 2 ? 23 : 0), gy, 22); ctx.stroke();
      }
    }
    var t = performance.now() / 1000;

    // hive
    var pulse = 1 + Math.sin(t * 3) * 0.04;
    ctx.save();
    ctx.shadowColor = "#FFD02F"; ctx.shadowBlur = 26;
    ctx.fillStyle = "#FFD02F"; ctx.strokeStyle = "#FFFDF5"; ctx.lineWidth = 4;
    hexPath(hive.x, hive.y, hive.r * pulse); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#0A0A0A"; ctx.font = "900 13px 'Space Grotesk',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("⬢ HIVE", hive.x, hive.y - 2);
    ctx.font = "700 11px 'Space Grotesk',sans-serif";
    ctx.fillText("BANK HERE", hive.x, hive.y + 14);

    // pollen
    S.pollen.forEach(function (p) {
      var bob = Math.sin(t * 3 + p.ph) * 3;
      ctx.save();
      ctx.shadowColor = "#FF3EA5"; ctx.shadowBlur = 16;
      ctx.fillStyle = "#FF3EA5"; ctx.strokeStyle = "#FFFDF5"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, p.r, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(p.big ? "✿×2" : "✿", p.x, p.y + bob + 4);
    });

    // wasps
    S.wasps.forEach(function (w) {
      var wob = Math.sin(t * 6 + w.ph) * 3;
      ctx.save();
      ctx.shadowColor = "#22E6FF"; ctx.shadowBlur = 16;
      ctx.fillStyle = "#22E6FF"; ctx.strokeStyle = "#FFFDF5"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(w.x, w.y + wob, w.r + 4, w.r - 2, Math.sin(w.ph) * 0.3, 0, 6.29);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#0A0A0A"; ctx.font = "900 12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("⚠", w.x, w.y + wob + 4);
    });

    // bee (player)
    var b = S.bee;
    var blink = S.invuln > 0 && Math.floor(t * 10) % 2 === 0;
    if (!blink && S.mode !== "ready") {
      ctx.save();
      ctx.shadowColor = "#FFD02F"; ctx.shadowBlur = 22;
      // wings
      var flap = Math.sin(t * 30) * 4;
      ctx.fillStyle = "rgba(255,253,245,.9)";
      ctx.beginPath(); ctx.ellipse(b.x - 8, b.y - 12 + flap, 8, 5, -0.5, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(b.x + 8, b.y - 12 - flap, 8, 5, 0.5, 0, 6.29); ctx.fill();
      // body
      ctx.fillStyle = "#FFD02F"; ctx.strokeStyle = "#0A0A0A"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r + 3, b.r - 2, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(b.x - 6, b.y - 14, 5, 24); ctx.fillRect(b.x + 2, b.y - 14, 5, 24);
      // eye + stinger
      ctx.fillStyle = "#0A0A0A"; ctx.beginPath(); ctx.arc(b.x + 9, b.y - 3, 3, 0, 6.29); ctx.fill();
      ctx.restore();
      // carried pollen pips
      for (var i = 0; i < S.carried; i++) {
        ctx.fillStyle = "#FF3EA5"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x - 18 + i * 9, b.y + 22, 5, 0, 6.29); ctx.fill(); ctx.stroke();
      }
    }

    // particles / floats
    S.parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.textAlign = "center";
    S.floats.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = "900 15px 'Archivo Black',sans-serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "#0A0A0A"; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });

    // low-time vignette
    if (S.mode === "play" && S.time < 10) {
      ctx.fillStyle = "rgba(255,62,165," + (0.12 + 0.08 * Math.sin(t * 6)) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  showOverlay("HIVE RUSH", "READY?", "Collect glowing pollen, ferry it to the hive hex at the top. Wasps hurt. 3 lives, 60 seconds.", "▶ START");
  requestAnimationFrame(loop);
})();
