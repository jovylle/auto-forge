// Granular Grove Synth — glassmorphism granular cloud toy.
// Features: drag-drop sampling + auto-slice | XY-pad grain cloud | tap-tempo echo | one-click loop export
// Constraint: fully playable with keyboard only. No deps. Works from file://.

const $ = (id) => document.getElementById(id);
const els = {
  power: $("btn-power"), demo: $("btn-demo"), file: $("btn-file"), input: $("file-input"),
  drop: $("dropzone"), meta: $("sample-meta"), wave: $("wave"), slices: $("slices"),
  pad: $("xypad"), grove: $("grove"), cursor: $("xy-cursor"), readout: $("xy-readout"),
  density: $("s-density"), pitch: $("s-pitch"), spray: $("s-spray"), cloud: $("s-cloud"),
  vDensity: $("v-density"), vPitch: $("v-pitch"), vSpray: $("v-spray"), vCloud: $("v-cloud"),
  tap: $("btn-tap"), tapReset: $("btn-tap-reset"), bpm: $("bpm-val"), echoVal: $("echo-val"),
  fb: $("s-fb"), echo: $("s-echo"), div: $("sel-div"), trail: $("trail"),
  vFb: $("v-fb"), vEcho: $("v-echo"), export: $("btn-export"), exportStatus: $("export-status"),
};

const S = {
  ctx: null, buffer: null, slices: [], sliceIdx: 0,
  playing: false, timer: null, nextT: 0,
  x: 0.5, y: 0.45,            // x = position in buffer, y = grain-size param (0 small … 1 large)
  density: 14, pitch: 0, sprayMs: 40, cloudMix: 0.7,
  bpm: 96, division: 0.75, fb: 0.45, echoMix: 0.3, echoMuted: false,
  taps: [], grains: [], seedBurst: 0,
  nodes: {},
};
const LS_KEY = "granular-grove-v1";
try {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  for (const k of ["density", "pitch", "sprayMs", "cloudMix", "bpm", "fb", "echoMix", "x", "y", "division"])
    if (typeof saved[k] === "number") S[k] = saved[k];
} catch { /* fresh grove */ }
function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      density: S.density, pitch: S.pitch, sprayMs: S.sprayMs, cloudMix: S.cloudMix,
      bpm: S.bpm, fb: S.fb, echoMix: S.echoMix, x: S.x, y: S.y, division: S.division,
    }));
  } catch { /* private mode */ }
}

