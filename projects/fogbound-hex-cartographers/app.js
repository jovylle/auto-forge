// Fogbound Hex Cartographers — click-only cozy charting game.
// ONE interaction type: click. No typing, no dragging, no keyboard.

const COLS = 8, ROWS = 7, HEX = 34;
const SQ3 = Math.sqrt(3);
const LS_KEY = "fogbound-hex-v1";

const TERRAIN = {
  meadow:  { color: "#b9cf8e", glyph: "❀", yield: 2, blurb: "Soft grazing grass. Sheep approve; jam-tarts obligatory." },
  grove:   { color: "#7ba05b", glyph: "♣", yield: 3, blurb: "Old oaks and blackberry shade. Good timber, better naps." },
  pond:    { color: "#9dbfae", glyph: "≈", yield: 3, blurb: "Still duck-pond water. Frogs run the night ferry." },
  bramble: { color: "#b78a9b", glyph: "✕", yield: 1, blurb: "Thorny tangles heavy with berries. Pick with mittens." },
  hollow:  { color: "#c9a86a", glyph: "⌂", yield: 2, blurb: "A snug burrow-hill, warm even in drizzle." },
  apiary:  { color: "#e5b95c", glyph: "⬢", yield: 4, blurb: "Wild hives hum lullabies. Liquid honey-gold." },
};
const TKEYS = Object.keys(TERRAIN);
const PRE = ["Bramble","Honey","Moss","Wren","Thistle","Clover","Puddle","Moon","Fern","Acorn","Dew","Sorrel","Barley","Nettle","Poppy","Tansy"];
const SUF = ["Hollow","Thicket","Meadow","Burrow","Gate","Field","Nook","Hill","Brook","Garden","Rest","Watch","Corner","Fold","Rise","Cote"];
const WANDERERS = [
  { name: "Mabel Pluck", color: "#c98a84" },
  { name: "Tommie Fern", color: "#5c7455" },
  { name: "Old Ash", color: "#8a7bb5" },
  { name: "Pip Sorrel", color: "#d99a2b" },
];

const $ = (id) => document.getElementById(id);
const svg = $("map"), wrap = $("mapWrap");

// ---------- seeded rng ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 974634211) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const id = (q, r) => q + ":" + r;
const key = (q, r) => q + "," + r;

// ---------- state ----------
let S;
function freshState() {
  return { seed: (Math.random() * 1e9) | 0, night: 1, lastDawn: todayStr(),
    charted: {}, claimed: {}, routes: [], log: [], selected: null, nameCards: {}, seq: 0 };
}
function load() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { S = JSON.parse(raw); return; } } catch (e) { /* ignore */ }
  S = freshState();
  const c = centerId();
  S.charted[c] = true;
  S.claimed[c] = { name: "Hearth Meadow", owner: "You", terrain: terrainAt(c) };
  log("You", "lit the first lantern at <b>Hearth Meadow</b>.");
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
function todayStr() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function centerId() { return id((COLS / 2) | 0, (ROWS / 2) | 0); }

// ---------- procedural terrain ----------
function terrainAt(cid) {
  const [q, r] = cid.split(":").map(Number);
  const cx = COLS / 2, cy = ROWS / 2;
  const d = Math.hypot(q - cx, (r - cy) * 1.15) / (COLS / 2);
  const n = hash2(q, r, S.seed % 100000);
  const m = hash2(q * 3 + 1, r * 5 + 2, (S.seed % 100000) + 77);
  if (d > 0.98 && m < 0.45) return "pond";
  return TKEYS[(n * TKEYS.length) | 0];
}
function center(q, r) {
  const x = HEX * SQ3 * (q + r / 2) + 42;
  const y = HEX * 1.5 * r + 44;
  return [x, y];
}
function hexPoints(cx, cy, s) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (30 + 60 * i);
    pts.push((cx + s * Math.cos(a)).toFixed(1) + "," + (cy + s * Math.sin(a)).toFixed(1));
  }
  return pts.join(" ");
}
function neighbors(cid) {
  const [q, r] = cid.split(":").map(Number);
  const off = (r % 2 === 0)
    ? [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]]
    : [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
  return off.map(([dq, dr]) => [q + dq, r + dr])
    .filter(([qq, rr]) => qq >= 0 && rr >= 0 && qq < COLS && rr < ROWS).map(([qq, rr]) => id(qq, rr));
}
function isNear(cid) {
  if (S.charted[cid]) return false;
  return neighbors(cid).some((n) => S.charted[n]);
}
function makeName(rng) {
  const a = PRE[(rng() * PRE.length) | 0];
  let b = SUF[(rng() * SUF.length) | 0];
  return a + " " + b;
}
function drawCards(cid) {
  const rng = mulberry32((S.seed ^ cid.length ^ (++S.seq * 2654435761)) >>> 0);
  const set = new Set();
  while (set.size < 3) set.add(makeName(rng));
  S.nameCards[cid] = [...set];
}

