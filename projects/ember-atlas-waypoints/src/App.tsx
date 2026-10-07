import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { blip, chime, pluck, setMuted, sizzle } from './audio.ts'
import {
  ROUTE_COLORS,
  autoName,
  coverage,
  drifted,
  easeOutCubic,
  routeLength,
  uid,
  type Route,
  type Waypoint,
} from './geo.ts'

const STORE_KEY = 'ember-atlas-waypoints:v1'
const TERR_R = 9 // territory blob radius in map units

interface ShareState {
  w: Waypoint[]
  r: Route[]
}

function encodeShare(w: Waypoint[], r: Route[]): string {
  const slim: ShareState = {
    w: w.map((p) => ({ ...p, seed: Math.round(p.seed * 100) / 100 })),
    r,
  }
  const json = JSON.stringify(slim)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function sanitizeWaypoints(list: unknown): Waypoint[] | null {
  if (!Array.isArray(list)) return null
  const out: Waypoint[] = []
  for (const v of list) {
    if (typeof v !== 'object' || v === null) return null
    const o = v as Record<string, unknown>
    if (
      typeof o.id !== 'string' || typeof o.name !== 'string' ||
      typeof o.x !== 'number' || typeof o.y !== 'number' ||
      !Number.isFinite(o.x) || !Number.isFinite(o.y)
    ) return null
    out.push({
      id: o.id.slice(0, 40),
      name: String(o.name).slice(0, 40),
      x: Math.min(100, Math.max(0, o.x)),
      y: Math.min(100, Math.max(0, o.y)),
      note: typeof o.note === 'string' ? o.note.slice(0, 120) : '',
      pinned: o.pinned === true,
      seed: typeof o.seed === 'number' && Number.isFinite(o.seed) ? o.seed : Math.random() * 10,
    })
  }
  return out
}

function sanitizeRoutes(list: unknown, colorFallback: string): Route[] | null {
  if (!Array.isArray(list)) return null
  const out: Route[] = []
  for (const v of list) {
    if (typeof v !== 'object' || v === null) return null
    const o = v as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || !Array.isArray(o.stopIds)) return null
    const color = typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : colorFallback
    out.push({
      id: o.id.slice(0, 40),
      name: String(o.name).slice(0, 40),
      stopIds: (o.stopIds as unknown[]).filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 40)),
      color,
    })
  }
  return out
}

