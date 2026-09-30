/* Ember Post Office — night-shift sorting game. No assets; canvas + CSS only. */
(() => {
  "use strict";

  const DISTRICTS = [
    { name: "SOL", glyph: "\u25B2", color: "#FFC46B", glow: "255,196,107" },
    { name: "VOLT", glyph: "\u25CF", color: "#00E5FF", glow: "0,229,255" },
    { name: "MAGMA", glyph: "\u25C6", color: "#FF2E88", glow: "255,46,136" },
  ];
  const SHIFT_LEN = 90;
  const QUOTA = 12;
  const STORE_BEST = "epo_best";
  const STORE_LOG = "epo_log";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const clockEl = document.getElementById("clock");
  const quotaEl = document.getElementById("quotaLine");
  const hudScore = document.getElementById("hudScore");
  const hudSorted = document.getElementById("hudSorted");
  const hudMiss = document.getElementById("hudMiss");
  const hudCombo = document.getElementById("hudCombo");
  const hudBest = document.getElementById("hudBest");
  const ledgerList = document.getElementById("ledgerList");
  const comboFill = document.getElementById("comboFill");
  const reportBox = document.getElementById("reportBox");
  const reportNote = document.getElementById("reportNote");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const againBtn = document.getElementById("againBtn");
  const banner = document.getElementById("banner");
  const bannerTitle = document.getElementById("bannerTitle");
  const bannerText = document.getElementById("bannerText");
  const hintEl = document.getElementById("hint");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let W = 900, H = 560;
  function fitCanvas() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width));
    H = Math.round(W * 0.62);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const S = {
    running: false, t: 0, timeLeft: SHIFT_LEN,
    score: 0, sorted: 0, miss: 0, expired: 0, combo: 0,
    parcels: [], bursts: [], motes: [],
    spawnIn: 0, selected: null, dragging: null,
    best: Number(localStorage.getItem(STORE_BEST) || 0),
    shiftNo: (JSON.parse(localStorage.getItem(STORE_LOG) || "[]").length || 0) + 1,
  };
  hudBest.textContent = String(S.best);

  // ---- audio (WebAudio, no assets) ----
  let AC = null;
  function beep(freq, dur, type, vol) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }
  const sndGood = () => { beep(660, 0.09, "square"); setTimeout(() => beep(990, 0.12, "square"), 70); };
  const sndBad = () => beep(140, 0.25, "sawtooth", 0.08);
  const sndTick = () => beep(440, 0.05, "square", 0.03);

  // ---- parcels ----
  let pid = 0;
  function spawn() {
    const d = Math.floor(Math.random() * 3);
    S.parcels.push({
      id: ++pid, d,
      x: 60 + Math.random() * (W - 120),
      y: -30,
      vx: (Math.random() - 0.5) * 40,
      vy: 30 + Math.random() * 40,
      sway: Math.random() * Math.PI * 2,
      fuse: 14, maxFuse: 14,
      w: 64, h: 42,
      held: false,
    });
  }

  function chuteRect(i) {
    const cw = W / 3;
    return { x: i * cw + 10, y: H - 64, w: cw - 20, h: 54 };
  }
  function chuteAt(x, y) {
    for (let i = 0; i < 3; i++) {
      const r = chuteRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y - 30 && y <= r.y + r.h) return i;
    }
    return -1;
  }

  function burst(x, y, rgb, n) {
    if (reduced) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      if (S.bursts.length > 180) S.bursts.shift();
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
      S.bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 1, rgb });
    }
  }
  function initMotes() {
    S.motes = [];
    const n = reduced ? 6 : 30;
    for (let i = 0; i < n; i++) {
      S.motes.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2.5, v: 12 + Math.random() * 26, ph: Math.random() * 6.28 });
    }
  }

  function mult() { return Math.min(3, 1 + S.combo * 0.1); }

  function ledger(text, cls) {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    ledgerList.prepend(li);
    while (ledgerList.children.length > 14) ledgerList.lastChild.remove();
    // typewriter effect (signature micro-interaction)
    const caret = document.createElement("span");
    caret.className = "caret";
    li.appendChild(caret);
    let i = 0;
    const step = () => {
      i += 2;
      caret.before(document.createTextNode(text.slice(i - 2, i)));
      if (i < text.length) setTimeout(step, reduced ? 0 : 14);
      else caret.remove();
    };
    step();
  }

  function updateHud() {
    hudScore.textContent = S.score;
    hudSorted.textContent = S.sorted;
    hudMiss.textContent = S.miss;
    hudCombo.textContent = "×" + mult().toFixed(1);
    comboFill.style.height = Math.min(100, S.combo * 10) + "%";
    quotaEl.textContent = "QUOTA " + Math.min(S.sorted, QUOTA) + "/" + QUOTA;
    const m = Math.floor(S.timeLeft / 60), s = Math.floor(S.timeLeft % 60);
    clockEl.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    clockEl.classList.toggle("urgent", S.running && S.timeLeft <= 15);
  }

  function sortParcel(p, chute) {
    p.dead = true;
    if (chute === p.d) {
      const pts = Math.round(100 * mult());
      S.score += pts;
      S.sorted += 1;
      S.combo += 1;
      burst(p.x, p.y, DISTRICTS[p.d].glow, 14);
      sndGood();
      ledger("#" + p.id + " → " + DISTRICTS[p.d].name + " +" + pts, "good");
    } else {
      S.score = Math.max(0, S.score - 50);
      S.miss += 1;
      S.combo = 0;
      burst(p.x, p.y, "255,46,136", 16);
      sndBad();
      canvas.classList.remove("shake");
      void canvas.offsetWidth;
      if (!reduced) canvas.classList.add("shake");
      ledger("#" + p.id + " → WRONG CHUTE (" + DISTRICTS[chute].name + ") −50", "bad");
    }
    if (S.selected === p) S.selected = null;
    if (S.dragging === p) S.dragging = null;
    updateHud();
  }

  function expireParcel(p) {
    p.dead = true;
    S.expired += 1;
    S.combo = 0;
    S.score = Math.max(0, S.score - 25);
    burst(p.x, p.y, "120,80,60", 8);
    ledger("#" + p.id + " fuse burnt out −25", "bad");
    if (S.selected === p) S.selected = null;
    updateHud();
  }

  // ---- pointer ----
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function parcelAt(x, y) {
    for (let i = S.parcels.length - 1; i >= 0; i--) {
      const p = S.parcels[i];
      if (!p.dead && Math.abs(x - p.x) < p.w / 2 + 8 && Math.abs(y - p.y) < p.h / 2 + 8) return p;
    }
    return null;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!S.running) return;
    const q = pos(e), p = parcelAt(q.x, q.y);
    if (p) {
      S.dragging = p; p.held = true;
      S.selected = p;
      canvas.setPointerCapture(e.pointerId);
      sndTick();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (S.dragging) {
      const q = pos(e);
      S.dragging.x = Math.max(30, Math.min(W - 30, q.x));
      S.dragging.y = Math.max(20, Math.min(H - 80, q.y));
      S.dragging.vx = 0; S.dragging.vy = 0;
    }
  });
  function drop(e) {
    if (!S.dragging) return;
    const q = pos(e);
    const c = chuteAt(q.x, q.y);
    S.dragging.held = false;
    if (c >= 0) sortParcel(S.dragging, c);
    else S.dragging = null;
  }
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", () => {
    if (S.dragging) { S.dragging.held = false; S.dragging = null; }
  });

  // keyboard: 1/2/3 dispatch selected or topmost parcel
  document.addEventListener("keydown", (e) => {
    if (!S.running) return;
    const n = { 1: 0, 2: 1, 3: 2 }[e.key];
    if (n === undefined) return;
    const p = (S.selected && !S.selected.dead) ? S.selected
      : S.parcels.filter((q) => !q.dead).sort((a, b) => b.y - a.y)[0];
    if (p) sortParcel(p, n);
  });
  document.querySelectorAll(".chute").forEach((b) => {
    b.addEventListener("click", () => {
      if (!S.running) return;
      const n = Number(b.dataset.d);
      const p = (S.selected && !S.selected.dead) ? S.selected
        : S.parcels.filter((q) => !q.dead).sort((a, b) => b.y - a.y)[0];
      if (p) sortParcel(p, n);
    });
  });

  // ---- loop ----
  let last = 0, endTicked = false;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    S.t += dt;

    if (S.running) {
      S.timeLeft -= dt;
      if (S.timeLeft <= 15 && !endTicked) { endTicked = true; }
      if (S.timeLeft <= 10.5 && Math.ceil(S.timeLeft) !== Math.ceil(S.timeLeft + dt)) sndTick();
      if (S.timeLeft <= 0) { S.timeLeft = 0; endShift(); }
      S.spawnIn -= dt;
      const rate = Math.max(0.7, 1.6 - S.t * 0.008);
      if (S.spawnIn <= 0 && S.parcels.filter((p) => !p.dead).length < 7) {
        spawn();
        S.spawnIn = rate;
      }
      // physics
      for (const p of S.parcels) {
        if (p.dead) continue;
        if (!p.held) {
          p.sway += dt * 2;
          p.vy = Math.min(120, p.vy + 26 * dt);
          p.x += (p.vx + Math.sin(p.sway) * 26) * dt;
          p.y += p.vy * dt;
          if (p.x < 34) { p.x = 34; p.vx = Math.abs(p.vx); }
          if (p.x > W - 34) { p.x = W - 34; p.vx = -Math.abs(p.vx); }
          const floor = H - 120;
          if (p.y > floor) { p.y = floor; p.vy = 0; p.vx *= 0.98; }
        }
        p.fuse -= dt;
        if (p.fuse <= 0) expireParcel(p);
      }
      S.parcels = S.parcels.filter((p) => !p.dead);
      updateHud();
    }

    // particles
    for (const m of S.motes) {
      m.y -= m.v * dt;
      m.x += Math.sin(S.t + m.ph) * 8 * dt;
      if (m.y < -6) { m.y = H + 6; m.x = Math.random() * W; }
    }
    for (const b of S.bursts) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vy += 220 * dt; b.vx *= 0.98;
      b.life -= dt * 1.4;
    }
    S.bursts = S.bursts.filter((b) => b.life > 0);

    draw();
  }

  function glowCircle(x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(" + rgb + "," + a + ")");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // backdrop grid (retro floor)
    ctx.strokeStyle = "rgba(0,229,255,0.10)";
    ctx.lineWidth = 1;
    const horizon = H - 110;
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * W;
      ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.3, horizon); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const y = horizon + ((i + 1) / 4) * (H - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // motes
    for (const m of S.motes) glowCircle(m.x, m.y, m.s * 4, "255,120,40", 0.25);

    // chutes
    for (let i = 0; i < 3; i++) {
      const r = chuteRect(i), D = DISTRICTS[i];
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = D.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      glowCircle(r.x + r.w / 2, r.y + 6, 46, D.glow, 0.35);
      ctx.fillStyle = D.color;
      ctx.font = "700 22px Righteous, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(D.glyph + " " + D.name, r.x + r.w / 2, r.y + 34);
    }

    // parcels (glowing envelopes, canvas-drawn)
    const hover = S.dragging || S.selected;
    for (const p of S.parcels) {
      const D = DISTRICTS[p.d];
      const near = hover === p;
      const w = p.w * (near ? 1.07 : 1), h = p.h * (near ? 1.07 : 1);
      glowCircle(p.x, p.y, 52, D.glow, near ? 0.55 : 0.38);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.held ? 0 : Math.sin(p.sway) * 0.08);
      ctx.fillStyle = "#241031";
      ctx.strokeStyle = near ? "#FFC46B" : D.color;
      ctx.lineWidth = near ? 3 : 2;
      roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill(); ctx.stroke();
      // flap
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 3, -h / 2 + 3);
      ctx.lineTo(0, h * 0.12);
      ctx.lineTo(w / 2 - 3, -h / 2 + 3);
      ctx.stroke();
      // glyph
      ctx.fillStyle = D.color;
      ctx.font = "700 17px Righteous, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(D.glyph, 0, h * 0.42);
      ctx.restore();
      // fuse ring
      const f = Math.max(0, p.fuse / p.maxFuse);
      ctx.strokeStyle = f < 0.3 ? "#FF2E88" : "#FFC46B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      ctx.stroke();
    }

    // bursts
    for (const b of S.bursts) {
      glowCircle(b.x, b.y, 10 * b.life + 3, b.rgb, 0.5 * b.life);
    }

    if (!S.running && S.t === 0) {
      ctx.fillStyle = "rgba(242,226,196,0.85)";
      ctx.font = "20px 'Special Elite', monospace";
      ctx.textAlign = "center";
      ctx.fillText("— press START SHIFT to clock in —", W / 2, H / 2 - 40);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- shift lifecycle ----
  function startShift() {
    S.running = true; S.t = 0; S.timeLeft = SHIFT_LEN;
    S.score = 0; S.sorted = 0; S.miss = 0; S.expired = 0; S.combo = 0;
    S.parcels = []; S.bursts = []; S.selected = null; S.dragging = null;
    S.spawnIn = 0; endTicked = false;
    banner.hidden = true;
    ledgerList.innerHTML = "";
    ledger("shift #" + S.shiftNo + " clocked in. quota " + QUOTA + ".", "good");
    hintEl.textContent = "Shift live — sort fast, keep the combo burning.";
    startBtn.textContent = "Restart shift";
    updateHud();
    beep(520, 0.08, "square"); setTimeout(() => beep(780, 0.1, "square"), 90);
  }

  function report() {
    const date = new Date().toISOString().slice(0, 10);
    const ok = S.sorted >= QUOTA;
    return [
      "EMBER POST OFFICE — SHIFT REPORT #" + S.shiftNo + " (" + date + ")",
      "score " + S.score + " · sorted " + S.sorted + "/" + QUOTA + (ok ? " QUOTA MET" : " QUOTA MISSED"),
      "mis-sorts " + S.miss + " · burnt out " + S.expired + " · best " + Math.max(S.best, S.score),
      "SOL ▲ / VOLT ● / MAGMA ◆ — no parcel left unsorted.",
    ].join("\n");
  }

  function endShift() {
    S.running = false;
    S.dragging = null;
    const ok = S.sorted >= QUOTA;
    bannerTitle.textContent = ok ? "Quota met — fine night" : "Quota missed";
    bannerText.textContent = "Score " + S.score + " · sorted " + S.sorted + " · mis-sorts " + S.miss + " · burnt " + S.expired + ".";
    banner.hidden = false;
    if (S.score > S.best) {
      S.best = S.score;
      localStorage.setItem(STORE_BEST, String(S.best));
      hudBest.textContent = String(S.best);
    }
    try {
      const log = JSON.parse(localStorage.getItem(STORE_LOG) || "[]");
      log.push({ n: S.shiftNo, score: S.score, sorted: S.sorted, miss: S.miss, at: Date.now() });
      localStorage.setItem(STORE_LOG, JSON.stringify(log.slice(-10)));
    } catch (e) { /* storage full/blocked */ }
    S.shiftNo += 1;
    ledger("shift closed. " + (ok ? "quota met." : "quota missed."), ok ? "good" : "bad");
    reportBox.value = report();
    hintEl.textContent = "Shift over — copy or download your report below.";
    updateHud();
    if (ok) { sndGood(); } else { sndBad(); }
    againBtn.focus();
  }

  // ---- share / export ----
  function note(t) { reportNote.textContent = t; }
  document.getElementById("copyBtn").addEventListener("click", async () => {
    if (!reportBox.value) reportBox.value = report();
    try {
      await navigator.clipboard.writeText(reportBox.value);
      note("Copied to clipboard.");
    } catch (e) {
      reportBox.select();
      document.execCommand("copy");
      note("Copied (fallback).");
    }
  });
  document.getElementById("dlBtn").addEventListener("click", () => {
    if (!reportBox.value) reportBox.value = report();
    const blob = new Blob([reportBox.value], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ember-post-shift-" + (S.shiftNo - 1) + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    note("Downloaded shift report.");
  });
  document.getElementById("shareBtn").addEventListener("click", async () => {
    if (!reportBox.value) reportBox.value = report();
    if (navigator.share) {
      try { await navigator.share({ title: "Ember Post Office shift report", text: reportBox.value }); note("Shared."); }
      catch (e) { note("Share dismissed."); }
    } else {
      try { await navigator.clipboard.writeText(reportBox.value); note("No share API — copied instead."); }
      catch (e) { note("Copy the text manually."); }
    }
  });

  startBtn.addEventListener("click", startShift);
  againBtn.addEventListener("click", startShift);
  resetBtn.addEventListener("click", () => {
    S.running = false; S.t = 0; S.timeLeft = SHIFT_LEN;
    S.score = 0; S.sorted = 0; S.miss = 0; S.expired = 0; S.combo = 0;
    S.parcels = []; S.bursts = []; S.selected = null; S.dragging = null;
    ledgerList.innerHTML = "";
    reportBox.value = "";
    banner.hidden = true;
    startBtn.textContent = "Start shift";
    hintEl.textContent = "Parcels burn out — sort before the fuse ring empties.";
    updateHud();
  });

  // ticker content (duplicated for seamless loop)
  const tick = document.getElementById("ticker");
  tick.textContent = (tick.textContent + tick.textContent).slice(0, 400);

  window.addEventListener("resize", fitCanvas);
  fitCanvas();
  initMotes();
  updateHud();
  requestAnimationFrame(frame);
})();
