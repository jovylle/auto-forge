const HOURS = [20, 21, 22, 23, 0, 1, 2];
const ECHOES = [
  "A lantern crossed the river.",
  "The fog is carrying someone else's song.",
  "I left light under the third bridge.",
  "The night is louder near the water.",
  "A wingbeat answered from the east.",
  "Someone tuned in just before dawn."
];
const SWARM_SIZE = 18;

const state = {
  hour: 21,
  sent: read("moth-radio-signals", []),
  lunar: false
};

const dial = document.querySelector("#dial");
const hourReadout = document.querySelector("#hourReadout");
const issueNo = document.querySelector("#issueNo");
const signalCount = document.querySelector("#signalCount");
const activeCount = document.querySelector("#activeCount");
const sentSignals = document.querySelector("#sentSignals");
const echoes = document.querySelector("#echoes");
const swarm = document.querySelector("#swarm");
const signal = document.querySelector("#signal");
const send = document.querySelector("#send");
const moon = document.querySelector("#moon");
const lunar = document.querySelector("#lunar");
let audio;
let moonClicks = 0;
let moonTimer;

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function pad(value) { return String(value).padStart(2, "0"); }
function hash(value) {
  return [...String(value)].reduce((total, char) => total + char.charCodeAt(0), 0);
}
function tone() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(state.hour >= 23 || state.hour < 1 ? 330 : 220, audio.currentTime);
    gain.gain.setValueAtTime(.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.05, audio.currentTime + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .32);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + .34);
  } catch {}
}
function formatHour(hour) { return `${pad(hour)}:00`; }
function activeMoths() {
  const seed = hash(`${state.hour}:${state.sent.length}`);
  return Array.from({ length: SWARM_SIZE }, (_, index) => (index * 7 + seed + state.hour * 3) % 5 < 2);
}
function renderDial() {
  dial.innerHTML = "";
  HOURS.forEach(hour => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hour";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(hour === state.hour));
    button.textContent = pad(hour);
    button.addEventListener("click", () => {
      state.hour = hour;
      tone();
      render();
    });
    dial.append(button);
  });
}
function renderSignals() {
  sentSignals.innerHTML = "";
  state.sent.slice(-5).reverse().forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${pad(state.sent.length - index)}</span><p></p><time>${item.at}</time>`;
    li.querySelector("p").textContent = item.text;
    sentSignals.append(li);
  });
  if (!state.sent.length) sentSignals.innerHTML = `<li class="empty">No transmissions yet.</li>`;

  echoes.innerHTML = "";
  const visible = state.sent.slice(-3).map((item, index) => ECHOES[(hash(item.text) + index) % ECHOES.length]);
  visible.forEach((text, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${pad(index + 1)}</span><p></p><time>just now</time>`;
    li.querySelector("p").textContent = text;
    echoes.append(li);
  });
  if (!visible.length) echoes.innerHTML = `<li class="empty">Tune the dial to listen.</li>`;
  signalCount.textContent = pad(state.sent.length);
}
function renderSwarm() {
  swarm.innerHTML = "";
  const active = activeMoths();
  activeCount.textContent = `${pad(active.filter(Boolean).length)} moths awake`;
  active.forEach((awake, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `moth${awake ? " awake" : ""}`;
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `Trade with moth ${pad(index + 1)}${awake ? ", tuned to this hour" : ""}`);
    button.innerHTML = `<i></i><span>${pad(index + 1)}</span>`;
    button.addEventListener("click", () => {
      const text = ECHOES[(index + state.hour) % ECHOES.length];
      state.sent.push({ text, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
      write("moth-radio-signals", state.sent);
      tone();
      render();
      send.animate([{ transform: "translateX(0)" }, { transform: "translateX(7px)" }, { transform: "translateX(0)" }], { duration: 260 });
    });
    swarm.append(button);
  });
}
function render() {
  hourReadout.value = formatHour(state.hour);
  issueNo.textContent = pad(state.hour + 1);
  renderDial();
  renderSignals();
  renderSwarm();
}
function sendSignal() {
  const text = signal.value.trim();
  if (!text) {
    signal.focus();
    signal.animate([{ boxShadow: "0 0 0 0 var(--amber)" }, { boxShadow: "0 0 0 3px var(--amber)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 450 });
    return;
  }
  state.sent.push({ text, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  write("moth-radio-signals", state.sent);
  signal.value = "";
  tone();
  render();
}
function openLunar() {
  state.lunar = true;
  lunar.setAttribute("aria-hidden", "false");
  lunar.classList.add("open");
  document.body.classList.add("lunar-open");
  tone();
  window.setTimeout(closeLunar, 2600);
}
function closeLunar() {
  state.lunar = false;
  lunar.setAttribute("aria-hidden", "true");
  lunar.classList.remove("open");
  document.body.classList.remove("lunar-open");
}
send.addEventListener("click", sendSignal);
signal.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") sendSignal();
});
moon.addEventListener("click", () => {
  moonClicks += 1;
  clearTimeout(moonTimer);
  moonTimer = setTimeout(() => { moonClicks = 0; }, 1200);
  if (moonClicks === 3) openLunar();
});
document.addEventListener("keydown", event => {
  if ((event.key === "l" || event.key === "L") && !event.metaKey && !event.ctrlKey && !event.altKey) {
    state.lunar ? closeLunar() : openLunar();
  }
});

render();
