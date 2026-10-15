// Fennel Shrew Pharmacy — glassmorphism tincture brewer
// Vanilla JS, no deps. System fonts only. Works from file://.

const INGREDIENTS = [
  { id: "fennel",   name: "Fennel Seed",    emoji: "🌿", color: [126, 200, 80],  note: "sweet anise",  effect: "Soothing",     adj: ["Verdant", "Feathery", "Aniseed"] },
  { id: "honey",    name: "Golden Honey",   emoji: "🍯", color: [242, 177, 52],  note: "warm amber",   effect: "Restorative",  adj: ["Golden", "Amber", "Honeyed"] },
  { id: "ember",    name: "Ember Root",     emoji: "🔥", color: [228, 87, 46],   note: "smoked chili", effect: "Warming",      adj: ["Embered", "Kindled", "Fiery"] },
  { id: "moon",     name: "Moonpetal",      emoji: "🌸", color: [155, 140, 242], note: "night florals", effect: "Dreamy",      adj: ["Lunar", "Petal-soft", "Moonlit"] },
  { id: "dewcap",   name: "Dewcap",         emoji: "🍄", color: [79, 209, 197],  note: "forest rain",  effect: "Clarifying",   adj: ["Dewy", "Misty", "Rainwashed"] },
  { id: "inkberry", name: "Inkberry",       emoji: "🫐", color: [72, 58, 150],   note: "dark violet",  effect: "Mysterious",   adj: ["Inky", "Velvety", "Nocturnal"] },
];

const BASES = [
  { id: "spring", name: "💧 Spring Water", lighten: 0.35, sat: 0.75, noun: "Tonic" },
  { id: "syrup",  name: "🍯 Honey Syrup",  lighten: 0.08, sat: 0.95, noun: "Syrup" },
  { id: "spirit", name: "🌙 Moon Spirit",  lighten: 0.0,  sat: 1.25, noun: "Elixir" },
];

const MAX_DROPS = 12;
const LS_BREWED = "fennel-shrew-brewed";
const LS_SHELF = "fennel-shrew-shelf";

const $ = (id) => document.getElementById(id);
const state = { base: "spring", drops: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 0])) };
let currentPotion = null; // { name, rgb, hex, potency, notes, effect, recipe }
let bubbles = [];
let fizz = 0; // extra bubble energy right after brewing

