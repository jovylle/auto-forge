import './index.css'

/* ================= Copper Finch Radio =================
   Tune the dawn dial, chirp an 8-note chorus, trade it
   with the flock. localStorage only, WebAudio synths. */

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T
const $$ = <T extends HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[]

/* ---------------- constants ---------------- */
const PITCHES = ['rest', 'C5', 'D5', 'E5', 'G5', 'A5'] as const
const FREQS = [0, 523.25, 587.33, 659.25, 783.99, 880]
const GLYPHS = ['·', '𝅝', '𝅗𝅥', '𝅘𝅥', '𝅘𝅥𝅮', '𝅘𝅥𝅯']
const STEPS = 8
const DAWN_MIN = 240 // 4:00
const DAWN_MAX = 420 // 7:00

const PERCHES = [
  { id: 'reeds', glyph: '🪶', name: 'Cattail Reeds', desc: 'Low, misty water. Slow amber trills.', base: 0 },
  { id: 'copper', glyph: '🔔', name: 'Copper Wires', desc: 'Bright metallic peals that carry far.', base: 1 },
  { id: 'pines', glyph: '🌲', name: 'High Pines', desc: 'Thin pine-needle whistles, quick and shy.', base: 2 },
] as const

const FLOCK_NAMES = [
  { name: 'Wren Marlowe', glyph: '🐦' },
  { name: 'Linnet Okafor', glyph: '🐤' },
  { name: 'Pip Alder', glyph: '🦜' },
  { name: 'Siskin Vale', glyph: '🐥' },
  { name: 'Redpoll Quinn', glyph: '🕊️' },
  { name: 'Chaffinch Bly', glyph: '🦅' },
]

const MARQUEE_TEXT =
  'first light · trade a chorus · answer a stranger · perch your song · '.repeat(4)

/* ---------------- state ---------------- */
interface FlockCard {
  id: string
  from: string
  glyph: string
  pattern: number[]
  dawn: number
  perch: string
  likes: number
  mine: boolean
  at: number
}
interface State {
  handle: string
  dawn: number
  perch: string
  chorus: number[]
  flock: FlockCard[]
  loved: string[]
  trades: number
  flight: { tuned: boolean; chirped: boolean; traded: boolean }
}
const LS_KEY = 'copper-finch-radio-fqbj-v1'

function seedFlock(): FlockCard[] {
  const now = Date.now()
  return [
    { id: 'seed-1', from: 'Wren Marlowe', glyph: '🐦', pattern: [1, 0, 3, 2, 5, 3, 1, 0], dawn: 280, perch: 'Cattail Reeds', likes: 12, mine: false, at: now - 86400000 },
    { id: 'seed-2', from: 'Pip Alder', glyph: '🦜', pattern: [5, 5, 3, 1, 2, 4, 0, 5], dawn: 325, perch: 'Copper Wires', likes: 7, mine: false, at: now - 43200000 },
    { id: 'seed-3', from: 'Siskin Vale', glyph: '🐥', pattern: [2, 4, 0, 4, 2, 1, 3, 0], dawn: 365, perch: 'High Pines', likes: 4, mine: false, at: now - 7200000 },
  ]
}

function defaultState(): State {
  return {
    handle: 'Finch-' + Math.floor(100 + Math.random() * 900),
    dawn: 320,
    perch: 'copper',
    chorus: [1, 3, 0, 5, 3, 2, 4, 0],
    flock: seedFlock(),
    loved: [],
    trades: 0,
    flight: { tuned: false, chirped: false, traded: false },
  }
}

let state: State = defaultState()
try {
  const raw = localStorage.getItem(LS_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as Partial<State>
    state = { ...defaultState(), ...parsed, flight: { ...defaultState().flight, ...(parsed.flight ?? {}) } }
    if (!Array.isArray(state.chorus) || state.chorus.length !== STEPS) state.chorus = defaultState().chorus
    if (!Array.isArray(state.flock)) state.flock = seedFlock()
  }
} catch { state = defaultState() }

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

/* ---------------- audio ---------------- */
let actx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    if (!actx) {
      actx = new AudioContext()
      const master = actx.createGain()
      master.gain.value = 0.5
      const delay = actx.createDelay(1)
      delay.delayTime.value = 0.27
      const fb = actx.createGain()
      fb.gain.value = 0.28
      const wet = actx.createGain()
      wet.gain.value = 0.3
      master.connect(actx.destination)
      master.connect(delay)
      delay.connect(fb)
      fb.connect(delay)
      delay.connect(wet)
      wet.connect(actx.destination)
      ;(actx as unknown as { __master: GainNode }).__master = master
    }
    if (actx.state === 'suspended') void actx.resume()
    return actx
  } catch { return null }
}
function masterNode(ac: AudioContext): AudioNode {
  return (ac as unknown as { __master?: GainNode }).__master ?? ac.destination
}