// ---------- log ----------
function log(who, html) {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0"), mm = String(t.getMinutes()).padStart(2, "0");
  S.log.unshift({ who, html, t: hh + ":" + mm });
  S.log = S.log.slice(0, 40);
}

// ---------- render ----------
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function render() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const defs = el("defs", {}, svg);
  const pat = el("pattern", { id: "fogHatch", width: 9, height: 9, patternUnits: "userSpaceOnUse" }, defs);
  el("rect", { width: 9, height: 9, fill: "#e7dfcd" }, pat);
  el("circle", { cx: 2.4, cy: 2.4, r: 1.3, fill: "#cfc3a6" }, pat);
  el("circle", { cx: 6.6, cy: 6.8, r: 1, fill: "#d9cfae" }, pat);

  // routes (under hexes)
  const rlayer = el("g", { id: "rlayer" }, svg);
  S.routes.forEach((rt) => {
    const [q1, r1] = rt.a.split(":").map(Number), [q2, r2] = rt.b.split(":").map(Number);
    const [x1, y1] = center(q1, r1), [x2, y2] = center(q2, r2);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(34, len * 0.22);
    const cxp = mx + (-dy / len) * bow, cyp = my + (dx / len) * bow - 6;
    el("path", { d: `M${x1},${y1} Q${cxp},${cyp} ${x2},${y2}`, class: "route" }, rlayer);
    el("circle", { cx: cxp, cy: cyp, r: 5, class: "lantern-dot" }, rlayer);
  });

  const hlayer = el("g", { id: "hlayer" }, svg);
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const cid = id(q, r);
    const [cx, cy] = center(q, r);
    const charted = !!S.charted[cid], claimed = !!S.claimed[cid];
    const g = el("g", { class: "hex" + (!charted ? (isNear(cid) ? " fogged near" : " fogged deepfog") : (" charted" + (claimed ? " claimed" : ""))) + (S.selected === cid ? " selected" : "") }, hlayer);
    const t = terrainAt(cid);
    const fill = charted ? TERRAIN[t].color : "#e7dfcd";
    el("polygon", { points: hexPoints(cx, cy, HEX - 2), fill, "data-cid": cid }, g);
    if (!charted) {
      const lbl = el("text", { x: cx, y: cy + 7, "text-anchor": "middle", class: "fogq" }, g);
      lbl.textContent = isNear(cid) ? "?" : "·";
    } else {
      const gl = el("text", { x: cx, y: cy - 1, "text-anchor": "middle", class: "tr" }, g);
      gl.textContent = TERRAIN[t].glyph;
      if (claimed) {
        const nm = el("text", { x: cx, y: cy + 13, "text-anchor": "middle", class: "nm" }, g);
        nm.textContent = shortName(S.claimed[cid].name);
        const owner = S.claimed[cid].owner;
        const wc = owner === "You" ? "#d99a2b" : (WANDERERS.find((w) => w.name === owner) || {}).color || "#8a7bb5";
        el("circle", { cx: cx + HEX - 12, cy: cy - HEX + 12, r: 5, fill: wc, class: "pin" }, g);
      }
    }
    g.addEventListener("click", () => onHex(cid));
  }
  renderSide();
  $("nightLabel").textContent = "Night " + S.night;
  const nChart = Object.keys(S.charted).length, nClaim = Object.keys(S.claimed).length;
  $("statCharted").textContent = nChart + "/" + (COLS * ROWS);
  $("statClaimed").textContent = nClaim;
  $("statRoutes").textContent = S.routes.length;
  $("statBaskets").textContent = baskets();
  save();
}
function shortName(n) { return n.length > 14 ? n.slice(0, 13) + "…" : n; }
function baskets() {
  let b = 0;
  for (const cid in S.claimed) b += TERRAIN[S.claimed[cid].terrain].yield;
  b += S.routes.length * 3;
  return b;
}

