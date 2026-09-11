import { useEffect, useRef } from 'react'

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Props {
  midnight: boolean
}

export function MemphisBackdrop({ midnight }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvasEl = ref.current
    if (!canvasEl) return
    const canvas = canvasEl
    const context = canvas.getContext('2d')
    if (!context) return
    const ctx = context

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rand = mulberry32(midnight ? 271828 : 314159)

    const colors = midnight
      ? ['#FF6FB5', '#3FD9EA', '#F2C94C', '#5FE0AE', '#B49BFF', '#FFA35C']
      : ['#FF4E9B', '#17C3E6', '#FFD23F', '#4FD6A0', '#8B5CF6', '#FF8A3D']

    function css(name: string, fallback: string) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      return v || fallback
    }

    let width = 0
    let height = 0

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function squiggle(x: number, y: number, w: number, amp: number, color: string, lw: number) {
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const px = x + (w * i) / 24
        const py = y + Math.sin((i / 24) * Math.PI * 4) * amp
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    function triangle(x: number, y: number, s: number, color: string, rot: number) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s, s)
      ctx.lineTo(-s, s)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    function zigzag(x: number, y: number, w: number, amp: number, color: string, lw: number) {
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const steps = 8
      for (let i = 0; i <= steps; i++) {
        const px = x + (w * i) / steps
        const py = y + (i % 2 === 0 ? -amp : amp)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    function star(x: number, y: number, s: number, color: string, alpha: number) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.quadraticCurveTo(x, y, x + s, y)
      ctx.quadraticCurveTo(x, y, x, y + s)
      ctx.quadraticCurveTo(x, y, x - s, y)
      ctx.quadraticCurveTo(x, y, x, y - s)
      ctx.fill()
      ctx.restore()
    }

    function draw() {
      const bg = css('--bg', midnight ? '#060512' : '#FBE3B9')
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      if (midnight) {
        const stars = Math.round((width * height) / 16000)
        for (let i = 0; i < stars; i++) {
          const x = rand() * width
          const y = rand() * height
          const s = 0.6 + rand() * 1.8
          star(x, y, s, rand() > 0.75 ? colors[i % colors.length] : '#F4EEFF', 0.25 + rand() * 0.65)
        }
        for (let i = 0; i < 5; i++) {
          const x = rand() * width
          const y = rand() * height
          ctx.globalAlpha = 0.18
          squiggle(x, y, 60 + rand() * 120, 8 + rand() * 10, colors[i % colors.length], 3)
          ctx.globalAlpha = 1
        }
      } else {
        const dots = Math.round((width * height) / 14000)
        for (let i = 0; i < dots; i++) {
          const x = rand() * width
          const y = rand() * height
          const r = 2 + rand() * 5
          ctx.globalAlpha = 0.32 + rand() * 0.3
          ctx.fillStyle = colors[i % colors.length]
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        for (let i = 0; i < 6; i++) {
          const x = rand() * width
          const y = rand() * height
          ctx.globalAlpha = 0.28
          squiggle(x, y, 70 + rand() * 130, 9 + rand() * 12, colors[i % colors.length], 4)
        }
        for (let i = 0; i < 5; i++) {
          const x = rand() * width
          const y = rand() * height
          ctx.globalAlpha = 0.3
          zigzag(x, y, 60 + rand() * 90, 8 + rand() * 8, colors[(i + 2) % colors.length], 4)
        }
        for (let i = 0; i < 7; i++) {
          const x = rand() * width
          const y = rand() * height
          ctx.globalAlpha = 0.3
          triangle(x, y, 8 + rand() * 12, colors[(i + 1) % colors.length], rand() * Math.PI)
        }
        ctx.globalAlpha = 1
      }
    }

    resize()
    draw()

    let raf = 0
    const onResize = () => {
      resize()
      draw()
    }
    window.addEventListener('resize', onResize)

    let t = 0
    function loop() {
      t += 1
      if (!reduced && midnight && t % 3 === 0) draw()
      raf = window.requestAnimationFrame(loop)
    }
    if (midnight && !reduced) raf = window.requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', onResize)
      window.cancelAnimationFrame(raf)
    }
  }, [midnight])

  return <canvas ref={ref} className="backdrop" aria-hidden="true" />
}
