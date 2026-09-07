import type { Item } from './items'
import { RARITY, typeOf } from './items'
import { SLOTS } from './board'
import { CELL, GAP, COLS, ROWS, gridHeight, gridWidth, centerOf } from './board'

export interface SerialState {
  seed: number
  slots: Record<string, string | null>
  tray: string[]
  items: Record<string, Item>
}

export const STORE_KEY = 'pocket-inventory:v1'
export const HASH_PREFIX = '#pocket='

export function encodeState(state: SerialState): string {
  return encodeURIComponent(JSON.stringify(state))
}

export function decodeState(raw: string): SerialState | null {
  try {
    const json = decodeURIComponent(raw)
    const parsed = JSON.parse(json) as SerialState
    if (
      typeof parsed.seed !== 'number' ||
      !parsed.slots ||
      !Array.isArray(parsed.tray) ||
      !parsed.items
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function stateFromHash(): SerialState | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  return decodeState(hash.slice(HASH_PREFIX.length))
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try {
      document.execCommand('copy')
      resolve()
    } catch (e) {
      reject(e)
    } finally {
      document.body.removeChild(ta)
    }
  })
}

export function shareUrl(state: SerialState): string {
  const base = window.location.href.split('#')[0]
  return `${base}#pocket=${encodeState(state)}`
}

export interface SnapshotMeta {
  haul: number
  capacity: number
  value: number
  seed: number
}

export function snapshotToDataURL(
  slots: Record<string, string | null>,
  items: Record<string, Item>,
  meta: SnapshotMeta,
): string {
  const PAD = 30
  const TITLE_H = 96
  const w = PAD * 2 + gridWidth()
  const h = TITLE_H + PAD * 2 + gridHeight()

  const canvas = document.createElement('canvas')
  canvas.width = w * 2
  canvas.height = h * 2
  const c = canvas.getContext('2d')
  if (!c) return ''

  c.scale(2, 2)

  const loam = '#121A10'
  const loam2 = '#0C120B'
  const gill = '#24331E'
  const membrane = '#E9DDC4'

  const bg = c.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, loam)
  bg.addColorStop(1, loam2)
  c.fillStyle = bg
  roundRect(c, 0, 0, w, h, 26)
  c.fill()

  const bloom = c.createRadialGradient(w * 0.8, 0, 0, w * 0.8, 0, w * 0.7)
  bloom.addColorStop(0, 'rgba(70,229,174,0.10)')
  bloom.addColorStop(1, 'rgba(70,229,174,0)')
  c.fillStyle = bloom
  roundRect(c, 0, 0, w, h, 26)
  c.fill()

  c.textBaseline = 'middle'
  c.fillStyle = membrane
  c.font = '600 30px Karla, system-ui, sans-serif'
  c.fillText('Pocket Inventory', PAD, 42)
  c.fillStyle = 'rgba(233,221,196,0.55)'
  c.font = '500 15px Karla, system-ui, sans-serif'
  c.fillText(
    `${meta.haul}/${meta.capacity} hauled · value ${meta.value} · seed ${meta.seed}`,
    PAD,
    72,
  )

  const ox = PAD
  const oy = TITLE_H + PAD
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      c.fillStyle = gill
      roundRect(c, ox + col * (CELL + GAP), oy + row * (CELL + GAP), CELL, CELL, 12)
      c.fill()
      c.fillStyle = 'rgba(70,229,174,0.05)'
      roundRect(c, ox + col * (CELL + GAP), oy + row * (CELL + GAP), CELL, CELL, 12)
      c.fill()
    }
  }

  for (const slot of SLOTS) {
    const occupied = slots[slot.id]
    const item = occupied ? items[occupied] : null
    if (!item) continue
    const center = centerOf(slot)
    const cx = ox + center.x
    const cy = oy + center.y
    const color = RARITY[item.rarity].color

    const r = Math.min(slot.w, slot.h) * CELL * 0.34 + 4
    c.shadowColor = color
    c.shadowBlur = 16
    c.strokeStyle = color
    c.lineWidth = 2.5
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.stroke()
    c.shadowBlur = 0

    c.font = '44px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
    c.textAlign = 'center'
    c.fillText(typeOf(item).emoji, cx, cy + 2)

    c.fillStyle = color
    c.font = '700 11px Karla, system-ui, sans-serif'
    c.fillText(RARITY[item.rarity].label, cx, cy + r + 14)
  }

  c.strokeStyle = 'rgba(70,229,174,0.35)'
  c.lineWidth = 1.5
  roundRect(c, ox - 6, oy - 6, gridWidth() + 12, gridHeight() + 12, 18)
  c.stroke()

  return canvas.toDataURL('image/png')
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}