// Elastic Marble Garden — canvas physics toy
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');

let W = 0, H = 0, dpr = 1;

function resize() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, Math.floor(r.width));
  H = Math.max(1, Math.floor(r.height));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- state ----------
const particles = [];
let gravity = 0.9;
let springsOn = true;
let colorByVel = true;
let soundOn = true;
let dragging = false;
let dragStart = null;
let dragEnd = null;
let firstFrame = true;

// ---------- audio ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, dur, type = 'sine', gain = 0.08) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}

// ---------- helpers ----------
function pt(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ---------- pointer ----------
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragStart = pt(e);
  dragEnd = dragStart;
  const hint = document.getElementById('hint');
  if (hint) hint.style.opacity = '0';
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', (e) => {
  if (dragging) dragEnd = pt(e);
});
canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  const p = pt(e);
  const dx = dragStart.x - p.x;
  const dy = dragStart.y - p.y;
  const speed = Math.hypot(dx, dy);
  if (speed >= 4) {
    const scale = 0.09;
    const r = 6 + Math.random() * 5;
    particles.push({ x: dragStart.x, y: dragStart.y, vx: dx * scale, vy: dy * scale, r });
    beep(200 + Math.min(speed * 2.5, 600), 0.13, 'triangle', 0.1);
  }
  dragStart = null;
  dragEnd = null;
});

// ---------- physics ----------
function step(dt) {
  const cx = W / 2, cy = H / 2;
  // gravity toward center
  for (const p of particles) {
    const dx = cx - p.x, dy = cy - p.y;
    const d = Math.hypot(dx, dy) + 1;
    const a = (gravity * 22000) / (d * d + 2500);
    p.vx += (dx / d) * a * dt;
    p.vy += (dy / d) * a * dt;
  }
  // springs
  if (springsOn) {
    const connectDist = 95;
    const rest = connectDist * 0.55;
    const k = 0.06;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < connectDist) {
          const f = (d - rest) * k;
          const nx = dx / d, ny = dy / d;
          a.vx += nx * f * dt * 60;
          a.vy += ny * f * dt * 60;
          b.vx -= nx * f * dt * 60;
          b.vy -= ny * f * dt * 60;
        }
      }
    }
  }
  // collisions
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + b.r;
      if (d > 0.001 && d < minD) {
        const overlap = minD - d;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        const vn = dvx * nx + dvy * ny;
        if (vn > 0) {
          const e = 0.82;
          const impulse = (1 + e) * vn * 0.5;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
          if (Math.abs(vn) > 0.6) beep(320 + Math.random() * 260, 0.045, 'square', 0.035);
        }
      }
    }
  }
  // integrate
  const damp = Math.pow(0.992, dt * 60);
  for (const p of particles) {
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    if (p.x < p.r) { p.x = p.r; p.vx *= -0.55; }
    if (p.x > W - p.r) { p.x = W - p.r; p.vx *= -0.55; }
    if (p.y < p.r) { p.y = p.r; p.vy *= -0.55; }
    if (p.y > H - p.r) { p.y = H - p.r; p.vy *= -0.55; }
  }
}

// ---------- render ----------
function draw() {
  if (firstFrame) {
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, W, H);
    firstFrame = false;
  } else {
    ctx.fillStyle = 'rgba(5,8,12,0.16)';
    ctx.fillRect(0, 0, W, H);
  }
  // gravity well
  const cx = W / 2, cy = H / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
  grad.addColorStop(0, 'rgba(124,255,196,0.4)');
  grad.addColorStop(1, 'rgba(124,255,196,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fill();
  // springs
  if (springsOn) {
    ctx.strokeStyle = 'rgba(124,184,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const D = 95;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < D) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
    }
    ctx.stroke();
  }
  // drag arrow
  if (dragging && dragStart && dragEnd) {
    ctx.strokeStyle = 'rgba(255,124,196,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dragStart.x, dragStart.y);
    ctx.lineTo(dragEnd.x, dragEnd.y);
    ctx.stroke();
    // arrowhead
    const ang = Math.atan2(dragEnd.y - dragStart.y, dragEnd.x - dragStart.x);
    const len = 10;
    ctx.beginPath();
    ctx.moveTo(dragEnd.x, dragEnd.y);
    ctx.lineTo(dragEnd.x - len * Math.cos(ang - 0.4), dragEnd.y - len * Math.sin(ang - 0.4));
    ctx.moveTo(dragEnd.x, dragEnd.y);
    ctx.lineTo(dragEnd.x - len * Math.cos(ang + 0.4), dragEnd.y - len * Math.sin(ang + 0.4));
    ctx.stroke();
  }
  // particles
  for (const p of particles) {
    const speed = Math.hypot(p.vx, p.vy);
    let color = '#7cffc4';
    if (colorByVel) {
      const t = Math.min(speed / 9, 1);
      const hue = 155 - t * 135; // green -> magenta
      color = `hsl(${hue}, 88%, 62%)`;
    }
    const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, color);
    g.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  step(dt || 1 / 60);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- controls ----------
