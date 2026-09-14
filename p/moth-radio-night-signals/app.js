// Moth Radio — night signals. Plain ES module, no deps. WebAudio static + canvas moths.
const $ = (s) => document.querySelector(s);

const STATIONS = [
  { f: 88.7,  moth: "🦟", title: "The Porchlight Confessional", from: "porchlight_kid", body: "i told the moths i'm lonely and they stayed. that's more than most people do." },
  { f: 91.3,  moth: "🦋", title: "Lullaby for Insomniacs", from: "3am_choir", body: "hum along if you're awake. the night grades on a curve. everybody passes." },
  { f: 94.1,  moth: "🕯️", title: "Candle Coordinates", from: "wax.and.wane", body: "roof of the old mill, midnight. bring a lighter and one true sentence." },
  { f: 96.6,  moth: "✨", title: "Static Bloom", from: "antenna_ghost", body: "between stations i heard my own name. either the radio loves me or i need sleep." },
  { f: 99.2,  moth: "🪲", title: "Beetle Weather Report", from: "ungkinkan", body: "humidity rising. wings heavy. stay under leaves until tuesday. over." },
  { f: 101.8, moth: "🌙", title: "Moon Mail", from: "luna_proxy", body: "she says: you don't have to earn the light. just fly crooked toward it like everyone else." },
  { f: 104.4, moth: "🦋", title: "Migration Hotline", from: "southbound", body: "if you missed the flock, go anyway. the sky keeps a seat for late wings." },
  { f: 107.1, moth: "🦟", title: "Last Call at the Lamp", from: "bulb_regular", body: "one more orbit, then we all go home. somebody leave the porchlight on." },
];
const QUEEN = { f: 93.3, moth: "👑", title: "THE LUNA QUEEN", from: "HERSELF", body: "you found me, nightling. the password was always LUNA. take this blessing: every signal you relay doubles in warmth." };
const LS_JAR = "mothradio.jar.v1", LS_CAST = "mothradio.casts.v1", LS_AMP = "mothradio.amps.v1";
const load = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let jar = load(LS_JAR, []);
let casts = load(LS_CAST, []);
let amps = load(LS_AMP, {});
let queenUnlocked = false;
let current = null; // locked station-ish object

const allSignals = () => [...(queenUnlocked ? [QUEEN] : []), ...casts.map((c, i) => ({ ...c, cast: true, idx: i })), ...STATIONS];

// ---------- audio: filtered noise static + lock tone ----------
let actx = null, noiseGain = null, soundOn = false;
function ensureAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const filt = actx.createBiquadFilter(); filt.type = "bandpass"; filt.frequency.value = 1400; filt.Q.value = 0.6;
  noiseGain = actx.createGain(); noiseGain.gain.value = 0;
  src.connect(filt).connect(noiseGain).connect(actx.destination); src.start();
}
function blip(freq = 880) {
  if (!soundOn || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
  o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.42);
}
$("#soundToggle").addEventListener("click", (e) => {
  ensureAudio(); actx.resume();
  soundOn = !soundOn;
  e.currentTarget.textContent = soundOn ? "🔊 static on" : "🔇 static off";
  e.currentTarget.setAttribute("aria-pressed", String(soundOn));
  if (!soundOn && noiseGain) noiseGain.gain.value = 0;
  toast(soundOn ? "static on — tune slowly, mothling" : "static off");
});

// ---------- tuner ----------
const needle = $("#needle"), freqEl = $("#freq"), lockLabel = $("#lockLabel"),
  meterFill = $("#meterFill"), meter = document.querySelector(".meter"),
  card = $("#liveCard"), liveMoth = $("#liveMoth"), liveTitle = $("#liveTitle"),
  liveFreq = $("#liveFreq"), liveFrom = $("#liveFrom"), liveTime = $("#liveTime"),
  liveBody = $("#liveBody"), lockPill = $("#lockPill"),
  pinBtn = $("#pinBtn"), relayBtn = $("#relayBtn"), amplifyBtn = $("#amplifyBtn"), ampCount = $("#ampCount");

