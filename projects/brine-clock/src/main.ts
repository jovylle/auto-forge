const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

const M2 = 12.4206012 * 3600
const S2 = 12 * 3600
const K1 = 23.93447 * 3600

const tideH = (sec: number): number =>
  0.82 * Math.cos((Math.PI * 2 * sec) / M2 + 0.4) +
  0.38 * Math.cos((Math.PI * 2 * sec) / S2 - 0.9) +
  0.12 * Math.cos((Math.PI * 2 * sec) / K1 + 1.7)

const tideNorm = (h: number): number => Math.min(1, Math.max(0, (h + 1.35) / 2.7))

const WATCHES = [
  { name: 'Middle', start: 0, end: 4 },
  { name: 'Morning', start: 4, end: 8 },
  { name: 'Forenoon', start: 8, end: 12 },
  { name: 'Afternoon', start: 12, end: 16 },
  { name: 'First Dog', start: 16, end: 18 },
  { name: 'Second Dog', start: 18, end: 20 },
  { name: 'First', start: 20, end: 24 },
] as const

function bellFor(secOfDay: number) {
  for (const w of WATCHES) {
    if (secOfDay >= w.start * 3600 && secOfDay < w.end * 3600) {
      const durBells = (w.end - w.start) * 2
      const idx = Math.min(Math.floor((secOfDay - w.start * 3600) / 1800), durBells - 1)
      const bell = w.start === 18 ? 4 + idx + 1 : idx + 1
      return { watch: w, bell, idx }
    }
  }
  return { watch: WATCHES[0], bell: 1, idx: 0 }
}

function nextExtremum(secNow: number, kind: 'high' | 'low') {
  const end = secNow + M2 * 1.1
  for (let s = secNow + 60; s < end; s += 60) {
    const h0 = tideH(s - 120)
    const h1 = tideH(s)
    const h2 = tideH(s + 120)
    if (kind === 'high' && h1 > h0 && h1 > h2) return { sec: s, h: h1 }
    if (kind === 'low' && h1 < h0 && h1 < h2) return { sec: s, h: h1 }
  }
  return null
}

const fmtDur = (sec: number): string => {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const fmtClock = (d: Date): string =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const app = $('#app')
app.innerHTML = `
  <header class="masthead">
    <div>
      <p class="masthead-kicker">a tide timer that breathes with the sea</p>
      <h1 class="masthead-word">Brine <em>Clock</em></h1>
    </div>
    <div class="wavebar" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
  </header>

  <main class="grid-main">
    <section class="panel dial-panel">
      <div class="dial-head">
        <h2 class="panel-title">The Tidal Pool</h2>
        <span class="panel-tag">M2 lunar tide · live</span>
      </div>
      <div class="dial-wrap">
        <canvas class="dial-canvas" role="img" aria-label="Animated tide dial showing the lunar tidal cycle"></canvas>
        <div class="tide-chips">
          <div class="chip chip--high"><span>Next high</span><b id="nextHigh">—</b></div>
          <div class="chip chip--low"><span>Next low</span><b id="nextLow">—</b></div>
        </div>
        <div class="dial-overlay">
          <p class="tide-state" id="tideState">—</p>
          <p class="tide-meters" id="tideMeters">—</p>
        </div>
      </div>
    </section>

    <aside class="rail">
      <section class="panel card">
        <div class="card-head">
          <h2 class="panel-title">Breathe with the Sea</h2>
          <span class="panel-tag" id="bpmTag">6 / min</span>
        </div>
        <div class="breath-orb" id="breathOrb"><div class="breath-core"></div></div>
        <div class="breath-readout">
          <p class="breath-phase" id="breathPhase">INHALE</p>
          <p class="breath-hint">tidal breathing pacer</p>
        </div>
        <div class="breath-meta">
          <span id="breathCount">0 breaths</span>
          <span id="breathSecs">10s cycle</span>
        </div>
        <div class="slider-row">
          <label for="bpm">Cadence</label>
          <input type="range" id="bpm" min="4" max="12" step="0.5" value="6" />
        </div>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h2 class="panel-title">Harbor Bell</h2>
          <span class="panel-tag" id="watchName">—</span>
        </div>
        <div class="bell-dome">
          <div class="bell-bolt"></div>
          <div class="bell-body" id="bellBody"></div>
          <div class="bell-clapper"></div>
        </div>
        <div class="bell-readout">
          <p class="bell-count" id="bellCount">—</p>
          <p class="bell-next" id="bellNext">next bell in —</p>
        </div>
        <div class="bell-actions">
          <button class="btn" id="ringBtn" type="button">Ring now</button>
          <label class="toggle"><input type="checkbox" id="bellOn" checked /><span>sound</span></label>
        </div>
      </section>
    </aside>

    <section class="panel watch-strip">
      <div class="watch-now"><span>Current watch</span><b id="watchNow">—</b></div>
      <div class="watch-list" id="watchList"></div>
    </section>
  </main>

  <p class="foot-note">tides follow a synthetic lunar model · ship's bells mark the half-hour watches</p>
`

const STORAGE_KEY = 'brine-clock'
interface Prefs { bpm: number; bellOn: boolean }
const defaultPrefs: Prefs = { bpm: 6, bellOn: true }
let prefs: Prefs = defaultPrefs
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) prefs = { ...defaultPrefs, ...JSON.parse(raw) }
} catch {
  prefs = { ...defaultPrefs }
}
const savePrefs = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

