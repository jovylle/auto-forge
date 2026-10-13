import './index.css'
import { heightAt, swellAt, extremesFrom, fmtTime, fmtDay, harborMeasure } from './tide'

/* ============================== types ============================== */

interface Berth { id: string; name: string; lit: boolean; color: string }
interface Marina {
  marinaName: string
  berths: Berth[]
  followTide: boolean
  hourOffset: number
  eggUnlocked: boolean
}

const COLORS: { id: string; label: string; hex: string; locked?: boolean }[] = [
  { id: 'amber', label: 'lantern amber', hex: '#ffc35c' },
  { id: 'ember', label: 'hearth ember', hex: '#ff8a3d' },
  { id: 'rosehip', label: 'rosehip', hex: '#ff7d7d' },
  { id: 'pondlight', label: 'pond light', hex: '#8fe3c0' },
  { id: 'moonmilk', label: 'moon milk', hex: '#cfe6ff' },
  { id: 'wisp', label: "will-o'-wisp (secret)", hex: '#d8ff9e', locked: true },
]

const NAMES = ['Bramble', 'Moss', 'Thistle', 'Clover', 'Nettle', 'Sorrel', 'Burrow', 'Wren', 'Puddle', 'Acorn', 'Fern', 'Dandelion']
const POS_A = [140, 200, 260, 320, 380, 440]
const POS_B = [480, 540, 600, 660, 720, 780]
const KEY = 'klm-state-v1'

function defaults(): Marina {
  const berths: Berth[] = [
    ...POS_A.map((x, i) => ({ id: `a${i + 1}`, name: NAMES[i], lit: i % 3 !== 2, color: COLORS[i % 4].hex, x, y: i % 2 === 0 ? 128 : 252, pierY: 190 })),
    ...POS_B.map((x, i) => ({ id: `b${i + 1}`, name: NAMES[i + 6], lit: i % 3 !== 0, color: COLORS[(i + 2) % 4].hex, x, y: i % 2 === 0 ? 318 : 442, pierY: 380 })),
  ] as unknown as Berth[]
  return { marinaName: 'Kelp Lantern Marina', berths, followTide: true, hourOffset: 0, eggUnlocked: false }
}

// positions live alongside berths at runtime
interface Placed extends Berth { x: number; y: number; pierY: number }
const PLACE: Record<string, { x: number; y: number; pierY: number }> = {}
POS_A.forEach((x, i) => (PLACE[`a${i + 1}`] = { x, y: i % 2 === 0 ? 128 : 252, pierY: 190 }))
POS_B.forEach((x, i) => (PLACE[`b${i + 1}`] = { x, y: i % 2 === 0 ? 318 : 442, pierY: 380 }))
PLACE['cove'] = { x: 838, y: 92, pierY: 150 }

/* ============================== store ============================== */

