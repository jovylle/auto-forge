(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- data ---------------- */
  const SEGMENTS = [
    { id: "train",   en: "TRAIN",     jp: "電車",      base: 82,
      line: '"The last train got rerouted, my phone died mid-transfer, and I surfaced 40km from the office."' },
    { id: "network", en: "NETWORK",   jp: "回線",      base: 74,
      line: '"My provider hit an outage window right at the meeting, so the call dropped into the void."' },
    { id: "zone",    en: "TIMEZONE",  jp: "時差",      base: 78,
      line: '"I booked it for my timezone, the invite converted to yours, and neither clock agreed."' },
    { id: "alarm",   en: "ALARM",     jp: "目覚まし",   base: 55,
      line: '"The alarm fired, I hit snooze, and my brain hit delete. Bodies: one, present: zero."' },
    { id: "coffee",  en: "COFFEE",    jp: "コーヒー",   base: 40,
      line: '"A latte did a barrel roll into the keyboard mid-email. The laptop is now French-roast flavored."' },
    { id: "call",    en: "RECRUITER", jp: "転職",      base: 48,
      line: '"A recruiter call ran long and ate my entire buffer. I could not legally hang up."' },
    { id: "cat",     en: "CAT",       jp: "猫",        base: 30,
      line: '"The cat staged a hostage situation on my keyboard and I could not move the meeting."' },
    { id: "storm",   en: "STORM",     jp: "雷雨",      base: 66,
      line: '"Lightning took out the block mid-call. I was left arguing with a very quiet modem."' },
  ];
  const N = SEGMENTS.length;

  /* ---------------- dom refs ---------------- */
  const canvas = $("#wheel");
  const ctx = canvas.getContext("2d");
  const hub = $("#hub");
  const spinState = $("#spinState");
  const excuseName = $("#excuseName");
  const excuseText = $("#excuseText");
  const meterPct = $("#meterPct");
  const meterNote = $("#meterNote");
  const leds = $$("#meter .led");
  const copyBtn = $("#copyBtn");
  const copyLabel = $("#copyLabel");
  const spinBtn = $("#spinBtn");
  const clock = $("#clock");
  const alibiNo = $("#alibiNo");
  const log = $("#log");
  const logEmpty = $("#logEmpty");
  const clearLog = $("#clearLog");
  const body = document.body;

  /* ---------------- state ---------------- */
  let angle = 0;
  let spinning = false;
  let current = null; // {seg, score}
  let alibiCount = parseInt(localStorage.getItem("er_alibi") || "0", 10);
  let usedCount = {}; // per-segment spin count
  let audioCtx = null;

  const usedHist = (() => {
    try { return JSON.parse(localStorage.getItem("er_used") || "{}"); }
    catch { return {}; }
  })();

  /* ---------------- audio ---------------- */
  function ac() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function blip(freq = 660, dur = 0.02, type = "square", vol = 0.05) {
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch (e) { /* audio is optional */ }
  }

  /* ---------------- wheel drawing ---------------- */
  function dp() { return Math.max(1, window.devicePixelRatio || 1); }
  function fitCanvas() {
    const size = canvas.clientWidth;
    const d = dp();
    canvas.width = size * d; canvas.height = size * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  function segColor(i) {
    const pal = ["#ff2a6d", "#05d9e8", "#7b2ff7", "#d6ff3f", "#ff2a6d", "#05d9e8", "#7b2ff7", "#d6ff3f"];
    return pal[i];
  }

  function drawWheel() {
    const size = canvas.clientWidth;
    const cx = size / 2, cy = size / 2;
    const r = size * 0.46;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // segments
    const seg = (Math.PI * 2) / N;
    for (let i = 0; i < N; i++) {
      const a0 = i * seg - Math.PI / 2;
      const a1 = a0 + seg;
      const col = segColor(i);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.fill();

      ctx.strokeStyle = "rgba(5,6,15,.85)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // label
      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#0b0c1c";
      ctx.font = `800 ${Math.max(9, size * 0.034)}px "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.fillText(SEGMENTS[i].jp, r * 0.92, 6);
      ctx.font = `700 ${Math.max(8, size * 0.024)}px ui-monospace, Menlo, monospace`;
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillText(SEGMENTS[i].en, r * 0.92, 6 + Math.max(11, size * 0.03));
      ctx.restore();
    }

    // rim
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,236,255,.9)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(5,217,232,.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // hub ring drawn in HTML
    ctx.restore();
  }

  /* ---------------- spin logic ---------------- */
  function pickIndex() {
    // weight slightly toward high-base excuses, add randomness
    const weights = SEGMENTS.map((s) => s.base + Math.random() * 60);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < N; i++) { roll -= weights[i]; if (roll <= 0) return i; }
    return N - 1;
  }

  function scoreFor(idx) {
    const seg = SEGMENTS[idx];
    const penalty = (usedHist[seg.id] || 0) * 14; // repeat excuses get less believable
    const jitter = Math.floor(Math.random() * 21) - 10;
    return Math.max(5, Math.min(99, seg.base + jitter - penalty));
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    body.classList.add("spinning");
    blip(880, 0.05, "square", 0.06);

    const targetIdx = pickIndex();
    const seg = (Math.PI * 2) / N;
    const start = angle;
    // final angle must satisfy: angle ≡ -(targetIdx + 0.5)*seg (mod 2π)
    const twoPi = Math.PI * 2;
    const startMod = ((start % twoPi) + twoPi) % twoPi;
    const targetMod = ((-(targetIdx + 0.5) * seg) % twoPi + twoPi) % twoPi;
    let offset = targetMod - startMod;
    if (offset <= 0) offset += twoPi;
    const delta = twoPi * (6 + Math.random() * 4) + offset;
    const duration = 4800 + Math.random() * 900;
    const t0 = performance.now();

    spinState.textContent = "SPINNING · 回転中";
    let lastTick = 0;

    function ease(t) {
      // back-out deceleration
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      angle = start + delta * ease(t);

      // tick as we cross each segment boundary
      const tickN = Math.floor(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg);
      if (tickN !== lastTick && t > 0.05 && t < 0.96) {
        lastTick = tickN;
        blip(520, 0.012, "triangle", 0.03);
      }

      drawWheel();
      if (t < 1) { requestAnimationFrame(frame); }
      else { finish(targetIdx); }
    }
    requestAnimationFrame(frame);
  }

  function finish(idx) {
    spinning = false;
    body.classList.remove("spinning");
    blip(1400, 0.12, "sine", 0.07);
    blip(1900, 0.14, "sine", 0.05);

    const seg = SEGMENTS[idx];
    const score = scoreFor(idx);
    current = { seg, score };
    usedHist[seg.id] = (usedHist[seg.id] || 0) + 1;
    try { localStorage.setItem("er_used", JSON.stringify(usedHist)); } catch {}

    alibiCount += 1;
    try { localStorage.setItem("er_alibi", String(alibiCount)); } catch {}

    // reveal
    body.classList.add("has-result");
    alibiNo.textContent = String(alibiCount).padStart(3, "0");
    excuseName.textContent = `> ${seg.en} · ${seg.jp} [deniability computed]`;
    excuseText.textContent = seg.line;

    // meter
    const hot = score >= 60;
    leds.forEach((led, i) => {
      setTimeout(() => {
        const on = (i + 1) / leds.length <= score / 100;
        led.classList.toggle("on", on);
        led.classList.toggle("hot", on && hot);
      }, i * 55);
    });
    meterPct.textContent = score + "%";
    meterNote.textContent = score >= 75 ? "deniability: strong · 使える"
      : score >= 50 ? "deniability: shaky · 微妙"
      : "deniability: weak · ばれる";
    spinState.textContent = "LOCKED · 確定";

    pushLog(seg, score);
    blip(2400, 0.05, "triangle", 0.04);
  }

  /* ---------------- log ---------------- */
  function pushLog(seg, score) {
    const li = document.createElement("li");
    const t = new Date();
    const time = t.toLocaleTimeString("en-GB", { hour12: false });
    li.innerHTML = `<span class="n">#${String(alibiCount).padStart(3, "0")}</span>
      <span class="e">${seg.en} · ${seg.jp}</span>
      <span class="pct">${score}%</span>
      <span>${time}</span>`;
    log.prepend(li);
    while (log.children.length > 12) log.lastElementChild.remove();
    logEmpty.style.display = "none";
    // save history
    try {
      const hist = JSON.parse(localStorage.getItem("er_history") || "[]");
      hist.unshift({ en: seg.en, jp: seg.jp, score, time });
      localStorage.setItem("er_history", JSON.stringify(hist.slice(0, 30)));
    } catch {}
  }

  function restoreLog() {
    try {
      const hist = JSON.parse(localStorage.getItem("er_history") || "[]");
      if (!hist.length) return;
      logEmpty.style.display = "none";
      hist.forEach((h, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="n">#${String(alibiCount - i).padStart(3, "0")}</span>
          <span class="e">${h.en} · ${h.jp}</span>
          <span class="pct">${h.score}%</span>
          <span>${h.time}</span>`;
        log.appendChild(li);
      });
    } catch {}
  }

  /* ---------------- copy ---------------- */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }

  async function copyExcuse() {
    if (!current) return;
    const { seg, score } = current;
    const text = `EXCUSE ROULETTE // ALIBI #${String(alibiCount).padStart(3, "0")}\n` +
      `EXCUSE: ${seg.en} (${seg.jp})\n${seg.line}\nBELIEVABILITY: ${score}%`;
    const ok = await copyText(text);
    copyLabel.textContent = ok ? "COPIED コピー済" : "COPY FAILED";
    copyBtn.classList.add("copied");
    blip(2100, 0.08, "sine", 0.05);
    setTimeout(() => { copyLabel.textContent = "COPY EXCUSE"; copyBtn.classList.remove("copied"); }, 1600);
  }

  /* ---------------- scroll reaction ---------------- */
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    document.documentElement.style.setProperty("--sc", p.toFixed(4));
  }

  /* ---------------- clock ---------------- */
  function tick() {
    clock.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Tokyo" }) + " JST";
  }

  /* ---------------- reveal on scroll ---------------- */
  function initReveal() {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------------- init ---------------- */
  function init() {
    fitCanvas();
    drawWheel();
    onScroll();
    tick();
    setInterval(tick, 1000);
    restoreLog();
    $("#yr").textContent = new Date().getFullYear();
    initReveal();

    window.addEventListener("resize", () => { fitCanvas(); drawWheel(); });
    window.addEventListener("scroll", onScroll, { passive: true });

    hub.addEventListener("click", spin);
    spinBtn.addEventListener("click", spin);
    copyBtn.addEventListener("click", copyExcuse);
    clearLog.addEventListener("click", () => {
      if (!confirm("Purge the denial archive?")) return;
      try { localStorage.removeItem("er_history"); } catch {}
      log.innerHTML = "";
      logEmpty.style.display = "block";
    });

    window.addEventListener("keydown", (e) => {
      if ((e.code === "Space" || e.code === "Enter") && !spinning && !e.repeat) {
        e.preventDefault();
        spin();
      }
    });

    // add reveal classes to panels after initial paint
    setTimeout(() => {
      $$(".panel, .log-section").forEach((el) => el.classList.add("reveal"));
      initReveal();
    }, 600);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();