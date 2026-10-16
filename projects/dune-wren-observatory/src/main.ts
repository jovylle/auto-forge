import './index.css'

/* ================= DUNE WREN OBSERVATORY =================
   Pop-art viz: interactive star chart, 3 dune scopes, night export.
   Palette: #FF2D55 #FFC700 #2B44FF + #0D0D0D + #FFFFFF (system fonts only). */

type Star = {
  id: string; x: number; y: number; mag: number;
  name?: string; lore?: string; constId?: string;
}
type Constellation = {
  id: string; name: string; lore: string; stars: string[]; links: [number, number][];
}
type Scope = {
  id: string; no: string; name: string; nickname: string; dune: string;
  desc: string; cx: number; cy: number; zoom: number; fov: number;
}
type View = { cx: number; cy: number; zoom: number; rot: number }
type Night = {
  id: string; name: string; at: string; view: View; scopeId: string;
  hour: number; notes: string; log: { starId: string; name: string; at: string }[];
}

/* ---------- seeded rng ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- sky data ---------- */
const FIRST = ['Eyebright', 'Thicket', 'Sedge', 'Cactus', 'Canyon', 'Marsh', 'Rock', 'Fern', 'Crest', 'Hollow', 'Ridge', 'Sage', 'Burrow', 'Flit', 'Trill', 'Warble', 'Chirr', 'Pip', 'Gully', 'Mesa', 'Dune', 'Salt', 'Wren', 'Tule', 'Cholla', 'Arroyo', 'Bajada']
const STAR_LORE = [
  'First lamp lit by the dune wrens.', 'Guides fledglings home past midnight.',
  'Hums low when the wind crosses the crest.', 'A seed-star, carried in a wren beak.',
  'Blinks in threes — the wren knock.', 'Marks the hour of the night chorus.',
  'Cold and steady; the hollow scope favorite.', 'Dust-tailed; best after a storm.',
]

function buildSky(): { stars: Star[]; consts: Constellation[]; byId: Map<string, Star> } {
  const rnd = mulberry32(20261016)
  const stars: Star[] = []
  const consts: Constellation[] = []
  const byId = new Map<string, Star>()
  const push = (s: Star) => { stars.push(s); byId.set(s.id, s) }

  const defs: { id: string; name: string; lore: string; pts: [number, number][]; links: [number, number][] }[] = [
    {
      id: 'wren', name: 'The Wren', lore: 'The little cartographer herself — beak pointed at dawn.',
      pts: [[0.16, 0.40], [0.19, 0.36], [0.225, 0.345], [0.25, 0.375], [0.235, 0.41], [0.205, 0.425], [0.175, 0.435]],
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 5]],
    },
    {
      id: 'crest', name: 'Dune Crest', lore: 'The long ridge where scope-01 keeps its wide eye.',
      pts: [[0.33, 0.55], [0.365, 0.515], [0.40, 0.53], [0.425, 0.565], [0.395, 0.585]],
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]],
    },
    {
      id: 'kettle', name: 'Night Kettle', lore: 'A pot of dark tea the wrens sip between sightings.',
      pts: [[0.555, 0.63], [0.585, 0.575], [0.625, 0.585], [0.635, 0.63], [0.60, 0.655]],
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 3]],
    },
    {
      id: 'scoop', name: 'Salt Scoop', lore: 'Dips into the milky flat and comes up glittering.',
      pts: [[0.72, 0.32], [0.755, 0.29], [0.79, 0.315], [0.765, 0.355]],
      links: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    {
      id: 'tail', name: 'Tail Feather', lore: 'One barred feather, dropped mid-migration, still glowing.',
      pts: [[0.82, 0.70], [0.845, 0.665], [0.87, 0.68], [0.885, 0.645], [0.905, 0.66], [0.92, 0.625]],
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    },
  ]

  let li = 0
  for (const d of defs) {
    const ids: string[] = []
    d.pts.forEach(([x, y], i) => {
      const id = `${d.id}-${i}`
      ids.push(id)
      push({
        id, x, y, mag: 0.4 + rnd() * 0.9,
        name: `${d.name.split(' ')[1] ?? d.name} ${'αβγδεζη'[i] ?? i} · ${FIRST[(li * 7 + i * 3) % FIRST.length].trim()}`,
        lore: STAR_LORE[(li + i) % STAR_LORE.length], constId: d.id,
      })
    })
    consts.push({ id: d.id, name: d.name, lore: d.lore, stars: ids, links: d.links })
    li++
  }

  // field stars (avoid crowding named ones)
  let made = 0, guard = 0
  while (made < 520 && guard++ < 6000) {
    const x = rnd(), y = 0.03 + rnd() * 0.94
    let clash = false
    for (const s of stars) {
      const dx = Math.abs(s.x - x), dy = Math.abs(s.y - y)
      if (dx < 0.012 && dy < 0.012) { clash = true; break }
    }
    if (clash) continue
    const r = rnd()
    push({ id: `f-${made}`, x, y, mag: r < 0.06 ? 0.5 + rnd() : r < 0.3 ? 1.2 + rnd() : 2 + rnd() * 1.4 })
    made++
  }
  return { stars, consts, byId }
}

const SCOPES: Scope[] = [
  {
    id: 'crest', no: '01', name: 'Crest Scope', nickname: '“Wide-Eye”', dune: 'High Dune',
    desc: 'Sweeping wide-field glass. Catches whole constellations in one gulp — start every night here.',
    cx: 0.28, cy: 0.44, zoom: 1.15, fov: 0.42,
  },
  {
    id: 'hollow', no: '02', name: 'Hollow Scope', nickname: '“Pinpoint”', dune: 'Hollow Dune',
    desc: 'Narrow, ruthless magnification sunk in the cool hollow. Splits tight pairs in the Night Kettle.',
    cx: 0.60, cy: 0.60, zoom: 2.6, fov: 0.15,
  },
  {
    id: 'salt', no: '03', name: 'Salt-Flat Scope', nickname: '“Comet Sweeper”', dune: 'Salt Flat',
    desc: 'Fast sweeper on the white flat. Meteor watch post — best seat for falling-star season.',
    cx: 0.80, cy: 0.42, zoom: 1.7, fov: 0.26,
  },
]

