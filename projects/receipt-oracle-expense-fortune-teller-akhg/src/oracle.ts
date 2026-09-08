// oracle.ts — domain model, seeded reading engine, and share-codec for the Receipt Oracle.

export type CategoryId =
  | 'sustenance'
  | 'passage'
  | 'shelter'
  | 'recreation'
  | 'rites'

export interface Receipt {
  id: string
  merchant: string
  amount: number
  category: CategoryId
  at: string // ISO date stamp
}

export interface CategoryMeta {
  id: CategoryId
  label: string
  rune: string
  color: string // css hex, rendered as a dot / omen rule / meter fill
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'sustenance', label: 'Sustenance', rune: 'ᛉ', color: '#C98A2E' },
  { id: 'passage', label: 'Passage', rune: 'ᛊ', color: '#4FA3B8' },
  { id: 'shelter', label: 'Shelter', rune: 'ᛗ', color: '#8C5B8F' },
  { id: 'recreation', label: 'Recreation', rune: 'ᚹ', color: '#C05C7E' },
  { id: 'rites', label: 'Rites', rune: 'ᚦ', color: '#7A8C4A' },
]

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!
}

export interface OmenLine {
  merchant: string
  amount: number
  category: CategoryMeta
  quip: string
  apex: boolean // the single largest expense
}

export interface CategoryTally {
  meta: CategoryMeta
  sum: number
  share: number // 0..1 of total
}

export interface Verdict {
  title: string
  lines: string[]
  danger: boolean
}

export interface Reading {
  seed: number
  total: number
  count: number
  omens: OmenLine[]
  tallies: CategoryTally[] // non-zero, sorted desc
  dominant?: CategoryTally
  verdict: Verdict
  awakenedEcho?: string // set only when the oracle has been awakened
}

// ---- seeded randomness (mulberry32) ---------------------------------------
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

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export const money = (n: number): string =>
  '$' +
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const moneyWhole = (n: number): string =>
  '$' +
  Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

// ---- quips -----------------------------------------------------------------
const QUIPS: Record<CategoryId, string[]> = {
  sustenance: [
    'thou didst feed the flesh, and the flesh remembers',
    'a hunger paid in coin — the belly keeps no ledgers',
    'warmth was purchased here; the hearth nods in approval',
    'the palate led and the purse followed, meekly',
  ],
  passage: [
    'the road exacted its toll, as roads always do',
    'thou didst trade silver for distance and call it freedom',
    'wheels turned, miles were eaten, the fare was just',
    'to move is to spend — the oracle finds no fault',
  ],
  shelter: [
    'a roof was bought against the weather of the world',
    'four walls, one key — the oldest covenant of coin',
    'thou shelterest the body so the spirit may roam',
    'the threshold is paid for; enter without shame',
  ],
  recreation: [
    'pleasure was procured and not one regret was filed',
    'the spirit demanded its festival; the purse conceded',
    'merriment, invoiced — the rarest kind of treasure',
    'thou didst buy a small bright hour. It was worth it',
  ],
  rites: [
    'an unclassified tithe — the oracle notes it in silence',
    'odd coin falls to odd causes; such is the way of things',
    'this offering defies naming, and so is named Rites',
    'the gods of expense accept all currencies, even confusion',
  ],
}

const VERDICT_OPEN: string[] = [
  'The threads of thy spending weave a single pattern:',
  'The bones of the ledger tell of thee:',
  'Thus the candle gutters and the truth is spelled:',
  'The quill has finished its confession. Attend:',
]

const VERDICT_TAILS: string[] = [
  'Keep a coin for the hungry season ahead.',
  'The oracle counsels patience before the next indulgence.',
  'Weigh each pleasure against the roof above thee.',
  'Temper thy appetites and the ledger shall love thee.',
  'Spend as one who has already read the ending.',
  'Let want teach thee, and thrift become a kind of magic.',
]

const DANGER_LINES = [
  'Beware the shadow-gap: thy offerings outrun thy means.',
  'The scale tips past balance — the maw grows wide.',
  'An extravagance has been named. Amend thy ways or the coffers weep.',
]

