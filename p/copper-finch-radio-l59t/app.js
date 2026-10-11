// Copper Finch Radio — dawn dial · chorus trade · flock board. No deps, localStorage only.
const $ = (s) => document.querySelector(s);
const store = {
  key: "cfr-l59t-v1",
  data: { mine: [], loved: {}, bonus: {} },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(this.key) || "{}")); }
    catch { /* fresh nest */ }
    if (!Array.isArray(this.data.mine)) this.data.mine = [];
    if (!this.data.loved || typeof this.data.loved !== "object") this.data.loved = {};
    if (!this.data.bonus || typeof this.data.bonus !== "object") this.data.bonus = {};
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch { /* private mode */ } },
};
store.load();

const NAMES = ["peep", "trill", "warble", "buzz"];
const GLYPHS = ["·", "♪", "♫", "〜", "≋"];
const SNAME = ["rest", "peep", "trill", "warble", "buzz"];
const WILD = ["Mossbeak", "Cinderwing", "Dusktail", "Pebblethroat", "Ambercap", "Willowpip", "Rustlefinch", "Clovercall"];
const SEEDS = [
  { id: "seed-bramble", finch: "Bramble", title: "First Rustle", steps: [2, 0, 1, 2, 0, 3, 1, 0], at: 262, likes: 24 },
  { id: "seed-copper", finch: "Copperhen", title: "Kettle Sunrise", steps: [1, 1, 2, 0, 3, 3, 2, 1], at: 312, likes: 41 },
  { id: "seed-wren", finch: "Little Wren", title: "Hedge Arithmetic", steps: [3, 2, 3, 2, 1, 0, 4, 0], at: 348, likes: 33 },
  { id: "seed-sedge", finch: "Sedge", title: "Reed Argument", steps: [4, 0, 4, 1, 0, 2, 2, 3], at: 385, likes: 19 },
  { id: "seed-thistle", finch: "Thistlecoat", title: "Seedhead Hymn", steps: [2, 3, 1, 4, 0, 1, 3, 2], at: 421, likes: 28 },
  { id: "seed-ochre", finch: "Ochre", title: "Full-Day Strut", steps: [1, 2, 1, 2, 3, 4, 3, 1], at: 458, likes: 15 },
];

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ---------- audio ---------- */
let ctx = null, master = null, dawnTimer = null, waking = false;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = ($("#vol").value / 100) * 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone({ type = "sine", f0 = 3000, f1 = 3400, dur = 0.12, peak = 0.25, at = 0 }) {
  const c = audio(), t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 40), t + dur);
  env(g, t, peak, dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function chirp(v, at = 0, base = 3000, glow = 0.5) {
  if (v === 0) return;
  const j = (Math.random() - 0.5) * 320;
  if (v === 1) tone({ f0: base + j, f1: base * 1.25 + j, dur: 0.13, peak: 0.28, at });
  else if (v === 2) { for (let i = 0; i < 3; i++) tone({ type: "triangle", f0: base * 1.1 + j, f1: base * 1.4 + j, dur: 0.07, peak: 0.2, at: at + i * 0.075 }); }
  else if (v === 3) {
    const c = audio(), t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
    o.type = "sine"; o.frequency.value = base + j;
    l.frequency.value = 9; lg.gain.value = base * 0.18;
    l.connect(lg); lg.connect(o.frequency);
    env(g, t, 0.24, 0.34);
    o.connect(g); g.connect(master);
    o.start(t); l.start(t); o.stop(t + 0.4); l.stop(t + 0.4);
  }
  else tone({ type: "sawtooth", f0: base * 0.55 + j / 2, f1: base * 0.5 + j / 2, dur: 0.16, peak: 0.12 + glow * 0.06, at });
}
function phraseFreq(steps) { // base pitch follows first voiced step + dial
  const dial = +$("#dialSlider").value;
  return 2400 + ((dial - 240) / 240) * 1400;
}
function playPhrase(steps, onStep) {
  audio();
  const base = phraseFreq(steps);
  steps.forEach((v, i) => {
    chirp(v, i * 0.22, base, 0.5);
    if (onStep) setTimeout(() => onStep(i), i * 220);
  });
  return steps.length * 220;
}

/* ---------- dawn dial ---------- */
const dial = { min: 240, max: 480, val: 330 };
function fmt(mins) { return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`; }
function phaseOf(m) {
  if (m < 300) return "night murmur";
  if (m < 340) return "first light";
  if (m < 390) return "chorus peak";
  if (m < 440) return "golden hour";
  return "full day";
}
function noteOf(m) {
  const scale = ["E5", "F5", "G5", "A5", "B5", "C6", "D6", "E6"];
  return scale[Math.min(7, Math.floor(((m - 240) / 240) * 8))];
}
function dialParams(m) {
  const t = (m - 240) / 240; // 0..1
  return { t, density: 0.15 + Math.sin(t * Math.PI) * 0.75 + t * 0.1, glow: t };
}
function renderDial() {
  const m = dial.val;
  $("#dialTime").textContent = fmt(m);
  $("#dialPhase").textContent = phaseOf(m);
  $("#dialSlider").value = m;
  $("#dialKnob").setAttribute("aria-valuenow", m);
  const p = dialParams(m);
  $("#mDensity").textContent = `${Math.round(Math.min(1, p.density) * 100)}%`;
  $("#bDensity").style.width = `${Math.round(Math.min(1, p.density) * 100)}%`;
  $("#mPitch").textContent = noteOf(m);
  $("#bPitch").style.width = `${Math.round(((m - 240) / 240) * 100)}%`;
  const glow = p.glow < 0.33 ? "soft" : p.glow < 0.7 ? "warm" : "bright";
  $("#mGlow").textContent = glow;
  $("#bGlow").style.width = `${Math.round(p.glow * 100)}%`;
  $("#dialMicro").textContent =
    m < 300 ? "Before sunrise the wrens murmur — sparse, low, half-asleep."
    : m < 390 ? "Near 6 the whole hedge sings. Density at its peak."
    : "The chorus thins as the light hardens. Peps turn territorial.";
  const ang = -135 + ((m - 240) / 240) * 270;
  $("#dialKnob").style.rotate = `${ang * 0.12}deg`;
}
function setDial(m) { dial.val = Math.max(240, Math.min(480, Math.round(m))); renderDial(); }
function buildTicks() {
  const f = $("#tickField");
  for (let i = 0; i <= 24; i++) {
    const s = document.createElement("span");
    s.className = "tick" + (i % 4 === 0 ? " major" : "");
    const a = (i / 24) * Math.PI * 2;
    s.style.transform = `translate(-50%,-50%) rotate(${a}rad) translateY(-128px)`;
    f.appendChild(s);
  }
}
function knobDrag() {
  const knob = $("#dialKnob"), ring = $("#dialRing");
  let on = false;
  const toVal = (e) => {
    const r = ring.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - (r.left + r.width / 2);
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - (r.top + r.height / 2);
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 135;
    deg = ((deg % 360) + 360) % 360;
    setDial(240 + Math.min(1, Math.max(0, deg / 270)) * 240);
  };
  knob.addEventListener("pointerdown", (e) => { on = true; knob.setPointerCapture(e.pointerId); });
  knob.addEventListener("pointermove", (e) => on && toVal(e));
  knob.addEventListener("pointerup", () => (on = false));
  knob.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setDial(dial.val - 5); e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { setDial(dial.val + 5); e.preventDefault(); }
  });
}

/* generative dawn engine */
const flits = []; // canvas particles
function dawnTick() {
  const m = dial.val, p = dialParams(m);
  if (Math.random() < Math.min(0.95, p.density)) {
    const v = 1 + Math.floor(Math.random() * 4);
    const base = 2400 + ((m - 240) / 240) * 1400 + (Math.random() - 0.5) * 500;
    chirp(v, 0, base, p.glow);
    flits.push({ x: Math.random(), y: 0.25 + Math.random() * 0.6, r: 3 + Math.random() * 7, a: 1, hue: Math.random() });
  }
  if (Math.random() < 0.06) tone({ f0: 180, f1: 220, dur: 1.6, peak: 0.05 }); // low hedge hum
}
function setWaking(on) {
  waking = on;
  $("#btnWake").disabled = on;
  $("#btnSleep").disabled = !on;
  $("#btnWake").classList.toggle("playing", on);
  $("#btnWake").textContent = on ? "◦ singing…" : "wake the thicket";
  $("#liveDot").style.background = on ? "var(--copper)" : "var(--moss)";
  clearInterval(dawnTimer);
  if (on) { audio(); dawnTick(); dawnTimer = setInterval(dawnTick, 260); }
}

/* thicket canvas */
function thicket() {
  const cv = $("#thicket"), g = cv.getContext("2d");
  function frame() {
    const W = cv.width, H = cv.height, p = dialParams(dial.val);
    g.clearRect(0, 0, W, H);
    // glow hill
    const gx = W * (0.2 + p.glow * 0.6);
    const grad = g.createRadialGradient(gx, H * 0.72, 8, gx, H * 0.72, W * 0.45);
    grad.addColorStop(0, waking ? "rgba(178,98,42,.85)" : "rgba(178,98,42,.4)");
    grad.addColorStop(1, "rgba(27,19,12,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // rolling hedge
    g.fillStyle = "#2F5D3A";
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const wob = waking ? Math.sin(x / 60 + Date.now() / 900) * 5 : 0;
      g.lineTo(x, H * 0.78 + Math.sin(x / 130) * 12 + wob);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    // flits
    for (let i = flits.length - 1; i >= 0; i--) {
      const f = flits[i];
      f.y -= 0.008; f.a -= 0.012;
      if (f.a <= 0 || f.y < 0) { flits.splice(i, 1); continue; }
      g.globalAlpha = Math.max(0, f.a);
      g.fillStyle = f.hue > 0.5 ? "#F6EEDF" : "#B2622A";
      g.beginPath();
      g.ellipse(f.x * W, f.y * H, f.r * 1.8, f.r, f.x * 6, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    // perched finches pulse with density
    g.fillStyle = "#F6EEDF";
    const n = 3 + Math.round(p.density * 5);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.7) * (W / (n + 1));
      const bob = waking ? Math.abs(Math.sin(Date.now() / 300 + i * 1.7)) * 6 : 0;
      const y = H * 0.78 + Math.sin(x / 130) * 12 - 8 - bob;
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x + 4, y - 1); g.lineTo(x + 10, y + 1); g.lineTo(x + 4, y + 3); g.closePath();
      g.fillStyle = "#B2622A"; g.fill(); g.fillStyle = "#F6EEDF";
    }
    requestAnimationFrame(frame);
  }
  // crisp on hidpi
  const fit = () => {
    const r = cv.getBoundingClientRect();
    if (r.width) { cv.width = Math.round(r.width * 2); cv.height = Math.round(r.width * 0.42 * 2); }
  };
  fit(); addEventListener("resize", fit);
  requestAnimationFrame(frame);
}

/* ---------- chorus trade ---------- */
let steps = [2, 0, 1, 3, 0, 2, 1, 0];
let previewing = false;
function renderSteps(lit = -1) {
  const box = $("#steps");
  box.innerHTML = "";
  steps.forEach((v, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "step" + (i === lit ? " lit" : "");
    b.dataset.v = v;
    b.setAttribute("aria-label", `Note ${i + 1}: ${SNAME[v]}. Activate to change.`);
    b.innerHTML = `<span class="glyph">${GLYPHS[v]}</span><span class="sname">${SNAME[v]}</span><small>${i + 1}</small>`;
    b.addEventListener("click", () => {
      steps[i] = (steps[i] + 1) % 5;
      audio(); chirp(steps[i], 0, phraseFreq(steps), 0.5);
      renderSteps(i);
    });
    box.appendChild(b);
  });
}
function codeOf(obj) {
  const raw = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return "CFR1-" + raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function objOf(code) {
  const s = String(code || "").trim().replace(/^CFR1-/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!s) throw new Error("empty");
  const o = JSON.parse(decodeURIComponent(escape(atob(s))));
  if (!o || !Array.isArray(o.s) || o.s.length !== 8 || o.s.some((v) => ![0, 1, 2, 3, 4].includes(v))) throw new Error("bad shape");
  return { finch: String(o.n || "Nameless").slice(0, 18), title: String(o.p || "Untitled").slice(0, 26), steps: o.s };
}
function perch(o, tag = "traded") {
  const rec = { id: "u" + Date.now().toString(36) + Math.floor(Math.random() * 999), ...o, at: dial.val, when: Date.now(), tag };
  store.data.mine.unshift(rec);
  store.save(); renderFlock();
  return rec;
}

/* ---------- flock board ---------- */
function allNests() {
  const mine = store.data.mine.map((m) => ({ ...m, likes: (store.data.bonus[m.id] || 0) + 1, mine: true }));
  const seeds = SEEDS.map((s) => ({ ...s, likes: s.likes + (store.data.bonus[s.id] || 0), loved: !!store.data.loved[s.id], when: 0 }));
  return [...mine, ...seeds];
}
function renderFlock() {
  const sort = $("#sortSel").value;
  const nests = allNests();
  nests.sort((a, b) =>
    sort === "loved" ? b.likes - a.likes
    : sort === "early" ? a.at - b.at : (b.when || 0) - (a.when || 0));
  const box = $("#nests");
  box.innerHTML = "";
  nests.forEach((n) => {
    const loved = !!store.data.loved[n.id];
    const el = document.createElement("article");
    el.className = "nest" + (n.mine ? " mine" : "");
    el.innerHTML = `
      <div class="nest-top"><span class="finch"></span><span class="time"></span></div>
      <p class="phrase"></p>
      <p class="glyphs" aria-hidden="true"></p>
      <div class="nest-btns">
        <button class="mini song" type="button">▶ sing</button>
        <button class="mini love" type="button" aria-pressed="${loved}">♥ <span>${n.likes + (loved ? 1 : 0)}</span></button>
        ${n.mine ? '<span class="tag">yours</span>' : `<span class="tag">${fmt(n.at)}</span>`}
      </div>`;
    el.querySelector(".finch").textContent = n.finch;
    el.querySelector(".time").textContent = n.mine ? `${fmt(n.at)} · yours` : `${fmt(n.at)} · wild`;
    el.querySelector(".phrase").textContent = n.title;
    el.querySelector(".glyphs").textContent = n.steps.map((v) => GLYPHS[v]).join(" ");
    el.querySelector(".song").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      btn.textContent = "◦ singing";
      const base = 2400 + ((n.at - 240) / 240) * 1400;
      n.steps.forEach((v, i) => chirp(v, i * 0.22, base, 0.5));
      setTimeout(() => (btn.textContent = "▶ sing"), n.steps.length * 220 + 150);
    });
    const love = el.querySelector(".love");
    if (loved) love.classList.add("loved");
    love.addEventListener("click", () => {
      if (store.data.loved[n.id]) delete store.data.loved[n.id];
      else { store.data.loved[n.id] = true; audio(); chirp(2, 0, 3600, 0.6); }
      store.save(); renderFlock();
    });
    box.appendChild(el);
  });
  $("#flockCount").textContent = `${nests.length} nests on the hedge · ${store.data.mine.length} released by you · taps keep them warm`;
}

/* ---------- live label ---------- */
function liveTick() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  $("#liveLabel").textContent =
    h >= 4 && h < 5.5 ? "night murmur" : h >= 5.5 && h < 6.5 ? "first light"
    : h >= 6.5 && h < 7.2 ? "chorus peak" : h >= 7.2 && h < 9 ? "golden hour" : "away from dawn";
}

/* ---------- wire up ---------- */
function init() {
  buildTicks(); renderDial(); knobDrag(); thicket(); renderSteps(); renderFlock(); liveTick();
  setInterval(liveTick, 60000);

  $("#dialSlider").addEventListener("input", (e) => setDial(+e.target.value));
  $("#btnWake").addEventListener("click", () => { setWaking(true); toast("The thicket wakes — drag the dial while it sings."); });
  $("#btnSleep").addEventListener("click", () => { setWaking(false); toast("Roosted. The hedge holds its breath."); });
  $("#vol").addEventListener("input", (e) => { if (master) master.gain.value = (e.target.value / 100) * 0.5; });

  $("#btnPreview").addEventListener("click", () => {
    if (previewing) return;
    previewing = true;
    $("#btnPreview").textContent = "◦ singing…";
    playPhrase(steps, (i) => renderSteps(i));
    setTimeout(() => { previewing = false; $("#btnPreview").textContent = "play my phrase"; renderSteps(); }, steps.length * 220 + 120);
  });
  $("#btnScatter").addEventListener("click", () => {
    steps = Array.from({ length: 8 }, () => Math.floor(Math.random() * 5));
    renderSteps(); playPhrase(steps, (i) => renderSteps(i));
    setTimeout(() => renderSteps(), steps.length * 220 + 120);
  });
  $("#btnCatch").addEventListener("click", () => {
    const wild = {
      finch: WILD[Math.floor(Math.random() * WILD.length)],
      title: ["Dewdrop Etude", "Barklight Reel", "Mossfire Call", "Pebble Skim", "Amber Drift", "Thorn Lullaby"][Math.floor(Math.random() * 6)],
      steps: Array.from({ length: 8 }, () => Math.floor(Math.random() * 5)),
    };
    const rec = perch(wild, "caught");
    playPhrase(rec.steps);
    $("#caughtNote").textContent = `Caught “${rec.title}” by ${rec.finch} — perched on the board below.`;
    toast(`Caught ${rec.finch}'s chorus.`);
  });

  $("#releaseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!steps.some((v) => v > 0)) { toast("Give your phrase at least one voice first."); return; }
    const finch = $("#finchName").value.trim() || "Nameless Finch";
    const title = $("#phraseName").value.trim() || "Untitled Dawn";
    perch({ finch, title, steps: [...steps] }, "released");
    $("#finchName").value = ""; $("#phraseName").value = "";
    toast(`Released “${title}” to the flock board.`);
    document.querySelector("#flockPod").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("#btnCopy").addEventListener("click", async () => {
    const code = codeOf({ n: $("#finchName").value.trim() || "Nameless Finch", p: $("#phraseName").value.trim() || "Untitled Dawn", s: steps });
    try { await navigator.clipboard.writeText(code); $("#codeNote").textContent = "Copied — send it to a fellow finch."; }
    catch { $("#codeNote").textContent = code; }
    toast("Chorus code ready to carry.");
  });
  $("#btnDownload").addEventListener("click", () => {
    const code = codeOf({ n: $("#finchName").value.trim() || "Nameless Finch", p: $("#phraseName").value.trim() || "Untitled Dawn", s: steps });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = "dawn-chorus.chorus";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const doImport = (raw) => {
    try {
      const o = objOf(raw);
      steps = [...o.steps]; renderSteps();
      perch(o, "traded");
      $("#codeNote").textContent = `Perched “${o.title}” by ${o.finch}.`;
      playPhrase(steps);
    } catch { $("#codeNote").textContent = "That code wouldn't hatch — check it and try again."; }
  };
  $("#btnImport").addEventListener("click", () => doImport($("#codeIn").value));
  $("#btnUpload").addEventListener("click", () => $("#fileIn").click());
  $("#fileIn").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => doImport(String(r.result || ""));
    r.readAsText(f);
    e.target.value = "";
  });

  $("#sortSel").addEventListener("change", renderFlock);
  $("#btnDusk").addEventListener("click", () => {
    if (!confirm("Fold for dusk? Your released choruses and hearts will fly away.")) return;
    store.data = { mine: [], loved: {}, bonus: {} };
    store.save(); renderFlock();
    toast("Dusk folded. A clean hedge for tomorrow's dawn.");
  });

  document.addEventListener("pointerdown", () => { if (ctx && ctx.state === "suspended") ctx.resume(); }, { passive: true });
}
init();
