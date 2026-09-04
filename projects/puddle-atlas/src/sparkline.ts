import { hexToRgba } from './weather'

const W = 160
const H = 32
const MAX = 60

export class Sparkline {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private samples: number[] = []
  private acc = 0
  private storm: string
  private hairline: string

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    const root = getComputedStyle(document.documentElement)
    const storm = root.getPropertyValue('--color-storm').trim() || '#46545e'
    const hair = root.getPropertyValue('--color-hairline').trim() || '#dad5c3'
    this.storm = hexToRgba(storm, 1)
    this.hairline = hexToRgba(hair, 1)
  }

  resize(dpr: number): void {
    this.canvas.width = W * dpr
    this.canvas.height = H * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.draw()
  }

  frame(dt: number, intensity: number): void {
    this.acc += dt
    if (this.acc < 2000) return
    this.acc = 0
    this.samples.push(intensity)
    if (this.samples.length > MAX) this.samples.shift()
    this.draw()
  }

  private draw(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle = this.hairline
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, H - 1)
    ctx.lineTo(W, H - 1)
    ctx.stroke()

    const n = this.samples.length
    if (n === 0) return
    const stepX = W / MAX
    ctx.strokeStyle = this.storm
    ctx.lineWidth = 1.5
    ctx.beginPath()
    let prevY = H - 1 - this.samples[0] * (H - 4)
    ctx.moveTo(0, prevY)
    for (let i = 0; i < n; i++) {
      const x = W - (n - i) * stepX
      const y = H - 1 - this.samples[i] * (H - 4)
      ctx.lineTo(x, prevY)
      ctx.lineTo(x, y)
      prevY = y
    }
    ctx.stroke()
  }
}