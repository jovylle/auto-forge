// Counterform Carnival — living poster engine (canvas, no deps)
// Palette (3 inks + black/white): terra #E4572E · moss #2E7D5B · gold #EFA00B · ink #16130E · paper #FFF9EF
const INKS = ["#E4572E", "#2E7D5B", "#EFA00B"];
const INK = "#16130E", PAPER = "#FFF9EF";
const LS_KEY = "counterform-carnival-v1";
const W = 1200, H = 1600;
const WORDS = ["bloom", "mycelium", "spore", "petal", "tendril", "moss", "swarm", "nectar", "rhizome", "fern"];

const $ = (id) => document.getElementById(id);
const canvas = $("poster"), ctx = canvas.getContext("2d");
const wordInput = $("wordInput"), wghtEl = $("wght"), wdthEl = $("wdth"), bloomEl = $("bloom");
const wghtVal = $("wghtVal"), wdthVal = $("wdthVal"), bloomVal = $("bloomVal");
const captionWord = $("captionWord"), captionMeta = $("captionMeta"), seedLabel = $("seedLabel");
const charCount = $("charCount"), motionBtn = $("motionBtn");

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const elasticOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
// blobby closed path
function blobPath(c, cx, cy, r, wob, t, lobes = 7, phase = 0) {
  c.beginPath();
  for (let i = 0; i <= lobes * 8; i++) {
    const a = (i / (lobes * 8)) * Math.PI * 2;
    const rr = r * (1 + wob * Math.sin(a * lobes + phase + t));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.closePath();
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return {
      word: typeof s.word === "string" && s.word.trim() ? s.word.slice(0, 12) : "bloom",
      wght: clamp(+s.wght || 640, 100, 1000),
      wdth: clamp(+s.wdth || 110, 25, 151),
      bloom: clamp(s.bloom ?? 60, 0, 100),
      seed: (s.seed ?? 7) | 0,
      layout: clamp(s.layout ?? 0, 0, 3) | 0,
      motion: s.motion !== false,
    };
  } catch { return { word: "bloom", wght: 640, wdth: 110, bloom: 60, seed: 7, layout: 0, motion: true }; }
}
const state = loadState();
let sproutT0 = performance.now();
let bursts = []; // click spore bursts {x,y,t0,rng offsets}
let spores = [];

function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }

function reseedSpores() {
  const rng = mulberry32(state.seed * 7919 + 13);
  const n = 26 + Math.round((state.bloom / 100) * 70);
  spores = Array.from({ length: n }, () => ({
    x: rng() * W, y: rng() * H, r: 3 + rng() * 11,
    c: INKS[(rng() * 3) | 0], sp: 0.2 + rng() * 0.9, ph: rng() * 6.28, a: 0.25 + rng() * 0.5,
  }));
}

function posterFont(px) {
  return `${state.wght} ${px}px "Roboto Flex", system-ui, sans-serif`;
}
function applyVariation(c) {
  try { c.fontVariationSettings = `"wght" ${state.wght}, "wdth" ${state.wdth}`; } catch {}
}

// fit one line (or wrapped) — returns {size, lines}
function layoutWord(c, maxW) {
  const clean = (state.word || "bloom").slice(0, 12);
  let size = 300;
  c.font = posterFont(size); applyVariation(c);
  // try single line first
  if (c.measureText(clean).width * (state.wdth / 100) * 0.82 <= maxW) return { size, lines: [clean] };
  // shrink until fits or wrap at 6 chars
  while (size > 60) {
    size -= 12;
    c.font = posterFont(size); applyVariation(c);
    if (c.measureText(clean).width * (state.wdth / 100) * 0.82 <= maxW) return { size, lines: [clean] };
    if (size < 170) break;
  }
  // wrap mid-word for long words
  const mid = Math.ceil(clean.length / 2);
  return { size: Math.max(size, 120), lines: [clean.slice(0, mid), clean.slice(mid)] };
}