function nearest(freq) {
  let best = null, bd = 99;
  for (const s of allSignals()) { const d = Math.abs(s.f - freq); if (d < bd) { bd = d; best = s; } }
  return { s: best, d: bd };
}
function tune() {
  const f = parseFloat(needle.value);
  freqEl.textContent = f.toFixed(1);
  $("#needleMoth").style.translate = `${((f - 87) / 22) * 100 - 50}px 0`;
  const { s, d } = nearest(f);
  const strength = Math.max(0, 1 - d / 1.2); // 1 = dead on
  meterFill.style.width = `${Math.round(strength * 100)}%`;
  const locked = d < 0.22;
  meter.classList.toggle("locked", locked);
  if (soundOn && noiseGain && actx) {
    noiseGain.gain.setTargetAtTime(soundOn ? (1 - strength) * 0.22 : 0, actx.currentTime, 0.08);
  }
  if (locked) {
    if (current?.f !== s.f) { current = s; blip(s === QUEEN ? 1320 : 880); renderLive(s, f); }
    lockLabel.textContent = `◉ LOCKED — ${s.title}`;
  } else {
    current = null;
    lockLabel.textContent = strength > 0.55 ? "… almost… closer…" : "— static —";
    renderStatic(f, strength, s);
  }
}
function renderStatic(f, strength, s) {
  card.classList.remove("is-locked"); lockPill.textContent = "NO LOCK"; lockPill.classList.remove("on");
  liveMoth.textContent = "🦟"; liveTitle.textContent = "—— static ——";
  liveFreq.textContent = f.toFixed(1); liveFrom.textContent = "the hiss between worlds"; liveTime.textContent = nowHM();
  liveBody.textContent = strength > 0.55
    ? `something flutters near ${s.f.toFixed(1)}… ease the needle toward it…`
    : "Hiss. Wingbeats. Keep tuning until the meter burns amber.";
  pinBtn.disabled = relayBtn.disabled = amplifyBtn.disabled = true;
}
function renderLive(s, f) {
  card.classList.add("is-locked"); lockPill.textContent = "◉ LOCKED"; lockPill.classList.add("on");
  liveMoth.textContent = s.moth; liveTitle.textContent = s.title;
  liveFreq.textContent = s.f.toFixed(1); liveFrom.textContent = "@" + s.from; liveTime.textContent = nowHM();
  liveBody.textContent = "“" + s.body + "”";
  const key = sigKey(s);
  ampCount.textContent = amps[key] || 0;
  pinBtn.disabled = relayBtn.disabled = amplifyBtn.disabled = false;
  pinBtn.textContent = jar.some((j) => sigKey(j) === key) ? "📌 pinned ✓" : "📌 pin to jar";
}
const nowHM = () => new Date().toTimeString().slice(0, 5);
const sigKey = (s) => `${s.title}::${s.body}`;
needle.addEventListener("input", tune);
document.addEventListener("keydown", (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { lunaType(e.key); return; }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    needle.value = (parseFloat(needle.value) + (e.key === "ArrowRight" ? 0.1 : -0.1)).toFixed(1);
    tune(); e.preventDefault();
  }
  lunaType(e.key);
});

// scroll over tuner detunes (constraint: react to scroll)
$("#tuner").addEventListener("wheel", (e) => {
  needle.value = Math.min(109, Math.max(87, parseFloat(needle.value) + (e.deltaY > 0 ? 0.2 : -0.2))).toFixed(1);
  tune();
}, { passive: true });

