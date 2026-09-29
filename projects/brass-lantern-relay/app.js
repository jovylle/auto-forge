// Brass Lantern Relay — wind-physics keyboard-only relay game.
// Move with momentum (←/→), shelter by leaning into wind, SPACE stokes, ENTER passes flame.
const $ = (id) => document.getElementById(id);
const track = $("track"), postsEl = $("posts"), playerEl = $("player"),
  flameBar = $("flameBar"), oilBar = $("oilBar"), flameNum = $("flameNum"),
  oilNum = $("oilNum"), windNum = $("windNum"), windBars = $("windBars"),
  timeNum = $("timeNum"), bestNum = $("bestNum"), statusEl = $("status"),
  logEl = $("log"), passHint = $("passHint"), windArrow = $("windArrow");

const POST_X = [6, 27, 50, 73, 94]; // percent along track
const PASS_DIST = 5.5;
const BEST_KEY = "brass-lantern-relay-best";
const MUTE_KEY = "brass-lantern-relay-mute";

const S = {
  phase: "ready", // ready | running | paused | won | lost
  x: 2, v: 0,
  flame: 100, oil: 100,
  wind: 0, windTimer: 0,
  lit: 0, nextPost: 0,
  t: 0, stokeCd: 0,
  keys: { left: false, right: false },
  muted: localStorage.getItem(MUTE_KEY) === "1",
  best: parseFloat(localStorage.getItem(BEST_KEY) || "0"),
  sparks: [],
};

// ---- tiny sound engine (WebAudio, no assets) ----
let AC = null;
function beep(freq, dur = 0.08, type = "square", gain = 0.04) {
  if (S.muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(AC.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur);
  } catch { /* audio unavailable — game still works */ }
}

// ---- track posts ----
function buildPosts() {
  postsEl.innerHTML = "";
  POST_X.forEach((px, i) => {
    const d = document.createElement("div");
    d.className = "post" + (i === 0 ? " next" : "");
    d.style.left = px + "%";
    d.innerHTML = `<div class="halo"></div><div class="lamp" aria-hidden="true">🏮</div><div class="pole"></div><div class="tag">POST ${i + 1}</div>`;
    d.id = "post" + i;
    postsEl.appendChild(d);
  });
}
function markPosts() {
  POST_X.forEach((_, i) => {
    const d = $("post" + i);
    if (!d) return;
    d.classList.toggle("lit", i < S.lit);
    d.classList.toggle("next", i === S.nextPost && S.phase === "running");
  });
}

// ---- log ----
function log(msg) {
  const li = document.createElement("li");
  li.textContent = `${S.t.toFixed(1)}s — ${msg}`;
  logEl.prepend(li);
  while (logEl.children.length > 30) logEl.lastChild.remove();
}

// ---- wind ----
function newWind() {
  // gusts: -9..+9, biased to extremes for drama
  const m = 4 + Math.random() * 5;
  S.wind = (Math.random() < 0.5 ? -1 : 1) * m;
  S.windTimer = 2.5 + Math.random() * 3.5;
}
function renderWind() {
  const w = S.wind;
  const dir = w === 0 ? "·" : w > 0 ? "→" : "←";
  windNum.textContent = `${dir} ${Math.abs(w).toFixed(0)}`;
  windArrow.textContent = w >= 0 ? "→" : "←";
  windArrow.style.color = w >= 0 ? "var(--brass)" : "var(--rust)";
  windBars.innerHTML = "";
  const n = Math.round(Math.abs(w));
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("i");
    b.style.height = (4 + (i < n ? 12 : 2)) + "px";
    b.style.opacity = i < n ? "1" : ".25";
    if (w < 0) b.classList.add("neg");
    windBars.appendChild(b);
  }
}

