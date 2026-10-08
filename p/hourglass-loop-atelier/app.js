// Hourglass Loop Atelier — Swiss clockwork remixer. No deps. System fonts only.
const $ = (s) => document.querySelector(s);
const canvas = $("#loop"), ctx = canvas.getContext("2d");
const wrap = $("#canvasWrap"), dot = $("#cursorDot");

const HISTORY = [
  { year: "1582", title: "Gregorian skip — 10 days vanish", pat: [1,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0], f: 660 },
  { year: "1847", title: "Railway time — towns synced to wire", pat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], f: 520 },
  { year: "1884", title: "Greenwich meridian voted zero", pat: [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1], f: 440 },
  { year: "1927", title: "Philo's image dissector — tick of TV", pat: [1,1,0,1,0,1,0,0,1,0,1,1,0,1,0,0], f: 590 },
  { year: "1967", title: "Atomic second — caesium defines time", pat: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1], f: 740 },
  { year: "1972", title: "First leap second holds the hour", pat: [1,0,0,1,1,0,0,1,0,0,1,1,0,0,1,0], f: 494 },
  { year: "1983", title: "Swatch — plastic, one second, everyone", pat: [1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0], f: 415 },
  { year: "2016", title: "Leap smear — Google melts the second", pat: [0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,1], f: 622 },
];