// ---------- audio graph ----------
function ensureCtx() {
  if (S.ctx) { if (S.ctx.state === "suspended") void S.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  S.ctx = new AC();
  const c = S.ctx;
  const master = c.createGain(); master.gain.value = 0.9;
  const comp = c.createDynamicsCompressor();
  master.connect(comp); comp.connect(c.destination);
  const grainBus = c.createGain(); grainBus.gain.value = S.cloudMix;
  const dryGain = c.createGain(); dryGain.gain.value = (1 - S.cloudMix) * 0.5;
  grainBus.connect(master); dryGain.connect(master);
  // echo trail: master -> send -> delay -> fb loop + wet -> master
  const send = c.createGain(); send.gain.value = 1;
  const delay = c.createDelay(2.0); delay.delayTime.value = echoSeconds();
  const fbG = c.createGain(); fbG.gain.value = S.fb;
  const wet = c.createGain(); wet.gain.value = S.echoMuted ? 0 : S.echoMix;
  master.connect(send); send.connect(delay); delay.connect(fbG); fbG.connect(delay);
  delay.connect(wet); wet.connect(master);
  const mediaDest = c.createMediaStreamDestination();
  master.connect(mediaDest);
  S.nodes = { master, grainBus, dryGain, delay, fbG, wet, mediaDest, drySrc: null };
  applyEcho();
}
function echoSeconds() { return (60 / S.bpm) * S.division; }
function applyEcho() {
  if (!S.ctx) return;
  S.nodes.delay.delayTime.setTargetAtTime(echoSeconds(), S.ctx.currentTime, 0.03);
  S.nodes.fbG.gain.setTargetAtTime(S.fb, S.ctx.currentTime, 0.03);
  S.nodes.wet.gain.setTargetAtTime(S.echoMuted ? 0 : S.echoMix, S.ctx.currentTime, 0.03);
  els.echoVal.textContent = Math.round(echoSeconds() * 1000) + "ms";
  els.bpm.textContent = Math.round(S.bpm);
}

// ---------- granular scheduler ----------
function grainSeconds() { return 0.03 + S.y * 0.37; } // 30ms … 400ms
function spawnGrain(when) {
  const c = S.ctx, buf = S.buffer;
  if (!buf) return;
  const dur = S.buffer.duration;
  const center = S.x * dur;
  const spray = (S.sprayMs / 1000) * (Math.random() * 2 - 1);
  let off = center + spray;
  off = Math.min(Math.max(off, 0), Math.max(dur - 0.05, 0));
  const g = Math.min(grainSeconds() * (0.8 + Math.random() * 0.4), Math.max(dur - off, 0.03));
  const src = c.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = Math.pow(2, S.pitch / 12) * (0.97 + Math.random() * 0.06);
  const env = c.createGain();
  const peak = 0.5 / Math.sqrt(Math.max(S.density, 4) / 8);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(Math.max(peak, 0.02), when + g * 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, when + g);
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  src.connect(env);
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; env.connect(pan); pan.connect(S.nodes.grainBus); }
  else env.connect(S.nodes.grainBus);
  try { src.start(when, off, g + 0.02); } catch { return; }
  src.stop(when + g + 0.05);
  S.grains.push({ t: performance.now(), x: Math.random(), y: Math.random(), big: g > 0.2 });
  if (S.grains.length > 220) S.grains.splice(0, S.grains.length - 220);
}
function scheduler() {
  if (!S.playing) return;
  const ahead = 0.14;
  while (S.nextT < S.ctx.currentTime + ahead) {
    spawnGrain(S.nextT);
    if (S.seedBurst > 0) { spawnGrain(S.nextT + 0.005); S.seedBurst--; }
    S.nextT += 1 / S.density;
  }
}
function startDry() {
  stopDry();
  if (!S.buffer) return;
  const c = S.ctx;
  const src = c.createBufferSource(); src.buffer = S.buffer; src.loop = true;
  src.playbackRate.value = 1;
  src.connect(S.nodes.dryGain);
  src.start();
  S.nodes.drySrc = src;
}
function stopDry() {
  if (S.nodes.drySrc) { try { S.nodes.drySrc.stop(); } catch { /* already stopped */ } S.nodes.drySrc = null; }
}
function setPlaying(on) {
  ensureCtx();
  if (on && !S.buffer) growDemo("Press play — we grew you a demo grove. Drop any audio file to replace it.");
  S.playing = on;
  els.power.setAttribute("aria-pressed", String(on));
  els.power.innerHTML = on ? "⏸ Rest the grove <kbd>Space</kbd>" : "▶ Start grove <kbd>Space</kbd>";
  if (on) { S.nextT = S.ctx.currentTime + 0.06; startDry(); S.timer = setInterval(scheduler, 25); }
  else { clearInterval(S.timer); S.timer = null; stopDry(); }
}

