// Dulse Otter Outpost — kelp trade · otter crew · outpost score + easter egg
const $ = (id) => document.getElementById(id);
const SAVE_KEY = "dulse-otter-outpost-v1";

const KELPS = [
  { id: "dulse",   name: "Dulse Ribbon", emoji: "🟣", base: 8,  desc: "sweet & steady" },
  { id: "sugar",   name: "Sugar Kelp",   emoji: "🟢", base: 14, desc: "volatile & sugary" },
  { id: "oarweed", name: "Oarweed",      emoji: "🟤", base: 26, desc: "rare deep-frond" },
];
const CREW = [
  { id: "brine",  name: "Brine",       face: "🦦", cost: 40,  perk: "+20% sell prices", apply: "sell" },
  { id: "kelpo",  name: "Kelpo",       face: "🦦", cost: 55,  perk: "+1 harvest yield", apply: "harvest" },
  { id: "splash", name: "Splash",      face: "🦦", cost: 80,  perk: "tides pay +8🐚", apply: "tide" },
  { id: "nib",    name: "Nib",         face: "🦦", cost: 120, perk: "10% buy discount", apply: "buy" },
  { id: "sable",  name: "Sable",       face: "🦦", cost: 200, perk: "+2 renown / trade", apply: "score" },
];
const RANKS = [[0,"🪵 Driftwood"],[150,"🪸 Kelp Bed"],[400,"🐚 Trading Post"],[800,"🌊 Tidal Market"],[1500,"🪨 Living Reef"]];

