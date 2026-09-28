// Salt Meridian — a biomorphic tide pool.
// Interaction: CLICK ONLY. No drag handlers, no text inputs, no key bindings.
// Click the lagoon (or any pill button) — everything else is ambient simulation.

const canvas = document.getElementById("lagoon");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const toast = document.getElementById("toast");
const el = {
  cells: document.getElementById("stat-cells"),
  salt: document.getElementById("stat-salt"),
  tide: document.getElementById("stat-tide"),
  sal: document.getElementById("stat-sal"),
  salFill: document.getElementById("sal-fill"),
};

const STORE_KEY = "salt-meridian-lagoon-v1";
const TIDES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

// ---------- state ----------
let cells = [];    // {x,y,r,maxR,hue,age,seed,crystal,vx,vy}
let ripples = [];  // {x,y,r,alpha}
let pulse = 0;     // tidal pulse energy 0..1
let tideIdx = 0;
let lastTick = performance.now();
let elapsed = 0;
let messageTimer = 0;

function rand(a, b) { return a + Math.random() * (b - a); }

function makeCell(x, y, opts = {}) {
  const W = canvas.width, H = canvas.height;
  return {
    x: opts.x ?? (x + rand(-26, 26)),
    y: opts.y ?? (y + rand(-26, 26)),
    r: opts.r ?? rand(3, 7),
    maxR: opts.maxR ?? rand(22, 58) * (Math.min(W, H) / 520),
    hue: opts.hue ?? rand(140, 185),       // algae → lagoon teal
    warm: opts.warm ?? Math.random() < 0.22, // coral bloom variant
    age: 0,
    seed: rand(0, Math.PI * 2),
    crystal: opts.crystal ?? 0,
    vx: rand(-6, 6),
    vy: rand(-6, 6),
  };
}

function seedBloom(x, y, n = 6) {
  const rect = canvas.getBoundingClientRect();
  const cx = x ?? rand(rect.width * 0.2, rect.width * 0.8);
  const cy = y ?? rand(rect.height * 0.25, rect.height * 0.75);
  const s = canvas.width / rect.width;
  for (let i = 0; i < n; i++) {
    if (cells.length > 220) cells.shift();
    cells.push(makeCell(cx * s, cy * s));
  }
  ripples.push({ x: cx * s, y: cy * s, r: 6, alpha: 0.8 });
  dismissHint();
  save();
}

function dismissHint() { hint.classList.add("fade"); }

// ---------- presets (click) ----------
function loadPreset(kind) {
  cells = [];
  ripples = [];
  const W = canvas.width, H = canvas.height;
  if (kind === "atoll") {
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      cells.push(makeCell(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.72));
    }
  } else if (kind === "meridian") {
    for (let i = 0; i < 18; i++) {
      cells.push(makeCell(W / 2 + rand(-30, 30), rand(H * 0.08, H * 0.92), { crystal: rand(0.3, 0.9) }));
    }
  } else {
    for (let i = 0; i < 34; i++) {
      cells.push(makeCell(rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.9),
        { warm: Math.random() < 0.4 }));
    }
  }
  dismissHint();
  save();
  say(kind === "atoll" ? "atoll ring settled into the shallows"
    : kind === "meridian" ? "a salt line drawn down the middle"
    : "superbloom released — watch the edges crust");
}

// ---------- simulation ----------
function meridianX(t) {
  return canvas.width / 2 + Math.sin(t * 0.00022) * canvas.width * 0.16;
}

function step(dt) {
  elapsed += dt;
  pulse = Math.max(0, pulse - dt * 0.0009);
  const W = canvas.width, H = canvas.height;
  const mx = meridianX(elapsed);

  for (const c of cells) {
    c.age += dt / 1000;
    // logistic growth toward maxR
    const growth = (c.maxR - c.r) * 0.012 * (dt / 16.7);
    if (growth > 0) c.r += growth;
    // drift toward meridian + gentle tide swirl
    const pull = (mx - c.x) * 0.00012 * (dt / 16.7);
    c.vx += pull + Math.sin(elapsed * 0.001 + c.seed) * 0.02;
    c.vy += Math.cos(elapsed * 0.0008 + c.seed * 1.7) * 0.02 + pulse * Math.sin(c.seed + elapsed * 0.004) * 0.6;
    c.vx *= 0.985; c.vy *= 0.985;
    c.x += c.vx * (dt / 16.7); c.y += c.vy * (dt / 16.7);
    // soft walls
    if (c.x < c.r) { c.x = c.r; c.vx *= -0.6; }
    if (c.x > W - c.r) { c.x = W - c.r; c.vx *= -0.6; }
    if (c.y < c.r) { c.y = c.r; c.vy *= -0.6; }
    if (c.y > H - c.r) { c.y = H - c.r; c.vy *= -0.6; }
    // crystallize near the meridian as cells mature
    const near = 1 - Math.min(1, Math.abs(c.x - mx) / (W * 0.2));
    if (c.age > 6 && near > 0.25) c.crystal = Math.min(1, c.crystal + dt * 0.00004 * near);
  }
  for (const r of ripples) { r.r += dt * 0.09; r.alpha -= dt * 0.0006; }
  ripples = ripples.filter((r) => r.alpha > 0);

  if (Math.floor(elapsed / 20000) !== tideIdx) {
    tideIdx = Math.floor(elapsed / 20000);
  }
}

