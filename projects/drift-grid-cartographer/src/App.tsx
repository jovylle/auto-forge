import { useEffect, useRef, useState } from 'react'

const GRID = 24
const CELL = 20
const SIZE = GRID * CELL

type Terrain = 0 | 1 | 2 | 3 | 4 | 5 | 6
const TERRAIN: { id: Terrain; name: string; color: string; glyph: string }[] = [
  { id: 0, name: 'Void', color: '#0d0c1a', glyph: '·' },
  { id: 1, name: 'Road', color: '#2a2a3e', glyph: '═' },
  { id: 2, name: 'Water', color: '#005f8a', glyph: '≈' },
  { id: 3, name: 'Grass', color: '#1f4a2f', glyph: '♣' },
  { id: 4, name: 'Sand', color: '#b89a5a', glyph: '▒' },
  { id: 5, name: 'Forest', color: '#0d2e1a', glyph: '♠' },
  { id: 6, name: 'Peak', color: '#5a5a6e', glyph: '▲' },
]

interface Pin { x: number; y: number; label: string; color: string }
interface Snap { grid: Terrain[][]; pins: Pin[] }

function cloneGrid(g: Terrain[][]): Terrain[][] { return g.map(r => [...r]) }
function clonePins(p: Pin[]): Pin[] { return p.map(x => ({ ...x })) }

const PIN_COLORS = ['#ff2d95', '#00e5ff', '#ffb347', '#b388ff', '#7cffb2']

