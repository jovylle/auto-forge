import './index.css'

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;

// ---------- tide model (synthetic harmonic, feet) ----------
const M2 = 12.4206012 * 3600;
const S2 = 12 * 3600;
const K1 = 23.93447 * 3600;
const MIN_FT = 0.4;
const MAX_FT = 7.6;

const rawH = (sec: number): number =>
  0.82 * Math.cos((2 * Math.PI * sec) / M2 + 0.4) +
  0.38 * Math.cos((2 * Math.PI * sec) / S2 - 0.9) +
  0.12 * Math.cos((2 * Math.PI * sec) / K1 + 1.7);

const toFeet = (h: number): number => {
  const n = Math.min(1, Math.max(0, (h + 1.35) / 2.7));
  return MIN_FT + n * (MAX_FT - MIN_FT);
};
const tideFeet = (sec: number): number => toFeet(rawH(sec));
const frac = (ft: number): number => (ft - MIN_FT) / (MAX_FT - MIN_FT);

function nextExtremum(secNow: number, kind: 'high' | 'low') {
  const end = secNow + M2 * 1.2;
  for (let s = secNow + 60; s < end; s += 60) {
    const h0 = tideFeet(s - 120), h1 = tideFeet(s), h2 = tideFeet(s + 120);
    if (kind === 'high' && h1 > h0 && h1 > h2) return { sec: s, ft: h1 };
    if (kind === 'low' && h1 < h0 && h1 < h2) return { sec: s, ft: h1 };
  }
  return null;
}

const fmtClock = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDur = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ---------- persisted alarm (localStorage only) ----------
interface Prefs { threshold: number; enabled: boolean }
const KEY = 'ivory-lowtide';
const PRESETS = { LOW: 1.5, MID: 3.0, HIGH: 4.5 } as const;
let prefs: Prefs = { threshold: 2.0, enabled: true };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const p = JSON.parse(raw) as Partial<Prefs>;
    if (typeof p.threshold === 'number') prefs.threshold = Math.min(MAX_FT, Math.max(MIN_FT, p.threshold));
    if (typeof p.enabled === 'boolean') prefs.enabled = p.enabled;
  }
} catch { /* in-memory fallback */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };

