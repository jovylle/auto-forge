// Silt Heron Hotel — retro-wave night-manager game.
// Check in heron guests, keep belly/plume/rest meters up, survive 5 nights.
// No images: backdrop is canvas-drawn, herons are pure CSS. Saves to localStorage.

const $ = (id) => document.getElementById(id);
const roomsEl = $("rooms"), lobbyEl = $("lobby"), logEl = $("log");

const SAVE_KEY = "silt-heron-hotel-v1";
const NIGHTS_TO_WIN = 5;
const ROOM_COUNT = 6;

const FIRST = ["Silt", "Marlow", "Reed", "Boggy", "Mire", "Laguna", "Sedge", "Tidal"];
const LAST = ["Egretson", "Herondale", "Plume", "Wader", "Beakley", "Marsh", "Stilter", "Crest"];
const PLUMES = ["#9be8ff", "#ffb3dd", "#ffe89b", "#c3ffb3", "#d3b3ff", "#ffb38a"];
const TIERS = [
  { name: "POND", fee: 12, rate: 10 },
  { name: "REED", fee: 20, rate: 16 },
  { name: "DELTA", fee: 30, rate: 24 },
];

let S; // game state
let uid = 1;

function newGuest() {
  const tier = Math.random() < 0.55 ? 0 : Math.random() < 0.75 ? 1 : 2;
  return {
    id: uid++,
    name: FIRST[(Math.random() * FIRST.length) | 0] + " " + LAST[(Math.random() * LAST.length) | 0],
    plume: PLUMES[(Math.random() * PLUMES.length) | 0],
    tier,
    belly: 60 + ((Math.random() * 30) | 0),
    plumeM: 60 + ((Math.random() * 30) | 0),
    rest: 60 + ((Math.random() * 30) | 0),
    patience: 100,
    grumpy: false,
  };
}

function freshState() {
  return {
    night: 1, credits: 40, rep: 60,
    rooms: Array.from({ length: ROOM_COUNT }, () => null),
    lobby: [newGuest(), newGuest()],
    sel: null, // {kind:'lobby'|'room', idx}
    cool: 0, // per-room service cooldown timestamp per room idx
    cools: {},
    log: [], ledger: [],
    over: null, muted: S ? S.muted : false,
    best: S ? S.best : loadBest(),
    served: 0, earned: 0,
  };
}

function loadBest() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY + "-best")) || null; } catch { return null; }
}
function saveBest() {
  try { localStorage.setItem(SAVE_KEY + "-best", JSON.stringify(S.best)); } catch {}
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      night: S.night, credits: S.credits, rep: S.rep, rooms: S.rooms,
      lobby: S.lobby, ledger: S.ledger.slice(-60), served: S.served,
      earned: S.earned, muted: S.muted, best: S.best,
    }));
  } catch {}
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && typeof d.night === "number" && Array.isArray(d.rooms) && d.rooms.length === ROOM_COUNT) {
      S = Object.assign(freshState(), d, { sel: null, over: null, log: [], cools: {} });
      say(`Welcome back, manager. Resuming <b>night ${S.night}</b>.`);
      // shared-link score banner
      const m = location.hash.match(/stay=([A-Za-z0-9+/=]+)/);
      if (m) {
        try {
          const s = JSON.parse(atob(m[1]));
          say(`A rival hotel brags: <b>${esc(s.n)} nights, ₡${esc(String(s.c))}</b>. Beat it!`);
        } catch {}
      }
      return;
    }
  } catch {}
  S = freshState();
}

