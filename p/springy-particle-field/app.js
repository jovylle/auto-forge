/* Springy Particle Field — Bauhaus physics toy */
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const stiffSlider = document.getElementById('stiff');
const stiffVal = document.getElementById('stiffVal');
const gravBtn = document.getElementById('grav');
const resetBtn = document.getElementById('reset');
const toastEl = document.getElementById('toast');
const particlesEl = document.getElementById('particles');
const fpsEl = document.getElementById('fps');

const DPR = Math.min(window.devicePixelRatio || 1, 2);
const COLS = 24, ROWS = 15;
const SPACING = 28;
const RADIUS = 2.6;
const MOUSE_RADIUS = 160;
const MOUSE_PULL = 5000;
const GRAVITY = 900;

let particles = [];
let springs = [];
let stiffness = 0.12;
let gravityDir = 0;
const gravityVecs = [{x:0,y:1},{x:0,y:-1},{x:-1,y:0},{x:1,y:0}];
const gravityLabels = ['Down','Up','Left','Right'];
let gx = 0, gy = GRAVITY;

let dragging = false;
let mx = 0, my = 0;
let easterActive = false;
let easterTimer = 0;
let typed = '';

const colors = ['#d02020','#1e3a8a','#f5c518','#0a0a0a'];

function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(r.width * DPR));
  canvas.height = Math.max(1, Math.floor(r.height * DPR));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
const ro = new ResizeObserver(resize);
ro.observe(canvas);

function build() {
  particles = [];
  springs = [];
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 500;
  const ox = (w - (COLS-1)*SPACING) / 2;
  const oy = (h - (ROWS-1)*SPACING) / 2;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      particles.push({ x: ox + i*SPACING, y: oy + j*SPACING, hx: ox + i*SPACING, hy: oy + j*SPACING, vx:0, vy:0, i, j });
    }
  }
  const idx = (i,j) => j*COLS + i;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      if (i < COLS-1) springs.push({ a: idx(i,j), b: idx(i+1,j), rest: SPACING });
      if (j < ROWS-1) springs.push({ a: idx(i,j), b: idx(i,j+1), rest: SPACING });
    }
  }
  particlesEl.textContent = particles.length;
}
requestAnimationFrame(() => { resize(); build(); });

function setGravity(dir) {
  gravityDir = ((dir % 4) + 4) % 4;
  const v = gravityVecs[gravityDir];
  gx = v.x * GRAVITY;
  gy = v.y * GRAVITY;
  gravBtn.textContent = 'Gravity: ' + gravityLabels[gravityDir];
}

function resetCalm() {
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 500;
  const ox = (w - (COLS-1)*SPACING) / 2;
  const oy = (h - (ROWS-1)*SPACING) / 2;
  for (const p of particles) {
    p.x = ox + p.i*SPACING; p.y = oy + p.j*SPACING;
    p.hx = p.x; p.hy = p.y;
    p.vx = 0; p.vy = 0;
  }
  setGravity(0);
  stiffness = 0.12;
  stiffSlider.value = 0.12;
  stiffVal.textContent = '0.12';
  easterActive = false;
  toast('reset to calm');
}

stiffSlider.addEventListener('input', e => {
  stiffness = parseFloat(e.target.value);
  stiffVal.textContent = stiffness.toFixed(2);
});
gravBtn.addEventListener('click', () => setGravity(gravityDir + 1));
resetBtn.addEventListener('click', resetCalm);

function toast(msg, cls='') {
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = msg;
  toastEl.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
}
canvas.addEventListener('pointerdown', e => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e); mx = p.x; my = p.y;
});
canvas.addEventListener('pointermove', e => {
  const p = toCanvas(e); mx = p.x; my = p.y;
});
canvas.addEventListener('pointerup', e => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch(_){} });
canvas.addEventListener('pointercancel', () => { dragging = false; });

