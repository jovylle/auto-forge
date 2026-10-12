// Ulva Gull Union — Local 07. Roster, demands, votes. Keyboard-first. localStorage.
const LS = "ulva-gull-union-v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const TITLES = ["Lookout","Kleptoparasite","Whelk Cracker","Tide Caller","Chick Guard","Drift Boss","Mussel Prier","Sky Screamer"];
const seedGulls = () => ["Agda","Bram","Cissa","Dunna","Eider-ish","Finn"].map((n, i) => ({
  id: "g" + (i + 1) + "-" + Date.now().toString(36), name: n, title: TITLES[i % TITLES.length],
  signed: i < 4, seniority: 7 - i,
}));
const seedDemands = () => [
  { id: "d1", text: "Double the dawn crab ration. No more gull-on-gull theft before 6am.", weight: 9, won: false },
  { id: "d2", text: "A roofed nesting ledge for every mated pair before storm season.", weight: 6, won: false },
  { id: "d3", text: "One herring holiday per full moon. Paid. In herring.", weight: 4, won: false },
];
const seedMotions = () => [
  { id: "m1", text: "Strike the trawler dock at next low tide until rations land?", aye: 3, nay: 1, open: true },
  { id: "m2", text: "Admit the lost puffin chick as honorary gull?", aye: 4, nay: 0, open: true },
];

function load() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) { const d = JSON.parse(raw); if (d.gulls && d.demands && d.motions) return d; }
  } catch {}
  return { gulls: seedGulls(), demands: seedDemands(), motions: seedMotions(), record: [], eggFound: false };
}
let S = load();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };

// ---------- tabs ----------
let tab = "roster";
const tabs = $$('.tabs [role="tab"]');
function showTab(name, focusTab = false) {
  tab = name;
  tabs.forEach(t => {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    if (on && focusTab) t.focus();
  });
  $$("section[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== name; });
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => showTab(t.dataset.tab));
  t.addEventListener("keydown", e => {
    let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") j = (i + tabs.length - 1) % tabs.length;
    if (e.key === "Home") j = 0;
    if (e.key === "End") j = tabs.length - 1;
    if (j !== null) { e.preventDefault(); showTab(tabs[j].dataset.tab, true); }
  });
});

// ---------- toast ----------
let toastT;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- focus memory per list ----------
let focusIdx = { roster: 0, demands: 0, motions: 0 };
const clampFocus = (k, n) => { focusIdx[k] = n ? Math.max(0, Math.min(focusIdx[k], n - 1)) : 0; };

// ---------- ROSTER ----------
function renderRoster() {
  const ul = $("#roster");
  ul.innerHTML = "";
  clampFocus("roster", S.gulls.length);
  const signed = S.gulls.filter(g => g.signed).length;
  $("#signedCount").textContent = signed;
  $("#totalCount").textContent = S.gulls.length;
  $("#quorumNote").textContent = Math.max(1, Math.ceil(S.gulls.length / 2));
  if (!S.gulls.length) { ul.innerHTML = `<li class="empty">no gulls. the bed is silent.</li>`; return; }
  S.gulls.forEach((g, i) => {
    const li = document.createElement("li");
    li.className = g.signed ? "signed" : "";
    li.dataset.focus = i === focusIdx.roster && tab === "roster" ? "true" : "false";
    li.tabIndex = i === focusIdx.roster ? 0 : -1;
    li.setAttribute("role", "button");
    li.setAttribute("aria-pressed", g.signed);
    li.setAttribute("aria-label", `${g.name}, ${g.title}, ${g.signed ? "card signed" : "unsigned"}. Enter toggles.`);
    li.innerHTML = `<span class="tick" aria-hidden="true">${g.signed ? "✓" : "○"}</span>
      <span class="who"><b></b><small></small></span>
      <span class="tag">${g.signed ? "SIGNED" : "SCAB?"}</span>
      <button class="retire" tabindex="-1" aria-label="Retire ${""} from roster" title="Retire (x)">✕</button>`;
    li.querySelector("b").textContent = g.name;
    li.querySelector("small").textContent = `${g.title} · seniority ${g.seniority}`;
    li.querySelector(".retire").setAttribute("aria-label", `Retire ${g.name} from roster`);
    li.addEventListener("click", e => {
      if (e.target.closest(".retire")) { retireGull(g.id); return; }
      focusIdx.roster = i; toggleGull(g.id);
    });
    li.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusIdx.roster = i; toggleGull(g.id); }
    });
    li.addEventListener("focus", () => { focusIdx.roster = i; paintFocus("roster"); });
    ul.appendChild(li);
  });
}
function toggleGull(id) {
  const g = S.gulls.find(x => x.id === id);
  if (!g) return;
  g.signed = !g.signed;
  save(); renderRoster(); refocus("roster");
  toast(g.signed ? `✊ ${g.name} signed the card.` : `○ ${g.name} unsigned. the tide watches.`);
}
function retireGull(id) {
  const g = S.gulls.find(x => x.id === id);
  S.gulls = S.gulls.filter(x => x.id !== id);
  save(); renderRoster(); refocus("roster");
  toast(g ? `🌊 ${g.name} retired to the far rocks.` : "gull retired.");
}
$("#addGull").addEventListener("submit", e => {
  e.preventDefault();
  const inp = $("#gullName");
  const name = inp.value.trim().replace(/\s+/g, " ").slice(0, 28);
  if (!name) { toast("name the gull first."); inp.focus(); return; }
  S.gulls.unshift({ id: "g" + Date.now().toString(36), name, title: TITLES[S.gulls.length % TITLES.length], signed: true, seniority: 1 });
  S.gulls.forEach((g, i) => g.seniority = S.gulls.length - i);
  focusIdx.roster = 0;
  inp.value = "";
  save(); renderRoster(); refocus("roster");
  toast(`✊ ${name} signed the card.`);
});

