// Zephyr Zine Machine — wind press + templates + gust print. CLICK ONLY.
const $ = (s) => document.querySelector(s);

const DIRS = ["WSW", "W", "WNW", "W", "WSW", "W", "W", "WNW"];
const GUST_NAMES = ["JUNK-YACHT HOWL", "NEON HABOOB", "CONCRETE SIROCCO", "GHOST MONSOON", "VOLT SANTA ANA", "RUST CHINOOK", "STATIC LEVANTER", "CHROME MISTRAL"];
const NOUN = ["chrome saints", "neon orphans", "cable witches", "grid runners", "smog poets", "volt priests", "rent ghosts", "signal thieves", "tower squatters", "night couriers", "arcade widows", "drone shepherds"];
const VERB = ["jam the toll-gates", "baptize the antennas", "unplug the curfew", "re-wire the sirens", "paint the blackout", "hijack the forecast", "feed the static", "map the dead zones", "burn the toll-booths", "sing to the substations"];
const PLACE = ["Sector 7 underpass", "the drowned arcade", "Rooftop K-9", "the salt-bath baths", "Junction Zero", "the flicker market", "Hangar of Lost Bikes", "the coolant canal", "Tower 44 stairwell", "the midnight laundromat"];
const CORP = ["HELIOS DYNAMICS", "VANTA MILK", "OBSIDIAN TRANSIT", "PALE FIRE ISP", "MOTHER VOLT", "GRAY HARVEST CO."];
const LAW = ["Never trust a forecast written indoors.", "Ink before permission.", "If the wind knocks, print twice.", "The grid naps at 3AM — work then.", "Concrete remembers every poster.", "A photocopier is a printing press with amnesia.", "Static is just the city thinking aloud.", "Share the gust or lose it."];
const FRAG = ["neon", "static", "monsoon", "voltage", "kerosene", "hologram", "blackout", "solder", "mirage", "turbine", "phosphor", "asphalt", "siren", "ultraviolet", "cinder", "telemetry"];
const FACES = [
  ["  .--.  ", " |o_o | ", " |:_/ | ", "  |   | ", "  |___| "],
  ["  .--.  ", " |X_X | ", " |/ \\ | ", "  | V | ", "  (---) "],
  ["  +--+  ", " |^_^| ", " | \\/ | ", "  |  |  ", " /|  |\\ "],
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

const state = {
  tpl: "prophecy",
  wind: null,          // {speed, dir, name, seed}
  gusts: [],           // recent gust history
  issue: 1,
  shelf: [],
};

try {
  const raw = localStorage.getItem("zephyr-shelf-v1");
  if (raw) state.shelf = JSON.parse(raw);
  const iss = localStorage.getItem("zephyr-issue-v1");
  if (iss) state.issue = parseInt(iss, 10) || 1;
} catch { /* file:// safe */ }
const save = () => {
  try {
    localStorage.setItem("zephyr-shelf-v1", JSON.stringify(state.shelf.slice(0, 24)));
    localStorage.setItem("zephyr-issue-v1", String(state.issue));
  } catch { /* ignore */ }
};

// ---------- wind ----------
function catchGust(reloaded) {
  const seed = reloaded ? reloaded.seed : ((Math.random() * 1e9) | 0);
  const r = mulberry32(seed);
  const speed = reloaded ? reloaded.speed : ri(r, 8, 122);
  const dir = reloaded ? reloaded.dir : pick(r, DIRS);
  const name = reloaded ? reloaded.name : pick(r, GUST_NAMES);
  state.wind = { speed, dir, name, seed };
  if (!reloaded) {
    state.gusts.unshift(state.wind);
    state.gusts = state.gusts.slice(0, 5);
  }
  renderWind();
  renderPreview(true);
  blip(speed);
}

function renderWind() {
  const w = state.wind;
  $("#roWind").textContent = w ? w.speed + " kt" : "-- kt";
  $("#roDir").textContent = w ? w.dir : "WSW";
  $("#mSpeed").textContent = w ? w.speed + " kt" : "-- kt";
  $("#barSpeed").style.width = w ? Math.min(100, (w.speed / 122) * 100) + "%" : "0";
  const press = w ? Math.min(100, 25 + Math.round((w.speed / 122) * 75)) : 0;
  $("#mPress").textContent = press + "%";
  $("#barPress").style.width = press + "%";
  $("#gustName").textContent = w ? "❝ " + w.name + " ❞ — " + w.speed + "kt from " + w.dir : "awaiting gust…";
  const ang = w ? -80 + (w.speed / 122) * 160 : -80;
  $("#needle").style.transform = "translateX(-50%) rotate(" + ang + "deg)";
  const btn = $("#printBtn");
  btn.disabled = !w;
  $("#printSub").textContent = w ? "pressurized · slam it" : "needs wind first";
  $("#bedHint").textContent = w ? "gust loaded: " + w.speed + "kt — slam it" : "catch a gust, then slam it";
  $("#roIssue").textContent = "#" + String(state.issue).padStart(3, "0");
  const log = $("#gustLog");
  log.innerHTML = "";
  if (!state.gusts.length) {
    const s = document.createElement("span");
    s.className = "shelf-empty"; s.textContent = "no gusts yet — the west is quiet.";
    log.appendChild(s);
  }
  state.gusts.forEach((g) => {
    const c = document.createElement("button");
    c.type = "button"; c.className = "gust-chip";
    c.textContent = g.speed + "kt " + g.dir;
    c.title = g.name;
    c.addEventListener("click", () => catchGust(g));
    log.appendChild(c);
  });
}

// ---------- zine composition ----------
function distort(text, r, level) {
  if (level <= 0) return text;
  const glyphs = "█▓▒░<>/\\#@%*+";
  return text.split("").map((ch) => {
    if (ch === " " || ch === "\n") return ch;
    const p = level === 1 ? 0.03 : level === 2 ? 0.08 : 0.15;
    return r() < p ? glyphs[(r() * glyphs.length) | 0] : ch;
  }).join("");
}
function glitchClass(speed) {
  return speed < 40 ? "g1" : speed < 80 ? "g2" : "g3";
}

function compose(tpl, wind, issue) {
  const r = mulberry32(wind.seed + issue * 7919);
  const level = wind.speed < 40 ? 0 : wind.speed < 80 ? 1 : wind.speed < 105 ? 2 : 3;
  const g = glitchClass(wind.speed);
  const head = `<div class="z-kicker"><span>ZEPHYR // WEST WIND PRESS</span><span>ISSUE #${String(issue).padStart(3, "0")}</span></div>`;
  const windbox = `<div class="z-windbox">☰ GUST: <b>${wind.name}</b> · ${wind.speed}kt from ${wind.dir} · SEED ${String(wind.seed).slice(0, 6)} · ${level === 0 ? "CLEAN INK" : level === 1 ? "LIGHT STATIC" : level === 2 ? "HEAVY STATIC" : "TOTAL WHITEOUT"}</div>`;
  const foot = `<div class="z-foot"><span>SECTOR 7 · PRINTED ON WIND</span><span class="barcode">||||| || |||| | ||</span></div>`;

  if (tpl === "prophecy") {
    const title = distort(pick(r, ["THE GRID WILL NAP", "OBEY THE WEST WIND", "STATIC IS TRUTH", "BURN THE FORECAST", "THE NIGHT DELIVERS"]) , r, 0);
    const laws = [0, 1, 2].map((i) => `<div><b>${["I", "II", "III"][i]}.</b> ${distort(pick(r, LAW), r, level)}</div>`).join("");
    const body = `<div class="z-glitch ${g}"><div class="z-title">${title}</div>
      <div class="z-sub">a manifesto carried ${wind.speed}km on gusts from the ${wind.dir} · witnessed at ${pick(r, PLACE)}</div>
      <hr class="z-rule"/><div class="z-body">${laws}</div>
      <hr class="z-rule"/><div class="z-body">The ${pick(r, NOUN)} ${pick(r, VERB)} at ${pick(r, PLACE)}. ${pick(r, CORP)} denies everything. Copy this zine by hand. Leave it in a bus shelter.</div></div>`;
    return head + body + windbox + foot;
  }
  if (tpl === "map") {
    const rows = 9, cols = 18;
    let grid = "";
    for (let y = 0; y < rows; y++) {
      let line = "";
      for (let x = 0; x < cols; x++) {
        const v = r();
        line += v < 0.06 ? "◆" : v < 0.14 ? (level >= 2 && r() < 0.4 ? "▓" : "·") : v < 0.17 ? "✕" : v < 0.2 ? "~" : "·";
      }
      grid += line + "\n";
    }
    const spots = [0, 1, 2].map(() => `▸ ${pick(r, PLACE)} — ${pick(r, VERB)} (${ri(r, 1, 9)} blocks ${r() < 0.5 ? "upwind" : "downwind"})`).join("\n");
    return head + `<div class="z-glitch ${g}"><div class="z-title">SECTOR&#8209;7<br/>SMUGGLER GRID</div>
      <div class="z-sub">surveyed during a ${wind.speed}kt blow · ◆ cache ✕ patrol ~ flood</div>
      <pre class="z-ascii">${distort(grid, r, level > 1 ? 1 : 0)}</pre>
      <div class="z-body">${distort(spots, r, level >= 3 ? 2 : 0)}</div></div>` + windbox + foot;
  }
  if (tpl === "verse") {
    const stanza = () => [0, 1, 2, 3].map(() => `the ${pick(r, FRAG)} ${pick(r, FRAG)} ${pick(r, VERB)}`).join("\n");
    const poem = [stanza(), stanza()].join("\n\n— — —\n\n");
    return head + `<div class="z-glitch ${g}"><div class="z-title">STATIC<br/>VERSE</div>
      <div class="z-sub">cut up by a ${wind.speed}kt gust · do not read aloud near antennas</div>
      <hr class="z-rule"/><div class="z-body">${distort(poem, r, level)}</div></div>` + windbox + foot;
  }
  // wanted
  const face = pick(r, FACES).join("\n");
  const crime = `wanted for ${pick(r, VERB)} at ${pick(r, PLACE)}`;
  const bounty = (ri(r, 5, 900) * (1 + Math.floor(wind.speed / 20))) + " VOLT-COUPONS";
  return head + `<div class="z-glitch ${g}"><div class="z-title">WANTED:<br/>THE SIGNAL</div>
    <div class="z-stamp">REWARD ${bounty}</div>
    <pre class="z-ascii">${face}</pre>
    <div class="z-body">ALIAS: "${("THE " + pick(r, FRAG) + " " + pick(r, FRAG)).toUpperCase()}"\n${distort(crime, r, level >= 2 ? 1 : 0)}\nLast seen: ${pick(r, PLACE)}. If found, offer shelter and a photocopier. Snitches get static.</div></div>` + windbox + foot;
}

function renderPreview() {
  const w = state.wind;
  const paper = $("#paper");
  if (!w) {
    paper.innerHTML = `<div class="z-kicker"><span>ZEPHYR // WEST WIND PRESS</span><span>ISSUE #${String(state.issue).padStart(3, "0")}</span></div>
      <div class="z-title">NO<br/>WIND<br/>NO ZINE</div>
      <div class="z-sub">the press is idle. the paper waits.</div>
      <hr class="z-rule"/><div class="z-body">1 · Click CATCH GUST to harvest the west wind.\n2 · Click a TPL card to load a template.\n3 · Click SLAM THE PRESS to print.\n\nEverything here runs on clicks. The wind does the rest.</div>
      <div class="z-foot"><span>SECTOR 7</span><span class="barcode">||||| || ||||</span></div>`;
    return;
  }
  paper.innerHTML = compose(state.tpl, w, state.issue);
}

// ---------- print / archive ----------
function slamPrint() {
  if (!state.wind) return;
  const paper = $("#paper");
  const stage = $("#paperStage");
  paper.classList.remove("slam"); stage.classList.remove("shake-stage");
  void paper.offsetWidth;
  paper.classList.add("slam"); stage.classList.add("shake-stage");
  paper.innerHTML = compose(state.tpl, state.wind, state.issue);
  setTimeout(() => {
    const entry = { issue: state.issue, tpl: state.tpl, wind: { ...state.wind }, html: paper.innerHTML, at: Date.now() };
    state.shelf.unshift(entry);
    state.shelf = state.shelf.slice(0, 24);
    state.issue += 1;
    save(); renderWind(); renderShelf(); renderPreview();
  }, 420);
}

function renderShelf() {
  const shelf = $("#shelf");
  shelf.innerHTML = "";
  if (!state.shelf.length) {
    const d = document.createElement("div");
    d.className = "shelf-empty"; d.textContent = "shelf is bare — slam the press to hang your first issue.";
    shelf.appendChild(d);
  }
  state.shelf.forEach((e) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "shelf-item";
    b.innerHTML = `<b>#${String(e.issue).padStart(3, "0")} · ${e.tpl.toUpperCase()}</b><span>${e.wind.speed}kt ${e.wind.dir} · ${e.wind.name}</span>`;
    b.addEventListener("click", () => {
      state.tpl = e.tpl;
      document.querySelectorAll(".tpl").forEach((t) => t.classList.toggle("is-active", t.dataset.tpl === state.tpl));
      catchGust(e.wind);
    });
    shelf.appendChild(b);
  });
  $("#footCount").textContent = (state.issue - 1) + " issues pressed";
}