function encodeState(m: Marina): string {
  const json = JSON.stringify(m)
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeState(s: string): Marina | null {
  try {
    let b64 = s.trim()
    const m = b64.match(/#m=([A-Za-z0-9\-_]+)/) ?? b64.match(/m=([A-Za-z0-9\-_]+)/)
    if (m) b64 = m[1]
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const obj = JSON.parse(decodeURIComponent(escape(atob(b64))))
    if (!obj || !Array.isArray(obj.berths)) return fromJson(s)
    return sanitize(obj)
  } catch {
    return fromJson(s)
  }
}

function fromJson(s: string): Marina | null {
  try {
    const obj = JSON.parse(s)
    if (!obj || !Array.isArray(obj.berths)) return null
    return sanitize(obj)
  } catch {
    return null
  }
}

function sanitize(obj: Partial<Marina>): Marina {
  const d = defaults()
  const berths = (obj.berths ?? d.berths).filter((b) => b && typeof b.id === 'string').slice(0, 14).map((b, i) => ({
    id: b.id,
    name: String(b.name ?? NAMES[i % NAMES.length]).slice(0, 18),
    lit: !!b.lit,
    color: COLORS.some((c) => c.hex === b.color) ? b.color : COLORS[i % 4].hex,
  }))
  return {
    marinaName: String(obj.marinaName ?? d.marinaName).slice(0, 36) || d.marinaName,
    berths,
    followTide: obj.followTide !== false,
    hourOffset: Math.max(-12, Math.min(12, Number(obj.hourOffset) || 0)),
    eggUnlocked: !!obj.eggUnlocked,
  }
}

let state: Marina
try {
  const raw = localStorage.getItem(KEY)
  state = raw ? sanitize(JSON.parse(raw)) : defaults()
} catch {
  state = defaults()
}
if (location.hash.includes('m=')) {
  const fromHash = decodeState(location.hash)
  if (fromHash) {
    state = fromHash
    toastSoon('a shared harbor drifted in on the tide!')
  }
}
// re-apply positions
function placed(): Placed[] {
  return state.berths.map((b) => ({ ...b, ...(PLACE[b.id] ?? { x: 460, y: 280, pierY: 280 }) }))
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch { /* jar is full; the tide keeps it anyway */ }
}

/* ============================== helpers ============================== */

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T
const SVGNS = 'http://www.w3.org/2000/svg'
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

function el(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const n = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
  return n
}

let toastTimer = 0
function toast(msg: string) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3200)
}
function toastSoon(msg: string) {
  window.setTimeout(() => toast(msg), 900)
}

const nowSec = () => Date.now() / 1000 + state.hourOffset * 3600
const currentSwell = () => (state.followTide ? swellAt(nowSec()) : 0.85)

/* ============================== lantern map ============================== */

const harbor = $('#harbor') as unknown as SVGSVGElement
let selectedId: string | null = null

function glowColor(hex: string): string { return hex }

function renderMap() {
  while (harbor.firstChild) harbor.removeChild(harbor.firstChild)
  const swell = currentSwell()

  // banks
  harbor.appendChild(el('ellipse', { cx: '30', cy: '300', rx: '110', ry: '260', fill: '#5d7040' }))
  harbor.appendChild(el('ellipse', { cx: '60', cy: '300', rx: '70', ry: '230', fill: '#6d8148' }))
  harbor.appendChild(el('ellipse', { cx: '895', cy: '270', rx: '105', ry: '250', fill: '#5d7040' }))
  harbor.appendChild(el('ellipse', { cx: '880', cy: '270', rx: '66', ry: '215', fill: '#6d8148' }))

  // smuggler's cove rocks (always drawn; lantern only if unlocked)
  const rocks = el('g', { opacity: '0.95' })
  rocks.appendChild(el('ellipse', { cx: '838', cy: '120', rx: '46', ry: '30', fill: '#4a4038' }))
  rocks.appendChild(el('ellipse', { cx: '862', cy: '104', rx: '30', ry: '22', fill: '#5c5049' }))
  harbor.appendChild(rocks)
  if (!state.eggUnlocked) {
    const q = el('text', { x: '826', y: '76', 'font-size': '26', opacity: '0.8' })
    q.textContent = '?'
    q.setAttribute('font-family', 'Fraunces, serif')
    harbor.appendChild(q)
  }

  // cottage on the right bank
  const cot = el('g', {})
  cot.appendChild(el('rect', { x: '872', y: '330', width: '40', height: '30', rx: '3', fill: '#8a6a45', stroke: '#3a2a1c', 'stroke-width': '2.5' }))
  cot.appendChild(el('path', { d: 'M866 332 L892 308 L918 332 Z', fill: '#5a3d26', stroke: '#3a2a1c', 'stroke-width': '2.5' }))
  cot.appendChild(el('rect', { x: '887', y: '342', width: '10', height: '18', fill: '#ffdf9e', stroke: '#3a2a1c', 'stroke-width': '2' }))
  harbor.appendChild(cot)

  // decorative kelp
  const kelpPaths = ['M120 560 C 112 480, 140 450, 126 380 C 118 340, 130 320, 126 300', 'M800 560 C 808 490, 786 460, 800 400 C 806 372, 796 350, 800 330', 'M470 560 C 464 510, 482 480, 474 440']
  kelpPaths.forEach((d, i) => {
    const p = el('path', { d, fill: 'none', stroke: i % 2 ? '#41603a' : '#37522e', 'stroke-width': '7', 'stroke-linecap': 'round', opacity: '0.75', class: reduced ? '' : 'sway' })
    if (!reduced) {
      (p as SVGElement).style.transformBox = 'fill-box'
      ;(p as SVGElement).style.transformOrigin = 'bottom center'
      ;(p as SVGElement).style.animationDelay = `${-i * 1.7}s`
    }
    harbor.appendChild(p)
  })

  // piers
  for (const [x1, y] of [[110, 190], [450, 380]] as const) {
    const x2 = x1 === 110 ? 470 : 810
    harbor.appendChild(el('line', { x1: String(x1), y1: String(y), x2: String(x2), y2: String(y), class: 'pier' }))
    for (let x = x1 + 10; x < x2; x += 36) {
      harbor.appendChild(el('line', { x1: String(x), y1: String(y - 9), x2: String(x), y2: String(y + 9), class: 'plank' }))
    }
    for (const x of [x1, (x1 + x2) / 2, x2]) {
      harbor.appendChild(el('line', { x1: String(x), y1: String(y), x2: String(x), y2: String(y + 34), class: 'pier-post' }))
    }
  }

  // berths
  for (const b of placed()) {
    if (b.id === 'cove' && !state.eggUnlocked) continue
    harbor.appendChild(berthNode(b, swell))
  }

  updateLitCount()
  renderPostcard()
}

