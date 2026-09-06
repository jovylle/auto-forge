import type { DrawerItem } from '../types'

export const CATEGORIES = [
  'keys',
  'bits & bobs',
  'craft',
  'garden',
  'kitchen',
  'tools',
  'treasure',
  'other',
] as const

export const STORE_KEY = 'drawer-oracle.items'
export const RELEASED_KEY = 'drawer-oracle.released'
export const COUNTER_KEY = 'drawer-oracle.counter'

function isDrawerItem(x: unknown): x is DrawerItem {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.note === 'string' &&
    typeof o.category === 'string' &&
    typeof o.no === 'number' &&
    typeof o.createdAt === 'number'
  )
}

export function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function loadItems(): DrawerItem[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDrawerItem)
  } catch {
    return []
  }
}

export function saveItems(items: DrawerItem[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items))
  } catch {
    // the drawer is too full to write — leave it be
  }
}

export function loadReleased(): number {
  try {
    const n = Number(localStorage.getItem(RELEASED_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function saveReleased(n: number): void {
  try {
    localStorage.setItem(RELEASED_KEY, String(n))
  } catch {
    // noop
  }
}

export function nextLedgerNo(): number {
  try {
    const n = Number(localStorage.getItem(COUNTER_KEY)) || 0
    localStorage.setItem(COUNTER_KEY, String(n + 1))
    return n + 1
  } catch {
    return Math.floor(Math.random() * 9000) + 1000
  }
}

export function scoreFor(kept: number, released: number): number {
  const total = kept + released
  if (total === 0) return 0
  return released / total
}

export function tierFor(score: number): { label: string; note: string } {
  if (score >= 0.75) {
    return { label: 'Tidy as a Pin', note: 'scarcely a crumb in the drawer' }
  }
  if (score >= 0.5) {
    return { label: 'Put Up Preserves', note: 'shelved, sealed, labeled' }
  }
  if (score >= 0.25) {
    return { label: 'Sprouting', note: 'things finding their way out' }
  }
  return { label: 'Full Drawer', note: 'a riot of useful clutter' }
}