// ---------- rendering ----------
function blobPath(c, t) {
  const N = 10;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const w = 1 + 0.16 * Math.sin(a * 3 + c.seed + t * 0.0012) + 0.08 * Math.sin(a * 5 - c.seed + t * 0.0009);
    const px = c.x + Math.cos(a) * c.r * w;
    const py = c.y + Math.sin(a) * c.r * w;
    if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(
      c.x + Math.cos(a - Math.PI / N) * c.r * w * 1.08,
      c.y + Math.sin(a - Math.PI / N) * c.r * w * 1.08, px, py);
  }
  ctx.closePath();
}

function draw() {
  const W = canvas.width, H = canvas.height;
  const t = elapsed;

  // brine gradient + vignette
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#10273a");
  g.addColorStop(0.55, "#0c1d2c");
  g.addColorStop(1, "#0a1a26");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // depth contours (faint organic rings)
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "#7fd1a8";
  ctx.lineWidth = Math.max(1, W / 900);
  for (let k = 1; k <= 4; k++) {
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, (W * 0.12 * k) + Math.sin(t * 0.0004 + k) * 8, (H * 0.16 * k), 0.2 * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // meridian line
  const mx = meridianX(t);
  const mg = ctx.createLinearGradient(mx - 30, 0, mx + 30, 0);
  mg.addColorStop(0, "rgba(201,167,235,0)");
  mg.addColorStop(0.5, "rgba(201,167,235,0.35)");
  mg.addColorStop(1, "rgba(201,167,235,0)");
  ctx.fillStyle = mg;
  ctx.fillRect(mx - 30, 0, 60, H);
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = "rgba(244,234,216,0.5)";
  ctx.lineWidth = Math.max(1, W / 800);
  ctx.beginPath();
  for (let y = 0; y <= H; y += 8) {
    const xx = mx + Math.sin(y * 0.02 + t * 0.001) * 6;
    if (y === 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
  }
  ctx.stroke();
  ctx.restore();

  // kin bridges between near cells
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < Math.min(i + 8, cells.length); j++) {
      const a = cells[i], b = cells[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const link = a.r + b.r + 26;
      if (d < link && d > 1) {
        ctx.strokeStyle = a.warm || b.warm ? "#ff8f7b" : "#7fd1a8";
        ctx.lineWidth = Math.max(1, (1 - d / link) * 10);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  ctx.restore();

  // cells
  for (const c of cells) {
    const base = c.warm ? `255,143,123` : `127,209,168`;
    const grad = ctx.createRadialGradient(c.x - c.r * 0.3, c.y - c.r * 0.3, c.r * 0.1, c.x, c.y, c.r * 1.15);
    grad.addColorStop(0, `rgba(${c.warm ? "255,214,190" : "226,250,236"},0.95)`);
    grad.addColorStop(0.55, `rgba(${base},0.55)`);
    grad.addColorStop(1, `rgba(${base},0.08)`);
    blobPath(c, t);
    ctx.fillStyle = grad;
    ctx.fill();

    // salt crust: pale polygonal shards grow with crystal
    if (c.crystal > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, c.crystal + 0.15);
      ctx.strokeStyle = "#f4ead8";
      ctx.fillStyle = "rgba(244,234,216,0.25)";
      ctx.lineWidth = Math.max(1, W / 1000);
      const spikes = 5 + Math.floor(c.crystal * 4);
      ctx.beginPath();
      for (let s = 0; s <= spikes; s++) {
        const a = (s / spikes) * Math.PI * 2 + c.seed;
        const rr = c.r * (0.35 + c.crystal * 0.75) * (s % 2 === 0 ? 1 : 0.55);
        const px = c.x + Math.cos(a) * rr, py = c.y + Math.sin(a) * rr;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // ripples
  for (const r of ripples) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.alpha);
    ctx.strokeStyle = "#fdfbf4";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = Math.max(0, r.alpha * 0.5);
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

function frame(now) {
  const dt = Math.min(50, now - lastTick);
  lastTick = now;
  step(dt);
  draw();
  updateStats();
  requestAnimationFrame(frame);
}

// ---------- stats ----------
function updateStats() {
  const living = cells.filter((c) => c.crystal < 0.8).length;
  const salted = cells.length ? cells.filter((c) => c.crystal >= 0.5).length / cells.length : 0;
  const sal = cells.length ? Math.min(9.9, 1.2 + cells.length * 0.06 + salted * 3) : 0;
  el.cells.textContent = String(cells.length);
  el.salt.textContent = `${Math.round(salted * 100)}%`;
  el.tide.textContent = TIDES[tideIdx % TIDES.length];
  el.sal.textContent = sal.toFixed(1);
  el.salFill.style.width = `${Math.min(100, (sal / 9.9) * 100)}%`;
}

// ---------- persistence + share ----------
function serialize() {
  return {
    v: 1,
    cells: cells.slice(0, 220).map((c) => ({
      x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.maxR),
      hue: Math.round(c.hue), warm: c.warm ? 1 : 0, crystal: +c.crystal.toFixed(2),
    })),
  };
}

function hydrate(data) {
  if (!data || !Array.isArray(data.cells)) return false;
  cells = data.cells.slice(0, 220).map((s) => makeCell(s.x, s.y, {
    r: 4, maxR: Math.max(10, s.r || 30), hue: s.hue ?? 160,
    warm: !!s.warm, crystal: Math.min(1, s.crystal || 0), x: s.x, y: s.y,
  }));
  // rescale from saved pixel space to current canvas
  return true;
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(serialize())); } catch { /* private mode */ }
}

function encodeHash() {
  const json = JSON.stringify(serialize());
  return "#lagoon=" + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeHash() {
  if (!location.hash.startsWith("#lagoon=")) return null;
  try {
    const b64 = location.hash.slice(8).replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch { return null; }
}

function say(msg) {
  toast.textContent = msg;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { toast.textContent = ""; }, 3600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // file:// contexts may block clipboard — fall back to a temp selection
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

function download(name, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- sizing ----------
function fit() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(300, Math.round(rect.width * dpr));
  const h = Math.round(w * (10 / 16));
  if (canvas.width !== w || canvas.height !== h) {
    const sx = w / (canvas.width || w), sy = h / (canvas.height || h);
    canvas.width = w; canvas.height = h;
    for (const c of cells) { c.x *= sx; c.y *= sy; c.maxR *= Math.min(sx, sy); c.r *= Math.min(sx, sy); }
  }
}

// ---------- CLICK-ONLY wiring (no drag, no keys, no inputs) ----------
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  seedBloom(e.clientX - rect.left, e.clientY - rect.top, 5 + Math.floor(Math.random() * 4));
  save();
});

document.getElementById("btn-bloom").addEventListener("click", () => { seedBloom(undefined, undefined, 9); });
document.getElementById("btn-tide").addEventListener("click", (e) => {
  pulse = 1;
  ripples.push({ x: canvas.width / 2, y: canvas.height / 2, r: 10, alpha: 0.9 });
  e.currentTarget.classList.add("warm");
  setTimeout(() => e.currentTarget.classList.remove("warm"), 600);
  say("tidal pulse — the meridian breathes");
});
document.getElementById("btn-clear").addEventListener("click", () => {
  cells = []; ripples = [];
  try { localStorage.removeItem(STORE_KEY); } catch { /* noop */ }
  say("evaporated — a clean salt pan remains");
});
document.getElementById("btn-atoll").addEventListener("click", () => loadPreset("atoll"));
document.getElementById("btn-meridian").addEventListener("click", () => loadPreset("meridian"));
document.getElementById("btn-bloompreset").addEventListener("click", () => loadPreset("superbloom"));

document.getElementById("btn-png").addEventListener("click", () => {
  draw();
  download("salt-meridian.png", canvas.toDataURL("image/png"));
  say("tide PNG pressed into salt paper ✓");
});
document.getElementById("btn-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download("salt-meridian-lagoon.json", url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  say("lagoon JSON bottled ✓");
});
document.getElementById("btn-link").addEventListener("click", async () => {
  save();
  const url = location.href.split("#")[0] + encodeHash();
  const ok = await copyText(url);
  try { history.replaceState(null, "", encodeHash()); } catch { /* file:// may reject */ }
  say(ok ? "lagoon link copied — send it like a message in a bottle ✓" : "link ready in the address bar — copy it manually");
});

// ---------- boot ----------
function boot() {
  fit();
  const shared = decodeHash();
  if (shared && hydrate(shared)) {
    dismissHint();
    say("a shared lagoon washed ashore — click to make it yours");
  } else {
    let restored = null;
    try { restored = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { /* noop */ }
    if (restored && hydrate(restored)) {
      dismissHint();
    } else {
      loadPreset("atoll");
      hint.classList.remove("fade");
    }
  }
  window.addEventListener("resize", fit);
  // gentle ambient seeding keeps the pool alive between clicks (not a user interaction)
  setInterval(() => {
    if (document.hidden) return;
    if (cells.length < 10) seedBloom(undefined, undefined, 4);
    else save();
  }, 7000);
  requestAnimationFrame((n) => { lastTick = n; requestAnimationFrame(frame); });
}

boot();
