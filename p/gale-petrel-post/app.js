/* GALE PETREL POST — localStorage-only exchange logic */
"use strict";
const KEY = "gpp-state-v1";
const KANJI = ["嵐", "燕", "風", "波", "雷", "雲", "潮", "灯"];
const STAGES = ["nest", "aloft", "landfall", "delivered"];
const STAGE_JP = { nest: "巣 NEST", aloft: "飛 ALOFT", landfall: "陸 LANDFALL", delivered: "配達 DONE", lost: "喪失 LOST" };

function seed() {
  return {
    routes: [
      { id: "r1", name: "Kuroshio Gale Run", kanji: "黒", wind: 72, risk: 4, dist: 410, status: "OPEN" },
      { id: "r2", name: "Kitsune Crosswind", kanji: "狐", wind: 48, risk: 2, dist: 180, status: "OPEN" },
      { id: "r3", name: "Foxfire Trench Haul", kanji: "火", wind: 88, risk: 5, dist: 640, status: "GUST" },
      { id: "r4", name: "Lantern Reef Drift", kanji: "灯", wind: 34, risk: 1, dist: 120, status: "OPEN" }
    ],
    petrels: [
      { id: "p1", name: "Sora-3", mark: "空", wing: 46, flights: 21, status: "aloft" },
      { id: "p2", name: "Umi-1", mark: "海", wing: 39, flights: 12, status: "roost" },
      { id: "p3", name: "Kaze-9", mark: "風", wing: 51, flights: 34, status: "aloft" },
      { id: "p4", name: "Yoru-2", mark: "夜", wing: 35, flights: 4, status: "moult" }
    ],
    parcels: [
      { id: "GPP-1042", to: "Lantern Keeper, Iso Rock", routeId: "r1", petrelId: "p1", prio: "typhoon", stage: "aloft", created: Date.now() - 86400000 },
      { id: "GPP-1043", to: "Tea Widow, Cape Shio", routeId: "r2", petrelId: "p3", prio: "squall", stage: "landfall", created: Date.now() - 43000000 },
      { id: "GPP-1044", to: "Drum Maker, Back Alley 9", routeId: "r4", petrelId: "p2", prio: "kamikaze", stage: "nest", created: Date.now() - 3600000 }
    ],
    flights: [
      { t: Date.now() - 80000000, text: "Sora-3 cleared the harbour wall with 2 parcels" },
      { t: Date.now() - 40000000, text: "Kaze-9 rode the Foxfire gust to landfall" }
    ],
    seq: 1045
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    const s = JSON.parse(raw);
    if (!s.routes || !s.petrels || !s.parcels) throw new Error("bad shape");
    return s;
  } catch (e) {
    const s = seed();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
    return s;
  }
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} }

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let routeSort = "wind";
let trackFilter = "all";

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2400);
}
function stamp(word) {
  $("stampWord").textContent = word;
  const f = $("stampFlash");
  f.classList.remove("show");
  void f.offsetWidth;
  f.classList.add("show");
}
function log(text) {
  S.flights.unshift({ t: Date.now(), text });
  S.flights = S.flights.slice(0, 30);
}
function routeById(id) { return S.routes.find((r) => r.id === id); }
function petrelById(id) { return S.petrels.find((p) => p.id === id); }
function timeAgo(t) {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 48) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}

/* ---------- GALE ROUTES ---------- */
function renderRoutes() {
  const list = $("routeList");
  const arr = [...S.routes].sort((a, b) =>
    routeSort === "wind" ? b.wind - a.wind : routeSort === "risk" ? b.risk - a.risk : b.dist - a.dist);
  if (!arr.length) { list.innerHTML = '<p class="empty">No corridors charted. The sky is blank — pin a route.</p>'; }
  else {
    list.innerHTML = arr.map((r) => {
      const n = S.parcels.filter((p) => p.routeId === r.id && p.stage !== "delivered" && p.stage !== "lost").length;
      const bars = [1, 2, 3, 4, 5].map((i) =>
        `<i class="${i <= r.risk ? "on" + (r.risk >= 4 ? "" : " mid") : ""}"></i>`).join("");
      return `<article class="route-card" role="listitem">
        <div class="route-top"><span class="route-kanji">${esc(r.kanji)}</span>
        <span class="route-wind">≋ ${r.wind}kt · ${r.dist}km</span></div>
        <h3>${esc(r.name)}</h3>
        <p class="route-meta">RISK ${r.risk}/5 · ${n} parcel${n === 1 ? "" : "s"} riding</p>
        <div class="riskbar" aria-hidden="true">${bars}</div>
        <button class="statusbtn" data-act="cycle" data-id="${r.id}" data-s="${r.status}" title="Cycle status">${r.status === "OPEN" ? "● OPEN" : r.status === "GUST" ? "▲ GUSTING" : "■ LOCKED"}</button>
        <div class="rowbtns">
          <button class="mini" data-act="dispatch" data-id="${r.id}">+ dispatch</button>
          <button class="mini ghost" data-act="delroute" data-id="${r.id}" aria-label="Delete ${esc(r.name)}">✕</button>
        </div>
      </article>`;
    }).join("");
  }
  // parcel form selects
  $("parcelRoute").innerHTML = S.routes.map((r) =>
    `<option value="${r.id}">${esc(r.name)} · ${r.wind}kt</option>`).join("") || "<option value=''>—</option>";
  renderStats();
}