// ---- game flow ----
function reset() {
  S.phase = "ready"; S.x = 2; S.v = 0;
  S.flame = 100; S.oil = 100;
  S.lit = 0; S.nextPost = 0; S.t = 0; S.stokeCd = 0;
  S.wind = 3; S.windTimer = 3;
  logEl.innerHTML = "";
  buildPosts(); markPosts();
  statusEl.className = "status";
  statusEl.innerHTML = `Press <kbd>Enter</kbd> or <kbd>Space</kbd> to light the first lantern and start the relay.`;
  passHint.hidden = true;
  updateHUD();
}
function start() {
  if (S.phase === "running") return;
  if (S.phase === "won" || S.phase === "lost") reset();
  S.phase = "running";
  newWind();
  log("Relay started — flame lit at the gate.");
  status("Run! Lean INTO the wind to shelter the flame. Reach the flashing post.");
  beep(330, .12); setTimeout(() => beep(495, .12), 110);
  track.focus({ preventScroll: true });
  markPosts();
}
function togglePause() {
  if (S.phase === "running") { S.phase = "paused"; status("Paused. Press P to resume."); log("Paused."); }
  else if (S.phase === "paused") { S.phase = "running"; status("Back on the line — go!"); }
}
function win() {
  S.phase = "won";
  passHint.hidden = true;
  const bonus = Math.round(S.flame + S.oil);
  const score = { t: S.t, bonus, flame: Math.round(S.flame), oil: Math.round(S.oil) };
  const isBest = !S.best || S.t < S.best;
  if (isBest) { S.best = S.t; localStorage.setItem(BEST_KEY, String(S.t)); }
  statusEl.classList.add("win");
  status(`🏆 ALL FIVE LANTERNS LIT in ${S.t.toFixed(1)}s ${isBest ? "— NEW BEST!" : ""} Press R for another run.`);
  log(`Finished in ${S.t.toFixed(1)}s (flame ${score.flame}, oil ${score.oil})${isBest ? " — BEST" : ""}.`);
  fanfare();
  markPosts(); updateHUD();
}
function lose(reason) {
  S.phase = "lost";
  passHint.hidden = true;
  status(`Snuffed out — ${reason} Press R to try again.`);
  log(`Lost: ${reason}.`);
  beep(160, .3, "sawtooth");
  markPosts();
}
function status(html) { statusEl.innerHTML = html; }
function fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .12), i * 110)); }

// ---- actions ----
function stoke() {
  if (S.phase !== "running") { start(); return; }
  if (S.stokeCd > 0 || S.oil < 8) { beep(120, .06, "square"); return; }
  S.flame = Math.min(100, S.flame + 18);
  S.oil = Math.max(0, S.oil - 10);
  S.stokeCd = 1.2;
  playerEl.classList.remove("stoke"); void playerEl.offsetWidth;
  playerEl.classList.add("stoke");
  burst();
  beep(220, .07, "square"); setTimeout(() => beep(440, .09, "square"), 70);
}
function passFlame() {
  if (S.phase !== "running") { start(); return; }
  const px = POST_X[S.nextPost];
  if (Math.abs(S.x - px) > PASS_DIST) {
    status(`Not at post ${S.nextPost + 1} yet — run to the flashing lantern, then press Enter.`);
    beep(140, .06); return;
  }
  if (S.flame < 25) {
    status(`Flame too weak to pass (${Math.round(S.flame)} < 25). Stoke with Space first!`);
    beep(140, .08); return;
  }
  S.flame = Math.max(10, S.flame - 8);
  S.oil = Math.min(100, S.oil + 35);
  S.lit++; S.nextPost++;
  log(`Post ${S.lit} lit! Oil cache claimed (+35).`);
  beep(660, .1); setTimeout(() => beep(880, .14), 100);
  if (S.lit >= POST_X.length) { win(); return; }
  status(`Post ${S.lit} lit! ${POST_X.length - S.lit} to go — run right, mind the wind.`);
  markPosts();
}
function burst() {
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    s.style.left = `calc(${S.x}% )`;
    s.style.bottom = "80px";
    track.appendChild(s);
    const dx = (Math.random() - .5) * 90, dy = -20 - Math.random() * 60;
    s.animate([{ transform: "translate(0,0)", opacity: 1 },
      { transform: `translate(${dx}px,${dy}px)`, opacity: 0 }],
      { duration: 400 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => s.remove();
  }
}

// ---- physics loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.phase === "running") {
    S.t += dt;
    // wind gusts evolve
    S.windTimer -= dt;
    if (S.windTimer <= 0) { newWind(); renderWind(); }
    // player physics: accel + wind shove + friction
    const ACC = 55, FRIC = 2.6, WIND_PUSH = 1.6;
    if (S.keys.left) S.v -= ACC * dt;
    if (S.keys.right) S.v += ACC * dt;
    S.v += S.wind * WIND_PUSH * dt;
    S.v -= S.v * FRIC * dt;
    S.v = Math.max(-38, Math.min(38, S.v));
    S.x = Math.max(1, Math.min(99, S.x + S.v * dt));
    if ((S.x === 1 || S.x === 99)) S.v *= 0.4;
    // flame decay: base + wind strip, reduced when sheltering (holding into wind)
    const leaningInto = (S.wind > 1 && S.keys.left) || (S.wind < -1 && S.keys.right);
    const still = !S.keys.left && !S.keys.right;
    let decay = 2.2 + Math.abs(S.wind) * 0.55;
    if (leaningInto) decay *= 0.35;
    else if (still) decay *= 0.8;
    else decay *= 1.25; // running with the wind exposes the flame
    if (Math.abs(S.v) > 25) decay += 1.2; // sprinting strips flame
    S.flame -= decay * dt;
    S.oil = Math.max(0, S.oil - 0.35 * dt);
    S.stokeCd = Math.max(0, S.stokeCd - dt);
    playerEl.classList.toggle("shelter", leaningInto);
    // pass hint
    const near = Math.abs(S.x - POST_X[S.nextPost]) <= PASS_DIST;
    passHint.hidden = !(near && S.flame >= 25);
    // lose checks
    if (S.flame <= 0) { S.flame = 0; lose("the flame guttered out in the wind."); }
    else if (S.oil <= 0 && S.flame < 12) { S.flame = 0; lose("oil ran dry and the flame starved."); }
    updateHUD();
  }
  // player position always rendered
  playerEl.style.left = S.x + "%";
  requestAnimationFrame(frame);
}
function updateHUD() {
  flameBar.style.width = S.flame + "%";
  oilBar.style.width = S.oil + "%";
  flameBar.classList.toggle("low", S.flame < 28);
  flameNum.textContent = Math.round(S.flame);
  oilNum.textContent = Math.round(S.oil);
  timeNum.textContent = S.t.toFixed(1) + "s";
  bestNum.textContent = S.best ? S.best.toFixed(1) + "s" : "—";
}

