export interface Expense {
  id: string
  name: string
  amount: number
  date: string // YYYY-MM-DD
  emoji: string
}

const KEY = 'crumb-budget:expenses'

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isExpense)
  } catch {
    return []
  }
}

function isExpense(v: unknown): v is Expense {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.name === 'string' &&
    e.name.length > 0 &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    e.amount > 0 &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    typeof e.emoji === 'string' &&
    e.emoji.length > 0
  )
}

export function saveExpenses(list: Expense[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full / unavailable — swallow, app still works in-memory
  }
}

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function lastNDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i)
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const day = String(t.getDate()).padStart(2, '0')
    out.push(`${t.getFullYear()}-${m}-${day}`)
  }
  return out
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayShort(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
  return DAY_NAMES[dt.getDay()] ?? ''
}

export function fmtDateRange(days: string[]): string {
  if (days.length === 0) return ''
  const first = days[0]!
  const last = days[days.length - 1]!
  const short = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number)
    return `${(m ?? 1)}/${(d ?? 1)}/${String(y).slice(2)}`
  }
  return `${short(first)} – ${short(last)}`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}