/* ---------- PETREL LOG ---------- */
function renderPetrels() {
  const list = $("petrelList");
  list.innerHTML = S.petrels.map((p) => {
    const carrying = S.parcels.filter((x) => x.petrelId === p.id && (x.stage === "aloft" || x.stage === "nest")).length;
    return `<article class="petrel-card ${p.status === "aloft" ? "aloft" : ""}" role="listitem">
      <div class="petrel-top">
        <span class="petrel-mark" aria-hidden="true">${esc(p.mark || "燕")}</span>
        <div><h3>${esc(p.name)}</h3><p class="petrel-sub">WING ${p.wing}cm · ${p.flights} flights · ${carrying} carrying</p></div>
      </div>
      <div class="petrel-stat"><span class="badge ${p.status}">${p.status === "roost" ? "○ ROOST" : p.status === "aloft" ? "▲ ALOFT" : "✕ MOULT"}</span>
      <span>羽 ${"▮".repeat(Math.min(6, Math.ceil(p.flights / 6)))}${"▯".repeat(Math.max(0, 6 - Math.ceil(p.flights / 6)))}</span></div>
      <div class="rowbtns">
        <button class="mini" data-act="fly" data-id="${p.id}">${p.status === "aloft" ? "roost ↓" : "aloft ↑"}</button>
        <button class="mini" data-act="stampflight" data-id="${p.id}">+ flight</button>
        <button class="mini ghost" data-act="delpetrel" data-id="${p.id}" aria-label="Release ${esc(p.name)}">✕</button>
      </div>
    </article>`;
  }).join("") || '<p class="empty">No birds banded. The roost is empty.</p>';
  $("parcelPetrel").innerHTML = S.petrels.map((p) =>
    `<option value="${p.id}">${esc(p.name)} · ${p.status}</option>`).join("") || "<option value=''>—</option>";
  $("flightCount").textContent = `· ${S.flights.length} entries`;
  $("flightLog").innerHTML = S.flights.map((f) =>
    `<li><b>${timeAgo(f.t)}</b> — ${esc(f.text)}</li>`).join("") || "<li>No flights logged yet.</li>";
  renderStats();
}

/* ---------- POST TRACKER ---------- */
function renderParcels() {
  const q = ($("trackSearch").value || "").toLowerCase().trim();
  const list = $("parcelList");
  const arr = S.parcels.filter((p) =>
    (trackFilter === "all" || p.stage === trackFilter) &&
    (!q || p.id.toLowerCase().includes(q) || p.to.toLowerCase().includes(q))).sort((a, b) => b.created - a.created);
  if (!arr.length) { list.innerHTML = '<p class="empty">No parcels on this wind. Frank one above, or loosen the filter.</p>'; return; }
  list.innerHTML = arr.map((p) => {
    const r = routeById(p.routeId);
    const b = petrelById(p.petrelId);
    const idx = STAGES.indexOf(p.stage);
    const pipe = STAGES.map((s, i) =>
      `<i class="${p.stage === "lost" ? (i <= 1 ? "hit" : "") : i <= idx ? "hit" : ""}">${STAGE_JP[s]}</i>`).join("") +
      (p.stage === "lost" ? `<i class="hit">${STAGE_JP.lost}</i>` : "");
    const next = p.stage === "nest" ? "aloft" : p.stage === "aloft" ? "landfall" : p.stage === "landfall" ? "delivered" : null;
    return `<article class="parcel" data-st="${p.stage}">
      <div><p class="parcel-id">${esc(p.id)} · ${esc(p.prio.toUpperCase())}</p>
        <h3>→ ${esc(p.to)}</h3>
        <p class="parcel-sub">${esc(r ? r.name : "?")} · bird ${esc(b ? b.name : "?")} · ${timeAgo(p.created)}</p>
        <div class="pipe">${pipe}</div></div>
      <div></div>
      <div class="parcel-actions">
        ${next ? `<button class="abtn" data-act="advance" data-id="${esc(p.id)}">stamp → ${STAGE_JP[next].split(" ")[1] || next}</button>` : ""}
        ${p.stage !== "delivered" && p.stage !== "lost" ? `<button class="abtn lost" data-act="lose" data-id="${esc(p.id)}">lost to gale</button>` : ""}
        ${p.stage === "lost" ? `<button class="abtn" data-act="retry" data-id="${esc(p.id)}">re-fly ↻</button>` : ""}
        <button class="abtn lost" data-act="delparcel" data-id="${esc(p.id)}" aria-label="Burn record ${esc(p.id)}">burn ✕</button>
      </div>
    </article>`;
  }).join("");
  renderStats();
}