function chirp(ac: AudioContext, freq: number, at: number, dur = 0.22, vol = 0.5) {
  const t0 = at
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 0.9, t0)
  osc.frequency.exponentialRampToValueAtTime(freq * 1.1, t0 + dur * 0.35)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.98, t0 + dur)
  const lfo = ac.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 28
  const lfoG = ac.createGain()
  lfoG.gain.value = freq * 0.03
  lfo.connect(lfoG)
  lfoG.connect(osc.frequency)
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(masterNode(ac))
  osc.start(t0)
  lfo.start(t0)
  osc.stop(t0 + dur + 0.05)
  lfo.stop(t0 + dur + 0.05)
}

let playingTimers: number[] = []
function stopPlayback() {
  playingTimers.forEach((t) => window.clearTimeout(t))
  playingTimers = []
  $$('.step.playing').forEach((el) => el.classList.remove('playing'))
  $$('.finch-card .icon-btn--play.playing').forEach((el) => el.classList.remove('playing'))
}

function playPattern(pattern: number[], opts: { mark?: HTMLElement[]; stepDur?: number; onDone?: () => void } = {}) {
  const ac = audio()
  if (!ac) { toast('Tap again to wake the radio — browsers need a gesture for sound.'); return }
  stopPlayback()
  const perchShift = state.perch === 'pines' ? 1.122 : state.perch === 'reeds' ? 0.891 : 1
  const dawnShift = 1 + ((state.dawn - 330) / 180) * 0.12
  const stepDur = opts.stepDur ?? 0.34
  const t0 = ac.currentTime + 0.06
  pattern.forEach((p, i) => {
    if (p <= 0) return
    const f = FREQS[p] * perchShift * dawnShift
    chirp(ac!, f, t0 + i * stepDur)
    const mark = opts.mark?.[i]
    if (mark) {
      playingTimers.push(window.setTimeout(() => {
        $$('.step.playing').forEach((el) => el.classList.remove('playing'))
        mark.classList.add('playing')
      }, i * stepDur * 1000))
    }
  })
  playingTimers.push(window.setTimeout(() => {
    $$('.step.playing').forEach((el) => el.classList.remove('playing'))
    opts.onDone?.()
  }, pattern.length * stepDur * 1000 + 120))
}

/* ---------------- helpers ---------------- */
function fmtDawn(min: number): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`
}
function dawnMood(min: number): { name: string; desc: string } {
  if (min < 275) return { name: 'Blue Hour', desc: 'Indigo air, one brave wren testing the dark. Slow, low answers carry best now.' }
  if (min < 315) return { name: 'First Light', desc: 'The reeds silver over. Quicksilver trills stitch the mist together.' }
  if (min < 360) return { name: 'Copper Sunrise', desc: 'Full finch rush hour — wires hum, pines echo. Trade loud and often.' }
  return { name: 'Gold Morning', desc: 'Late risers and show-offs. Long confident phrases over warm static.' }
}
function patternToWords(pattern: number[]): string {
  return pattern.map((p) => (p === 0 ? '―' : GLYPHS[p])).join(' ')
}

let toastTimer = 0
function toast(msg: string) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600)
}

function uid(): string {
  return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/* ---------------- shell ---------------- */
const app = $('#app')
app.innerHTML = `
<div class="sky" aria-hidden="true">
  <canvas id="skyCanvas"></canvas>
  <div class="orb orb--copper"></div>
  <div class="orb orb--teal"></div>
  <div class="orb orb--rose"></div>
</div>
<aside class="rail" aria-hidden="true">
  <div class="rail-track"><div class="rail-fill" id="railFill"></div></div>
  <span class="rail-phase" id="railPhase">night</span>
