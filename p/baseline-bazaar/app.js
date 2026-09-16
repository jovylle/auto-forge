// BASELINE BAZAAR — kinetic type tank: variable-font bodies + collisions + GIF loop export
// 3 inks only (+black/white): #00FF9C phosphor · #FFB000 amber · #FF3B5C signal
const $ = (id) => document.getElementById(id);
const canvas = $('tank'), ctx = canvas.getContext('2d');
const INKS = ['#00FF9C', '#E9FFF3', '#FFB000'];
const SIGNAL = '#FF3B5C';
const STORE_KEY = 'baseline-bazaar:v1';
const MAX_BODIES = 42;

// ---------- state ----------
const S = {
  weight: 650, width: 100, size: 54, grav: 0.45, bounce: 0.86,
  mode: 'CHAOS', bodies: [], mouse: { x: -9e3, y: -9e3, down: false },
  drag: null, rec: null, t: 0,
};
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  for (const k of ['weight', 'width', 'size', 'grav', 'bounce', 'mode']) if (saved[k] !== undefined) S[k] = saved[k];
  if (saved.phrase) $('phrase').value = saved.phrase;
} catch { /* fresh boot */ }
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ weight: S.weight, width: S.width, size: S.size, grav: S.grav, bounce: S.bounce, mode: S.mode, phrase: $('phrase').value })); } catch {} };

// ---------- log + clock ----------
const logEl = $('log');
function log(msg, cls = 'g') {
  const d = document.createElement('div');
  d.innerHTML = `<span class="t">[${new Date().toLocaleTimeString('en-GB')}]</span> <span class="${cls}">${msg}</span>`;
  logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 60) logEl.firstChild.remove();
}
setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);
$('clock').textContent = new Date().toLocaleTimeString('en-GB');

// ---------- canvas sizing ----------
let W = 880, H = 520, DPR = 1;
function fit() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  W = Math.max(280, Math.round(r.width)); H = Math.round(r.height);
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
new ResizeObserver(fit).observe(canvas); fit();

// ---------- word bodies ----------
function fontOf(weight, size) { return `${Math.round(weight)} ${size}px Archivo, sans-serif`; }
function measure(word, weight, size) {
  ctx.font = fontOf(weight, size);
  const w = ctx.measureText(word.text).width * (S.width / 100);
  return { w, h: size * 1.05 };
}
function spawnWords(phrase) {
  const words = phrase.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  if (!words.length) return;
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), words[0]);
  words.forEach((text, i) => {
    if (S.bodies.length >= MAX_BODIES) S.bodies.shift();
    const { w, h } = measure({ text }, S.weight, S.size);
    S.bodies.push({
      text, x: W * (0.15 + 0.7 * Math.random()), y: -20 - i * (S.size * 1.2),
      vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 2,
      rot: (Math.random() - 0.5) * 0.25, vr: (Math.random() - 0.5) * 0.02,
      w, h, seed: Math.random() * Math.PI * 2, pop: 1,
      color: text === longest && words.length > 1 ? SIGNAL : INKS[(S.bodies.length) % INKS.length],
    });
  });
  $('hint').classList.add('hide');
  log(`drop &gt; “${words.join(' ')}” — ${words.length} ${words.length === 1 ? 'body' : 'bodies'} in tank`, 'a');
  save();
}