function renderSide() {
  // satchel
  const box = $("satchel");
  box.innerHTML = "";
  const sel = S.selected && S.claimed[S.selected] ? S.selected : null;
  if (!sel) {
    const p = document.createElement("p"); p.className = "empty";
    p.innerHTML = "No hex selected yet.<br/>Click any claimed hex edged in honey-gold to open it here.";
    box.appendChild(p);
  } else {
    const c = S.claimed[sel];
    const d = document.createElement("div"); d.className = "satchel-body";
    d.innerHTML = `<p class="sname">${escapeHtml(c.name)}</p>
      <p class="smeta">${escapeHtml(c.terrain)} · kept by <b>${escapeHtml(c.owner)}</b> · yields ${TERRAIN[c.terrain].yield} baskets</p>
      <p class="sdesc">${escapeHtml(TERRAIN[c.terrain].blurb)}</p>
      <div class="pillrow"><span class="pill gold">⬢ ${S.routes.filter((r) => r.a === sel || r.b === sel).length} routes</span><span class="pill">${escapeHtml(c.terrain)}</span></div>`;
    box.appendChild(d);
  }
  // name tray
  const tray = $("nameTray");
  tray.innerHTML = "";
  if (sel && S.claimed[sel].owner === "You") {
    if (!S.nameCards[sel]) drawCards(sel);
    S.nameCards[sel].forEach((n) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "name-card";
      b.innerHTML = `<b>${escapeHtml(n)}</b><span>click to christen this hex</span>`;
      b.addEventListener("click", () => {
        S.claimed[sel].name = n;
        log("You", `christened a hex <b>${escapeHtml(n)}</b>.`);
        drawCards(sel); render();
      });
      tray.appendChild(b);
    });
  } else if (sel) {
    const p = document.createElement("p"); p.className = "empty";
    p.textContent = "This hex belongs to " + S.claimed[sel].owner + " — names are theirs to keep.";
    tray.appendChild(p);
  } else {
    const p = document.createElement("p"); p.className = "empty";
    p.textContent = "Select a hex you own to draw name-cards.";
    tray.appendChild(p);
  }
  // routes
  const rl = $("routeList");
  rl.innerHTML = "";
  if (!S.routes.length) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = "No routes stitched yet. Click two claimed hexes.";
    rl.appendChild(li);
  }
  S.routes.forEach((rt, i) => {
    const a = S.claimed[rt.a], b = S.claimed[rt.b];
    if (!a || !b) return;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<span class="rb">⌁ ${escapeHtml(a.name)} ↔ ${escapeHtml(b.name)}</span><small>+3 baskets · click to snip this thread</small>`;
    btn.addEventListener("click", () => {
      S.routes.splice(i, 1);
      log("You", `snipped the route <b>${escapeHtml(a.name)} ↔ ${escapeHtml(b.name)}</b>.`);
      render();
    });
    li.appendChild(btn); rl.appendChild(li);
  });
  // log
  const ll = $("logList");
  ll.innerHTML = "";
  S.log.slice(0, 14).forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="t">${escapeHtml(e.t)}</span><b>${escapeHtml(e.who)}</b> ${e.html}`;
    ll.appendChild(li);
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---------- click-only game logic ----------
function onHex(cid) {
  const hint = $("hint");
  // 1. fogged?
  if (!S.charted[cid]) {
    if (!isNear(cid)) { hint.textContent = "Too deep in fog — chart a glowing ? hex beside your lands first."; nudge(cid); return; }
    S.charted[cid] = true;
    const t = terrainAt(cid);
    log("You", `charted a wild <b>${t}</b> through the mist.`);
    hint.textContent = "Charted! Click it once more to plant your flag and claim it.";
    maybeWanderer();
    render(); return;
  }
  // 2. charted, unclaimed → claim
  if (!S.claimed[cid]) {
    const t = terrainAt(cid);
    const rng = mulberry32((S.seed ^ cid.length ^ (++S.seq * 40503)) >>> 0);
    S.claimed[cid] = { name: makeName(rng), owner: "You", terrain: t };
    S.selected = cid; drawCards(cid);
    log("You", `claimed <b>${escapeHtml(S.claimed[cid].name)}</b> (${t}).`);
    hint.textContent = "Claimed! Pick a truer name from the name-cards, or click another claimed hex to stitch a route.";
    maybeWanderer(); maybeWanderer();
    render(); return;
  }
  // 3. claimed → selection / route stitching
  if (S.selected && S.selected !== cid && S.claimed[S.selected]) {
    const a = S.selected, b = cid;
    const exists = S.routes.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    if (exists) {
      S.routes = S.routes.filter((r) => !((r.a === a && r.b === b) || (r.a === b && r.b === a)));
      log("You", "unpicked a stitched seam.");
      hint.textContent = "Route snipped. Click two claimed hexes to stitch anew.";
    } else {
      S.routes.push({ a, b });
      log("You", `stitched a trade route <b>${escapeHtml(S.claimed[a].name)} ↔ ${escapeHtml(S.claimed[b].name)}</b> (+3 baskets).`);
      hint.textContent = "Route stitched — honey and letters will travel it by dusk.";
    }
    S.selected = null;
    render(); return;
  }
  S.selected = (S.selected === cid) ? null : cid;
  hint.textContent = S.selected
    ? `${S.claimed[cid].name} rests in your satchel. Click a second claimed hex to stitch a trade route.`
    : "Satchel closed. Click a claimed hex to open it.";
  render();
}
function nudge(cid) {
  const poly = svg.querySelector(`polygon[data-cid="${cid}"]`);
  if (!poly || !poly.animate) return;
  poly.animate([{ transform: "translateX(0)" }, { transform: "translateX(4px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }], { duration: 220 });
}
function maybeWanderer() {
  if (Math.random() > 0.38) return;
  const free = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const c = id(q, r);
    if (S.charted[c] && !S.claimed[c]) free.push(c);
  }
  if (!free.length) return;
  const pick = free[(Math.random() * free.length) | 0];
  const w = WANDERERS[(Math.random() * WANDERERS.length) | 0];
  const rng = Math.random;
  S.claimed[pick] = { name: makeName(rng), owner: w.name, terrain: terrainAt(pick) };
  log(w.name, `wandered in and claimed <b>${escapeHtml(S.claimed[pick].name)}</b>.`);
}

// ---------- nightly reshuffle ----------
function sleepTillDawn(manual) {
  wrap.classList.remove("nightfall");
  void wrap.offsetWidth;
  wrap.classList.add("nightfall");
  window.setTimeout(() => {
    S.night += 1; S.lastDawn = todayStr(); S.selected = null;
    const rng = mulberry32((S.seed + S.night * 1013904223) >>> 0);
    S.seed = (S.seed + S.night * 7919) % 1000000007;
    // unclaimed chartings drift: 55% re-fog; a couple of wanderer claims appear
    for (const cid in S.charted) {
      if (S.claimed[cid]) continue;
      if (rng() < 0.55) delete S.charted[cid];
    }
    if (!Object.keys(S.charted).length) S.charted[centerId()] = true;
    // drop routes touching nothing (claims persist, so rarely)
    S.routes = S.routes.filter((r) => S.claimed[r.a] && S.claimed[r.b]);
    const w = WANDERERS[(rng() * WANDERERS.length) | 0];
    log("Night bell", `dawn of <b>Night ${S.night}</b> — the fog re-knit itself. Claims held fast.`);
    // wanderer night claim
    const free = [];
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
      const c = id(q, r);
      if (S.charted[c] && !S.claimed[c]) free.push(c);
    }
    if (free.length && rng() < 0.8) {
      const pick = free[(rng() * free.length) | 0];
      S.claimed[pick] = { name: makeName(rng), owner: w.name, terrain: terrainAt(pick) };
      log(w.name, `claimed <b>${escapeHtml(S.claimed[pick].name)}</b> in the night mist.`);
    }
    $("hint").textContent = manual
      ? "You rang the bell and slept. Dawn re-knit the fog — unclaimed chartings may have drifted."
      : "Dawn arrived on its own. The fog has reshuffled.";
    S.nameCards = {};
    render();
  }, manual ? 900 : 400);
}
function tickDawn() {
  const now = new Date(), mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  let s = Math.max(0, ((mid - now) / 1000) | 0);
  const h = String((s / 3600) | 0).padStart(2, "0"), m = String(((s % 3600) / 60) | 0).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
  $("dawnIn").textContent = `${h}:${m}:${ss}`;
  if (S.lastDawn !== todayStr()) sleepTillDawn(false);
}

// ---------- buttons (all clicks) ----------
$("bellBtn").addEventListener("click", () => sleepTillDawn(true));
$("rerollBtn").addEventListener("click", () => {
  if (S.selected && S.claimed[S.selected] && S.claimed[S.selected].owner === "You") {
    drawCards(S.selected); render();
    $("hint").textContent = "Fresh name-cards drawn. Click one to christen the hex.";
  } else $("hint").textContent = "First click a hex you own, then draw fresh name-cards.";
});
$("anewBtn").addEventListener("click", () => {
  S = freshState();
  const c = centerId();
  S.charted[c] = true;
  S.claimed[c] = { name: "Hearth Meadow", owner: "You", terrain: terrainAt(c) };
  log("You", "unrolled a <b>brand-new chart</b> and lit the hearth lantern.");
  $("hint").textContent = "A fresh chart! Click a glowing fog hex to begin charting.";
  render();
});

load();
render();
window.setInterval(tickDawn, 1000);
tickDawn();
console.log("fogbound hex cartographers ready — click only");