// ---------- helpers ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function say(html) {
  S.log.unshift(`<span class="t">N${S.night}</span>${html}`);
  if (S.log.length > 60) S.log.pop();
  logEl.innerHTML = S.log.map((l) => `<li>${l}</li>`).join("");
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
}
function mood(g) { return Math.round((g.belly + g.plumeM + g.rest) / 3); }
function stars(rep) {
  const n = rep >= 80 ? 5 : rep >= 60 ? 4 : rep >= 40 ? 3 : rep >= 20 ? 2 : 1;
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ---------- tiny synth (no audio files) ----------
let AC = null;
function blip(freq, dur = 0.09, type = "square", vol = 0.05) {
  if (S.muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch {}
}

// ---------- rendering ----------
function heronHTML(g) {
  return `<span class="heron" style="--plume:${g.plume}" aria-hidden="true">
    <span class="legs"></span><span class="body"></span><span class="wing"></span>
    <span class="neck"></span><span class="head"></span><span class="beak"></span></span>`;
}
function meterHTML(label, v) {
  const c = v > 55 ? "var(--good)" : v > 25 ? "var(--orange)" : "var(--bad)";
  return `<div class="meter${v <= 25 ? " low" : ""}"><label><span>${label}</span><span>${Math.round(v)}</span></label>
    <div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${c}"></i></div></div>`;
}
function render() {
  $("hudNight").innerHTML = `${S.night}<span class="dim">/${NIGHTS_TO_WIN}</span>`;
  $("hudCredits").textContent = `₡${S.credits}`;
  $("hudRep").textContent = stars(S.rep);
  $("btnSound").textContent = S.muted ? "♪ off" : "♪ on";
  $("best").textContent = S.best ? `best: night ${S.best.night} · ₡${S.best.credits} · ${stars(S.best.rep)}` : "best: —";
  $("lobbyCount").textContent = `(${S.lobby.length}/4)`;

  lobbyEl.innerHTML = S.lobby.length ? S.lobby.map((g, i) => `
    <div class="guest${S.sel && S.sel.kind === "lobby" && S.sel.idx === i ? " sel" : ""}" data-lobby="${i}" role="button" tabindex="0" aria-label="guest ${esc(g.name)}">
      ${heronHTML(g)}
      <div><div class="gname">${esc(g.name)}</div>
      <div class="gtier">${TIERS[g.tier].name} · fee ₡${TIERS[g.tier].fee}</div>
      <div class="gpat"><i style="width:${g.patience}%"></i></div></div>
    </div>`).join("")
    : `<span class="empty-note">lobby quiet… new herons wading in soon</span>`;

  roomsEl.innerHTML = S.rooms.map((g, i) => {
    const sel = S.sel && S.sel.kind === "room" && S.sel.idx === i;
    if (!g) return `<div class="room vacant${sel ? " sel" : ""}" data-room="${i}" role="button" tabindex="0" aria-label="vacant room ${i + 1}">
      <div class="rno">ROOM 10${i + 1}</div><div class="vac-label">+ vacant</div></div>`;
    return `<div class="room occ${sel ? " sel" : ""}${mood(g) <= 25 ? " grumpy" : ""}" data-room="${i}" role="button" tabindex="0" aria-label="room ${i + 1}, ${esc(g.name)}">
      <div class="rno">ROOM 10${i + 1} · ${TIERS[g.tier].name}</div>
      <div class="occ-head">${heronHTML(g)}<span class="gname">${esc(g.name)}</span></div>
      ${meterHTML("🐟 belly", g.belly)}${meterHTML("✨ plume", g.plumeM)}${meterHTML("🌙 rest", g.rest)}
    </div>`;
  }).join("");

  // service panel
  const p = $("panel");
  if (S.sel && S.sel.kind === "room" && S.rooms[S.sel.idx]) {
    const g = S.rooms[S.sel.idx];
    p.classList.remove("hidden");
    $("panelTitle").textContent = `ROOM 10${S.sel.idx + 1} — ${g.name}`;
    $("panelMeters").innerHTML =
      meterHTML("🐟 belly", g.belly) + meterHTML("✨ plume", g.plumeM) + meterHTML("🌙 rest", g.rest);
    const cd = (S.cools[S.sel.idx] || 0) - Date.now();
    document.querySelectorAll(".act").forEach((b) => { b.disabled = cd > 0 || !!S.over; });
    $("cooldown").textContent = cd > 0 ? `staff catching breath… ${Math.ceil(cd / 1000)}s` : `mood ${mood(g)}% · checkout pays ₡${TIERS[g.tier].rate}`;
  } else p.classList.add("hidden");

  $("btnNight").disabled = !!S.over;
  persist();
}

// floating +₡ popup on a room card
function pop(roomIdx, text, color = "var(--good)") {
  const card = roomsEl.querySelector(`[data-room="${roomIdx}"]`);
  if (!card) return;
  const s = document.createElement("span");
  s.className = "pop"; s.style.color = color; s.textContent = text;
  card.appendChild(s);
  setTimeout(() => s.remove(), 1450);
}

// ---------- actions ----------
function selectLobby(i) {
  S.sel = { kind: "lobby", idx: i };
  $("hint").textContent = `${S.lobby[i].name} selected → tap a vacant room to check in (₡${TIERS[S.lobby[i].tier].fee}).`;
  blip(660); render();
}
function clickRoom(i) {
  const occ = S.rooms[i];
  if (S.sel && S.sel.kind === "lobby" && !occ) {
    const g = S.lobby[S.sel.idx];
    const fee = TIERS[g.tier].fee;
    S.credits += fee; S.earned += fee;
    S.rooms[i] = g;
    S.lobby.splice(S.sel.idx, 1);
    S.sel = { kind: "room", idx: i };
    S.ledger.push(`N${S.night} ✓ ${g.name} → room 10${i + 1} (+₡${fee})`);
    say(`<b>${esc(g.name)}</b> checked into room 10${i + 1} (+₡${fee}).`);
    blip(880, 0.12); pop(i, `+₡${fee}`);
    render(); return;
  }
  if (occ) {
    S.sel = { kind: "room", idx: i };
    $("hint").textContent = `Room 10${i + 1}: feed, preen or hush ${occ.name}.`;
    blip(520); render();
  } else {
    $("hint").textContent = S.lobby.length
      ? "That room is vacant — first pick a guest in the lobby."
      : "No guests waiting. They'll wade in shortly…";
    render();
  }
}
function serve(act) {
  if (!S.sel || S.sel.kind !== "room") return;
  const i = S.sel.idx, g = S.rooms[i];
  if (!g || (S.cools[i] || 0) > Date.now()) return;
  S.cools[i] = Date.now() + 2500;
  if (act === "feed") g.belly = Math.min(100, g.belly + 38);
  if (act === "preen") g.plumeM = Math.min(100, g.plumeM + 38);
  if (act === "hush") g.rest = Math.min(100, g.rest + 38);
  S.served++;
  const m = mood(g);
  if (m >= 75) {
    const tip = 4 + g.tier * 3;
    S.credits += tip; S.earned += tip; S.rep = Math.min(100, S.rep + 1);
    pop(i, `+₡${tip} ♥`); say(`<b>${esc(g.name)}</b> is glowing (mood ${m}%) — tip +₡${tip}.`);
    blip(990, 0.12);
  } else {
    say(`Served <b>${esc(g.name)}</b>: ${act} → mood ${m}%.`);
    blip(740, 0.08);
  }
  S.ledger.push(`N${S.night} ${act} ${g.name} (mood ${m}%)`);
  render();
  setTimeout(render, 2600); // refresh cooldown state
}

function endNight() {
  if (S.over) return;
  let income = 0;
  S.rooms.forEach((g, i) => {
    if (!g) return;
    const m = mood(g);
    if (m >= 40) {
      const pay = TIERS[g.tier].rate;
      income += pay;
      S.ledger.push(`N${S.night} ✈ ${g.name} paid ₡${pay} (mood ${m}%)`);
      say(`<b>${esc(g.name)}</b> checked out happy — paid ₡${pay}.`);
      pop(i, `+₡${pay}`);
    } else {
      const pay = Math.floor(TIERS[g.tier].rate / 2);
      income += pay; S.rep = Math.max(0, S.rep - 6);
      S.ledger.push(`N${S.night} ✈ ${g.name} grumbled, paid ₡${pay} (mood ${m}%)`);
      say(`<b>${esc(g.name)}</b> checked out grumpy — half pay, rep −6.`);
      pop(i, `+₡${pay}`, "var(--bad)");
    }
    S.rooms[i] = null;
  });
  S.credits += income; S.earned += income;
  // weary staff bonus: happy full house
  S.night++;
  blip(440, 0.2, "sine");
  if (S.night > NIGHTS_TO_WIN) return gameOver(true);
  S.rep = Math.min(100, S.rep + 2);
  S.sel = null;
  say(`—— <b>Night ${S.night} begins.</b> Fresh sheets, neon on. ——`);
  // new arrivals for the new night
  while (S.lobby.length < 3) S.lobby.push(newGuest());
  if (S.rep <= 0) return gameOver(false);
  render();
}

function gameOver(won) {
  won = won && S.rep > 0;
  S.over = won ? "win" : "lose";
  const rec = { night: Math.min(S.night, NIGHTS_TO_WIN + 1) - 1 || NIGHTS_TO_WIN, credits: S.credits, rep: S.rep };
  if (!S.best || S.credits > S.best.credits) { S.best = rec; saveBest(); }
  persist(); render();
  showOverlay(
    won ? "★ SOLD-OUT LEGEND ★" : "✕ HOTEL CONDEMNED ✕",
    won
      ? `<p>You ran all ${NIGHTS_TO_WIN} nights with rep ${S.rep}. The herons will tell every marsh from here to the static sea.</p>
         <p>Final purse: <b>₡${S.credits}</b> · guests pampered: <b>${S.served}</b> · ledger lines: <b>${S.ledger.length}</b></p>
         <p>Share your ledger below, or start a new season.</p>`
      : `<p>The neon buzzes out on night ${S.night}. Rep hit rock bottom — the herons migrate elsewhere.</p>
         <p>Purse: <b>₡${S.credits}</b>. The silt remembers. Try again?</p>`
  );
  blip(won ? 1320 : 220, 0.3, won ? "square" : "sawtooth");
}

// ---------- tick ----------
function tick() {
  if (S.over) return;
  // decay needs
  S.rooms.forEach((g) => {
    if (!g) return;
    g.belly = Math.max(0, g.belly - (1.5 + Math.random() * 2));
    g.plumeM = Math.max(0, g.plumeM - (1 + Math.random() * 1.6));
    g.rest = Math.max(0, g.rest - (1.2 + Math.random() * 1.8));
    if ((g.belly === 0 || g.plumeM === 0 || g.rest === 0) && !g.grumpy) {
      g.grumpy = true; S.rep = Math.max(0, S.rep - 3);
      say(`<b>${esc(g.name)}</b> is MISERABLE — rep −3! Serve them!`);
    } else if (mood(g) > 30) g.grumpy = false;
  });
  // lobby patience
  for (let i = S.lobby.length - 1; i >= 0; i--) {
    S.lobby[i].patience -= 4 + Math.random() * 4;
    if (S.lobby[i].patience <= 0) {
      const g = S.lobby.splice(i, 1)[0];
      S.rep = Math.max(0, S.rep - 2);
      S.ledger.push(`N${S.night} ✗ ${g.name} stormed out (waited too long)`);
      say(`<b>${esc(g.name)}</b> stormed out of the lobby — rep −2.`);
      if (S.sel && S.sel.kind === "lobby") S.sel = null;
    }
  }
  // arrivals
  if (S.lobby.length < 4 && Math.random() < 0.16) {
    const g = newGuest();
    S.lobby.push(g);
    say(`A new heron wades in: <b>${esc(g.name)}</b> (${TIERS[g.tier].name}).`);
  }
  if (S.rep <= 0) { gameOver(false); return; }
  render();
}

// ---------- share / export ----------
function ledgerText() {
  return [
    `~ SILT HERON HOTEL — night-ledger ~`,
    `nights: ${Math.min(S.night, NIGHTS_TO_WIN)}/${NIGHTS_TO_WIN} · credits: ₡${S.credits} · rep: ${S.rep} (${stars(S.rep)})`,
    `served: ${S.served} · earned: ₡${S.earned}`,
    `---`,
    ...S.ledger,
    `---`,
    `Can you out-manage me? Play SILT HERON HOTEL.`,
  ].join("\n");
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); toast(msg); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(msg); } catch { toast("copy blocked — sorry!"); }
    ta.remove();
  }
}