/* ---------- helpers ---------- */
function totalDrops() { return Object.values(state.drops).reduce((a, b) => a + b, 0); }
function rgbStr([r, g, b]) { return `rgb(${r|0},${g|0},${b|0})`; }
function hexStr([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
}
function mixColor() {
  const base = BASES.find((b) => b.id === state.base);
  const total = totalDrops();
  if (!total) return { rgb: [38, 34, 64], empty: true };
  let r = 0, g = 0, b = 0;
  for (const ing of INGREDIENTS) {
    const w = state.drops[ing.id] / total;
    r += ing.color[0] * w; g += ing.color[1] * w; b += ing.color[2] * w;
  }
  // apply base transform around mid-gray for lighten, scale distance for saturation
  const L = base.lighten * 60;
  const mean = (r + g + b) / 3;
  r = mean + (r - mean) * base.sat + L;
  g = mean + (g - mean) * base.sat + L;
  b = mean + (b - mean) * base.sat + L;
  return { rgb: [r, g, b], empty: false };
}

/* ---------- potion analysis ---------- */
function analyze() {
  const total = totalDrops();
  const { rgb, empty } = mixColor();
  if (empty || !total) return null;
  const ranked = [...INGREDIENTS].sort((a, b) => state.drops[b.id] - state.drops[a.id]);
  const top = ranked[0];
  const second = ranked[1] && state.drops[ranked[1].id] > 0 ? ranked[1] : null;
  const base = BASES.find((b) => b.id === state.base);
  const adj = top.adj[(total + state.drops[top.id]) % top.adj.length];
  const name = `${adj} ${second ? second.effect.toLowerCase() + "-" : ""}${top.effect} ${base.noun}`;
  const potency = Math.min(100, Math.round((total / (INGREDIENTS.length * MAX_DROPS)) * 100 * (state.base === "spirit" ? 1.25 : 1)));
  const rank = potency >= 80 ? "★★★ apothecary-grade" : potency >= 50 ? "★★ worthy draught" : potency >= 25 ? "★★ gentle sipper" : "★ whisper of flavor";
  const notes = [top.note, second ? second.note : null, base.id === "syrup" ? "silky finish" : base.id === "spirit" ? "tingling finish" : "crisp finish"]
    .filter(Boolean).join(" · ");
  return { name, rgb, hex: hexStr(rgb), potency, rank, notes, effect: top.effect,
    recipe: { base: state.base, drops: { ...state.drops } } };
}

/* ---------- canvas flask ---------- */
const canvas = $("flask");
const ctx = canvas.getContext("2d");
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

function spawnBubble(rgb, n = 1) {
  for (let i = 0; i < n; i++) {
    bubbles.push({ x: 120 + Math.random() * 120, y: 300 + Math.random() * 40,
      r: 2 + Math.random() * 6, vy: 0.6 + Math.random() * 1.6, wob: Math.random() * Math.PI * 2 });
  }
  if (bubbles.length > 140) bubbles = bubbles.slice(-140);
}

function drawFlask(t) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const col = currentPotion ? currentPotion.rgb : [38, 34, 64];
  const lite = currentPotion ? currentPotion.hex : "#262240";

  // cork + neck
  ctx.fillStyle = "#8a5a33";
  ctx.beginPath(); ctx.roundRect(158, 18, 44, 26, 6); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath(); ctx.roundRect(150, 48, 60, 66, 8); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(150, 48, 60, 66, 8); ctx.stroke();

  // round body
  const cx = 180, cy = 268, R = 118;
  const grad = ctx.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, R + 10);
  grad.addColorStop(0, "rgba(255,255,255,0.20)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(255,255,255,0.14)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // liquid (clipped circle, animated wave top)
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, Math.PI * 2); ctx.clip();
  const lgrad = ctx.createLinearGradient(0, 150, 0, 390);
  lgrad.addColorStop(0, rgbStr(col.map((v) => v + 40)));
  lgrad.addColorStop(1, rgbStr(col.map((v) => v * 0.55)));
  ctx.fillStyle = lgrad;
  const level = currentPotion ? 218 : 330;
  ctx.beginPath();
  ctx.moveTo(cx - R, H);
  ctx.lineTo(cx - R, level);
  for (let x = cx - R; x <= cx + R; x += 6) {
    ctx.lineTo(x, level + Math.sin(x / 22 + t / 450) * 6 + Math.sin(x / 9 - t / 300) * 2.5);
  }
  ctx.lineTo(cx + R, H); ctx.closePath(); ctx.fill();

  // glow motes inside
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < 12; i++) {
    const mx = cx + Math.sin(i * 2.3 + t / 900) * 80;
    const my = 240 + ((i * 37 + t / 22) % 130);
    ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t / 300 + i);
    ctx.beginPath(); ctx.arc(mx, my, 1.6 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // bubbles
  for (const p of bubbles) {
    p.y -= p.vy * (1 + fizz * 2); p.wob += 0.05;
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x + Math.sin(p.wob) * 6, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath(); ctx.arc(p.x + Math.sin(p.wob) * 6 - p.r / 3, p.y - p.r / 3, p.r / 3, 0, Math.PI * 2); ctx.fill();
  }
  bubbles = bubbles.filter((p) => p.y > 150);
  ctx.restore();

  // glass highlight
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, R - 18, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();

  // shrew label
  ctx.fillStyle = "rgba(245,240,220,0.92)";
  ctx.beginPath(); ctx.roundRect(cx - 62, cy - 26, 124, 56, 10); ctx.fill();
  ctx.strokeStyle = "rgba(120,90,40,0.6)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#4a3418"; ctx.textAlign = "center";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText("🐭 SHREW & Co.", cx, cy - 6);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(currentPotion ? currentPotion.effect.toUpperCase() + " · №" + (currentPotion.potency || 0) : "EST. 1892", cx, cy + 12);
  void lite;
  fizz = Math.max(0, fizz - 0.008);
  requestAnimationFrame(drawFlask);
}
requestAnimationFrame(drawFlask);
setInterval(() => { if (currentPotion) spawnBubble(currentPotion.rgb, 1); }, 500);

/* ---------- bench UI ---------- */
function renderBases() {
  const wrap = $("basePills");
  wrap.innerHTML = "";
  for (const b of BASES) {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = b.name;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-pressed", String(state.base === b.id));
    btn.addEventListener("click", () => { state.base = b.id; renderBases(); preview(); });
    wrap.appendChild(btn);
  }
}