// ---------- tiny synth blip (no assets) ----------
let AC = null;
function blip(speed) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = "sawtooth";
    o.frequency.value = 120 + Math.min(900, speed * 6);
    gn.gain.setValueAtTime(0.06, AC.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.35);
    o.connect(gn); gn.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + 0.36);
  } catch { /* silent */ }
}

// ---------- events: CLICK ONLY ----------
$("#catchBtn").addEventListener("click", () => catchGust());
$("#printBtn").addEventListener("click", slamPrint);
$("#remixBtn").addEventListener("click", () => { if (state.wind) { state.wind = { ...state.wind, seed: (Math.random() * 1e9) | 0 }; renderPreview(); } });
$("#paperBtn").addEventListener("click", () => window.print());
$("#purgeBtn").addEventListener("click", (e) => {
  const b = e.currentTarget;
  if (b.dataset.armed) { state.shelf = []; save(); renderShelf(); b.dataset.armed = ""; b.textContent = "✕ pulp the whole shelf"; }
  else { b.dataset.armed = "1"; b.textContent = "sure? click again to pulp"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "✕ pulp the whole shelf"; }, 2500); }
});
document.querySelectorAll(".tpl").forEach((t) =>
  t.addEventListener("click", () => {
    state.tpl = t.dataset.tpl;
    document.querySelectorAll(".tpl").forEach((x) => x.classList.toggle("is-active", x === t));
    renderPreview();
  })
);