const { stars: STARS, consts: CONSTS, byId: STAR_BY_ID } = buildSky()

/* ---------- state ---------- */
const LS_STATE = 'dwo_state_v1'
const LS_NIGHTS = 'dwo_nights_v1'

const state = {
  view: { cx: 0.5, cy: 0.5, zoom: 1.15, rot: 0 } as View,
  scopeId: 'crest' as string,
  hour: 22,
  showLines: true, showNames: true, showMeteors: true, showWrens: true,
  selectedId: null as string | null,
  log: [] as { starId: string; name: string; at: string }[],
  notes: '',
}

function saveState() {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify({
      view: state.view, scopeId: state.scopeId, hour: state.hour,
      showLines: state.showLines, showNames: state.showNames,
      showMeteors: state.showMeteors, showWrens: state.showWrens,
      log: state.log, notes: state.notes,
    }))
  } catch { /* private mode — carry on */ }
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_STATE)
    if (!raw) return
    const s = JSON.parse(raw)
    if (s.view) {
      state.view = { ...state.view, ...s.view }
      state.view.cx = (((state.view.cx % 1) + 1) % 1)
      state.view.cy = Math.min(1, Math.max(0, state.view.cy))
      state.view.zoom = Math.min(4, Math.max(0.8, state.view.zoom))
    }
    if (typeof s.scopeId === 'string' && SCOPES.some(x => x.id === s.scopeId)) state.scopeId = s.scopeId
    if (typeof s.hour === 'number') state.hour = Math.min(24, Math.max(0, s.hour))
    for (const k of ['showLines', 'showNames', 'showMeteors', 'showWrens'] as const) {
      if (typeof s[k] === 'boolean') state[k] = s[k]
    }
    if (typeof s.notes === 'string') state.notes = s.notes.slice(0, 4000)
    if (Array.isArray(s.log)) state.log = s.log.filter(e => e && typeof e.starId === 'string' && typeof e.name === 'string').slice(0, 200)
  } catch { /* ignore */ }
}
function loadNights(): Night[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_NIGHTS) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(n => n && typeof n.id === 'string' && n.view && Array.isArray(n.log)).slice(0, 24)
  } catch { return [] }
}
function persistNights(n: Night[]) {
  try { localStorage.setItem(LS_NIGHTS, JSON.stringify(n)) } catch { /* ignore */ }
}