// ---------- overlay ----------
function showOverlay(title, html) {
  $("ovTitle").textContent = title;
  $("ovBody").innerHTML = html;
  $("overlay").classList.remove("hidden");
}
function showHelp() {
  showOverlay("How to play", `
    <p>You're the night manager of a neon hotel on the marsh. Herons wade into your <b>lobby</b> — give them rooms and keep them blissful for <b>${NIGHTS_TO_WIN} nights</b>.</p>
    <p><kbd>click guest</kbd> then <kbd>click vacant room</kbd> to check in (collect the fee). <kbd>click occupied room</kbd>, then <b>Feed / Preen / Hush</b> to refill meters.</p>
    <p>Meters drain in real time. Empty meter = miserable heron = lost rep. Lobby guests lose patience and storm out. Press <b>☾ End night</b> to collect checkout pay.</p>
    <p>Win: finish night ${NIGHTS_TO_WIN} with rep above 0. Lose: rep hits rock bottom.</p>`);
}

// ---------- canvas backdrop: retro sun + grid + stars + herons ----------
function startSky() {
  const cv = $("sky"), ctx = cv.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, stars = [], birds = [], t = 0;
  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.width = window.innerWidth * dpr; H = cv.height = window.innerHeight * dpr;
    cv.style.width = window.innerWidth + "px"; cv.style.height = window.innerHeight + "px";
    stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.6, r: Math.random() * 1.6 * dpr + 0.4, p: Math.random() * 6.28 }));
    birds = Array.from({ length: 4 }, (_, i) => ({ x: Math.random() * W, y: H * (0.15 + Math.random() * 0.3), s: (0.6 + Math.random()) * dpr, v: (0.4 + Math.random() * 0.5) * dpr, o: i * 1.7 }));
  }
  size(); addEventListener("resize", size);
  function frame() {
    t += 0.016;
    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0d0221"); sky.addColorStop(0.55, "#2b0a54"); sky.addColorStop(0.72, "#7b2ff7"); sky.addColorStop(0.8, "#ff2e88");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // stars
    for (const s of stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p));
      ctx.fillStyle = "#fff"; ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // sun
    const cx = W / 2, cr = Math.min(W, H) * 0.22, sy = H * 0.62;
    const sun = ctx.createLinearGradient(0, sy - cr, 0, sy + cr);
    sun.addColorStop(0, "#ffe89b"); sun.addColorStop(0.5, "#ff9e2c"); sun.addColorStop(1, "#ff2e88");
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(cx, sy, cr, Math.PI, 0); ctx.fill();
    // sun slats
    ctx.fillStyle = "#0d0221";
    let yy = sy - cr;
    for (let i = 0; i < 6; i++) { const h = 2 + i * i * 0.6; ctx.fillRect(cx - cr - 4, yy, cr * 2 + 8, h); yy += cr / 6; }
    ctx.beginPath(); ctx.arc(cx, sy, cr, 0, Math.PI); ctx.fill();
    // grid floor
    const hz = sy + cr * 0.12;
    ctx.strokeStyle = "#ff2e88"; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(W, hz); ctx.stroke();
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * W * 0.02, hz); ctx.lineTo(cx + i * W * 0.16, H); ctx.stroke();
    }
    const off = (t * 30) % 40;
    for (let j = 0; j < 7; j++) {
      const y = hz + ((j * 40 + off) / (7 * 40)) * (H - hz);
      ctx.globalAlpha = 0.25 + j * 0.1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // distant herons (canvas silhouettes: body + neck + wings)
    ctx.strokeStyle = "#12082e"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    for (const b of birds) {
      b.x += b.v; if (b.x > W + 40) b.x = -40;
      const flap = Math.sin(t * 6 + b.o) * 8 * b.s;
      ctx.beginPath();
      ctx.moveTo(b.x - 14 * b.s, b.y - flap); ctx.quadraticCurveTo(b.x, b.y + 3 * b.s, b.x + 14 * b.s, b.y - flap);
      ctx.stroke();
      ctx.fillStyle = "#12082e";
      ctx.fillRect(b.x - 1.5, b.y - 2, 3, 7 * b.s); // dangling legs
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  frame();
}

// ---------- wiring ----------
lobbyEl.addEventListener("click", (e) => {
  const c = e.target.closest("[data-lobby]");
  if (c && !S.over) selectLobby(+c.dataset.lobby);
});
roomsEl.addEventListener("click", (e) => {
  const c = e.target.closest("[data-room]");
  if (c && !S.over) clickRoom(+c.dataset.room);
});
lobbyEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const c = e.target.closest("[data-lobby]");
    if (c && !S.over) { e.preventDefault(); selectLobby(+c.dataset.lobby); }
  }
});
roomsEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const c = e.target.closest("[data-room]");
    if (c && !S.over) { e.preventDefault(); clickRoom(+c.dataset.room); }
  }
});
document.querySelectorAll(".act").forEach((b) =>
  b.addEventListener("click", () => serve(b.dataset.act)));