// ---------- physics ----------
function step(dt) {
  const cx = W / 2, cy = H / 2;
  for (const b of S.bodies) {
    // mode forces
    if (S.mode === 'GRID') {
      const i = S.bodies.indexOf(b), cols = Math.ceil(Math.sqrt(S.bodies.length));
      const gx = ((i % cols) + 0.5) / cols * W, gy = ((Math.floor(i / cols)) + 0.5) / Math.ceil(S.bodies.length / cols) * H;
      b.vx += (gx - b.x) * 0.004 * dt; b.vy += (gy - b.y) * 0.004 * dt;
    } else if (S.mode === 'ORBIT') {
      const dx = cx - b.x, dy = cy - b.y, d = Math.hypot(dx, dy) || 1;
      b.vx += (dx / d * 0.35 - dy / d * 1.1) * 0.03 * dt;
      b.vy += (dy / d * 0.35 + dx / d * 1.1) * 0.03 * dt;
    } else if (S.mode === 'RAIN') {
      b.vy += 0.09 * dt;
    }
    b.vy += S.grav * 0.06 * dt;
    // mouse repel (hover pushes, press attracts)
    const mdx = b.x - S.mouse.x, mdy = b.y - S.mouse.y, md = Math.hypot(mdx, mdy);
    if (md < 130 && md > 1) { const f = (S.mouse.down ? -0.9 : 1.4) * (1 - md / 130); b.vx += mdx / md * f; b.vy += mdy / md * f; }
    if (S.drag === b) { // drag-throw
      b.vx = b.vx * 0.5 + (S.mouse.x - b.x) * 0.12;
      b.vy = b.vy * 0.5 + (S.mouse.y - b.y) * 0.12;
    }
    b.vx *= 0.995; b.vy *= 0.996;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.rot += b.vr * dt; b.vr *= 0.99; b.pop = Math.max(0, b.pop - 0.03 * dt);
    // walls
    const r = Math.max(b.w, b.h) / 2;
    if (b.x < r * 0.5) { b.x = r * 0.5; b.vx = Math.abs(b.vx) * S.bounce; b.vr += 0.002; }
    if (b.x > W - r * 0.5) { b.x = W - r * 0.5; b.vx = -Math.abs(b.vx) * S.bounce; b.vr -= 0.002; }
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * S.bounce; }
    if (b.y > H - b.h * 0.5) { b.y = H - b.h * 0.5; b.vy = -Math.abs(b.vy) * S.bounce; b.vx *= 0.98; }
    if (S.mode === 'RAIN' && b.y > H - b.h * 0.5 && Math.random() < 0.02) { b.y = -30; b.vy = 1; }
  }
  // pairwise collisions (circle approx) — the "word physics collisions" core
  const B = S.bodies;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const ra = (a.w + a.h) / 4, rb = (b.w + b.h) / 4, min = (ra + rb) * 0.82;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0.01 && d2 < min * min) {
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = (min - d) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = -(1 + S.bounce * 0.9) * rel / 2;
        a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
        a.pop = b.pop = 1; a.vr += (Math.random() - 0.5) * 0.01; b.vr += (Math.random() - 0.5) * 0.01;
      }
    }
  }
}

// ---------- render ----------
function loopPhase() { // seamless-loop phase while recording, else wall-clock
  if (S.rec) return (S.rec.frame / S.rec.frames) * Math.PI * 2;
  return S.t * 0.0016;
}
function draw() {
  ctx.fillStyle = '#030604'; ctx.fillRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = 'rgba(0,255,156,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 44) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 44) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,255,156,0.25)'; ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  const ph = loopPhase();
  for (const b of S.bodies) {
    const m = measure(b, S.weight, S.size); b.w = m.w; b.h = m.h;
    const wob = Math.sin(ph * 2 + b.seed);
    const wt = Math.max(100, Math.min(900, S.weight + wob * 130 + b.pop * 180));
    const sc = 1 + b.pop * 0.22 + wob * 0.03;
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.rot + wob * 0.04); ctx.scale((S.width / 100) * sc, sc);
    ctx.font = fontOf(wt, S.size);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = b.color; ctx.shadowBlur = 18 + b.pop * 22;
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, 0);
    ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(b.text, 0, 0);
    ctx.restore();
  }
  // drag line
  if (S.drag) {
    ctx.strokeStyle = 'rgba(255,176,0,0.6)'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(S.drag.x, S.drag.y); ctx.lineTo(S.mouse.x, S.mouse.y); ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---------- main loop + HUD ----------
let last = performance.now(), fps = 60, hudT = 0;
function frame(now) {
  const dt = Math.min(3, (now - last) / 16.67); last = now;
  S.t += (now - last) * 0 + 16.67 * dt;
  fps = fps * 0.95 + (1000 / Math.max(1, now - (frame.p || now - 16))) * 0.05; frame.p = now;
  step(dt); draw();
  if (now - hudT > 500) { hudT = now; $('hud').textContent = `${S.bodies.length} bodies · ${Math.round(fps)}fps · ${S.mode}${S.rec ? ' · ●REC' : ''}`; }
  requestAnimationFrame(frame);
}

// ---------- pointer: hover repel, drag-throw, click blast ----------
function toLocal(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function pick(p) {
  let best = null, bd = 1e9;
  for (const b of S.bodies) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < Math.max(b.w, b.h) * 0.6 && d < bd) { bd = d; best = b; } }
  return best;
}
canvas.addEventListener('pointermove', (e) => Object.assign(S.mouse, toLocal(e)));
canvas.addEventListener('pointerdown', (e) => {
  const p = toLocal(e); Object.assign(S.mouse, p, { down: true });
  S.drag = pick(p);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  const p = toLocal(e);
  if (S.drag) { S.drag = null; } // release keeps throw velocity
  else for (const b of S.bodies) { // blast
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    const f = Math.max(0, 1 - d / 320) * 14; b.vx += dx / d * f; b.vy += dy / d * f - 2; b.pop = 1;
  }
  S.mouse.down = false;
});
canvas.addEventListener('pointerleave', () => { S.mouse.x = -9e3; S.mouse.y = -9e3; S.mouse.down = false; S.drag = null; });