</aside>
<div class="page">
  <header class="hero">
    <div>
      <span class="kicker"><span class="dot"></span>on the air · dawn band 4–7 AM</span>
      <h1 class="hero-title">Copper<br />Finch <em>Radio</em></h1>
      <p class="hero-lede">Trade dawn choruses with fellow finches. Tune the dial to your favourite
      first light, chirp an eight-note phrase, and swap songs with the flock before the sun clears the wires.</p>
      <div class="hero-cta-row">
        <button class="btn" id="quickBtn" type="button">⚡ Catch the dawn in 30 seconds</button>
        <button class="btn btn--ghost" id="listenBtn" type="button">Hear the flock</button>
      </div>
      <p class="seq-hint" id="quickHint">One tap tunes, chirps &amp; preps your trade — under 30 seconds, beak promise.</p>
    </div>
    <div class="glass flight-card reveal" id="flightCard">
      <h2>Your 30-second flight</h2>
      <p class="sub">Three hops, ten seconds each. Scroll to travel from night to morning.</p>
      <ol class="flight-steps">
        <li id="fsTune"><span class="n">1</span> Tune the dawn dial <span class="tick" hidden>✓</span></li>
        <li id="fsChirp"><span class="n">2</span> Chirp your chorus <span class="tick" hidden>✓</span></li>
        <li id="fsTrade"><span class="n">3</span> Trade with the flock <span class="tick" hidden>✓</span></li>
      </ol>
    </div>
    <div class="scroll-cue" aria-hidden="true"><span>scroll into dawn</span><span class="chev"></span></div>
  </header>

  <div class="marquee" aria-hidden="true"><span id="marqueeSpan"></span></div>

  <main>
    <section class="section" id="dialSection" aria-label="Dawn dial">
      <div class="section-head reveal"><span class="section-num">01</span><h2>Dawn dial</h2></div>
      <p class="section-sub reveal">Drag the sun along its track. Earlier dawns sing low and slow through the mist;
      later ones ring bright off the copper wires. Scrolling the page also travels through the morning — watch the sky follow you.</p>
      <div class="dial-grid">
        <div class="glass dial-panel reveal">
          <span class="kicker"><span class="dot"></span>dawn o'clock</span>
          <p class="time-readout"><span id="dawnTime">5:20</span> <small id="dawnSuffix">AM</small></p>
          <p class="dawn-name" id="dawnName">Copper Sunrise</p>
          <p class="dawn-desc" id="dawnDesc"></p>
          <label for="dawnRange" class="seq-hint">drag the sun · 4:00 – 7:00 AM</label>
          <input type="range" class="sun-track" id="dawnRange" min="${DAWN_MIN}" max="${DAWN_MAX}" step="5" value="${state.dawn}" aria-label="Dawn time in minutes after midnight" />
          <div class="tick-labels"><span>4:00</span><span>5:00</span><span>6:00</span><span>7:00</span></div>
          <div class="chip-row" id="dawnChips"></div>
          <label class="seq-hint">light level</label>
          <div class="light-meter" id="lightMeter" aria-hidden="true"></div>
          <div class="seq-actions">
            <button class="btn btn--small" id="dawnPlay" type="button">▶ Sing this dawn</button>
          </div>
        </div>
        <div class="glass perch-card reveal">
          <span class="kicker"><span class="dot"></span>transmission perch</span>
          <h3>Where do you sing from?</h3>
          <p class="seq-hint" style="margin:0">Your perch tints every chirp — reeds deepen, wires brighten, pines lift.</p>
          <div class="perch-list" id="perchList"></div>
        </div>
      </div>
    </section>

    <section class="section" id="tradeSection" aria-label="Chorus trade">
      <div class="section-head reveal"><span class="section-num">02</span><h2>Chorus trade</h2></div>
      <p class="section-sub reveal">Tap a note to cycle its pitch — rest, C, D, E, G, A. Eight notes, one dawn phrase.
      Broadcast it and a fellow finch answers with a song of their own.</p>
      <div class="trade-grid">
        <div class="glass sequencer reveal">
          <span class="kicker"><span class="dot"></span>your phrase · <span id="handleTag"></span></span>
          <h3>Compose your chorus</h3>
          <div class="seq-steps" id="seqSteps" role="group" aria-label="Eight chorus notes"></div>
          <p class="seq-hint" id="chorusWords"></p>
          <div class="seq-actions">
            <button class="btn btn--small" id="playBtn" type="button">▶ Play</button>
            <button class="btn btn--ghost btn--small" id="windBtn" type="button">🍃 Ask the wind</button>
            <button class="btn btn--ghost btn--small" id="clearBtn" type="button">Clear</button>
            <button class="btn btn--small" id="tradeBtn" type="button">📡 Broadcast &amp; trade</button>
          </div>
        </div>
        <div class="glass inbox reveal">
          <span class="kicker"><span class="dot"></span>nest inbox</span>
          <h3>Answers on the wind</h3>
          <div id="inboxBody"><div class="inbox-empty">Quiet skies… broadcast your chorus and a fellow finch will answer within a wingbeat.</div></div>
        </div>
      </div>
    </section>

    <section class="section" id="flockSection" aria-label="Flock board">
      <div class="section-head reveal"><span class="section-num">03</span><h2>Flock board</h2></div>
      <p class="section-sub reveal"><span id="flockCount"></span> Every broadcast perches here. Love the ones that
      ruffle your feathers — the flock remembers.</p>
      <div class="board-tools reveal" id="boardTools" role="group" aria-label="Filter flock board">
        <button class="chip active" data-filter="all" type="button">All songs</button>
        <button class="chip" data-filter="mine" type="button">My broadcasts</button>
        <button class="chip" data-filter="loved" type="button">Loved ♥</button>
      </div>
      <div class="flock-grid" id="flockGrid"></div>
    </section>
  </main>

  <footer class="glass footer reveal">
    <span class="sig">Copper Finch Radio — est. first light</span>
    <span id="footStats"></span>
    <span>no servers were harmed · songs live in your browser</span>
  </footer>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`

/* ---------------- marquee ---------------- */
$('#marqueeSpan').textContent = MARQUEE_TEXT + MARQUEE_TEXT

/* ---------------- flight checklist ---------------- */
function renderFlight() {
  const map: Array<[string, boolean]> = [
    ['fsTune', state.flight.tuned],
    ['fsChirp', state.flight.chirped],
    ['fsTrade', state.flight.traded],
  ]
  for (const [id, done] of map) {
    const li = document.getElementById(id)
    if (!li) continue
    li.classList.toggle('done', done)
    const tick = li.querySelector('.tick')
    if (tick) (tick as HTMLElement).hidden = !done
  }
  save()
}
function markFlight(key: keyof State['flight']) {
  if (!state.flight[key]) {
    state.flight[key] = true
    renderFlight()
    if (state.flight.tuned && state.flight.chirped && state.flight.traded) {
      toast('🪶 Full flight in record time — a true dawn finch!')
    }
  }
}

/* ---------------- dawn dial ---------------- */
const dawnRange = $<HTMLInputElement>('#dawnRange')
const dawnTime = $('#dawnTime')
const dawnSuffix = $('#dawnSuffix')
const dawnName = $('#dawnName')
const dawnDesc = $('#dawnDesc')
const lightMeter = $('#lightMeter')
for (let i = 0; i < 12; i++) {
  const bar = document.createElement('i')
  bar.style.height = `${10 + (i / 11) * 32}px`
  lightMeter.appendChild(bar)
}

const DAWN_PRESETS = [
  { label: 'Nightingale · 4:40', min: 280 },
  { label: 'Wren · 5:20', min: 320 },
  { label: 'Linnet · 6:10', min: 370 },
]
const dawnChips = $('#dawnChips')
for (const p of DAWN_PRESETS) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'chip'
  b.textContent = p.label
  b.addEventListener('click', () => setDawn(p.min, true))
  dawnChips.appendChild(b)
}

function setDawn(min: number, announce = false, countFlight = true) {
  state.dawn = Math.max(DAWN_MIN, Math.min(DAWN_MAX, Math.round(min)))
  dawnRange.value = String(state.dawn)
  const full = fmtDawn(state.dawn)
  dawnTime.textContent = full.slice(0, -3)
  dawnSuffix.textContent = full.slice(-2)
  const mood = dawnMood(state.dawn)
  dawnName.textContent = mood.name
  dawnDesc.textContent = mood.desc
  const lit = Math.round(((state.dawn - DAWN_MIN) / (DAWN_MAX - DAWN_MIN)) * 12)
  $$('i', lightMeter).forEach((bar, i) => bar.classList.toggle('lit', i < lit))
  $$('.chip', dawnChips).forEach((c) => {
    const preset = DAWN_PRESETS.find((p) => p.label === c.textContent)
    c.classList.toggle('active', !!preset && Math.abs(preset.min - state.dawn) < 3)
  })
  skyFollow = state.dawn
  if (countFlight) markFlight('tuned')
  save()
  if (announce) toast(`🌅 Tuned to ${full} — ${mood.name}`)
}
dawnRange.addEventListener('input', () => setDawn(Number(dawnRange.value)))
$('#dawnPlay').addEventListener('click', () => {
  playPattern(state.chorus, { mark: stepEls })
  markFlight('chirped')
  toast(`🎶 Your phrase at ${fmtDawn(state.dawn)}`)
})

/* ---------------- perches ---------------- */
const perchList = $('#perchList')
function renderPerches() {
  perchList.innerHTML = ''
  for (const p of PERCHES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'perch' + (state.perch === p.id ? ' active' : '')
    b.setAttribute('aria-pressed', String(state.perch === p.id))
    const mult = p.base === 0 ? '0.89×' : p.base === 2 ? '1.12×' : '1.00×'
    b.innerHTML = `<span class="glyph">${p.glyph}</span><span><b>${p.name}</b><small>${p.desc}</small></span><span class="freq">${mult}</span>`
    b.addEventListener('click', () => {
      state.perch = p.id
      save()
      renderPerches()
      const ac = audio()
      if (ac) chirp(ac, 659.25 * (p.base === 0 ? 0.891 : p.base === 2 ? 1.122 : 1), ac.currentTime + 0.05)
      toast(`${p.glyph} Perched on the ${p.name}`)
    })
    perchList.appendChild(b)
  }
}

/* ---------------- sequencer ---------------- */
const seqSteps = $('#seqSteps')
const chorusWords = $('#chorusWords')
const handleTag = $('#handleTag')
handleTag.textContent = state.handle
let stepEls: HTMLElement[] = []

function renderSequencer() {
  seqSteps.innerHTML = ''
  stepEls = []
  state.chorus.forEach((p, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'step'
    b.dataset.p = String(p)
    b.setAttribute('aria-label', `Note ${i + 1}: ${PITCHES[p]}. Activate to change pitch.`)
    const h = p === 0 ? 4 : 14 + p * 10
    b.innerHTML = `<span class="bar-wrap"><span class="bar" style="height:${h}px"></span></span><span class="lbl">${p === 0 ? 'rest' : PITCHES[p]}</span>`
    b.addEventListener('click', () => {
      state.chorus[i] = (state.chorus[i] + 1) % PITCHES.length
      const ac = audio()
      if (ac && state.chorus[i] > 0) chirp(ac, FREQS[state.chorus[i]], ac.currentTime + 0.02, 0.16, 0.4)
      save()
      renderSequencer()
    })
    seqSteps.appendChild(b)
    stepEls.push(b)
  })
  chorusWords.textContent = '“ ' + patternToWords(state.chorus) + ' ” — tap any note to change its pitch'
}

$('#playBtn').addEventListener('click', () => {
  playPattern(state.chorus, { mark: stepEls })
  markFlight('chirped')
})
$('#windBtn').addEventListener('click', () => {
  stopPlayback()
  const motifs = [
    [1, 3, 5, 3, 2, 1, 0, 2], [5, 0, 4, 2, 3, 5, 1, 0],
    [2, 2, 4, 0, 5, 4, 3, 1], [3, 5, 3, 1, 0, 2, 4, 5],
  ]
  const base = motifs[Math.floor(Math.random() * motifs.length)]
  state.chorus = base.map((p) => (Math.random() < 0.18 ? Math.floor(Math.random() * 6) : p))
  save()
  renderSequencer()
  playPattern(state.chorus, { mark: stepEls })
  markFlight('chirped')
  toast('🍃 The wind rearranged your notes…')
})
$('#clearBtn').addEventListener('click', () => {
  stopPlayback()
  state.chorus = Array(STEPS).fill(0)
  save()
  renderSequencer()
})

/* ---------------- trade ---------------- */
function makeReply(): { from: string; glyph: string; pattern: number[] } {
  const finch = FLOCK_NAMES[Math.floor(Math.random() * FLOCK_NAMES.length)]
  const runs = [
    [5, 4, 3, 2, 1, 2, 3, 0], [1, 2, 3, 5, 0, 5, 3, 1],
    [3, 3, 1, 0, 2, 4, 5, 0], [4, 5, 4, 2, 0, 1, 3, 5],
    [2, 5, 0, 3, 1, 4, 2, 0], [5, 1, 3, 0, 4, 2, 5, 3],
  ]
  const base = runs[Math.floor(Math.random() * runs.length)]
  const dawnLean = state.dawn < 300 ? -1 : state.dawn > 360 ? 1 : 0
  const pattern = base.map((p) => {
    if (p === 0) return Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 5)
    return Math.max(1, Math.min(5, p + dawnLean))
  })
  return { from: finch.name, glyph: finch.glyph, pattern }
}

let boardFilter: 'all' | 'mine' | 'loved' = 'all'
function renderInbox(reply: { from: string; glyph: string; pattern: number[] } | null) {
  const body = $('#inboxBody')
  if (!reply) {
    body.innerHTML = `<div class="inbox-empty">Quiet skies… broadcast your chorus and a fellow finch will answer within a wingbeat.</div>`
    return
  }
  body.innerHTML = `
    <div class="reply-card">
      <span class="from">${reply.glyph} answer from ${reply.from}</span>
      <p class="pattern">“ ${patternToWords(reply.pattern)} ”</p>
      <div class="minidots">${reply.pattern.map((p) => `<i class="${p === 0 ? 'rest' : ''}" style="height:${p === 0 ? 4 : 6 + p * 5}px"></i>`).join('')}</div>
      <div class="reply-actions">
        <button class="icon-btn icon-btn--play" id="replyPlay" type="button">▶ Play answer</button>
        <button class="icon-btn" id="replyPerch" type="button">Perch it on the board</button>
      </div>
    </div>`
  $('#replyPlay').addEventListener('click', () => {
    playPattern(reply.pattern, {})
    toast(`🎶 ${reply.from} sings back`)
  })
  $('#replyPerch').addEventListener('click', () => {
    state.flock.unshift({
      id: uid(), from: reply.from, glyph: reply.glyph, pattern: [...reply.pattern],
      dawn: state.dawn, perch: PERCHES[Math.floor(Math.random() * PERCHES.length)].name,
      likes: 1, mine: false, at: Date.now(),
    })
    state.loved.push(state.flock[0].id)
    save()
    renderFlock()
    renderInbox(null)
    toast(`📌 ${reply.from}'s answer perched on the flock board`)
  })
}