function renderIngredients() {
  const wrap = $("ingredients");
  wrap.innerHTML = "";
  for (const ing of INGREDIENTS) {
    const row = document.createElement("div");
    row.className = "ing" + (state.drops[ing.id] > 0 ? " active" : "");
    row.style.setProperty("--dot", rgbStr(ing.color));
    row.innerHTML = `
      <span class="ing-dot" aria-hidden="true">${ing.emoji}</span>
      <span class="ing-info"><b>${ing.name}</b><small>${ing.note} · ${ing.effect.toLowerCase()}</small></span>`;
    const st = document.createElement("div");
    st.className = "stepper";
    const minus = document.createElement("button");
    minus.textContent = "−"; minus.setAttribute("aria-label", `Less ${ing.name}`);
    const out = document.createElement("output");
    out.textContent = `${state.drops[ing.id]} 💧`;
    const plus = document.createElement("button");
    plus.textContent = "+"; plus.setAttribute("aria-label", `More ${ing.name}`);
    minus.addEventListener("click", () => { state.drops[ing.id] = Math.max(0, state.drops[ing.id] - 1); renderIngredients(); preview(); });
    plus.addEventListener("click", () => {
      state.drops[ing.id] = Math.min(MAX_DROPS, state.drops[ing.id] + 1);
      spawnBubble(ing.color, 3);
      renderIngredients(); preview();
    });
    st.append(minus, out, plus);
    row.appendChild(st);
    wrap.appendChild(row);
  }
  const n = totalDrops();
  $("dropHint").textContent = `${n} drop${n === 1 ? "" : "s"}${n < 1 ? " · add at least 1 drop to brew" : n > 40 ? " · the shrew raises an eyebrow…" : " · looking brewable"}`;
}

/* live preview: tint flask without committing stats */
function preview() {
  if (!currentPotion) {
    const { rgb, empty } = mixColor();
    if (!empty) currentPotion = { name: "", rgb, hex: hexStr(rgb), potency: 0, preview: true };
  } else if (currentPotion.preview) {
    const { rgb, empty } = mixColor();
    if (empty) currentPotion = null;
    else { currentPotion.rgb = rgb; currentPotion.hex = hexStr(rgb); }
  } else {
    // a committed potion exists — still re-tint if user edits after brewing
    const { rgb, empty } = mixColor();
    if (!empty) { currentPotion.rgb = rgb; currentPotion.hex = hexStr(rgb); paintMeta(); }
  }
}

/* ---------- brew ---------- */
function brew(fromShare = false) {
  const p = analyze();
  if (!p) { toast("Add at least one drop first 🌿"); return; }
  currentPotion = p;
  fizz = 1;
  spawnBubble(p.rgb, 26);
  $("flask").parentElement.classList.remove("shake");
  void $("flask").offsetWidth;
  $("flask").parentElement.classList.add("shake");
  paintMeta();
  const n = (parseInt(localStorage.getItem(LS_BREWED) || "0", 10) + 1);
  localStorage.setItem(LS_BREWED, String(n));
  $("statBrewed").textContent = n;
  $("statPotency").textContent = p.potency;
  if (!fromShare) writeHash();
  toast(`Brewed “${p.name}” ${p.rank.includes("★★★") ? "✨" : "🍶"}`);
}

function paintMeta() {
  const p = currentPotion;
  if (!p) return;
  $("potionName").textContent = p.name || "Untitled hovering mixture";
  $("swatch").style.background = p.hex;
  $("hexCode").textContent = p.hex;
  $("potencyBadge").textContent = p.potency >= 80 ? "potent" : p.potency >= 50 ? "sturdy" : p.potency >= 25 ? "gentle" : "whisper";
  $("notes").textContent = p.notes || "";
  $("meterFill").style.width = p.potency + "%";
}

/* ---------- share / export ---------- */
function encodeRecipe() {
  const order = INGREDIENTS.map((i) => state.drops[i.id]);
  const payload = { b: state.base, d: order };
  return btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function decodeRecipe(s) {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  const obj = JSON.parse(atob(b64));
  if (!obj || !Array.isArray(obj.d) || obj.d.length !== INGREDIENTS.length) throw new Error("bad recipe");
  if (!BASES.some((b) => b.id === obj.b)) throw new Error("bad base");
  return obj;
}
function writeHash() {
  history.replaceState(null, "", "#r=" + encodeRecipe());
}
function loadHash() {
  if (!location.hash.startsWith("#r=")) return false;
  try {
    const obj = decodeRecipe(location.hash.slice(3));
    state.base = obj.b;
    INGREDIENTS.forEach((ing, i) => { state.drops[ing.id] = Math.max(0, Math.min(MAX_DROPS, obj.d[i] | 0)); });
    return true;
  } catch { return false; }
}

$("brewBtn").addEventListener("click", () => brew());
$("surpriseBtn").addEventListener("click", () => {
  state.base = BASES[(Math.random() * BASES.length) | 0].id;
  const picks = 2 + ((Math.random() * 3) | 0);
  Object.keys(state.drops).forEach((k) => (state.drops[k] = 0));
  for (let i = 0; i < picks; i++) {
    const ing = INGREDIENTS[(Math.random() * INGREDIENTS.length) | 0];
    state.drops[ing.id] = Math.min(MAX_DROPS, state.drops[ing.id] + 1 + ((Math.random() * 5) | 0));
  }
  renderBases(); renderIngredients(); brew();
});
$("resetBtn").addEventListener("click", () => {
  Object.keys(state.drops).forEach((k) => (state.drops[k] = 0));
  currentPotion = null; paintMetaReset(); renderIngredients();
  $("dropHint").textContent = "0 drops · add at least 1 drop to brew";
  history.replaceState(null, "", location.pathname);
});
function paintMetaReset() {
  $("potionName").textContent = "Empty flask — awaiting inspiration";
  $("swatch").style.background = "#222";
  $("hexCode").textContent = "#000000";
  $("potencyBadge").textContent = "–";
  $("notes").textContent = "";
  $("meterFill").style.width = "0%";
}

$("copyBtn").addEventListener("click", async () => {
  if (!currentPotion || currentPotion.preview) brew(true);
  writeHash();
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast("Recipe link copied! 🔗"); }
  catch {
    prompt("Copy your recipe link:", url);
  }
});