const fresh = () => ({ clams: 60, day: 1, inv: { dulse: 3, sugar: 1, oarweed: 0 }, prices: { dulse: 8, sugar: 14, oarweed: 26 }, prev: {}, crew: [], trades: 0, pets: 0, egg: false, typed: "", log: ["🌊 The outpost opens. Three otters, one dream, a lot of kelp."] });
let S;
try { S = { ...fresh(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") }; }
catch { S = fresh(); }
const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(S));
const hired = (id) => S.crew.includes(id) || (S.egg && id === "captain");
const sellMult = () => hired("brine") ? 1.2 : 1;
const buyMult = () => hired("nib") ? 0.9 : 1;

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  $("toasts").appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function say(msg, cls = "") {
  S.log.unshift(msg);
  S.log = S.log.slice(0, 30);
  const li = document.createElement("li");
  if (cls) li.className = cls;
  li.textContent = msg;
  const log = $("log");
  log.prepend(li);
  while (log.children.length > 30) log.lastChild.remove();
}

function score() {
  const invVal = KELPS.reduce((a, k) => a + (S.inv[k.id] || 0) * S.prices[k.id], 0);
  return Math.round(S.clams + invVal + S.crew.length * 60 + (S.egg ? 150 : 0) + S.trades * (hired("sable") ? 12 : 10));
}
function rankFor(s) { let r = RANKS[0]; for (const x of RANKS) if (s >= x[0]) r = x; return r; }

function render() {
  $("clams").textContent = S.clams;
  $("dayNum").textContent = S.day;
  const sc = score();
  $("score").textContent = sc;
  const [, rname] = rankFor(sc);
  $("rankPill").textContent = rname;
  $("rankLine").textContent = `— ${rname} · next rank at ${nextRankAt(sc) ?? "max"}`;
  $("scoreFill").style.width = Math.min(100, (sc / 1500) * 100) + "%";
  const invVal = KELPS.reduce((a, k) => a + (S.inv[k.id] || 0) * S.prices[k.id], 0);
  $("scoreBreakdown").textContent = `🐚${S.clams} + 🌿${Math.round(invVal)} stock + 🦦${S.crew.length * 60} crew + 🔁${S.trades * 10} trades${S.egg ? " + 👑150 hoard" : ""}`;

  // market
  const m = $("market"); m.innerHTML = "";
  let rising = 0;
  for (const k of KELPS) {
    const p = S.prices[k.id], prev = S.prev[k.id] ?? k.base;
    const d = p - prev; if (d > 0) rising++;
    const row = document.createElement("div"); row.className = "kelp-row";
    row.innerHTML = `<div><div class="kname">${k.emoji} ${k.name} <small>· ${k.desc}</small></div>
      <div class="inv">price <span class="price ${d > 0 ? "up" : d < 0 ? "down" : ""}">${p}🐚</span>
      ${d > 0 ? " ▲" : d < 0 ? " ▼" : " ●"} · you hold <b>${S.inv[k.id] || 0}</b></div></div>`;
    const btns = document.createElement("div"); btns.className = "trade-btns";
    const buy = document.createElement("button"); buy.className = "buy";
    const cost = Math.ceil(p * buyMult());
    buy.textContent = `Buy ${cost}🐚`; buy.disabled = S.clams < cost;
    buy.onclick = () => {
      if (S.clams < cost) return toast("Not enough clams! 🐚");
      S.clams -= cost; S.inv[k.id]++; S.trades++;
      say(`🛒 Bought 1 ${k.name} for ${cost}🐚.`, "");
      toast(`+1 ${k.name} ${k.emoji}`); save(); render();
    };
    const sell = document.createElement("button"); sell.className = "sell";
    const gain = Math.floor(p * sellMult());
    sell.textContent = `Sell +${gain}🐚`; sell.disabled = !(S.inv[k.id] > 0);
    sell.onclick = () => {
      if (!(S.inv[k.id] > 0)) return;
      S.inv[k.id]--; S.clams += gain; S.trades++;
      say(`💰 Sold 1 ${k.name} for ${gain}🐚${hired("brine") ? " (Brine's charm!)" : ""}.`, "");
      toast(`+${gain} clams 🐚`); save(); render();
    };
    btns.append(buy, sell); row.append(btns); m.append(row);
  }
  $("trendNote").textContent = rising >= 2 ? "📈 bull tide!" : rising === 0 ? "📉 low tide…" : "market calm";

  // crew
  const c = $("crew"); c.innerHTML = "";
  $("crewCount").textContent = S.crew.length + (S.egg ? 1 : 0);
  const list = [...CREW.map(o => ({ ...o, isEgg: false }))];
  if (S.egg) list.push({ id: "captain", name: "Capt. Brinewhisker 👑", face: "👑", cost: 0, perk: "legend · +150 renown", isEgg: true });
  for (const o of list) {
    const has = S.crew.includes(o.id) || (o.isEgg);
    const div = document.createElement("div");
    div.className = "otter" + (has ? " hired" : "") + (o.isEgg ? " golden" : "");
    div.innerHTML = `<div class="face">${o.face}</div><div><b>${o.name}</b><p>${o.perk}</p></div>`;
    const b = document.createElement("button"); b.className = "hire";
    b.textContent = has ? "✓ aboard" : `Hire ${o.cost}🐚`;
    b.disabled = has || S.clams < o.cost;
    if (!has) b.onclick = () => {
      if (S.clams < o.cost) return toast(`${o.name} costs ${o.cost}🐚 — keep trading!`);
      S.clams -= o.cost; S.crew.push(o.id);
      say(`🦦 ${o.name} joined the crew! (${o.perk})`, "magic");
      toast(`🦦 ${o.name} is aboard!`); save(); render();
    };
    div.append(b); c.append(div);
  }
  save();
}
function nextRankAt(sc) { for (const [at] of RANKS) if (at > sc) return at; return null; }

$("btnHarvest").onclick = () => {
  const bonus = hired("kelpo") ? 1 : 0;
  const n = 1 + Math.floor(Math.random() * 2) + bonus;
  const gains = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const id = r < 0.5 ? "dulse" : r < 0.85 ? "sugar" : "oarweed";
    S.inv[id]++; gains.push(id);
  }
  const names = gains.map(g => KELPS.find(k => k.id === g).name).join(", ");
  say(`🌊 Harvested ${n} kelp: ${names}.${bonus ? " (Kelpo's paws!)" : ""}`, "");
  toast(`🌊 +${n} kelp!`); save(); render();
};
$("btnTide").onclick = () => {
  S.day++;
  S.prev = { ...S.prices };
  for (const k of KELPS) {
    const shock = () => (Math.random() - 0.48) * (k.id === "sugar" ? 10 : k.id === "oarweed" ? 12 : 5);
    S.prices[k.id] = Math.max(2, Math.round(S.prices[k.id] + shock()));
  }
  if (hired("splash")) { S.clams += 8; say("🦦 Splash sold tide-maps for +8🐚.", "magic"); }
  const [, r] = rankFor(score());
  say(`⏳ Tide ${S.day} rolls in. Prices drift… (${r})`, "");
  if (score() >= 1500) { say("🪨 LIVING REEF! The outpost glows. The otters sing.", "magic"); toast("🪨 LIVING REEF — you win! Keep trading freely."); }
  save(); render();
};
$("btnReset").onclick = () => { if (confirm("Wash the outpost away and start over?")) { S = fresh(); save(); renderAll(); toast("↺ Fresh tide, fresh start."); } };
$("btnChronicle").onclick = () => say(`📜 Day ${S.day}: ${S.clams}🐚, ${S.trades} trades, ${S.crew.length} otters, renown ${score()}.`, "");

// —— EASTER EGG: pet the sleeping otter 5× (or type "kelp") ——
function triggerEgg() {
  if (S.egg) return toast("👑 The Golden Otter already watches over you.");
  S.egg = true; S.clams += 150;
  say("👑 EASTER EGG! The Golden Otter woke. +150🐚, Captain Brinewhisker joins free!", "magic");
  $("eggOverlay").hidden = false;
  confetti(); save(); render();
}
$("secretOtter").onclick = (e) => {
  S.pets++;
  e.target.classList.remove("nudge"); void e.target.offsetWidth; e.target.classList.add("nudge");
  if (S.pets >= 5) triggerEgg();
  else toast(`🦦 the otter stirs… (${S.pets}/5 pets)`);
  save();
};
$("moon").onclick = () => { S.pets++; S.pets >= 5 ? triggerEgg() : toast(`🌙 moon-pet ${S.pets}/5…`); save(); };
document.addEventListener("keydown", (e) => {
  S.typed = ((S.typed || "") + e.key.toLowerCase()).slice(-4);
  if (S.typed === "kelp") triggerEgg();
});
$("btnEggClose").onclick = () => ($("eggOverlay").hidden = true);
function confetti() {
  const em = ["🦦", "👑", "🐚", "🌿", "✨", "🫧"];
  for (let i = 0; i < 60; i++) {
    const s = document.createElement("span"); s.className = "confetti";
    s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 2 + Math.random() * 2.5 + "s";
    document.body.append(s); setTimeout(() => s.remove(), 5000);
  }
}

function renderAll() { $("log").innerHTML = ""; [...S.log].reverse().forEach(m => { const li = document.createElement("li"); li.textContent = m; $("log").append(li); }); render(); }
renderAll();
console.log("🦦 dulse otter outpost ready");
