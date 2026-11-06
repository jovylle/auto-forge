const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const gravityEl = $('gravity'), stiffEl = $('stiffness'), dampEl = $('damping');
const gVal = $('gVal'), kVal = $('kVal'), dVal = $('dVal');
const vectorsEl = $('vectors'), trailsEl = $('trails'), glowEl = $('glow');
const countEl = $('particleCount'), fpsEl = $('fps');
const exportBtn = $('exportBtn'), exportStatus = $('exportStatus');

const state = {
  gravity: 600,
  stiffness: 80,
  damping: 0.985,
  anchor: 'center',
  vectors: true,
  trails: true,
  glow: true,
  particles: [],
};

// load persisted
try {
  const s = JSON.parse(localStorage.getItem('gsp') || '{}');
  Object.assign(state, s, { particles: [] });
} catch (e) {}
gravityEl.value = state.gravity; stiffEl.value = state.stiffness;
dampEl.value = Math.round(state.damping * 1000);
gVal.textContent = state.gravity; kVal.textContent = state.stiffness;
dVal.textContent = state.damping.toFixed(3);
vectorsEl.checked = state.vectors; trailsEl.checked = state.trails; glowEl.checked = state.glow;
$('anchor').value = state.anchor;

function saveState() {
  localStorage.setItem('gsp', JSON.stringify({
    gravity: state.gravity, stiffness: state.stiffness, damping: state.damping,
    anchor: state.anchor, vectors: state.vectors, trails: state.trails, glow: state.glow
  }));
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(r.width * dpr);
  canvas.height = Math.floor(r.height * dpr);
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const W = () => canvas.width / (window.devicePixelRatio || 1);
const H = () => canvas.height / (window.devicePixelRatio || 1);

function anchorPos() {
  const w = W(), h = H();
  if (state.anchor === 'top') return { x: w/2, y: 60 };
  if (state.anchor === 'bottom') return { x: w/2, y: h - 60 };
  return { x: w/2, y: h/2 };
}

let hueCounter = 0;
function spawnParticle(x, y, vx, vy) {
  state.particles.push({
    x, y, vx, vy, ax: 0, ay: 0,
    hue: (hueCounter += 47) % 360,
    trail: []
  });
  if (state.particles.length > 200) state.particles.shift();
}

// drag to spawn
let dragging = false, dragStart = null, dragCur = null;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  dragging = true;
  dragStart = { x: e.clientX - r.left, y: e.clientY - r.top };
  dragCur = { ...dragStart };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  dragCur = { x: e.clientX - r.left, y: e.clientY - r.top };
});
canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  const r = canvas.getBoundingClientRect();
  const end = { x: e.clientX - r.left, y: e.clientY - r.top };
  const dx = dragStart.x - end.x;
  const dy = dragStart.y - end.y;
  spawnParticle(dragStart.x, dragStart.y, dx * 4, dy * 4);
  dragStart = null; dragCur = null;
  $('hint').style.opacity = '0';
});

// controls
function bindSlider(el, key, parse, fmt) {
  el.addEventListener('input', () => {
    const v = parse(el.value);
    state[key] = v;
    const target = key === 'gravity' ? gVal : key === 'stiffness' ? kVal : dVal;
    target.textContent = fmt(v);
    saveState();
  });
}
bindSlider(gravityEl, 'gravity', v => +v, v => v);
bindSlider(stiffEl, 'stiffness', v => +v, v => v);
bindSlider(dampEl, 'damping', v => +v / 1000, v => v.toFixed(3));
$('anchor').addEventListener('change', (e) => { state.anchor = e.target.value; $('aVal').textContent = state.anchor; saveState(); });
vectorsEl.addEventListener('change', (e) => { state.vectors = e.target.checked; saveState(); });
trailsEl.addEventListener('change', (e) => { state.trails = e.target.checked; saveState(); });
glowEl.addEventListener('change', (e) => { state.glow = e.target.checked; saveState(); });

$('clearBtn').addEventListener('click', () => { state.particles = []; });
$('burstBtn').addEventListener('click', () => {
  const w = W(), h = H();
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = 80 + Math.random() * 60;
    const cx = w/2, cy = h/2;
    spawnParticle(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad, -Math.sin(a)*200, Math.cos(a)*200);
  }
});