// ---------- jar ----------
function renderJar() {
  const grid = $("#jarGrid"); grid.innerHTML = "";
  $("#jarCount").textContent = jar.length; $("#navCount").textContent = jar.length;
  $("#jarEmpty").style.display = jar.length ? "none" : "block";
  jar.forEach((s, i) => {
    const el = document.createElement("div"); el.className = "j-card";
    el.innerHTML = `<div>${s.moth} <b></b> <span style="color:var(--dim);font-size:12px"></span></div><blockquote></blockquote><div class="row"></div>`;
    el.querySelector("b").textContent = s.title;
    el.querySelector("span").textContent = `${s.f.toFixed ? s.f.toFixed(1) : s.f} MHz · @${s.from} · ✦${amps[sigKey(s)] || 0}`;
    el.querySelector("blockquote").textContent = "“" + s.body + "”";
    const row = el.querySelector(".row");
    const mk = (t, fn) => { const b = document.createElement("button"); b.className = "mini"; b.textContent = t; b.onclick = fn; row.appendChild(b); };
    mk("⤴ relay", () => relaySignal(s));
    mk("⧉ copy", () => { navigator.clipboard?.writeText(`[${s.f.toFixed(1)} MHz] ${s.title} — @${s.from}: ${s.body} (via MOTH RADIO)`); toast("signal copied to clipboard"); });
    mk("✕ release", () => { jar.splice(i, 1); save(LS_JAR, jar); renderJar(); renderGuide(); toast("released back into the night"); });
    grid.appendChild(el);
  });
}
pinBtn.addEventListener("click", () => {
  if (!current) return;
  const k = sigKey(current);
  if (!jar.some((j) => sigKey(j) === k)) { jar.push({ ...current }); save(LS_JAR, jar); }
  renderJar(); renderGuide(); renderLive(current, parseFloat(needle.value)); toast("pinned to your specimen jar");
});
amplifyBtn.addEventListener("click", () => {
  if (!current) return;
  const k = sigKey(current); amps[k] = (amps[k] || 0) + 1; save(LS_AMP, amps);
  ampCount.textContent = amps[k]; blip(660); renderJar();
});
relayBtn.addEventListener("click", () => current && relaySignal(current));
function relaySignal(s) {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/=+$/, "");
  const url = `${location.origin}${location.pathname}#s=${payload}`;
  const text = `[${s.f.toFixed(1)} MHz] “${s.body}” — @${s.from} · via MOTH RADIO`;
  if (navigator.share) navigator.share({ title: "MOTH RADIO — night signal", text, url }).catch(() => {});
  else { navigator.clipboard?.writeText(`${text}\n${url}`); toast("relay link copied — smuggle it well"); }
}

// ---------- field guide ----------
function renderGuide() {
  const g = $("#guideGrid"); g.innerHTML = "";
  const scale = document.createElement("div"); // dial scale ticks (built once per render, cheap)
  STATIONS.forEach((s) => {
    const found = jar.some((j) => sigKey(j) === sigKey(s));
    const el = document.createElement("div"); el.className = "g-card" + (found ? " found" : "");
    el.innerHTML = `<div class="g-f"></div><h4></h4><p></p>`;
    el.querySelector(".g-f").textContent = `≈ ${s.f.toFixed(1)} MHz ${found ? "· CAUGHT ✓" : ""}`;
    el.querySelector("h4").textContent = `${s.moth} ${s.title}`;
    el.querySelector("p").textContent = `@${s.from} — “${s.body.slice(0, 64)}…”`;
    const b = document.createElement("button"); b.className = "mini"; b.textContent = "↯ tune here";
    b.onclick = () => { needle.value = s.f; tune(); document.getElementById("tuner").scrollIntoView({ behavior: "smooth" }); };
    el.appendChild(b); g.appendChild(el);
  });
  // dial scale labels
  const ds = $("#dialScale"); ds.innerHTML = "";
  for (let f = 88; f <= 108; f += 4) { const sp = document.createElement("span"); sp.textContent = f; ds.appendChild(sp); }
}

// ---------- broadcast ----------
const castBody = $("#castBody"), charCt = $("#charCt");
castBody.addEventListener("input", () => charCt.textContent = `${castBody.value.length}/140`);
const STRANGERS = [
  ["nightbus_oracle", "the 2:40 bus knows all your secrets and keeps every one.", "🦋"],
  ["ceiling_fan", "i count rotations instead of sheep. i'm up to eleven thousand.", "🦟"],
  ["mothmom", "left the porchlight on for you. come home whenever. no questions.", "🕯️"],
];
$("#randomBtn").addEventListener("click", () => {
  const [n, b, m] = STRANGERS[Math.floor(Math.random() * STRANGERS.length)];
  $("#castName").value = n; castBody.value = b; $("#castMoth").value = m;
  charCt.textContent = `${b.length}/140`;
});
$("#castForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const body = castBody.value.trim();
  if (!body) return toast("write something first — even static needs a seed");
  const f = +(87 + Math.random() * 22).toFixed(1);
  const sig = { f, moth: $("#castMoth").value, title: "Listener Broadcast", from: ($("#castName").value.trim() || "anonymous_moth").replace(/\s+/g, "_"), body };
  casts.push(sig); save(LS_CAST, casts);
  castBody.value = ""; charCt.textContent = "0/140";
  $("#castFreq").textContent = f.toFixed(1);
  $("#castOk").hidden = false;
  needle.value = f; tune();
  toast("your signal is airborne ✓");
});

