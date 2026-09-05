import { useEffect, useRef } from 'react'

const BUFF_W = 160
const BUFF_H = 100
const FPS = 12
const FRAME = 1000 / FPS

type Props = {
  target: number
}

export default function StaticViz({ target }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const buf = document.createElement('canvas')
    buf.width = BUFF_W
    buf.height = BUFF_H
    const bctx = buf.getContext('2d')
    if (!bctx) return
    const img = bctx.createImageData(BUFF_W, BUFF_H)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(2, Math.round(rect.width * dpr))
      canvas.height = Math.max(2, Math.round(rect.height * dpr))
    }
    resize()
    window.addEventListener('resize', resize)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let alpha = 0.4
    let last = 0
    let raf = 0

    const fillFrame = () => {
      const data = img.data
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
      bctx.putImageData(img, 0, 0)
    }
    const blit = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = Math.max(0.02, Math.min(1, alpha))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(buf, 0, 0, BUFF_W, BUFF_H, 0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
    }

    if (reduceMotion) {
      alpha = targetRef.current
      fillFrame()
      blit()
      return () => window.removeEventListener('resize', resize)
    }

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < FRAME) return
      last = t

      alpha += (targetRef.current - alpha) * 0.12
      fillFrame()
      blit()

      if (targetRef.current > 0.6 && Math.random() < 0.07) {
        const y = Math.random() * canvas.height
        const h = 1 + Math.random() * 2
        const shift = (Math.random() * 16 - 8) * (canvas.width / BUFF_W)
        ctx.globalAlpha = 0.85
        ctx.drawImage(buf, 0, 0, BUFF_W, BUFF_H, shift, y, canvas.width, h)
      }
      ctx.globalAlpha = 1
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full [image-rendering:pixelated]" aria-hidden="true" />
}