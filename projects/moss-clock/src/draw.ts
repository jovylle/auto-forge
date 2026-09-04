import { C } from './theme'
import type { SimState } from './sim'

const TAU = Math.PI * 2

function hs(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function easeOutBack(p: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}

const TINTS: readonly [string, string, string][] = [
  [C.moss900, C.moss700, C.moss500],
  [C.moss700, C.moss500, C.moss300],
  [C.moss500, C.moss300, C.moss200],
]

const SPRITE_R = 64

function makeSprite(t: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SPRITE_R * 2
  const g = cv.getContext('2d')
  if (!g) return cv
  const [c0, c1, c2] = TINTS[t]!
  const cx = SPRITE_R
  const cy = SPRITE_R

  const core = g.createRadialGradient(cx, cy, 0, cx, cy, SPRITE_R)
  core.addColorStop(0, c0)
  core.addColorStop(0.55, c1)
  core.addColorStop(0.85, c2)
  core.addColorStop(1, `${c2}00`)
  g.fillStyle = core
  g.beginPath()
  g.arc(cx, cy, SPRITE_R, 0, TAU)
  g.fill()

  for (let k = 0; k < 3; k++) {
    const a = hs(t * 3 + k, 5) * TAU
    const d = hs(t * 7 + k, 6) * SPRITE_R * 0.5
    const rr = SPRITE_R * (0.25 + hs(t * 11 + k, 10) * 0.35)
    const jx = cx + Math.cos(a) * d
    const jy = cy + Math.sin(a) * d
    const jg = g.createRadialGradient(jx, jy, 0, jx, jy, rr)
    jg.addColorStop(0, c1)
    jg.addColorStop(1, `${c1}00`)
    g.fillStyle = jg
    g.globalAlpha = 0.5
    g.beginPath()
    g.arc(jx, jy, rr, 0, TAU)
    g.fill()
    g.globalAlpha = 1
  }

  for (let k = 0; k < 5; k++) {
    const a = hs(t * 13 + k, 12) * TAU
    const d = hs(t * 17 + k, 13) * SPRITE_R * 0.7
    const sx = cx + Math.cos(a) * d
    const sy = cy + Math.sin(a) * d
    g.fillStyle = hs(t * 19 + k, 14) > 0.5 ? C.moss100 : C.moss900
    g.globalAlpha = 0.35 + 0.3 * hs(t * 23 + k, 15)
    g.beginPath()
    g.arc(sx, sy, 0.5 + hs(t * 29 + k, 16) * 1.5, 0, TAU)
    g.fill()
    g.globalAlpha = 1
  }

  return cv
}

const sprites = [makeSprite(0), makeSprite(1), makeSprite(2)]

let bgCache: HTMLCanvasElement | null = null
let bgKey = ''

function background(w: number, h: number): HTMLCanvasElement {
  const key = `${Math.round(w)}x${Math.round(h)}`
  if (bgCache && bgKey === key) return bgCache
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(w))
  cv.height = Math.max(1, Math.round(h))
  const g = cv.getContext('2d')
  if (g) {
    const g0 = g.createLinearGradient(0, 0, 0, h)
    g0.addColorStop(0, C.creteSlab)
    g0.addColorStop(1, C.creteBase)
    g.fillStyle = g0
    g.fillRect(0, 0, w, h)

    for (let i = 0; i < 3; i++) {
      const x = hs(i, 1) * w
      const y = hs(i, 2) * h
      const r = (0.18 + hs(i, 3) * 0.24) * Math.min(w, h)
      const gs = g.createRadialGradient(x, y, 0, x, y, r)
      gs.addColorStop(0, 'rgba(22,19,12,0.30)')
      gs.addColorStop(1, 'rgba(22,19,12,0)')
      g.fillStyle = gs
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }

    for (let i = 0; i < 140; i++) {
      const x = hs(i, 7) * w
      const y = hs(i, 8) * h
      g.fillStyle = hs(i, 9) > 0.5 ? 'rgba(230,225,206,0.05)' : 'rgba(0,0,0,0.14)'
      g.fillRect(x, y, 1.2, 1.2)
    }
  }
  bgCache = cv
  bgKey = key
  return cv
}

export interface MossFrame {
  dpr: number
  width: number
  height: number
}

export function drawMoss(ctx: CanvasRenderingContext2D, frame: MossFrame, sim: SimState, now: number): void {
  const { dpr, width: W, height: H } = frame
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.drawImage(background(W, H), 0, 0, W, H)

  const moss = sim.moss
  const lush = moss.lushness / 100
  const minDim = Math.min(W, H)
  const breathe = 1 + 0.012 * Math.sin((now / 8000) * TAU)

  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(breathe, breathe)
  ctx.translate(-W / 2, -H / 2)

  const seeds = moss.seeds
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]
    if (!s) continue
    const cx = s.x * W
    const cy = s.y * H
    const age = now - s.born
    let gs = 1
    if (age < 2400) gs = easeOutBack(Math.min(1, age / 2400))
    const R = Math.max(1.5, s.r * minDim * gs)
    ctx.drawImage(sprites[s.t] ?? sprites[0]!, cx - R, cy - R, R * 2, R * 2)

    if (lush > 0.2 && hs(i, 24) < 0.3 + lush * 0.5) {
      const a = hs(i + 100, 17) * TAU
      const len = R * (0.6 + hs(i, 18) * 1.1)
      const tipx = cx + Math.cos(a) * len
      const tipy = cy + Math.sin(a) * len
      const mx = cx + Math.cos(a + 0.35) * len * 0.5
      const my = cy + Math.sin(a + 0.4) * len * 0.5
      ctx.strokeStyle = hs(i, 19) > 0.5 ? C.moss100 : C.moss200
      ctx.globalAlpha = 0.25 + 0.4 * lush
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.quadraticCurveTo(mx, my, tipx, tipy)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    if (lush > 0.65 && hs(i, 26) < (lush - 0.65) * 1.6) {
      const a = hs(i + 200, 20) * TAU
      const d = hs(i, 21) * R * 0.6
      ctx.fillStyle = C.bone
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.6 + hs(i, 22) * 0.8, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()

  const disturbed = sim.still.score < 30
  if (disturbed) {
    ctx.fillStyle = 'rgba(14,17,11,0.30)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(232,64,28,0.05)'
    ctx.fillRect(0, 0, W, H)
  }
}