function letterAnchor(i, n, t, cx, cy, lineW) {
  const u = n === 1 ? 0.5 : i / (n - 1); // 0..1
  const sway = Math.sin(t / 700 + i * 0.9) * 14;
  const bob = Math.cos(t / 900 + i * 1.3) * 18;
  switch (state.layout) {
    case 1: { // arch
      const a = Math.PI * (0.15 + 0.7 * u);
      return { x: cx + Math.cos(a) * lineW * 0.42, y: cy - Math.sin(a) * 300 + bob * 0.4, r: (u - 0.5) * 0.5 + sway * 0.002 };
    }
    case 2: { // stack (vertical)
      return { x: cx + sway, y: cy + (i - (n - 1) / 2) * 190 + bob * 0.3, r: Math.sin(t / 800 + i) * 0.06 };
    }
    case 3: { // wild scatter (seeded)
      const rng = mulberry32(state.seed * 131 + 7);
      const px = (rng() - 0.5) * 560, py = (rng() - 0.5) * 720;
      return { x: cx + px * 0.9 + sway, y: cy + py * 0.9 + bob, r: (rng() - 0.5) * 0.5 };
    }
    default: { // cascade vine
      const x = cx - lineW / 2 + (lineW * u);
      const y = cy + Math.sin(u * Math.PI * 1.6 + state.seed) * 90 + bob;
      return { x: x + sway * 0.4, y, r: Math.sin(u * 3 + t / 900) * 0.09 };
    }
  }
}

