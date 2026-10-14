export interface Book {
  id: string
  title: string
  author: string
  shelf: 'A' | 'B' | 'C'
  spine: string // hex color
  height: number // px
  checkedOut: boolean
  clerkId: string | null
}

export interface Clerk {
  id: string
  name: string
  trait: string
  color: string // spike color
  belly: string
  speed: number // 1..5
  care: number // 1..5
  shelved: number
}

export const SHELVES = [
  { id: 'A', name: 'SHELF A · ABYSSAL FOLIOS', indent: 0 },
  { id: 'B', name: 'SHELF B · BRASS ANNALS', indent: 48 },
  { id: 'C', name: 'SHELF C · CORAL CODEX', indent: 96 },
] as const

export type ShelfId = (typeof SHELVES)[number]['id']

const SPINES = [
  '#e2603f', '#4e9b8f', '#7fa65a', '#d9a441', '#8e5ba6',
  '#c96f2e', '#3f7fa3', '#a33f5e', '#5aa67f', '#b8912f',
]

const SEED: Array<[string, string, ShelfId]> = [
  ['The Gilded Tide', 'Marina Voss', 'A'],
  ['Spines & Splinters', 'Corwin Bale', 'A'],
  ['A Field Guide to Venom', 'Dr. Ilsa Quill', 'A'],
  ['Brassbound Beasts', 'Fenwick Roe', 'A'],
  ['The Ninth Current', 'Odessa Pike', 'A'],
  ['Urchinomics', 'Prof. Bram Tide', 'A'],
  ['Salt & Cipher', 'Nix Halvorsen', 'B'],
  ['The Clockwork Reef', 'Ada Brine', 'B'],
  ['Patina of Ages', 'Solder Jim', 'B'],
  ['Deepwater Ledgers', 'M. Ostreidae', 'B'],
  ['Kelpsong Sonatas', 'Wren Caldera', 'B'],
  ['The Lantern Whelk', 'Pip Alabaster', 'B'],
  ['Coral & Cinder', 'Sable Moray', 'C'],
  ['The Prickly Canon', 'Urso Major', 'C'],
  ['Trench Lullabies', 'Ludo Fathom', 'C'],
  ['Anemone Dreams', 'Cleo Drift', 'C'],
  ['The Brass Leviathan', 'H. Copperfin', 'C'],
  ['Lowtide Almanac', 'Gulliver Sand', 'C'],
]

export function seedBooks(): Book[] {
  return SEED.map(([title, author, shelf], i) => {
    const color = SPINES[i % SPINES.length] ?? '#d9a441'
    return {
      id: `book-${i + 1}`,
      title,
      author,
      shelf,
      spine: color,
      height: 96 + ((i * 37) % 48),
      checkedOut: false,
      clerkId: null,
    }
  })
}

export const CLERKS: Clerk[] = [
  { id: 'spike', name: 'SPIKE', trait: 'Shelf-sprinter · drops nothing', color: '#e2603f', belly: '#f4e3c1', speed: 5, care: 3, shelved: 0 },
  { id: 'briny', name: 'BRINY', trait: 'Gentle archivist · dusts spines', color: '#4e9b8f', belly: '#f4e3c1', speed: 3, care: 5, shelved: 0 },
  { id: 'kelpo', name: 'KELPO', trait: 'Heavy lifter · folio wrestler', color: '#7fa65a', belly: '#3a2418', speed: 2, care: 4, shelved: 0 },
  { id: 'gilt', name: 'GILT', trait: 'Brass polisher · glints loudly', color: '#d9a441', belly: '#3a2418', speed: 4, care: 4, shelved: 0 },
]

const LS_BOOKS = 'ubl:books:v1'
const LS_CLERKS = 'ubl:clerks:v1'
const LS_BEST = 'ubl:best:v1'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full/blocked — app still works in-memory */
  }
}

function validBooks(raw: unknown): raw is Book[] {
  return (
    Array.isArray(raw) &&
    raw.every(
      (b) =>
        typeof b === 'object' && b !== null &&
        typeof (b as Book).id === 'string' &&
        typeof (b as Book).title === 'string' &&
        typeof (b as Book).author === 'string' &&
        ['A', 'B', 'C'].includes((b as Book).shelf),
    )
  )
}

export function loadBooks(): Book[] {
  const raw = loadJSON<unknown>(LS_BOOKS, null)
  if (validBooks(raw)) {
    return raw.map((b) => ({
      ...b,
      spine: typeof b.spine === 'string' ? b.spine : '#d9a441',
      height: typeof b.height === 'number' ? b.height : 110,
      checkedOut: b.checkedOut === true,
      clerkId: typeof b.clerkId === 'string' ? b.clerkId : null,
    }))
  }
  return seedBooks()
}

export function persistBooks(books: Book[]): void {
  saveJSON(LS_BOOKS, books)
}

export function loadClerks(): Clerk[] {
  const raw = loadJSON<unknown>(LS_CLERKS, null)
  if (Array.isArray(raw)) {
    return CLERKS.map((c) => {
      const found = (raw as Clerk[]).find((r) => r.id === c.id)
      return found && typeof found.shelved === 'number' ? { ...c, shelved: found.shelved } : c
    })
  }
  return CLERKS.map((c) => ({ ...c }))
}

export function persistClerks(clerks: Clerk[]): void {
  saveJSON(LS_CLERKS, clerks.map((c) => ({ id: c.id, shelved: c.shelved })))
}

export function loadBest(): number {
  const n = loadJSON<unknown>(LS_BEST, 0)
  return typeof n === 'number' && n >= 0 ? n : 0
}

export function persistBest(n: number): void {
  saveJSON(LS_BEST, n)
}

export function uid(): string {
  return `book-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function searchBooks(books: Book[], q: string): Book[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  return books.filter(
    (b) =>
      b.title.toLowerCase().includes(needle) ||
      b.author.toLowerCase().includes(needle) ||
      `shelf ${b.shelf}`.includes(needle) ||
      b.shelf.toLowerCase() === needle,
  )
}

/** 9x9 pixel urchin: 1 = spike, 2 = belly/face, 0 = empty */
const URCHIN_MAP = [
  '1.1.1.1.1',
  '.1.1.1.1.',
  '1.1.2.1.1',
  '.1.2222.1',
  '1.12.2121',
  '.1.2222.1',
  '1.1.2.1.1',
  '.1.1.1.1.',
  '1.1.1.1.1',
]

export function urchinShadows(color: string, belly: string, px = 4): string {
  const parts: string[] = []
  for (let y = 0; y < URCHIN_MAP.length; y++) {
    const row = URCHIN_MAP[y] ?? ''
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '1') parts.push(`${x * px}px ${y * px}px 0 0 ${color}`)
      else if (ch === '2') parts.push(`${x * px}px ${y * px}px 0 0 ${belly}`)
    }
  }
  return parts.join(',')
}