const tideState = $('#tideState')
const tideMeters = $('#tideMeters')
const nextHighEl = $('#nextHigh')
const nextLowEl = $('#nextLow')
const canvas = $<HTMLCanvasElement>('.dial-canvas')
const wrap = $('.dial-wrap')
const ctx = canvas.getContext('2d')!

const breathOrb = $('#breathOrb')
const breathCore = $('.breath-core')
const breathPhase = $('#breathPhase')
const breathCount = $('#breathCount')
const breathSecs = $('#breathSecs')
const bpmTag = $('#bpmTag')
const bpmInput = $<HTMLInputElement>('#bpm')
bpmInput.value = String(prefs.bpm)

const bellBody = $('#bellBody')
const bellCount = $('#bellCount')
const bellNext = $('#bellNext')
const bellOn = $<HTMLInputElement>('#bellOn')
bellOn.checked = prefs.bellOn
const ringBtn = $('#ringBtn')
const watchName = $('#watchName')
const watchNow = $('#watchNow')
const watchList = $('#watchList')

for (const w of WATCHES) {
  const chip = document.createElement('span')
  chip.className = 'watch-item'
  chip.textContent = w.name
  chip.dataset.watch = w.name
  watchList.appendChild(chip)
}

let prefBpm = prefs.bpm
bpmInput.addEventListener('input', () => {
  prefBpm = parseFloat(bpmInput.value)
  prefs.bpm = prefBpm
  savePrefs()
})

bellOn.addEventListener('change', () => {
  prefs.bellOn = bellOn.checked
  savePrefs()
})

let actx: AudioContext | null = null
function initAudio() {
  if (actx) {
    if (actx.state === 'suspended') void actx.resume()
    return
  }
  try {
    actx = new AudioContext()
    if (actx.state === 'suspended') void actx.resume()
  } catch {
    actx = null
  }
}
window.addEventListener('pointerdown', initAudio, { passive: true })

function ringBellOnce(at: number) {
  if (!actx || !prefs.bellOn) return
  const t0 = actx.currentTime + Math.max(0, at)
  const f0 = 392
  const partials: Array<[number, number]> = [[1, 1], [2, 0.6], [2.76, 0.38], [4.3, 0.2], [5.4, 0.1]]
  for (const [ratio, amp] of partials) {
    const osc = actx.createOscillator()
    const g = actx.createGain()
    osc.type = 'sine'
    osc.frequency.value = f0 * ratio
    const d = 2.5 - ratio * 0.2
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(amp * 0.5, t0 + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
    osc.connect(g)
    g.connect(actx.destination)
    osc.start(t0)
    osc.stop(t0 + d + 0.1)
  }
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.025), actx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2)
  const src = actx.createBufferSource()
  src.buffer = buf
  const bp = actx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1900
  bp.Q.value = 0.8
  const cg = actx.createGain()
  cg.gain.setValueAtTime(0.12, t0)
  cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.02)
  src.connect(bp)
  bp.connect(cg)
  cg.connect(actx.destination)
  src.start(t0)
}