function hashToView(): boolean {
  try {
    const m = location.hash.match(/#n=([A-Za-z0-9+/=]+)/)
    if (!m) return false
    const d = JSON.parse(atob(m[1]))
    if (typeof d.cx === 'number') state.view.cx = ((d.cx % 1) + 1) % 1
    if (typeof d.cy === 'number') state.view.cy = Math.min(1, Math.max(0, d.cy))
    if (typeof d.zoom === 'number') state.view.zoom = Math.min(4, Math.max(0.8, d.zoom))
    if (typeof d.rot === 'number') state.view.rot = d.rot
    if (typeof d.scopeId === 'string' && SCOPES.some(s => s.id === d.scopeId)) state.scopeId = d.scopeId
    if (typeof d.selectedId === 'string' && STAR_BY_ID.has(d.selectedId)) state.selectedId = d.selectedId
    return true
  } catch { return false }
}

/* ---------- dom ---------- */
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T

const app = $('#app')
app.innerHTML = `
<a href="#chart" class="kbd" style="position:absolute;left:-9999px;top:0;" onfocus="this.style.left='8px'" onblur="this.style.left='-9999px'">Skip to star chart</a>
<div class="ticker" aria-hidden="true"><span class="ticker-track" id="ticker"></span></div>

<header class="max-w-[1200px] mx-auto px-5 pt-8 pb-2 flex flex-wrap items-start gap-5 justify-between">
  <div class="logo-block px-6 py-4 max-w-[560px]">
    <div class="badge badge-yellow mb-2">Wren chart service · est. dusk</div>
    <h1 class="display" style="font-size:clamp(30px,5vw,58px);">
      Dune <span class="wren">Wren</span><br/>Observatory
    </h1>
    <p class="mt-2 text-[13px] font-bold tracking-wide" style="color:#fff;">Wrens chart the stars from dune scopes. Pick a scope, sweep the chart, export the night.</p>
  </div>
  <div class="flex flex-col gap-3 items-end pt-2">
    <div class="panel px-4 py-3 text-right">
      <div class="badge badge-blue mb-1">Local sky time</div>
      <div class="mono font-bold text-xl" id="clock">--:--:--</div>
      <div class="mono text-[11px]" id="starcount" style="color:var(--ink-64);">${STARS.length} stars catalogued · 5 wren constellations</div>
    </div>
    <div class="flex gap-2">
      <a class="btn btn-yellow" href="#scopes" style="text-decoration:none;">Scopes</a>
      <a class="btn btn-ink" href="#export" style="text-decoration:none;">Export</a>
    </div>
  </div>
</header>

<main class="max-w-[1200px] mx-auto px-5 pb-24">

  <!-- chart + rail -->
  <section class="grid gap-8 mt-6 lg:grid-cols-[62%_1fr] items-start" aria-label="Star chart and controls">
    <div>
      <div class="flex items-center gap-3 mb-3 flex-wrap">
        <span class="badge badge-red" id="scopeBadge">Scope-01 · Wide-Eye</span>
        <span class="mono text-[12px] font-bold" id="viewReadout"></span>
      </div>
      <div class="chart-frame" id="frame" style="height:min(62vh,560px);">
        <canvas id="chart" tabindex="0" role="img"
          aria-label="Interactive star chart. Arrow keys pan, plus and minus zoom, Enter selects the nearest star."></canvas>
        <div class="tip" id="tip" hidden></div>
        <div class="zoom-wipe" id="wipe"><span>Zoom!</span></div>
      </div>
      <p class="mono text-[12px] mt-3" style="color:var(--ink-64);">
        Drag to pan · scroll to zoom · click a star · keys: <span class="kbd">←↑↓→</span> pan
        <span class="kbd">+</span><span class="kbd">−</span> zoom <span class="kbd">Enter</span> select
      </p>
      <div class="panel mt-4 p-4" id="starPanel" aria-live="polite"></div>
    </div>

    <div class="rail-offset flex flex-col gap-5">
      <div class="panel panel-blue p-5 benday-light">
        <h2 class="display text-white" style="font-size:22px;">Chart controls</h2>
        <label class="block mt-4 mb-1 font-bold text-[12px] uppercase tracking-widest text-white" for="hour">Night hour · <span id="hourVal" class="mono"></span></label>
        <input class="slider" type="range" id="hour" min="0" max="24" step="0.25" value="22" aria-label="Night hour — rotates the sky" />
        <label class="block mt-4 mb-1 font-bold text-[12px] uppercase tracking-widest text-white" for="zoom">Magnification · <span id="zoomVal" class="mono"></span></label>
        <input class="slider" type="range" id="zoom" min="0.8" max="4" step="0.05" value="1.15" aria-label="Chart magnification" />
        <div class="grid grid-cols-2 gap-3 mt-5" role="group" aria-label="Chart layers">
          <div class="toggle" id="tLines" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Lines</div>
          <div class="toggle" id="tNames" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Names</div>
          <div class="toggle" id="tWrens" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Wrens</div>
          <div class="toggle" id="tMeteors" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Meteors</div>
        </div>
      </div>

      <div class="panel p-5">
        <h2 class="display" style="font-size:22px;">Find a star</h2>
        <input class="field mt-3" id="search" type="search" placeholder="Type a star name — try “trill”…" aria-label="Search named stars" autocomplete="off" />
        <div id="results" class="mt-2 flex flex-col" role="group" aria-label="Search results"></div>
      </div>

      <div class="panel panel-red p-5 benday-light">
        <h2 class="display text-white" style="font-size:22px;">Field log</h2>
        <p class="text-[13px] font-bold mt-1">Stars you tap with “Log it” land here and ship with the night export.</p>
        <div id="logList" class="mt-3 bg-white rounded p-2" style="border:3px solid var(--ink);"></div>
        <label class="block mt-4 mb-1 font-bold text-[12px] uppercase tracking-widest" for="notes">Night notes</label>
        <textarea class="field" id="notes" placeholder="Wind from the west. Wrens loud tonight…"></textarea>
      </div>
    </div>
  </section>

  <!-- scopes -->
  <section id="scopes" class="mt-20" aria-label="Dune scopes">
    <div class="flex items-end gap-4 flex-wrap">
      <h2 class="display outline-text" style="font-size:clamp(34px,6vw,72px);">Dune scopes</h2>
      <p class="font-bold text-[14px] max-w-[340px] pb-2">Three telescopes. Three dunes. One sky full of wrens. Switching scopes slews the chart.</p>
    </div>
    <div class="grid gap-8 mt-8 md:grid-cols-3" id="scopeGrid"></div>
  </section>

  <!-- constellations -->
  <section class="mt-24" aria-label="Wren constellations">
    <h2 class="display" style="font-size:clamp(28px,4.5vw,52px);">The wren <span style="background:var(--pop);color:#fff;padding:0 10px;border:3px solid var(--ink);">canon</span></h2>
    <div class="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3" id="constGrid"></div>
  </section>
</main>

<!-- export strip -->
<section id="export" class="export-strip mt-16" aria-label="Night export">
  <div class="max-w-[1200px] mx-auto px-5 py-12">
    <div class="flex items-center gap-4 flex-wrap">
      <h2 class="display" style="font-size:clamp(30px,5vw,60px);">Night export</h2>
      <span class="burst" style="position:static;">Pack it up!</span>
    </div>
    <p class="font-bold mt-2 max-w-[620px]">Snapshot the chart as a PNG poster, download the observing log, or copy a link that restores this exact sky on any device.</p>
    <div class="flex gap-3 mt-6 flex-wrap">
      <button class="btn btn-ink" id="btnPng">Export PNG poster</button>
      <button class="btn btn-red" id="btnLog">Download log (.md)</button>
      <button class="btn" id="btnLink">Copy night link</button>
      <button class="btn btn-blue" id="btnSave">Save night</button>
    </div>
    <p class="mono text-[12px] font-bold mt-3" id="exportMsg" aria-live="polite"></p>
    <h3 class="display mt-8" style="font-size:20px;">Saved nights</h3>
    <div id="nights" class="grid gap-4 mt-3 md:grid-cols-2 lg:grid-cols-3"></div>
  </div>
</section>

<footer class="max-w-[1200px] mx-auto px-5 py-10 flex flex-wrap gap-4 items-center justify-between">
  <p class="display" style="font-size:15px;">Dune Wren Observatory · charted by wrens</p>
  <p class="mono text-[12px]" style="color:var(--ink-64);">3 inks + black &amp; white · system type · your nights never leave this browser</p>
</footer>
<div class="sr-only" aria-live="polite" id="live"></div>
`

/* ---------- canvas ---------- */
const canvas = $('#chart') as HTMLCanvasElement
const frame = $('#frame')
const tip = $('#tip')
const wipe = $('#wipe')
const ctx = canvas.getContext('2d')!
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

let W = 0, H = 0, DPR = 1
function resize() {
  const r = frame.getBoundingClientRect()
  DPR = Math.min(2, devicePixelRatio || 1)
  W = Math.max(280, r.width); H = Math.max(320, r.height - 0)
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR)
  canvas.style.height = `${H}px`
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  renderDots()
}
new ResizeObserver(resize).observe(frame)

// halftone dots, pre-rendered per resize (cheap blit each frame)
let dots: HTMLCanvasElement | null = null
function renderDots() {
  dots = document.createElement('canvas')
  dots.width = Math.max(1, Math.round(W)); dots.height = Math.max(1, Math.round(H))
  const t = dots.getContext('2d')!
  t.fillStyle = 'rgba(255,255,255,0.55)'
  for (let y = 0; y < H; y += 26) for (let x = 0; x < W; x += 26) {
    t.beginPath(); t.arc(x + 13, y + 13, 1.1, 0, 7); t.fill()
  }
}
resize()