function render(c, t, now) {
  // paper
  c.save();
  c.clearRect(0, 0, W, H);
  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);

  // ambient giant blobs (3 inks, airy)
  const rngBg = mulberry32(state.seed * 31 + 5);
  const bgBlobs = [
    { c: INKS[0], x: 180 + rngBg() * 120, y: 260, r: 300 },
    { c: INKS[1], x: 1000, y: 1150 + rngBg() * 120, r: 340 },
    { c: INKS[2], x: 950, y: 250, r: 220 },
    { c: INKS[(state.seed % 3 + 3) % 3], x: 220, y: 1330, r: 240 },
  ];
  for (const b of bgBlobs) {
    c.globalAlpha = 0.16;
    blobPath(c, b.x, b.y, b.r, 0.10, t / 1600 + b.x, 6, b.y);
    c.fillStyle = b.c; c.fill();
  }
  c.globalAlpha = 1;

  // vine stems curling through negative space
  c.strokeStyle = INKS[(state.seed + 1) % 3]; c.globalAlpha = 0.5; c.lineWidth = 7; c.lineCap = "round";
  for (let v = 0; v < 3; v++) {
    c.beginPath();
    const yb = 300 + v * 480;
    c.moveTo(-40, yb);
    c.bezierCurveTo(300, yb - 160 + Math.sin(t / 1200 + v) * 30, 800, yb + 160, W + 40, yb - 60 + Math.cos(t / 1400 + v * 2) * 30);
    c.stroke();
  }
  c.globalAlpha = 1;

  // word layout
  const { size, lines } = layoutWord(c, W - 220);
  const lineH = size * 1.02;
  const cyBase = H / 2 - ((lines.length - 1) * lineH) / 2 - 40;

  const word = (state.word || "bloom").slice(0, 12);
  const chars = [...(lines.length > 1 ? lines.join("") : word)];
  // per-line draw so wrapped words keep line identity
  let ci = 0;
  lines.forEach((line, li) => {
    c.font = posterFont(line.length > 5 ? size * 0.86 : size); applyVariation(c);
    const squash = (state.wdth / 100) * 0.82;
    const lineW = Math.min(c.measureText(line).width * squash, W - 200);
    const cy = cyBase + li * lineH;
    const cx = W / 2;
    [...line].forEach((ch) => {
      const p = letterAnchor(ci, chars.length, t, cx, cy, Math.max(lineW, 300));
      const age = (now - sproutT0 - ci * 90) / 650;
      const s = elasticOut(clamp(age, 0, 1));
      if (s <= 0.01) { ci++; return; }
      const wob = 0.05 + (state.bloom / 100) * 0.06;
      c.save();
      c.translate(p.x, p.y); c.rotate(p.r); c.scale(s, s);

      // halo pod behind letter (negative-space bloom)
      const haloR = size * 0.52;
      c.globalAlpha = 0.20 + (state.bloom / 100) * 0.14;
      blobPath(c, 0, 0, haloR, wob, t / 900 + ci, 7, ci * 1.7);
      c.fillStyle = INKS[(ci + state.seed) % 3]; c.fill();
      c.globalAlpha = 1;

      // counter-blooms: petals orbiting the glyph
      const petals = 2 + Math.round((state.bloom / 100) * 4);
      const prng = mulberry32(state.seed * 101 + ci * 17);
      for (let k = 0; k < petals; k++) {
        const a = prng() * 6.28 + t / 2200;
        const d = haloR * (0.55 + prng() * 0.5);
        const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.8;
        c.globalAlpha = 0.5;
        blobPath(c, px, py, 12 + prng() * (10 + state.bloom / 6), 0.25, t / 500 + k, 5, k * 2.2);
        c.fillStyle = INKS[(ci + k + 1) % 3]; c.fill();
      }
      c.globalAlpha = 1;

      // the living letter
      const fill = ci % 4 === 3 ? INK : INKS[(ci + state.seed) % 3];
      c.font = posterFont(line.length > 5 ? size * 0.86 : size); applyVariation(c);
      c.textAlign = "center"; c.textBaseline = "middle";
      c.lineWidth = Math.max(2, size * 0.02); c.strokeStyle = PAPER;
      c.strokeText(ch, 0, 0);
      c.fillStyle = fill; c.fillText(ch, 0, 0);
      // glossy echo offset
      c.globalAlpha = 0.25; c.fillStyle = INK;
      c.fillText(ch, 3, 4);
      c.globalAlpha = 1;
      c.restore();
      ci++;
    });
  });

  // drifting spores
  const tS = state.motion ? t : 0;
  for (const s of spores) {
    const y = ((s.y - tS / 1000 * 40 * s.sp) % (H + 80) + H + 80) % (H + 80) - 40;
    const x = s.x + Math.sin(tS / 1300 + s.ph) * 26;
    c.globalAlpha = s.a;
    c.beginPath(); c.arc(x, y, s.r, 0, 6.29); c.fillStyle = s.c; c.fill();
    c.globalAlpha = s.a * 0.9;
    c.beginPath(); c.arc(x - s.r * 0.3, y - s.r * 0.3, s.r * 0.35, 0, 6.29); c.fillStyle = PAPER; c.fill();
  }
  c.globalAlpha = 1;

  // click bursts
  bursts = bursts.filter((b) => now - b.t0 < 1100);
  for (const b of bursts) {
    const k = (now - b.t0) / 1100;
    for (let i = 0; i < 14; i++) {
      const a = b.a[i], d = 30 + k * b.d[i];
      c.globalAlpha = 0.8 * (1 - k);
      c.beginPath(); c.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 4 + 8 * (1 - k), 0, 6.29);
      c.fillStyle = INKS[i % 3]; c.fill();
    }
  }
  c.globalAlpha = 1;

  // caption plate + frame
  c.fillStyle = INK;
  c.fillRect(0, H - 132, W, 132);
  c.fillStyle = PAPER;
  c.font = `700 44px "Fraunces", Georgia, serif`; c.textAlign = "left"; c.textBaseline = "middle";
  c.fillText(`“${word || "bloom"}” — counterform carnival`, 56, H - 84);
  c.font = `600 30px "Roboto Flex", system-ui, sans-serif`; applyVariation(c);
  c.globalAlpha = 0.75;
  c.fillText(`wght ${state.wght} · wdth ${state.wdth} · bloom ${state.bloom} · seed ${state.seed}`, 56, H - 34);
  c.globalAlpha = 1;
  c.lineWidth = 26; c.strokeStyle = INK; c.strokeRect(0, 0, W, H);
  c.restore();
}