function swingBell() {
  bellBody.classList.remove('ringing')
  void bellBody.offsetWidth
  bellBody.classList.add('ringing')
}

let ringSeq = 0
function ringSequence(count: number) {
  ringSeq++
  const id = ringSeq
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => {
      if (id !== ringSeq) return
      swingBell()
      ringBellOnce(0)
    }, i * 850)
  }
}

ringBtn.addEventListener('click', () => {
  initAudio()
  const sod = new Date()
  const b = bellFor(sod.getHours() * 3600 + sod.getMinutes() * 60 + sod.getSeconds())
  ringSequence(b.bell)
})

function ringForNow() {
  initAudio()
  const sod = new Date()
  const b = bellFor(sod.getHours() * 3600 + sod.getMinutes() * 60 + sod.getSeconds())
  ringSequence(b.bell)
}

let lastBellKey = -1
function tickBell(nowMs: number) {
  const d = new Date(nowMs)
  const h = d.getHours()
  const m = d.getMinutes()
  const key = h * 100 + m
  if ((m === 0 || m === 30) && key !== lastBellKey) {
    lastBellKey = key
    const sod = h * 3600 + m * 60 + d.getSeconds()
    const b = bellFor(sod)
    if (prefs.bellOn) ringForNow()
    else swingBell()
    return b
  }
  return null
}

// ---- tide dial ----
let cssW = 0
let cssH = 0
const dpr = Math.min(window.devicePixelRatio || 1, 2)

function resize() {
  const rect = wrap.getBoundingClientRect()
  cssW = Math.max(220, Math.min(560, rect.width))
  cssH = cssW
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
}
resize()
new ResizeObserver(resize).observe(wrap)

interface Bubble { px: number; py: number; r: number; spd: number; ph: number }
const bubbles: Bubble[] = Array.from({ length: 9 }, () => ({
  px: (Math.random() * 2 - 1) * 0.86,
  py: Math.random() * 2 - 1,
  r: 1.6 + Math.random() * 3.4,
  spd: 0.008 + Math.random() * 0.02,
  ph: Math.random() * Math.PI * 2,
}))

function blobRadius(R: number, th: number, t: number) {
  return R * (1 + 0.02 * Math.sin(3 * th + 0.4 * t) + 0.013 * Math.sin(5 * th - 0.3 * t) + 0.009 * Math.sin(7 * th + 0.2 * t))
}

let lastState = ''
let lastMeters = ''
let lastHigh = ''
let lastLow = ''
let lastPhase = ''
let lastSecLabel = ''
let breaths = 0
let lastBreathKey = -1

