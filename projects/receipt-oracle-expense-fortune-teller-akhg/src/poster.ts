// poster.ts — render the current reading as a downloadable PNG augury poster.

import type { Reading } from './oracle'
import { moneyWhole } from './oracle'

const W = 1080
const H = 1440

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word
    if (ctx.measureText(candidate).width > maxWidth) {
      if (!line) {
        // a single word wider than the column — hard-break it by characters
        let chunk = ''
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk)
            chunk = ch
          } else {
            chunk += ch
          }
        }
        if (chunk) lines.push(chunk)
      } else {
        lines.push(line)
        line = word
      }
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function downloadPoster(reading: Reading, awakened: boolean): void {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const draw = () => {
    // backdrop — warm soot with a candle halo
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#120D07')
    bg.addColorStop(0.5, '#0C0906')
    bg.addColorStop(1, '#0A0805')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const halo = ctx.createRadialGradient(W * 0.5, -140, 40, W * 0.5, -140, 620)
    halo.addColorStop(0, 'rgba(229,164,68,0.20)')
    halo.addColorStop(1, 'rgba(229,164,68,0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, W, H)

    // frame + wax rule
    ctx.strokeStyle = 'rgba(154,138,105,0.4)'
    ctx.lineWidth = 2
    rrect(ctx, 40, 40, W - 80, H - 80, 26)
    ctx.stroke()

    const accent = awakened ? '#7FDCC0' : '#E5A444'
    const muted = '#9A8A69'
    const bone = '#F0E4C8'

    const cx = W / 2

    ctx.textAlign = 'center'
    ctx.fillStyle = muted
    ctx.font = '600 20px Georgia, serif'
    ctx.fillText('ᛟ · THE RECEIPT ORACLE · ᛟ', cx, 108)

    ctx.fillStyle = bone
    ctx.font = '900 108px "Grenze Gotisch", "UnifrakturMaguntia", Georgia, serif'
    ctx.fillText('A U G U R Y', cx, 232)

    ctx.fillStyle = accent
    ctx.font = '900 64px "Grenze Gotisch", Georgia, serif'
    const totalTxt = moneyWhole(reading.total)
    ctx.fillText(totalTxt, cx, 336)

    ctx.fillStyle = muted
    ctx.font = '600 22px Georgia, serif'
    const label = `${reading.count} offering${reading.count === 1 ? '' : 's'} laid before the desk`
    ctx.fillText(label, cx, 386)

    // divider
    ctx.strokeStyle = 'rgba(229,164,68,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(W * 0.18, 424)
    ctx.lineTo(W * 0.82, 424)
    ctx.stroke()

    // tallies
    ctx.textAlign = 'left'
    const barX = 130
    const barW = W - 260
    const n = Math.min(reading.tallies.length, 5)
    let y = 500
    const rowH = 58
    for (let i = 0; i < n; i++) {
      const t = reading.tallies[i]!
      ctx.fillStyle = bone
      ctx.font = '700 26px Georgia, serif'
      ctx.fillText(t.meta.label, barX, y)
      ctx.fillStyle = muted
      ctx.font = '700 24px Georgia, serif'
      ctx.textAlign = 'right'
      ctx.fillText(moneyWhole(t.sum), W - 130, y)
      ctx.textAlign = 'left'
      y += 22
      ctx.fillStyle = 'rgba(154,138,105,0.18)'
      ctx.fillRect(barX, y, barW, 14)
      const seg = barW * Math.max(0.03, t.share)
      ctx.fillStyle = t.meta.color
      ctx.fillRect(barX, y, seg, 14)
      y += 18 + 24
    }

    // verdict
    y = 500 + rowH * Math.max(n, 2) + 14
    ctx.fillStyle = accent
    ctx.font = '900 46px "Grenze Gotisch", Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillText('✦ ' + reading.verdict.title.toUpperCase(), barX, y)
    y += 58
    ctx.fillStyle = bone
    ctx.font = 'italic 30px Georgia, serif'
    const bottomLimit = H - 190
    for (const line of reading.verdict.lines) {
      if (y > bottomLimit - 30) break
      const wrapped = wrap(ctx, line, barW)
      for (const wl of wrapped) {
        if (y > bottomLimit) break
        ctx.fillText(wl, barX, y)
        y += 44
      }
    }
    if (awakened && reading.awakenedEcho) {
      ctx.fillStyle = '#7FDCC0'
      ctx.font = 'italic 30px Georgia, serif'
      y += 14
      if (y <= bottomLimit) {
        for (const wl of wrap(ctx, reading.awakenedEcho, barW)) {
          if (y > bottomLimit) break
          ctx.fillText(wl, barX, y)
          y += 44
        }
      }
    }

    // footer
    ctx.textAlign = 'center'
    ctx.fillStyle = muted
    ctx.font = '600 20px Georgia, serif'
    const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    ctx.fillText(`Sealed on ${d} · read again and the omens may differ`, cx, H - 92)
    ctx.fillStyle = 'rgba(86,201,163,0.7)'
    ctx.fillText('ᛉ', cx, H - 58)

    const a = document.createElement('a')
    a.download = `receipt-oracle-augury-${Date.now()}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(draw).catch(draw)
  } else {
    draw()
  }
}
