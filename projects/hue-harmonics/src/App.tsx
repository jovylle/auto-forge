import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochrome'

const MODES: { id: Mode; label: string }[] = [
  { id: 'complementary', label: 'Complementary' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'split', label: 'Split' },
  { id: 'tetradic', label: 'Tetradic' },
  { id: 'monochrome', label: 'Monochrome' },
]

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function buildPalette(seedH: number, mode: Mode): string[] {
  const defs: Record<Mode, [number, number, number][]> = {
    complementary: [
      [0, 0.7, 0.45], [0, 0.55, 0.6], [0, 0.4, 0.75],
      [180, 0.7, 0.45], [180, 0.55, 0.6], [180, 0.4, 0.75],
    ],
    analogous: [
      [-30, 0.6, 0.5], [0, 0.65, 0.6], [30, 0.6, 0.5],
      [-30, 0.45, 0.7], [0, 0.5, 0.75], [30, 0.45, 0.7],
    ],
    triadic: [
      [0, 0.65, 0.5], [120, 0.65, 0.5], [240, 0.65, 0.5],
      [0, 0.45, 0.72], [120, 0.45, 0.72], [240, 0.45, 0.72],
    ],
    split: [
      [0, 0.65, 0.5], [150, 0.65, 0.5], [210, 0.65, 0.5],
      [0, 0.45, 0.72], [150, 0.45, 0.72], [210, 0.45, 0.72],
    ],
    tetradic: [
      [0, 0.65, 0.5], [90, 0.65, 0.5], [180, 0.65, 0.5], [270, 0.65, 0.5],
      [0, 0.45, 0.72], [180, 0.45, 0.72],
    ],
    monochrome: [
      [0, 0.5, 0.25], [0, 0.55, 0.35], [0, 0.6, 0.45],
      [0, 0.65, 0.6], [0, 0.5, 0.75], [0, 0.4, 0.88],
    ],
  }
  return defs[mode].map(([dh, s, l]) => hslToHex(seedH + dh, s, l))
}

const NAMED_HUES = [
  'crimson', 'vermilion', 'amber', 'ochre', 'chartreuse', 'verdigris',
  'teal', 'cerulean', 'indigo', 'violet', 'magenta', 'rose',
]
function hueName(h: number): string {
  const idx = Math.round(h / 30) % 12
  return NAMED_HUES[idx]
}