function berthNode(b: Placed, swell: number): SVGGElement {
  const g = el('g', { class: `berth${selectedId === b.id ? ' selected' : ''}` }) as SVGGElement
  g.setAttribute('tabindex', '0')
  g.setAttribute('role', 'button')
  g.setAttribute('aria-label', `${b.name} berth, ${b.lit ? 'lit' : 'unlit'}`)
  const top = Math.min(b.y, b.pierY)
  // mooring line post
  g.appendChild(el('line', { x1: String(b.x), y1: String(top - 6), x2: String(b.x), y2: String(b.y + 16), stroke: '#3a2a1c', 'stroke-width': '5', 'stroke-linecap': 'round' }))
  const lx = b.x, ly = b.y - 22

  if (b.lit) {
    const r = 26 + swell * 16
    const glow = el('circle', { cx: String(lx), cy: String(ly), r: String(r), fill: glowColor(b.color), opacity: String(0.35 + swell * 0.4), class: 'glow' })
    g.appendChild(glow)
    const halo = el('circle', { cx: String(lx), cy: String(ly), r: String(r * 0.55), fill: '#fff8e0', opacity: String(0.35 + swell * 0.35), class: 'glow' })
    g.appendChild(halo)
  }
  // lantern body
  g.appendChild(el('line', { x1: String(lx), y1: String(ly - 30), x2: String(lx), y2: String(ly - 16), stroke: '#3a2a1c', 'stroke-width': '3' }))
  const shade = el('path', {
    d: `M${lx - 11} ${ly - 16} h22 l3 7 v18 a6 6 0 0 1 -6 6 h-16 a6 6 0 0 1 -6 -6 v-18 z`,
    fill: b.lit ? b.color : '#77754f', stroke: '#3a2a1c', 'stroke-width': '2.5', class: 'shade',
  })
  g.appendChild(shade)
  if (b.lit) {
    const core = el('circle', { cx: String(lx), cy: String(ly + 2), r: '4.5', fill: '#fffbe8', class: 'flame-core' })
    if (reduced) core.removeAttribute('class')
    g.appendChild(core)
  }
  const label = el('text', { x: String(lx), y: String(b.y + 34), 'text-anchor': 'middle' })
  label.textContent = b.lit ? b.name : `· ${b.name} ·`
  g.appendChild(label)

  const activate = () => selectBerth(b.id, true)
  g.addEventListener('click', activate)
  g.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      activate()
    }
  })
  return g
}

