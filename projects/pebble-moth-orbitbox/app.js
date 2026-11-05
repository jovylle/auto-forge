// Pebble Moth Orbitbox — slingshot moths, movable wells, 60s stardust run, springy trails.
// Scroll position modulates gravity (constraint: must react to scroll).
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const clockEl = document.getElementById('clock');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gravfill = document.getElementById('gravfill');
const gravval = document.getElementById('gravval');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovText = document.getElementById('ovText');
const startBtn = document.getElementById('startBtn');
const toast = document.getElementById('toast');

const BEST_KEY = 'pebble-moth-orbitbox-best';
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let W = 900, H = 520, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  W = Math.max(320, r.width); H = Math.max(340, r.height);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  pad.x = W * 0.12; pad.y = H * 0.82;
  wells.forEach(w => { w.x = clamp(w.x, 40, W - 40); w.y = clamp(w.y, 60, H - 60); });
}
window.addEventListener('resize', resize);

// ---- state ----
const pad = { x: 100, y: 420 };
const wells = [
  { x: 0.55, y: 0.42, r: 34, strength: 26000, color: '#ff2e88', pulse: 0, fx: 0.55, fy: 0.42 },
  { x: 0.78, y: 0.62, r: 28, strength: 20000, color: '#2e6bff', pulse: 0, fx: 0.78, fy: 0.62 },
];
let moths = [], dust = [], parts = [], floaters = [];
let aiming = null, wellDrag = -1;
let running = false, timeLeft = 60, score = 0, launches = 0, last = 0, elapsed = 0;
let best = +(localStorage.getItem(BEST_KEY) || 0);
let soundOn = true, AC = null;
bestEl.textContent = best + ' ★';
document.getElementById('scoreLine').innerHTML = `Your best haul: <b>${best}★</b>. Stardust respawns, so keep the sky busy — two moths orbiting at once beats one perfect shot.`;

// ---- scroll → gravity (hard constraint) ----
let gravMul = 1, scrollProg = 0;
function onScroll() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  scrollProg = clamp(scrollY / max, 0, 1);
  gravMul = 0.6 + scrollProg * 1.5; // 0.6× .. 2.1×
  document.documentElement.style.setProperty('--scroll', scrollProg.toFixed(3));
  document.getElementById('scrollfill').style.width = (scrollProg * 100).toFixed(1) + '%';
  gravfill.style.width = ((gravMul / 2.1) * 100).toFixed(1) + '%';
  gravval.textContent = gravMul.toFixed(2) + '× GRAVITY';
}
window.addEventListener('scroll', onScroll, { passive: true });

function blip(f = 440, d = 0.08, type = 'square', g = 0.05) {
  if (!soundOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime(g, AC.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
    o.connect(gn).connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
  } catch { /* no audio */ }
}
function say(msg) {
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---- entities ----
function spawnDust(n, anywhere) {
  for (let i = 0; i < n; i++) {
    const golden = Math.random() < 0.22;
    dust.push({
      x: rand(W * 0.3, W * 0.95), y: rand(H * 0.1, H * 0.85),
      r: golden ? 11 : 8, golden, spin: rand(0, TAU),
      drift: golden ? { a: rand(0, TAU), s: rand(20, 45) } : null,
      born: elapsed,
    });
  }
  if (!anywhere) dust = dust.filter(d => Math.hypot(d.x - pad.x, d.y - pad.y) > 120);
}
function burst(x, y, color, n = 18, pow = 160) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(pow * 0.3, pow);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), t: 0, color, r: rand(2, 5) });
  }
}
function floater(x, y, text, color = '#ffd500') {
  floaters.push({ x, y, text, color, t: 0, life: 1.1 });
}
function launch(vx, vy) {
  const TRAIL = 26;
  const trail = [];
  for (let i = 0; i < TRAIL; i++) trail.push({ x: pad.x, y: pad.y, vx: 0, vy: 0 });
  moths.push({ x: pad.x, y: pad.y, vx, vy, age: 0, life: 12, flap: rand(0, TAU), trail, hue: Math.random() < 0.5 ? '#fff6e9' : '#00e5ff' });
  launches++;
  burst(pad.x, pad.y, '#ffd500', 14, 220);
  blip(220 + Math.min(600, Math.hypot(vx, vy) * 0.4), 0.12);
}