function lin(c: number) {
  c = c / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function luminance(hex: string): number {
  const r = lin(parseInt(hex.slice(1, 3), 16))
  const g = lin(parseInt(hex.slice(3, 5), 16))
  const b = lin(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export default function App() {
  const [hue, setHue] = useState<number>(() => {
    const v = localStorage.getItem('hh-hue')
    const n = v ? parseInt(v, 10) : NaN
    return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : 42
  })
  const [mode, setMode] = useState<Mode>(() => {
    const v = localStorage.getItem('hh-mode') as Mode | null
    return v && MODES.some((m) => m.id === v) ? v : 'complementary'
  })
  const [copiedSwatch, setCopiedSwatch] = useState<number | null>(null)
  const [exportState, setExportState] = useState<'idle' | 'copied' | 'fallback'>('idle')
  const [fallbackText, setFallbackText] = useState('')
  const dialRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const hueRef = useRef(hue)
  useEffect(() => { hueRef.current = hue }, [hue])

  useEffect(() => {
    document.documentElement.style.setProperty('--seed-h', String(hue))
  }, [hue])
  useEffect(() => {
    try { localStorage.setItem('hh-mode', mode) } catch { /* ignore */ }
  }, [mode])

  const palette = useMemo(() => buildPalette(hue, mode), [hue, mode])

  const weights = useMemo(() => {
    const ws = palette.map((hex) => Math.max(0.08, luminance(hex)))
    const total = ws.reduce((a, b) => a + b, 0)
    return ws.map((w) => (w / total) * 100)
  }, [palette])

  const cssExport = useMemo(() => {
    return `:root {\n${palette.map((c, i) => `  --palette-${i + 1}: ${c};`).join('\n')}\n}`
  }, [palette])

  const setHueFromPoint = useCallback((clientX: number, clientY: number) => {
    const el = dialRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    // 0 at top, increasing clockwise
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (deg < 0) deg += 360
    setHue(Math.round(deg) % 360)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    dragging.current = true
    dialRef.current?.setPointerCapture(e.pointerId)
    setHueFromPoint(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setHueFromPoint(e.clientX, e.clientY)
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try { dialRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    try { localStorage.setItem('hh-hue', String(hueRef.current)) } catch { /* ignore */ }
  }
  const onPointerUp = endDrag
  const onPointerCancel = endDrag

  const onDialKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 15 : 1
    if (e.key === 'Home') { e.preventDefault(); setHue(0); try { localStorage.setItem('hh-hue', '0') } catch {} }
    else if (e.key === 'End') { e.preventDefault(); setHue(359); try { localStorage.setItem('hh-hue', '359') } catch {} }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setHue((h) => { const n = (h + step) % 360; try { localStorage.setItem('hh-hue', String(n)) } catch {} ; return n }) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setHue((h) => { const n = ((h - step) % 360 + 360) % 360; try { localStorage.setItem('hh-hue', String(n)) } catch {} ; return n }) }
  }

  const copyTimer = useRef<number | null>(null)
  const copyHex = async (hex: string, idx: number) => {
    let ok = false
    try {
      if (navigator.clipboard) { await navigator.clipboard.writeText(hex); ok = true }
    } catch { ok = false }
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = hex
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      document.body.removeChild(ta)
    }
    if (ok) {
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      setCopiedSwatch(idx)
      copyTimer.current = window.setTimeout(() => setCopiedSwatch(null), 900)
    }
  }

  const doExport = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(cssExport)
      else throw new Error('no clipboard')
      setExportState('copied')
      setTimeout(() => setExportState('idle'), 1600)
    } catch {
      setFallbackText(cssExport)
      setExportState('fallback')
    }
  }

  return (
    <div className="app">
      <div className="steam" />
      {/* RAIL */}
      <aside className="rail">
        <h1 className="wordmark">Hue Harmonics</h1>
        <div className="section-label">Seed hue</div>
        <div className="plate dial-wrap">
          <span className="rivet tl" /><span className="rivet tr" /><span className="rivet bl" /><span className="rivet br" />
          <div
            ref={dialRef}
            className="dial"
            role="slider"
            aria-label="Seed hue"
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={hue}
            aria-valuetext={`${hue} degrees, ${hueName(hue)}`}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onKeyDown={onDialKey}
          >
            {/* ticks */}
            <svg viewBox="0 0 240 240" width="240" height="240" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {Array.from({ length: 24 }).map((_, i) => {
                const a = (i * 15 * Math.PI) / 180
                const x1 = 120 + Math.sin(a) * 108
                const y1 = 120 - Math.cos(a) * 108
                const x2 = 120 + Math.sin(a) * 116
                const y2 = 120 - Math.cos(a) * 116
                const hot = Math.abs((((i * 15 - hue) % 360) + 540) % 360 - 180) < 15
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hot ? 'var(--color-brass-bright)' : 'var(--color-iron)'} strokeWidth={hot ? 2 : 1} opacity={hot ? 1 : 0.5} />
              })}
            </svg>
            <div className="dial-needle" style={{ transform: `rotate(${hue}deg)` }} />
            <div className="dial-center" />
          </div>
          <div className="hue-readout">
            <div className="hue-num">{hue}<span className="deg">°</span></div>
            <div className="hue-name">{hueName(hue)}</div>
          </div>
        </div>

        <div className="section-label">Harmony</div>
        <div className="plate">
          <span className="rivet tl" /><span className="rivet tr" /><span className="rivet bl" /><span className="rivet br" />
          <div className="harmony-list">
            {MODES.map((m) => {
              const active = m.id === mode
              return (
                <button
                  key={m.id}
                  className={`harmony-row ${active ? 'active' : ''}`}
                  onClick={() => setMode(m.id)}
                  aria-pressed={active}
                >
                  <span className="harmony-label">{m.label}</span>
                  <span className="groove" />
                  <span className="knob" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="section-label">Readout</div>
        <div className="plate">
          <span className="rivet tl" /><span className="rivet tr" /><span className="rivet bl" /><span className="rivet br" />
          <div className="meta-row"><span className="meta-key">Base hue</span><span className="meta-val">{hue}°</span></div>
          <div className="meta-row"><span className="meta-key">Algorithm</span><span className="meta-val">{mode}</span></div>
          <div className="meta-row"><span className="meta-key">Swatches</span><span className="meta-val">{palette.length}</span></div>
        </div>

        <div className="export-bar">
          <button className={`export-btn ${exportState === 'copied' ? 'is-copied' : ''}`} onClick={doExport}>
            {exportState === 'copied' ? 'Copied to clipboard' : 'Export CSS'}
          </button>
          {exportState === 'fallback' && (
            <textarea
              readOnly
              value={fallbackText}
              onFocus={(e) => e.target.select()}
              style={{ width: '100%', minHeight: 60, background: 'var(--color-soot-900)', color: 'var(--color-paper)', border: '1px solid var(--color-iron)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            />
          )}
        </div>
      </aside>

      {/* CANVAS */}
      <main className="canvas">
        <div className="canvas-caption">{MODES.find((m) => m.id === mode)?.label} harmony</div>
        <div className="strips" key={mode}>
          {palette.map((hex, i) => {
            const onDark = luminance(hex) < 0.35
            const labelColor = onDark ? 'var(--color-paper)' : 'var(--color-soot-900)'
            const isCopied = copiedSwatch === i
            return (
              <button
                key={i}
                className={`strip ${isCopied ? 'is-copied' : ''}`}
                style={{ width: `${weights[i]}%`, background: hex }}
                onClick={() => copyHex(hex, i)}
                aria-label={`Copy ${hex}`}
              >
                <span className="copied-flash" />
                <span className="hex" style={{ color: labelColor }}>
                  {isCopied ? 'COPIED' : hex.toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}