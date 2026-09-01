export interface Mood {
  id: string
  name: string
  fill: string
  pressed: string
  onLight: string
}

export const MOODS: Mood[] = [
  { id: 'great', name: 'GREAT', fill: '#00D46A', pressed: '#00B85A', onLight: '#00A04F' },
  { id: 'good', name: 'GOOD', fill: '#00C2FF', pressed: '#00A8DB', onLight: '#008FBD' },
  { id: 'meh', name: 'MEH', fill: '#FFD43B', pressed: '#E8B923', onLight: '#C79A00' },
  { id: 'low', name: 'LOW', fill: '#FF9F1C', pressed: '#E8820A', onLight: '#C77400' },
  { id: 'rough', name: 'ROUGH', fill: '#FF4E6A', pressed: '#E53350', onLight: '#D92A4D' },
]

export const MOOD_BY_ID: Record<string, Mood> = Object.fromEntries(
  MOODS.map((m) => [m.id, m]),
)

export const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

export interface DayCellData {
  key: string
  year: number
  month: number
  day: number | null
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function dayKey(day: number): string {
  return String(day).padStart(2, '0')
}

export function moodKey(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}:${dayKey(day)}`
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`
}

export function monthGrid(year: number, month: number): DayCellData[] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: DayCellData[] = []
  for (let i = 0; i < lead; i++) {
    cells.push({ key: `lead-${i}`, year, month, day: null })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `day-${d}`, year, month, day: d })
  }
  const trail = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trail; i++) {
    cells.push({ key: `trail-${i}`, year, month, day: null })
  }
  return cells
}

export function isToday(year: number, month: number, day: number): boolean {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day
}

export function todayMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function nextMood(current: string | undefined): string | null {
  if (!current) return MOODS[0].id
  const idx = MOODS.findIndex((m) => m.id === current)
  if (idx === -1 || idx === MOODS.length - 1) return null
  return MOODS[idx + 1].id
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}