// ---- input: slingshot vs well-drag ----
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  const p = toGame(e);
  // wells first
  for (let i = 0; i < wells.length; i++) {
    if (Math.hypot(p.x - wells[i].x, p.y - wells[i].y) < wells[i].r + 26) {
      wellDrag = i; wells[i].pulse = 1; blip(660, 0.06); return;
    }
  }
  aiming = { cx: p.x, cy: p.y };
});
canvas.addEventListener('pointermove', e => {
  const p = toGame(e);
  if (wellDrag >= 0) {
    wells[wellDrag].x = clamp(p.x, 30, W - 30);
    wells[wellDrag].y = clamp(p.y, 40, H - 30);
    return;
  }
  if (aiming) { aiming.cx = p.x; aiming.cy = p.y; }
});
function endPointer(e) {
  if (wellDrag >= 0) { wellDrag = -1; return; }
  if (aiming) {
    // slingshot: pull vector from pad to cursor, launch opposite
    const dx = pad.x - aiming.cx, dy = pad.y - aiming.cy;
    const power = Math.hypot(dx, dy);
    aiming = null;
    if (!running) { say('Hit START first, then fling!'); return; }
    if (power < 18) return;
    const sp = clamp(power * 3.2, 120, 900);
    const a = Math.atan2(dy, dx);
    launch(Math.cos(a) * sp, Math.sin(a) * sp);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', () => { aiming = null; wellDrag = -1; });

// ---- buttons ----
startBtn.addEventListener('click', startRun);
document.getElementById('resetBtn').addEventListener('click', startRun);
document.getElementById('wellsBtn').addEventListener('click', () => {
  wells[0].x = rand(W * 0.35, W * 0.7); wells[0].y = rand(H * 0.2, H * 0.7);
  wells[1].x = rand(W * 0.5, W * 0.9); wells[1].y = rand(H * 0.25, H * 0.8);
  wells.forEach(w => { w.pulse = 1; burst(w.x, w.y, w.color, 16, 180); });
  blip(520, 0.1); say('Wells shuffled — bend new orbits!');
});
document.getElementById('soundBtn').addEventListener('click', e => {
  soundOn = !soundOn;
  e.target.textContent = soundOn ? '♪ sound on' : '✕ muted';
  e.target.setAttribute('aria-pressed', soundOn);
});
document.getElementById('clearBtn').addEventListener('click', () => {
  best = 0; localStorage.removeItem(BEST_KEY);
  bestEl.textContent = '0 ★'; say('Best forgotten. Fly fresh!');
});

function startRun() {
  moths = []; parts = []; floaters = []; dust = [];
  score = 0; launches = 0; timeLeft = 60; running = true;
  scoreEl.textContent = '0 ★'; clockEl.textContent = '60.0';
  document.querySelector('.hud-card.time').classList.remove('urgent');
  spawnDust(15);
  overlay.classList.add('hidden');
  say('FLING! chain launches — moths live 12s');
  blip(440, 0.12); setTimeout(() => blip(660, 0.12), 120);
}
function endRun() {
  running = false;
  const isBest = score > best;
  if (isBest) { best = score; localStorage.setItem(BEST_KEY, best); }
  bestEl.textContent = best + ' ★';
  ovTitle.textContent = isBest ? 'NEW BEST! ' + score + '★' : 'TIME! ' + score + '★';
  ovText.innerHTML = `You launched <b>${launches}</b> moth${launches === 1 ? '' : 's'} and grabbed <b>${score}★</b>${isBest ? ' — a new house record!' : ` — best is ${best}★`}. Scroll to thin the gravity, shuffle the wells, go again.`;
  startBtn.textContent = 'FLY AGAIN';
  overlay.classList.remove('hidden');
  burst(W / 2, H / 2, '#ffd500', 60, 320);
  blip(330, 0.2, 'square'); setTimeout(() => blip(isBest ? 880 : 220, 0.3, 'square'), 180);
}

// ---- physics ----
function step(dt) {
  elapsed += dt;
  if (running) {
    timeLeft -= dt;
    clockEl.textContent = Math.max(0, timeLeft).toFixed(1);
    if (timeLeft <= 10) document.querySelector('.hud-card.time').classList.add('urgent');
    if (timeLeft <= 0) { timeLeft = 0; endRun(); }
  }
  // golden drift
  for (const d of dust) {
    d.spin += dt * 3;
    if (d.drift) { d.drift.a += dt; d.x += Math.cos(d.drift.a) * d.drift.s * dt; d.y += Math.sin(d.drift.a * 1.3) * d.drift.s * dt; }
  }
  // moths
  for (let i = moths.length - 1; i >= 0; i--) {
    const m = moths[i];
    m.age += dt; m.flap += dt * 22;
    let ax = 0, ay = 0;
    for (const w of wells) {
      const dx = w.x - m.x, dy = w.y - m.y;
      const d2 = dx * dx + dy * dy + 900;
      const f = (w.strength * gravMul) / d2;
      const d = Math.sqrt(d2);
      ax += (dx / d) * f; ay += (dy / d) * f;
      if (d < w.r + 60) w.pulse = Math.min(1.4, w.pulse + dt * 6);
      if (d < w.r * 0.55) { // swallowed
        burst(m.x, m.y, w.color, 22, 240); floater(m.x, m.y - 14, 'GULP!', w.color);
        blip(140, 0.2, 'sawtooth'); moths.splice(i, 1); break;
      }
    }
    if (!moths.includes(m)) continue;
    m.vx += ax * dt; m.vy += ay * dt;
    m.vx *= (1 - 0.06 * dt); m.vy *= (1 - 0.06 * dt);
    m.x += m.vx * dt; m.y += m.vy * dt;
    // springy trail: each link springs toward the one ahead
    const t = m.trail;
    t[0].x = m.x; t[0].y = m.y;
    for (let k = 1; k < t.length; k++) {
      const n = t[k], p = t[k - 1];
      n.vx = (n.vx + (p.x - n.x) * 26 * dt) * 0.86;
      n.vy = (n.vy + (p.y - n.y) * 26 * dt) * 0.86;
      n.x += n.vx * dt * 60 * 0.16; n.y += n.vy * dt * 60 * 0.16;
    }
    // collect
    for (let j = dust.length - 1; j >= 0; j--) {
      const d = dust[j];
      if (Math.hypot(m.x - d.x, m.y - d.y) < 24) {
        const v = d.golden ? 5 : 1;
        score += v; scoreEl.textContent = score + ' ★';
        burst(d.x, d.y, d.golden ? '#ffb300' : '#00e5ff', d.golden ? 30 : 16, d.golden ? 280 : 180);
        floater(d.x, d.y - 16, (d.golden ? '+5 COMET!' : '+1'), d.golden ? '#ffb300' : '#00e5ff');
        blip(d.golden ? 990 : 740, 0.1);
        dust.splice(j, 1);
        spawnDust(1, true);
      }
    }
    if (m.age > m.life || m.x < -80 || m.x > W + 80 || m.y < -80 || m.y > H + 80) moths.splice(i, 1);
  }
  // particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.vy += 60 * dt;
    if (p.t > p.life) parts.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].t += dt; floaters[i].y -= 34 * dt;
    if (floaters[i].t > floaters[i].life) floaters.splice(i, 1);
  }
  wells.forEach(w => { w.pulse = Math.max(0, w.pulse - dt * 2); });
}