function selectBerth(id: string, toggle: boolean) {
  selectedId = id
  const b = state.berths.find((x) => x.id === id)
  if (!b) return
  if (toggle) {
    b.lit = !b.lit
    save()
    toast(b.lit ? `${b.name} is lit — mind the moths.` : `${b.name} douses its flame.`)
  }
  renderMap()
  renderBerthCard()
}

function updateLitCount() {
  const lit = state.berths.filter((b) => b.lit).length
  $('#lit-count').textContent = `${lit} of ${state.berths.length} lanterns burning`
}

/* ---------- berth card ---------- */

function renderBerthCard() {
  const b = state.berths.find((x) => x.id === selectedId)
  const sw = $('#swatches')
  sw.innerHTML = ''
  for (const c of COLORS) {
    const locked = !!c.locked && !state.eggUnlocked
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'swatch' + (locked ? ' locked' : '')
    dot.title = locked ? `${c.label} — locked (the moon knows)` : c.label
    dot.setAttribute('role', 'radio')
    dot.setAttribute('aria-checked', b && b.color === c.hex ? 'true' : 'false')
    dot.setAttribute('aria-label', c.label)
    dot.style.background = locked ? '#999' : c.hex
    if (b && !locked) {
      dot.addEventListener('click', () => {
        b.color = c.hex
        save()
        renderMap()
        renderBerthCard()
      })
    } else if (locked) {
      dot.addEventListener('click', () => toast('that glow is a secret. ask the moon.'))
    }
    sw.appendChild(dot)
  }
  if (!b) {
    $('#berth-name').textContent = 'Choose a lantern'
    $('#berth-meta').textContent = 'tap any lantern on the map…'
    ;($('#berth-rename') as HTMLInputElement).value = ''
    ;($('#berth-rename') as HTMLInputElement).disabled = true
    ;($('#berth-toggle') as HTMLButtonElement).disabled = true
    return
  }
  ;($('#berth-rename') as HTMLInputElement).disabled = false
  ;($('#berth-toggle') as HTMLButtonElement).disabled = false
  $('#berth-name').textContent = `${b.name} berth`
  $('#berth-meta').textContent = b.lit ? `burning ${COLORS.find((c) => c.hex === b.color)?.label ?? 'bright'}. click the lantern to douse.` : 'dark & dreaming. click the lantern to light.'
  const ren = $('#berth-rename') as HTMLInputElement
  if (document.activeElement !== ren) ren.value = b.name
}

/* ============================== tide lights ============================== */

const chart = $('#tide-chart') as unknown as HTMLCanvasElement

function renderTide() {
  const t = nowSec()
  const h = heightAt(t)
  const hLater = heightAt(t + 1200)
  const rising = hLater >= h
  $('#tide-height').textContent = harborMeasure(h)
  $('#tide-trend').textContent = rising ? '↗ flooding' : '↘ ebbing'
  $('#tide-swell').textContent = `${Math.round(currentSwell() * 100)}%`
  $('#hour-offset-label').textContent = state.hourOffset === 0 ? 'now' : `${state.hourOffset > 0 ? '+' : ''}${state.hourOffset}h`

  // extremes
  const ex = extremesFrom(new Date(t * 1000), 30).slice(0, 4)
  const ol = $('#extremes')
  ol.innerHTML = ''
  ex.forEach((e, i) => {
    const li = document.createElement('li')
    if (i === 0) li.className = 'next'
    const when = `${e.kind === 'high' ? 'high water' : 'low water'} · ${fmtDay(e.at)}`
    li.innerHTML = `<b>${when}</b><span>${fmtTime(e.at)}</span>`
    ol.appendChild(li)
  })

  // harborer's log line
  const lit = state.berths.filter((b) => b.lit).length
  const next = ex[0]
  const logBits = [
    `${lit} flame${lit === 1 ? '' : 's'} from stem to stern,`,
    next ? `${next.kind === 'high' ? 'high' : 'low'} water ${fmtTime(next.at)} —` : 'slack water —',
    rising ? 'the kelp stands tall.' : 'the kelp drowses low.',
  ]
  if (state.eggUnlocked) logBits.push('the otter approves.')
  $('#log-line').textContent = logBits.join(' ')
  const d = new Date(t * 1000)
  $('#pc-date').textContent = `pressed ${fmtDay(d)} · ${fmtTime(d)} · ${rising ? 'flood' : 'ebb'} tide`

  drawChart(t)
  renderMap()
}

