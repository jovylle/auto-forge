import { useEffect, useRef, useState, useCallback } from 'react'

type Swatch = { h: number; l: number; c: number }

const STARE_MS = 4000

function colorCss(l: number, c: number, h: number) {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}

const _rgbCanvas = document.createElement('canvas')
_rgbCanvas.width = 1
_rgbCanvas.height = 1
const _rgbCtx = _rgbCanvas.getContext('2d', { willReadFrequently: true })!
const _rgbCache = new Map<string, [number, number, number]>()
function colorToRgb(css: string): [number, number, number] {
  const cached = _rgbCache.get(css)
  if (cached) return cached
  _rgbCtx.fillStyle = css
  _rgbCtx.fillRect(0, 0, 1, 1)
  const d = _rgbCtx.getImageData(0, 0, 1, 1).data
  const res: [number, number, number] = [d[0], d[1], d[2]]
  _rgbCache.set(css, res)
  return res
}

function srgbToY(r: number, g: number, b: number): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const R = lin(r / 255)
  const G = lin(g / 255)
  const B = lin(b / 255)
  return 0.2126729 * R + 0.7151522 * G + 0.072175 * B
}

function apcaLc(fgCss: string, bgCss: string): number {
  const [fr, fg, fb] = colorToRgb(fgCss)
  const [br, bg, bb] = colorToRgb(bgCss)
  const yFg = srgbToY(fr, fg, fb)
  const yBg = srgbToY(br, bg, bb)
  if (Math.abs(yBg - yFg) < 0.0005) return 0
  let lc: number
  if (yBg > yFg) {
    lc = (Math.pow(yBg, 0.56) - Math.pow(yFg, 0.57)) * 1.14 * 100
  } else {
    lc = (Math.pow(yBg, 0.65) - Math.pow(yFg, 0.62)) * 1.14 * 100 - 0.027
  }
  if (Math.abs(lc) < 0.1) lc = 0
  return Math.round(lc)
}

