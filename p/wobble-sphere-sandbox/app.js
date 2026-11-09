const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const gSlider = document.getElementById('g');
const kSlider = document.getElementById('k');
const gVal = document.getElementById('gv');
const kVal = document.getElementById('kv');
const trailsToggle = document.getElementById('trails');
const resetBtn = document.getElementById('reset');

let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const spheres = [];
const MAX = 70;
let gravity = +gSlider.value;
let stiffness = +kSlider.value;
let trailsOn = true;

gSlider.addEventListener('input', e => { gravity = +e.target.value; gVal.textContent = gravity; });
kSlider.addEventListener('input', e => { stiffness = +e.target.value; kVal.textContent = stiffness; });
trailsToggle.addEventListener('change', e => { trailsOn = e.target.checked; if (!trailsOn) spheres.forEach(s => s.trail.length = 0); });
resetBtn.addEventListener('click', () => { spheres.length = 0; });

function posFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

let drag = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  drag = { start: posFromEvent(e), cur: posFromEvent(e) };
});
canvas.addEventListener('pointermove', e => {
  if (drag) drag.cur = posFromEvent(e);
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const p = posFromEvent(e);
  const dx = drag.start.x - p.x;
  const dy = drag.start.y - p.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 6) {
    if (spheres.length < MAX) spheres.push(makeSphere(drag.start.x, drag.start.y, 0, 0));
  } else {
    if (spheres.length < MAX) {
      const scale = 5.5;
      spheres.push(makeSphere(drag.start.x, drag.start.y, dx * scale, dy * scale));
    }
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });

function makeSphere(x, y, vx, vy) {
  const r = 10 + Math.random() * 6;
  return { x, y, vx, vy, r, trail: [] };
}

const RESTITUTION = 0.82;
const DAMPING = 0.998;
const SUBSTEPS = 3;

let last = performance.now();
function step(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const h = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) update(h);
  draw();
  requestAnimationFrame(step);
}

function update(dt) {
  const n = spheres.length;
  // accumulators
  const ax = new Array(n).fill(0);
  const ay = new Array(n).fill(gravity);
  // pair springs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = spheres[i], b = spheres[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      const target = a.r + b.r;
      if (dist < 0.001) { dx = 0.01; dy = 0; dist = 0.01; }
      if (dist < target) {
        const overlap = target - dist;
        const nx = dx / dist, ny = dy / dist;
        const f = stiffness * overlap;
        ax[i] -= f * nx; ay[i] -= f * ny;
        ax[j] += f * nx; ay[j] += f * ny;
        // damping along normal
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const rel = rvx * nx + rvy * ny;
        if (rel < 0) {
          const damp = Math.min(stiffness * 0.05, 60) * rel;
          ax[i] -= damp * nx; ay[i] -= damp * ny;
          ax[j] += damp * nx; ay[j] += damp * ny;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const s = spheres[i];
    s.vx += ax[i] * dt;
    s.vy += ay[i] * dt;
    s.vx *= DAMPING;
    s.vy *= DAMPING;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // walls
    if (s.x - s.r < 0) { s.x = s.r; s.vx = Math.abs(s.vx) * RESTITUTION; }
    if (s.x + s.r > W) { s.x = W - s.r; s.vx = -Math.abs(s.vx) * RESTITUTION; }
    if (s.y - s.r < 0) { s.y = s.r; s.vy = Math.abs(s.vy) * RESTITUTION; }
    if (s.y + s.r > H) { s.y = H - s.r; s.vy = -Math.abs(s.vy) * RESTITUTION; }
  }
  // trails
  if (trailsOn) {
    for (const s of spheres) {
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 48) s.trail.shift();
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  // trails
  if (trailsOn) {
    for (const s of spheres) {
      const t = s.trail;
      if (t.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(t[0].x, t[0].y);
      for (let i = 1; i < t.length; i++) ctx.lineTo(t[i].x, t[i].y);
      ctx.strokeStyle = 'rgba(230,57,70,0.55)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  // spheres
  for (const s of spheres) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fafafa';
    ctx.fill();
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // drag aim
  if (drag) {
    ctx.beginPath();
    ctx.moveTo(drag.start.x, drag.start.y);
    ctx.lineTo(drag.cur.x, drag.cur.y);
    ctx.strokeStyle = 'rgba(230,57,70,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // preview sphere
    ctx.beginPath();
    ctx.arc(drag.start.x, drag.start.y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(250,250,250,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // count
  ctx.fillStyle = 'rgba(250,250,250,0.55)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(spheres.length + ' / ' + MAX, 12, H - 12);
}

requestAnimationFrame(step);