function projectRaw(s: Star, v: View): { x: number; y: number; vis: boolean } {
  let dx = (s.x - v.cx) % 1
  if (dx > 0.5) dx -= 1
  if (dx < -0.5) dx += 1
  const dy = s.y - v.cy
  const c = Math.cos(v.rot), n = Math.sin(v.rot)
  const rx = dx * c - dy * n, ry = dx * n + dy * c
  const sc = Math.min(W, H) * v.zoom
  const x = W / 2 + rx * sc, y = H / 2 + ry * sc
  return { x, y, vis: x > -40 && x < W + 40 && y > -40 && y < H + 40 }
}
// per-frame projection cache (view is constant within a frame)
let projCache = new Map<string, { x: number; y: number; vis: boolean }>()
function project(s: Star, v: View) {
  const hit = projCache.get(s.id)
  if (hit) return hit
  const out = projectRaw(s, v)
  projCache.set(s.id, out)
  return out
}

type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number }
let meteors: Meteor[] = []
let lastSpawn = 0

function spawnMeteor(now: number) {
  const rnd = Math.random
  const x = rnd() * W, y = rnd() * H * 0.5
  const a = Math.PI * (0.72 + rnd() * 0.12)
  const sp = 500 + rnd() * 420
  meteors.push({ x, y, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp * 0.5 + 160, life: 0, max: 0.55 + rnd() * 0.3 })
  lastSpawn = now
}

function drawSky(now: number, dt: number) {
  const v = state.view
  // sky wash: flat scope-blue + white/black-alpha shading (palette-safe)
  ctx.fillStyle = '#2B44FF'
  ctx.fillRect(0, 0, W, H)
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(255,255,255,0.14)')
  shade.addColorStop(0.5, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)
  // halftone (pre-rendered per resize)
  if (dots) { ctx.save(); ctx.globalAlpha = 0.10; ctx.drawImage(dots, 0, 0, W, H); ctx.restore() }
  // dune silhouette
  ctx.fillStyle = '#0D0D0D'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, H - 26)
  ctx.bezierCurveTo(W * 0.2, H - 70, W * 0.35, H - 8, W * 0.55, H - 34)
  ctx.bezierCurveTo(W * 0.72, H - 54, W * 0.85, H - 12, W, H - 30)
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill()
  // tiny scope domes on the dune
  ctx.fillStyle = '#FFC700'
  for (const fx of [0.18, 0.55, 0.85]) {
    const dx = W * fx, dy = H - 30 - Math.sin(fx * 9) * 8
    ctx.beginPath(); ctx.arc(dx, dy - 8, 7, Math.PI, 0); ctx.fill()
    ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 2.5; ctx.stroke()
  }

  const sc = Math.min(W, H) * v.zoom
  const tw = reduced ? 0 : 1

  // constellation lines (under stars)
  if (state.showLines) {
    for (const c of CONSTS) {
      const pts = c.stars.map(id => project(STAR_BY_ID.get(id)!, v))
      for (const [a, b] of c.links) {
        const p = pts[a], q = pts[b]
        if (!p.vis && !q.vis) continue
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 5.5
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
      }
    }
  }

  // stars
  for (const s of STARS) {
    const p = project(s, v)
    if (!p.vis) continue
    const named = !!s.name
    const base = named ? 7 - s.mag * 2.2 : 5.2 - s.mag * 1.15
    const r = Math.max(0.9, base * (0.75 + v.zoom * 0.22))
    const pulse = named && tw ? 1 + Math.sin(now / 700 + s.x * 40) * 0.12 : 1
    if (named) {
      ctx.fillStyle = '#FFC700'
      ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(p.x, p.y, r * pulse, 0, 7); ctx.fill(); ctx.stroke()
      if (s.mag < 1.1) { // sparkle cross
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2
        const L = r * 2.4
        ctx.beginPath()
        ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y)
        ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L)
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = s.mag < 1.4 ? '#FFFFFF' : 'rgba(255,255,255,0.75)'
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill()
    }
  }

  // vertex dots + names
  ctx.textAlign = 'center'
  for (const c of CONSTS) {
    for (const id of c.stars) {
      const s = STAR_BY_ID.get(id)!
      const p = project(s, v)
      if (!p.vis) continue
      ctx.fillStyle = '#FF2D55'
      ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 7); ctx.fill(); ctx.stroke()
      if (state.showNames && v.zoom > 0.95 && s.name) {
        ctx.font = '700 11px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
        ctx.lineWidth = 3; ctx.strokeStyle = '#0D0D0D'
        ctx.strokeText(s.name, p.x, p.y - 12)
        ctx.fillStyle = '#FFC700'
        ctx.fillText(s.name, p.x, p.y - 12)
      }
    }
    // canon label at centroid
    if (state.showNames && v.zoom <= 1.6) {
      const cx = c.stars.reduce((a, id) => a + project(STAR_BY_ID.get(id)!, v).x, 0) / c.stars.length
      const cy = c.stars.reduce((a, id) => a + project(STAR_BY_ID.get(id)!, v).y, 0) / c.stars.length
      if (cx > 0 && cx < W && cy > 0 && cy < H) {
        ctx.font = '900 13px "Arial Black", Helvetica, Arial, sans-serif'
        ctx.lineWidth = 4; ctx.strokeStyle = '#0D0D0D'
        ctx.strokeText(c.name.toUpperCase(), cx, cy + 26)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(c.name.toUpperCase(), cx, cy + 26)
      }
    }
  }

  // wrens hopping along constellation edges
  if (state.showWrens && state.showLines) {
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#0D0D0D'; ctx.lineCap = 'round'
    CONSTS.forEach((c, ci) => {
      const edge = c.links[Math.floor(now / 2600 + ci) % c.links.length]
      const t = ((now / 2600 + ci * 0.37) % 1)
      const A = project(STAR_BY_ID.get(c.stars[edge[0]])!, v)
      const B = project(STAR_BY_ID.get(c.stars[edge[1]])!, v)
      if (!A.vis || !B.vis) return
      const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t - 8
      const hop = reduced ? 0 : Math.abs(Math.sin(now / 180 + ci)) * 4
      ctx.beginPath()
      ctx.moveTo(x - 6, y - hop); ctx.lineTo(x, y - 4 - hop); ctx.lineTo(x + 6, y - hop)
      ctx.stroke()
      ctx.fillStyle = '#FF2D55'
      ctx.beginPath(); ctx.arc(x, y - 1 - hop, 2.2, 0, 7); ctx.fill()
    })
  }

  // meteors
  if (state.showMeteors && !reduced) {
    if (now - lastSpawn > (state.scopeId === 'salt' ? 1400 : 3200)) spawnMeteor(now)
  }
  meteors = meteors.filter(m => (m.life += dt) < m.max)
  for (const m of meteors) {
    m.x += m.vx * dt; m.y += m.vy * dt
    const k = 1 - m.life / m.max
    ctx.strokeStyle = `rgba(255,199,0,${0.9 * k})`
    ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.09, m.y - m.vy * 0.09); ctx.stroke()
  }

  // scope FOV ring
  const scope = SCOPES.find(s => s.id === state.scopeId)!
  ctx.save()
  ctx.strokeStyle = '#FFC700'; ctx.lineWidth = 3
  ctx.setLineDash([12, 8])
  ctx.beginPath(); ctx.arc(W / 2, H / 2, scope.fov * sc, 0, 7); ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 2
  const R = scope.fov * sc
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    ctx.beginPath()
    ctx.moveTo(W / 2 + dx * (R - 12), H / 2 + dy * (R - 12))
    ctx.lineTo(W / 2 + dx * (R + 12), H / 2 + dy * (R + 12))
    ctx.stroke()
  }
  ctx.restore()

  // selection ring
  if (state.selectedId) {
    const s = STAR_BY_ID.get(state.selectedId)
    if (s) {
      const p = project(s, v)
      if (p.vis) {
        const R2 = 14 + (reduced ? 0 : Math.sin(now / 300) * 3)
        ctx.strokeStyle = '#FF2D55'; ctx.lineWidth = 4
        ctx.beginPath(); ctx.arc(p.x, p.y, R2, 0, 7); ctx.stroke()
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(p.x, p.y, R2 + 4, 0, 7); ctx.stroke()
      }
    }
  }
}