function drawChart(t: number) {
  const ctx = chart.getContext('2d')
  if (!ctx) return
  const W = chart.width, H = chart.height
  ctx.clearRect(0, 0, W, H)
  // grid
  ctx.strokeStyle = '#cfe6ff22'
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke()
  }
  // curve -12..+12h
  const pts: { x: number; y: number }[] = []
  for (let px = 0; px <= W; px += 4) {
    const tt = t + ((px / W) * 24 - 12) * 3600
    const n = swellAt(tt)
    pts.push({ x: px, y: H - 18 - n * (H - 44) })
  }
  // fill
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#8fd0bd88')
  grad.addColorStop(1, '#3d7a6d22')
  ctx.beginPath()
  ctx.moveTo(0, H)
  pts.forEach((p) => ctx.lineTo(p.x, p.y))
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  // line
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.strokeStyle = '#ffc35c'
  ctx.lineWidth = 3
  ctx.stroke()
  // now marker
  const nx = W / 2
  ctx.strokeStyle = '#fff8e0'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  ctx.beginPath(); ctx.moveTo(nx, 8); ctx.lineTo(nx, H - 8); ctx.stroke()
  ctx.setLineDash([])
  // lantern dots along the curve: lit count glows at now
  const lit = state.berths.filter((b) => b.lit).length
  const total = state.berths.length || 1
  const ny = H - 18 - swellAt(t) * (H - 44)
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(nx + Math.cos(a) * 16, ny + Math.sin(a) * 16, 3, 0, Math.PI * 2)
    ctx.fillStyle = i < lit ? '#ffc35c' : '#cfe6ff33'
    ctx.fill()
  }
  ctx.fillStyle = '#f0e6c8'
  ctx.font = '13px Karla, sans-serif'
  ctx.fillText('-12h', 8, H - 6)
  ctx.fillText('+12h', W - 40, H - 6)
}

/* ============================== export ============================== */

function renderPostcard() {
  $('#pc-name').textContent = state.marinaName
  const svg = $('#pc-lanterns') as unknown as SVGSVGElement
  while (svg.firstChild) svg.removeChild(svg.firstChild)
  const berths = placed()
  const n = berths.length
  berths.forEach((b, i) => {
    const x = 18 + (i * (264 / Math.max(n - 1, 1)))
    svg.appendChild(el('line', { x1: String(x), y1: '2', x2: String(x), y2: '14', stroke: '#4a3423', 'stroke-width': '2' }))
    svg.appendChild(el('circle', { cx: String(x), cy: '26', r: '9', fill: b.lit ? b.color : 'none', stroke: '#4a3423', 'stroke-width': '2.5', opacity: b.lit ? '1' : '0.55' }))
    if (b.lit) svg.appendChild(el('circle', { cx: String(x), cy: '26', r: '3', fill: '#fffbe8' }))
  })
  const lit = state.berths.filter((b) => b.lit).length
  $('#pc-line').textContent = `${lit} of ${n} lanterns lit — ${state.marinaName} keeps shining.`
}

function logbookEntry(): string {
  const lit = state.berths.filter((b) => b.lit).length
  const t = nowSec()
  const hLater = heightAt(t + 1200)
  const lines = [
    `— ${state.marinaName} · harborer's log —`,
    `${fmtDay(new Date(t * 1000))}, ${fmtTime(new Date(t * 1000))} · water ${harborMeasure(heightAt(t))}, ${hLater >= heightAt(t) ? 'flooding' : 'ebbing'}`,
    `lanterns burning: ${lit}/${state.berths.length}`,
    ...state.berths.map((b) => `  ${b.lit ? '◉' : '○'} ${b.name} — ${b.lit ? 'lit' : 'dark'}`),
  ]
  if (state.eggUnlocked) lines.push('  (an otter stands night-watch at the cove)')
  return lines.join('\n')
}