// ---------- sampling + auto-slice ----------
function setBuffer(buf, name) {
  S.buffer = buf;
  S.slices = autoSlice(buf);
  S.sliceIdx = 0;
  S.x = S.slices[0] ? S.slices[0].start / buf.duration : 0.25;
  drawWave(); renderSlices(); updateCursor(); updateReadout();
  const mins = (d) => d.toFixed(1) + "s";
  els.meta.textContent = `${name} — ${mins(buf.duration)} · ${buf.sampleRate}Hz · auto-sliced into ${S.slices.length}`;
  if (S.playing) startDry();
}
async function decodeFile(file) {
  ensureCtx();
  const ab = await file.arrayBuffer();
  try {
    const buf = await S.ctx.decodeAudioData(ab);
    setBuffer(buf, "🌊 " + file.name);
  } catch { els.meta.textContent = "⚠️ Could not decode that file — try wav, mp3 or ogg."; }
}
// Onset-ish auto-slice: biggest positive energy jumps across 512 windows, min gap enforced.
function autoSlice(buf, want = 8) {
  const ch = buf.getChannelData(0), W = 512, e = new Float32Array(W);
  const step = Math.floor(ch.length / W);
  for (let w = 0; w < W; w++) {
    let s = 0; const o = w * step;
    for (let i = o; i < o + step; i += 7) { const v = ch[i] || 0; s += v * v; }
    e[w] = s;
  }
  const jumps = [];
  for (let w = 2; w < W; w++) {
    const d = e[w] - e[w - 1], base = e[w - 1] + 1e-6;
    if (d > 0 && d / base > 0.55) jumps.push({ w, s: d / base });
  }
  jumps.sort((a, b) => b.s - a.s);
  const picked = [];
  for (const j of jumps) {
    if (picked.every((p) => Math.abs(p - j.w) > W / (want * 1.6))) picked.push(j.w);
    if (picked.length === want - 1) break;
  }
  picked.sort((a, b) => a - b);
  const bounds = [0, ...picked.map((w) => (w / W) * buf.duration), buf.duration];
  return bounds.slice(0, -1).map((t, i) => ({ i, start: t, end: bounds[i + 1] }));
}
function drawWave() {
  const cv = els.wave, ctx = cv.getContext("2d");
  const W = cv.width = cv.clientWidth * 2 || 640, H = cv.height = 240;
  ctx.clearRect(0, 0, W, H);
  if (!S.buffer) return;
  const ch = S.buffer.getChannelData(0), dur = S.buffer.duration;
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#3ddc84"); grad.addColorStop(0.55, "#7ef0c1"); grad.addColorStop(1, "#ffd66e");
  ctx.fillStyle = grad;
  const mid = H / 2;
  for (let x = 0; x < W; x++) {
    const o = Math.floor((x / W) * ch.length);
    let pk = 0;
    for (let i = 0; i < 40; i++) pk = Math.max(pk, Math.abs(ch[o + i] || 0));
    const h = Math.max(pk * mid, 1);
    ctx.fillRect(x, mid - h, 1, h * 2);
  }
  // slice markers + playhead
  S.slices.forEach((s, i) => {
    const x = (s.start / dur) * W;
    ctx.fillStyle = i === S.sliceIdx ? "#ffd66e" : "rgba(255,255,255,.45)";
    ctx.fillRect(x, 0, 2, H);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x + 2, 4, 18, 16);
    ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.fillText(String(i + 1), x + 6, 16);
  });
  const px = S.x * W;
  ctx.fillStyle = "#ff9ec6"; ctx.fillRect(px - 1, 0, 3, H);
}
function renderSlices() {
  els.slices.innerHTML = "";
  S.slices.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slice"; b.setAttribute("role", "option");
    b.setAttribute("aria-selected", String(i === S.sliceIdx));
    b.setAttribute("aria-label", `Slice ${i + 1}, ${s.start.toFixed(2)} to ${s.end.toFixed(2)} seconds. Press to seed cloud here.`);
    b.innerHTML = `◍ ${i + 1}<small>${s.start.toFixed(1)}s</small>`;
    b.addEventListener("click", () => seedSlice(i));
    els.slices.appendChild(b);
  });
}
function seedSlice(i) {
  if (!S.buffer || !S.slices.length) { growDemo(); return; }
  i = Math.min(Math.max(i, 0), S.slices.length - 1);
  const s = S.slices[i];
  S.x = (s.start + 0.15 * (s.end - s.start)) / S.buffer.duration;
  S.seedBurst = 6; // immediate flurry so the seed is audible
  ensureCtx();
  if (S.ctx.state === "suspended") void S.ctx.resume();
  if (!S.playing) setPlaying(true);
  else { const t = S.ctx.currentTime + 0.01; for (let k = 0; k < 6; k++) spawnGrain(t + k * 0.012); }
  renderSlices(); updateCursor(); updateReadout(); drawWave(); persist();
}