const gravitySlider = document.getElementById('gravity');
const gval = document.getElementById('gval');
gravitySlider.addEventListener('input', () => {
  gravity = parseFloat(gravitySlider.value);
  gval.textContent = gravity.toFixed(2);
});
document.getElementById('springs').addEventListener('click', (e) => {
  springsOn = !springsOn;
  const b = e.currentTarget;
  b.classList.toggle('on', springsOn);
  b.textContent = springsOn ? 'ON' : 'OFF';
  b.setAttribute('aria-pressed', String(springsOn));
});
document.getElementById('colorvel').addEventListener('click', (e) => {
  colorByVel = !colorByVel;
  const b = e.currentTarget;
  b.classList.toggle('on', colorByVel);
  b.textContent = colorByVel ? 'ON' : 'OFF';
  b.setAttribute('aria-pressed', String(colorByVel));
});
document.getElementById('sound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  const b = e.currentTarget;
  b.classList.toggle('on', soundOn);
  b.textContent = soundOn ? 'ON' : 'OFF';
  b.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) ensureAudio();
});
document.getElementById('clear').addEventListener('click', () => {
  particles.length = 0;
  beep(180, 0.1, 'sawtooth', 0.06);
});

// ---------- GIF export ----------
const statusEl = document.getElementById('status');
const exportBtn = document.getElementById('export');

function buildPalette(frames) {
  const samples = [];
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 32 * 4) {
      samples.push([d[i], d[i + 1], d[i + 2]]);
    }
  }
  function avg(cols) {
    if (cols.length === 0) return [0, 0, 0];
    const s = [0, 0, 0];
    for (const c of cols) for (let k = 0; k < 3; k++) s[k] += c[k];
    return [Math.round(s[0] / cols.length), Math.round(s[1] / cols.length), Math.round(s[2] / cols.length)];
  }
  function split(cols, depth) {
    if (depth === 0 || cols.length === 0) return [avg(cols)];
    let min = [255, 255, 255], max = [0, 0, 0];
    for (const c of cols) for (let k = 0; k < 3; k++) {
      if (c[k] < min[k]) min[k] = c[k];
      if (c[k] > max[k]) max[k] = c[k];
    }
    let ch = 0, range = max[0] - min[0];
    for (let k = 1; k < 3; k++) {
      const r = max[k] - min[k];
      if (r > range) { range = r; ch = k; }
    }
    cols.sort((a, b) => a[ch] - b[ch]);
    const mid = Math.floor(cols.length / 2);
    return split(cols.slice(0, mid), depth - 1).concat(split(cols.slice(mid), depth - 1));
  }
  let pal = split(samples, 8);
  while (pal.length < 256) pal.push([0, 0, 0]);
  return pal.slice(0, 256);
}

