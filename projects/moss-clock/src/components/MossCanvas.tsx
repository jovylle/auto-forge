import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { SimState } from '../sim'
import { drawMoss } from '../draw'

export function MossCanvas({ simRef }: { simRef: RefObject<SimState | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef({ dpr: 1, width: 0, height: 0 })

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const r = wrap.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width * dpr))
      const h = Math.max(1, Math.round(r.height * dpr))
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      frameRef.current = { dpr, width: w / dpr, height: h / dpr }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    let raf = 0
    const loop = () => {
      const sim = simRef.current
      if (sim) drawMoss(ctx, frameRef.current, sim, Date.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [simRef])

  return (
    <div ref={wrapRef} className="moss-canvas-wrap">
      <canvas ref={canvasRef} aria-hidden="true" className="moss-canvas" />
    </div>
  )
}