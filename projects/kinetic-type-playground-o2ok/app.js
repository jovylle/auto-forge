// KINETIC TYPE PLAYGROUND — canvas letter-physics + GIF/PNG export, no deps.
const $ = (id) => document.getElementById(id);
const canvas = $("stage"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const PALETTES = {
  neon:   ["#ff2bd6", "#00f0ff", "#c6ff00", "#7b2bff", "#ffffff"],
  ghost:  ["#00f0ff", "#7df9ff", "#b8c7ff", "#ffffff", "#ff2bd6"],
  sunset: ["#ff3355", "#ff8a00", "#ffeb00", "#ff2bd6", "#ffffff"],
  matrix: ["#c6ff00", "#00ff66", "#00f0ff", "#eaffea", "#7bff9e"],
};
const PRESETS = ["NEON//TOKYO", "DANCE!", "GRAVITY", "KYBER//PUNK", "BOUNCE", "SYNTHWAVE", "GLITCH ME", "ødyssey_2077"];

const S = {
  text: "NEON//TOKYO", mode: "bounce", pal: "neon",
  weight: 800, size: 120, spacing: 8,
  gravity: 0.55, bounce: 0.82, chaos: 0.5,
  glow: true, trails: true, spin: true, playing: true,
};

// restore prefs
try {
  const saved = JSON.parse(localStorage.getItem("ktp") || "{}");
  Object.assign(S, saved.prefs || {});
  if (saved.text) S.text = saved.text;
} catch { /* fresh */ }

let letters = [];
let t = 0, frames = 0, lastFps = performance.now();

function fontOf(px, weight) {
  return `${weight} ${px}px Orbitron, "Arial Black", sans-serif`;
}

// Measure + spawn letters centered, with staggered drop-in
function spawn(text, slam = false) {
  S.text = (text || " ").slice(0, 42) || " ";
  ctx.font = fontOf(S.size, S.weight);
  const widths = [...S.text].map((ch) => (ch === " " ? S.size * 0.42 : ctx.measureText(ch).width));
  const total = widths.reduce((a, b) => a + b, 0) + S.spacing * (S.text.length - 1);
  let x = (W - total) / 2;
  const baseY = H * 0.62;
  const cols = PALETTES[S.pal];
  letters = [...S.text].map((ch, i) => {
    const cx = x + widths[i] / 2;
    x += widths[i] + S.spacing;
    return {
      ch, i,
      x: cx, y: slam ? -40 - i * 46 : baseY - 160 - Math.random() * 260,
      vx: (Math.random() - 0.5) * (2 + S.chaos * 7),
      vy: slam ? 2 + Math.random() * 4 : Math.random() * 2,
      rot: (Math.random() - 0.5) * 0.9,
      vr: (Math.random() - 0.5) * 0.12,
      w: widths[i],
      color: ch === " " ? "transparent" : cols[i % cols.length],
      scale: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      glitchAt: 0,
    };
  });
}

function floorY(l) { return H * 0.86 - S.size * 0.08; }

function step() {
  t += 1 / 60;
  const g = S.gravity, ch = S.chaos;
  for (const l of letters) {
    if (l.ch === " ") continue;
    l.phase += 0.03 + ch * 0.08;
    switch (S.mode) {
      case "bounce":
        l.vy += g;
        l.x += l.vx; l.y += l.vy;
        l.rot += l.vr * (S.spin ? 1 : 0.15);
        if (l.y > floorY(l)) {
          l.y = floorY(l);
          l.vy *= -S.bounce;
          l.vx *= 0.985;
          if (Math.abs(l.vy) < 1.2) l.vy = -(2 + Math.random() * 4 * ch + 1.5);
        }
        if (l.x < 20 || l.x > W - 20) { l.vx *= -0.9; l.x = Math.max(20, Math.min(W - 20, l.x)); }
        l.scale += (1 - l.scale) * 0.06;
        break;
      case "wave":
        l.baseY = l.baseY ?? H * 0.55;
        l.x += 1.1 + ch * 2;
        if (l.x > W + 40) l.x = -40;
        l.y = l.baseY + Math.sin(t * 3 + l.i * 0.55) * (26 + ch * 60);
        l.rot = Math.sin(t * 2 + l.i) * 0.35 * (S.spin ? 1 : 0.2);
        l.scale = 0.85 + Math.sin(t * 4 + l.i * 0.9) * 0.22 * (0.4 + ch);
        break;
      case "orbit": {
        const cx = W / 2, cy = H * 0.48;
        const r = 90 + (l.i % 4) * 34 + ch * 40;
        const a = t * (0.7 + ch * 1.6) + l.i * (Math.PI * 2 / Math.max(letters.length, 1));
        l.x = cx + Math.cos(a) * r * 1.7;
        l.y = cy + Math.sin(a) * r * 0.62;
        l.rot = a * 0.7;
        l.scale += ((0.8 + ch * 0.5) - l.scale) * 0.05;
        break;
      }
      case "glitch":
        l.vy += g * 0.5;
        l.x += l.vx * 0.6; l.y += l.vy;
        if (l.y > floorY(l)) { l.y = floorY(l); l.vy *= -S.bounce; }
        if (Math.random() < 0.02 + ch * 0.08) {
          l.glitchAt = t;
          l.gx = (Math.random() - 0.5) * 46;
          l.gy = (Math.random() - 0.5) * 26;
        }
        l.rot += l.vr * 0.3;
        l.scale += (1 - l.scale) * 0.06;
        break;
      case "rain":
        l.vy += g * 1.4;
        l.y += l.vy; l.x += l.vx * 0.3;
        l.rot += l.vr;
        if (l.y > H + 60) {
          l.y = -60 - Math.random() * 120;
          l.x = Math.random() * W;
          l.vy = 1 + Math.random() * 3;
        }
        l.scale += (1 - l.scale) * 0.05;
        break;
    }
  }
}

function draw() {
  if (S.trails) {
    ctx.fillStyle = "rgba(5,1,13,0.38)";
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "#05010d";
    ctx.fillRect(0, 0, W, H);
  }
  // horizon line
  ctx.save();
  ctx.strokeStyle = "rgba(0,240,255,0.28)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(0, floorY({}) + S.size * 0.14); ctx.lineTo(W, floorY({}) + S.size * 0.14); ctx.stroke();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const l of letters) {
    if (l.ch === " ") continue;
    const glitching = S.mode === "glitch" && t - l.glitchAt < 0.14;
    const dx = glitching ? (l.gx || 0) : 0;
    const dy = glitching ? (l.gy || 0) : Math.sin(l.phase) * S.chaos * 6;
    ctx.save();
    ctx.translate(l.x + dx, l.y + dy);
    ctx.rotate(l.rot);
    ctx.scale(l.scale, l.scale);
    ctx.font = fontOf(S.size, S.weight);
    if (S.glow) {
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 26;
    }
    if (glitching) { // rgb-split ghost copies
      ctx.globalAlpha = 0.75; ctx.fillStyle = "#00f0ff";
      ctx.fillText(l.ch, -4, 0);
      ctx.fillStyle = "#ff2bd6";
      ctx.fillText(l.ch, 4, 0);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = l.color;
    ctx.fillText(l.ch, 0, 0);
    if (S.glow) { ctx.shadowBlur = 0; ctx.globalAlpha = 0.9; ctx.fillText(l.ch, 0, 0); }
    ctx.restore();
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!S.playing) return;
  step();
  draw();
  frames++;
  if (now - lastFps > 500) {
    $("fps").textContent = `${Math.round((frames * 1000) / (now - lastFps))} fps`;
    frames = 0; lastFps = now;
  }
}

// ---------- interaction: drag to fling ----------
let drag = null;
function pos(e) {
  const r = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return { x: ((p.clientX - r.left) / r.width) * W, y: ((p.clientY - r.top) / r.height) * H };
}
canvas.addEventListener("pointerdown", (e) => {
  const p = pos(e);
  let best = null, bd = 70;
  for (const l of letters) {
    const d = Math.hypot(l.x - p.x, l.y - p.y);
    if (d < bd) { bd = d; best = l; }
  }
  if (best) { drag = { l: best, px: p.x, py: p.y }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = pos(e);
  drag.l.vx = (p.x - drag.px) * 0.6;
  drag.l.vy = (p.y - drag.py) * 0.6;
  drag.l.x = p.x; drag.l.y = p.y;
  drag.px = p.x; drag.py = p.y;
});
canvas.addEventListener("pointerup", () => (drag = null));

// ---------- controls ----------
const LABEL = { weight: "vWeight", size: "vSize", spacing: "vSpace", gravity: "vGrav", bounce: "vBounce", chaos: "vChaos" };
function bindCtl(id, key, fmt, after) {
  const el = $(id);
  el.value = S[key];
  $(LABEL[key]).textContent = fmt(S[key]);
  el.addEventListener("input", () => {
    S[key] = parseFloat(el.value);
    $(LABEL[key]).textContent = fmt(S[key]);
    if (after) after();
    persist();
  });
}
const f0 = (v) => `${Math.round(v)}`;
const f2 = (v) => `${(+v).toFixed(2)}`;
bindCtl("weight", "weight", f0, () => spawn($("text").value));
bindCtl("size", "size", f0, () => spawn($("text").value));
bindCtl("spacing", "spacing", f0, () => spawn($("text").value));
bindCtl("gravity", "gravity", f2);
bindCtl("bounce", "bounce", f2);
bindCtl("chaos", "chaos", f2);

$("text").value = S.text;
$("text").addEventListener("input", (e) => { spawn(e.target.value); persist(); });
$("text").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); spawn(e.target.value, true); persist(); }
});
$("btnDrop").addEventListener("click", () => spawn($("text").value, true));
$("btnShuffle").addEventListener("click", () => {
  const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  $("text").value = p; spawn(p, true); persist();
});
$("btnPlay").addEventListener("click", () => {
  S.playing = !S.playing;
  $("btnPlay").textContent = S.playing ? "⏸ PAUSE" : "▶ PLAY";
});