// ---- wiring ----
function syncUI() {
  wordInput.value = state.word;
  wghtEl.value = state.wght; wdthEl.value = state.wdth; bloomEl.value = state.bloom;
  wghtVal.textContent = state.wght; wdthVal.textContent = state.wdth; bloomVal.textContent = state.bloom;
  charCount.textContent = `${state.word.length} / 12`;
  captionWord.textContent = `“${state.word || "bloom"}”`;
  captionMeta.textContent = `wght ${state.wght} · wdth ${state.wdth} · seed ${state.seed}`;
  seedLabel.textContent = `seed ${state.seed}`;
  document.querySelectorAll(".seg button").forEach((b) =>
    b.classList.toggle("on", +b.dataset.layout === state.layout));
  motionBtn.textContent = state.motion ? "❚❚ motion on" : "▶ motion off";
  motionBtn.setAttribute("aria-pressed", String(state.motion));
}
function resprout() { sproutT0 = performance.now(); }

wordInput.addEventListener("input", () => {
  state.word = wordInput.value.replace(/[^a-zA-Z'’\- ]/g, "").slice(0, 12) || "";
  charCount.textContent = `${state.word.length} / 12`;
  captionWord.textContent = `“${state.word || "…"}”`;
  resprout(); save();
});
wordInput.addEventListener("change", () => { if (!state.word.trim()) { state.word = "bloom"; syncUI(); } save(); });
wghtEl.addEventListener("input", () => { state.wght = +wghtEl.value; wghtVal.textContent = state.wght; captionMeta.textContent = `wght ${state.wght} · wdth ${state.wdth} · seed ${state.seed}`; save(); });
wdthEl.addEventListener("input", () => { state.wdth = +wdthEl.value; wdthVal.textContent = state.wdth; captionMeta.textContent = `wght ${state.wght} · wdth ${state.wdth} · seed ${state.seed}`; save(); });
bloomEl.addEventListener("input", () => { state.bloom = +bloomEl.value; bloomVal.textContent = state.bloom; reseedSpores(); save(); });
document.querySelectorAll(".seg button").forEach((b) =>
  b.addEventListener("click", () => { state.layout = +b.dataset.layout; resprout(); syncUI(); save(); }));

$("remixBtn").addEventListener("click", () => {
  const r = Math.random;
  state.seed = (Math.random() * 9999) | 0;
  state.wght = 100 + ((r() * 900) | 0);
  state.wdth = 25 + ((r() * 126) | 0);
  state.bloom = (r() * 100) | 0;
  state.layout = (r() * 4) | 0;
  reseedSpores(); resprout(); syncUI(); save();
  const btn = $("remixBtn");
  btn.animate([{ transform: "rotate(0) scale(1)" }, { transform: "rotate(-6deg) scale(1.08)" }, { transform: "rotate(0) scale(1)" }], { duration: 350, easing: "ease-out" });
});
$("diceBtn").addEventListener("click", () => {
  state.word = WORDS[(Math.random() * WORDS.length) | 0];
  resprout(); syncUI(); save();
});
motionBtn.addEventListener("click", () => { state.motion = !state.motion; syncUI(); save(); });

canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
  const rng = Math.random;
  bursts.push({ x, y, t0: performance.now(), a: Array.from({ length: 14 }, () => rng() * 6.28), d: Array.from({ length: 14 }, () => 90 + rng() * 260) });
});

$("exportBtn").addEventListener("click", async () => {
  try { await document.fonts.ready; } catch {}
  const off = document.createElement("canvas");
  off.width = 1500; off.height = 2000;
  const octx = off.getContext("2d");
  octx.scale(1500 / W, 2000 / H);
  render(octx, performance.now(), performance.now());
  const a = document.createElement("a");
  a.download = `counterform-${(state.word || "bloom").replace(/\s+/g, "-").toLowerCase()}.png`;
  a.href = off.toDataURL("image/png");
  a.click();
});

// main loop (frozen time when motion off, still re-render on demand via rAF gate)
let lastT = 0, frozen = null;
function frame(now) {
  const t = state.motion ? now : (frozen ?? (frozen = now));
  if (state.motion) frozen = null;
  if (state.motion || now - lastT > 120) { render(ctx, t, now); lastT = now; }
  requestAnimationFrame(frame);
}

syncUI(); reseedSpores(); resprout();
try { if (document.fonts?.ready) document.fonts.ready.then(() => resprout()); } catch {}
requestAnimationFrame(frame);
console.log("counterform carnival ready");
