import { hexToRgba } from './weather'

interface Streak {
  x: number
  y: number
  len: number
  speed: number
  far: boolean
}

export class RainView {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private streaks: Streak[] = []
  private opacity = 0
  private target = 0
  private w = 0
  private h = 0
  private near: string
  private far: string
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private stippleAcc = 0
  private lastBucket = -1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    const root = getComputedStyle(document.documentElement)
    const storm = root.getPropertyValue('--color-storm').trim() || '#46545e'
    this.near = hexToRgba(storm, 1)
    this.far = hexToRgba(storm, 0.45)
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w
    this.h = h
    this.canvas.width = Math.max(1, Math.floor(w * dpr))
    this.canvas.height = Math.max(1, Math.floor(h * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  setOn(v: boolean): void {
    this.target = v ? 1 : 0
  }

  frame(dt: number, intensity: number): void {
    const diff = this.target - this.opacity
    if (diff !== 0) {
      this.opacity += Math.sign(diff) * (dt / 300)
      this.opacity = Math.max(0, Math.min(1, this.opacity))
    }
    this.canvas.style.opacity = String(this.opacity)
    const ctx = this.ctx
    if (this.opacity <= 0.01) {
      ctx.clearRect(0, 0, this.w, this.h)
      this.streaks = []
      return
    }

    if (this.reduced) {
      this.renderStipple(dt, intensity, ctx)
      return
    }

    ctx.clearRect(0, 0, this.w, this.h)

    if (this.target > 0) {
      const count = Math.round(intensity * 200 * (dt / 1000))
      for (let i = 0; i < count; i++) this.spawn()
    }

    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    const slant = 0.17
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i]
      s.y += s.speed * (dt / 1000)
      if (s.y > this.h + s.len) {
        this.streaks.splice(i, 1)
        continue
      }
      ctx.strokeStyle = s.far ? this.far : this.near
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x - s.len * slant, s.y + s.len)
      ctx.stroke()
    }
  }

  private spawn(): void {
    const far = Math.random() < 0.5
    const len = far ? 8 : 12
    const base = far ? 420 : 640
    this.streaks.push({
      x: Math.random() * this.w,
      y: -len - Math.random() * this.h * 0.25,
      len,
      speed: base * (0.7 + Math.random() * 0.6),
      far,
    })
  }

  private renderStipple(dt: number, intensity: number): void {
    this.stippleAcc += dt
    if (this.stippleAcc < 1000) return
    this.stippleAcc = 0
    const bucket = Math.floor(performance.now() / 1000)
    if (bucket === this.lastBucket) return
    this.lastBucket = bucket
    const ctx = this.ctx
    const count = Math.round(intensity * 420)
    ctx.fillStyle = this.far
    for (let i = 0; i < count; i++) {
      ctx.fillRect(Math.random() * this.w, Math.random() * this.h, 1, 1)
    }
  }
}