// ---- run card / share-export ----
function runCard() {
  const state = S.phase === "won" ? "FINISHED" : S.phase === "lost" ? "SNUFFED" : "IN PROGRESS";
  return [
    "🏮 BRASS LANTERN RELAY — run card",
    `status: ${state} · posts lit: ${S.lit}/5 · time: ${S.t.toFixed(1)}s`,
    `flame ${Math.round(S.flame)} · oil ${Math.round(S.oil)} · best ${S.best ? S.best.toFixed(1) + "s" : "—"}`,
    S.phase === "won" ? "All five lanterns burning. The night holds." : "The wind is still out there. Run it back. (R)",
    location.href.split("#")[0],
  ].join("\n");
}
async function copyCard() {
  const txt = runCard();
  try { await navigator.clipboard.writeText(txt); shareMsg("Run card copied — paste it anywhere."); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
    shareMsg("Run card copied (fallback) — paste it anywhere.");
  }
}
function downloadCard() {
  const blob = new Blob([runCard()], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `brass-lantern-relay-${S.t.toFixed(1)}s.txt`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  shareMsg("Run card downloaded as .txt.");
}
async function shareCard() {
  const txt = runCard();
  if (navigator.share) {
    try { await navigator.share({ title: "Brass Lantern Relay", text: txt }); shareMsg("Shared. May your flame hold."); }
    catch { /* user cancelled */ }
  } else copyCard();
}
function shareMsg(m) { $("shareMsg").textContent = m; }

// ---- keyboard (the ONLY control scheme — everything reachable by key) ----
const HELP_KEYS = ["?"];
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
  if (k === "ArrowLeft") { S.keys.left = true; if (S.phase === "ready") start(); return; }
  if (k === "ArrowRight") { S.keys.right = true; if (S.phase === "ready") start(); return; }
  if (k === " " ) { stoke(); return; }
  if (k === "Enter") {
    // if focus is on a button, let the button handle it natively
    if (document.activeElement && document.activeElement.tagName === "BUTTON") return;
    passFlame(); return;
  }
  const lk = k.toLowerCase();
  if (lk === "r") { reset(); start(); }
  else if (lk === "p") togglePause();
  else if (lk === "m") toggleMute();
  else if (lk === "c") copyCard();
  else if (lk === "d") downloadCard();
  else if (lk === "s") shareCard();
  else if (HELP_KEYS.includes(k)) {
    const d = document.querySelector(".howto");
    d.open = !d.open;
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") S.keys.left = false;
  if (e.key === "ArrowRight") S.keys.right = false;
});
function toggleMute() {
  S.muted = !S.muted;
  localStorage.setItem(MUTE_KEY, S.muted ? "1" : "0");
  $("btnMute").setAttribute("aria-pressed", String(S.muted));
  $("btnMute").firstChild.textContent = S.muted ? "✕ Muted " : "♪ Sound ";
}

// ---- buttons (all Tab-reachable, Enter/Space operable) ----
$("btnStart").addEventListener("click", () => { reset(); start(); });
$("btnPause").addEventListener("click", togglePause);
$("btnMute").addEventListener("click", toggleMute);
$("btnCopy").addEventListener("click", copyCard);
$("btnDl").addEventListener("click", downloadCard);
$("btnShare").addEventListener("click", shareCard);
if (S.muted) { $("btnMute").setAttribute("aria-pressed", "true"); $("btnMute").firstChild.textContent = "✕ Muted "; }

// ---- boot ----
reset();
if (S.best) bestNum.textContent = S.best.toFixed(1) + "s";
renderWind();
requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
console.log("brass-lantern-relay ready — keyboard only: ←/→ run, space stoke, enter pass");