function draw(nowMs: number) {
  const t = nowMs / 1000
  const sec = Math.floor(t)
  const cx = cssW / 2
  const cy = cssH / 2
  const R = Math.min(cssW, cssH) / 2 - 10
  const poolR = R * 0.72

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const h = tideH(sec)
  const norm = tideNorm(h)

  // outer organic ring
  const ring = new Path2D()
  const steps = 140
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2
    const rr = blobRadius(R, th, t)
    const x = cx + Math.cos(th) * rr
    const y = cy + Math.sin(th) * rr
    if (i === 0) ring.moveTo(x, y)
    else ring.lineTo(x, y)
  }
  ring.closePath()
  const ringGrad = ctx.createLinearGradient(0, cy - R, 0, cy + R)
  ringGrad.addColorStop(0, '#0c4450')
  ringGrad.addColorStop(0.5, '#08333b')
  ringGrad.addColorStop(1, '#06222c')
  ctx.fillStyle = ringGrad
  ctx.fill(ring)

  // cut the pool hole
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(cx, cy, poolR, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ring ticks (12 half-hour marks of the tidal cycle)
  for (let k = 0; k < 12; k++) {
    const th = (k / 12) * Math.PI * 2 - Math.PI / 2
    const midR = (R + poolR) / 2
    const x = cx + Math.cos(th) * midR
    const y = cy + Math.sin(th) * midR
    ctx.beginPath()
    ctx.arc(x, y, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(233,245,238,0.5)'
    ctx.fill()
  }

  // ring inner stroke
  ctx.beginPath()
  ctx.arc(cx, cy, poolR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(233,245,238,0.22)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // ---- water pool ----
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, poolR, 0, Math.PI * 2)
  ctx.clip()

  const surfY = cy + poolR - norm * poolR * 2
  const waveY = (x: number) =>
    surfY + Math.sin((x - cx) / 16 + 0.5 * t) * 5 + Math.sin((x - cx) / 26 - 0.34 * t) * 4

  const water = new Path2D()
  water.moveTo(cx - poolR, waveY(cx - poolR))
  for (let x = cx - poolR; x <= cx + poolR; x += 3) water.lineTo(x, waveY(x))
  water.lineTo(cx + poolR, cy + poolR + 8)
  water.lineTo(cx - poolR, cy + poolR + 8)
  water.closePath()
  const wGrad = ctx.createLinearGradient(0, surfY - 20, 0, cy + poolR)
  wGrad.addColorStop(0, 'rgba(152,222,204,0.95)')
  wGrad.addColorStop(0.12, 'rgba(54,174,150,0.95)')
  wGrad.addColorStop(0.55, 'rgba(20,116,118,0.96)')
  wGrad.addColorStop(1, 'rgba(5,46,62,0.98)')
  ctx.fillStyle = wGrad
  ctx.fill(water)

  // foam line on the surface
  ctx.beginPath()
  for (let x = cx - poolR; x <= cx + poolR; x += 3) {
    const y = waveY(x)
    if (x === cx - poolR) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'rgba(240,250,244,0.7)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // bubbles drifting up
  for (const b of bubbles) {
    b.py -= b.spd
    if (b.py < -1) { b.py = 1; b.px = (Math.random() * 2 - 1) * 0.86 }
    const bx = cx + b.px * poolR * 0.94
    const by = cy + b.py * poolR * 0.94
    if (by > surfY + 4) {
      const a = 0.28 + 0.22 * Math.sin(nowMs / 400 + b.ph)
      ctx.beginPath()
      ctx.arc(bx, by, b.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(240,250,244,${a.toFixed(3)})`
      ctx.fill()
    }
  }
  ctx.restore()

  // tide hand (organic fin)
  const phase = (sec % M2) / M2
  const ang = phase * Math.PI * 2 - Math.PI / 2
  const len = poolR * 0.88
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(ang)
  const fin = new Path2D()
  fin.moveTo(0, 0)
  fin.quadraticCurveTo(len * 0.42, -len * 0.05, len, -len * 0.04)
  fin.quadraticCurveTo(len * 1.02, 0, len, len * 0.04)
  fin.quadraticCurveTo(len * 0.42, len * 0.05, 0, 0)
  fin.closePath()
  const finGrad = ctx.createLinearGradient(0, 0, len, 0)
  finGrad.addColorStop(0, 'rgba(242,200,164,0.9)')
  finGrad.addColorStop(1, 'rgba(255,125,95,0.85)')
  ctx.fillStyle = finGrad
  ctx.fill(fin)
  ctx.beginPath()
  ctx.arc(len, 0, 5.5, 0, Math.PI * 2)
  ctx.fillStyle = '#f2f7f2'
  ctx.shadowColor = 'rgba(242,200,164,0.9)'
  ctx.shadowBlur = 12
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.restore()

  // state glyph near the rim (opposite the hand): rising / falling chevrons
  const slope = tideH(sec) - tideH(sec - 1200)
  const glyphAng = ang + Math.PI
  const gx = cx + Math.cos(glyphAng) * (R + poolR) / 2
  const gy = cy + Math.sin(glyphAng) * (R + poolR) / 2
  const rising = slope > 0.00006
  const falling = slope < -0.00006
  ctx.save()
  ctx.translate(gx, gy)
  ctx.rotate(glyphAng)
  if (rising || falling) {
    ctx.strokeStyle = rising ? 'rgba(233,245,238,0.85)' : 'rgba(242,200,164,0.8)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const off of [6, 12]) {
      const y = rising ? -off : off
      ctx.beginPath()
      ctx.moveTo(-5, y)
      ctx.lineTo(0, rising ? -(off + 5) : off + 5)
      ctx.lineTo(5, y)
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = 'rgba(233,245,238,0.4)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-6, 0)
    ctx.lineTo(6, 0)
    ctx.stroke()
  }
  ctx.restore()

  // ---- DOM sync (throttled by change) ----
  const state = rising ? 'FLOODING' : falling ? 'EBBING' : 'SLACK WATER'
  if (state !== lastState) {
    lastState = state
    tideState.textContent = state
  }
  const sign = h >= 0 ? '+' : ''
  const meters = `${sign}${h.toFixed(2)} m · ${rising ? 'rising' : falling ? 'falling' : 'slack'}`
  if (meters !== lastMeters) {
    lastMeters = meters
    tideMeters.textContent = meters
  }
  const hi = nextExtremum(sec, 'high')
  const lo = nextExtremum(sec, 'low')
  const hiStr = hi ? fmtDur(hi.sec - sec) : '—'
  const loStr = lo ? fmtDur(lo.sec - sec) : '—'
  if (hiStr !== lastHigh) { lastHigh = hiStr; nextHighEl.textContent = hiStr }
  if (loStr !== lastLow) { lastLow = loStr; nextLowEl.textContent = loStr }

  // ---- breath orb ----
  const cycle = 60 / prefBpm
  const p = (sec % cycle) / cycle
  const s = 1 + 0.5 * Math.sin(p * Math.PI * 2)
  breathOrb.style.setProperty('--bscale', s.toFixed(3))
  const phaseLabel = Math.sin(p * Math.PI * 2) >= 0 ? 'INHALE' : 'EXHALE'
  if (phaseLabel !== lastPhase) {
    lastPhase = phaseLabel
    breathPhase.textContent = phaseLabel
    breathPhase.style.color = phaseLabel === 'INHALE' ? 'var(--tide-soft)' : 'var(--shell)'
  }
  const cycLabel = `${Math.round(cycle)}s cycle`
  if (cycLabel !== lastSecLabel) {
    lastSecLabel = cycLabel
    breathSecs.textContent = cycLabel
    bpmTag.textContent = `${prefBpm} / min`
  }
  const breathKey = Math.floor(p * 4)
  if (lastBreathKey === 3 && breathKey === 0) breaths++
  lastBreathKey = breathKey
  breathCount.textContent = `${breaths} breaths`
}

function drawLoop() {
  draw(performance.now())
  requestAnimationFrame(drawLoop)
}
requestAnimationFrame(drawLoop)

// ---- bell / watch DOM loop ----
function updateWatchDom(nowMs: number) {
  const d = new Date(nowMs)
  const sod = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
  const b = bellFor(sod)
  bellCount.textContent = `${b.bell} bell${b.bell === 1 ? '' : 's'}`
  watchName.textContent = `${b.watch.name} watch`
  watchNow.textContent = `${b.watch.name} · ${b.bell} bell${b.bell === 1 ? '' : 's'}`

  const nextBellDate = new Date(d)
  if (d.getMinutes() < 30) nextBellDate.setHours(d.getHours(), 30, 0, 0)
  else nextBellDate.setHours(d.getHours() + 1, 0, 0, 0)
  const waitSec = (nextBellDate.getTime() - nowMs) / 1000
  const nb = bellFor(nextBellDate.getHours() * 3600 + nextBellDate.getMinutes() * 60)
  bellNext.textContent = `next bell · ${fmtDur(waitSec)} · ${nb.bell} bell${nb.bell === 1 ? '' : 's'}`

  for (const chip of watchList.querySelectorAll<HTMLElement>('.watch-item')) {
    chip.classList.toggle('is-current', chip.dataset.watch === b.watch.name)
  }

  return tickBell(nowMs)
}

function watchLoop() {
  const now = Date.now()
  updateWatchDom(now)
  window.setTimeout(watchLoop, 500)
}
watchLoop()