window.addEventListener('keydown', e => {
  if (e.key === 'g' || e.key === 'G') setGravity(gravityDir + 1);
  if (e.key === 'r' || e.key === 'R') resetCalm();
  if (e.key === ' ') { e.preventDefault(); resetCalm(); }
  if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
    typed = (typed + e.key.toLowerCase()).slice(-7);
    if (typed === 'bauhaus') triggerEaster();
  }
});

function triggerEaster() {
  easterActive = true;
  easterTimer = 4.0;
  toast('BAUHAUS MODE', 'pop--red');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const cx = w/2, cy = h/2;
  for (const p of particles) {
    const t = (p.i + p.j) % 3;
    if (t === 0) {
      const a = (p.i / COLS + p.j / ROWS) * Math.PI * 2;
      p.hx = cx + Math.cos(a)*100; p.hy = cy + Math.sin(a)*100;
    } else if (t === 1) {
      p.hx = cx - 70 + (p.i % 9)*16; p.hy = cy - 70 + (p.j % 9)*16;
    } else {
      p.hx = cx + 50 + (p.i % 7)*14; p.hy = cy + 50 - (p.j % 7)*14;
    }
  }
}

let last = performance.now();
let frames = 0, fpsAcc = 0;
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  frames++;
  fpsAcc += dt;
  if (fpsAcc >= 0.5) { fpsEl.textContent = Math.round(frames / fpsAcc); frames = 0; fpsAcc = 0; }

  const n = particles.length;
  const fx = new Array(n).fill(0);
  const fy = new Array(n).fill(0);

  // home springs
  const homeK = stiffness * 2.5;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    fx[i] += (p.hx - p.x) * homeK;
    fy[i] += (p.hy - p.y) * homeK;
  }
  // gravity
  for (let i = 0; i < n; i++) {
    fx[i] += gx;
    fy[i] += gy;
  }
  // neighbor springs
  const sk = stiffness * 220;
  for (const s of springs) {
    const a = particles[s.a], b = particles[s.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const stretch = d - s.rest;
    const f = (stretch * sk) / d;
    const fxv = dx * f;
    const fvy = dy * f;
    fx[s.a] += fxv; fy[s.a] += fvy;
    fx[s.b] -= fxv; fy[s.b] -= fvy;
  }
  // mouse pull
  if (dragging) {
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const dx = mx - p.x, dy = my - p.y;
      const d = Math.hypot(dx, dy);
      if (d < MOUSE_RADIUS && d > 1) {
        const force = MOUSE_PULL * (1 - d / MOUSE_RADIUS);
        fx[i] += (dx / d) * force;
        fy[i] += (dy / d) * force;
      }
    }
  }

  const damp = 0.88;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    p.vx = (p.vx + fx[i] * dt);
    p.vy = (p.vy + fy[i] * dt);
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (easterActive) {
    easterTimer -= dt;
    if (easterTimer <= 0) {
      easterActive = false;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const ox = (w - (COLS-1)*SPACING)/2;
      const oy = (h - (ROWS-1)*SPACING)/2;
      for (const p of particles) { p.hx = ox + p.i*SPACING; p.hy = oy + p.j*SPACING; }
      toast('back to field');
    }
  }

  render();
  requestAnimationFrame(loop);
}

function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#0a0a0a18';
  for (let x = 0; x < w; x += 40) for (let y = 0; y < h; y += 40) {
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.lineWidth = 1;
  for (const s of springs) {
    const a = particles[s.a], b = particles[s.b];
    const stretch = Math.hypot(b.x-a.x, b.y-a.y) - s.rest;
    const t = Math.min(1, Math.abs(stretch)/14);
    ctx.strokeStyle = stretch > 0 ? `rgba(208,32,32,${0.12+0.4*t})` : `rgba(30,58,138,${0.12+0.4*t})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const p of particles) {
    const ci = (p.i + p.j) % 4;
    ctx.fillStyle = colors[ci];
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS, 0, Math.PI*2);
    ctx.fill();
  }

  if (dragging) {
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, MOUSE_RADIUS, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI*2);
    ctx.fill();
  }
}

requestAnimationFrame(loop);
window.addEventListener('resize', () => { resize(); });
window.__spf = { particles, springs, resetCalm };