// Procedural "field recording": dawn-chorus chirps + drone + rustle + plucks. Works offline from file://.
function growDemo(note) {
  ensureCtx();
  const sr = S.ctx.sampleRate, dur = 8, buf = S.ctx.createBuffer(2, sr * dur, sr);
  const rnd = (() => { let s = 1234567; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // low mossy drone (A1+E2+A2)
      let v = 0.16 * Math.sin(2 * Math.PI * 55 * t) + 0.1 * Math.sin(2 * Math.PI * 82.4 * t + 1)
        + 0.07 * Math.sin(2 * Math.PI * 110 * t + 2);
      // wind: slow filtered noise
      v += 0.05 * (rnd() * 2 - 1) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.13 * t + c));
      // dawn chirps
      const ch = Math.sin(2 * Math.PI * (2400 + 900 * Math.sin(2 * Math.PI * 0.7 * t)) * t);
      const gate = Math.max(0, Math.sin(2 * Math.PI * 1.7 * t + c * 2)) ** 6;
      v += 0.1 * ch * gate;
      // wooden plucks on pentatonic
      const scale = [220, 261.6, 293.7, 329.6, 392, 440];
      const beat = 0.75, ph = t % (beat * scale.length);
      const idx = Math.floor(ph / beat), lt = ph - idx * beat;
      v += 0.22 * Math.sin(2 * Math.PI * scale[idx] * t) * Math.exp(-lt * 9);
      d[i] = Math.tanh(v * 1.4) * 0.8;
    }
  }
  setBuffer(buf, note ? "🌱 demo grove (synthesized)" : "🌱 demo grove (synthesized)");
  if (note) els.meta.textContent = note;
}

// ---------- XY pad ----------
function padSetFromEvent(ev) {
  const r = els.pad.getBoundingClientRect();
  const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
  S.x = Math.min(Math.max(px, 0), 1);
  S.y = Math.min(Math.max(py, 0), 1);
  updateCursor(); updateReadout(); drawWave(); persist();
}
function updateCursor() {
  els.cursor.style.left = S.x * 100 + "%";
  els.cursor.style.top = S.y * 100 + "%";
}
function updateReadout() {
  els.readout.textContent = `position ${Math.round(S.x * 100)}% · grain ${Math.round(grainSeconds() * 1000)}ms · slice ${S.sliceIdx + 1}/${Math.max(S.slices.length, 1)}`;
}
let padDown = false;
els.pad.addEventListener("pointerdown", (e) => { padDown = true; els.pad.setPointerCapture(e.pointerId); ensureCtx(); padSetFromEvent(e); });
els.pad.addEventListener("pointermove", (e) => { if (padDown) padSetFromEvent(e); });
els.pad.addEventListener("pointerup", () => (padDown = false));
els.pad.addEventListener("keydown", (e) => {
  const big = e.shiftKey ? 0.1 : 0.02;
  let used = true;
  if (e.key === "ArrowLeft") S.x = Math.max(S.x - big, 0);
  else if (e.key === "ArrowRight") S.x = Math.min(S.x + big, 1);
  else if (e.key === "ArrowUp") S.y = Math.max(S.y - big, 0);
  else if (e.key === "ArrowDown") S.y = Math.min(S.y + big, 1);
  else used = false;
  if (used) { e.preventDefault(); updateCursor(); updateReadout(); drawWave(); persist(); }
});