function decodeShare(hash: string): ShareState | null {
  try {
    let s = hash.replace(/^#a=/, '').replaceAll('-', '+').replaceAll('_', '/')
    while (s.length % 4) s += '='
    const bin = atob(s)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const v = JSON.parse(json) as { w: unknown; r: unknown }
    const w = sanitizeWaypoints(v.w)
    const r = sanitizeRoutes(v.r, ROUTE_COLORS[0] ?? '#ff2e88')
    if (!w || !r || !w.length) return null
    const ids = new Set(w.map((p) => p.id))
    for (const route of r) route.stopIds = route.stopIds.filter((id) => ids.has(id))
    return { w, r }
  } catch {
    return null
  }
}

function seedDemo(): { w: Waypoint[]; r: Route[] } {
  const w: Waypoint[] = [
    { id: uid('wp'), name: 'Ember Crossing', x: 30, y: 62, note: 'Where the night market glows.', pinned: true, seed: 1.3 },
    { id: uid('wp'), name: 'Lantern Harbor', x: 55, y: 38, note: 'Ferries hum past midnight.', pinned: false, seed: 2.7 },
    { id: uid('wp'), name: 'Paper Garden', x: 72, y: 66, note: 'Origami stalls in the rain.', pinned: false, seed: 4.1 },
  ]
  const r: Route[] = [
    { id: uid('rt'), name: 'First Circuit', stopIds: w.map((p) => p.id), color: ROUTE_COLORS[0] ?? '#ff2e88' },
  ]
  return { w, r }
}

type Mode = 'view' | 'drop' | 'link'

export default function App(): React.JSX.Element {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [mode, setMode] = useState<Mode>('view')
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [driftOn, setDriftOn] = useState(true)
  const [muted, setMutedState] = useState(false)
  const [ticker, setTicker] = useState('atlas online — click DROP, then pin the map')
  const [panelOpen, setPanelOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 820))
  const [coverPct, setCoverPct] = useState(0)
  const [ready, setReady] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({ waypoints, routes, mode, activeRouteId, selectedId, driftOn })
  stateRef.current = { waypoints, routes, mode, activeRouteId, selectedId, driftOn }
  const growthRef = useRef(0)
  const growthTarget = useRef(1)
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([])
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const tickRef = useRef(ticker)
  tickRef.current = ticker
  const setTick = useCallback((s: string) => setTicker(s), [])

  // ---- load: share hash > localStorage > demo ----
  useEffect(() => {
    let w: Waypoint[] = []
    let r: Route[] = []
    const h = window.location.hash
    if (h.startsWith('#a=')) {
      const s = decodeShare(h)
      if (s && s.w.length) {
        w = s.w
        r = s.r
        setTick(`shared atlas received — ${w.length} waypoints`)
      }
    }
    if (!w.length) {
      try {
        const raw = localStorage.getItem(STORE_KEY)
        if (raw) {
          const v = JSON.parse(raw) as { w: unknown; r: unknown }
          const sw = sanitizeWaypoints(v.w)
          const sr = sanitizeRoutes(v.r, ROUTE_COLORS[0] ?? '#ff2e88')
          if (sw && sw.length && sr) {
            w = sw
            r = sr
          }
        }
      } catch {
        /* ignore */
      }
    } else {
      // a shared link takes precedence but the previous atlas is backed up, not lost
      try {
        const raw = localStorage.getItem(STORE_KEY)
        if (raw) localStorage.setItem(`${STORE_KEY}:backup`, raw)
      } catch {
        /* ignore */
      }
    }
    if (!w.length) {
      const d = seedDemo()
      w = d.w
      r = d.r
    }
    setWaypoints(w)
    setRoutes(r)
    setActiveRouteId(r[0]?.id ?? null)
    growthRef.current = 0
    growthTarget.current = 1
    setReady(true)
  }, [setTick])

  // ---- persist (throttled so drags don't hammer localStorage) ----
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ w: waypoints, r: routes }))
      } catch {
        /* ignore */
      }
      setCoverPct(coverage(waypoints, TERR_R))
    }, 250)
    return () => window.clearTimeout(id)
  }, [waypoints, routes, ready])

  useEffect(() => {
    if (!ready) return
    growthTarget.current = 1
    if (growthRef.current < 0.85) growthRef.current = 0 // replay bloom on change
  }, [waypoints, routes, ready])

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === activeRouteId) ?? null,
    [routes, activeRouteId],
  )

  const byId = useMemo(() => new Map(waypoints.map((w) => [w.id, w])), [waypoints])

  // ---- canvas render loop ----
  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let t = 0
    let dash = 0

    const frame = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      dash = (dash + dt * 26) % 40
      // growth animation
      const g = growthRef.current
      const gt = growthTarget.current
      if (g < gt) growthRef.current = Math.min(gt, g + dt / 1.2)
      const growth = easeOutCubic(growthRef.current)

      const st = stateRef.current
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      const W = Math.max(1, Math.floor(rect.width * dpr))
      const H = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
      }
      const X = (x: number): number => (x / 100) * W
      const Y = (y: number): number => (y / 100) * H
      const R = (v: number): number => (v / 100) * Math.min(W, H)

      // base
      ctx.fillStyle = '#0b0a08'
      ctx.fillRect(0, 0, W, H)

      // grid
      ctx.strokeStyle = 'rgba(0,232,219,0.10)'
      ctx.lineWidth = 1
      const step = W / 24
      ctx.beginPath()
      for (let x = step; x < W; x += step) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
      }
      const stepY = H / 14
      for (let y = stepY; y < H; y += stepY) {
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
      }
      ctx.stroke()

      const pos = new Map<string, { x: number; y: number }>()
      for (const w of st.waypoints) pos.set(w.id, drifted(w, t, st.driftOn))

      // territory blobs (kuchiba -> ember)
      for (const w of st.waypoints) {
        const p = pos.get(w.id)
        if (!p) continue
        const rad = R(TERR_R) * growth + R(1.2) * Math.sin(t * 2 + w.seed * 3)
        const grad = ctx.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), Math.max(1, rad))
        grad.addColorStop(0, 'rgba(255,92,31,0.34)')
        grad.addColorStop(0.55, 'rgba(140,43,10,0.30)')
        grad.addColorStop(1, 'rgba(140,43,10,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(X(p.x), Y(p.y), Math.max(1, rad), 0, Math.PI * 2)
        ctx.fill()
      }

      // route corridors (soft under-glow)
      for (const r of st.routes) {
        if (r.stopIds.length < 2) continue
        ctx.strokeStyle = 'rgba(140,43,10,0.55)'
        ctx.lineWidth = Math.max(2, R(3.2) * growth)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        r.stopIds.forEach((id, i) => {
          const p = pos.get(id)
          if (!p) return
          if (i === 0) ctx.moveTo(X(p.x), Y(p.y))
          else {
            const prev = pos.get(r.stopIds[i - 1] ?? '')
            if (prev) {
              const mx = (prev.x + p.x) / 2
              const my = (prev.y + p.y) / 2 - 2.5
              ctx.quadraticCurveTo(X(mx), Y(my), X(p.x), Y(p.y))
            } else ctx.lineTo(X(p.x), Y(p.y))
          }
        })
        ctx.stroke()
      }

      // routes (marching energy)
      for (const r of st.routes) {
        if (r.stopIds.length < 2) continue
        const isActive = r.id === st.activeRouteId
        ctx.strokeStyle = r.color
        ctx.globalAlpha = isActive ? 1 : 0.75
        ctx.lineWidth = (isActive ? 2.6 : 1.8) * dpr
        ctx.setLineDash([10 * dpr, 7 * dpr])
        ctx.lineDashOffset = -dash
        ctx.shadowColor = r.color
        ctx.shadowBlur = 12 * dpr
        ctx.beginPath()
        r.stopIds.forEach((id, i) => {
          const p = pos.get(id)
          if (!p) return
          if (i === 0) ctx.moveTo(X(p.x), Y(p.y))
          else {
            const prev = pos.get(r.stopIds[i - 1] ?? '')
            if (prev) {
              const mx = (prev.x + p.x) / 2
              const my = (prev.y + p.y) / 2 - 2.5
              ctx.quadraticCurveTo(X(mx), Y(my), X(p.x), Y(p.y))
            } else ctx.lineTo(X(p.x), Y(p.y))
          }
        })
        ctx.stroke()
        ctx.setLineDash([])
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      // waypoint pins (rotated diamonds + halo)
      for (const w of st.waypoints) {
        const p = pos.get(w.id)
        if (!p) continue
        const cx = X(p.x)
        const cy = Y(p.y)
        const s = (st.selectedId === w.id ? 11 : 8.5) * dpr
        const pulse = 1 + 0.18 * Math.sin(t * 3 + w.seed * 5)
        // halo
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 2.4 * pulse)
        halo.addColorStop(0, 'rgba(255,92,31,0.5)')
        halo.addColorStop(1, 'rgba(255,92,31,0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(cx, cy, s * 2.4 * pulse, 0, Math.PI * 2)
        ctx.fill()
        // diamond
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = '#ff5c1f'
        ctx.shadowColor = '#ff5c1f'
        ctx.shadowBlur = 14 * dpr
        const k = s * (0.9 + 0.35 * growth)
        ctx.fillRect(-k / 1.4, -k / 1.4, (k * 2) / 1.4, (k * 2) / 1.4)
        ctx.shadowBlur = 0
        ctx.fillStyle = '#0b0a08'
        ctx.fillRect(-k / 3.4, -k / 3.4, (k * 2) / 3.4, (k * 2) / 3.4)
        ctx.restore()
        if (st.selectedId === w.id) {
          ctx.strokeStyle = '#ff2e88'
          ctx.lineWidth = 2 * dpr
          ctx.beginPath()
          ctx.arc(cx, cy, s * 1.9, 0, Math.PI * 2)
          ctx.stroke()
        }
        if (w.pinned) {
          ctx.fillStyle = '#00e8db'
          ctx.fillRect(cx - 1.5 * dpr, cy - s * 2.1, 3 * dpr, 3 * dpr)
        }
        // label chip for selected / hovered-in-link-mode
        if (st.selectedId === w.id || st.mode === 'link') {
          ctx.font = `${11 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`
          const label = `${w.name}`
          const tw = ctx.measureText(label).width
          const bx = Math.min(Math.max(cx + 12 * dpr, 4), W - tw - 20 * dpr)
          ctx.fillStyle = 'rgba(11,10,8,0.88)'
          ctx.fillRect(bx, cy - 24 * dpr, tw + 12 * dpr, 18 * dpr)
          ctx.strokeStyle = '#00e8db'
          ctx.lineWidth = 1
          ctx.strokeRect(bx, cy - 24 * dpr, tw + 12 * dpr, 18 * dpr)
          ctx.fillStyle = '#efe3c2'
          ctx.fillText(label, bx + 6 * dpr, cy - 11 * dpr)
        }
      }

      // particles
      const ps = particles.current
      for (let i = ps.length - 1; i >= 0; i--) {
        const pt = ps[i]
        if (!pt) continue
        pt.x += pt.vx * dt * 100
        pt.y += pt.vy * dt * 100
        pt.life -= dt
        if (pt.life <= 0) {
          ps.splice(i, 1)
          continue
        }
        ctx.globalAlpha = Math.min(1, pt.life * 1.6)
        ctx.fillStyle = pt.color
        ctx.fillRect(X(pt.x) - dpr, Y(pt.y) - dpr, 2 * dpr, 2 * dpr)
        ctx.globalAlpha = 1
      }

      // scanlines + vignette
      ctx.fillStyle = 'rgba(0,0,0,0.10)'
      for (let y = 0; y < H; y += 4 * dpr) ctx.fillRect(0, y, W, 1)
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, W, H)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  const toMap = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 50, y: 50 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(99, Math.max(1, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(99, Math.max(1, ((clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  const hitWaypoint = useCallback(
    (x: number, y: number): Waypoint | null => {
      let best: Waypoint | null = null
      let bd = 4.5
      for (const w of stateRef.current.waypoints) {
        const d = Math.hypot(w.x - x, w.y - y)
        if (d < bd) {
          bd = d
          best = w
        }
      }
      return best
    },
    [],
  )

  const burst = useCallback((x: number, y: number, color: string, n = 26): void => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 7
      particles.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.7,
        color,
      })
    }
  }, [])

  // ---- actions ----
  const dropWaypoint = useCallback(
    (x: number, y: number): void => {
      const w: Waypoint = {
        id: uid('wp'),
        name: autoName(waypoints.length),
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        note: '',
        pinned: false,
        seed: Math.random() * 10,
      }
      setWaypoints((prev) => [...prev, w])
      setSelectedId(w.id)
      pluck(waypoints.length % 10)
      burst(x, y, '#ff5c1f')
      setTick(`waypoint pinned @ ${x.toFixed(1)}, ${y.toFixed(1)}`)
    },
    [burst, setTick, waypoints.length],
  )

  const linkWaypoint = useCallback(
    (wp: Waypoint): void => {
      const st = stateRef.current
      const existing = st.routes.find((r) => r.id === st.activeRouteId) ?? null
      if (existing) {
        if (existing.stopIds.includes(wp.id)) return
        const count = existing.stopIds.length
        const id = existing.id
        const color = existing.color
        const name = existing.name
        setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, stopIds: [...r.stopIds, wp.id] } : r)))
        blip(520 + count * 90, 0.1, 0.3)
        burst(wp.x, wp.y, color, 14)
        setTick(`${wp.name} → ${name} (${count + 1} stops)`)
        return
      }
      // no active route (fresh burn / deleted): create one WITH this stop so the click counts
      const r: Route = {
        id: uid('rt'),
        name: `Route ${st.routes.length + 1}`,
        stopIds: [wp.id],
        color: ROUTE_COLORS[st.routes.length % ROUTE_COLORS.length] ?? '#ff2e88',
      }
      setRoutes((prev) => [...prev, r])
      setActiveRouteId(r.id)
      blip(610, 0.1, 0.3)
      burst(wp.x, wp.y, r.color, 14)
      setTick(`${wp.name} → ${r.name} (1 stop)`)
    },
    [burst, setTick],
  )

  const onCanvasDown = useCallback(
    (e: React.MouseEvent): void => {
      const p = toMap(e.clientX, e.clientY)
      const hit = hitWaypoint(p.x, p.y)
      const st = stateRef.current
      if (st.mode === 'drop') {
        dropWaypoint(p.x, p.y)
        return
      }
      if (st.mode === 'link') {
        if (hit) linkWaypoint(hit)
        else setTick('link mode — click a waypoint diamond')
        return
      }
      if (hit) {
        dragRef.current = { id: hit.id, moved: false }
        setSelectedId(hit.id)
      } else {
        setSelectedId(null)
      }
    },
    [toMap, hitWaypoint, dropWaypoint, linkWaypoint, setTick],
  )

  const onCanvasMove = useCallback(
    (e: React.MouseEvent): void => {
      const p = toMap(e.clientX, e.clientY)
      if (cursorRef.current) {
        cursorRef.current.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)} ／ ${stateRef.current.driftOn ? 'DRIFT≈ON' : 'DRIFT≈OFF'}`
      }
      const drag = dragRef.current
      if (drag && stateRef.current.mode === 'view') {
        drag.moved = true
        const id = drag.id
        setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, x: p.x, y: p.y } : w)))
      }
    },
    [toMap],
  )

  const onCanvasUp = useCallback((): void => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag?.moved) blip(440, 0.07, 0.2)
  }, [])

  const bloom = useCallback((): void => {
    growthRef.current = 0
    growthTarget.current = 1
    sizzle()
    for (const w of stateRef.current.waypoints.slice(0, 12)) burst(w.x, w.y, '#ff2e88', 10)
    setTick('territory blooming — frontier expanding')
  }, [burst, setTick])

  const newRoute = useCallback((): void => {
    const r: Route = {
      id: uid('rt'),
      name: `Route ${routes.length + 1}`,
      stopIds: [],
      color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length] ?? '#ff2e88',
    }
    setRoutes((prev) => [...prev, r])
    setActiveRouteId(r.id)
    setMode('link')
    blip(600, 0.1, 0.3)
    setTick(`${r.name} ready — click waypoints to link`)
  }, [routes.length, setTick])

  const autoRoute = useCallback((): void => {
    if (waypoints.length < 2) {
      setTick('need 2+ waypoints for auto-route')
      return
    }
    const ids = [...waypoints]
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((w) => w.id)
    const r: Route = {
      id: uid('rt'),
      name: `Drift Line ${routes.length + 1}`,
      stopIds: ids,
      color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length] ?? '#00e8db',
    }
    setRoutes((prev) => [...prev, r])
    setActiveRouteId(r.id)
    bloom()
    setTick(`${r.name} traced through ${ids.length} waypoints`)
  }, [waypoints, routes.length, bloom, setTick])

  const exportPNG = useCallback((): void => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 400
    const ctx = c.getContext('2d')
    if (!ctx) return
    const X = (x: number): number => (x / 100) * 640
    const Y = (y: number): number => (y / 100) * 400
    ctx.fillStyle = '#0b0a08'
    ctx.fillRect(0, 0, 640, 400)
    ctx.strokeStyle = 'rgba(0,232,219,0.20)'
    ctx.lineWidth = 1
    for (let x = 0; x <= 640; x += 26) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 400)
      ctx.stroke()
    }
    for (let y = 0; y <= 400; y += 28) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(640, y)
      ctx.stroke()
    }
    for (const w of waypoints) {
      const g = ctx.createRadialGradient(X(w.x), Y(w.y), 0, X(w.x), Y(w.y), 58)
      g.addColorStop(0, 'rgba(255,92,31,0.5)')
      g.addColorStop(1, 'rgba(140,43,10,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(X(w.x), Y(w.y), 58, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const r of routes) {
      if (r.stopIds.length < 2) continue
      ctx.strokeStyle = r.color
      ctx.lineWidth = 3
      ctx.shadowColor = r.color
      ctx.shadowBlur = 8
      ctx.beginPath()
      r.stopIds.forEach((id, i) => {
        const w = byId.get(id)
        if (!w) return
        if (i === 0) ctx.moveTo(X(w.x), Y(w.y))
        else ctx.lineTo(X(w.x), Y(w.y))
      })
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    for (const w of waypoints) {
      ctx.save()
      ctx.translate(X(w.x), Y(w.y))
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = '#ff5c1f'
      ctx.fillRect(-7, -7, 14, 14)
      ctx.fillStyle = '#0b0a08'
      ctx.fillRect(-3, -3, 6, 6)
      ctx.restore()
    }
    // stamp + border ticks
    ctx.fillStyle = '#efe3c2'
    ctx.font = '700 22px ui-monospace, Menlo, monospace'
    ctx.fillText('EMBER ATLAS', 18, 34)
    ctx.save()
    ctx.translate(616, 60)
    ctx.rotate(Math.PI / 2)
    ctx.font = '700 20px ui-monospace, Menlo, monospace'
    ctx.fillStyle = '#ff5c1f'
    ctx.fillText('エンバー・アトラス', 0, 0)
    ctx.restore()
    ctx.strokeStyle = '#ff5c1f'
    ctx.lineWidth = 3
    ctx.strokeRect(6, 6, 628, 388)
    ctx.fillStyle = '#00e8db'
    ctx.font = '11px ui-monospace, Menlo, monospace'
    ctx.fillText(`${waypoints.length} WP · ${routes.length} RT · ${coverPct}% CLAIMED`, 18, 382)
    c.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ember-atlas-minimap.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    }, 'image/png')
    chime()
    setTick('mini-map exported — 640×400 PNG')
  }, [waypoints, routes, byId, coverPct, setTick])

  const copyShare = useCallback(async (): Promise<void> => {
    const code = encodeShare(waypoints, routes)
    const url = `${window.location.origin}${window.location.pathname}#a=${code}`
    try {
      await navigator.clipboard.writeText(url)
      setTick('share link copied — atlas rides in the URL')
    } catch {
      window.location.hash = `a=${code}`
      setTick('clipboard blocked — URL hash updated instead')
    }
    chime()
  }, [waypoints, routes, setTick])

  const selected = useMemo(() => waypoints.find((w) => w.id === selectedId) ?? null, [waypoints, selectedId])
  const totalKm = useMemo(() => {
    let d = 0
    for (const r of routes) {
      const stops = r.stopIds.map((id) => byId.get(id)).filter((w): w is Waypoint => Boolean(w))
      d += routeLength(stops)
    }
    return d
  }, [routes, byId])

  // keyboard shortcuts (ignored when typing or with Cmd/Ctrl held)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') {
        setMode('view')
        setSelectedId(null)
      } else if (e.key === 'd' || e.key === 'D') setMode((m) => (m === 'drop' ? 'view' : 'drop'))
      else if (e.key === 'l' || e.key === 'L') setMode((m) => (m === 'link' ? 'view' : 'link'))
      else if (e.key === 'v' || e.key === 'V') setMode('view')
      else if (e.key === 'b' || e.key === 'B') bloom()
      else if (e.key === 'm' || e.key === 'M') toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloom])

  const toggleMute = useCallback((): void => {
    const next = !muted
    setMutedState(next)
    setMuted(next)
    if (!next) blip(520, 0.08, 0.2)
  }, [muted])

  const clearAll = useCallback((): void => {
    if (!window.confirm('Burn the whole atlas? Waypoints and routes will be lost.')) return
    setWaypoints([])
    setRoutes([])
    setActiveRouteId(null)
    setSelectedId(null)
    blip(180, 0.2, 0.3)
    setTick('atlas burned clean — fresh sumi awaits')
  }, [setTick])

  if (!ready) {
    return (
      <div className="boot-screen">
        <div className="boot-box">エンバー・アトラス 起動中…</div>
      </div>
    )
  }

  return (
    <div className="atlas-root">
      {/* vertical katakana strip */}
      <div className="kata-strip" aria-hidden="true">
        エンバー・アトラス
        <span className="kata-sub">WAYPOINT CARTOGRAPHY UNIT — 07</span>
      </div>

      {/* header */}
      <header className="atlas-header">
        <div>
          <h1 className="atlas-title">
            EMBER ATLAS <span className="title-accent">／ WAYPOINTS</span>
          </h1>
          <p className="atlas-sub">pin drifting waypoints — paint a living atlas from your wanderings</p>
        </div>
        <div className="hud-stats" role="status" aria-label="Atlas statistics">
          <div className="hud-stat">
            <span className="hud-num">{waypoints.length}</span>
            <span className="hud-lbl">WAYPOINTS</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num">{routes.length}</span>
            <span className="hud-lbl">ROUTES</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num">{coverPct}%</span>
            <span className="hud-lbl">CLAIMED</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num">{totalKm}</span>
            <span className="hud-lbl">UNITS</span>
          </div>
        </div>
      </header>

      {/* mode bar */}
      <div className="mode-bar" role="toolbar" aria-label="Map modes">
        {(['view', 'drop', 'link'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`mode-btn${mode === m ? ' on' : ''}`}
            onClick={() => {
              setMode(m)
              blip(m === 'view' ? 440 : 660, 0.08, 0.25)
            }}
            aria-pressed={mode === m}
          >
            {m === 'view' ? '◉ VIEW [V]' : m === 'drop' ? '◇ DROP [D]' : '⬡ LINK [L]'}
          </button>
        ))}
        <button className="mode-btn bloom" onClick={bloom} aria-label="Replay territory bloom">
          ✸ BLOOM [B]
        </button>
      </div>

      {/* map */}
      <canvas
        ref={canvasRef}
        className={`atlas-canvas mode-${mode}`}
        onMouseDown={onCanvasDown}
        onMouseMove={onCanvasMove}
        onMouseUp={onCanvasUp}
        onMouseLeave={onCanvasUp}
        onDoubleClick={(e) => {
          const p = toMap(e.clientX, e.clientY)
          dropWaypoint(p.x, p.y)
        }}
        role="application"
        aria-label="Living atlas map. Activate drop mode then click to add waypoints."
        tabIndex={0}
      />

      {/* cursor readout */}
      <div className="cursor-read" aria-hidden="true" ref={cursorRef}>
        50.0, 50.0 ／ DRIFT≈ON
      </div>

      {/* ticker rail */}
      <div className="ticker" role="status">
        <span className="ticker-dot" />
        {ticker}
      </div>

      {/* panel toggle (mobile) */}
      <button
        className="panel-toggle"
        onClick={() => {
          setPanelOpen((o) => !o)
          blip(500, 0.07, 0.2)
        }}
        aria-expanded={panelOpen}
        aria-label="Toggle telemetry panel"
      >
        {panelOpen ? '⟨ TELEMETRY' : 'TELEMETRY ⟩'}
      </button>

      {/* telemetry column */}
      {panelOpen && (
        <aside className="telemetry" aria-label="Atlas telemetry">
          <section className="tele-block">
            <h2 className="tele-h">◤ CONTROLS</h2>
            <div className="btn-grid">
              <button className={`tbtn${driftOn ? ' on' : ''}`} onClick={() => { setDriftOn((d) => !d); blip(480, 0.08, 0.25) }} aria-pressed={driftOn}>
                {driftOn ? '〜 DRIFT ON' : '— DRIFT OFF'}
              </button>
              <button className={`tbtn${muted ? '' : ' on'}`} onClick={toggleMute} aria-pressed={!muted}>
                {muted ? '♪ MUTED [M]' : '♪ SOUND [M]'}
              </button>
              <button
                className="tbtn"
                onClick={() => {
                  dropWaypoint(20 + Math.random() * 60, 20 + Math.random() * 60)
                }}
              >
                ＋ DROP @ RANDOM
              </button>
              <button className="tbtn danger" onClick={clearAll}>
                ✕ BURN ATLAS
              </button>
            </div>
          </section>

          <section className="tele-block">
            <h2 className="tele-h">◤ WAYPOINTS ({waypoints.length})</h2>
            {selected ? (
              <div className="wp-editor">
                <label className="fld">
                  NAME
                  <input
                    className="txt"
                    value={selected.name}
                    maxLength={28}
                    onChange={(e) =>
                      setWaypoints((prev) => prev.map((w) => (w.id === selected.id ? { ...w, name: e.target.value } : w)))
                    }
                  />
                </label>
                <label className="fld">
                  FIELD NOTE
                  <input
                    className="txt"
                    value={selected.note}
                    maxLength={80}
                    placeholder="what happened here…"
                    onChange={(e) =>
                      setWaypoints((prev) => prev.map((w) => (w.id === selected.id ? { ...w, note: e.target.value } : w)))
                    }
                  />
                </label>
                <div className="btn-grid">
                  <button
                    className={`tbtn${selected.pinned ? ' on' : ''}`}
                    onClick={() => {
                      setWaypoints((prev) => prev.map((w) => (w.id === selected.id ? { ...w, pinned: !w.pinned } : w)))
                      blip(540, 0.08, 0.25)
                    }}
                  >
                    {selected.pinned ? '⚓ PINNED' : '⚓ PIN DRIFT'}
                  </button>
                  <button
                    className="tbtn danger"
                    onClick={() => {
                      const id = selected.id
                      setWaypoints((prev) => prev.filter((w) => w.id !== id))
                      setRoutes((prev) =>
                        prev.map((r) => ({ ...r, stopIds: r.stopIds.filter((s) => s !== id) })),
                      )
                      setSelectedId(null)
                      blip(200, 0.15, 0.3)
                      setTick(`${selected.name} erased from the atlas`)
                    }}
                  >
                    ✕ DELETE
                  </button>
                </div>
              </div>
            ) : (
              <p className="tele-hint">click a diamond on the map to inspect it</p>
            )}
            <ul className="wp-list">
              {waypoints.map((w) => (
                <li key={w.id}>
                  <button
                    className={`wp-item${w.id === selectedId ? ' sel' : ''}`}
                    onClick={() => {
                      setSelectedId(w.id)
                      blip(560, 0.06, 0.2)
                    }}
                  >
                    <span className="wp-dia" aria-hidden="true" />
                    <span className="wp-name">{w.name}</span>
                    <span className="wp-co">{w.x.toFixed(0)},{w.y.toFixed(0)}</span>
                    {w.pinned && <span className="wp-pin">⚓</span>}
                  </button>
                </li>
              ))}
              {waypoints.length === 0 && <li className="tele-hint">no waypoints — press DROP and click the map</li>}
            </ul>
          </section>

          <section className="tele-block">
            <h2 className="tele-h">◤ ROUTES ({routes.length})</h2>
            <div className="btn-grid">
              <button className="tbtn" onClick={newRoute}>
                ＋ NEW ROUTE
              </button>
              <button className="tbtn" onClick={autoRoute}>
                〜 AUTO-TRACE
              </button>
            </div>
            <ul className="rt-list">
              {routes.map((r) => {
                const stops = r.stopIds.map((id) => byId.get(id)).filter((w): w is Waypoint => Boolean(w))
                return (
                  <li key={r.id} className={`rt-item${r.id === activeRouteId ? ' sel' : ''}`}>
                    <button
                      className="rt-head"
                      onClick={() => {
                        setActiveRouteId(r.id)
                        setMode('link')
                        blip(620, 0.07, 0.25)
                      }}
                    >
                      <span className="rt-swatch" style={{ background: r.color }} aria-hidden="true" />
                      <span className="rt-name">{r.name}</span>
                      <span className="rt-meta">
                        {r.stopIds.length} stops · {routeLength(stops)}u
                      </span>
                    </button>
                    <button
                      className="rt-del"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => {
                        setRoutes((prev) => prev.filter((x) => x.id !== r.id))
                        if (activeRouteId === r.id) setActiveRouteId(null)
                        blip(200, 0.12, 0.25)
                      }}
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
              {routes.length === 0 && <li className="tele-hint">no routes yet — NEW ROUTE then LINK waypoints</li>}
            </ul>
            {activeRoute && (
              <p className="tele-hint">
                linking → <b>{activeRoute.name}</b> — click diamonds in order. stops:{' '}
                {activeRoute.stopIds
                  .map((id) => byId.get(id)?.name ?? '?')
                  .join(' → ') || '(empty)'}
              </p>
            )}
          </section>

          <section className="tele-block">
            <h2 className="tele-h">◤ EXPORT MINI-MAP</h2>
            <div className="btn-grid">
              <button className="tbtn hot" onClick={exportPNG}>
                ⬇ PNG 640×400
              </button>
              <button className="tbtn hot" onClick={() => void copyShare()}>
                ⧉ COPY SHARE LINK
              </button>
            </div>
            <p className="tele-hint">PNG carries the ember stamp + claim %. links embed the full atlas in #a=.</p>
          </section>
        </aside>
      )}

      <footer className="atlas-foot" aria-hidden="true">
        keys — D drop · L link · B bloom · M mute · ESC cancel · drag diamonds to move · double-click drops fast
      </footer>
    </div>
  )
}
