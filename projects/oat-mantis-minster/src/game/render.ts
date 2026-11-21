// Canvas renderer: shrine shaft, oats, chrome mantis, cut beam. Pure drawing.

import { CUT, type Game } from './engine'

export type SparkColor = 'gold' | 'red' | 'cyan'

export interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: SparkColor
  size: number
}

export interface View {
  flare: number
  shake: number
  open: number
  sparks: Spark[]
  time: number
}

const NEON = '#FF2E9A'
const CYAN = '#2BE8E0'
const OAT = '#F2C14E'
const PLUM = '#6E5C7A'

export function render(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game, v: View) {
  ctx.clearRect(0, 0, w, h)

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0b0710')
  bg.addColorStop(0.55, '#150c1f')
  bg.addColorStop(1, '#1d0f28')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const shake = v.shake > 0 ? Math.sin(v.time * 90) * v.shake * 10 : 0
  ctx.save()
  ctx.translate(shake, 0)

  drawShaft(ctx, w, h)
  drawTorii(ctx, w, h, v.time)
  drawRain(ctx, w, h, v.time)
  drawCutLine(ctx, w, h, g, v)
  for (const o of g.oats) drawOat(ctx, w, h, o.x, o.y, o.rot)
  drawMantis(ctx, w, h, g, v)
  drawSparks(ctx, w, h, v.sparks)

  ctx.restore()
  drawVignette(ctx, w, h)
}

function drawShaft(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // temple shaft edges
  ctx.strokeStyle = 'rgba(110,92,122,0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([2, 6])
  for (const x of [w * 0.1, w * 0.9]) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // upper shrine beams
  ctx.strokeStyle = 'rgba(43,232,224,0.12)'
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const y = (h * 0.12 * i) / 4
    ctx.beginPath()
    ctx.moveTo(w * 0.12, y)
    ctx.lineTo(w * 0.88, y)
    ctx.stroke()
  }

  // floor grid in perspective
  const horizon = h * 0.74
  ctx.strokeStyle = 'rgba(255,46,154,0.10)'
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    ctx.beginPath()
    ctx.moveTo(w * 0.5 + (t - 0.5) * w * 0.16, horizon)
    ctx.lineTo(w * 0.5 + (t - 0.5) * w * 1.7, h)
    ctx.stroke()
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 5
    const y = horizon + (h - horizon) * t * t
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