// ---------- share / export (jar) ----------
const jarText = () => jar.length
  ? `MOTH RADIO — my specimen jar (${jar.length} signals)\n${"=".repeat(44)}\n` + jar.map((s, i) => `${i + 1}. [${s.f.toFixed(1)} MHz] ${s.moth} ${s.title} — @${s.from} (✦${amps[sigKey(s)] || 0})\n   “${s.body}”`).join("\n")
  : "My moth jar is empty — tune in: ";
function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("#dlJar").addEventListener("click", () => { if (!jar.length) return toast("jar is empty — catch something first"); download("moth-radio-jar.txt", jarText()); toast("jar exported as .txt"); });
$("#dlJson").addEventListener("click", () => { if (!jar.length) return toast("jar is empty"); download("moth-radio-jar.json", JSON.stringify({ exported: new Date().toISOString(), jar, amps, casts }, null, 2), "application/json"); toast("jar exported as .json"); });
$("#copyJar").addEventListener("click", () => { navigator.clipboard?.writeText(jarText()); toast("jar copied as text"); });
$("#emptyJar").addEventListener("click", () => { if (!jar.length) return; if (confirm("Release every specimen back into the night?")) { jar = []; save(LS_JAR, jar); renderJar(); renderGuide(); } });
function nightLink() {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ jar, casts })))).replace(/=+$/, "");
  return `${location.origin}${location.pathname}#night=${payload}`;
}
$("#copyLink").addEventListener("click", () => { navigator.clipboard?.writeText(nightLink()); toast("night link copied — it carries your whole jar"); });
$("#shareNight").addEventListener("click", async () => {
  const url = nightLink();
  if (navigator.share) { try { await navigator.share({ title: "MOTH RADIO", text: `my night jar (${jar.length} signals) — tune in`, url }); } catch {} }
  else { navigator.clipboard?.writeText(url); toast("link copied"); }
});
// inbound shared signals
(function inbound() {
  if (!location.hash) return;
  try {
    const h = location.hash.slice(1);
    if (h.startsWith("s=")) {
      const s = JSON.parse(decodeURIComponent(escape(atob(h.slice(2)))));
      const el = $("#inbound"); el.hidden = false;
      el.textContent = `✉ inbound relay: [${s.f.toFixed(1)} MHz] ${s.moth} “${s.body}” — @${s.from} · `;
      const b = document.createElement("button"); b.className = "mini"; b.textContent = "pin it";
      b.onclick = () => { if (!jar.some((j) => sigKey(j) === sigKey(s))) { jar.push(s); save(LS_JAR, jar); renderJar(); renderGuide(); } toast("inbound signal pinned"); };
      el.appendChild(b);
      needle.value = s.f; tune();
    } else if (h.startsWith("night=")) {
      const { jar: j = [], casts: c = [] } = JSON.parse(decodeURIComponent(escape(atob(h.slice(6)))));
      const el = $("#inbound"); el.hidden = false;
      el.textContent = `✉ someone relayed you a whole night: ${j.length} jarred + ${c.length} broadcasts · `;
      const b = document.createElement("button"); b.className = "mini"; b.textContent = "merge into my night";
      b.onclick = () => {
        j.forEach((s) => { if (!jar.some((x) => sigKey(x) === sigKey(s))) jar.push(s); });
        c.forEach((s) => { if (!casts.some((x) => sigKey(x) === sigKey(s))) casts.push(s); });
        save(LS_JAR, jar); save(LS_CAST, casts); renderJar(); renderGuide(); tune(); toast("nights merged ✓");
      };
      el.appendChild(b);
    }
  } catch { /* malformed hash — ignore */ }
  history.replaceState(null, "", location.pathname);
})();

