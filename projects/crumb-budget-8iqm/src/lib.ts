export type CategoryId = 'food' | 'transit' | 'fun' | 'stuff' | 'bills'

export interface Category {
  id: CategoryId
  label: string
  emoji: string
  color: string
}

export interface Entry {
  id: string
  name: string
  amount: number
  category: CategoryId
  ts: number
}

export interface SnackPreset {
  id: string
  emoji: string
  name: string
  price: number
}

export type SnackChoice =
  | { kind: 'preset'; id: string }
  | { kind: 'custom'; name: string; price: number }

export const CATEGORIES: Category[] = [
  { id: 'food', label: 'Food', emoji: '🍔', color: '#FF2E97' },
  { id: 'transit', label: 'Transit', emoji: '🚌', color: '#00F0FF' },
  { id: 'fun', label: 'Fun', emoji: '🎮', color: '#FFD319' },
  { id: 'stuff', label: 'Stuff', emoji: '🛍️', color: '#B026FF' },
  { id: 'bills', label: 'Bills', emoji: '💧', color: '#FF8A00' },
]

export function categoryById(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!
}

export const SNACKS: SnackPreset[] = [
  { id: 'donut', emoji: '🍩', name: 'Donut', price: 3.5 },
  { id: 'boba', emoji: '🧋', name: 'Boba Tea', price: 5.75 },
  { id: 'cookie', emoji: '🍪', name: 'Cookie', price: 1.75 },
  { id: 'taco', emoji: '🌮', name: 'Taco', price: 3.25 },
  { id: 'pizza', emoji: '🍕', name: 'Pizza Slice', price: 3.75 },
  { id: 'fries', emoji: '🍟', name: 'Fries', price: 4.25 },
  { id: 'coffee', emoji: '☕', name: 'Iced Coffee', price: 5.5 },
  { id: 'choc', emoji: '🍫', name: 'Choc Bar', price: 2.25 },
]

export const CUSTOM: SnackPreset = {
  id: 'custom',
  emoji: '✨',
  name: 'Custom',
  price: 0,
}

export function snackLabel(choice: SnackChoice, presets: SnackPreset[] = SNACKS): {
  name: string
  emoji: string
  price: number
} {
  if (choice.kind === 'preset') {
    const p = presets.find((s) => s.id === choice.id) ?? presets[0]!
    return { name: p.name, emoji: p.emoji, price: p.price }
  }
  return { name: choice.name || 'Custom', emoji: CUSTOM.emoji, price: choice.price }
}

export function defaultChoice(): SnackChoice {
  return { kind: 'preset', id: 'donut' }
}

/* ---------- formatting ---------- */

export function fmtMoney(n: number): string {
  return (
    '$' +
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

export function fmtSnack(n: number): string {
  const dec = n >= 10 ? 1 : 2
  return n.toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

export function parseMoney(raw: string): number {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/* ---------- ids / storage ---------- */

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked — swallow, app still works in-memory */
  }
}

export const KEYS = {
  entries: 'crumb:entries',
  snack: 'crumb:snack',
  budget: 'crumb:budget',
  snd: 'crumb:snd',
  egg: 'crumb:egg',
} as const

/* ---------- time helpers (local days) ---------- */

export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export interface DaySlot {
  ts: number
  key: string
  label: string
  isToday: boolean
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export function last7Days(): DaySlot[] {
  const out: DaySlot[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    out.push({
      ts: d.getTime(),
      key,
      label: DOW[d.getDay()]!,
      isToday: i === 0,
    })
  }
  return out
}

export function todaySpend(entries: Entry[]): number {
  const today = dayKey(Date.now())
  return entries.filter((e) => dayKey(e.ts) === today).reduce((s, e) => s + e.amount, 0)
}

export function weekSpend(entries: Entry[]): number {
  const days = last7Days()
  const set = new Set(days.map((d) => d.key))
  return entries.filter((e) => set.has(dayKey(e.ts))).reduce((s, e) => s + e.amount, 0)
}

export function totalsByDay(entries: Entry[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const e of entries) {
    const k = dayKey(e.ts)
    m[k] = (m[k] ?? 0) + e.amount
  }
  return m
}

/* ---------- snack math + quips ---------- */

export function wholeAndPart(units: number): { whole: number; part: number } {
  if (!Number.isFinite(units) || units <= 0) return { whole: 0, part: 0 }
  const whole = Math.floor(units)
  const part = Math.round((units - whole) * 10) / 10
  return { whole, part: part >= 1 ? 0.9 : part }
}

export function quipFor(units: number): string {
  if (!(units > 0)) return 'enter an amount, snacklord.'
  if (units < 1) return 'a mere crumb…'
  if (Number.isInteger(units)) return 'clean snack, no crumbs.'
  if (units >= 100) return 'SNACK OVERDRIVE. the machine fears you.'
  if (units >= 25) return 'the vending machine fears you.'
  if (units >= 10) return 'certified snack goblin.'
  const pool = ['that’s a heavy snacc.', 'your wallet weeps softly.', 'worth it.', 'capitalism, but tasty.', 'one for the archive.']
  return pool[Math.floor(Math.random() * pool.length)] ?? 'worth it.'
}

export function isOverBudget(spend: number, budget: number): boolean {
  return budget > 0 && spend > budget
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
