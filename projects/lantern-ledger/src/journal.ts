export interface Entry {
  date: string
  text: string
  createdAt: number
}

const KEY = 'lantern-ledger.entries.v1'

export function loadEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is Entry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as Entry).date === 'string' &&
        typeof (e as Entry).text === 'string',
    )
  } catch {
    return []
  }
}

export function saveEntries(entries: Entry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function prevDayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d - 1))
}

export function nextDayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + 1))
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function shortLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

function daySuffix(d: number): string {
  if (d >= 11 && d <= 13) return 'th'
  const r = d % 10
  if (r === 1) return 'st'
  if (r === 2) return 'nd'
  if (r === 3) return 'rd'
  return 'th'
}

export function fullLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}${daySuffix(d)}, ${y}`
}

/** Consecutive nights with an entry, counting back from tonight (or last night). */
export function calcStreak(dates: string[]): number {
  const set = new Set(dates)
  if (set.size === 0) return 0
  let cursor = todayISO()
  if (!set.has(cursor)) {
    cursor = prevDayISO(cursor)
    if (!set.has(cursor)) return 0
  }
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = prevDayISO(cursor)
  }
  return streak
}

/** Last n calendar days ending today, oldest first. */
export function lastNDays(n: number): string[] {
  const out: string[] = []
  let cursor = todayISO()
  for (let i = 0; i < n; i++) {
    out.unshift(cursor)
    cursor = prevDayISO(cursor)
  }
  return out
}

/** Chronological night number of a date among the written nights. */
export function nightNumber(iso: string, entryDates: string[]): number {
  const uniq = Array.from(new Set(entryDates)).sort()
  let n = 0
  for (const d of uniq) {
    if (d < iso) n += 1
  }
  return n + 1
}