function hexOf(css: string): string {
  const [r, g, b] = colorToRgb(css)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export default function App() {
  const [hue, setHue] = useState(214)
  const [lightness, setLightness] = useState(0.62)
  const [chroma, setChroma] = useState(0.19)
  const [palette, setPalette] = useState<Swatch[]>([])
  const [staring, setStaring] = useState(false)
  const [stareProgress, setStareProgress] = useState(0)
  const [afterVisible, setAfterVisible] = useState(false)
  const [liveMsg, setLiveMsg] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wheelRef = useRef<HTMLCanvasElement | null>(null)
  const stareTimer = useRef<number | null>(null)
  const stareStart = useRef(0)

  const mixCss = colorCss(lightness, chroma, hue)
  const afterHue = (hue + 180) % 360
  const afterChroma = Math.min(0.16, chroma * 0.92)
  const afterLightness = Math.min(0.95, lightness + 0.03)
  const afterCss = colorCss(afterLightness, afterChroma, afterHue)

  // update css vars
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--prism-mix', mixCss)
    root.style.setProperty('--prism-mix-soft', colorCss(Math.min(0.82, Math.max(0.74, lightness)), Math.min(0.1, chroma * 0.45), hue))
    root.style.setProperty('--prism-after', afterCss)
    root.style.setProperty('--prism-after-soft', colorCss(Math.min(0.84, Math.max(0.76, afterLightness)), Math.min(0.08, afterChroma * 0.45), afterHue))
  }, [hue, lightness, chroma, mixCss, afterCss, afterHue, afterChroma, afterLightness])

  // build wheel once
  useEffect(() => {
    const size = 420
    const off = document.createElement('canvas')
    off.width = size
    off.height = size
    const ctx = off.getContext('2d')!
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 6
    for (let a = 0; a < 360; a += 1) {
      const start = (a - 1) * Math.PI / 180
      const end = (a + 1) * Math.PI / 180
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = `hsl(${a}, 78%, 56%)`
      ctx.fill()
    }
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55)
    grad.addColorStop(0, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    wheelRef.current = off
  }, [])

  // draw marker
  useEffect(() => {
    const canvas = canvasRef.current
    const wheel = wheelRef.current
    if (!canvas || !wheel) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = canvas.width
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(wheel, 0, 0)
    const cx = size / 2
    const cy = size / 2
    const maxR = size / 2 - 8
    const ang = hue * Math.PI / 180
    const mr = (chroma / 0.3) * maxR
    ctx.beginPath()
    ctx.arc(cx + Math.cos(ang) * mr, cy + Math.sin(ang) * mr, 8, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + Math.cos(ang) * mr, cy + Math.sin(ang) * mr, 6, 0, Math.PI * 2)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [hue, chroma])

  const updateFromPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    const r = Math.hypot(x, y)
    const maxR = rect.width / 2 - 8
    const angle = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
    const sat = Math.min(1, r / maxR)
    setHue(angle)
    setChroma(Math.max(0.02, sat * 0.3))
  }, [])

  // keyboard on canvas
  const handleCanvasKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHue((h) => (h - (e.shiftKey ? 10 : 1) + 360) % 360) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setHue((h) => (h + (e.shiftKey ? 10 : 1)) % 360) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setLightness((l) => Math.min(0.95, l + (e.shiftKey ? 0.05 : 0.01))) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setLightness((l) => Math.max(0.05, l - (e.shiftKey ? 0.05 : 0.01))) }
    else if (e.key === 'PageUp') { e.preventDefault(); setChroma((c) => Math.min(0.3, c + 0.01)) }
    else if (e.key === 'PageDown') { e.preventDefault(); setChroma((c) => Math.max(0.01, c - 0.01)) }
    else if (e.key === 'Enter') { e.preventDefault(); commitSwatch() }
    else if (e.key === 'Escape') { e.preventDefault(); resetMix() }
    else if (e.code === 'Space') {
      e.preventDefault()
      if (e.repeat) return
      if (!staring) startStare()
    }
  }

  function commitSwatch() {
    stopStare()
    setPalette((p) => {
      const hex = hexOf(mixCss)
      if (p.some((s) => hexOf(colorCss(s.l, s.c, s.h)) === hex)) return p
      if (p.length >= 12) return p
      return [...p, { h: hue, l: lightness, c: chroma }]
    })
    setLiveMsg(`committed swatch ${hexOf(mixCss)}`)
  }
  function resetMix() {
    stopStare()
    setAfterVisible(false)
    setHue(214); setLightness(0.62); setChroma(0.19)
    setLiveMsg('reset mix to neutral')
  }
  function startStare() {
    setStaring(true)
    setStareProgress(0)
    setAfterVisible(false)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStaring(false)
      setAfterVisible(true)
      setLiveMsg('afterimage ready')
      return
    }
    stareStart.current = performance.now()
    if (stareTimer.current) window.clearInterval(stareTimer.current)
    stareTimer.current = window.setInterval(() => {
      const elapsed = performance.now() - stareStart.current
      const p = Math.min(1, elapsed / STARE_MS)
      setStareProgress(p)
      if (p >= 1) {
        if (stareTimer.current) window.clearInterval(stareTimer.current)
        stareTimer.current = null
        setStaring(false)
        setAfterVisible(true)
        setLiveMsg('afterimage ready')
      }
    }, 50)
  }
  function stopStare() {
    if (staring) {
      if (stareTimer.current) window.clearInterval(stareTimer.current)
      stareTimer.current = null
      setStaring(false)
      setStareProgress(0)
    }
  }

  // space keyup
  useEffect(() => {
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') stopStare()
    }
    window.addEventListener('keyup', onUp)
    return () => window.removeEventListener('keyup', onUp)
  }, [staring])

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (stareTimer.current) window.clearInterval(stareTimer.current)
    }
  }, [])

  // throttled live announcement
  useEffect(() => {
    const t = window.setTimeout(() => {
      setLiveMsg(`mix ${hexOf(mixCss)} hue ${hue.toFixed(0)} degrees`)
    }, 400)
    return () => window.clearTimeout(t)
  }, [hue, lightness, chroma])

  // contrast values
  const paperColor = 'oklch(0.945 0.018 84)'
  const inkColor = 'oklch(0.235 0.022 52)'
  const lcOnPaper = apcaLc(mixCss, paperColor) // text mix on paper bg
  const lcOnMix = apcaLc(inkColor, mixCss) // text ink on mix bg
  const verdict = (v: number) => (Math.abs(v) >= 75 ? 'pass' : Math.abs(v) >= 60 ? 'warn' : 'fail')

  async function exportPng() {
    await document.fonts.ready
    const W = 1600
    const H = 1000
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    ctx.fillStyle = paperColor
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = inkColor
    ctx.font = 'italic 64px "Instrument Serif", serif'
    ctx.fillText(`afterimage · ${hue.toFixed(0)}°`, 80, 120)
    ctx.font = '20px "Spline Sans Mono", monospace'
    ctx.fillText(`mix ${hexOf(mixCss)}  ·  complement ${hexOf(afterCss)}`, 80, 160)
    const swatches = [{ css: mixCss, label: 'mix' }, { css: afterCss, label: 'afterimage' }, ...palette.map((s) => ({ css: colorCss(s.l, s.c, s.h), label: 'swatch' }))]
    const chipW = 120
    const gap = 24
    const rowH = 200
    let x = 80
    let y = 260
    swatches.forEach((s) => {
      if (x + chipW > W - 80) { x = 80; y += rowH }
      ctx.fillStyle = s.css
      ctx.fillRect(x, y, chipW, chipW)
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.strokeRect(x, y, chipW, chipW)
      ctx.fillStyle = inkColor
      ctx.font = '14px "Spline Sans Mono", monospace'
      ctx.fillText(hexOf(s.css), x, y + chipW + 24)
      const lc = apcaLc(inkColor, s.css)
      ctx.fillText(`Lc ${lc}`, x, y + chipW + 46)
      ctx.font = '12px "Karla", sans-serif'
      ctx.fillText(s.label, x, y + chipW + 66)
      x += chipW + gap
    })
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.moveTo(80, H - 80)
    ctx.lineTo(W - 80, H - 80)
    ctx.stroke()
    ctx.font = '14px "Spline Sans Mono", monospace'
    ctx.fillStyle = inkColor
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    ctx.fillText(`afterimage-prism · ${hexOf(mixCss)} · ${date}`, 80, H - 40)
    c.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `afterimage-prism-${hexOf(mixCss).slice(1)}-${date}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
    setLiveMsg('exported png')
  }

  return (
    <>
    <div className="field" aria-hidden="true" />
    <main id="main" tabIndex={-1} className="relative z-10 min-h-screen p-6 md:p-10">
      <a href="#main" className="skip-link">skip to content</a>
      <div className="grid grid-cols-12 gap-6">
        {/* spine */}
        <aside className="spine col-span-12 lg:col-span-2 plate p-4">
          <div className="readout mb-2">specimen · afterimage-prism</div>
          <div className="readout">mix · {hexOf(mixCss)}</div>
          <div className="readout">hue · {hue.toFixed(0)}°</div>
          <div className="readout">chroma · {chroma.toFixed(3)}</div>
          <div className="readout">lightness · {lightness.toFixed(2)}</div>
          <div className="readout mt-2">complement · {hexOf(afterCss)}</div>
          <div className="readout">after Lc · {apcaLc(inkColor, afterCss)}</div>
        </aside>

        {/* title */}
        <header className="col-span-12 lg:col-span-6 lg:col-start-4">
          <h1 className="display text-5xl md:text-7xl text-[color:var(--prism-ink)]">
            Afterimage <em className="italic">Prism</em>
          </h1>
          <p className="mt-3 max-w-[62ch] text-[color:var(--prism-ink-2)]">
            Drag the wheel to mix a hue. Your eye keeps what the screen took away — the complement is the afterimage.
          </p>
        </header>

        {/* stage plate */}
        <section className="col-span-12 lg:col-span-9 lg:col-start-4 plate p-4 -mt-2 relative">
          <div className="bg-[color:var(--prism-paper-2)] p-3 inline-block">
            <canvas
              ref={canvasRef}
              width={420}
              height={420}
              role="slider"
              aria-label="hue mixer"
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(hue)}
              aria-valuetext={`hue ${hue.toFixed(0)} degrees, chroma ${chroma.toFixed(2)}`}
              tabIndex={0}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); updateFromPointer(e) }}
              onPointerMove={(e) => { if (e.buttons === 1) updateFromPointer(e) }}
              onPointerCancel={() => {}}
              onKeyDown={handleCanvasKey}
              onKeyUp={(e) => { if (e.code === 'Space') stopStare() }}
              className="block w-full max-w-[420px] h-auto aspect-square cursor-crosshair touch-none focus-visible:outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              hue
              <input type="range" min={0} max={360} step={1} value={hue} onChange={(e) => setHue(Number(e.target.value))} aria-valuetext={`hue ${hue.toFixed(0)} degrees, chroma ${chroma.toFixed(2)}`} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              lightness
              <input type="range" min={0.05} max={0.95} step={0.01} value={lightness} onChange={(e) => setLightness(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              chroma
              <input type="range" min={0.01} max={0.3} step={0.01} value={chroma} onChange={(e) => setChroma(Number(e.target.value))} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button onClick={commitSwatch} className="plate-deep px-3 py-1 text-sm">commit swatch (Enter)</button>
            <button onClick={resetMix} className="plate-deep px-3 py-1 text-sm">reset (Esc)</button>
            <button
              onClick={() => (staring ? stopStare() : startStare())}
              aria-pressed={staring}
              className="plate-deep px-3 py-1 text-sm"
            >
              {staring ? 'staring…' : 'stare (Space)'}
            </button>
          </div>
          {/* stare progress */}
          <div className="mt-3 h-1 bg-[color:var(--prism-rule)] relative" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stareProgress * 100)}>
            <div className="h-full bg-[color:var(--prism-ink)] meter-bar" style={{ width: `${stareProgress * 100}%` }} />
          </div>
          <div className="mt-3 plate-deep p-3">
            <div className="readout mb-2">{staring ? 'staring…' : afterVisible ? 'afterimage' : 'preview'}</div>
            <div className="w-full h-28 transition-none" style={{ background: staring ? mixCss : afterVisible ? afterCss : 'var(--prism-paper-2)' }} />
            {staring && <div className="readout mt-2">{Math.round(stareProgress * 100)}%</div>}
          </div>
          {afterVisible && (
            <div className="mt-3 readout">afterimage ready · {hexOf(afterCss)}</div>
          )}
        </section>

        {/* chips */}
        <section className="col-span-12 lg:col-span-4 lg:col-start-4 flex gap-4 mt-2">
          <div className="chip plate p-3 flex-1">
            <div className="w-full h-16 mb-2" style={{ background: mixCss }} />
            <div className="readout">mix · {hexOf(mixCss)}</div>
            <div className="readout">oklch({lightness.toFixed(2)} {chroma.toFixed(2)} {hue.toFixed(0)})</div>
          </div>
          <div className="chip plate p-3 flex-1">
            <div className="w-full h-16 mb-2" style={{ background: afterCss }} />
            <div className="readout">afterimage · {hexOf(afterCss)}</div>
            <div className="readout">oklch({afterLightness.toFixed(2)} {afterChroma.toFixed(2)} {afterHue.toFixed(0)})</div>
          </div>
        </section>

        {/* meter plate */}
        <section className="col-span-12 lg:col-span-4 lg:col-start-4 plate p-4 lg:-mt-8 relative z-20">
          <h2 className="display text-2xl mb-2">contrast meter</h2>
          <div className="space-y-3">
            <div>
              <div className="readout mb-1">mix on paper · Lc {lcOnPaper} · {verdict(lcOnPaper)}</div>
              <div className="h-2 bg-[color:var(--prism-rule)] relative">
                <div className={`h-full meter-bar ${verdict(lcOnPaper) === 'pass' ? 'bg-[color:var(--prism-pass)]' : verdict(lcOnPaper) === 'warn' ? 'bg-[color:var(--prism-warn)]' : 'bg-[color:var(--prism-fail)]'}`} style={{ width: `${Math.min(100, (Math.abs(lcOnPaper) / 100) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="readout mb-1">ink on mix · Lc {lcOnMix} · {verdict(lcOnMix)}</div>
              <div className="h-2 bg-[color:var(--prism-rule)] relative">
                <div className={`h-full meter-bar ${verdict(lcOnMix) === 'pass' ? 'bg-[color:var(--prism-pass)]' : verdict(lcOnMix) === 'warn' ? 'bg-[color:var(--prism-warn)]' : 'bg-[color:var(--prism-fail)]'}`} style={{ width: `${Math.min(100, (Math.abs(lcOnMix) / 100) * 100)}%` }} />
              </div>
            </div>
            <div className="readout">thresholds · Lc 60 large · 75 body</div>
          </div>
        </section>

        {/* palette list */}
        <section className="col-span-12 lg:col-span-6 lg:col-start-4 plate-deep p-4 mt-2">
          <h2 className="display text-2xl mb-2">palette</h2>
          {palette.length === 0 ? (
            <div className="readout">no swatches yet — commit with Enter</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {palette.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6" style={{ background: colorCss(s.l, s.c, s.h) }} />
                  <span className="readout">{hexOf(colorCss(s.l, s.c, s.h))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* export plate */}
        <section className="col-span-12 lg:col-span-3 lg:col-start-10 plate-deep p-4 mt-6">
          <h2 className="display text-2xl mb-2">export</h2>
          <p className="text-sm text-[color:var(--prism-ink-2)] mb-3">PNG · 1600×1000 · palette + Lc</p>
          <button onClick={exportPng} className="plate px-3 py-2 text-sm w-full">export palette PNG</button>
        </section>
      </div>

      <div aria-live="polite" className="sr-only">{liveMsg}</div>
    </main>
    </>
  )
}