// ---------- DEMANDS ----------
const maxWeight = () => Math.max(1, ...S.demands.map(d => d.weight));
function renderDemands() {
  const ol = $("#demands");
  ol.innerHTML = "";
  clampFocus("demands", S.demands.length);
  if (!S.demands.length) { ol.innerHTML = `<li class="empty">no demands. suspiciously content flock.</li>`; return; }
  const mx = maxWeight();
  S.demands.forEach((d, i) => {
    const li = document.createElement("li");
    li.className = d.won ? "won" : "";
    li.dataset.focus = i === focusIdx.demands && tab === "demands" ? "true" : "false";
    li.tabIndex = i === focusIdx.demands ? 0 : -1;
    li.setAttribute("aria-label", `Demand ${i + 1}, weight ${d.weight}${d.won ? ", won" : ""}. Plus or minus adjusts weight.`);
    li.innerHTML = `<div class="dt"><p></p>
        <div class="meta"></div>
        <div class="bar" aria-hidden="true"><i style="width:${Math.round(d.weight / mx * 100)}%"></i></div>
        <div class="ops">
          <button class="chip" data-op="won" tabindex="-1">${d.won ? "reopen" : "mark won (w)"}</button>
          <button class="chip danger" data-op="del" tabindex="-1">strike (x)</button>
        </div></div>
      <div class="wt">
        <button data-op="dec" tabindex="-1" aria-label="Lower weight">−</button><b></b><button data-op="inc" tabindex="-1" aria-label="Raise weight">+</button>
      </div>`;
    li.querySelector("p").textContent = d.text;
    li.querySelector(".meta").innerHTML = "";
    li.querySelector(".meta").textContent = `weight ${d.weight}` + (d.won ? " · WON ✓" : "");
    if (d.won) { const b = document.createElement("span"); b.className = "won-badge"; b.textContent = " WON"; li.querySelector(".meta").append(" ", b); }
    li.querySelector(".wt b").textContent = d.weight;
    li.addEventListener("click", e => {
      focusIdx.demands = i; paintFocus("demands");
      const op = e.target.closest("[data-op]")?.dataset.op;
      if (op) demandOp(d.id, op);
    });
    li.addEventListener("focus", () => { focusIdx.demands = i; paintFocus("demands"); });
    ol.appendChild(li);
  });
}
function demandOp(id, op) {
  const d = S.demands.find(x => x.id === id);
  if (!d) return;
  if (op === "inc") d.weight = Math.min(20, d.weight + 1);
  if (op === "dec") d.weight = Math.max(1, d.weight - 1);
  if (op === "won") { d.won = !d.won; toast(d.won ? "🏆 demand won. screech freely." : "demand reopened."); }
  if (op === "del") {
    S.demands = S.demands.filter(x => x.id !== id);
    toast("demand struck from the board.");
  }
  S.demands.sort((a, b) => Number(a.won) - Number(b.won) || b.weight - a.weight);
  save(); renderDemands(); refocus("demands");
}
$("#addDemand").addEventListener("submit", e => {
  e.preventDefault();
  const inp = $("#demandText");
  const text = inp.value.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!text) { toast("state the demand first."); inp.focus(); return; }
  S.demands.unshift({ id: "d" + Date.now().toString(36), text, weight: 3, won: false });
  focusIdx.demands = 0;
  inp.value = "";
  save(); renderDemands(); refocus("demands");
  toast("📌 demand nailed to the piling.");
});