// ---------- sliders ----------
function bindSlider(input, fn) { input.addEventListener("input", () => { ensureCtx(); fn(parseFloat(input.value)); persist(); }); }
bindSlider(els.density, (v) => { S.density = v; els.vDensity.textContent = v + "/s"; });
bindSlider(els.pitch, (v) => { S.pitch = v; els.vPitch.textContent = (v > 0 ? "+" : "") + v + " st"; });
bindSlider(els.spray, (v) => { S.sprayMs = v; els.vSpray.textContent = v + "ms"; });
bindSlider(els.cloud, (v) => {
  S.cloudMix = v / 100; els.vCloud.textContent = v + "%";
  if (S.ctx) {
    S.nodes.grainBus.gain.setTargetAtTime(S.cloudMix, S.ctx.currentTime, 0.03);
    S.nodes.dryGain.gain.setTargetAtTime((1 - S.cloudMix) * 0.5, S.ctx.currentTime, 0.03);
  }
});
bindSlider(els.fb, (v) => { S.fb = v / 100; els.vFb.textContent = v + "%"; applyEcho(); });
bindSlider(els.echo, (v) => { S.echoMix = v / 100; els.vEcho.textContent = v + "%"; applyEcho(); });
els.div.addEventListener("change", () => { S.division = parseFloat(els.div.value); applyEcho(); persist(); });

// ---------- tap tempo ----------
function tap() {
  ensureCtx();
  const now = performance.now();
  if (S.taps.length && now - S.taps[S.taps.length - 1] > 2200) S.taps = [];
  S.taps.push(now); S.taps = S.taps.slice(-6);
  if (S.taps.length >= 2) {
    const iv = [];
    for (let i = 1; i < S.taps.length; i++) iv.push(S.taps[i] - S.taps[i - 1]);
    iv.sort((a, b) => a - b);
    const med = iv[Math.floor(iv.length / 2)];
    S.bpm = Math.min(Math.max(60000 / med, 40), 240);
    applyEcho(); persist();
  }
  pulseTrail();
}
function pulseTrail() {
  const bars = els.trail.querySelectorAll("i");
  bars.forEach((b, i) => {
    b.classList.add("lit");
    b.style.height = 30 + ((i * 37) % 70) + "%";
    setTimeout(() => b.classList.remove("lit"), 220 + i * 60);
  });
}
setInterval(() => { if (S.playing && !document.hidden) pulseTrail(); }, 4000);

// ---------- export ----------
let exporting = false;
els.export.addEventListener("click", async () => {
  if (exporting) return;
  ensureCtx();
  if (S.ctx.state === "suspended") await S.ctx.resume();
  if (!S.playing) setPlaying(true);
  const MR = window.MediaRecorder;
  if (!MR) { els.exportStatus.textContent = "⚠️ MediaRecorder not supported in this browser."; return; }
  let mime = "audio/webm";
  if (!MR.isTypeSupported(mime)) mime = "";
  let rec;
  try { rec = new MR(S.nodes.mediaDest.stream, mime ? { mimeType: mime } : undefined); }
  catch { els.exportStatus.textContent = "⚠️ Could not start the recorder."; return; }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  exporting = true;
  const secs = 8;
  for (let s = secs; s > 0; s--) {
    els.exportStatus.textContent = `● recording loop… ${s}s — keep conducting!`;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const done = new Promise((r) => (rec.onstop = r));
  rec.stop();
  await done;
  exporting = false;
  const blob = new Blob(chunks, { type: mime || "audio/webm" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "granular-grove-loop.webm";
  document.body.appendChild(a); a.click(); a.remove();
  els.exportStatus.textContent = `✔ loop bottled (${(blob.size / 1024).toFixed(0)} KB) — check your downloads.`;
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});

// ---------- file input / dropzone ----------
els.file.addEventListener("click", (e) => { e.stopPropagation(); els.input.click(); });
els.drop.addEventListener("click", () => els.input.click());
els.drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.input.click(); }
});
els.input.addEventListener("change", () => { if (els.input.files[0]) void decodeFile(els.input.files[0]); });
["dragenter", "dragover"].forEach((ev) => els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove("over"); }));
els.drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) void decodeFile(f);
});