// ---------- controls ----------
const sliders = [['s-weight', 'v-weight', 'weight', (v) => v], ['s-width', 'v-width', 'width', (v) => v],
  ['s-size', 'v-size', 'size', (v) => v], ['s-grav', 'v-grav', 'grav', (v) => (+v).toFixed(2)],
  ['s-bounce', 'v-bounce', 'bounce', (v) => (+v).toFixed(2)]];
for (const [sid, vid, key, fmt] of sliders) {
  $(sid).value = S[key]; $(vid).textContent = fmt(S[key]);
  $(sid).addEventListener('input', (e) => { S[key] = +e.target.value; $(vid).textContent = fmt(S[key]); save(); });
}
function setMode(m) {
  S.mode = m; save();
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  log(`arrange &gt; ${m}`, 'g');
}
document.querySelectorAll('#modes button').forEach((b) => {
  b.classList.toggle('on', b.dataset.mode === S.mode);
  b.addEventListener('click', () => setMode(b.dataset.mode));
});
$('btnShake').addEventListener('click', () => {
  for (const b of S.bodies) { b.vx += (Math.random() - 0.5) * 16; b.vy -= 3 + Math.random() * 8; b.pop = 1; }
  log('shake &gt; impulse to all bodies ⚡', 'a');
});
$('btnClear').addEventListener('click', () => { S.bodies.length = 0; $('hint').classList.remove('hide'); log('purge &gt; tank emptied', 'r'); });
$('promptForm').addEventListener('submit', (e) => { e.preventDefault(); spawnWords($('phrase').value); $('phrase').select(); });
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-phrase]'); if (!b) return;
  $('phrase').value = b.dataset.phrase; spawnWords(b.dataset.phrase);
});
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('phrase')) { e.preventDefault(); $('phrase').focus(); }
});

// ---------- PNG snapshot ----------
$('btnPng').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'baseline-bazaar.png'; a.href = canvas.toDataURL('image/png'); a.click();
  log('snap &gt; PNG downloaded', 'g');
});