// ---------- ambient: clock + ticker + canvas wind lines ----------
function clock() {
  const d = new Date();
  $("#roTime").textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
clock(); setInterval(clock, 15000);
$("#ticker").textContent += $("#ticker").textContent;

(function windlines() {
  const cv = $("#windfx"), cx = cv.getContext("2d");
  let W, H, parts = [];
  function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  size(); addEventListener("resize", size);
  const N = Math.min(90, Math.floor(innerWidth / 14));
  for (let i = 0; i < N; i++) parts.push({ x: Math.random() * 2000, y: Math.random() * 1200, s: 1 + Math.random() * 3, l: 30 + Math.random() * 120 });
  (function frame() {
    cx.clearRect(0, 0, W, H);
    const boost = state.wind ? state.wind.speed / 122 : 0.15;
    cx.lineWidth = 1;
    parts.forEach((p) => {
      const v = (1 + boost * 9) * p.s;
      cx.strokeStyle = Math.random() < 0.12 ? "rgba(255,43,214,.5)" : "rgba(0,240,255,.35)";
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.l * (0.4 + boost), p.y + p.l * 0.06); cx.stroke();
      p.x -= v; p.y += v * 0.06;
      if (p.x < -160) { p.x = W + 120; p.y = Math.random() * H; }
    });
    requestAnimationFrame(frame);
  })();
})();

// ---------- init ----------
renderWind();
renderPreview();
renderShelf();
console.log("zephyr-zine-machine ready — click only, no keys, no drag");
