/* Cinder Sparrow Parlor — game data + logic. localStorage only, no backend. */

export type Flavor = 'spicy' | 'sweet' | 'dark' | 'silly'

export interface Gossip {
  id: string
  text: string
  flavor: Flavor
  author: string
  heat: number
  chirps: number
  ts: number
}

export interface Sparrow {
  id: string
  name: string
  hue: string
  craves: Flavor
  quip: string
}

export interface Offer {
  sparrow: Sparrow
  gossip: Gossip
}

export interface Seat {
  sparrow: Sparrow | null
  ember: number // 0..3
}

export const FLAVORS: Record<Flavor, { label: string; color: string; ink: string }> = {
  spicy: { label: 'SPICY', color: '#ff4d00', ink: '#fff3dc' },
  sweet: { label: 'SWEET', color: '#ff90e8', ink: '#16130e' },
  dark: { label: 'DARK', color: '#16130e', ink: '#ffc700' },
  silly: { label: 'SILLY', color: '#0e9e8e', ink: '#fff3dc' },
}

export const FLAVOR_LIST: Flavor[] = ['spicy', 'sweet', 'dark', 'silly']

export const KEYS = {
  hand: 'cinder-sparrow:hand:v1',
  offers: 'cinder-sparrow:offers:v1',
  seats: 'cinder-sparrow:seats:v1',
  board: 'cinder-sparrow:board:v1',
  warmth: 'cinder-sparrow:warmth:v1',
  best: 'cinder-sparrow:best:v1',
  trades: 'cinder-sparrow:trades:v1',
  sound: 'cinder-sparrow:sound:v1',
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

const SPARROWS: Array<{ name: string; hue: string; quip: string }> = [
  { name: 'Cinder', hue: '#ff4d00', quip: 'I only repeat what the coals tell me.' },
  { name: 'Soot', hue: '#6b4a2b', quip: 'Psst. Sit closer. This one is warm.' },
  { name: 'Tallow', hue: '#ffc700', quip: 'I trade fair — mostly.' },
  { name: 'Wick', hue: '#0e9e8e', quip: 'Heard it from a chimney, swear it.' },
  { name: 'Ash', hue: '#8a7f70', quip: 'Cold beak, warm heart.' },
  { name: 'Flint', hue: '#b33a2b', quip: 'Strike me a good story.' },
  { name: 'Mabel', hue: '#ff90e8', quip: 'Darling, you did NOT hear it from me.' },
  { name: 'Pip', hue: '#3a7bd5', quip: 'Chirp first, verify never!' },
]

const DECK: Array<{ text: string; flavor: Flavor }> = [
  { text: 'The lighthouse keeper feeds the gulls alpha-bait at midnight.', flavor: 'spicy' },
  { text: 'Mayor Puddle’s hat is stuffed with stolen lottery tickets.', flavor: 'spicy' },
  { text: 'The chimney on Bramble Row coughs Morse code after rain.', flavor: 'dark' },
  { text: 'Someone replaced the church bell clapper with a sausage.', flavor: 'silly' },
  { text: 'Old Fenwick proposes to his teapot every leap year.', flavor: 'silly' },
  { text: 'The baker’s sourdough starter is older than the town hall.', flavor: 'sweet' },
  { text: 'Two rival pigeons run an all-night crumb casino under the bridge.', flavor: 'spicy' },
  { text: 'The ferryman hums to keep the river asleep.', flavor: 'sweet' },
  { text: 'A ghost pays rent in the attic of the closed post office.', flavor: 'dark' },
  { text: 'The clocktower strikes thirteen whenever someone lies below it.', flavor: 'dark' },
  { text: 'Nettle the cat holds the deed to three fish stalls.', flavor: 'silly' },
  { text: 'The seamstress sews maps into coat linings for runaways.', flavor: 'sweet' },
  { text: 'Thunder is just the cloud giants rearranging furniture.', flavor: 'silly' },
  { text: 'The apothecary waters her plants with leftover tea and secrets.', flavor: 'sweet' },
  { text: 'A sparrow once out-argued the magistrate. There were witnesses.', flavor: 'spicy' },
  { text: 'The well on Cinder Lane echoes back a different voice.', flavor: 'dark' },
  { text: 'The fiddler’s bow is strung with his grandmother’s hair.', flavor: 'dark' },
  { text: 'Dandelion fluff carries the town’s lost buttons south.', flavor: 'sweet' },
  { text: 'The blacksmith arm-wrestles the river every spring. River’s up 12–9.', flavor: 'silly' },
  { text: 'Someone keeps knitting tiny scarves for the lampposts.', flavor: 'sweet' },
  { text: 'The miller grinds rumors finer than flour — and sells both.', flavor: 'spicy' },
  { text: 'Barn owls run the night shift at the message relay.', flavor: 'spicy' },
  { text: 'The pond froze mid-ripple last winter. It’s still holding its breath.', flavor: 'dark' },
  { text: 'A one-legged crow teaches dance on the chapel roof.', flavor: 'silly' },
]

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function makeSparrow(usedNames: Set<string>): Sparrow {
  const pool = SPARROWS.filter((s) => !usedNames.has(s.name))
  const base = pool.length > 0 ? rand(pool) : rand(SPARROWS)
  usedNames.add(base.name)
  return { id: uid(), name: base.name, hue: base.hue, craves: rand(FLAVOR_LIST), quip: base.quip }
}

export function makeGossip(author: string): Gossip {
  const d = rand(DECK)
  return {
    id: uid(),
    text: d.text,
    flavor: d.flavor,
    author,
    heat: 1 + Math.floor(Math.random() * 3),
    chirps: Math.floor(Math.random() * 4),
    ts: Date.now(),
  }
}

export function seedHand(): Gossip {
  const d = rand(DECK)
  return { id: uid(), text: d.text, flavor: d.flavor, author: 'you', heat: 2, chirps: 0, ts: Date.now() }
}

export function seedOffers(count = 3): Offer[] {
  const used = new Set<string>()
  return Array.from({ length: count }, () => {
    const s = makeSparrow(used)
    return { sparrow: s, gossip: makeGossip(s.name) }
  })
}

export function seedSeats(): Seat[] {
  const used = new Set<string>()
  return Array.from({ length: 6 }, (_, i) => ({
    // seat 5 starts empty so the player can invite a trader over
    sparrow: i === 5 ? null : makeSparrow(used),
    ember: 1 + Math.floor(Math.random() * 2),
  }))
}

/** Warmth earned for a trade. Match = warm trade with ember multiplier. */
export function tradeValue(hand: Gossip, offer: Offer, litEmbers: number): { gain: number; warm: boolean } {
  const warm = hand.flavor === offer.sparrow.craves
  const mult = 1 + litEmbers * 0.25
  if (warm) return { gain: Math.round((6 + hand.heat + offer.gossip.heat) * mult), warm: true }
  return { gain: Math.round(2 + offer.gossip.heat * 0.5), warm: false }
}

export function rankFor(warmth: number): string {
  if (warmth >= 80) return 'PARLOR LEGEND'
  if (warmth >= 40) return 'CINDER REGULAR'
  if (warmth >= 15) return 'WARM CHICK'
  return 'COLD EGG'
}

export function isValidGossip(g: unknown): g is Gossip {
  if (typeof g !== 'object' || g === null) return false
  const o = g as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.text === 'string' &&
    typeof o.flavor === 'string' &&
    (FLAVOR_LIST as string[]).includes(o.flavor) &&
    typeof o.author === 'string' &&
    typeof o.heat === 'number' &&
    typeof o.chirps === 'number'
  )
}