// ---------- GIF loop export (self-contained encoder, fixed 5-ink palette) ----------
const PAL = [[3, 6, 4], [0, 255, 156], [255, 176, 0], [255, 59, 92], [233, 255, 243], [3, 6, 4], [3, 6, 4], [3, 6, 4]];
function quantize(d) {
  const idx = new Uint8Array(d.width * d.height);
  for (let i = 0; i < idx.length; i++) {
    const r = d.data[i * 4], g = d.data[i * 4 + 1], b = d.data[i * 4 + 2];
    let bi = 0, bd = 1e12;
    for (let p = 0; p < 5; p++) {
      const dr = r - PAL[p][0], dg = g - PAL[p][1], db = b - PAL[p][2];
      const dd = dr * dr + dg * dg + db * db;
      if (dd < bd) { bd = dd; bi = p; }
    }
    idx[i] = bi;
  }
  return idx;
}
function lzwEncode(idx, minSize) {
  const clear = 1 << minSize, eoi = clear + 1;
  let codeSize = minSize + 1, next = eoi + 1;
  const dict = new Map(); const out = []; let acc = 0, bits = 0;
  const emit = (c) => { acc |= c << bits; bits += codeSize; while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; } };
  emit(clear);
  let prev = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = prev * 256 + k;
    if (dict.has(key)) { prev = dict.get(key); }
    else {
      emit(prev);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
      else { emit(clear); dict.clear(); codeSize = minSize + 1; next = eoi + 1; }
      prev = k;
    }
  }
  emit(prev); const cs = codeSize; emit(eoi);
  if (bits) out.push(acc & 255);
  return { bytes: out, _cs: cs };
}
function buildGIF(frames, w, h, delayCs) {
  const B = [];
  const str = (s) => { for (const c of s) B.push(c.charCodeAt(0)); };
  const u16 = (v) => B.push(v & 255, (v >> 8) & 255);
  str('GIF89a'); u16(w); u16(h); B.push(0xF2, 0, 0);
  for (const c of PAL) B.push(c[0], c[1], c[2]);
  str('!'); B.push(0xFF, 0x0B); str('NETSCAPE2.0'); B.push(0x03, 0x01, 0x00, 0x00, 0x00);
  for (const idx of frames) {
    B.push(0x21, 0xF9, 0x04, 0x08); u16(delayCs); B.push(0, 0);
    B.push(0x2C); u16(0); u16(0); u16(w); u16(h); B.push(0x00, 0x03);
    const { bytes } = lzwEncode(idx, 3);
    for (let i = 0; i < bytes.length; i += 255) { const ch = bytes.slice(i, i + 255); B.push(ch.length, ...ch); }
    B.push(0x00);
  }
  B.push(0x3B);
  return new Blob([new Uint8Array(B)], { type: 'image/gif' });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
$('btnGif').addEventListener('click', async () => {
  if (S.rec) return;
  if (!S.bodies.length) { log('gif &gt; tank empty — drop words first', 'r'); spawnWords($('phrase').value || 'NEON BAZAAR NEVER SLEEPS'); if (!S.bodies.length) return; }
  const btn = $('btnGif'), st = $('gifStatus');
  btn.disabled = true; st.classList.add('live');
  const FRAMES = 24, gw = 320, gh = Math.max(2, Math.round(gw * H / W));
  const off = document.createElement('canvas'); off.width = gw; off.height = gh;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const frames = [];
  S.rec = { frame: 0, frames: FRAMES };
  log('gif &gt; recording 2s loop… 24f @12fps', 'r');
  try {
    for (let f = 0; f < FRAMES; f++) {
      S.rec.frame = f;
      draw(); // re-render with loop-locked phase so frame 24 wraps to frame 0
      await wait(83);
      octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, gw, gh);
      frames.push(quantize(octx.getImageData(0, 0, gw, gh)));
      st.textContent = `gif: ● recording ${f + 1}/${FRAMES}…`;
    }
    st.textContent = 'gif: encoding…';
    await wait(30);
    const blob = buildGIF(frames, gw, gh, 8);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'baseline-bazaar-loop.gif'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    log(`gif &gt; loop exported — ${(blob.size / 1024).toFixed(1)}kb, seamless`, 'g');
    st.textContent = 'gif: done ✓ — baseline-bazaar-loop.gif downloaded';
  } catch (err) { log(`gif &gt; encode failed: ${err.message}`, 'r'); st.textContent = 'gif: encode failed'; }
  S.rec = null; btn.disabled = false; st.classList.remove('live');
});

// ---------- boot ----------
log('boot &gt; baseline bazaar v1.0 — tank online', 'g');
log('boot &gt; inks: phosphor/amber/signal + black/white', 'a');
log('tip &gt; type + ENTER, or tap a preset chip — 30s to fun', 'g');
if (S.bodies.length === 0) spawnWords($('phrase').value || 'GRAVITY IS A FONT CHOICE');
requestAnimationFrame(frame);
