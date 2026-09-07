export interface Slot {
  id: string
  col: number
  row: number
  w: number
  h: number
  label: string
}

export const COLS = 6
export const ROWS = 5
export const CELL = 56
export const GAP = 10

export const SLOTS: Slot[] = [
  { id: 'stomach', col: 0, row: 0, w: 2, h: 2, label: 'Stomach' },
  { id: 'pore-a', col: 2, row: 0, w: 1, h: 1, label: 'Pore' },
  { id: 'intestine', col: 3, row: 0, w: 1, h: 2, label: 'Intestine' },
  { id: 'pore-b', col: 4, row: 0, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-c', col: 5, row: 0, w: 1, h: 1, label: 'Pore' },
  { id: 'gizzard', col: 0, row: 2, w: 2, h: 1, label: 'Gizzard' },
  { id: 'pore-d', col: 2, row: 2, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-e', col: 3, row: 2, w: 1, h: 1, label: 'Pore' },
  { id: 'vena', col: 4, row: 2, w: 1, h: 2, label: 'Vena' },
  { id: 'pore-f', col: 1, row: 3, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-g', col: 2, row: 3, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-h', col: 3, row: 3, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-i', col: 5, row: 3, w: 1, h: 1, label: 'Pore' },
  { id: 'hoard', col: 0, row: 4, w: 2, h: 1, label: 'Hoard' },
  { id: 'pore-j', col: 2, row: 4, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-k', col: 4, row: 4, w: 1, h: 1, label: 'Pore' },
  { id: 'pore-l', col: 5, row: 4, w: 1, h: 1, label: 'Pore' },
]

export function gridWidth(): number {
  return COLS * CELL + (COLS - 1) * GAP
}

export function gridHeight(): number {
  return ROWS * CELL + (ROWS - 1) * GAP
}

export function centerOf(slot: Slot): { x: number; y: number } {
  const x0 = slot.col * (CELL + GAP)
  const y0 = slot.row * (CELL + GAP)
  const w = slot.w * CELL + (slot.w - 1) * GAP
  const h = slot.h * CELL + (slot.h - 1) * GAP
  return { x: x0 + w / 2, y: y0 + h / 2 }
}

const BLOBS = [
  '48% 52% 55% 45% / 55% 44% 56% 45%',
  '55% 45% 50% 50% / 46% 56% 44% 54%',
  '46% 54% 44% 56% / 52% 46% 54% 48%',
  '58% 42% 52% 48% / 44% 58% 42% 56%',
  '50% 50% 58% 42% / 56% 44% 56% 44%',
  '44% 56% 46% 54% / 48% 54% 46% 52%',
  '52% 48% 42% 58% / 44% 52% 48% 56%',
]

export function blobFor(index: number): string {
  return BLOBS[index % BLOBS.length]
}