function renderStats() {
  const live = S.parcels.filter((p) => p.stage === "aloft" || p.stage === "nest" || p.stage === "landfall").length;
  $("statAloft").textContent = live;
  $("statDone").textContent = S.parcels.filter((p) => p.stage === "delivered").length;
  $("statLost").textContent = S.parcels.filter((p) => p.stage === "lost").length;
  $("statRoutes").textContent = S.routes.filter((r) => r.status !== "LOCKED").length + "/" + S.routes.length;
  $("statBirds").textContent = S.petrels.filter((p) => p.status === "aloft").length;
  $("windNow").textContent = S.routes.length ? Math.max(...S.routes.map((r) => r.wind)) : 0;
}

/* ---------- EVENTS ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  const pill = e.target.closest(".pills button");
  if (pill) {
    document.querySelectorAll(".pills button").forEach((x) => x.classList.remove("on"));
    pill.classList.add("on");
    trackFilter = pill.dataset.f;
    renderParcels();
    return;
  }
  if (!b) return;
  const { act, id } = b.dataset;
  if (act === "cycle") {
    const r = routeById(id);
    r.status = r.status === "OPEN" ? "GUST" : r.status === "GUST" ? "LOCKED" : "OPEN";
    save(); renderRoutes();
    toast(`${r.name}: now ${r.status}`);
  } else if (act === "delroute") {
    S.routes = S.routes.filter((r) => r.id !== id);
    save(); renderRoutes(); renderParcels();
    toast("Route struck from the chart.");
  } else if (act === "dispatch") {
    const r = routeById(id);
    if (!S.petrels.length) { toast("No petrels to carry it — band a bird first."); return; }
    const bird = S.petrels.find((p) => p.status !== "moult") || S.petrels[0];
    S.parcels.unshift({ id: "GPP-" + (S.seq++), to: "Waystation via " + r.name, routeId: r.id, petrelId: bird.id, prio: "squall", stage: "nest", created: Date.now() });
    log(`${bird.name} took a parcel for ${r.name}`);
    save(); renderRoutes(); renderPetrels(); renderParcels();
    toast(`Parcel franked on ${r.name} — bird ${bird.name}.`);
    document.getElementById("tracker").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (act === "fly") {
    const p = petrelById(id);
    p.status = p.status === "aloft" ? "roost" : "aloft";
    log(`${p.name} ${p.status === "aloft" ? "lifted into the gale" : "folded wings at the roost"}`);
    save(); renderPetrels();
  } else if (act === "stampflight") {
    const p = petrelById(id);
    p.flights += 1;
    log(`${p.name} logged flight no. ${p.flights}`);
    save(); renderPetrels();
    toast(`${p.name}: flight ${p.flights} stamped.`);
  } else if (act === "delpetrel") {
    S.petrels = S.petrels.filter((p) => p.id !== id);
    save(); renderPetrels(); renderParcels();
    toast("Bird released to the wild.");
  } else if (act === "advance") {
    const p = S.parcels.find((x) => x.id === id);
    const order = ["nest", "aloft", "landfall", "delivered"];
    p.stage = order[order.indexOf(p.stage) + 1];
    const bird = petrelById(p.petrelId);
    if (p.stage === "delivered") {
      stamp("配達 DELIVERED");
      if (bird) bird.flights += 1;
      log(`${p.id} delivered to ${p.to}${bird ? " by " + bird.name : ""}`);
      toast(`${p.id} delivered. The stamp slams!`);
    } else {
      log(`${p.id} stamped → ${p.stage}`);
      toast(`${p.id} → ${p.stage}.`);
    }
    save(); renderPetrels(); renderParcels();
  } else if (act === "lose") {
    const p = S.parcels.find((x) => x.id === id);
    p.stage = "lost";
    log(`${p.id} taken by the gale over ${routeById(p.routeId)?.name || "black water"}`);
    save(); renderParcels();
    toast(`${p.id} lost to the gale. It joins the shrine.`);
  } else if (act === "retry") {
    const p = S.parcels.find((x) => x.id === id);
    p.stage = "nest"; p.created = Date.now();
    log(`${p.id} re-franked for another try`);
    save(); renderParcels();
    toast(`${p.id} back in the nest.`);
  } else if (act === "delparcel") {
    S.parcels = S.parcels.filter((x) => x.id !== id);
    save(); renderParcels();
    toast("Record burned.");
  }
});

$("routeSort").addEventListener("change", (e) => { routeSort = e.target.value; renderRoutes(); });
$("trackSearch").addEventListener("input", renderParcels);

$("routeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("routeName").value.trim();
  if (!name) return;
  S.routes.push({
    id: "r" + Date.now(), name,
    kanji: KANJI[Math.floor(Math.random() * KANJI.length)],
    wind: Math.min(120, Math.max(10, +$("routeWind").value || 50)),
    risk: Math.min(5, Math.max(1, +$("routeRisk").value || 3)),
    dist: Math.min(2000, Math.max(20, +$("routeDist").value || 200)),
    status: "OPEN"
  });
  e.target.reset(); $("routeWind").value = 55; $("routeRisk").value = 3; $("routeDist").value = 320;
  save(); renderRoutes();
  toast("New corridor pinned to the chart.");
});

$("petrelForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("petrelName").value.trim();
  if (!name) return;
  S.petrels.push({ id: "p" + Date.now(), name, mark: ($("petrelMark").value || "燕").slice(0, 2), wing: Math.min(80, Math.max(20, +$("petrelWing").value || 40)), flights: 0, status: "roost" });
  log(`${name} banded at the harbour roost`);
  e.target.reset(); $("petrelWing").value = 42; $("petrelMark").value = "燕";
  save(); renderPetrels();
  toast(`${name} banded. Welcome to the roost.`);
});

$("parcelForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const to = $("parcelTo").value.trim();
  if (!to) return;
  if (!S.routes.length || !S.petrels.length) { toast("Need at least one route and one petrel first."); return; }
  const p = { id: "GPP-" + (S.seq++), to, routeId: $("parcelRoute").value, petrelId: $("parcelPetrel").value, prio: $("parcelPrio").value, stage: "nest", created: Date.now() };
  S.parcels.unshift(p);
  log(`${p.id} franked for ${to}`);
  e.target.reset();
  save(); renderPetrels(); renderParcels();
  stamp("付託 FRANKED");
  toast(`${p.id} handed to the wind.`);
});

$("resetAll").addEventListener("click", () => {
  if (!confirm("Reset the whole exchange to seed data?")) return;
  S = seed();
  save(); renderAll();
  toast("Exchange reset. Fresh gale.");
});

function renderAll() { renderRoutes(); renderPetrels(); renderParcels(); }
renderAll();

/* ---------- gale canvas: streaks in palette only ---------- */
(function gale() {
  const c = document.getElementById("galeCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cols = ["#00E5CC", "#FF2E88", "#FFB300"];
  const drops = Array.from({ length: 70 }, () => ({
    x: Math.random() * c.width, y: Math.random() * c.height,
    v: 2 + Math.random() * 5, l: 12 + Math.random() * 30,
    c: cols[Math.floor(Math.random() * cols.length)]
  }));
  // perched petrel glyph
  function bird(x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s / 3, y - s / 2, x, y);
    ctx.quadraticCurveTo(x + s / 3, y - s / 2, x + s, y);
    ctx.stroke();
  }
  let t = 0;
  function frame() {
    ctx.fillStyle = "#0B0B10";
    ctx.fillRect(0, 0, c.width, c.height);
    drops.forEach((d) => {
      ctx.strokeStyle = d.c; ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.35, d.y + d.l); ctx.stroke();
      d.y += d.v; d.x -= d.v * 0.35;
      if (d.y > c.height + 40) { d.y = -40; d.x = Math.random() * (c.width + 60); }
    });
    ctx.globalAlpha = 1;
    const bx = c.width / 2 + Math.sin(t / 22) * 40;
    const by = 90 + Math.cos(t / 17) * 16;
    bird(bx, by, 34, "#F7F1E3");
    bird(bx - 120, by + 60, 22, "#00E5CC");
    bird(bx + 130, by + 44, 26, "#FF2E88");
    ctx.fillStyle = "#FFB300";
    ctx.font = "16px monospace";
    ctx.fillText("嵐 GALE-POST SKY", 14, c.height - 14);
    t++;
    if (!reduced) requestAnimationFrame(frame);
  }
  frame();
})();