export default function App() {
  const [grid, setGrid] = useState<Terrain[][]>(() => Array.from({ length: GRID }, () => Array(GRID).fill(0)))
  const [pins, setPins] = useState<Pin[]>([])
  const [tool, setTool] = useState<'paint' | 'erase' | 'pin'>('paint')
  const [terrain, setTerrain] = useState<Terrain>(3)
  const [past, setPast] = useState<Snap[]>([])
  const [future, setFuture] = useState<Snap[]>([])
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [pinLabel, setPinLabel] = useState('')
  const [easter, setEaster] = useState(false)
  const [titleClicks, setTitleClicks] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const strokeBeforeRef = useRef<Snap | null>(null)
  const gridRef = useRef(grid)
  const pinsRef = useRef(pins)
  useEffect(() => { gridRef.current = grid }, [grid])
  useEffect(() => { pinsRef.current = pins }, [pins])

  const cellFromEvent = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const c = canvasRef.current
    if (!c) return null
    const r = c.getBoundingClientRect()
    const sx = (e.clientX - r.left) * (SIZE / r.width)
    const sy = (e.clientY - r.top) * (SIZE / r.height)
    const x = Math.floor(sx / CELL)
    const y = Math.floor(sy / CELL)
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null
    return { x, y }
  }

  const paintCell = (x: number, y: number) => {
    setGrid(g => {
      const ng = cloneGrid(g)
      ng[y]![x]! = terrain
      return ng
    })
  }
  const eraseCell = (x: number, y: number) => {
    setGrid(g => {
      const ng = cloneGrid(g)
      ng[y]![x]! = 0
      return ng
    })
  }

  const onMouseDown = (e: { clientX: number; clientY: number }) => {
    const cell = cellFromEvent(e)
    if (!cell) return
    if (tool === 'pin') return
    drawingRef.current = true
    strokeBeforeRef.current = { grid: cloneGrid(gridRef.current), pins: clonePins(pinsRef.current) }
    if (tool === 'paint') paintCell(cell.x, cell.y)
    else eraseCell(cell.x, cell.y)
  }
  const onMouseMove = (e: { clientX: number; clientY: number }) => {
    if (!drawingRef.current) return
    const cell = cellFromEvent(e)
    if (!cell) return
    if (tool === 'paint') paintCell(cell.x, cell.y)
    else eraseCell(cell.x, cell.y)
  }
  const onMouseUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const before = strokeBeforeRef.current
    strokeBeforeRef.current = null
    // commit history only if changed
    const changed = JSON.stringify(before?.grid) !== JSON.stringify(gridRef.current) || JSON.stringify(before?.pins) !== JSON.stringify(pinsRef.current)
    if (changed && before) {
      setPast(p => [...p, before].slice(-60))
      setFuture([])
    }
  }

  const onCanvasClick = (e: { clientX: number; clientY: number }) => {
    if (tool !== 'pin') return
    const cell = cellFromEvent(e)
    if (!cell) return
    setPendingPin(cell)
    setPinLabel('')
  }

  const confirmPin = () => {
    if (!pendingPin) return
    const label = pinLabel.trim() || 'PIN'
    const before: Snap = { grid: cloneGrid(gridRef.current), pins: clonePins(pinsRef.current) }
    const color = PIN_COLORS[pins.length % PIN_COLORS.length]!
    const np = [...pinsRef.current, { x: pendingPin.x, y: pendingPin.y, label, color }]
    setPast(p => [...p, before].slice(-60))
    setFuture([])
    setPins(np)
    setPendingPin(null)
  }

  const undo = () => {
    setPast(p => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]!
      setFuture(f => [{ grid: cloneGrid(gridRef.current), pins: clonePins(pinsRef.current) }, ...f])
      setGrid(prev.grid)
      setPins(prev.pins)
      return p.slice(0, -1)
    })
  }
  const redo = () => {
    setFuture(f => {
      if (f.length === 0) return f
      const next = f[0]!
      setPast(p => [...p, { grid: cloneGrid(gridRef.current), pins: clonePins(pinsRef.current) }])
      setGrid(next.grid)
      setPins(next.pins)
      return f.slice(1)
    })
  }

  const clearAll = () => {
    const before: Snap = { grid: cloneGrid(gridRef.current), pins: clonePins(pinsRef.current) }
    setPast(p => [...p, before].slice(-60))
    setFuture([])
    setGrid(Array.from({ length: GRID }, () => Array(GRID).fill(0)))
    setPins([])
  }

  const exportPNG = () => {
    const c = canvasRef.current
    if (!c) return
    const url = c.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'drift-grid-map.png'
    a.click()
  }

  // draw
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = easter ? '#0a0014' : '#0a0a14'
    ctx.fillRect(0, 0, SIZE, SIZE)
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const t = TERRAIN.find(t => t.id === grid[y]![x])!
        ctx.fillStyle = easter ? shiftHue(t.color) : t.color
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
    // grid lines
    ctx.strokeStyle = easter ? 'rgba(255,45,149,0.25)' : 'rgba(0,229,255,0.12)'
    ctx.lineWidth = 1
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke()
    }
    // pins
    pins.forEach(p => {
      const cx = p.x * CELL + CELL / 2
      const cy = p.y * CELL + CELL / 2
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#0a0a14'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.label.slice(0, 3).toUpperCase(), cx, cy)
      // label below
      ctx.fillStyle = '#e8e8f0'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(p.label, cx, cy + 14)
    })
    if (easter) {
      ctx.fillStyle = 'rgba(255,45,149,0.08)'
      ctx.fillRect(0, 0, SIZE, SIZE)
    }
  }, [grid, pins, easter])

  // konami
  useEffect(() => {
    const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']
    let buf: string[] = []
    const onKey = (e: KeyboardEvent) => {
      buf.push(e.key)
      if (buf.length > seq.length) buf = buf.slice(-seq.length)
      if (buf.join(',') === seq.join(',')) {
        setEaster(true)
        buf = []
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onTitleClick = () => {
    const n = titleClicks + 1
    setTitleClicks(n)
    if (n >= 7) { setEaster(true); setTitleClicks(0) }
  }

  return (
    <div className="app">
      <header className="hdr">
        <div className="title" onClick={onTitleClick}>
          <span className="title-jp">ドリフト</span>
          <span className="title-en">DRIFT GRID CARTOGRAPHER</span>
        </div>
        <div className="hdr-actions">
          <button className="btn" onClick={undo} disabled={past.length === 0}>UNDO</button>
          <button className="btn" onClick={redo} disabled={future.length === 0}>REDO</button>
          <button className="btn btn-danger" onClick={clearAll}>CLEAR</button>
          <button className="btn btn-primary" onClick={exportPNG}>EXPORT PNG</button>
        </div>
      </header>

      <main className="main">
        <section className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={onCanvasClick}
            className="canvas"
          />
          <div className="canvas-hint">
            {tool === 'paint' && 'DRAG TO PAINT TERRAIN'}
            {tool === 'erase' && 'DRAG TO ERASE'}
            {tool === 'pin' && 'CLICK A CELL TO DROP A PIN'}
          </div>
        </section>

        <aside className="sidebar">
          <div className="panel">
            <h3 className="panel-title">TOOL</h3>
            <div className="tool-row">
              {(['paint','erase','pin'] as const).map(t => (
                <button key={t} className={`tool-btn ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">TERRAIN</h3>
            <div className="terrain-grid">
              {TERRAIN.map(t => (
                <button
                  key={t.id}
                  className={`terrain-btn ${terrain === t.id && tool === 'paint' ? 'active' : ''}`}
                  onClick={() => { setTerrain(t.id); setTool('paint') }}
                  title={t.name}
                >
                  <span className="terrain-swatch" style={{ background: t.color }} />
                  <span className="terrain-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">PINS ({pins.length})</h3>
            <ul className="pin-list">
              {pins.map((p, i) => (
                <li key={i}>
                  <span className="pin-dot" style={{ background: p.color }} />
                  <span>{p.label}</span>
                  <span className="pin-coord">({p.x},{p.y})</span>
                </li>
              ))}
              {pins.length === 0 && <li className="muted">none yet</li>}
            </ul>
          </div>

          <div className="panel easter-hint">
            <h3 className="panel-title">SECRET</h3>
            <p className="muted small">legends speak of a konami code… or seven clicks on the title.</p>
          </div>
        </aside>
      </main>

      {pendingPin && (
        <div className="modal-backdrop" onClick={() => setPendingPin(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>DROP PIN</h3>
            <p className="muted small">cell ({pendingPin.x},{pendingPin.y})</p>
            <input
              autoFocus
              value={pinLabel}
              onChange={e => setPinLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmPin(); if (e.key === 'Escape') setPendingPin(null) }}
              placeholder="label"
              maxLength={16}
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setPendingPin(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={confirmPin}>DROP</button>
            </div>
          </div>
        </div>
      )}

      {easter && (
        <div className="easter-overlay" onClick={() => setEaster(false)}>
          <div className="easter-text">
            <div className="easter-jp">漂流 解放</div>
            <div className="easter-en">DRIFT UNLOCKED</div>
            <div className="easter-sub">neon mode engaged — click to dismiss</div>
          </div>
        </div>
      )}
    </div>
  )
}

function shiftHue(hex: string): string { return hex }