let last = performance.now()
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  projCache.clear()
  stepAnim(dt)
  drawSky(now, dt)
  syncReadout()
  requestAnimationFrame(loop)
}

/* ---------- view animation ---------- */
let anim: { from: View; to: View; t: number; dur: number } | null = null
function flyTo(to: Partial<View>, dur = 380) {
  anim = { from: { ...state.view }, to: { ...state.view, ...to }, t: 0, dur: reduced ? 1 : dur }
}
function stepAnim(dt: number) {
  if (!anim) return
  anim.t += dt * 1000
  const k = Math.min(1, anim.t / anim.dur)
  const e = 1 - Math.pow(1 - k, 3)
  // shortest-path wrap for cx
  let dcx = anim.to.cx - anim.from.cx
  if (dcx > 0.5) dcx -= 1
  if (dcx < -0.5) dcx += 1
  state.view.cx = (((anim.from.cx + dcx * e) % 1) + 1) % 1
  state.view.cy = anim.from.cy + (anim.to.cy - anim.from.cy) * e
  state.view.zoom = anim.from.zoom + (anim.to.zoom - anim.from.zoom) * e
  if (k >= 1) anim = null
}

/* ---------- selection + panel ---------- */
const starPanel = $('#starPanel')
const live = $('#live')
const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
function select(id: string | null, announce = true) {
  state.selectedId = id
  saveState()
  renderPanel()
  if (id && announce) {
    const s = STAR_BY_ID.get(id)!
    live.textContent = `Selected ${s.name ?? 'star ' + s.id}, magnitude ${s.mag.toFixed(1)}`
  }
}
function renderPanel() {
  const s = state.selectedId ? STAR_BY_ID.get(state.selectedId) : null
  if (!s) {
    starPanel.innerHTML = `
      <div class="flex items-center gap-3 flex-wrap">
        <span class="badge badge-yellow">No star selected</span>
        <p class="text-[13px] font-bold m-0">Click any star on the chart — or search its name — to inspect it.</p>
      </div>`
    return
  }
  const con = s.constId ? CONSTS.find(c => c.id === s.constId) : null
  starPanel.innerHTML = `
    <div class="flex items-start gap-3 flex-wrap justify-between">
      <div>
        <span class="badge badge-red">${con ? esc(con.name) : 'Field star'}</span>
        <h3 class="display mt-2" style="font-size:24px;">${esc(s.name ?? 'Star ' + s.id)}</h3>
        <p class="mono text-[12px] font-bold mt-1" style="color:var(--ink-64);">mag ${s.mag.toFixed(1)} · sky ${s.x.toFixed(3)} / ${s.y.toFixed(3)}</p>
        <p class="text-[14px] font-bold mt-2">${esc(s.lore ?? 'An unnamed ember keeping its own counsel.')}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-yellow" id="btnLogIt">Log it</button>
        <button class="btn" id="btnCenter">Center</button>
      </div>
    </div>`
  $('#btnLogIt').addEventListener('click', () => {
    if (!state.log.some(e => e.starId === s.id)) {
      state.log.push({ starId: s.id, name: s.name ?? 'Star ' + s.id, at: new Date().toISOString() })
      saveState(); renderLog()
      msg('Star logged to the field log.')
    } else msg('Already in the field log.')
  })
  $('#btnCenter').addEventListener('click', () => flyTo({ cx: s.x, cy: s.y }))
}

