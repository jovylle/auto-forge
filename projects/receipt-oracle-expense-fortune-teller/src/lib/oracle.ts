// Receipt Oracle — pure logic: aggregation, seeded divination, share encoding.
// No DOM, no localStorage here so it is unit-testable in isolation.

export type Category =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'housing'
  | 'health'
  | 'leisure'
  | 'other'

export interface Receipt {
  id: string
  name: string
  amount: number
  category: Category
  date: string // YYYY-MM-DD
  addedAt: number
}

export const CATEGORIES: { key: Category; label: string; element: string }[] = [
  { key: 'groceries', label: 'Groceries', element: 'Earth' },
  { key: 'dining', label: 'Dining', element: 'Fire' },
  { key: 'transport', label: 'Transport', element: 'Air' },
  { key: 'housing', label: 'Housing', element: 'Earth' },
  { key: 'health', label: 'Health', element: 'Water' },
  { key: 'leisure', label: 'Leisure', element: 'Fire' },
  { key: 'other', label: 'Other', element: 'Ether' },
]

export const ELEMENT_EMBLEM: Record<string, string> = {
  Earth: '◈',
  Fire: '✦',
  Air: '≋',
  Water: '≈',
  Ether: '◎',
}

export interface Aggregation {
  total: number
  count: number
  average: number
  byCategory: { category: Category; label: string; amount: number; share: number; element: string }[]
  dominant: { category: Category; label: string; element: string } | null
  topItems: Receipt[]
}

export function aggregate(receipts: Receipt[]): Aggregation {
  const total = receipts.reduce((s, r) => s + r.amount, 0)
  const count = receipts.length
  const average = count ? total / count : 0

  const map = new Map<Category, number>()
  for (const r of receipts) map.set(r.category, (map.get(r.category) ?? 0) + r.amount)

  const byCategory = CATEGORIES.map((c) => {
    const amount = map.get(c.key) ?? 0
    return {
      category: c.key,
      label: c.label,
      amount,
      share: total ? amount / total : 0,
      element: c.element,
    }
  })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const dominantEntry = byCategory[0] ?? null
  const dominant = dominantEntry
    ? { category: dominantEntry.category, label: dominantEntry.label, element: dominantEntry.element }
    : null

  const topItems = [...receipts].sort((a, b) => b.amount - a.amount).slice(0, 3)

  return { total, count, average, byCategory, dominant, topItems }
}

// ---- Deterministic seeded PRNG (mulberry32) so a share-link reproduces the same reading ----
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const OPENERS = [
  'The ledger breathes, and I have read its smoke.',
  'Beneath the brass lid, the book of accounts stirs.',
  'I traced each receipt in ember-light. This is what it foretold.',
  'The gears of your ledger turn true. Attend to the augury.',
]

const CLOSERS = [
  'So reads the Oracle. Spend with intent, and the ledger will smile.',
  'The ink settles. The forecast is written.',
  'Heed the omens, and temper your brass.',
  'The augury is cast. Now the ledger rests.',
]

const OMEN_TEMPLATES = [
  '{item} recurs upon your page like a hungry companion — it returns for its supper.',
  'The spirits whisper that {item} shall haunt the coming fortnight.',
  'I see {item} circled twice in copper. It means to visit again.',
  '{item} is a wolf at the pantry door: it knocks, and knocks again.',
  'A portent of {item} glows ember-bright in the smoke.',
]

const TONE = ['gentle', 'grave', 'wry', 'earnest']

interface Reading {
  seed: number
  dominant: { label: string; element: string } | null
  total: number
  count: number
  average: number
  byCategory: Aggregation['byCategory']
  topItems: Receipt[]
  opener: string
  closer: string
  omens: string[]
  tone: string
  dangerScore: number // 0-100
  heatScore: number // 0-100
  diligence: number // 0-100
}

export function computeReading(receipts: Receipt[]): Reading {
  const agg = aggregate(receipts)
  const seedInput =
    agg.total.toFixed(2) +
    '|' +
    agg.count +
    '|' +
    agg.byCategory.map((c) => `${c.category}:${Math.round(c.amount * 100)}`).join(',')
  const seed = hashString(seedInput) || 42
  const rand = mulberry32(seed)

  const opener = OPENERS[Math.floor(rand() * OPENERS.length) % OPENERS.length] ?? 'The ledger stirs.'
  const closer = CLOSERS[Math.floor(rand() * CLOSERS.length) % CLOSERS.length] ?? 'Spend with intent.'

  const omens = agg.topItems.map((item) => {
    const t = OMEN_TEMPLATES[Math.floor(rand() * OMEN_TEMPLATES.length) % OMEN_TEMPLATES.length] ?? OMEN_TEMPLATES[0]!
    return t.replace('{item}', `“${item.name}”`)
  })
  if (agg.topItems.length === 0) omens.push('The page is blank. There is nothing yet to read — ink a receipt first.')

  const tone = TONE[Math.floor(rand() * TONE.length) % TONE.length] ?? 'wry'

  // danger: how concentrated spending is in one category + average magnitude
  const topShare = agg.byCategory[0]?.share ?? 0
  const dangerScore = Math.round(Math.min(100, topShare * 140 + Math.min(30, (agg.average / 200) * 30)))
  // heat: dining + leisure share
  const heatShare = agg.byCategory
    .filter((c) => c.category === 'dining' || c.category === 'leisure')
    .reduce((s, c) => s + c.share, 0)
  const heatScore = Math.round(Math.min(100, heatShare * 160 + (agg.average / 150) * 25))
  const diligence = Math.round(Math.min(100, agg.count * 12 + 5))

  return {
    seed,
    dominant: agg.dominant,
    total: agg.total,
    count: agg.count,
    average: agg.average,
    byCategory: agg.byCategory,
    topItems: agg.topItems,
    opener,
    closer,
    omens,
    tone,
    dangerScore,
    heatScore,
    diligence,
  }
}

// ---- Share encoding (compact, URL-safe, lossless for floats via 2dp + ints) ----
export function encodeShare(receipts: Receipt[]): string {
  const rows = receipts.map((r) =>
    [encodeURIComponent(r.name), r.amount.toFixed(2), r.category, r.date].join('~'),
  )
  const payload = rows.join('|')
  try {
    return btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    return ''
  }
}

export function decodeShare(token: string): Receipt[] {
  if (!token) return []
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = decodeURIComponent(escape(atob(padded)))
    return payload
      .split('|')
      .filter(Boolean)
      .map((row) => {
        const [name, amount, category, date] = row.split('~')
        const amt = Number(amount)
        const cat = (CATEGORIES.some((c) => c.key === category) ? category : 'other') as Category
        if (!name || !Number.isFinite(amt) || amt <= 0) return null
        return {
          id: `s-${Math.random().toString(36).slice(2, 9)}`,
          name: decodeURIComponent(name),
          amount: amt,
          category: cat,
          date: date ?? '',
          addedAt: Date.now(),
        }
      })
      .filter((r): r is Receipt => r !== null)
  } catch {
    return []
  }
}