$("panelClose").addEventListener("click", () => { S.sel = null; render(); });
$("btnNight").addEventListener("click", endNight);
$("btnSound").addEventListener("click", () => { S.muted = !S.muted; render(); });
$("btnHelp").addEventListener("click", showHelp);
$("ovClose").addEventListener("click", () => $("overlay").classList.add("hidden"));
$("overlay").addEventListener("click", (e) => {
  if (e.target.id === "overlay") $("overlay").classList.add("hidden");
});
$("btnCopy").addEventListener("click", () => copyText(ledgerText(), "ledger copied — paste it anywhere"));
$("btnSave").addEventListener("click", () => {
  const blob = new Blob([ledgerText()], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `silt-heron-ledger-night${S.night}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("ledger downloaded");
});
$("btnLink").addEventListener("click", () => {
  const payload = btoa(JSON.stringify({ n: NIGHTS_TO_WIN, c: S.credits }));
  const url = `${location.origin}${location.pathname}#stay=${payload}`;
  copyText(url, "share link copied — challenge a friend");
});
$("btnNew").addEventListener("click", () => {
  if (S.ledger.length && !confirm("Start over? Current season is wiped.")) return;
  const best = S.best, muted = S.muted;
  S = freshState(); S.best = best; S.muted = muted;
  say("New season. The neon hums on. Herons incoming…");
  render();
});

// ---------- boot ----------
restore();
S.best = S.best || loadBest();
if (!S.log.length) say("Night shift starts. The marsh glows pink. Herons incoming…");
render();
startSky();
setInterval(tick, 1000);
console.log("silt-heron-hotel ready");