$("jsonBtn").addEventListener("click", () => {
  if (!currentPotion || currentPotion.preview) brew(true);
  const blob = new Blob([JSON.stringify({ name: currentPotion.name, ...currentPotion.recipe,
    color: currentPotion.hex, potency: currentPotion.potency, notes: currentPotion.notes,
    brewedBy: "Fennel Shrew Pharmacy" }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "shrew-tincture.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Recipe JSON downloaded ⬇️");
});

$("pngBtn").addEventListener("click", () => {
  if (!currentPotion || currentPotion.preview) brew(true);
  const p = currentPotion;
  const c = document.createElement("canvas");
  c.width = 720; c.height = 880;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 720, 880);
  bg.addColorStop(0, "#241d4d"); bg.addColorStop(1, "#0f2b2b");
  g.fillStyle = bg; g.fillRect(0, 0, 720, 880);
  g.drawImage(canvas, 60, 60, 600, 700);
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.font = "800 44px system-ui, sans-serif"; g.textAlign = "center";
  g.fillText("🐭 " + p.name, 360, 810);
  g.font = "28px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillText(`${p.hex} · potency ${p.potency} · ${p.notes}`, 360, 848);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = "shrew-tincture.png";
  a.click();
  toast("Potion card PNG saved 🖼️");
});

/* ---------- shelf (localStorage) ---------- */
function getShelf() {
  try { return JSON.parse(localStorage.getItem(LS_SHELF) || "[]"); } catch { return []; }
}
function setShelf(s) { localStorage.setItem(LS_SHELF, JSON.stringify(s)); }
function renderShelf() {
  const shelf = getShelf();
  const ul = $("shelf");
  ul.innerHTML = "";
  $("shelfCount").textContent = `(${shelf.length})`;
  $("statShelved").textContent = shelf.length;
  $("emptyShelf").style.display = shelf.length ? "none" : "";
  shelf.forEach((item, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="mini"></span>
      <span class="shelf-name"><b></b><small></small></span>`;
    li.querySelector(".mini").style.background = `linear-gradient(180deg, ${item.hex}, rgba(0,0,0,0.4))`;
    li.querySelector("b").textContent = item.name;
    li.querySelector("small").textContent = `${item.hex} · potency ${item.potency}`;
    const load = document.createElement("button");
    load.className = "icon-btn"; load.textContent = "brew";
    load.setAttribute("aria-label", `Re-brew ${item.name}`);
    load.addEventListener("click", () => {
      state.base = item.recipe.base;
      Object.assign(state.drops, item.recipe.drops);
      renderBases(); renderIngredients(); brew();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const del = document.createElement("button");
    del.className = "icon-btn del"; del.textContent = "✕";
    del.setAttribute("aria-label", `Remove ${item.name}`);
    del.addEventListener("click", () => {
      const s = getShelf(); s.splice(idx, 1); setShelf(s); renderShelf(); toast("Removed from shelf");
    });
    li.append(load, del);
    ul.appendChild(li);
  });
}
$("shelfBtn").addEventListener("click", () => {
  if (!currentPotion || currentPotion.preview) brew(true);
  const p = currentPotion;
  const shelf = getShelf();
  shelf.unshift({ name: p.name, hex: p.hex, potency: p.potency, recipe: p.recipe, at: Date.now() });
  setShelf(shelf.slice(0, 24));
  renderShelf();
  toast("Shelved! 📚");
});
$("clearShelfBtn").addEventListener("click", () => {
  setShelf([]); renderShelf(); toast("Shelf cleared");
});

/* ---------- init ---------- */
(function init() {
  const fromLink = loadHash();
  renderBases(); renderIngredients(); renderShelf();
  $("statBrewed").textContent = localStorage.getItem(LS_BREWED) || "0";
  if (fromLink && totalDrops() > 0) brew(true);
  else preview();
})();
