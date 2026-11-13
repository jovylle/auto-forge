import './index.css'

/* ================= ORBITING SPRING ATOMS =================
   Sci-fi terminal viz: particles connected by springs orbit a gravity well.
   Palette: void #03060d, cyan #00e5ff, green #39ff14, amber #ffb000, magenta #ff00aa. */

const NUM = 26
const TRAIL_DEFAULT = 28

type Vec = { x: number; y: number }
type Particle = { id: number; x: number; y: number; vx: number; vy: number; r: number; hue: number; trail: Vec[] }
type Spring = { a: number; b: number; rest: number; k: number }

let gravity = 1.6
let trailLen = TRAIL_DEFAULT
let paused = false
let particles: Particle[] = []
let springs: Spring[] = []
let audioCtx: AudioContext | null = null

function ac() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {} }
  return audioCtx
}
function beep(freq: number, dur = 0.12, type: OscillatorType = 'square', vol = 0.08, slide = 0) {
  const c = ac(); if (!c) return
  const o = c.createOscillator(); const g = c.createGain()
  o.type = type; o.frequency.value = freq
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur)
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur)
}
function sweep(up: boolean) {
  const c = ac(); if (!c) return
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.value = up ? 120 : 600
  o.frequency.exponentialRampToValueAtTime(up ? 600 : 120, c.currentTime + 0.25)
  g.gain.value = 0.06; g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25)
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25)
}

function reset() {
  particles = []; springs = []
  const cx = canvas.width / (2 * dpr()); const cy = canvas.height / (2 * dpr())
  const rng = mulberry32(42)
  for (let i = 0; i < NUM; i++) {
    const ang = (i / NUM) * Math.PI * 2 + rng() * 0.4
    const rad = 90 + rng() * 120
    particles.push({
      id: i,
      x: cx + Math.cos(ang) * rad,
      y: cy + Math.sin(ang) * rad,
      vx: -Math.sin(ang) * (1.2 + rng() * 0.6) * (gravity * 30),
      vy: Math.cos(ang) * (1.2 + rng() * 0.6) * (gravity * 30),
      r: 3 + rng() * 2.5,
      hue: (i * 37) % 360,
      trail: [],
    })
  }
  // ring springs
  for (let i = 0; i < NUM; i++) springs.push({ a: i, b: (i + 1) % NUM, rest: 0, k: 0.04 })
  for (const s of springs) {
    const a = particles[s.a], b = particles[s.b]
    s.rest = Math.hypot(a.x - b.x, a.y - b.y)
  }
  sweep(true)
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const app = document.getElementById('app')!
app.innerHTML = `
<div class="flex flex-col md:flex-row h-screen w-screen">
  <aside class="panel w-full md:w-[340px] shrink-0 flex flex-col gap-4 p-5 overflow-y-auto">
    <div>
      <h1 class="title text-2xl glow-cyan">ORBITAL<br/>SPRING ATOMS</h1>
      <p class="text-xs mt-1 opacity-70">particles · springs · gravity well</p>
    </div>
    <div class="border-t border-cyan-500/20 pt-3">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs tracking-widest">GRAVITY</span>
        <span class="readout" id="gVal">1.60</span>
      </div>
      <input id="gravity" type="range" min="0" max="4" step="0.05" value="1.6" class="slider" aria-label="gravity" />
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs tracking-widest">TRAIL LENGTH</span>
        <span class="readout" id="tVal">28</span>
      </div>
      <input id="trail" type="range" min="0" max="80" step="1" value="28" class="slider" aria-label="trail length" />
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs tracking-widest">SPRING STIFFNESS</span>
        <span class="readout" id="kVal">0.04</span>
      </div>
      <input id="stiff" type="range" min="0.005" max="0.2" step="0.005" value="0.04" class="slider" aria-label="spring stiffness" />
    </div>
    <div class="flex gap-2 flex-wrap">
      <button id="pause" class="btn green">PAUSE</button>
      <button id="reset" class="btn amber">RESET</button>
      <button id="clearSprings" class="btn magenta">CLEAR SPRINGS</button>
    </div>
    <div class="panel p-3 text-xs space-y-1">
      <div class="flex justify-between"><span>PARTICLES</span><span class="readout" id="pCount">0</span></div>
      <div class="flex justify-between"><span>SPRINGS</span><span class="readout" id="sCount">0</span></div>
      <div class="flex justify-between"><span>FPS</span><span class="readout" id="fps">0</span></div>
    </div>
    <div class="text-xs opacity-70 leading-relaxed">
      <p class="mb-1"><span class="kbd">drag</span> particle → particle to add spring</p>
      <p class="mb-1"><span class="kbd">space</span> pause / resume</p>
      <p><span class="kbd">r</span> reset system</p>
    </div>
    <div class="mt-auto text-[10px] opacity-40">WEB AUDIO · CANVAS 2D · NO ASSETS</div>
  </aside>
  <main class="flex-1 relative">
    <canvas id="c"></canvas>
    <div id="hint" class="absolute top-3 right-3 text-xs opacity-60 pointer-events-none"></div>
  </main>
</div>`

const canvas = document.getElementById('c') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

function dpr() { return window.devicePixelRatio || 1 }

function resize() {
  const r = canvas.parentElement!.getBoundingClientRect()
  canvas.width = r.width * dpr()
  canvas.height = r.height * dpr()
  canvas.style.width = r.width + 'px'
  canvas.style.height = r.height + 'px'
}
window.addEventListener('resize', resize)
resize()

// UI refs
const gSlider = document.getElementById('gravity') as HTMLInputElement
const tSlider = document.getElementById('trail') as HTMLInputElement
const kSlider = document.getElementById('stiff') as HTMLInputElement
const pauseBtn = document.getElementById('pause') as HTMLButtonElement
const resetBtn = document.getElementById('reset') as HTMLButtonElement
const clearBtn = document.getElementById('clearSprings') as HTMLButtonElement

gSlider.addEventListener('input', () => {
  gravity = parseFloat(gSlider.value)
  document.getElementById('gVal')!.textContent = gravity.toFixed(2)
  beep(220 + gravity * 80, 0.06, 'sine', 0.05)
})
tSlider.addEventListener('input', () => {
  trailLen = parseInt(tSlider.value)
  document.getElementById('tVal')!.textContent = String(trailLen)
})
let stiff = 0.04
kSlider.addEventListener('input', () => {
  stiff = parseFloat(kSlider.value)
  document.getElementById('kVal')!.textContent = stiff.toFixed(3)
  for (const s of springs) s.k = stiff
  beep(300, 0.05, 'triangle', 0.04)
})
pauseBtn.addEventListener('click', () => {
  paused = !paused
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE'
  beep(paused ? 180 : 320, 0.08, 'square', 0.06)
})
resetBtn.addEventListener('click', reset)
clearBtn.addEventListener('click', () => { springs = []; beep(120, 0.1, 'sawtooth', 0.05) })

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); pauseBtn.click() }
  if (e.key.toLowerCase() === 'r') resetBtn.click()
})