function drawTorii(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const cx = w * 0.5
  const top = h * 0.16
  const side = w * 0.24
  const bottom = h * 0.62
  const glow = 0.16 + Math.sin(time * 0.8) * 0.05

  ctx.save()
  ctx.strokeStyle = `rgba(255,46,154,${glow})`
  ctx.lineWidth = Math.max(2, w * 0.008)
  ctx.shadowColor = 'rgba(255,46,154,0.5)'
  ctx.shadowBlur = 18

  // posts
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * side * 0.82, top + h * 0.02)
    ctx.lineTo(cx + s * side, bottom)
    ctx.stroke()
  }
  // top lintel (slight upward curve)
  ctx.beginPath()
  ctx.moveTo(cx - side * 1.2, top)
  ctx.quadraticCurveTo(cx, top - h * 0.035, cx + side * 1.2, top)
  ctx.stroke()
  // second beam
  ctx.beginPath()
  ctx.moveTo(cx - side * 0.95, top + h * 0.05)
  ctx.lineTo(cx + side * 0.95, top + h * 0.05)
  ctx.stroke()
  // gate plaque
  ctx.shadowBlur = 10
  ctx.strokeStyle = `rgba(43,232,224,${glow + 0.14})`
  ctx.lineWidth = 1
  ctx.strokeRect(cx - w * 0.035, top + h * 0.058, w * 0.07, h * 0.07)
  ctx.fillStyle = `rgba(43,232,224,${glow + 0.2})`
  ctx.font = `${Math.max(10, w * 0.03)}px "Zen Kaku Gothic New", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('麦', cx, top + h * 0.093)
  ctx.restore()
}

function drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(43,232,224,0.14)'
  ctx.lineWidth = 1
  for (let i = 0; i < 26; i++) {
    const seed = (i * 0.618) % 1
    const speed = 0.12 + seed * 0.2
    const y = ((i * 0.37 + time * speed) % 1) * h
    const x = ((i * 0.271 + 0.05) % 1) * w
    const len = 6 + seed * 16
    ctx.globalAlpha = 0.25 + seed * 0.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 3, y + len)
    ctx.stroke()
  }
  ctx.restore()
}

function drawCutLine(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game, v: View) {
  const y = h * CUT
  const pulse = 0.5 + Math.sin(v.time * 3.2) * 0.18
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, 'rgba(255,46,154,0)')
  grad.addColorStop(0.15, 'rgba(255,46,154,0.5)')
  grad.addColorStop(0.5, 'rgba(255,80,180,0.95)')
  grad.addColorStop(0.85, 'rgba(255,46,154,0.5)')
  grad.addColorStop(1, 'rgba(255,46,154,0)')

  ctx.save()
  ctx.shadowColor = NEON
  ctx.shadowBlur = 26
  ctx.globalAlpha = pulse
  ctx.strokeStyle = grad
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()

  // tick marks
  ctx.globalAlpha = 0.35
  ctx.shadowBlur = 0
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 1
  const gap = Math.max(28, w / 12)
  for (let x = gap; x < w; x += gap) {
    const tall = x > w * 0.3 && x < w * 0.7
    ctx.beginPath()
    ctx.moveTo(x, y - (tall ? 6 : 3))
    ctx.lineTo(x, y + (tall ? 6 : 3))
    ctx.stroke()
  }

  // strike flare
  if (v.flare > 0) {
    ctx.globalAlpha = Math.min(1, v.flare)
    ctx.shadowColor = OAT
    ctx.shadowBlur = 40
    const fg = ctx.createLinearGradient(0, 0, w, 0)
    fg.addColorStop(0, 'rgba(242,193,78,0)')
    fg.addColorStop(0.5, 'rgba(255,236,190,0.95)')
    fg.addColorStop(1, 'rgba(242,193,78,0)')
    ctx.fillStyle = fg
    ctx.fillRect(0, y - 1 - v.flare * 3, w, 2 + v.flare * 6)

    // slash wedge
    ctx.globalAlpha = v.flare * 0.6
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.moveTo(w * 0.5 - w * 0.4 * v.flare, y - 2)
    ctx.lineTo(w * 0.5 + w * 0.4 * v.flare, y - 4)
    ctx.lineTo(w * 0.5 + w * 0.36 * v.flare, y + 1)
    ctx.lineTo(w * 0.5 - w * 0.36 * v.flare, y + 3)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // live oat hint: ring on the nearest candidate
  let near: { x: number; y: number; d: number } | null = null
  for (const o of g.oats) {
    const d = Math.abs(o.y - CUT)
    if (!near || d < near.d) near = { x: o.x, y: o.y, d }
  }
  if (near && near.d < 0.14) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, 0.55 - near.d * 3)
    ctx.strokeStyle = CYAN
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(near.x * w, y, 18 + near.d * 240, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawOat(ctx: CanvasRenderingContext2D, w: number, h: number, nx: number, ny: number, rot: number) {
  const s = Math.min(w, h) / 420
  const x = nx * w
  const y = ny * h
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.shadowColor = 'rgba(242,193,78,0.85)'
  ctx.shadowBlur = 14 * s
  const g = ctx.createLinearGradient(-6 * s, -12 * s, 6 * s, 12 * s)
  g.addColorStop(0, '#fff2c8')
  g.addColorStop(0.45, OAT)
  g.addColorStop(1, '#a8791c')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, 6 * s, 13 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  // grain seam
  ctx.strokeStyle = 'rgba(90,60,10,0.6)'
  ctx.lineWidth = 1 * s
  ctx.beginPath()
  ctx.moveTo(0, -12 * s)
  ctx.lineTo(0, 12 * s)
  ctx.stroke()
  // bristle
  ctx.strokeStyle = 'rgba(255,242,200,0.8)'
  ctx.beginPath()
  ctx.moveTo(0, -13 * s)
  ctx.lineTo(2 * s, -20 * s)
  ctx.stroke()
  ctx.restore()
}

function drawMantis(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game, v: View) {
  const s = Math.min(w, h) / 420
  const cx = w * 0.5
  const baseY = h * 0.96
  const open = v.open

  ctx.save()
  ctx.translate(cx, baseY)

  // halo
  ctx.save()
  ctx.rotate(v.time * 0.25)
  ctx.strokeStyle = 'rgba(43,232,224,0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 9])
  ctx.beginPath()
  ctx.arc(0, -96 * s, 46 * s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // shadow pool
  const pool = ctx.createRadialGradient(0, -4 * s, 0, 0, -4 * s, 70 * s)
  pool.addColorStop(0, 'rgba(255,46,154,0.22)')
  pool.addColorStop(1, 'rgba(255,46,154,0)')
  ctx.fillStyle = pool
  ctx.beginPath()
  ctx.ellipse(0, -2 * s, 70 * s, 16 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = 'rgba(255,46,154,0.7)'
  ctx.shadowBlur = 16 * s

  // abdomen
  const body = ctx.createLinearGradient(0, -70 * s, 0, 0)
  body.addColorStop(0, '#43275c')
  body.addColorStop(1, '#120a1c')
  ctx.fillStyle = body
  ctx.strokeStyle = NEON
  ctx.lineWidth = 1.6 * s
  ctx.beginPath()
  ctx.moveTo(-11 * s, -62 * s)
  ctx.quadraticCurveTo(-30 * s, -26 * s, -16 * s, -2 * s)
  ctx.quadraticCurveTo(0, 5 * s, 16 * s, -2 * s)
  ctx.quadraticCurveTo(30 * s, -26 * s, 11 * s, -62 * s)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // thorax
  ctx.fillStyle = '#1b1029'
  ctx.beginPath()
  ctx.moveTo(-9 * s, -60 * s)
  ctx.lineTo(-7 * s, -80 * s)
  ctx.lineTo(7 * s, -80 * s)
  ctx.lineTo(9 * s, -60 * s)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // gold sash
  ctx.strokeStyle = OAT
  ctx.lineWidth = 2 * s
  ctx.shadowColor = 'rgba(242,193,78,0.8)'
  ctx.beginPath()
  ctx.moveTo(-13 * s, -54 * s)
  ctx.lineTo(13 * s, -58 * s)
  ctx.stroke()

  // legs
  ctx.strokeStyle = 'rgba(255,46,154,0.85)'
  ctx.shadowColor = 'rgba(255,46,154,0.7)'
  ctx.lineWidth = 2 * s
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 8 * s, -18 * s)
    ctx.lineTo(side * 20 * s, 6 * s)
    ctx.lineTo(side * 26 * s, 26 * s)
    ctx.stroke()
  }

  // forelegs: folded in prayer, snap open on a snip
  ctx.strokeStyle = NEON
  ctx.lineWidth = 2.6 * s
  for (const side of [-1, 1]) {
    const spread = open * 26
    ctx.beginPath()
    ctx.moveTo(side * 6 * s, -76 * s)
    ctx.lineTo(side * (34 + spread) * s, -52 * s)
    ctx.lineTo(side * (18 + spread * 0.4) * s, -96 * s)
    ctx.stroke()
  }

  // head
  ctx.shadowColor = 'rgba(43,232,224,0.6)'
  ctx.fillStyle = '#170d24'
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 1.6 * s
  ctx.beginPath()
  ctx.moveTo(0, -112 * s)
  ctx.lineTo(-15 * s, -88 * s)
  ctx.lineTo(0, -80 * s)
  ctx.lineTo(15 * s, -88 * s)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // eyes
  for (const side of [-1, 1]) {
    ctx.fillStyle = side < 0 ? NEON : CYAN
    ctx.shadowColor = side < 0 ? NEON : CYAN
    ctx.shadowBlur = 14 * s
    ctx.beginPath()
    ctx.ellipse(side * 7 * s, -95 * s, 4.6 * s, 3.4 * s, side * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // antennae
  ctx.strokeStyle = 'rgba(43,232,224,0.6)'
  ctx.lineWidth = 1 * s
  ctx.shadowBlur = 6 * s
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 6 * s, -110 * s)
    ctx.quadraticCurveTo(side * 26 * s, -132 * s, side * 40 * s, -120 * s)
    ctx.stroke()
  }

  // damage read-out: lives as notches
  ctx.shadowBlur = 0
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < g.lives ? 0.9 : 0.18
    ctx.fillStyle = i < g.lives ? OAT : PLUM
    ctx.fillRect((-15 + i * 12) * s, -34 * s, 6 * s, 2 * s)
  }
  ctx.restore()
}

function drawSparks(ctx: CanvasRenderingContext2D, w: number, h: number, sparks: Spark[]) {
  ctx.save()
  for (const p of sparks) {
    const a = Math.max(0, p.life / p.max)
    const color = p.color === 'gold' ? OAT : p.color === 'red' ? '#FF3B3B' : CYAN
    ctx.globalAlpha = a
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, p.size * (0.4 + a), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const v = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.85)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(5,3,9,0.75)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}