/* ============================== easter egg ============================== */

let moonClicks = 0
function moonClick() {
  const moon = $('#moon')
  moon.classList.remove('mad')
  void (moon as HTMLElement).offsetWidth
  moon.classList.add('mad')
  if (state.eggUnlocked) {
    showOtter('the otter waves a paw.')
    return
  }
  moonClicks++
  if (moonClicks >= 5) {
    state.eggUnlocked = true
    if (!state.berths.some((b) => b.id === 'cove')) {
      state.berths.push({ id: 'cove', name: "Smuggler's Cove", lit: true, color: COLORS[5].hex })
    } else {
      state.berths.find((b) => b.id === 'cove')!.lit = true
    }
    save()
    selectedId = 'cove'
    renderMap()
    renderBerthCard()
    showOtter('an otter guards the cove now.')
    toast("the moon winks — Smuggler's Cove lights its will-o'-wisp!")
  } else {
    toast(`the moon blinks… (${moonClicks}/5)`)
  }
}

function showOtter(word: string) {
  $('#otter-word').textContent = word
  const o = $('#otter')
  o.classList.add('show')
  window.setTimeout(() => o.classList.remove('show'), 3600)
}

/* ============================== scroll reactions ============================== */

function onScroll() {
  const doc = document.documentElement
  const max = doc.scrollHeight - innerHeight
  const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0
  // 1. tide gauge water level
  $('#gauge-water').style.height = `${4 + p * 93}%`
  // 2. hero pond rises with scroll
  const water = $('#hero-water')
  water.style.transform = `translateY(${-p * 46}px)`
  // 3. hanging lanterns parallax
  document.querySelectorAll('.hanger').forEach((h, i) => {
    ;(h as HTMLElement).style.translate = `0 ${Math.min(scrollY * (0.04 + i * 0.02), 60)}px`
  })
}

function watchReveals() {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in')
        io.unobserve(e.target)
      }
    }),
    { threshold: 0.12 }
  )
  document.querySelectorAll('.reveal').forEach((s) => io.observe(s))
}

/* ============================== fireflies ============================== */