// drag to add spring
let dragFrom: number | null = null
let dragPos: Vec | null = null

function hitParticle(px: number, py: number): number | null {
  const s = dpr()
  const x = px * s, y = py * s
  // convert to logical
  const lx = px, ly = py
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    if (Math.hypot(p.x - lx, p.y - ly) < Math.max(12, p.r * 2.5)) return i
  }
  return null
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left, my = e.clientY - rect.top
  const i = hitParticle(mx, my)
  if (i !== null) { dragFrom = i; dragPos = { x: mx, y: my }; beep(440, 0.05, 'sine', 0.05) }
})
canvas.addEventListener('mousemove', (e) => {
  if (dragFrom === null) return
  const rect = canvas.getBoundingClientRect()
  dragPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
})
canvas.addEventListener('mouseup', (e) => {
  if (dragFrom === null) return
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left, my = e.clientY - rect.top
  const j = hitParticle(mx, my)
  if (j !== null && j !== dragFrom) {
    // avoid duplicate
    const exists = springs.some(s => (s.a === dragFrom && s.b === j) || (s.a === j && s.b === dragFrom))
    if (!exists) {
      const a = particles[dragFrom], b = particles[j]
      springs.push({ a: dragFrom, b: j, rest: Math.hypot(a.x - b.x, a.y - b.y), k: stiff })
      beep(660, 0.1, 'triangle', 0.07, 200)
    }
  }
  dragFrom = null; dragPos = null
})