/* ---------- pointer + keyboard ---------- */
let dragging = false, moved = 0, lx = 0, ly = 0
function starAt(px: number, py: number): Star | null {
  let best: Star | null = null, bestD = Infinity
  for (const s of STARS) {
    const p = projectRaw(s, state.view)
    if (!p.vis) continue
    const d = Math.hypot(p.x - px, p.y - py)
    const tol = s.name ? 16 : 10
    if (d < tol && d < bestD) { best = s; bestD = d }
  }
  return best
}
function evPos(e: PointerEvent | MouseEvent) {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
canvas.addEventListener('pointerdown', e => {
  dragging = true; moved = 0; lx = e.clientX; ly = e.clientY
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointermove', e => {
  if (dragging) {
    const dx = e.clientX - lx, dy = e.clientY - ly
    lx = e.clientX; ly = e.clientY
    moved += Math.abs(dx) + Math.abs(dy)
    anim = null
    const sc = Math.min(W, H) * state.view.zoom
    const c = Math.cos(-state.view.rot), n = Math.sin(-state.view.rot)
    const wx = (dx * c - dy * n) / sc, wy = (dx * n + dy * c) / sc
    state.view.cx = (((state.view.cx - wx) % 1) + 1) % 1
    state.view.cy = Math.min(1, Math.max(0, state.view.cy - wy))
    hideTip()
  } else {
    const { x, y } = evPos(e)
    const s = starAt(x, y)
    if (s?.name) {
      tip.hidden = false
      tip.textContent = `★ ${s.name}`
      tip.style.left = `${x}px`; tip.style.top = `${y}px`
      canvas.style.cursor = 'pointer'
    } else { hideTip(); canvas.style.cursor = 'crosshair' }
  }
})
function hideTip() { tip.hidden = true }
canvas.addEventListener('pointerup', e => {
  dragging = false
  if (moved < 6) {
    const { x, y } = evPos(e)
    const s = starAt(x, y)
    select(s ? s.id : null)
  } else saveState()
})
canvas.addEventListener('pointerleave', () => { dragging = false; hideTip() })
canvas.addEventListener('wheel', e => {
  e.preventDefault()
  anim = null
  state.view.zoom = Math.min(4, Math.max(0.8, state.view.zoom * (e.deltaY > 0 ? 0.92 : 1.09)))
  saveState(); syncControls()
}, { passive: false })
canvas.addEventListener('keydown', e => {
  const step = 0.03 / state.view.zoom
  if (e.key === 'ArrowLeft') { state.view.cx = (((state.view.cx - step) % 1) + 1) % 1; e.preventDefault() }
  else if (e.key === 'ArrowRight') { state.view.cx = (state.view.cx + step) % 1; e.preventDefault() }
  else if (e.key === 'ArrowUp') { state.view.cy = Math.max(0, state.view.cy - step); e.preventDefault() }
  else if (e.key === 'ArrowDown') { state.view.cy = Math.min(1, state.view.cy + step); e.preventDefault() }
  else if (e.key === '+' || e.key === '=') { state.view.zoom = Math.min(4, state.view.zoom * 1.1); e.preventDefault() }
  else if (e.key === '-' || e.key === '_') { state.view.zoom = Math.max(0.8, state.view.zoom / 1.1); e.preventDefault() }
  else if (e.key === 'Enter') {
    let best: Star | null = null, bd = 1e9
    for (const s of STARS) {
      const p = projectRaw(s, state.view)
      if (!p.vis) continue
      const d = Math.hypot(p.x - W / 2, p.y - H / 2)
      if (d < bd) { bd = d; best = s }
    }
    if (best) select(best.id)
    e.preventDefault()
  } else return
  anim = null; saveState(); syncControls()
})

/* ---------- controls ---------- */
const hourEl = $('#hour') as HTMLInputElement
const zoomEl = $('#zoom') as HTMLInputElement
function syncControls() {
  hourEl.value = String(state.hour)
  zoomEl.value = String(state.view.zoom)
  $('#hourVal').textContent = `${state.hour.toFixed(2)}h`
  $('#zoomVal').textContent = `${state.view.zoom.toFixed(2)}×`
  for (const [id, key] of [['tLines', 'showLines'], ['tNames', 'showNames'], ['tWrens', 'showWrens'], ['tMeteors', 'showMeteors']] as const) {
    $('#' + id).setAttribute('aria-checked', String(state[key]))
  }
  const sc = SCOPES.find(s => s.id === state.scopeId)!
  $('#scopeBadge').textContent = `Scope-${sc.no} · ${sc.nickname.replace(/“|”/g, '')}`
  document.querySelectorAll('.scope-card').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-scope') === state.scopeId)
  })
}
function syncReadout() {
  $('#viewReadout').textContent =
    `sky ${state.view.cx.toFixed(2)} / ${state.view.cy.toFixed(2)} · ${state.view.zoom.toFixed(2)}× · rot ${(state.view.rot * 180 / Math.PI).toFixed(0)}°`
}
hourEl.addEventListener('input', () => {
  state.hour = Number(hourEl.value)
  state.view.rot = (state.hour / 24) * Math.PI * 2
  saveState(); syncControls()
})
zoomEl.addEventListener('input', () => {
  anim = null
  state.view.zoom = Number(zoomEl.value)
  saveState(); syncControls()
})
for (const [id, key] of [['tLines', 'showLines'], ['tNames', 'showNames'], ['tWrens', 'showWrens'], ['tMeteors', 'showMeteors']] as const) {
  const el = $('#' + id)
  const flip = () => {
    (state as Record<string, unknown>)[key] = !state[key]
    saveState(); syncControls()
  }
  el.addEventListener('click', flip)
  el.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip() } })
}

/* ---------- search ---------- */
const searchEl = $('#search') as HTMLInputElement
const resultsEl = $('#results')
const NAMED = STARS.filter(s => s.name)
searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim().toLowerCase()
  if (q.length < 2) { resultsEl.innerHTML = ''; return }
  const hits = NAMED.filter(s => s.name!.toLowerCase().includes(q)).slice(0, 8)
  resultsEl.innerHTML = hits.length
    ? hits.map(s => `<button class="search-result mono text-left text-[12px] font-bold px-3 py-2" data-id="${s.id}" style="border:2px solid var(--ink);border-radius:4px;margin-top:6px;background:#fff;cursor:pointer;">★ ${s.name} <span style="color:var(--ink-64);">mag ${s.mag.toFixed(1)}</span></button>`).join('')
    : `<p class="mono text-[12px] font-bold mt-2" style="color:var(--ink-64);">No wrens by that name. Try “pip”.</p>`
  resultsEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const s = STAR_BY_ID.get(b.getAttribute('data-id')!)!
    flyTo({ cx: s.x, cy: s.y, zoom: Math.max(state.view.zoom, 1.8) })
    select(s.id)
    resultsEl.innerHTML = ''
    searchEl.value = s.name!
  }))
})