// ---------- VOTES ----------
function quorum() { return Math.max(1, Math.ceil(S.gulls.filter(g => g.signed).length / 2)); }
function renderVotes() {
  const box = $("#motions");
  box.innerHTML = "";
  const open = S.motions.filter(m => m.open);
  clampFocus("motions", open.length);
  $("#voteCount").textContent = open.length ? `${open.length} open · quorum ${quorum()} ayes to pass` : "no open ballots";
  if (!open.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "no open ballots. call a motion, steward.";
    box.appendChild(p);
  }
  open.forEach((m, i) => {
    const t = m.aye + m.nay, ap = t ? Math.round(m.aye / t * 100) : 0;
    const div = document.createElement("div");
    div.className = "motion open";
    div.dataset.focus = i === focusIdx.motions && tab === "votes" ? "true" : "false";
    div.tabIndex = i === focusIdx.motions ? 0 : -1;
    div.setAttribute("aria-label", `${m.text} Ayes ${m.aye}, nays ${m.nay}. Press A for aye, N for nay, C to close.`);
    const h = document.createElement("h3"); h.textContent = m.text;
    div.appendChild(h);
    const tally = document.createElement("div");
    tally.className = "tally"; tally.setAttribute("aria-hidden", "true");
    tally.innerHTML = `<div class="aye" style="width:${ap}%"></div><div class="nay" style="width:${100 - ap}%"></div>`;
    div.appendChild(tally);
    const n = document.createElement("p");
    n.className = "tally-n";
    n.innerHTML = `<span class="a"></span><span class="b"></span>`;
    n.querySelector(".a").textContent = `AYE ${m.aye}`;
    n.querySelector(".b").textContent = `NAY ${m.nay}`;
    div.appendChild(n);
    const btns = document.createElement("div");
    btns.className = "vote-btns";
    btns.innerHTML = `<button class="btn-aye" data-v="aye" tabindex="-1">Aye (a)</button>
      <button class="btn-nay" data-v="nay" tabindex="-1">Nay (n)</button>
      <button class="plain" data-v="close" tabindex="-1">Close (c)</button>
      <button class="plain" data-v="scrap" tabindex="-1" title="Scrap (x)">✕</button>`;
    div.appendChild(btns);
    btns.addEventListener("click", e => {
      const v = e.target.closest("[data-v]")?.dataset.v;
      if (v) motionOp(m.id, v);
    });
    div.addEventListener("focus", () => { focusIdx.motions = i; paintFocus("motions"); });
    div.addEventListener("click", () => { focusIdx.motions = i; paintFocus("motions"); });
    box.appendChild(div);
  });
  // record
  const rec = $("#record");
  rec.innerHTML = "";
  $("#recordCount").textContent = S.record.length ? `${S.record.length} decided` : "empty";
  if (!S.record.length) { rec.innerHTML = `<li class="empty">nothing decided yet. gulls love procedure.</li>`; }
  [...S.record].reverse().slice(0, 12).forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="v"></span><span class="t"></span><small></small>`;
    li.querySelector(".v").textContent = r.pass ? "PASS" : "FAIL";
    li.querySelector(".v").classList.add(r.pass ? "pass" : "fail");
    li.querySelector(".t").textContent = r.text;
    li.querySelector("small").textContent = `${r.aye}–${r.nay}`;
    rec.appendChild(li);
  });
}
function motionOp(id, v) {
  const m = S.motions.find(x => x.id === id && x.open);
  if (!m) return;
  if (v === "aye") { m.aye++; toast("aye! the pilings shake."); }
  if (v === "nay") { m.nay++; toast("nay. noted in the log."); }
  if (v === "scrap") {
    S.motions = S.motions.filter(x => x.id !== id);
    toast("motion scrapped.");
  }
  if (v === "close") {
    m.open = false;
    const pass = m.aye >= quorum() && m.aye > m.nay;
    S.record.push({ text: m.text, aye: m.aye, nay: m.nay, pass, at: new Date().toLocaleDateString() });
    S.motions = S.motions.filter(x => x.id !== id);
    toast(pass ? "🎉 MOTION PASSES. screech!" : "motion fails. back to the beds.");
    const d = document.createElement("div");
    d.className = "motion";
    d.innerHTML = `<p class="verdict ${pass ? "pass" : "fail"}"></p>`;
    d.querySelector("p").textContent = pass ? `PASSES ${m.aye}–${m.nay} — so ordered by Local 07.` : `FAILS ${m.aye}–${m.nay} — quorum was ${quorum()}.`;
  }
  save(); renderVotes(); refocus("motions");
}
$("#addMotion").addEventListener("submit", e => {
  e.preventDefault();
  const inp = $("#motionText");
  const text = inp.value.trim().replace(/\s+/g, " ").slice(0, 90);
  if (!text) { toast("call the motion first."); inp.focus(); return; }
  S.motions.unshift({ id: "m" + Date.now().toString(36), text, aye: 1, nay: 0, open: true });
  focusIdx.motions = 0;
  inp.value = "";
  save(); renderVotes(); refocus("motions");
  toast("🔨 motion on the floor. vote!");
});

// ---------- focus helpers ----------
function paintFocus(kind) {
  if (kind === "roster") $$("#roster li").forEach((li, i) => li.dataset.focus = i === focusIdx.roster ? "true" : "false");
  if (kind === "demands") $$("#demands li").forEach((li, i) => li.dataset.focus = i === focusIdx.demands ? "true" : "false");
  if (kind === "motions") $$("#motions .motion").forEach((el, i) => el.dataset.focus = i === focusIdx.motions ? "true" : "false");
}
function refocus(kind) {
  requestAnimationFrame(() => {
    const sel = kind === "roster" ? "#roster li" : kind === "demands" ? "#demands li" : "#motions .motion";
    const els = $$(sel);
    const i = kind === "roster" ? focusIdx.roster : kind === "demands" ? focusIdx.demands : focusIdx.motions;
    if (els[i] && document.activeElement?.closest("form") !== null) return; // keep typing in form
    paintFocus(kind);
  });
}
function focusItem(kind, dir) {
  const n = kind === "roster" ? S.gulls.length : kind === "demands" ? S.demands.length : S.motions.filter(m => m.open).length;
  if (!n) return;
  focusIdx[kind] = (focusIdx[kind] + dir + n) % n;
  paintFocus(kind);
  const sel = kind === "roster" ? "#roster li" : kind === "demands" ? "#demands li" : "#motions .motion";
  $$(sel)[focusIdx[kind]]?.focus({ preventScroll: false });
}

// ---------- global keyboard ----------
let eggBuf = "";
const help = $("#help");
function toggleHelp(force) {
  const show = force !== undefined ? force : help.hidden;
  help.hidden = !show;
  if (show) $("#helpClose").focus();
}
$("#helpClose").addEventListener("click", () => toggleHelp(false));
help.addEventListener("click", e => { if (e.target === help) toggleHelp(false); });

document.addEventListener("keydown", e => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "");
  const k = e.key;

  // easter egg buffer (works even while typing — that's the fun)
  if (/^[a-zA-Z]$/.test(k)) {
    eggBuf = (eggBuf + k.toLowerCase()).slice(-8);
    if (eggBuf.endsWith("squawk")) { eggBuf = ""; commodore(); }
  }
  if (k === "Escape") {
    if (!help.hidden) { toggleHelp(false); return; }
    if (!$("#egg").hidden) { closeEgg(); return; }
    document.activeElement?.blur();
    return;
  }
  if (typing) {
    if (k === "Enter" && e.target.id === "gullName") return; // let form submit
    if (k === "Enter" && e.target.id === "demandText") return;
    if (k === "Enter" && e.target.id === "motionText") return;
    return; // no shortcuts while typing
  }
  if (k === "?") { e.preventDefault(); toggleHelp(); return; }
  if (!help.hidden) return;
  if (!$("#egg").hidden) { if (k === "Enter" || k === " ") closeEgg(); return; }

  const cur = tab === "roster" ? "roster" : tab === "demands" ? "demands" : "motions";
  switch (k) {
    case "1": showTab("roster"); break;
    case "2": showTab("demands"); break;
    case "3": showTab("votes"); break;
    case "ArrowDown":
    case "j": e.preventDefault(); focusItem(cur, 1); break;
    case "ArrowUp":
    case "k": e.preventDefault(); focusItem(cur, -1); break;
    case "/": e.preventDefault(); showTab("roster"); $("#gullName").focus(); break;
    case "d": e.preventDefault(); showTab("demands"); $("#demandText").focus(); break;
    case "m": e.preventDefault(); showTab("votes"); $("#motionText").focus(); break;
    case "x": case "X": {
      e.preventDefault();
      if (tab === "roster" && S.gulls[focusIdx.roster]) retireGull(S.gulls[focusIdx.roster].id);
      else if (tab === "demands" && S.demands[focusIdx.demands]) demandOp(S.demands[focusIdx.demands].id, "del");
      else if (tab === "votes") { const o = S.motions.filter(m => m.open); if (o[focusIdx.motions]) motionOp(o[focusIdx.motions].id, "scrap"); }
      break;
    }
    case "Enter":
      if (tab === "roster" && S.gulls[focusIdx.roster]) toggleGull(S.gulls[focusIdx.roster].id);
      break;
    case "+": case "=":
      if (tab === "demands" && S.demands[focusIdx.demands]) { e.preventDefault(); demandOp(S.demands[focusIdx.demands].id, "inc"); }
      break;
    case "-": case "_":
      if (tab === "demands" && S.demands[focusIdx.demands]) { e.preventDefault(); demandOp(S.demands[focusIdx.demands].id, "dec"); }
      break;
    case "w": case "W":
      if (tab === "demands" && S.demands[focusIdx.demands]) demandOp(S.demands[focusIdx.demands].id, "won");
      break;
    case "a": case "A":
      if (tab === "votes") { const o = S.motions.filter(m => m.open); if (o[focusIdx.motions]) motionOp(o[focusIdx.motions].id, "aye"); }
      break;
    case "n": case "N":
      if (tab === "votes") { const o = S.motions.filter(m => m.open); if (o[focusIdx.motions]) motionOp(o[focusIdx.motions].id, "nay"); }
      break;
    case "c": case "C":
      if (tab === "votes") { const o = S.motions.filter(m => m.open); if (o[focusIdx.motions]) motionOp(o[focusIdx.motions].id, "close"); }
      break;
  }
});

// ---------- EASTER EGG: the Commodore ----------
function screech() {
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    const t = C.currentTime;
    [660, 880, 520, 990].forEach((f, i) => {
      const o = C.createOscillator(), g = C.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(f, t + i * 0.13);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + i * 0.13 + 0.12);
      g.gain.setValueAtTime(0.08, t + i * 0.13);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.14);
      o.connect(g).connect(C.destination);
      o.start(t + i * 0.13); o.stop(t + i * 0.13 + 0.16);
    });
  } catch {}
}
function commodore() {
  screech();
  if (!S.gulls.some(g => g.id === "commodore")) {
    S.gulls.unshift({ id: "commodore", name: "The Commodore", title: "Founder · Never Retires", signed: true, seniority: 99 });
    S.eggFound = true;
    save(); renderRoster();
  }
  const egg = $("#egg");
  egg.hidden = false;
  egg.innerHTML = `<div class="egg-card" role="dialog" aria-label="Easter egg: the Commodore">
    <div class="gull" aria-hidden="true">🪶</div>
    <h2>THE COMMODORE LIVES</h2>
    <p>founding gull of the ulva beds · seniority 99<br/>“i was striking before tides had names.”<br/><br/>+1 honorary gull added to your roster.</p>
    <button id="eggClose">Screech &amp; return (Esc)</button>
  </div>`;
  $("#eggClose").focus();
  $("#eggClose").addEventListener("click", closeEgg, { once: true });
  // sea-lettuce rain
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("span");
    s.className = "lettuce";
    s.textContent = ["🥬", "🪶", "🌊"][i % 3];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
    s.style.fontSize = 14 + Math.random() * 26 + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3800);
  }
  toast("🥬 SQUAWK. the Commodore joins Local 07.");
}
function closeEgg() { $("#egg").hidden = true; $("#egg").innerHTML = ""; showTab("roster"); focusItem("roster", 0); }
if (S.eggFound && !S.gulls.some(g => g.id === "commodore")) {
  S.gulls.unshift({ id: "commodore", name: "The Commodore", title: "Founder · Never Retires", signed: true, seniority: 99 });
}

// ---------- init ----------
showTab("roster");
renderRoster(); renderDemands(); renderVotes();
console.log("Ulva Gull Union ready — press ? for keys, or type squawk.");