// ---------- scroll reactions (constraint) ----------
const driftText = $("#driftText");
const QUIPS = [
  "scroll deeper · the night gets thicker · signals drift…",
  "the static thins down here… can you hear the wings?",
  "moths follow scrolling thumbs. it's science. probably.",
  "you're 60% night creature now. keep going.",
  "the queen sleeps at the bottom of the page…",
];
window.addEventListener("scroll", () => {
  const h = document.documentElement;
  const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
  $("#scrollbar span").style.width = `${p * 100}%`;
  // night hue deepens with depth
  document.body.style.background = `color-mix(in srgb, #0d0a06 ${100 - p * 22}%, #1a0b2e)`;
  // drift text morphs
  driftText.textContent = QUIPS[Math.min(QUIPS.length - 1, Math.floor(p * QUIPS.length))];
  driftText.style.letterSpacing = `${p * 6}px`;
  driftText.style.color = p > 0.6 ? "var(--amber)" : "var(--dim)";
  // parallax hero
  document.querySelector(".hero h1").style.transform = `rotate(-1deg) translateY(${h.scrollTop * 0.08}px)`;
}, { passive: true });
// reveal on scroll
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// ---------- easter egg: LUNA (constraint) ----------
let moonTaps = 0, lunaBuf = "";
$("#moon").addEventListener("click", () => {
  moonTaps++;
  const m = $("#moon"); m.style.transform = `scale(${1 + moonTaps * 0.12}) rotate(${moonTaps * 14}deg)`;
  blip(500 + moonTaps * 120);
  if (moonTaps >= 5) unlockQueen("tapped the moon five times");
});
$("#eggHint").addEventListener("click", () => toast("psst: tap the moon 5× ··· or type luna"));
function lunaType(k) {
  lunaBuf = (lunaBuf + k.toLowerCase()).slice(-4);
  if (lunaBuf === "luna") unlockQueen("whispered “luna”");
}
function unlockQueen(how) {
  if (queenUnlocked) return;
  queenUnlocked = true;
  needle.value = QUEEN.f; tune();
  document.getElementById("tuner").scrollIntoView({ behavior: "smooth" });
  mothEruption();
  toast(`👑 THE LUNA QUEEN stirs — you ${how} · tune 93.3 MHz`);
}
function mothEruption(n = 60) {
  const box = $("#erupt"), glyphs = ["🦋", "🦟", "✨", "🌙"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 2 + Math.random() * 3 + "s";
    s.style.fontSize = 14 + Math.random() * 26 + "px";
    box.appendChild(s);
    setTimeout(() => s.remove(), 5200);
  }
}

// ---------- canvas: stars + drifting moths (also react to scroll) ----------
const cv = $("#sky"), ctx = cv.getContext("2d");
let stars = [], moths = [], scrollBoost = 0;
function sizeSky() {
  cv.width = innerWidth; cv.height = innerHeight;
  stars = Array.from({ length: 130 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.6 + 0.3, tw: Math.random() * 6.28 }));
  moths = Array.from({ length: 14 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3, s: 8 + Math.random() * 10, ph: Math.random() * 6.28 }));
}
sizeSky(); addEventListener("resize", sizeSky);
addEventListener("scroll", () => { scrollBoost = Math.min(3, scrollBoost + 0.35); }, { passive: true });
(function sky(t = 0) {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const p = document.documentElement.scrollTop / Math.max(1, document.documentElement.scrollHeight - innerHeight);
  stars.forEach((s) => {
    s.tw += 0.03;
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(s.tw)) * (0.5 + p * 0.5);
    ctx.fillStyle = "#efe3c8";
    ctx.beginPath(); ctx.arc((s.x - document.documentElement.scrollTop * 0.02) % cv.width < 0 ? cv.width + s.x : s.x, s.y, s.r, 0, 6.29); ctx.fill();
  });
  ctx.globalAlpha = 1;
  scrollBoost *= 0.95;
  moths.forEach((m) => {
    m.ph += 0.05 + scrollBoost * 0.05;
    m.x += (m.vx + Math.sin(m.ph) * 0.5) * (1 + scrollBoost);
    m.y += (m.vy + Math.cos(m.ph * 0.7) * 0.4) * (1 + scrollBoost * 0.6);
    if (m.x < -20) m.x = cv.width + 20; if (m.x > cv.width + 20) m.x = -20;
    if (m.y < -20) m.y = cv.height + 20; if (m.y > cv.height + 20) m.y = -20;
    ctx.font = `${m.s}px serif`; ctx.globalAlpha = 0.5;
    ctx.fillText("·", m.x, m.y); // faint drifting specks (cheap, fast)
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(sky);
})();

// ---------- misc ----------
$("#howBtn").addEventListener("click", () => { const h = $("#howText"); h.hidden = !h.hidden; });
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600);
}

// init
renderGuide(); renderJar(); tune();
console.log("MOTH RADIO online — 8 stations + 1 queen. type 'luna'.");