/* ---------- scopes ---------- */
const scopeGrid = $('#scopeGrid')
scopeGrid.innerHTML = SCOPES.map((s, i) => `
  <article class="panel scope-card stagger-${i + 1} p-5" data-scope="${s.id}" aria-label="${s.name}, ${s.nickname}, on ${s.dune}">
    <div class="flex items-center justify-between">
      <span class="badge ${i === 0 ? 'badge-red' : i === 1 ? 'badge-blue' : 'badge-yellow'}">Scope-${s.no}</span>
      <span class="mono text-[11px] font-bold" style="color:var(--ink-64);">${s.dune}</span>
    </div>
    <h3 class="display mt-3" style="font-size:26px;">${s.name}<br/><span style="font-size:16px;">${s.nickname}</span></h3>
    <p class="text-[13px] font-bold mt-2">${s.desc}</p>
    <p class="mono text-[11px] font-bold mt-3" style="color:var(--ink-64);">target ${s.cx.toFixed(2)} / ${s.cy.toFixed(2)} · ${s.zoom.toFixed(2)}× · FOV ⌀ ${(s.fov * 100).toFixed(0)}</p>
    <button class="btn ${i === 0 ? 'btn-red' : i === 1 ? 'btn-blue' : 'btn-yellow'} mt-4 w-full">Slew here</button>
  </article>`).join('')
function slew(id: string) {
  const s = SCOPES.find(x => x.id === id)!
  state.scopeId = id
  flyTo({ cx: s.cx, cy: s.cy, zoom: s.zoom }, 420)
  wipe.classList.remove('go')
  void wipe.offsetWidth
  if (!reduced) wipe.classList.add('go')
  live.textContent = `Slewed to ${s.name} ${s.nickname} on ${s.dune}`
  saveState(); syncControls()
}
scopeGrid.querySelectorAll('.scope-card').forEach(card => {
  const id = card.getAttribute('data-scope')!
  card.addEventListener('click', () => slew(id))
})

/* ---------- constellations ---------- */
$('#constGrid').innerHTML = CONSTS.map((c, i) => `
  <article class="panel p-5 ${i % 3 === 1 ? 'panel-blue benday-light' : i % 3 === 2 ? 'panel-yellow' : ''}">
    <span class="badge ${i % 3 === 1 ? 'badge-white' : 'badge-red'}">${c.stars.length} stars</span>
    <h3 class="display mt-2 ${i % 3 === 1 ? 'text-white' : ''}" style="font-size:22px;">${c.name}</h3>
    <p class="text-[13px] font-bold mt-1 ${i % 3 === 1 ? 'text-white' : ''}">${c.lore}</p>
    <div class="flex gap-2 mt-3 flex-wrap">
      ${c.stars.slice(0, 3).map(id => `<button class="btn" style="font-size:11px;padding:6px 12px;" data-goto="${id}">Visit ★</button>`).join('')}
    </div>
  </article>`).join('')
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
  const s = STAR_BY_ID.get(b.getAttribute('data-goto')!)!
  flyTo({ cx: s.x, cy: s.y, zoom: Math.max(state.view.zoom, 2) })
  select(s.id)
  document.querySelector('#frame')!.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
}))

/* ---------- field log + notes ---------- */
const logList = $('#logList')
const notesEl = $('#notes') as HTMLTextAreaElement
function renderLog() {
  logList.innerHTML = state.log.length
    ? state.log.map((e, i) => `
      <div class="log-row flex items-center justify-between gap-2 py-1.5">
        <span class="mono text-[12px] font-bold">★ ${esc(e.name)}</span>
        <button class="btn" style="font-size:10px;padding:4px 10px;" data-unlog="${i}" aria-label="Remove ${esc(e.name)} from log">×</button>
      </div>`).join('')
    : `<p class="mono text-[12px] font-bold p-2" style="color:var(--ink-64);">Empty — log stars with “Log it”.</p>`
  logList.querySelectorAll('[data-unlog]').forEach(b => b.addEventListener('click', () => {
    state.log.splice(Number(b.getAttribute('data-unlog')), 1)
    saveState(); renderLog()
  }))
}
notesEl.addEventListener('input', () => { state.notes = notesEl.value; saveState() })