const store = (() => {
  try {
    const raw = localStorage.getItem("hla-v1");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
})();
const S = Object.assign({
  tempo: 1, rings: 4, warp: 0.5, div: 12, trail: 0.22,
  cx: 0.5, cy: 0.5, bpm: 96,
  beats: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  dayOffset: 0, seedOverride: null, playing: false,
}, store || {});
function save() { try { localStorage.setItem("hla-v1", JSON.stringify(S)); } catch {} }

// --- seeded rng ---
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function dayStr(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
function currentSeedStr() { return S.seedOverride || dayStr(S.dayOffset); }
function seedRand() { const h = hashStr(currentSeedStr()); return mulberry32(h); }

// --- controls wiring ---
const sliders = { tempo: $("#s-tempo"), rings: $("#s-rings"), warp: $("#s-warp"), div: $("#s-div"), trail: $("#s-trail"), cx: $("#s-cx"), cy: $("#s-cy"), bpm: $("#s-bpm") };
function syncOutputs() {
  $("#o-tempo").textContent = S.tempo.toFixed(2) + "×";
  $("#o-rings").textContent = S.rings;
  $("#o-warp").textContent = S.warp.toFixed(2);
  $("#o-div").textContent = S.div;
  $("#o-trail").textContent = S.trail.toFixed(2);
  $("#o-cx").textContent = S.cx.toFixed(2);
  $("#o-cy").textContent = S.cy.toFixed(2);
  $("#o-bpm").textContent = S.bpm;
  sliders.tempo.value = Math.round(S.tempo * 100); sliders.rings.value = S.rings;
  sliders.warp.value = Math.round(S.warp * 100); sliders.div.value = S.div;
  sliders.trail.value = Math.round(S.trail * 100);
  sliders.cx.value = Math.round(S.cx * 100); sliders.cy.value = Math.round(S.cy * 100);
  sliders.bpm.value = S.bpm;
  const seed = currentSeedStr();
  $("#seedLine").textContent = seed + " · 0x" + hashStr(seed).toString(16).toUpperCase().padStart(8, "0");
  $("#seedBadge").textContent = "SEED " + seed;
  $("#footSeed").textContent = "seed " + seed;
}
sliders.tempo.addEventListener("input", e => { S.tempo = e.target.value / 100; syncOutputs(); save(); });
sliders.rings.addEventListener("input", e => { S.rings = +e.target.value; syncOutputs(); save(); });
sliders.warp.addEventListener("input", e => { S.warp = e.target.value / 100; syncOutputs(); save(); });
sliders.div.addEventListener("input", e => { S.div = +e.target.value; syncOutputs(); save(); });
sliders.trail.addEventListener("input", e => { S.trail = e.target.value / 100; syncOutputs(); save(); });
sliders.cx.addEventListener("input", e => { S.cx = e.target.value / 100; syncOutputs(); });
sliders.cy.addEventListener("input", e => { S.cy = e.target.value / 100; syncOutputs(); });
sliders.bpm.addEventListener("input", e => { S.bpm = +e.target.value; syncOutputs(); save(); });
["cx", "cy"].forEach(k => sliders[k].addEventListener("change", save));

// cursor: mouse + keyboard
function setCursor(nx, ny) {
  S.cx = Math.min(1, Math.max(0, nx)); S.cy = Math.min(1, Math.max(0, ny));
  sliders.cx.value = Math.round(S.cx * 100); sliders.cy.value = Math.round(S.cy * 100);
  $("#o-cx").textContent = S.cx.toFixed(2); $("#o-cy").textContent = S.cy.toFixed(2);
  positionDot();
}
function positionDot() {
  const r = canvas.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  dot.style.left = (r.left - w.left + 10 + S.cx * r.width) + "px";
  dot.style.top = (r.top - w.top + 10 + S.cy * r.height) + "px";
}
wrap.addEventListener("pointermove", e => {
  const r = canvas.getBoundingClientRect();
  setCursor((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});
wrap.addEventListener("pointerleave", save);
wrap.addEventListener("keydown", e => {
  const step = e.shiftKey ? 0.02 : 0.06; let used = true;
  if (e.key === "ArrowLeft") setCursor(S.cx - step, S.cy);
  else if (e.key === "ArrowRight") setCursor(S.cx + step, S.cy);
  else if (e.key === "ArrowUp") setCursor(S.cx, S.cy - step);
  else if (e.key === "ArrowDown") setCursor(S.cx, S.cy + step);
  else used = false;
  if (used) { e.preventDefault(); save(); }
});
window.addEventListener("resize", positionDot);

// --- history list + beat grid ---
const histEl = $("#historyList");
HISTORY.forEach((h, i) => {
  const li = document.createElement("li");
  const dots = h.pat.map(v => (v ? "●" : "○")).join("");
  li.innerHTML = `<span class="yr tabular">${h.year}</span>
    <span class="tt"><strong>${h.title}</strong><span class="dots" aria-hidden="true">${dots}</span></span>`;
  const b = document.createElement("button");
  b.type = "button"; b.textContent = `Sample [${i + 1}]`;
  b.setAttribute("aria-label", `Sample ${h.year} ${h.title} into beat grid`);
  b.addEventListener("click", () => sampleTick(i));
  li.appendChild(b); histEl.appendChild(li);
});
function sampleTick(i) {
  const p = HISTORY[i].pat;
  for (let k = 0; k < 16; k++) S.beats[k] = (S.beats[k] || p[k]) ? 1 : 0;
  renderBeats(); save(); blip(HISTORY[i].f, 0.12);
  status(`Sampled ${HISTORY[i].year} → beat grid.`);
}
const grid = $("#beatGrid");
function renderBeats() {
  grid.innerHTML = "";
  S.beats.forEach((v, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "beat"; b.dataset.i = i;
    b.setAttribute("aria-pressed", v ? "true" : "false");
    b.setAttribute("aria-label", `Step ${i + 1} ${v ? "on" : "off"}`);
    b.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span>`;
    b.addEventListener("click", () => { S.beats[i] = S.beats[i] ? 0 : 1; renderBeats(); save(); });
    grid.appendChild(b);
  });
}
$("#btnClear").addEventListener("click", () => { S.beats = S.beats.map(() => 0); renderBeats(); save(); });
$("#btnFill").addEventListener("click", () => { S.beats = S.beats.map((_, i) => (i % 4 === 0 ? 1 : 0)); renderBeats(); save(); });

// --- audio ---
let AC = null, timer = null, step = 0;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; }
function blip(freq, dur = 0.06, when = 0) {
  try {
    const a = ac(), t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
function tickLoop() {
  const on = S.beats[step % 16];
  if (on) blip(500 + step * 24, 0.07); else blip(180, 0.02);
  document.querySelectorAll(".beat").forEach((el, i) => el.classList.toggle("playing", i === step % 16));
  pulse = 1;
  step++;
}
function setPlaying(p) {
  S.playing = p;
  $("#btnPlay").setAttribute("aria-pressed", String(p));
  $("#btnPlay").innerHTML = p ? "⏸ Pause beat <span class='muted'>[Space]</span>" : "▶ Play beat <span class='muted'>[Space]</span>";
  if (timer) { clearInterval(timer); timer = null; }
  if (p) { ac(); step = 0; timer = setInterval(tickLoop, 60000 / S.bpm / 2); }
}
$("#btnPlay").addEventListener("click", () => setPlaying(!S.playing));
sliders.bpm.addEventListener("change", () => { if (S.playing) setPlaying(true); });

// --- seed remix ---
$("#btnRemix").addEventListener("click", remix);
$("#btnToday").addEventListener("click", () => { S.dayOffset = 0; S.seedOverride = null; syncOutputs(); save(); status("Seed reset to today."); });
$("#btnPrevDay").addEventListener("click", () => { S.dayOffset--; S.seedOverride = null; syncOutputs(); save(); });
$("#btnNextDay").addEventListener("click", () => { S.dayOffset++; S.seedOverride = null; syncOutputs(); save(); });
function remix() {
  const r = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0");
  S.seedOverride = "REMIX-" + r;
  syncOutputs(); save(); status(`Remixed seed ${S.seedOverride}. Gears re-phased.`);
}

// --- clockwork renderer (pure function of t) ---
let pulse = 0;
function drawFrame(c, W, t) {
  const rnd = seedRand();
  const phases = Array.from({ length: 8 }, () => rnd() * Math.PI * 2);
  const rings = S.rings, div = S.div;
  // bg
  c.fillStyle = "#F4F1EB"; c.fillRect(0, 0, W, W);
  // swiss grid
  c.strokeStyle = "rgba(17,17,17,0.10)"; c.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    c.beginPath(); c.moveTo((W / 6) * i, 0); c.lineTo((W / 6) * i, W); c.stroke();
    c.beginPath(); c.moveTo(0, (W / 6) * i); c.lineTo(W, (W / 6) * i); c.stroke();
  }
  const cx = W / 2, cy = W / 2, R = W * 0.44;
  const wx = (S.cx - 0.5) * 2, wy = (S.cy - 0.5) * 2;
  const warpAmt = S.warp * (0.4 + 0.6 * Math.hypot(wx, wy));
  const speed = t * S.tempo;
  for (let r = 0; r < rings; r++) {
    const rr = R * (1 - r / (rings + 0.6));
    const dir = r % 2 ? -1 : 1;
    const teeth = Math.max(2, Math.round(div * (1 - r * 0.09)));
    const rot = dir * speed * (0.55 + r * 0.28 + wy * 0.5) + phases[r];
    const wob = warpAmt * Math.sin(speed * 1.7 + phases[r]) * rr * 0.16;
    // gear ring
    c.save(); c.translate(cx + wx * 14 * (r + 1) / rings, cy + wy * 14 * (r + 1) / rings);
    c.rotate(rot * 0.35);
    c.strokeStyle = r === 0 ? "#111111" : "#111111";
    c.lineWidth = r === 0 ? Math.max(3, W * 0.012) : Math.max(2, W * 0.007);
    c.beginPath();
    const N = teeth * 2;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const rad = rr + (i % 2 ? W * 0.022 : 0) + wob * Math.sin(a * 3 + rot);
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.stroke();
    // spokes
    c.lineWidth = Math.max(1.5, W * 0.004);
    for (let sIdx = 0; sIdx < teeth; sIdx += 2) {
      const a = (sIdx / teeth) * Math.PI * 2 + rot;
      c.beginPath(); c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); c.stroke();
    }
    // red index hand
    const ha = rot + wx * 1.2;
    c.strokeStyle = "#E2001A"; c.lineWidth = Math.max(3, W * 0.009);
    c.beginPath(); c.moveTo(0, 0);
    c.lineTo(Math.cos(ha) * rr * 0.92, Math.sin(ha) * rr * 0.92); c.stroke();
    c.fillStyle = "#E2001A";
    c.beginPath(); c.arc(Math.cos(ha) * rr * 0.92, Math.sin(ha) * rr * 0.92, W * 0.014, 0, 7); c.fill();
    c.restore();
  }
  // hourglass loop line
  c.save(); c.translate(cx, cy);
  c.strokeStyle = "#111"; c.lineWidth = Math.max(2, W * 0.006);
  c.beginPath();
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    const lem = (R * 0.62 * Math.cos(a)) / (1 + Math.sin(a) * Math.sin(a));
    const ley = (R * 0.62 * Math.cos(a) * Math.sin(a)) / (1 + Math.sin(a) * Math.sin(a));
    const w = 1 + warpAmt * Math.sin(a * 2 + speed * 2 + wx * 3);
    const x = lem * w, y = ley * w * (1 + wy * 0.35);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke(); c.restore();
  // center: beat pulse + cursor crosshair
  pulse = Math.max(0, pulse - 0.06);
  c.fillStyle = "#E2001A";
  c.beginPath(); c.arc(cx + wx * 20, cy + wy * 20, W * 0.02 + pulse * W * 0.03, 0, 7); c.fill();
  c.fillStyle = "#111";
  c.beginPath(); c.arc(cx + wx * 20, cy + wy * 20, W * 0.008, 0, 7); c.fill();
  c.strokeStyle = "rgba(226,0,26,0.85)"; c.lineWidth = 1.5;
  const px = S.cx * W, py = S.cy * W;
  c.beginPath(); c.moveTo(px - 12, py); c.lineTo(px + 12, py); c.stroke();
  c.beginPath(); c.moveTo(px, py - 12); c.lineTo(px, py + 12); c.stroke();
  // footer strip: seed + time (part of the loop card)
  c.fillStyle = "#111"; c.fillRect(0, W - W * 0.09, W, W * 0.09);
  c.fillStyle = "#F4F1EB"; c.font = `700 ${Math.round(W * 0.032)}px Helvetica, Arial, sans-serif`;
  c.textBaseline = "middle";
  c.fillText(currentSeedStr(), W * 0.04, W - W * 0.045);
  const tm = new Date().toTimeString().slice(0, 8);
  c.textAlign = "right"; c.fillText(tm, W * 0.96, W - W * 0.045); c.textAlign = "left";
}

// main loop
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let start = performance.now();
function frame(now) {
  const t = (now - start) / 1000;
  // trail persistence
  ctx.save(); ctx.globalAlpha = 1 - S.trail * 0.55; ctx.fillStyle = "#F4F1EB";
  ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  // draw onto temp then blit for trail blend
  drawFrame(ctx, canvas.width, t);
  const hh = String(new Date().getHours()).padStart(2, "0"), mm = String(new Date().getMinutes()).padStart(2, "0"), ss = String(new Date().getSeconds()).padStart(2, "0");
  $("#clockReadout").textContent = `${hh}:${mm}:${ss}`;
  if (!reduceMotion) requestAnimationFrame(frame);
}
function status(m) { $("#exportStatus").textContent = m; }

// --- GIF export: tiny embedded GIF89a encoder, fixed Swiss palette ---
const PALETTE = [
  [244,241,235],[17,17,17],[226,0,26],[255,255,255],[216,212,203],[138,135,127],
  [165,0,19],[60,60,60],[240,200,200],[30,30,40],[200,30,50],[120,120,120],
  [0,0,0],[250,250,248],[180,20,40],[80,80,90]
];
function nearestIdx(r, g, b) {
  let bi = 0, bd = 1e12;
  for (let i = 0; i < PALETTE.length; i++) {
    const p = PALETTE[i], dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}
function lzwCompress(minSize, data) {
  const clear = 1 << minSize, eoi = clear + 1;
  let codeSize = minSize + 1, next = eoi + 1;
  let dict = new Map(); const out = []; let buf = 0, bits = 0;
  const write = (code, size) => { buf |= code << bits; bits += size; while (bits >= 8) { out.push(buf & 255); buf >>= 8; bits -= 8; } };
  const resetDict = () => { dict = new Map(); for (let i = 0; i < clear; i++) dict.set(String.fromCharCode(i), i); next = eoi + 1; codeSize = minSize + 1; };
  resetDict();
  write(clear, codeSize);
  let cur = String.fromCharCode(data[0]);
  for (let i = 1; i < data.length; i++) {
    const ch = String.fromCharCode(data[i]), nxt = cur + ch;
    if (dict.has(nxt)) cur = nxt;
    else {
      write(dict.get(cur), codeSize);
      if (next < 4096) { dict.set(nxt, next++); if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++; }
      else { write(clear, codeSize); resetDict(); }
      cur = ch;
    }
  }
  write(dict.get(cur), codeSize); write(eoi, codeSize);
  if (bits > 0) out.push(buf & 255);
  return out;
}
function encodeGIF(frames, w, h, delayCs) {
  const bytes = [];
  const pushStr = s => { for (const ch of s) bytes.push(ch.charCodeAt(0)); };
  const push16 = v => bytes.push(v & 255, (v >> 8) & 255);
  pushStr("GIF89a"); push16(w); push16(h);
  bytes.push(0xF4, 0x00, 0x00); // GCT flag: 256 colors (padded), bg 0
  for (let i = 0; i < 256; i++) { const p = PALETTE[i % PALETTE.length]; bytes.push(p[0], p[1], p[2]); }
  // looping
  bytes.push(0x21, 0xFF, 0x0B); pushStr("NETSCAPE2.0"); bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);
  const minSize = 4; // 16 colors
  frames.forEach((idx) => {
    bytes.push(0x21, 0xF9, 0x04, 0x00, delayCs & 255, (delayCs >> 8) & 255, 0x00, 0x00);
    bytes.push(0x2C, 0x00, 0x00, 0x00, 0x00); push16(w); push16(h); bytes.push(0x00);
    bytes.push(minSize);
    const comp = lzwCompress(minSize, idx);
    for (let i = 0; i < comp.length; i += 255) {
      const n = Math.min(255, comp.length - i);
      bytes.push(n); for (let j = 0; j < n; j++) bytes.push(comp[i + j]);
    }
    bytes.push(0x00);
  });
  bytes.push(0x3B);
  return new Uint8Array(bytes);
}
async function exportGIF() {
  status("Rendering 12 frames…");
  $("#btnExport").disabled = true;
  try {
    const W = 240, off = document.createElement("canvas"); off.width = W; off.height = W;
    const octx = off.getContext("2d", { willReadFrequently: true });
    const frames = [], N = 12, t0 = (performance.now() - start) / 1000;
    for (let f = 0; f < N; f++) {
      drawFrame(octx, W, t0 + f * (1 / 6) * S.tempo + f * 0.001);
      const d = octx.getImageData(0, 0, W, W).data;
      const idx = new Array(W * W);
      for (let p = 0; p < W * W; p++) idx[p] = nearestIdx(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
      frames.push(idx);
      status(`Rendering frame ${f + 1}/12…`);
      await new Promise(r => setTimeout(r, 0));
    }
    const gif = encodeGIF(frames, W, W, 8);
    const blob = new Blob([gif.buffer], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    const seed = currentSeedStr().replace(/[^A-Za-z0-9-]+/g, "");
    const a = $("#gifDownload");
    a.href = url; a.download = `hourglass-${seed}.gif`; a.hidden = false;
    a.textContent = `Download GIF (${(blob.size / 1024).toFixed(1)} KB)`;
    const img = $("#gifPreview"); img.src = url; img.hidden = false;
    $("#btnPng").hidden = false;
    $("#btnPng").onclick = () => {
      const big = document.createElement("canvas"); big.width = 640; big.height = 640;
      drawFrame(big.getContext("2d"), 640, (performance.now() - start) / 1000);
      const u = big.toDataURL("image/png");
      const l = document.createElement("a"); l.href = u; l.download = `hourglass-${seed}.png`; l.click();
    };
    status(`GIF card done — seed ${currentSeedStr()} · click Download.`);
  } catch (err) { console.error(err); status("Export failed: " + err.message); }
  $("#btnExport").disabled = false;
}
$("#btnExport").addEventListener("click", exportGIF);

// global keys (skip when typing in inputs except range/checkbox semantics)
document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" && e.target.type === "text") return;
  if (e.key === " " && tag !== "button" && tag !== "input") { e.preventDefault(); setPlaying(!S.playing); }
  else if (e.key === "r" || e.key === "R") { if (tag !== "input") remix(); }
  else if (e.key === "e" || e.key === "E") { if (tag !== "input") exportGIF(); }
  else if (/^[1-8]$/.test(e.key) && tag !== "input") sampleTick(+e.key - 1);
});

// init
syncOutputs(); renderBeats(); positionDot();
if (S.playing) setPlaying(false);
requestAnimationFrame(frame);
setTimeout(positionDot, 50);
console.log("hourglass-loop-atelier ready", currentSeedStr());