document.querySelectorAll("#modes .chip").forEach((b) => {
  if (b.dataset.mode === S.mode) setMode(b.dataset.mode);
  b.addEventListener("click", () => setMode(b.dataset.mode));
});
function setMode(m) {
  S.mode = m;
  document.querySelectorAll("#modes .chip").forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on);
  });
  letters.forEach((l) => { l.baseY = undefined; });
  persist();
}
document.querySelectorAll("#palettes .chip").forEach((b) => {
  b.classList.toggle("on", b.dataset.pal === S.pal);
  b.addEventListener("click", () => {
    S.pal = b.dataset.pal;
    document.querySelectorAll("#palettes .chip").forEach((x) => x.classList.toggle("on", x === b));
    spawn($("text").value); persist();
  });
});
for (const [id, key] of [["glow", "glow"], ["trails", "trails"], ["spin", "spin"]]) {
  $(id).checked = S[key];
  $(id).addEventListener("change", (e) => { S[key] = e.target.checked; persist(); });
}
const presetBar = $("presets");
PRESETS.forEach((p) => {
  const b = document.createElement("button");
  b.textContent = p;
  b.addEventListener("click", () => { $("text").value = p; spawn(p, true); persist(); });
  presetBar.appendChild(b);
});

function persist() {
  try { localStorage.setItem("ktp", JSON.stringify({ text: S.text, prefs: S })); } catch { /* private mode */ }
}

