import { useCallback, useEffect, useRef, useState } from 'react'

type Kind = 'source' | 'relay' | 'sink'
type Tool = 'add' | 'connect' | 'move' | 'erase'

interface CNode {
  id: string
  x: number // 0..100
  y: number // 0..100
  kind: Kind
  label: string
}
interface CEdge {
  id: string
  a: string
  b: string
}
interface Pulse {
  edgeId: string
  t: number
  dir: 1 | -1
}

const SAFFRON = '#f5a623'
const SIGNAL = '#2dd4bf'
const ALERT = '#ff5a5f'
const STORE_KEY = 'saffron-circuit-v1'

const KIND_COLOR: Record<Kind, string> = { source: SAFFRON, relay: SIGNAL, sink: ALERT }
const KIND_NAME: Record<Kind, string> = { source: 'Source', relay: 'Relay', sink: 'Sink' }

let uidCounter = 0
function uid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${Date.now().toString(36)}${uidCounter.toString(36)}`
}

function preset(name: 'triangle' | 'grid' | 'loop'): { nodes: CNode[]; edges: CEdge[] } {
  if (name === 'grid') {
    const nodes: CNode[] = [
      { id: 'n1', x: 14, y: 20, kind: 'source', label: 'S1 · Kochi' },
      { id: 'n2', x: 50, y: 14, kind: 'relay', label: 'R1 · Jaipur' },
      { id: 'n3', x: 84, y: 22, kind: 'relay', label: 'R2 · Surat' },
      { id: 'n4', x: 16, y: 72, kind: 'relay', label: 'R3 · Madurai' },
      { id: 'n5', x: 52, y: 78, kind: 'sink', label: 'K1 · Delhi' },
      { id: 'n6', x: 85, y: 70, kind: 'sink', label: 'K2 · Leh' },
    ]
    const pairs: Array<[string, string]> = [['n1', 'n2'], ['n2', 'n3'], ['n1', 'n4'], ['n4', 'n5'], ['n2', 'n5'], ['n3', 'n6'], ['n5', 'n6']]
    return { nodes, edges: pairs.map(([a, b], i) => ({ id: `e${i}`, a, b })) }
  }
  if (name === 'loop') {
    const nodes: CNode[] = [
      { id: 'n1', x: 50, y: 12, kind: 'source', label: 'S1 · Origin' },
      { id: 'n2', x: 82, y: 32, kind: 'relay', label: 'R1 · East' },
      { id: 'n3', x: 74, y: 74, kind: 'sink', label: 'K1 · South' },
      { id: 'n4', x: 26, y: 74, kind: 'relay', label: 'R2 · West' },
      { id: 'n5', x: 18, y: 32, kind: 'relay', label: 'R3 · Pass' },
    ]
    const pairs: Array<[string, string]> = [['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'n5'], ['n5', 'n1'], ['n1', 'n3']]
    return { nodes, edges: pairs.map(([a, b], i) => ({ id: `e${i}`, a, b })) }
  }
  return {
    nodes: [
      { id: 'n1', x: 12, y: 64, kind: 'source', label: 'S1 · Malabar' },
      { id: 'n2', x: 44, y: 26, kind: 'relay', label: 'R1 · Deccan' },
      { id: 'n3', x: 78, y: 52, kind: 'relay', label: 'R2 · Thar' },
      { id: 'n4', x: 58, y: 82, kind: 'sink', label: 'K1 · Bazaar' },
    ],
    edges: [
      { id: 'e0', a: 'n1', b: 'n2' },
      { id: 'e1', a: 'n2', b: 'n3' },
      { id: 'e2', a: 'n1', b: 'n4' },
      { id: 'e3', a: 'n3', b: 'n4' },
      { id: 'e4', a: 'n2', b: 'n4' },
    ],
  }
}

function loadInitial(): { nodes: CNode[]; edges: CEdge[] } {
  try {
    if (window.location.hash.startsWith('#c=')) {
      const raw = window.location.hash.slice(3)
      const json = decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))))
      const data = JSON.parse(json) as { nodes: CNode[]; edges: CEdge[] }
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) return data
    }
  } catch {
    /* fall through */
  }
  try {
    const saved = window.localStorage.getItem(STORE_KEY)
    if (saved) {
      const data = JSON.parse(saved) as { nodes: CNode[]; edges: CEdge[] }
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) return data
    }
  } catch {
    /* fall through */
  }
  return preset('triangle')
}

function encodeState(nodes: CNode[], edges: CEdge[]): string {
  const json = JSON.stringify({ nodes, edges })
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

export default function App(): React.JSX.Element {
  const [initial] = useState(loadInitial)
  const [nodes, setNodes] = useState<CNode[]>(initial.nodes)
  const [edges, setEdges] = useState<CEdge[]>(initial.edges)
  const [tool, setTool] = useState<Tool>('add')
  const [kind, setKind] = useState<Kind>('relay')
  const [power, setPower] = useState(true)
  const [speed, setSpeed] = useState(0.5)
  const [glow, setGlow] = useState(0.7)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingConnect, setPendingConnect] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [delivered, setDelivered] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const pulsesRef = useRef<Pulse[]>([])
  const flashRef = useRef<Map<string, number>>(new Map())
  const dragRef = useRef<string | null>(null)
  const hoverRef = useRef<string | null>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const stateRef = useRef({ nodes, edges, power, speed, glow, pendingConnect })
  stateRef.current = { nodes, edges, power, speed, glow, pendingConnect }
  const deliveredRef = useRef(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => {
      setToast((t) => (t === msg ? null : t))
    }, 2600)
  }, [])

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ nodes, edges }))
    } catch {
      /* storage full — ignore */
    }
  }, [nodes, edges])

  const nodeById = useCallback(
    (id: string): CNode | undefined => nodes.find((n) => n.id === id),
    [nodes],
  )

  const toBoard = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }, [])

  const hitNode = useCallback(
    (x: number, y: number): CNode | null => {
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const n = nodes[i]
        if (n && Math.hypot(n.x - x, (n.y - y) * 1.4) < 5.5) return n
      }
      return null
    },
    [nodes],
  )

  const hitEdge = useCallback(
    (x: number, y: number): CEdge | null => {
      for (let i = edges.length - 1; i >= 0; i -= 1) {
        const e = edges[i]
        if (!e) continue
        const a = nodeById(e.a)
        const b = nodeById(e.b)
        if (!a || !b) continue
        if (segDist(x, y, a.x, a.y, b.x, b.y) < 2.6) return e
      }
      return null
    },
    [edges, nodeById],
  )

  // ---- interactions ----
  const handlePointerDown = useCallback(
    (ev: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toBoard(ev.clientX, ev.clientY)
      if (!p) return
      const target = hitNode(p.x, p.y)
      if (tool === 'add') {
        if (target) {
          setSelectedId(target.id)
          return
        }
        const count = nodes.filter((n) => n.kind === kind).length
        const label = `${kind === 'source' ? 'S' : kind === 'relay' ? 'R' : 'K'}${count + 1}`
        const node: CNode = {
          id: uid('n'),
          x: Math.round(Math.max(3, Math.min(97, p.x)) * 10) / 10,
          y: Math.round(Math.max(4, Math.min(96, p.y)) * 10) / 10,
          kind,
          label,
        }
        setNodes((ns) => [...ns, node])
        setSelectedId(node.id)
        return
      }
      if (tool === 'connect') {
        if (target) {
          if (!pendingConnect) {
            setPendingConnect(target.id)
            setSelectedId(target.id)
          } else if (pendingConnect === target.id) {
            setPendingConnect(null)
          } else {
            const exists = edges.some(
              (e) => (e.a === pendingConnect && e.b === target.id) || (e.a === target.id && e.b === pendingConnect),
            )
            if (!exists) {
              setEdges((es) => [...es, { id: uid('e'), a: pendingConnect, b: target.id }])
              showToast('Trace soldered')
            } else {
              showToast('Trace already exists')
            }
            setPendingConnect(null)
            setSelectedId(target.id)
          }
        } else {
          setPendingConnect(null)
        }
        return
      }
      if (tool === 'erase') {
        if (target) {
          setNodes((ns) => ns.filter((n) => n.id !== target.id))
          setEdges((es) => es.filter((e) => e.a !== target.id && e.b !== target.id))
          if (selectedId === target.id) setSelectedId(null)
          if (pendingConnect === target.id) setPendingConnect(null)
          showToast('Node lifted')
          return
        }
        const e = hitEdge(p.x, p.y)
        if (e) {
          setEdges((es) => es.filter((x) => x.id !== e.id))
          showToast('Trace cut')
        }
        return
      }
      // move
      if (target) {
        dragRef.current = target.id
        setSelectedId(target.id)
        ;(ev.target as HTMLCanvasElement).setPointerCapture(ev.pointerId)
      } else {
        setSelectedId(null)
      }
    },
    [toBoard, hitNode, hitEdge, tool, kind, nodes, edges.length, pendingConnect, selectedId, showToast],
  )

  const handlePointerMove = useCallback(
    (ev: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toBoard(ev.clientX, ev.clientY)
      if (!p) return
      mouseRef.current = p
      const hov = hitNode(p.x, p.y)
      hoverRef.current = hov ? hov.id : null
      if (dragRef.current && tool === 'move') {
        const id = dragRef.current
        setNodes((ns) =>
          ns.map((n) =>
            n.id === id
              ? {
                  ...n,
                  x: Math.round(Math.max(3, Math.min(97, p.x)) * 10) / 10,
                  y: Math.round(Math.max(4, Math.min(96, p.y)) * 10) / 10,
                }
              : n,
          ),
        )
      }
    },
    [toBoard, hitNode, tool],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      const el = ev.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (ev.key === '1') setTool('add')
      else if (ev.key === '2') setTool('connect')
      else if (ev.key === '3') setTool('move')
      else if (ev.key === '4') setTool('erase')
      else if (ev.key === ' ') {
        ev.preventDefault()
        setPower((p) => !p)
      } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId) {
        const id = selectedId
        setNodes((ns) => ns.filter((n) => n.id !== id))
        setEdges((es) => es.filter((e) => e.a !== id && e.b !== id))
        setSelectedId(null)
      } else if (ev.key === 'Escape') {
        setPendingConnect(null)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  // ---- render loop ----
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const draw = (now: number): void => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { nodes: ns, edges: es, power: pw, speed: sp, glow: gl } = stateRef.current
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const X = (x: number): number => (x / 100) * w
      const Y = (y: number): number => (y / 100) * h

      ctx.clearRect(0, 0, w, h)
      // dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      const gap = 26
      for (let gx = gap / 2; gx < w; gx += gap) {
        for (let gy = gap / 2; gy < h; gy += gap) {
          ctx.fillRect(gx, gy, 1.5, 1.5)
        }
      }

      const byId = new Map(ns.map((n) => [n.id, n]))

      // advance pulses
      if (pw) {
        for (const e of es) {
          if (!pulsesRef.current.some((p) => p.edgeId === e.id)) {
            pulsesRef.current.push({ edgeId: e.id, t: Math.random(), dir: 1 })
          }
        }
        pulsesRef.current = pulsesRef.current.filter((p) => es.some((e) => e.id === p.edgeId))
        for (const p of pulsesRef.current) {
          p.t += dt * (0.12 + sp * 0.55)
          if (p.t >= 1) {
            p.t = 0
            const e = es.find((x) => x.id === p.edgeId)
            const dest = e ? byId.get(e.b) : undefined
            if (dest) flashRef.current.set(dest.id, now)
            deliveredRef.current += 1
            setDelivered(deliveredRef.current)
          }
        }
      }

      // edges
      for (const e of es) {
        const a = byId.get(e.a)
        const b = byId.get(e.b)
        if (!a || !b) continue
        const mx = (X(a.x) + X(b.x)) / 2
        const my = (Y(a.y) + Y(b.y)) / 2 - Math.abs(X(a.x) - X(b.x)) * 0.08
        const live = pw ? 0.5 + gl * 0.5 : 0.28
        ctx.save()
        ctx.strokeStyle = `rgba(45,212,191,${0.16 + live * 0.3})`
        ctx.lineWidth = 5 + gl * 5
        ctx.lineCap = 'round'
        ctx.shadowColor = SIGNAL
        ctx.shadowBlur = pw ? 14 * gl + 4 : 0
        ctx.beginPath()
        ctx.moveTo(X(a.x), Y(a.y))
        ctx.quadraticCurveTo(mx, my, X(b.x), Y(b.y))
        ctx.stroke()
        ctx.restore()
        ctx.save()
        ctx.strokeStyle = 'rgba(242,244,248,0.75)'
        ctx.lineWidth = 1.4
        ctx.setLineDash([5, 6])
        ctx.beginPath()
        ctx.moveTo(X(a.x), Y(a.y))
        ctx.quadraticCurveTo(mx, my, X(b.x), Y(b.y))
        ctx.stroke()
        ctx.restore()
      }

      // pending connect beam
      const pend = byId.get(stateRef.current.pendingConnect ?? '')
      const mouse = mouseRef.current
      if (pend && mouse) {
        ctx.save()
        ctx.strokeStyle = SIGNAL
        ctx.setLineDash([4, 5])
        ctx.lineWidth = 1.6
        ctx.shadowColor = SIGNAL
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(X(pend.x), Y(pend.y))
        ctx.lineTo(X(mouse.x), Y(mouse.y))
        ctx.stroke()
        ctx.restore()
      }

      // pulses
      if (pw) {
        for (const p of pulsesRef.current) {
          const e = es.find((x) => x.id === p.edgeId)
          if (!e) continue
          const a = byId.get(e.a)
          const b = byId.get(e.b)
          if (!a || !b) continue
          const mx = (X(a.x) + X(b.x)) / 2
          const my = (Y(a.y) + Y(b.y)) / 2 - Math.abs(X(a.x) - X(b.x)) * 0.08
          const t = p.t
          const ix = (1 - t) * (1 - t) * X(a.x) + 2 * (1 - t) * t * mx + t * t * X(b.x)
          const iy = (1 - t) * (1 - t) * Y(a.y) + 2 * (1 - t) * t * my + t * t * Y(b.y)
          ctx.save()
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = SIGNAL
          ctx.shadowBlur = 16
          ctx.beginPath()
          ctx.arc(ix, iy, 3.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // nodes
      for (const n of ns) {
        const color = KIND_COLOR[n.kind]
        const isHover = hoverRef.current === n.id
        const r = (n.kind === 'source' ? 11 : 9) + (isHover ? 2.5 : 0)
        ctx.save()
        ctx.shadowColor = color
        ctx.shadowBlur = 18 * gl + (isHover ? 12 : 4)
        const grad = ctx.createRadialGradient(X(n.x), Y(n.y), 1, X(n.x), Y(n.y), r * 2.4)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.35, color)
        grad.addColorStop(1, 'rgba(10,13,18,0.9)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(X(n.x), Y(n.y), r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        // flash ring
        const flashedAt = flashRef.current.get(n.id) ?? -1e9
        const age = now - flashedAt
        if (age < 450) {
          ctx.save()
          ctx.strokeStyle = SAFFRON
          ctx.globalAlpha = 1 - age / 450
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(X(n.x), Y(n.y), r + 4 + (age / 450) * 16, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
        // selected ring
        if (stateRef.current.pendingConnect === n.id) {
          ctx.save()
          ctx.strokeStyle = SIGNAL
          ctx.lineWidth = 2
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.arc(X(n.x), Y(n.y), r + 7, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
        // label
        ctx.save()
        ctx.font = '11px ui-monospace, Menlo, Consolas, monospace'
        ctx.fillStyle = 'rgba(242,244,248,0.9)'
        ctx.strokeStyle = 'rgba(10,13,18,0.85)'
        ctx.lineWidth = 3
        const label = n.label || KIND_NAME[n.kind]
        const lx = Math.min(Math.max(X(n.x) + 16, 4), w - ctx.measureText(label).width - 4)
        ctx.strokeText(label, lx, Y(n.y) + 4)
        ctx.fillText(label, lx, Y(n.y) + 4)
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const totalLength = edges.reduce((sum, e) => {
    const a = nodeById(e.a)
    const b = nodeById(e.b)
    if (!a || !b) return sum
    return sum + Math.hypot(a.x - b.x, a.y - b.y)
  }, 0)

  const selected = selectedId ? nodeById(selectedId) : undefined

  // ---- share / export ----
  const copyLink = useCallback(async () => {
    const hash = `#c=${encodeState(nodes, edges)}`
    const url = `${window.location.origin}${window.location.pathname}${hash}`
    try {
      window.location.hash = hash
      await window.navigator.clipboard.writeText(url)
      showToast('Share link copied')
    } catch {
      window.location.hash = hash
      showToast('Link in address bar — copy it')
    }
  }, [nodes, edges, showToast])

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = 'saffron-circuit.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
    showToast('Board exported as PNG')
  }, [showToast])

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = 'saffron-circuit.json'
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
    showToast('Board exported as JSON')
  }, [nodes, edges, showToast])

  const importJSON = useCallback(
    (file: File) => {
      file
        .text()
        .then((text) => {
          const data = JSON.parse(text) as { nodes: CNode[]; edges: CEdge[] }
          if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('bad file')
          setNodes(data.nodes)
          setEdges(data.edges)
          pulsesRef.current = []
          showToast('Board imported')
        })
        .catch(() => showToast('Import failed — invalid file'))
    },
    [showToast],
  )

  const burst = useCallback(() => {
    for (const e of edges) {
      pulsesRef.current.push({ edgeId: e.id, t: 0, dir: 1 })
      pulsesRef.current.push({ edgeId: e.id, t: 0.4, dir: 1 })
    }
    showToast('Surge released')
  }, [edges, showToast])

  const tools: Array<{ id: Tool; key: string; label: string; hint: string }> = [
    { id: 'add', key: '1', label: 'Place', hint: 'click board' },
    { id: 'connect', key: '2', label: 'Trace', hint: 'click A → B' },
    { id: 'move', key: '3', label: 'Drag', hint: 'move nodes' },
    { id: 'erase', key: '4', label: 'Lift', hint: 'cut traces' },
  ]

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="ambient" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
        {/* header — asymmetric: slash + offset title */}
        <header className="rise mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="slash h-10 w-40 sm:w-56" aria-hidden="true" />
          <div className="-ml-2 sm:-ml-4">
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-white/60">
              viz · spice-route breadboard
            </p>
            <h1 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">
              Saffron <span style={{ color: SAFFRON }}>Circuit</span>
            </h1>
          </div>
          <p className="ml-auto hidden max-w-xs text-sm leading-snug text-white/60 lg:block">
            Place settlements, solder glowing traces, and ride the monsoon pulses across your board.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* control rail */}
          <aside className="glass rise flex flex-col gap-4 p-4" aria-label="Circuit controls">
            <section>
              <h2 className="mono mb-2 text-[11px] uppercase tracking-[0.25em] text-white/55">Tool</h2>
              <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-2">
                {tools.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTool(t.id)
                      setPendingConnect(null)
                    }}
                    aria-pressed={tool === t.id}
                    title={`${t.label} (${t.key}) — ${t.hint}`}
                    className={`tool-btn rounded-xl border border-white/12 bg-white/5 px-2 py-2 text-left ${tool === t.id ? 'active-saffron bg-white/10' : ''}`}
                  >
                    <span className="block text-sm font-bold">{t.label}</span>
                    <span className="mono block text-[10px] text-white/50">
                      [{t.key}] {t.hint}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mono mb-2 text-[11px] uppercase tracking-[0.25em] text-white/55">Node kind</h2>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Node kind">
                {(Object.keys(KIND_NAME) as Kind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={`tool-btn flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${kind === k ? 'bg-white/10' : 'border-white/12 bg-white/5'}`}
                    style={kind === k ? { borderColor: KIND_COLOR[k], boxShadow: `0 0 14px ${KIND_COLOR[k]}55` } : undefined}
                  >
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
                    {KIND_NAME[k]}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <label htmlFor="flow" className="mono mb-1 flex justify-between text-[11px] uppercase tracking-widest text-white/55">
                  <span>Flow</span>
                  <span style={{ color: SIGNAL }}>{Math.round(speed * 100)}%</span>
                </label>
                <input
                  id="flow"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="glow" className="mono mb-1 flex justify-between text-[11px] uppercase tracking-widest text-white/55">
                  <span>Glow</span>
                  <span style={{ color: SAFFRON }}>{Math.round(glow * 100)}%</span>
                </label>
                <input
                  id="glow"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={glow}
                  onChange={(e) => setGlow(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </section>

            <section className="flex gap-2">
              <button
                type="button"
                onClick={() => setPower((p) => !p)}
                aria-pressed={power}
                className={`tool-btn flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${power ? 'active-signal bg-white/10' : 'border-white/12 bg-white/5'}`}
              >
                {power ? '● Live' : '○ Paused'}
                <span className="mono block text-[10px] font-normal text-white/50">[space]</span>
              </button>
              <button
                type="button"
                onClick={burst}
                className="tool-btn flex-1 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm font-bold hover:bg-white/10"
                style={{ color: SAFFRON }}
              >
                ⚡ Surge
              </button>
            </section>

            <section>
              <h2 className="mono mb-2 text-[11px] uppercase tracking-[0.25em] text-white/55">Boards</h2>
              <div className="flex gap-1.5">
                {(['triangle', 'grid', 'loop'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const d = preset(p)
                      setNodes(d.nodes)
                      setEdges(d.edges)
                      pulsesRef.current = []
                      setSelectedId(null)
                      setPendingConnect(null)
                      showToast(`Loaded ${p}`)
                    }}
                    className="tool-btn flex-1 rounded-xl border border-white/12 bg-white/5 px-2 py-1.5 text-xs font-bold capitalize hover:bg-white/10"
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setNodes([])
                    setEdges([])
                    pulsesRef.current = []
                    setSelectedId(null)
                    setPendingConnect(null)
                    showToast('Board wiped')
                  }}
                  className="tool-btn flex-1 rounded-xl border border-white/12 bg-white/5 px-2 py-1.5 text-xs font-bold hover:bg-white/10"
                  style={{ color: ALERT }}
                >
                  Clear
                </button>
              </div>
            </section>

            {/* selected node editor */}
            {selected && (
              <section className="glass-deep rise p-3" aria-label="Selected node">
                <h2 className="mono mb-2 text-[11px] uppercase tracking-[0.25em] text-white/55">Selected</h2>
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) =>
                    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, label: e.target.value.slice(0, 24) } : n)))
                  }
                  aria-label="Node label"
                  className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-1.5">
                  {(Object.keys(KIND_NAME) as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, kind: k } : n)))}
                      className={`flex-1 rounded-lg border px-1 py-1 text-[11px] font-bold ${selected.kind === k ? 'bg-white/15' : 'border-white/12 bg-white/5'}`}
                      style={selected.kind === k ? { borderColor: KIND_COLOR[k] } : undefined}
                    >
                      {KIND_NAME[k]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setNodes((ns) => ns.filter((n) => n.id !== selected.id))
                      setEdges((es) => es.filter((e) => e.a !== selected.id && e.b !== selected.id))
                      setSelectedId(null)
                    }}
                    aria-label="Delete node"
                    className="rounded-lg border border-white/12 bg-white/5 px-2 text-sm font-bold"
                    style={{ color: ALERT }}
                  >
                    ✕
                  </button>
                </div>
                <p className="mono mt-2 text-[10px] text-white/45">
                  x {selected.x.toFixed(1)} · y {selected.y.toFixed(1)}
                </p>
              </section>
            )}

            <section className="mt-auto">
              <h2 className="mono mb-2 text-[11px] uppercase tracking-[0.25em] text-white/55">Share / export</h2>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="tool-btn rounded-xl border border-white/12 bg-white/5 px-2 py-2 text-xs font-bold hover:bg-white/10"
                  style={{ color: SIGNAL }}
                >
                  ⧉ Copy link
                </button>
                <button
                  type="button"
                  onClick={exportPNG}
                  className="tool-btn rounded-xl border border-white/12 bg-white/5 px-2 py-2 text-xs font-bold hover:bg-white/10"
                  style={{ color: SAFFRON }}
                >
                  ▾ PNG
                </button>
                <button
                  type="button"
                  onClick={exportJSON}
                  className="tool-btn rounded-xl border border-white/12 bg-white/5 px-2 py-2 text-xs font-bold hover:bg-white/10"
                >
                  ▾ JSON
                </button>
                <label className="tool-btn cursor-pointer rounded-xl border border-white/12 bg-white/5 px-2 py-2 text-center text-xs font-bold hover:bg-white/10">
                  ⇪ Import
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) importJSON(f)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </section>
          </aside>

          {/* board */}
          <main className="flex min-h-[60vh] flex-col gap-3">
            <div className="glass relative flex-1 overflow-hidden" style={{ minHeight: '52vh' }}>
              <div ref={wrapRef} className="absolute inset-0">
                <canvas
                  ref={canvasRef}
                  className="board h-full w-full"
                  role="application"
                  aria-label="Circuit board. Use Place tool and click to add nodes, Trace tool to connect them."
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={() => {
                    mouseRef.current = null
                    hoverRef.current = null
                  }}
                />
              </div>
              {/* floating hint */}
              <div className="glass-deep pointer-events-none absolute left-3 top-3 hidden px-3 py-2 sm:block" aria-hidden="true">
                <p className="mono text-[11px] text-white/75">
                  {tool === 'connect' && pendingConnect
                    ? 'now click a second node →'
                    : tool === 'add'
                      ? `click to drop a ${KIND_NAME[kind].toLowerCase()}`
                      : tool === 'erase'
                        ? 'click a node or trace to lift it'
                        : 'drag nodes to rewire the map'}
                </p>
              </div>
              <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-white/12 bg-black/50 px-3 py-1.5 backdrop-blur-md">
                <span className={`live-dot inline-block h-2 w-2 rounded-full ${power ? '' : 'opacity-30'}`} style={{ background: power ? SIGNAL : 'rgba(255,255,255,0.3)' }} />
                <span className="mono text-[11px] uppercase tracking-widest text-white/70">
                  {power ? 'current flowing' : 'circuit open'}
                </span>
              </div>
              {toast && (
                <div className="glass-deep rise absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2" role="status">
                  <p className="text-sm font-bold">{toast}</p>
                </div>
              )}
              {/* stat strip overlaps board bottom */}
              <div className="glass-deep absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5" aria-label="Circuit stats">
                <Stat label="nodes" value={String(nodes.length)} color={SAFFRON} />
                <Stat label="traces" value={String(edges.length)} color={SIGNAL} />
                <Stat label="delivered" value={String(delivered)} color={SIGNAL} />
                <Stat label="wire" value={`${Math.round(totalLength)}u`} color={SAFFRON} />
                <span className="mono ml-auto hidden text-[10px] uppercase tracking-widest text-white/40 md:inline">
                  1-4 tools · space power · del remove
                </span>
              </div>
            </div>

            {/* legend card row — asymmetric offset */}
            <div className="grid gap-3 sm:grid-cols-3 sm:pl-10">
              {(['source', 'relay', 'sink'] as Kind[]).map((k) => (
                <div key={k} className="glass flex items-center gap-3 px-4 py-3">
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full"
                    style={{ background: KIND_COLOR[k], boxShadow: `0 0 12px ${KIND_COLOR[k]}` }}
                  />
                  <div>
                    <p className="text-sm font-black">{KIND_NAME[k]}s</p>
                    <p className="text-xs text-white/55">
                      {k === 'source' ? 'emit pulses into the mesh' : k === 'relay' ? 'bend and boost the current' : 'drink the current, flash saffron'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>

        <footer className="mono mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-white/40">
          <span>saffron circuit · local-first — boards persist in this browser</span>
          <span aria-hidden="true">·</span>
          <span>no accounts · no servers · three inks + light</span>
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }): React.JSX.Element {
  return (
    <span className="flex items-baseline gap-2">
      <span className="mono text-xl font-black" style={{ color }}>
        {value}
      </span>
      <span className="mono text-[10px] uppercase tracking-[0.25em] text-white/50">{label}</span>
    </span>
  )
}