// ---- reading engine --------------------------------------------------------
export function buildReading(receipts: Receipt[], seedIn: number, awakened: boolean): Reading {
  const rand = mulberry32(seedIn >>> 0)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!

  const total = receipts.reduce((s, r) => s + r.amount, 0)
  const sorted = [...receipts].sort((a, b) => b.amount - a.amount)

  const omens: OmenLine[] = sorted.map((r, i) => {
    const meta = categoryMeta(r.category)
    return {
      merchant: r.merchant,
      amount: r.amount,
      category: meta,
      quip: QUIPS[r.category][Math.floor(rand() * QUIPS[r.category].length)] ?? '',
      apex: i === 0 && sorted.length > 0,
    }
  })

  const tallyMap = new Map<CategoryId, number>()
  for (const r of receipts) tallyMap.set(r.category, (tallyMap.get(r.category) ?? 0) + r.amount)
  const tallies: CategoryTally[] = CATEGORIES.filter((c) => (tallyMap.get(c.id) ?? 0) > 0)
    .map((c) => {
      const sum = tallyMap.get(c.id) ?? 0
      return { meta: c, sum, share: total > 0 ? sum / total : 0 }
    })
    .sort((a, b) => b.sum - a.sum)

  const dominant = tallies[0]
  const apexR = sorted[0]
  const apexShare = total > 0 && apexR ? apexR.amount / total : 0
  const danger = !!dominant && dominant.share > 0.62
  const broke = receipts.length > 0 && apexShare > 0.5 && danger

  const lines: string[] = []
  const open = VERDICT_OPEN[Math.floor(rand() * VERDICT_OPEN.length)] ?? ''
  if (receipts.length === 0) {
    lines.push('No offerings lie upon the desk. The book is blank, and blankness foretells nothing.')
    lines.push('Ink a single receipt, and return — the oracle will have words for thee.')
  } else {
    lines.push(open)
    if (dominant) {
      lines.push(
        `Thy coin cleaves most to ${dominant.meta.label.toLowerCase()} — ${Math.round(dominant.share * 100)} parts in every hundred.`,
      )
    }
    if (apexR) {
      const apexPct = Math.round(apexShare * 100)
      if (broke) {
        lines.push(`A single offering — ${apexR.merchant}, ${money(apexR.amount)} — swallows ${apexPct} of all thou spendest. This is no fortune; this is a warning.`)
      } else if (apexShare > 0.34) {
        lines.push(`The tallest flame is ${apexR.merchant} at ${apexPct} of thy burn. Keep watch that it does not become the whole fire.`)
      } else {
        lines.push(`No single vice dominates. Thy ledger breathes evenly, and that is a quiet kind of power.`)
      }
    }
  }

  const title =
    receipts.length === 0
      ? 'The Empty Reading'
      : broke
        ? 'The Devouring'
        : danger
          ? 'The Tipping Scale'
          : total > 0 && (dominant?.share ?? 0) > 0.4
            ? 'The Leaning Flame'
            : 'The Balanced Purse'

  const tail =
    receipts.length === 0
      ? ''
      : (danger && DANGER_LINES[Math.floor(rand() * DANGER_LINES.length)]) || pick(VERDICT_TAILS)

  if (tail) lines.push(tail)

  let awakenedEcho: string | undefined
  if (awakened) {
    const name = apexR?.merchant ?? 'the void itself'
    const amt = apexR ? money(apexR.amount) : money(total)
    awakenedEcho = `The Unseen Ledger is unsealed: thou keepest returning to ${name} (${amt}) — the debt thou refusest to name. The oracle now watches from the far side of the candle.`
  }

  return { seed: seedIn, total, count: receipts.length, omens, tallies, dominant, verdict: { title, lines, danger }, awakenedEcho }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

// ---- persistence -----------------------------------------------------------
const LS_LEDGER = 'receipt-oracle.ledger.v1'
const LS_AWAKEN = 'receipt-oracle.awakened.v1'

export function loadLedger(): Receipt[] {
  try {
    const raw = localStorage.getItem(LS_LEDGER)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isReceipt)
  } catch {
    return []
  }
}

export function saveLedger(receipts: Receipt[]): void {
  try {
    localStorage.setItem(LS_LEDGER, JSON.stringify(receipts))
  } catch {
    /* storage full / private mode — ignore */
  }
}

function isReceipt(x: unknown): x is Receipt {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.merchant === 'string' &&
    o.merchant.length > 0 &&
    o.merchant.length <= 60 &&
    typeof o.amount === 'number' &&
    Number.isFinite(o.amount) &&
    o.amount > 0 &&
    o.amount <= 1e9 &&
    typeof o.category === 'string' &&
    CATEGORIES.some((c) => c.id === o.category)
  )
}

export function loadAwakened(): boolean {
  try {
    return localStorage.getItem(LS_AWAKEN) === '1'
  } catch {
    return false
  }
}

export function saveAwakened(on: boolean): void {
  try {
    if (on) localStorage.setItem(LS_AWAKEN, '1')
    else localStorage.removeItem(LS_AWAKEN)
  } catch {
    /* ignore */
  }
}

// ---- share-link codec ------------------------------------------------------
// payload is wrapped in a URL fragment so it never leaves the client.
export interface SharePayload {
  v: 1
  seed: number
  receipts: Receipt[]
}

export function encodeShare(seed: number, receipts: Receipt[]): string {
  const json = JSON.stringify({ v: 1, seed, receipts } satisfies SharePayload)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // base64url — safe inside a URL fragment without further escaping
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShare(token: string): SharePayload | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json) as Partial<SharePayload>
    if (parsed.v !== 1 || typeof parsed.seed !== 'number') return null
    if (!Array.isArray(parsed.receipts) || !parsed.receipts.every(isReceipt)) return null
    return { v: 1, seed: parsed.seed, receipts: parsed.receipts } as SharePayload
  } catch {
    return null
  }
}

export function readHashToken(): string | null {
  const m = /#o=([A-Za-z0-9_-]+)/.exec(window.location.hash)
  return m ? m[1]! : null
}