// ---------- global keyboard (keyboard-only constraint) ----------
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "select" || tag === "textarea";
  if (e.key >= "1" && e.key <= "8" && !typing) { seedSlice(parseInt(e.key, 10) - 1 < S.slices.length ? parseInt(e.key, 10) - 1 : S.slices.length - 1); return; }
  if (e.code === "Space" && !typing) { e.preventDefault(); setPlaying(!S.playing); return; }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === "d") growDemo();
  else if (k === "t") tap();
  else if (k === "e") els.export.click();
  else if (k === "m") {
    S.echoMuted = !S.echoMuted; applyEcho();
    els.exportStatus.textContent = S.echoMuted ? "echo muted (M to unmute)" : "echo live";
  }
});
els.tap.addEventListener("click", tap);
els.tapReset.addEventListener("click", () => { S.taps = []; S.bpm = 96; applyEcho(); persist(); });
els.power.addEventListener("click", () => setPlaying(!S.playing));
els.demo.addEventListener("click", () => growDemo());

// ---------- grove canvas (firefly grains) ----------
function fitGrove() {
  const r = els.pad.getBoundingClientRect();
  els.grove.width = Math.max(r.width, 50); els.grove.height = Math.max(r.height, 50);
}
window.addEventListener("resize", () => { fitGrove(); drawWave(); });
const motes = [];
function paint() {
  const cv = els.grove, ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const now = performance.now();
  while (S.grains.length) {
    const g = S.grains.shift();
    motes.push({ x: S.x * W + (Math.random() - 0.5) * 60, y: S.y * H + (Math.random() - 0.5) * 40, vy: -0.25 - Math.random() * 0.5, life: 1, big: g.big });
  }
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i];
    m.y += m.vy; m.life -= 0.012;
    if (m.life <= 0) { motes.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.big ? 4 : 2.2, 0, 7);
    ctx.fillStyle = m.big ? `rgba(255,214,110,${m.life})` : `rgba(126,240,193,${m.life * 0.9})`;
    ctx.shadowBlur = 10; ctx.shadowColor = "#7ef0c1";
    ctx.fill(); ctx.shadowBlur = 0;
  }
  // seed cursor glow
  const cx = S.x * W, cy = S.y * H;
  const g2 = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60);
  g2.addColorStop(0, "rgba(255,214,110,.35)"); g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2; ctx.fillRect(cx - 60, cy - 60, 120, 120);
  void now;
  requestAnimationFrame(paint);
}

// ---------- init ----------
function syncUIFromState() {
  els.density.value = S.density; els.vDensity.textContent = S.density + "/s";
  els.pitch.value = S.pitch; els.vPitch.textContent = (S.pitch > 0 ? "+" : "") + S.pitch + " st";
  els.spray.value = S.sprayMs; els.vSpray.textContent = S.sprayMs + "ms";
  els.cloud.value = Math.round(S.cloudMix * 100); els.vCloud.textContent = Math.round(S.cloudMix * 100) + "%";
  els.fb.value = Math.round(S.fb * 100); els.vFb.textContent = Math.round(S.fb * 100) + "%";
  els.echo.value = Math.round(S.echoMix * 100); els.vEcho.textContent = Math.round(S.echoMix * 100) + "%";
  els.div.value = String(S.division);
  els.bpm.textContent = Math.round(S.bpm);
  els.echoVal.textContent = Math.round(echoSeconds() * 1000) + "ms";
}
syncUIFromState();
updateCursor(); updateReadout(); fitGrove(); requestAnimationFrame(paint);
setTimeout(fitGrove, 60);
console.log("granular grove ready — press D for demo, Space to play");