// ---------- export PNG ----------
$("btnPng").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = `kinetic-${Date.now()}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
  status("◢ PNG captured — check your downloads.");
});

// ---------- export GIF (self-contained 3-3-2 encoder) ----------
function status(msg) { $("gifStatus").textContent = msg; }

function captureFrame(gw, gh) {
  const c = document.createElement("canvas");
  c.width = gw; c.height = gh;
  c.getContext("2d").drawImage(canvas, 0, 0, gw, gh);
  const d = c.getContext("2d").getImageData(0, 0, gw, gh).data;
  const idx = new Uint8Array(gw * gh);
  for (let i = 0; i < idx.length; i++) {
    const r = d[i * 4] >> 5, g = d[i * 4 + 1] >> 5, b = d[i * 4 + 2] >> 6;
    idx[i] = (r << 5) | (g << 2) | b;
  }
  return idx;
}
function palette332() {
  // index = (r<<5)|(g<<2)|b must match captureFrame mapping.
  const q = new Uint8Array(256 * 3);
  for (let r = 0; r < 8; r++) for (let g = 0; g < 8; g++) for (let b = 0; b < 4; b++) {
    const i = (r * 32 + g * 4 + b) * 3;
    q[i] = Math.min(255, r * 36); q[i + 1] = Math.min(255, g * 36); q[i + 2] = Math.min(255, b * 85);
  }
  return q;
}
function lzwEncode(minCode, data) {
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, next = eoi + 1;
  let dict = new Map();
  const reset = () => { dict = new Map(); for (let i = 0; i < clear; i++) dict.set(i + ",", i); next = eoi + 1; codeSize = minCode + 1; };
  reset();
  const out = [];
  let bits = 0, acc = 0;
  const emit = (code) => {
    acc |= code << bits; bits += codeSize;
    while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; }
  };
  emit(clear);
  let prefix = data[0] + ",";
  for (let i = 1; i < data.length; i++) {
    const k = prefix + data[i] + ",";
    if (dict.has(k)) { prefix = k; continue; }
    emit(dict.get(prefix));
    if (next < 4096) {
      dict.set(k, next++);
      if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++; // widen like giflib: free passes 2^w
      if (next >= 4096) { emit(clear); reset(); prefix = data[i] + ","; continue; }
    } else { emit(clear); reset(); }
    prefix = data[i] + ",";
  }
  emit(dict.get(prefix));
  emit(eoi);
  if (bits) out.push(acc & 255);
  return out;
}
function encodeGif(framesIdx, gw, gh, delayCs) {
  const pal = palette332();
  const B = [];
  const str = (s) => { for (const c of s) B.push(c.charCodeAt(0)); };
  str("GIF89a");
  const u16 = (v) => { B.push(v & 255, (v >> 8) & 255); };
  u16(gw); u16(gh);
  B.push(0xF7, 0x00, 0x00); // GCT flag, 256 colors
  for (const v of pal) B.push(v);
  B.push(0x21, 0xFF, 0x0B); // application extension header
  str("NETSCAPE2.0");
  B.push(0x03, 0x01, 0x00, 0x00, 0x00); // loop forever
  for (const f of framesIdx) {
    B.push(0x21, 0xF9, 0x04, 0x00, delayCs & 255, (delayCs >> 8) & 255, 0x00, 0x00);
    B.push(0x2C, 0x00, 0x00, 0x00, 0x00);
    u16(gw); u16(gh);
    B.push(0x00);
    const minCode = 8;
    B.push(minCode);
    const comp = lzwEncode(minCode, f);
    for (let i = 0; i < comp.length; i += 255) {
      const n = Math.min(255, comp.length - i);
      B.push(n);
      for (let j = 0; j < n; j++) B.push(comp[i + j]);
    }
    B.push(0x00);
  }
  B.push(0x3B);
  return new Blob([new Uint8Array(B)], { type: "image/gif" });
}

$("btnGif").addEventListener("click", async () => {
  const btn = $("btnGif");
  btn.disabled = true;
  try {
    const gw = 240, gh = Math.round((240 * H) / W);
    const N = 24, delayCs = 6;
    status("◢ recording 24 frames… keep watching.");
    const wasPlaying = S.playing;
    S.playing = true;
    const framesIdx = [];
    for (let i = 0; i < N; i++) {
      step(); draw();
      framesIdx.push(captureFrame(gw, gh));
      status(`◢ recording frame ${i + 1}/${N}…`);
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!wasPlaying) S.playing = false;
    status("◢ encoding GIF…");
    await new Promise((r) => setTimeout(r, 30));
    const blob = encodeGif(framesIdx, gw, gh, delayCs);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kinetic-${Date.now()}.gif`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    status(`◢ GIF saved (${Math.round(blob.size / 1024)} KB) — check your downloads.`);
  } catch (err) {
    console.error(err);
    status("◢ GIF failed — PNG export still works.");
  } finally {
    btn.disabled = false;
  }
});

// ---------- boot (instant play: <30s constraint = zero setup) ----------
spawn(S.text || "NEON//TOKYO");
if (document.fonts?.ready) document.fonts.ready.then(() => spawn($("text").value));
requestAnimationFrame(loop);