// physics step
function step(dt) {
  const g = state.gravity;
  const k = state.stiffness;
  const damp = state.damping;
  const ap = anchorPos();
  const w = W(), h = H();
  for (const p of state.particles) {
    // forces
    const fx = -k * (p.x - ap.x);
    const fy = g + -k * (p.y - ap.y);
    p.ax = fx;
    p.ay = fy;
    p.vx = (p.vx + p.ax * dt) * damp;
    p.vy = (p.vy + p.ay * dt) * damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // bounce
    if (p.x < 4) { p.x = 4; p.vx *= -0.6; }
    if (p.x > w-4) { p.x = w-4; p.vx *= -0.6; }
    if (p.y < 4) { p.y = 4; p.vy *= -0.6; }
    if (p.y > h-4) { p.y = h-4; p.vy *= -0.6; }
    if (state.trails) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 24) p.trail.shift();
    } else {
      p.trail.length = 0;
    }
  }
}

// render
let lastT = performance.now(), frames = 0, fpsAcc = 0;
function render() {
  const w = W(), h = H();
  ctx.fillStyle = 'rgba(7,8,26,0.22)';
  if (state.trails) ctx.fillRect(0, 0, w, h);
  else { ctx.fillStyle = '#07081a'; ctx.fillRect(0, 0, w, h); }

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

  // anchor
  const ap = anchorPos();
  ctx.fillStyle = 'rgba(255,209,102,0.9)';
  ctx.beginPath(); ctx.arc(ap.x, ap.y, 6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.4)';
  ctx.beginPath(); ctx.arc(ap.x, ap.y, 18, 0, Math.PI*2); ctx.stroke();

  // trails
  if (state.trails) {
    for (const p of state.particles) {
      if (p.trail.length < 2) continue;
      ctx.strokeStyle = `hsla(${p.hue},90%,65%,0.35)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
      ctx.stroke();
    }
  }

  // particles
  for (const p of state.particles) {
    if (state.glow) {
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
      grd.addColorStop(0, `hsla(${p.hue},95%,70%,0.9)`);
      grd.addColorStop(1, `hsla(${p.hue},95%,70%,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = `hsl(${p.hue},95%,70%)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();

    // force vectors
    if (state.vectors) {
      const scale = 0.08;
      // gravity vector
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
      drawArrow(p.x, p.y, p.x, p.y + state.gravity * scale, '#ffd166');
      // spring vector
      const sx = -state.stiffness * (p.x - ap.x);
      const sy = -state.stiffness * (p.y - ap.y);
      drawArrow(p.x, p.y, p.x + sx * scale, p.y + sy * scale, '#7cf6ff');
      // net force
      drawArrow(p.x, p.y, p.x + (sx) * scale, p.y + (state.gravity + sy) * scale, '#ff7cf6');
    }
  }

  // drag preview
  if (dragging && dragStart && dragCur) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(dragStart.x, dragStart.y); ctx.lineTo(dragCur.x, dragCur.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(124,246,255,0.8)';
    ctx.beginPath(); ctx.arc(dragStart.x, dragStart.y, 5, 0, Math.PI*2); ctx.fill();
  }

  countEl.textContent = state.particles.length + ' particles';
}

function drawArrow(x1, y1, x2, y2, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const ang = Math.atan2(dy, dx);
  const hl = 6;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hl*Math.cos(ang - 0.4), y2 - hl*Math.sin(ang - 0.4));
  ctx.lineTo(x2 - hl*Math.cos(ang + 0.4), y2 - hl*Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

let exporting = false;
// main loop
function loop(now) {
  if (exporting) { requestAnimationFrame(loop); return; }
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  step(dt);
  render();
  frames++;
  fpsAcc += 1/dt;
  if (frames % 20 === 0) { fpsEl.textContent = Math.round(fpsAcc/20) + ' fps'; fpsAcc = 0; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// GIF export
// palette LUT
const PAL = new Uint8Array(256*3);
function buildPalette() {
  // 6x6x6 cube + grays
  const levels = [0,51,102,153,204,255];
  let i = 0;
  for (const r of levels) for (const g of levels) for (const b of levels) {
    if (i >= 256) break;
    PAL[i*3]=r; PAL[i*3+1]=g; PAL[i*3+2]=b; i++;
  }
  // grays for rest
  for (; i < 256; i++) { const v = Math.round((i-216)/(255-216)*255); PAL[i*3]=v; PAL[i*3+1]=v; PAL[i*3+2]=v; }
}
buildPalette();

const LUT = new Uint8Array(32*32*32);
function buildLUT() {
  for (let r = 0; r < 32; r++)
  for (let g = 0; g < 32; g++)
  for (let b = 0; b < 32; b++) {
    let best = 0, bestD = 1e9;
    const rr = (r<<3)|4, gg = (g<<3)|4, bb = (b<<3)|4;
    for (let c = 0; c < 256; c++) {
      const dr = rr - PAL[c*3];
      const dg = gg - PAL[c*3+1];
      const db = bb - PAL[c*3+2];
      const d = dr*dr + dg*dg + db*db;
      if (d < bestD) { bestD = d; best = c; }
    }
    LUT[(r<<10)|(g<<5)|b] = best;
  }
}
buildLUT();

function quantizeImageData(imgData) {
  const out = new Uint8Array(imgData.width * imgData.height);
  const d = imgData.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const r = d[i] >> 3, g = d[i+1] >> 3, b = d[i+2] >> 3;
    out[j] = LUT[(r<<10)|(g<<5)|b];
  }
  return out;
}

function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  const maxCode = 1 << 12;
  const dict = new Map();
  function initDict() {
    dict.clear();
    for (let i = 0; i < clearCode; i++) dict.set(String.fromCharCode(i), i);
  }
  initDict();
  let nextCode = eoiCode + 1;
  const out = [];
  let cur = 0, bits = 0;
  function writeCode(code) {
    cur |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(cur & 0xFF);
      cur >>= 8;
      bits -= 8;
    }
  }
  writeCode(clearCode);
  let prefix = String.fromCharCode(pixels[0]);
  for (let i = 1; i < pixels.length; i++) {
    const c = String.fromCharCode(pixels[i]);
    const pc = prefix + c;
    if (dict.has(pc)) {
      prefix = pc;
    } else {
      writeCode(dict.get(prefix));
      if (nextCode < maxCode) {
        dict.set(pc, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        writeCode(clearCode);
        initDict();
        nextCode = eoiCode + 1;
        codeSize = minCodeSize + 1;
      }
      prefix = c;
    }
  }
  writeCode(dict.get(prefix));
  writeCode(eoiCode);
  if (bits > 0) out.push(cur & 0xFF);
  return out;
}

function pushU16(arr, v) { arr.push(v & 0xFF, (v >> 8) & 0xFF); }

async function exportGIF() {
  exporting = true;
  exportBtn.disabled = true;
  exportStatus.textContent = 'Capturing...';
  const frames = 45;
  const delay = 7; // 1/100s
  // capture dimensions (scale down for size)
  const exportW = 480, exportH = 320;
  const off = document.createElement('canvas');
  off.width = exportW; off.height = exportH;
  const octx = off.getContext('2d');

  // snapshot particles
  const snapParticles = state.particles.map(p => ({...p, trail: p.trail.map(t=>({...t}))}));

  // We'll render frames by stepping physics on a temp copy
  const tempState = {
    particles: snapParticles,
    gravity: state.gravity, stiffness: state.stiffness, damping: state.damping,
    anchor: state.anchor, trails: false, vectors: false, glow: state.glow
  };

  const frameIndices = [];
  // temporarily swap state
  const realState = state;
  // We'll manipulate a working state object and call step/render with it by monkeypatching globals? 
  // Simpler: create functions that accept state. Instead, do inline.
  
  // We'll use global `state` but save/restore.
  const saved = {
    particles: state.particles,
    gravity: state.gravity, stiffness: state.stiffness, damping: state.damping,
    anchor: state.anchor, trails: state.trails, vectors: state.vectors, glow: state.glow
  };
  state.particles = snapParticles;
  state.trails = false;
  state.vectors = false;

  const ap0 = anchorPos();
  // render helper using export canvas
  function renderFrameToExport() {
    // clear
    octx.fillStyle = '#07081a';
    octx.fillRect(0, 0, exportW, exportH);
    // scale from main canvas coords to export
    const sx = exportW / W();
    const sy = exportH / H();
    octx.save();
    octx.scale(sx, sy);
    // particles
    for (const p of state.particles) {
      if (state.glow) {
        const grd = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        grd.addColorStop(0, `hsla(${p.hue},95%,70%,0.9)`);
        grd.addColorStop(1, `hsla(${p.hue},95%,70%,0)`);
        octx.fillStyle = grd;
        octx.beginPath(); octx.arc(p.x, p.y, 14, 0, Math.PI*2); octx.fill();
      }
      octx.fillStyle = `hsl(${p.hue},95%,70%)`;
      octx.beginPath(); octx.arc(p.x, p.y, 4, 0, Math.PI*2); octx.fill();
    }
    // anchor
    const ap = anchorPos();
    octx.fillStyle = 'rgba(255,209,102,0.9)';
    octx.beginPath(); octx.arc(ap.x, ap.y, 6, 0, Math.PI*2); octx.fill();
    octx.restore();
  }

  const captured = [];
  for (let f = 0; f < frames; f++) {
    step(1/15);
    renderFrameToExport();
    const img = octx.getImageData(0, 0, exportW, exportH);
    captured.push(quantizeImageData(img));
    if (f % 5 === 0) {
      exportStatus.textContent = `Capturing ${f+1}/${frames}...`;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // restore state
  state.particles = saved.particles;
  state.gravity = saved.gravity; state.stiffness = saved.stiffness; state.damping = saved.damping;
  state.anchor = saved.anchor; state.trails = saved.trails; state.vectors = saved.vectors; state.glow = saved.glow;

  exportStatus.textContent = 'Encoding...';
  await new Promise(r => setTimeout(r, 0));

  // encode
  const bytes = [];
  const pushByte = (b) => bytes.push(b);
  const pushStr = (s) => { for (let i=0;i<s.length;i++) bytes.push(s.charCodeAt(i)); };
  const pushU16b = (v) => { bytes.push(v & 0xFF, (v>>8)&0xFF); };

  pushStr('GIF89a');
  pushU16b(exportW); pushU16b(exportH);
  pushByte(0xF7); // global table
  pushByte(0); // bg
  pushByte(0); // aspect
  for (let i = 0; i < 256; i++) { bytes.push(PAL[i*3], PAL[i*3+1], PAL[i*3+2]); }
  // netscape loop
  pushByte(0x21); pushByte(0xFF); pushByte(0x0B);
  pushStr('NETSCAPE2.0');
  pushByte(0x03); pushByte(0x01); pushU16b(0); pushByte(0x00);

  for (const idx of captured) {
    // GCE
    pushByte(0x21); pushByte(0xF9); pushByte(0x04);
    pushByte(0x00);
    pushU16b(delay);
    pushByte(0x00);
    pushByte(0x00);
    // image descriptor
    pushByte(0x2C);
    pushU16b(0); pushU16b(0); pushU16b(exportW); pushU16b(exportH);
    pushByte(0x00);
    // lzw
    const minCodeSize = 8;
    pushByte(minCodeSize);
    const compressed = lzwEncode(idx, minCodeSize);
    let pos = 0;
    while (pos < compressed.length) {
      const chunk = Math.min(255, compressed.length - pos);
      pushByte(chunk);
      for (let j = 0; j < chunk; j++) pushByte(compressed[pos++]);
    }
    pushByte(0x00);
  }
  pushByte(0x3B);

  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'gravity-spring.gif';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  exportStatus.textContent = `Exported ${frames} frames.`;
  exportBtn.disabled = false;
  exporting = false;
  lastT = performance.now();
}
exportBtn.addEventListener('click', () => { exportGIF().catch(err => { exportStatus.textContent = 'Error: ' + err.message; exportBtn.disabled = false; exporting = false; lastT = performance.now(); }); });

// (bound above with error handling)

// hint fade
setTimeout(() => { const h = $('hint'); if (h) h.style.opacity = '0.6'; }, 1000);