function buildLUT(palette) {
  const lut = new Uint8Array(16 * 16 * 16);
  for (let r = 0; r < 16; r++)
    for (let g = 0; g < 16; g++)
      for (let b = 0; b < 16; b++) {
        const rr = r * 17, gg = g * 17, bb = b * 17;
        let best = 0, bestD = Infinity;
        for (let i = 0; i < palette.length; i++) {
          const p = palette[i];
          const dr = rr - p[0], dg = gg - p[1], db = bb - p[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bestD) { bestD = d; best = i; }
        }
        lut[(r * 16 + g) * 16 + b] = best;
      }
  return lut;
}

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const dict = new Map();
  function reset() {
    dict.clear();
    for (let i = 0; i < clearCode; i++) dict.set(i + '', i);
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  }
  reset();
  const out = [];
  let bitBuffer = 0, bitCount = 0;
  function emit(code) {
    bitBuffer |= (code << bitCount);
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xFF);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }
  emit(clearCode);
  let current = indices[0] + '';
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i] + '';
    const key = current + ',' + c;
    if (dict.has(key)) {
      current = key;
    } else {
      emit(dict.get(current));
      if (nextCode < 4096) {
        dict.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clearCode);
        reset();
      }
      current = c;
    }
  }
  emit(dict.get(current));
  emit(eoiCode);
  if (bitCount > 0) out.push(bitBuffer & 0xFF);
  return out;
}

function encodeGif(frames, w, h, fps) {
  const palette = buildPalette(frames);
  const lut = buildLUT(palette);
  const indexed = frames.map((f) => {
    const idx = new Uint8Array(w * h);
    const d = f.data;
    for (let i = 0, k = 0; i < d.length; i += 4, k++) {
      idx[k] = lut[((d[i] >> 4) * 16 + (d[i + 1] >> 4)) * 16 + (d[i + 2] >> 4)];
    }
    return idx;
  });
  const delay = Math.max(2, Math.round(100 / fps));
  const bytes = [];
  const pushStr = (s) => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); };
  const pushU16 = (v) => { bytes.push(v & 0xFF, (v >> 8) & 0xFF); };
  pushStr('GIF89a');
  pushU16(w); pushU16(h);
  bytes.push(0xF7); // gct, 256 colors
  bytes.push(0); // bg index
  bytes.push(0); // aspect
  for (let i = 0; i < 256; i++) {
    const c = palette[i] || [0, 0, 0];
    bytes.push(c[0], c[1], c[2]);
  }
  // NETSCAPE loop
  bytes.push(0x21, 0xFF, 0x0B);
  pushStr('NETSCAPE2.0');
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);
  const minCodeSize = 8;
  for (const idx of indexed) {
    // GCE
    bytes.push(0x21, 0xF9, 0x04);
    bytes.push(0x08); // disposal 2
    pushU16(delay);
    bytes.push(0x00); // transparent index
    bytes.push(0x00);
    // image descriptor
    bytes.push(0x2C);
    pushU16(0); pushU16(0); pushU16(w); pushU16(h);
    bytes.push(0x00);
    // LZW
    bytes.push(minCodeSize);
    const compressed = lzwEncode(idx, minCodeSize);
    let pos = 0;
    while (pos < compressed.length) {
      const chunk = compressed.slice(pos, pos + 255);
      bytes.push(chunk.length);
      for (let i = 0; i < chunk.length; i++) bytes.push(chunk[i]);
      pos += 255;
    }
    bytes.push(0x00);
  }
  bytes.push(0x3B);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  statusEl.textContent = 'Recording 3s...';
  const ew = 480, eh = 270;
  const off = document.createElement('canvas');
  off.width = ew; off.height = eh;
  const octx = off.getContext('2d');
  const frames = [];
  const fps = 12;
  const total = 36;
  for (let i = 0; i < total; i++) {
    await new Promise((res) => setTimeout(res, 1000 / fps));
    octx.drawImage(canvas, 0, 0, ew, eh);
    frames.push(octx.getImageData(0, 0, ew, eh));
    statusEl.textContent = `Recording ${i + 1}/${total}`;
  }
  statusEl.textContent = 'Encoding...';
  try {
    const blob = encodeGif(frames, ew, eh, fps);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elastic-marble-garden.gif';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    statusEl.textContent = 'Saved GIF';
    beep(660, 0.15, 'triangle', 0.08);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Export failed';
  } finally {
    exportBtn.disabled = false;
  }
});