$('#tradeBtn').addEventListener('click', () => {
  if (state.chorus.every((p) => p === 0)) {
    toast('🤫 All rests — give your chorus at least one note before trading.')
    return
  }
  stopPlayback()
  const perchName = PERCHES.find((p) => p.id === state.perch)?.name ?? 'Copper Wires'
  state.flock.unshift({
    id: uid(), from: state.handle + ' (you)', glyph: '🪶', pattern: [...state.chorus],
    dawn: state.dawn, perch: perchName, likes: 0, mine: true, at: Date.now(),
  })
  state.trades++
  const reply = makeReply()
  save()
  renderFlock()
  renderInbox(reply)
  markFlight('traded')
  playPattern(reply.pattern, {})
  toast(`📡 Broadcast at ${fmtDawn(state.dawn)} — ${reply.from} answered!`)
  document.getElementById('tradeSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

/* ---------------- flock board ---------------- */
const flockGrid = $('#flockGrid')
const flockCount = $('#flockCount')
const footStats = $('#footStats')

function renderFlock() {
  const cards = state.flock.filter((c) => {
    if (boardFilter === 'mine') return c.mine
    if (boardFilter === 'loved') return state.loved.includes(c.id)
    return true
  })
  flockCount.textContent = `${state.flock.length} song${state.flock.length === 1 ? '' : 's'} on the wires · ${state.trades} trade${state.trades === 1 ? '' : 's'} made`
  footStats.textContent = `${state.flock.length} songs · ${state.trades} trades · dawn ${fmtDawn(state.dawn)}`
  flockGrid.innerHTML = ''
  if (cards.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'glass board-empty'
    empty.textContent = boardFilter === 'all'
      ? 'The wires are quiet. Broadcast the first chorus of the morning.'
      : 'Nothing here yet — go chirp something worth loving.'
    flockGrid.appendChild(empty)
    return
  }
  for (const c of cards) {
    const loved = state.loved.includes(c.id)
    const el = document.createElement('article')
    el.className = 'glass finch-card reveal in'
    el.innerHTML = `
      <div class="who">
        <span class="avatar">${c.glyph}</span>
        <span><b>${c.from}</b><small>${c.perch}</small></span>
        <span class="dawn-tag">${fmtDawn(c.dawn)}</span>
      </div>
      <div class="minidots" style="margin-top:12px">${c.pattern.map((p) => `<i class="${p === 0 ? 'rest' : ''}" style="height:${p === 0 ? 4 : 6 + p * 5}px"></i>`).join('')}</div>
      <div class="card-actions">
        <button class="icon-btn icon-btn--play" type="button">▶ Play</button>
        <button class="icon-btn ${loved ? 'loved' : ''}" type="button" aria-pressed="${loved}">♥ ${c.likes}</button>
        ${c.mine ? '<button class="icon-btn" type="button">✕</button>' : ''}
      </div>`
    const [playBtn, loveBtn, delBtn] = Array.from(el.querySelectorAll('button'))
    playBtn.addEventListener('click', () => {
      playBtn.classList.add('playing')
      playPattern(c.pattern, { onDone: () => playBtn.classList.remove('playing') })
    })
    loveBtn.addEventListener('click', () => {
      if (loved) {
        state.loved = state.loved.filter((id) => id !== c.id)
        c.likes = Math.max(0, c.likes - 1)
      } else {
        state.loved.push(c.id)
        c.likes++
        const ac = audio()
        if (ac) { chirp(ac, 880, ac.currentTime + 0.02, 0.14, 0.3); chirp(ac, 1174.7, ac.currentTime + 0.14, 0.18, 0.3) }
      }
      save()
      renderFlock()
    })
    delBtn?.addEventListener('click', () => {
      state.flock = state.flock.filter((x) => x.id !== c.id)
      state.loved = state.loved.filter((id) => id !== c.id)
      save()
      renderFlock()
      toast('🗑️ That broadcast flew south for the winter.')
    })
    flockGrid.appendChild(el)
  }
}

$$('#boardTools .chip').forEach((b) => {
  b.addEventListener('click', () => {
    boardFilter = (b.dataset.filter as typeof boardFilter) ?? 'all'
    $$('#boardTools .chip').forEach((x) => x.classList.toggle('active', x === b))
    renderFlock()
  })
})

/* ---------------- quick flight + flock listen ---------------- */
$('#quickBtn').addEventListener('click', () => {
  setDawn(320)
  const motifs = [[1, 3, 5, 3, 2, 4, 1, 0], [5, 3, 1, 2, 4, 5, 0, 3]]
  state.chorus = [...motifs[Math.floor(Math.random() * motifs.length)]]
  save()
  renderSequencer()
  playPattern(state.chorus, { mark: stepEls })
  markFlight('chirped')
  $('#quickHint').textContent = 'Playing now (~6 seconds) — hit “Broadcast & trade” when it lands. Total flight: under 30 seconds.'
  document.getElementById('tradeSection')?.scrollIntoView({ behavior: 'smooth' })
  toast('⚡ Dawn caught! Your chorus is playing — trade it below.')
})
$('#listenBtn').addEventListener('click', () => {
  const first = state.flock[0]
  if (!first) { toast('The wires are quiet — broadcast first!'); return }
  document.getElementById('flockSection')?.scrollIntoView({ behavior: 'smooth' })
  window.setTimeout(() => playPattern(first.pattern, {}), 600)
  toast(`🎧 Now playing: ${first.from}`)
})

/* ---------------- scroll reactions (hard constraint) ---------------- */
const PHASES: Array<[number, string]> = [[0, 'night'], [0.25, 'first light'], [0.55, 'sunrise'], [0.8, 'full chorus']]
function onScroll() {
  const doc = document.documentElement
  const max = Math.max(1, doc.scrollHeight - window.innerHeight)
  const p = Math.min(1, Math.max(0, window.scrollY / max))
  doc.style.setProperty('--scrollp', p.toFixed(4))
  let phase = PHASES[0][1]
  for (const [at, name] of PHASES) if (p >= at) phase = name
  $('#railPhase').textContent = phase
}
let skyFollow = state.dawn
window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', onScroll)

/* reveal on scroll */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) {
    e.target.classList.add('in')
    io.unobserve(e.target)
  }
}, { threshold: 0.12 })
$$('.reveal').forEach((el) => io.observe(el))