function startFireflies() {
  const cv = $('#fireflies') as unknown as HTMLCanvasElement
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const fit = () => {
    cv.width = innerWidth
    cv.height = innerHeight
  }
  fit()
  addEventListener('resize', fit)
  interface Fly { x: number; y: number; vx: number; vy: number; r: number; ph: number; hue: string }
  const flies: Fly[] = Array.from({ length: 42 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.2,
    r: 1 + Math.random() * 2.2,
    ph: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.7 ? '#ffcf6e' : '#b8e6a0',
  }))
  let night = false
  const draw = (t: number) => {
    ctx.clearRect(0, 0, cv.width, cv.height)
    const dark = state.eggUnlocked && scrollY > innerHeight * 0.4
    if (dark !== night) night = dark
    for (const f of flies) {
      f.x += f.vx
      f.y += f.vy
      f.ph += 0.03
      if (f.x < -10) f.x = cv.width + 10
      if (f.x > cv.width + 10) f.x = -10
      if (f.y < -10) f.y = cv.height + 10
      if (f.y > cv.height + 10) f.y = -10
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(f.ph))
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r * (night ? 1.5 : 1), 0, Math.PI * 2)
      ctx.fillStyle = f.hue
      ctx.globalAlpha = tw * (night ? 0.95 : 0.5)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
  draw(0)
  if (!reduced) {
    const loop = (t: number) => {
      draw(t)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
}

/* ============================== wiring ============================== */

function wire() {
  $('#moon').addEventListener('click', moonClick)

  $('#berth-toggle').addEventListener('click', () => {
    const b = state.berths.find((x) => x.id === selectedId)
    if (b) selectBerth(b.id, true)
  })
  $('#berth-rename').addEventListener('input', (e) => {
    const b = state.berths.find((x) => x.id === selectedId)
    if (!b) return
    b.name = (e.target as HTMLInputElement).value.slice(0, 18) || b.name
    save()
    renderMap()
    $('#berth-name').textContent = `${b.name} berth`
    renderPostcard()
  })

  const setAll = (lit: boolean) => {
    state.berths.forEach((b) => (b.lit = lit))
    save()
    renderMap()
    toast(lit ? 'every lantern lit — the cove glows!' : 'all dark. the kelp keeps watch.')
  }
  $('#light-all').addEventListener('click', () => setAll(true))
  $('#douse-all').addEventListener('click', () => setAll(false))
  const shuffle = () => {
    const hexes = COLORS.filter((c) => !c.locked || state.eggUnlocked).map((c) => c.hex)
    state.berths.forEach((b) => {
      b.lit = Math.random() < 0.6
      b.color = hexes[Math.floor(Math.random() * hexes.length)]
    })
    save()
    renderMap()
    toast('the fireflies rearranged everything.')
  }
  $('#shuffle').addEventListener('click', shuffle)
  $('#hero-shuffle').addEventListener('click', () => {
    document.querySelector('#map')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
    shuffle()
  })

  $('#hour-offset').addEventListener('input', (e) => {
    state.hourOffset = Number((e.target as HTMLInputElement).value)
    save()
    renderTide()
  })
  $('#follow-tide').addEventListener('change', (e) => {
    state.followTide = (e.target as HTMLInputElement).checked
    save()
    renderTide()
  })

  $('#marina-name').addEventListener('input', (e) => {
    state.marinaName = (e.target as HTMLInputElement).value.slice(0, 36) || 'Kelp Lantern Marina'
    save()
    renderPostcard()
  })

  $('#dl-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${state.marinaName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-logbook.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('logbook pressed & bound.')
  })
  $('#copy-link').addEventListener('click', async () => {
    save()
    const url = `${location.origin}${location.pathname}#m=${encodeState(state)}`
    try {
      await navigator.clipboard.writeText(url)
      toast('share link copied — send the whole harbor!')
    } catch {
      $('#import-box').value = url
      toast('clipboard shy — link left in the import box.')
    }
  })
  $('#copy-log').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(logbookEntry())
      toast('logbook entry copied.')
    } catch {
      $('#import-box').value = logbookEntry()
      toast('clipboard shy — entry left in the import box.')
    }
  })
  $('#do-import').addEventListener('click', () => {
    const v = ($('#import-box') as HTMLTextAreaElement).value
    const next = decodeState(v)
    if (!next) {
      toast('that bottle held no harbor. try again?')
      return
    }
    state = next
    selectedId = null
    ;($('#marina-name') as HTMLInputElement).value = state.marinaName
    ;($('#hour-offset') as HTMLInputElement).value = String(state.hourOffset)
    ;($('#follow-tide') as HTMLInputElement).checked = state.followTide
    save()
    renderAll()
    toast('a new harbor settles onto the water.')
  })
  $('#reset').addEventListener('click', () => {
    if (!confirm('Let a wild tide wash the marina back to driftwood?')) return
    state = defaults()
    selectedId = null
    moonClicks = 0
    save()
    renderAll()
    toast('wild tide. fresh charts.')
  })

  let ticking = false
  addEventListener('scroll', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      onScroll()
      ticking = false
    })
  }, { passive: true })
}

function renderAll() {
  ;($('#marina-name') as HTMLInputElement).value = state.marinaName === 'Kelp Lantern Marina' ? '' : state.marinaName
  ;($('#hour-offset') as HTMLInputElement).value = String(state.hourOffset)
  ;($('#follow-tide') as HTMLInputElement).checked = state.followTide
  renderMap()
  renderBerthCard()
  renderTide()
  renderPostcard()
  onScroll()
}

/* ============================== go ============================== */

wire()
renderAll()
watchReveals()
startFireflies()
onScroll()
window.setInterval(() => renderTide(), 30000)