// ---------- app shell ----------
const app = $('#app');
app.innerHTML = `
  <div class="top-rule" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <header class="masthead">
    <div>
      <p class="kicker"><b>IL—01</b> &nbsp;BAUHAUS TIDE INSTRUMENT</p>
      <h1 class="word">Ivory <span class="l">Low</span><span class="t">tide</span></h1>
      <p class="sub">Read the tide in shades of ivory. A harbour staff, an ivory disc and a twenty-four hour chart — one instrument, three faces. Scroll to sound the depths.</p>
    </div>
    <div class="shapes" aria-hidden="true">
      <div class="shape-circle" id="shCircle"></div>
      <div class="shape-square" id="shSquare"></div>
      <div class="shape-tri" id="shTri"></div>
    </div>
  </header>
  <p class="scroll-hint">Scroll to read the tide <span class="bar"><i></i></span> click only — no typing, no dragging</p>

  <section aria-label="Tide reader" class="reveal" id="secReader">
    <h2 class="sec-label"><span class="n">01</span> Tide reader — now</h2>
    <div class="reader-grid">
      <div class="panel staff-panel">
        <p class="staff-title">Tide staff · ft</p>
        <div class="staff" id="staff"><div class="staff-ticks" id="staffTicks"></div><div class="staff-pointer" id="staffPointer"></div></div>
        <p class="staff-title" id="staffVal">—</p>
      </div>
      <div class="panel disc-panel" id="discPanel">
        <div class="disc-wrap">
          <button class="disc-btn" id="discBtn" type="button" aria-label="Toggle between current tide and next peak">
            <svg id="discSvg" width="250" height="250" viewBox="0 0 250 250" role="img" aria-label="Ivory disc tide gauge"></svg>
          </button>
          <div>
            <p class="disc-num"><span class="big" id="discNum">—</span><span class="unit">FEET · HARBOUR DATUM</span></p>
            <p><span class="disc-state" id="discState">—</span></p>
            <p class="disc-sub" id="discSub">—</p>
            <p class="disc-mode" id="discMode">MODE · NOW — CLICK DISC FOR NEXT PEAK</p>
          </div>
        </div>
        <p class="sr-only" aria-live="polite" id="discLive">—</p>
      </div>
      <div class="stack">
        <button class="chip-btn" id="chipBtn" type="button" aria-label="Toggle next tide detail">
          <h3 style="font-family:var(--font-mono2);font-size:.62rem;letter-spacing:.24em;margin:0 0 6px;">Direction — click</h3>
          <span class="row"><span class="tri" id="chipTri">▲</span><span><b class="v" id="chipWord" style="font-family:var(--font-display);font-size:1.8rem;">RISING</b><br><span class="s" id="chipSub" style="font-family:var(--font-mono2);font-size:.72rem;">—</span></span></span>
        </button>
        <div class="mini-card blue"><h3>Next high</h3><p class="v" id="nextHighV">—</p><p class="s" id="nextHighS">—</p></div>
        <div class="mini-card red"><h3>Next low</h3><p class="v" id="nextLowV">—</p><p class="s" id="nextLowS">—</p></div>
      </div>
    </div>
  </section>

  <section aria-label="Ivory chart" class="chart-section reveal" id="secChart">
    <h2 class="sec-label sec-b"><span class="n">02</span> Ivory chart — 24 hours</h2>
    <div class="panel chart-panel">
      <div class="chart-scroll">
        <p class="sticky-readout">SCRUB <b id="scrubTime">—</b> · <span id="scrubVal">—</span> · SCROLL OR CLICK CHART</p>
        <svg class="chart-svg" id="chartSvg" viewBox="0 0 720 260" role="img" aria-label="Twenty-four hour tide curve. Click to inspect an hour."></svg>
        <div class="hour-dots" id="hourDots" aria-label="Jump to hour"></div>
        <p class="chart-cap">Thick ink line = predicted height · red dot = now · yellow band = alarm threshold · click curve or hour to inspect</p>
      </div>
    </div>
  </section>

  <section aria-label="Lowtide alarm" class="alarm-section reveal" id="secAlarm">
    <h2 class="sec-label sec-c"><span class="n">03</span> Lowtide alarm — click to arm</h2>
    <div class="alarm-grid">
      <div class="panel scale-panel">
        <p class="staff-title">Threshold scale · ft</p>
        <div class="tscale" id="tscale"><div class="thresh-band" id="threshBand"></div><div class="thresh-line" id="threshLine"></div></div>
      </div>
      <div class="panel ctrl-panel">
        <p class="staff-title">Set level — click only</p>
        <p class="thresh-num"><span id="threshNum">2.0</span><span style="font-family:var(--font-mono2);font-size:.9rem;"> FT</span></p>
        <div class="stepper">
          <button class="minus" id="thMinus" type="button" aria-label="Decrease threshold by one tenth of a foot">−</button>
          <button class="plus" id="thPlus" type="button" aria-label="Increase threshold by one tenth of a foot">+</button>
        </div>
        <div class="presets" role="group" aria-label="Threshold presets">
          <button type="button" data-preset="LOW">LOW</button>
          <button type="button" data-preset="MID">MID</button>
          <button type="button" data-preset="HIGH">HIGH</button>
        </div>
        <button class="toggle-btn" id="alarmToggle" type="button" aria-pressed="true"><span class="box"></span><span id="alarmToggleLabel">ALARM ARMED</span></button>
        <p class="chart-cap">Saved to this browser only · survives reload</p>
      </div>
      <div class="panel status-panel" id="statusPanel">
        <p class="staff-title">Harbour status</p>
        <p class="status-big" id="statusBig">—</p>
        <p class="status-sub" id="statusSub">—</p>
      </div>
    </div>
  </section>

  <footer class="foot"><span>Ivory Lowtide · synthetic harmonic tide · local only</span><span id="footClock">—</span></footer>
`;