/* ---------- export ---------- */
const exportMsg = $('#exportMsg')
function msg(t: string) { exportMsg.textContent = t }
function stamp(): string {
  const d = new Date()
  return d.toISOString().slice(0, 16).replace('T', ' ')
}
function download(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
$('#btnPng').addEventListener('click', () => {
  const sc = SCOPES.find(s => s.id === state.scopeId)!
  const cap = 96
  const out = document.createElement('canvas')
  out.width = canvas.width; out.height = canvas.height + Math.round(cap * DPR)
  const o = out.getContext('2d')!
  o.fillStyle = '#0D0D0D'
  o.fillRect(0, 0, out.width, out.height)
  o.fillStyle = '#FFC700'
  o.font = `900 ${Math.round(34 * DPR)}px "Arial Black", Arial, sans-serif`
  o.fillText('DUNE WREN OBSERVATORY', 24 * DPR, 46 * DPR)
  o.fillStyle = '#FFFFFF'
  o.font = `${Math.round(20 * DPR)}px ui-monospace, Menlo, monospace`
  o.fillText(`Scope-${sc.no} ${sc.nickname} · ${stamp()} UTC · ${state.log.length} logged`, 24 * DPR, 76 * DPR)
  o.drawImage(canvas, 0, Math.round(cap * DPR))
  out.toBlob(b => {
    if (!b) { msg('PNG failed — try again.'); return }
    download(b, `dune-wren-night-${Date.now()}.png`)
    msg(`PNG poster exported (${out.width}×${out.height}px).`)
    popConfetti()
  }, 'image/png')
})
function logMarkdown(n: { view: View; scopeId: string; hour: number; notes: string; log: Night['log']; at: string; name: string }): string {
  const sc = SCOPES.find(s => s.id === n.scopeId)!
  const lines = [
    `# ${n.name} — Dune Wren Observatory`,
    ``,
    `- Date (UTC): ${n.at}`,
    `- Scope: Scope-${sc.no} ${sc.name} ${sc.nickname} (${sc.dune})`,
    `- Night hour: ${n.hour.toFixed(2)}h · chart ${n.view.cx.toFixed(3)} / ${n.view.cy.toFixed(3)} · ${n.view.zoom.toFixed(2)}x`,
    ``,
    `## Logged stars (${n.log.length})`,
    ...(n.log.length
      ? n.log.map(e => {
        const s = STAR_BY_ID.get(e.starId)
        return `- ★ ${e.name} — mag ${s ? s.mag.toFixed(1) : '?'}${s?.lore ? ` — ${s.lore}` : ''}`
      })
      : ['(none — the wrens kept their secrets)']),
    ``,
    `## Notes`,
    ``,
    n.notes.trim() || '(no notes)',
    ``,
    `*Charted by wrens from dune scopes.*`,
  ]
  return lines.join('\n')
}
$('#btnLog').addEventListener('click', () => {
  const md = logMarkdown({
    name: `Night ${stamp()}`, at: `${stamp()} UTC`, view: state.view,
    scopeId: state.scopeId, hour: state.hour, notes: state.notes, log: state.log,
  })
  download(new Blob([md], { type: 'text/markdown' }), `dune-wren-log-${Date.now()}.md`)
  msg(`Observing log downloaded (${state.log.length} stars, notes included).`)
})
$('#btnLink').addEventListener('click', async () => {
  const payload = btoa(JSON.stringify({
    cx: +state.view.cx.toFixed(4), cy: +state.view.cy.toFixed(4),
    zoom: +state.view.zoom.toFixed(3), rot: +state.view.rot.toFixed(3),
    scopeId: state.scopeId, selectedId: state.selectedId,
  }))
  const url = `${location.origin}${location.pathname}#n=${payload}`
  try {
    await navigator.clipboard.writeText(url)
    msg('Night link copied — opening it restores this exact sky.')
  } catch {
    prompt('Copy this night link:', url)
  }
})
$('#btnSave').addEventListener('click', () => {
  const nights = loadNights()
  const n: Night = {
    id: `n${Date.now()}`, name: `Night ${nights.length + 1} — Scope-${SCOPES.find(s => s.id === state.scopeId)!.no}`,
    at: `${stamp()} UTC`, view: { ...state.view }, scopeId: state.scopeId,
    hour: state.hour, notes: state.notes, log: [...state.log],
  }
  nights.unshift(n)
  persistNights(nights.slice(0, 24))
  renderNights()
  msg(`${n.name} saved in this browser.`)
})
function renderNights() {
  const nights = loadNights()
  const box = $('#nights')
  box.innerHTML = nights.length
    ? nights.map(n => `
      <div class="panel p-4 bg-white">
        <span class="badge badge-blue">${esc(n.name)}</span>
        <p class="mono text-[11px] font-bold mt-2" style="color:var(--ink-64);">${esc(n.at)} · ${n.log.length} stars</p>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-yellow" style="font-size:11px;" data-load="${n.id}">Load</button>
          <button class="btn" style="font-size:11px;" data-del="${n.id}">Delete</button>
        </div>
      </div>`).join('')
    : `<p class="font-bold">No saved nights yet — tonight could be the first.</p>`
  box.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
    const n = loadNights().find(x => x.id === b.getAttribute('data-load'))
    if (!n) return
    state.view = { ...n.view }; state.scopeId = n.scopeId; state.hour = n.hour
    state.notes = typeof n.notes === 'string' ? n.notes.slice(0, 4000) : ''
    state.log = n.log.filter(e => e && typeof e.starId === 'string' && typeof e.name === 'string')
    state.view.rot = (state.hour / 24) * Math.PI * 2
    select(null, false)
    notesEl.value = state.notes
    saveState(); syncControls(); renderLog(); renderPanel()
    flyTo({})
    msg(`${n.name} restored.`)
    document.querySelector('#frame')!.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }))
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    persistNights(loadNights().filter(x => x.id !== b.getAttribute('data-del')))
    renderNights()
  }))
}
function popConfetti() {
  if (reduced) return
  const colors = ['#FF2D55', '#FFC700', '#2B44FF', '#FFFFFF']
  for (let i = 0; i < 26; i++) {
    const d = document.createElement('div')
    d.className = 'confetti-dot'
    const s = 6 + Math.random() * 8
    d.style.cssText = `left:${40 + Math.random() * 20}%;top:70%;width:${s}px;height:${s}px;background:${colors[i % 4]};border-radius:${i % 2 ? '50%' : '2px'};`
    document.body.appendChild(d)
    const dx = (Math.random() - 0.5) * 400, dy = -120 - Math.random() * 260
    d.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 540}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => d.remove()
  }
}

/* ---------- header clock + ticker ---------- */
setInterval(() => {
$('#clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC'
$('#starcount').textContent = `${STARS.length} stars catalogued · 5 wren constellations`
}, 1000)
$('#clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC'
{
  const items = [
    ...SCOPES.map(s => `SCOPE-${s.no} ${s.nickname} · ${s.dune} · ONLINE`),
    'THE WRENS ARE CHARTING', '5 CONSTELLATIONS IN THE CANON', `${STARS.length} STARS TONIGHT`, 'EXPORT THE NIGHT BELOW',
  ]
  const half = items.map(t => `${t}<span class="dot">●</span>`).join('')
  $('#ticker').innerHTML = half + half
}

/* ---------- init ---------- */
const fromHash = hashToView()
if (!fromHash) loadState()
state.view.rot = (state.hour / 24) * Math.PI * 2
notesEl.value = state.notes
syncControls(); syncReadout(); renderPanel(); renderLog(); renderNights()
if (state.selectedId && !STAR_BY_ID.has(state.selectedId)) select(null, false)
requestAnimationFrame(loop)