// ---- render ----
function star(x, y, r, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color; ctx.strokeStyle = '#14101f'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 8) * TAU;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function draw(t) {
  // bg: deep space with scroll-shifted hue + parallax dots
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${258 + scrollProg * 60},70%,${12 + scrollProg * 4}%)`);
  g.addColorStop(1, '#0e0b1e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff22';
  const off = scrollProg * 120;
  for (let i = 0; i < 70; i++) {
    const x = (i * 137.5) % W, y = ((i * 89.3) - off * (0.3 + (i % 5) * 0.2) % (H + 40) + H + 40) % (H + 40) - 20;
    ctx.fillRect(x, y, (i % 3) + 1, (i % 3) + 1);
  }
  // wells
  for (const w of wells) {
    const pr = w.r * (1 + w.pulse * 0.25 + Math.sin(t * 3) * 0.04);
    ctx.save();
    ctx.strokeStyle = w.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath(); ctx.arc(w.x, w.y, pr + k * 16 + ((t * 30) % 16), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const rg = ctx.createRadialGradient(w.x, w.y, 2, w.x, w.y, pr);
    rg.addColorStop(0, '#0e0b1e'); rg.addColorStop(0.75, w.color); rg.addColorStop(1, '#14101f');
    ctx.fillStyle = rg; ctx.lineWidth = 4; ctx.strokeStyle = '#14101f';
    ctx.beginPath(); ctx.arc(w.x, w.y, pr, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 11px Space Grotesk';
    ctx.textAlign = 'center'; ctx.fillText('DRAG', w.x, w.y + 4);
    ctx.restore();
  }
  // dust
  for (const d of dust) {
    const bobY = Math.sin(t * 2 + d.spin) * 4;
    ctx.save();
    ctx.shadowColor = d.golden ? '#ffb300' : '#00e5ff'; ctx.shadowBlur = 14;
    star(d.x, d.y + bobY, d.r, d.spin, d.golden ? '#ffb300' : '#fff6e9');
    ctx.restore();
  }
  // aim guide
  if (aiming && running) {
    const dx = pad.x - aiming.cx, dy = pad.y - aiming.cy;
    const power = Math.hypot(dx, dy);
    ctx.save();
    // rubber band
    ctx.strokeStyle = '#ffd500'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pad.x - 14, pad.y); ctx.lineTo(aiming.cx, aiming.cy); ctx.stroke();
    ctx.strokeStyle = '#14101f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.x - 14, pad.y); ctx.lineTo(aiming.cx, aiming.cy); ctx.stroke();
    if (power > 18) {
      const sp = clamp(power * 3.2, 120, 900), a = Math.atan2(dy, dx);
      let px = pad.x, py = pad.y, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      ctx.fillStyle = '#fff6e9';
      for (let s = 0; s < 26; s++) {
        const dts = 0.09;
        let ax = 0, ay = 0;
        for (const w of wells) {
          const ddx = w.x - px, ddy = w.y - py;
          const d2 = ddx * ddx + ddy * ddy + 900;
          const f = (w.strength * gravMul) / d2, dd = Math.sqrt(d2);
          ax += (ddx / dd) * f; ay += (ddy / dd) * f;
        }
        vx += ax * dts; vy += ay * dts; px += vx * dts; py += vy * dts;
        if (s % 2 === 0) { ctx.beginPath(); ctx.arc(px, py, 4 - s * 0.1, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  // nest (launch pad)
  ctx.save();
  ctx.translate(pad.x, pad.y);
  ctx.fillStyle = '#ffd500'; ctx.strokeStyle = '#14101f'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-34, 16); ctx.lineTo(0, -22); ctx.lineTo(34, 16); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#14101f'; ctx.font = '700 11px Space Grotesk'; ctx.textAlign = 'center';
  ctx.fillText('NEST', 0, 10);
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.arc(-14, 0, 7, 0, TAU); ctx.arc(14, 0, 7, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
  // moths + springy trails
  for (const m of moths) {
    const tr = m.trail;
    for (let k = tr.length - 1; k >= 1; k--) {
      const f = 1 - k / tr.length;
      ctx.strokeStyle = k % 3 ? '#ff2e88' : '#00e5ff';
      ctx.globalAlpha = 0.15 + f * 0.75;
      ctx.lineWidth = 1 + f * 7;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tr[k].x, tr[k].y); ctx.lineTo(tr[k - 1].x, tr[k - 1].y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // moth body with flapping wings
    const flap = Math.abs(Math.sin(m.flap)) * 0.9 + 0.25;
    const ang = Math.atan2(m.vy, m.vx);
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(ang);
    ctx.fillStyle = m.hue; ctx.strokeStyle = '#14101f'; ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(1, s * flap);
      ctx.beginPath(); ctx.ellipse(-2, -10, 11, 6.5, -0.5, 0, TAU);
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#14101f';
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd500';
    ctx.beginPath(); ctx.arc(5, 0, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // particles + floaters
  for (const p of parts) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
  }
  ctx.globalAlpha = 1;
  for (const f of floaters) {
    ctx.save(); ctx.globalAlpha = 1 - f.t / f.life;
    ctx.font = '28px Anton'; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = '#14101f';
    ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
  // idle prompt arrow
  if (!running && moths.length === 0) {
    ctx.save();
    ctx.font = '700 14px Space Grotesk'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e9cc';
    ctx.fillText('drag back from the NEST to aim', pad.x + 130, pad.y - 60 + Math.sin(t * 3) * 5);
    ctx.restore();
  }
}

function loop(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  step(dt);
  draw(ts / 1000);
  requestAnimationFrame(loop);
}

// init well positions in px
wells[0].x = wells[0].fx * 900; wells[0].y = wells[0].fy * 520;
wells[1].x = wells[1].fx * 900; wells[1].y = wells[1].fy * 520;
resize();
wells[0].x = wells[0].fx * W; wells[0].y = wells[0].fy * H;
wells[1].x = wells[1].fx * W; wells[1].y = wells[1].fy * H;
spawnDust(15);
onScroll();
requestAnimationFrame(loop);
console.log('orbitbox ready');