// ---------- disc gauge ----------
const discSvg = $('#discSvg') as unknown as SVGSVGElement;
const NS = 'http://www.w3.org/2000/svg';
function el(name: string, attrs: Record<string, string>) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
}
function wedgePath(cx: number, cy: number, r: number, deg: number) {
  if (deg <= 0.5) return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + 0.01} ${cy - r} Z`;
  if (deg >= 359.5) return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  const large = deg > 180 ? 1 : 0;
  const [x, y] = polar(cx, cy, r, deg).split(',').map(Number);
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
}
discSvg.appendChild(el('circle', { cx: '125', cy: '125', r: '116', fill: '#F2E8D5', stroke: '#16130F', 'stroke-width': '6' }));
const discWedge = el('path', { fill: '#16130F', stroke: 'none' });
discSvg.appendChild(discWedge);
for (let k = 0; k < 12; k++) {
  const a = (k / 12) * 360;
  const [x1, y1] = polar(125, 125, 104, a).split(',').map(Number);
  const [x2, y2] = polar(125, 125, 116, a).split(',').map(Number);
  discSvg.appendChild(el('line', { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), stroke: '#F2E8D5', 'stroke-width': '3' }));
}
const discHand = el('line', { x1: '125', y1: '125', x2: '125', y2: '18', stroke: '#D7263D', 'stroke-width': '6' });
discSvg.appendChild(discHand);
const discDot = el('circle', { cx: '125', cy: '18', r: '9', fill: '#D7263D', stroke: '#16130F', 'stroke-width': '3' });
discSvg.appendChild(discDot);
const discRing = el('circle', { cx: '125', cy: '125', r: '116', fill: 'none', stroke: '#D7263D', 'stroke-width': '0' });
discSvg.appendChild(discRing);

let discMode: 'now' | 'peak' = 'now';
$('#discBtn').addEventListener('click', () => {
  discMode = discMode === 'now' ? 'peak' : 'now';
  render(true);
});

// ---------- staff ticks (click scrolls to chart) ----------
const staffTicks = $('#staffTicks');
const tickHours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
for (const h of tickHours) {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.top = `${(h / 24) * 100}%`;
  b.setAttribute('aria-label', `Scroll to hour ${h} in chart`);
  b.innerHTML = `<span>${h === 24 ? '24' : String(h).padStart(2, '0')}:00</span>`;
  b.addEventListener('click', () => {
    setSelHour(h === 24 ? 0 : h);
    $('#secChart').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  });
  staffTicks.appendChild(b);
}

// ---------- chart ----------
const chartSvg = $('#chartSvg') as unknown as SVGSVGElement;
const W = 720, H = 260, PAD = 26;
const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
const t0 = Math.floor(midnight.getTime() / 1000);
const hours = Array.from({ length: 25 }, (_, i) => t0 + i * 3600);
const ftAt = (i: number) => tideFeet(hours[i]);
const fts = hours.map((_, i) => ftAt(i));
const x = (i: number) => PAD + (i / 24) * (W - PAD * 2);
const y = (ft: number) => H - PAD - frac(ft) * (H - PAD * 2);
const pathD = fts.map((ft, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(ft).toFixed(1)}`).join(' ');

