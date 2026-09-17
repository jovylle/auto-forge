export type Kind = 'ember' | 'ash'

export interface Entry {
  id: string
  label: string
  amount: number
  kind: Kind
  cat: string
  ts: number
}

export const CATS = [
  { id: 'fuel', name: 'Fuel', shape: 'circle' },
  { id: 'meal', name: 'Meal', shape: 'square' },
  { id: 'shelter', name: 'Shelter', shape: 'triangle' },
  { id: 'spark', name: 'Spark', shape: 'half' },
  { id: 'drift', name: 'Drift', shape: 'bar' },
] as const

export type CatId = (typeof CATS)[number]['id']

export const KEYS = {
  entries: 'cinder-ledger:entries:v1',
  sound: 'cinder-ledger:sound:v1',
} as const

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full — ignore */
  }
}

export function isValidEntry(e: unknown): e is Entry {
  if (typeof e !== 'object' || e === null) return false
  const r = e as Record<string, unknown>
  return (
    typeof r['id'] === 'string' &&
    typeof r['label'] === 'string' &&
    typeof r['amount'] === 'number' &&
    Number.isFinite(r['amount']) &&
    (r['kind'] === 'ember' || r['kind'] === 'ash') &&
    typeof r['cat'] === 'string' &&
    typeof r['ts'] === 'number'
  )
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function totals(entries: Entry[]): { ember: number; ash: number; balance: number } {
  let ember = 0
  let ash = 0
  for (const e of entries) {
    if (e.kind === 'ember') ember += e.amount
    else ash += e.amount
  }
  return { ember, ash, balance: ember - ash }
}

export function catName(id: string): string {
  return CATS.find((c) => c.id === id)?.name ?? id
}

export function toCSV(entries: Entry[]): string {
  const rows = ['id,label,amount,kind,category,date']
  const sorted = [...entries].sort((a, b) => a.ts - b.ts)
  for (const e of sorted) {
    const safe = `"${e.label.replace(/"/g, '""')}"`
    rows.push(`${e.id},${safe},${e.amount.toFixed(2)},${e.kind},${e.cat},${new Date(e.ts).toISOString()}`)
  }
  return rows.join('\n')
}

export function shareCard(entries: Entry[]): string {
  const t = totals(entries)
  const lines = [
    '◉ CINDER LEDGER — ash accounts',
    `▲ ember in: ${fmtMoney(t.ember)}`,
    `▼ ash out:  ${fmtMoney(t.ash)}`,
    `● balance:  ${fmtMoney(t.balance)}`,
    `${entries.length} entries burned.`,
  ]
  return lines.join('\n')
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