// physics
function step(dt: number) {
  if (paused) return
  const cx = canvas.width / (2 * dpr()); const cy = canvas.height / (2 * dpr())
  // gravity + springs
  const fx = new Array(particles.length).fill(0)
  const fy = new Array(particles.length).fill(0)
  // central gravity
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const dx = cx - p.x, dy = cy - p.y
    const r2 = dx * dx + dy * dy + 400
    const r = Math.sqrt(r2)
    const f = gravity * 120 / r2
    fx[i] += (dx / r) * f
    fy[i] += (dy / r) * f
  }
  // springs
  for (const s of springs) {
    const a = particles[s.a], b = particles[s.b]
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.hypot(dx, dy) || 1
    const force = s.k * (d - s.rest)
    const ux = dx / d, uy = dy / d
    fx[s.a] += ux * force; fy[s.a] += uy * force
    fx[s.b] -= ux * force; fy[s.b] -= uy * force
  }
  // integrate
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    p.vx += fx[i] * dt; p.vy += fy[i] * dt
    p.vx *= 0.995; p.vy *= 0.995
    p.x += p.vx * dt; p.y += p.vy * dt
    // trail
    p.trail.push({ x: p.x, y: p.y })
    if (p.trail.length > trailLen) p.trail.shift()
  }
}

// render
let last = performance.now()
let fpsAcc = 0, fpsFrames = 0, fpsLast = performance.now()
function render() {
  const w = canvas.width, h = canvas.height
  const s = dpr()
  // fade background for trails? We redraw fully but trails drawn from history
  ctx.fillStyle = 'rgba(3,6,13,0.35)'
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2, cy = h / 2
  // gravity well
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 * s)
  grad.addColorStop(0, 'rgba(0,229,255,0.9)')
  grad.addColorStop(0.4, 'rgba(0,229,255,0.25)')
  grad.addColorStop(1, 'rgba(0,229,255,0)')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(cx, cy, 60 * s, 0, Math.PI * 2); ctx.fill()
  // core
  ctx.fillStyle = '#00e5ff'
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 24 * s
  ctx.beginPath(); ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  // springs
  ctx.lineWidth = 1.5 * s
  for (const sp of springs) {
    const a = particles[sp.a], b = particles[sp.b]
    if (!a || !b) continue
    ctx.strokeStyle = 'rgba(255,176,0,0.55)'
    ctx.shadowColor = '#ffb000'; ctx.shadowBlur = 6 * s
    ctx.beginPath(); ctx.moveTo(a.x * s, a.y * s); ctx.lineTo(b.x * s, b.y * s); ctx.stroke()
  }
  ctx.shadowBlur = 0

  // trails
  for (const p of particles) {
    if (p.trail.length < 2) continue
    ctx.lineWidth = 1.2 * s
    for (let i = 1; i < p.trail.length; i++) {
      const alpha = i / p.trail.length
      ctx.strokeStyle = `hsla(${p.hue}, 100%, 60%, ${alpha * 0.6})`
      ctx.beginPath()
      ctx.moveTo(p.trail[i - 1].x * s, p.trail[i - 1].y * s)
      ctx.lineTo(p.trail[i].x * s, p.trail[i].y * s)
      ctx.stroke()
    }
  }

  // particles
  for (const p of particles) {
    ctx.shadowColor = `hsl(${p.hue},100%,60%)`; ctx.shadowBlur = 12 * s
    ctx.fillStyle = `hsl(${p.hue},100%,65%)`
    ctx.beginPath(); ctx.arc(p.x * s, p.y * s, p.r * s, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
  }

  // drag line
  if (dragFrom !== null && dragPos) {
    const p = particles[dragFrom]
    ctx.strokeStyle = 'rgba(255,0,170,0.8)'
    ctx.lineWidth = 2 * s
    ctx.setLineDash([6 * s, 4 * s])
    ctx.beginPath(); ctx.moveTo(p.x * s, p.y * s); ctx.lineTo(dragPos.x * s, dragPos.y * s); ctx.stroke()
    ctx.setLineDash([])
  }

  // fps
  fpsFrames++
  const now = performance.now()
  if (now - fpsLast > 500) {
    document.getElementById('fps')!.textContent = String(Math.round(fpsFrames * 1000 / (now - fpsLast)))
    fpsFrames = 0; fpsLast = now
  }
  document.getElementById('pCount')!.textContent = String(particles.length)
  document.getElementById('sCount')!.textContent = String(springs.length)
}

let acc = 0
function loop(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now
  acc += dt
  // fixed step a few times
  let steps = 0
  while (acc >= 1 / 60 && steps < 3) { step(1 / 60); acc -= 1 / 60; steps++ }
  render()
  requestAnimationFrame(loop)
}
reset()
requestAnimationFrame(loop)