// grid
for (let g = 0; g <= 4; g++) {
  const gy = PAD + (g / 4) * (H - PAD * 2);
  chartSvg.appendChild(el('line', { x1: String(PAD), y1: String(gy), x2: String(W - PAD), y2: String(gy), stroke: '#D9CDB4', 'stroke-width': '1.5', 'stroke-dasharray': '5 5' }));
}
for (let hIx = 0; hIx <= 24; hIx += 3) {
  chartSvg.appendChild(el('line', { x1: String(x(hIx)), y1: String(PAD), x2: String(x(hIx)), y2: String(H - PAD), stroke: '#D9CDB4', 'stroke-width': '1' }));
  const t = el('text', { x: String(x(hIx)), y: String(H - 6), 'text-anchor': 'middle', 'font-size': '11', fill: '#16130F', 'font-family': 'Space Mono, monospace' });
  t.textContent = `${hIx}:00`;
  chartSvg.appendChild(t);
}
// threshold band + line
const threshBand = el('rect', { x: String(PAD), y: '0', width: String(W - PAD * 2), height: '0', fill: 'rgba(244,180,0,0.4)' });
chartSvg.appendChild(threshBand);
const threshLine = el('line', { x1: String(PAD), y1: '0', x2: String(W - PAD), y2: '0', stroke: '#16130F', 'stroke-width': '3', 'stroke-dasharray': '8 4' });
chartSvg.appendChild(threshLine);
// curve
chartSvg.appendChild(el('path', { d: pathD, fill: 'none', stroke: '#16130F', 'stroke-width': '6', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
const selDot = el('circle', { r: '10', fill: '#F4B400', stroke: '#16130F', 'stroke-width': '4', cx: '0', cy: '0' });
chartSvg.appendChild(selDot);
const nowDot = el('circle', { r: '11', fill: '#D7263D', stroke: '#16130F', 'stroke-width': '4', cx: '0', cy: '0' });
chartSvg.appendChild(nowDot);

let selHour = new Date().getHours();
function setSelHour(h: number) { selHour = Math.min(24, Math.max(0, h)); render(true); }
chartSvg.addEventListener('click', (ev) => {
  const rect = (chartSvg as unknown as SVGGraphicsElement).getBoundingClientRect();
  const px = (ev.clientX - rect.left) / rect.width;
  const svgX = px * W;
  const hFloat = Math.round(((svgX - PAD) / (W - PAD * 2)) * 24);
  setSelHour(Math.min(24, Math.max(0, hFloat)));
});

// hour dots (click only)
const hourDots = $('#hourDots');
const dotBtns: HTMLButtonElement[] = [];
for (let h = 0; h < 24; h += 2) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = String(h).padStart(2, '0');
  b.setAttribute('aria-label', `Inspect hour ${h}`);
  b.addEventListener('click', () => setSelHour(h));
  hourDots.appendChild(b);
  dotBtns.push(b);
}

// ---------- alarm controls (click only) ----------
const threshNum = $('#threshNum');
const threshLineEl = $('#threshLine');
const threshBandEl = $('#threshBand');
const statusPanel = $('#statusPanel');
const statusBig = $('#statusBig');
const statusSub = $('#statusSub');
const alarmToggle = $('#alarmToggle') as HTMLButtonElement;
const alarmToggleLabel = $('#alarmToggleLabel');

function setThreshold(v: number) {
  prefs.threshold = Math.round(Math.min(MAX_FT, Math.max(MIN_FT, v)) * 10) / 10;
  save();
  render(true);
}
$('#thMinus').addEventListener('click', () => setThreshold(prefs.threshold - 0.1));
$('#thPlus').addEventListener('click', () => setThreshold(prefs.threshold + 0.1));
document.querySelectorAll<HTMLButtonElement>('.presets button').forEach((b) => {
  b.addEventListener('click', () => setThreshold(PRESETS[b.dataset.preset as keyof typeof PRESETS]));
});
alarmToggle.addEventListener('click', () => {
  prefs.enabled = !prefs.enabled;
  save();
  render(true);
});

// ---------- direction chip ----------
let chipFlip = false;
$('#chipBtn').addEventListener('click', () => { chipFlip = !chipFlip; render(true); });

// ---------- scroll reactions ----------
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let scrollProg = 0;
let chartVisible = false;
const secChart = $('#secChart');
const staffTickWrap = $('#staffTicks');
const shCircle = $('#shCircle'), shSquare = $('#shSquare'), shTri = $('#shTri');

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProg = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  const r = secChart.getBoundingClientRect();
  const vh = window.innerHeight;
  chartVisible = r.top < vh * 0.7 && r.bottom > vh * 0.3;
  // parallax + shape drift (scroll reaction)
  if (!reducedMotion) {
    staffTickWrap.style.transform = `translateY(${(scrollProg * 26).toFixed(1)}px)`;
    shCircle.style.transform = `translateY(${(scrollProg * -40).toFixed(1)}px) rotate(${(scrollProg * 120).toFixed(1)}deg)`;
    shSquare.style.transform = `translateY(${(scrollProg * 30).toFixed(1)}px) rotate(${(scrollProg * -90).toFixed(1)}deg)`;
    shTri.style.transform = `translateY(${(scrollProg * -24).toFixed(1)}px)`;
  }
  // scrub marker travels with scroll while chart section passes through viewport
  if (chartVisible && r.height > 0) {
    const secProg = Math.min(1, Math.max(0, (vh * 0.7 - r.top) / (r.height + vh * 0.4)));
    setSelHourSilent(Math.round(secProg * 24));
  }
  render(false);
}
window.addEventListener('scroll', onScroll, { passive: true });
function setSelHourSilent(h: number) { selHour = Math.min(24, Math.max(0, h)); }

// reveal on scroll (circle wipe)
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((s) => io.observe(s));

// ---------- render ----------
const discNum = $('#discNum'), discState = $('#discState'), discSub = $('#discSub'),
  discModeEl = $('#discMode'), discLive = $('#discLive'), discPanel = $('#discPanel'),
  staffPointer = $('#staffPointer'), staffVal = $('#staffVal'),
  chipTri = $('#chipTri'), chipWord = $('#chipWord'), chipSub = $('#chipSub'),
  nextHighV = $('#nextHighV'), nextHighS = $('#nextHighS'), nextLowV = $('#nextLowV'), nextLowS = $('#nextLowS'),
  scrubTime = $('#scrubTime'), scrubVal = $('#scrubVal'), footClock = $('#footClock');

let lastLive = '';
function render(force: boolean) {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowFt = tideFeet(nowSec);
  const slope = tideFeet(nowSec) - tideFeet(nowSec - 1200);
  const rising = slope > 0.004, falling = slope < -0.004;
  const hi = nextExtremum(nowSec, 'high'), lo = nextExtremum(nowSec, 'low');

  // scrub value
  const scrubFt = tideFeet(t0 + selHour * 3600);
  const showScrub = chartVisible;

  // disc shows scrub while chart is centred, else now/peak toggle
  let dispFt = nowFt, mode = discMode === 'now' ? 'NOW' : 'NEXT PEAK';
  if (showScrub) { dispFt = scrubFt; mode = `SCROLL SCRUB · ${String(selHour).padStart(2, '0')}:00`; }
  else if (discMode === 'peak') {
    const target = rising ? hi : lo;
    if (target) dispFt = target.ft;
  }
  const deg = Math.max(2, frac(dispFt) * 360);
  discWedge.setAttribute('d', wedgePath(125, 125, 100, deg));
  const [hx, hy] = polar(125, 125, 107, deg).split(',').map(Number);
  discHand.setAttribute('x2', String(hx)); discHand.setAttribute('y2', String(hy));
  discDot.setAttribute('cx', String(hx)); discDot.setAttribute('cy', String(hy));

  const alarmed = prefs.enabled && nowFt < prefs.threshold;
  discRing.setAttribute('stroke-width', alarmed ? '10' : '0');
  discPanel.classList.toggle('alarm-on', alarmed);

  discNum.textContent = `${dispFt.toFixed(1)}`;
  const stateWord = rising ? '▲ RISING' : falling ? '▼ FALLING' : '— SLACK';
  discState.textContent = showScrub ? `SCRUB ${String(selHour).padStart(2, '0')}:00` : stateWord;
  discState.className = `disc-state ${rising && !showScrub ? 'rising' : falling && !showScrub ? 'falling' : ''}`;
  discSub.textContent = hi && lo
    ? (chipFlip
      ? `LOW ${fmtClock(new Date(lo.sec * 1000))} · HIGH ${fmtClock(new Date(hi.sec * 1000))} · SCROLL ${(scrollProg * 100).toFixed(0)}%`
      : `HIGH ${fmtClock(new Date(hi.sec * 1000))} · LOW ${fmtClock(new Date(lo.sec * 1000))} · SCROLL ${(scrollProg * 100).toFixed(0)}%`)
    : '—';
  discModeEl.textContent = `MODE · ${mode} — CLICK DISC FOR ${discMode === 'now' ? 'NEXT PEAK' : 'NOW'}`;
  const live = `Current tide ${nowFt.toFixed(1)} feet, ${rising ? 'rising' : falling ? 'falling' : 'slack'}. Threshold ${prefs.threshold.toFixed(1)} feet, alarm ${prefs.enabled ? (alarmed ? 'triggered' : 'armed') : 'off'}.`;
  if (live !== lastLive || force) { lastLive = live; discLive.textContent = live; }
  discSvg.setAttribute('aria-label', `Ivory disc: ${dispFt.toFixed(1)} feet. ${live}`);

  // staff
  staffPointer.style.top = `${(1 - frac(nowFt)) * 100}%`;
  staffVal.textContent = `${nowFt.toFixed(1)} ft`;

  // chip + next cards
  chipTri.textContent = rising ? '▲' : falling ? '▼' : '—';
  chipTri.style.color = rising ? '#274080' : falling ? '#D7263D' : '#16130F';
  chipWord.textContent = rising ? 'RISING' : falling ? 'FALLING' : 'SLACK';
  chipSub.textContent = chipFlip
    ? `opposite extreme ${lo && hi ? fmtDur((rising ? lo.sec : hi.sec) - nowSec) : '—'} away`
    : `rate ${Math.abs(slope * 3).toFixed(2)} ft/h`;
  if (hi) { nextHighV.textContent = hi.ft.toFixed(1) + ' ft'; nextHighS.textContent = `${fmtClock(new Date(hi.sec * 1000))} · in ${fmtDur(hi.sec - nowSec)}`; }
  if (lo) { nextLowV.textContent = lo.ft.toFixed(1) + ' ft'; nextLowS.textContent = `${fmtClock(new Date(lo.sec * 1000))} · in ${fmtDur(lo.sec - nowSec)}`; }

  // chart markers
  const nowH = (nowSec - t0) / 3600;
  const nc = Math.min(24, Math.max(0, nowH));
  nowDot.setAttribute('cx', String(x(nc))); nowDot.setAttribute('cy', String(y(nowFt)));
  selDot.setAttribute('cx', String(x(Math.min(24, selHour)))); selDot.setAttribute('cy', String(y(scrubFt)));
  const ty = y(prefs.threshold);
  threshLine.setAttribute('y1', String(ty)); threshLine.setAttribute('y2', String(ty));
  threshBand.setAttribute('y', String(ty)); threshBand.setAttribute('height', String(H - PAD - ty));
  scrubTime.textContent = `${String(Math.min(24, selHour)).padStart(2, '0')}:00`;
  scrubVal.textContent = `${scrubFt.toFixed(1)} ft`;
  dotBtns.forEach((b) => {
    const h = Number(b.textContent);
    b.classList.toggle('is-now', h === new Date().getHours());
    b.classList.toggle('is-sel', h === Math.min(23, selHour));
  });

  // alarm
  threshNum.textContent = prefs.threshold.toFixed(1);
  const bandTop = (1 - frac(prefs.threshold)) * 100;
  threshBandEl.style.top = `${bandTop}%`; threshBandEl.style.height = `${100 - bandTop}%`;
  threshLineEl.style.top = `${bandTop}%`;
  alarmToggle.setAttribute('aria-pressed', String(prefs.enabled));
  alarmToggleLabel.textContent = prefs.enabled ? 'ALARM ARMED' : 'ALARM OFF';
  document.querySelectorAll('.presets button').forEach((b) => {
    const pv = PRESETS[b.textContent as keyof typeof PRESETS];
    b.classList.toggle('is-active', Math.abs(pv - prefs.threshold) < 0.051);
  });
  if (!prefs.enabled) {
    statusPanel.className = 'panel status-panel safe';
    statusBig.textContent = 'Off watch';
    statusSub.textContent = `alarm off · tide ${nowFt.toFixed(1)} ft vs ${prefs.threshold.toFixed(1)} ft line`;
  } else if (alarmed) {
    statusPanel.className = 'panel status-panel triggered';
    statusBig.textContent = 'Lowtide!';
    statusSub.textContent = `tide ${nowFt.toFixed(1)} ft below ${prefs.threshold.toFixed(1)} ft line · ${(prefs.threshold - nowFt).toFixed(1)} ft under`;
  } else {
    statusPanel.className = 'panel status-panel armed';
    statusBig.textContent = 'Holding';
    statusSub.textContent = `tide ${nowFt.toFixed(1)} ft above ${prefs.threshold.toFixed(1)} ft line · margin ${(nowFt - prefs.threshold).toFixed(1)} ft`;
  }
  footClock.textContent = `${fmtClock(new Date())} · scroll ${(scrollProg * 100).toFixed(0)}%`;
}

onScroll();
render(true);
window.setInterval(() => render(false), 1000);
