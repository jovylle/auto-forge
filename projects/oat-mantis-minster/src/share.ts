// Share text, challenge-link parsing and the downloadable ofuda (talisman) card.

export type Rank = 'S' | 'A' | 'B' | 'C'

export const HAIKU: Record<Rank, [string, string, string]> = {
  S: ['neon sutras hum', 'chrome mantis bows to the grain', 'oats fall like soft code'],
  A: ['red seal, quiet wire', 'the chrome jaw drinks down the rain', 'one grain, one more dawn'],
  B: ['temple fans spin low', 'three bells close the paper gate', 'grain sleeps in the wire'],
  C: ['neon sutras hum', 'three bells close the paper gate', 'grain sleeps in the wire'],
}

export function haikuFor(rank: Rank) {
  return HAIKU[rank]
}

export interface RunResult {
  score: number
  rank: Rank
  bestCombo: number
  sutras: number
  perfects: number
  misses: number
}

export function shareText(r: RunResult) {
  const line = [HAIKU[r.rank][0], HAIKU[r.rank][1], HAIKU[r.rank][2]].join(' / ')
  return `麦截 OAT MANTIS MINSTER — ${r.score} pt · rank ${r.rank} · chain ×${r.bestCombo}\n${line}\nbeat it: ${challengeUrl(r.score, r.rank)}`
}

export function challengeUrl(score: number, rank: Rank) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#m=${score}&r=${rank}`
}

/** score from a shared link, e.g. #m=812&r=A */
export function readChallenge(): number | null {
  const m = /[#&]m=(\d{1,6})/.exec(window.location.hash)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const W = 1080
const H = 1350

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number) {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width + gap)
  const total = widths.reduce((a, b) => a + b, 0) - gap
  let cur = x - total / 2
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, cur, y)
    cur += widths[i]
  })
  ctx.textAlign = 'center'
}

/** Draws the 1080x1350 ofuda and returns a PNG blob (null if the canvas is unavailable). */
export async function buildOfuda(r: RunResult): Promise<Blob | null> {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null

  const ink = '#0b0710'
  const neon = '#ff2e9a'
  const cyan = '#2be8e0'
  const gold = '#f2c14e'
  const paper = '#f4e9dc'
  const plum = '#6e5c7a'

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#140b1e')
  bg.addColorStop(0.55, ink)
  bg.addColorStop(1, '#1b0e26')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // grid
  ctx.strokeStyle = 'rgba(110,92,122,0.16)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // big vertical kanji watermark
  ctx.save()
  ctx.globalAlpha = 0.1
  ctx.fillStyle = cyan
  ctx.font = '900 260px "Zen Kaku Gothic New", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('麦', W - 180, 300)
  ctx.fillText('截', W - 180, 570)
  ctx.restore()

  // frame
  ctx.strokeStyle = neon
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, W - 96, H - 96)
  ctx.strokeStyle = 'rgba(242,193,78,0.7)'
  ctx.lineWidth = 5
  const corner = 46
  const pts: [number, number, number, number][] = [
    [48, 48, 1, 1],
    [W - 48, 48, -1, 1],
    [48, H - 48, 1, -1],
    [W - 48, H - 48, -1, -1],
  ]
  for (const [x, y, sx, sy] of pts) {
    ctx.beginPath()
    ctx.moveTo(x + sx * corner, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + sy * corner)
    ctx.stroke()
  }

  // header
  ctx.fillStyle = gold
  ctx.font = '400 20px "Space Mono", monospace'
  spaced(ctx, 'RITUAL No.3 · 三十秒', W / 2, 150, 1)

  ctx.fillStyle = paper
  ctx.font = '700 54px "Chakra Petch", sans-serif'
  spaced(ctx, 'OAT MANTIS MINSTER', W / 2, 225, 3)

  ctx.fillStyle = cyan
  ctx.font = '700 30px "Zen Kaku Gothic New", sans-serif'
  ctx.fillText('麦 を 截 れ', W / 2, 285)

  // score
  ctx.fillStyle = plum
  ctx.font = '400 24px "Space Mono", monospace'
  spaced(ctx, 'SCORE 点', W / 2, 430, 2)

  ctx.save()
  ctx.shadowColor = 'rgba(242,193,78,0.55)'
  ctx.shadowBlur = 40
  ctx.fillStyle = gold
  ctx.font = '700 190px "Space Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(String(r.score), W / 2, 600)
  ctx.restore()

  // rank seal
  const sx = W / 2
  const sy = 775
  ctx.save()
  ctx.strokeStyle = neon
  ctx.lineWidth = 3
  ctx.shadowColor = neon
  ctx.shadowBlur = 26
  ctx.beginPath()
  ctx.arc(sx, sy, 78, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(43,232,224,0.55)'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 7])
  ctx.beginPath()
  ctx.arc(sx, sy, 64, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = cyan
  ctx.font = '700 20px "Zen Kaku Gothic New", sans-serif'
  ctx.fillText('位', sx, sy - 82)
  ctx.fillStyle = paper
  ctx.font = '700 96px "Space Mono", monospace'
  ctx.fillText(r.rank, sx, sy + 6)
  ctx.restore()

  // stat row
  const cells: [string, string][] = [
    ['CHAIN 連', `×${r.bestCombo}`],
    ['SUTRA 経', String(r.sutras)],
    ['PERFECT 完', String(r.perfects)],
  ]
  const cellW = 260
  const startX = W / 2 - cellW
  cells.forEach(([k, v], i) => {
    const x = startX + i * cellW + cellW / 2
    ctx.fillStyle = plum
    ctx.font = '400 18px "Space Mono", monospace'
    ctx.fillText(k, x, 935)
    ctx.fillStyle = paper
    ctx.font = '700 42px "Space Mono", monospace'
    ctx.fillText(v, x, 985)
    if (i > 0) {
      ctx.strokeStyle = 'rgba(110,92,122,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - cellW / 2, 910)
      ctx.lineTo(x - cellW / 2, 995)
      ctx.stroke()
    }
  })

  // haiku
  ctx.fillStyle = 'rgba(244,233,220,0.92)'
  ctx.font = '400 34px "Space Mono", monospace'
  haikuFor(r.rank).forEach((line, i) => {
    ctx.fillText(line, W / 2, 1085 + i * 48)
  })

  // footer
  ctx.strokeStyle = 'rgba(255,46,154,0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(150, 1235)
  ctx.lineTo(W - 150, 1235)
  ctx.stroke()
  ctx.fillStyle = plum
  ctx.font = '400 18px "Space Mono", monospace'
  spaced(ctx, '三十秒の儀 · 30 SECOND RITUAL · WEBAUDIO', W / 2, 1272, 1)
  ctx.fillStyle = 'rgba(43,232,224,0.65)'
  ctx.font = '400 16px "Space Mono", monospace'
  ctx.fillText(challengeUrl(r.score, r.rank).replace(/^https?:\/\//, ''), W / 2, 1302)

  return await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
}