/* ---------------- sky canvas ---------------- */
const sky = $<HTMLCanvasElement>('#skyCanvas')
const sctx = sky.getContext('2d')!
interface Bird { x: number; y: number; s: number; v: number; ph: number }
const birds: Bird[] = Array.from({ length: 14 }, () => ({
  x: Math.random(), y: 0.15 + Math.random() * 0.6,
  s: 0.5 + Math.random() * 1.4, v: 0.008 + Math.random() * 0.02, ph: Math.random() * 6.28,
}))
interface Star { x: number; y: number; r: number; tw: number }
const stars: Star[] = Array.from({ length: 90 }, () => ({
  x: Math.random(), y: Math.random() * 0.7, r: 0.4 + Math.random() * 1.3, tw: Math.random() * 6.28,
}))

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function mix3(c1: number[], c2: number[], t: number): string {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`
}
// night plum -> ember -> copper dawn -> gold morning
const SKY_STOPS = [
  [20, 16, 33], [44, 28, 64], [154, 79, 34], [240, 178, 74],
]
function skyColor(p: number): string {
  const seg = Math.min(2.999, p * 3)
  const i = Math.floor(seg)
  return mix3(SKY_STOPS[i], SKY_STOPS[i + 1], seg - i)
}
function skyColorLow(p: number): string {
  const low = [[16, 12, 26], [28, 19, 12], [42, 28, 16], [112, 74, 40]]
  const seg = Math.min(2.999, p * 3)
  const i = Math.floor(seg)
  return mix3(low[i], low[i + 1], seg - i)
}

function sizeSky() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  sky.width = Math.round(window.innerWidth * dpr)
  sky.height = Math.round(window.innerHeight * dpr)
}
sizeSky()
window.addEventListener('resize', sizeSky)

function drawSky(nowMs: number) {
  const t = nowMs / 1000
  const doc = document.documentElement
  const p = Number(doc.style.getPropertyValue('--scrollp') || 0)
  const dawnMix = (skyFollow - DAWN_MIN) / (DAWN_MAX - DAWN_MIN)
  const phase = Math.min(1, Math.max(0, p * 0.75 + dawnMix * 0.45))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = sky.width / dpr
  const h = sky.height / dpr
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const g = sctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, skyColor(phase))
  g.addColorStop(0.62, skyColorLow(phase))
  g.addColorStop(1, '#100b14')
  sctx.fillStyle = g
  sctx.fillRect(0, 0, w, h)
  // stars fade as morning comes
  const starA = Math.max(0, 0.9 - phase * 1.4)
  if (starA > 0.02) {
    for (const s of stars) {
      const a = starA * (0.5 + 0.5 * Math.sin(t * 1.5 + s.tw))
      sctx.beginPath()
      sctx.arc(s.x * w, s.y * h, s.r, 0, 6.283)
      sctx.fillStyle = `rgba(247,234,214,${a.toFixed(3)})`
      sctx.fill()
    }
  }
  // sun climbs with scroll + dawn
  const sunP = Math.min(1, phase * 1.15)
  const sx = w * (0.22 + sunP * 0.5)
  const sy = h * (0.92 - sunP * 0.62)
  const glow = sctx.createRadialGradient(sx, sy, 0, sx, sy, 130)
  glow.addColorStop(0, `rgba(240,178,74,${(0.25 + sunP * 0.6).toFixed(3)})`)
  glow.addColorStop(1, 'rgba(240,178,74,0)')
  sctx.fillStyle = glow
  sctx.fillRect(sx - 140, sy - 140, 280, 280)
  sctx.beginPath()
  sctx.arc(sx, sy, 20 + sunP * 14, 0, 6.283)
  sctx.fillStyle = '#f7d9a0'
  sctx.fill()
  // finches drift across
  sctx.strokeStyle = 'rgba(20,12,8,0.75)'
  sctx.lineWidth = 2
  sctx.lineCap = 'round'
  for (const b of birds) {
    b.x += b.v * 0.016 * (0.5 + phase)
    if (b.x > 1.08) { b.x = -0.08; b.y = 0.12 + Math.random() * 0.6 }
    const bx = b.x * w
    const by = (b.y + Math.sin(t * 2 + b.ph) * 0.012) * h
    const r = 7 * b.s
    const flap = Math.sin(t * 9 + b.ph) * r * 0.55
    sctx.beginPath()
    sctx.moveTo(bx - r, by - flap * 0.4)
    sctx.quadraticCurveTo(bx - r * 0.4, by - r * 0.5 - flap, bx, by)
    sctx.quadraticCurveTo(bx + r * 0.4, by - r * 0.5 - flap, bx + r, by - flap * 0.4)
    sctx.stroke()
  }
  requestAnimationFrame(drawSky)
}
requestAnimationFrame(drawSky)

/* ---------------- init ---------------- */
setDawn(state.dawn, false, false)
renderPerches()
renderSequencer()
renderFlock()
renderFlight()
renderInbox(null)
onScroll()
window.addEventListener('pointerdown', () => audio(), { passive: true, once: true })
