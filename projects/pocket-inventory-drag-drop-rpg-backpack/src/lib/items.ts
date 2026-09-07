export type Rarity = 'common' | 'rare' | 'legendary'

export interface LootType {
  id: string
  name: string
  emoji: string
  stat: string
  blurb: string
  base: number
}

export interface Item {
  uid: string
  typeId: string
  rarity: Rarity
  level: number
  value: number
}

export const RARITY: Record<Rarity, { label: string; color: string; mult: number }> = {
  common: { label: 'Common', color: '#C9B587', mult: 1 },
  rare: { label: 'Rare', color: '#EDB44B', mult: 3 },
  legendary: { label: 'Legendary', color: '#FF5C2E', mult: 9 },
}

export const LOOT: LootType[] = [
  { id: 'potion', name: 'Potion', emoji: '🧪', stat: 'Restores 8 HP', blurb: 'Bubbles in a friendly way.', base: 5 },
  { id: 'blade', name: 'Blade', emoji: '⚔️', stat: '+6 ATK', blurb: 'Kept slightly too sharp.', base: 12 },
  { id: 'shield', name: 'Shield', emoji: '🛡️', stat: '+5 DEF', blurb: 'Still smells of forge smoke.', base: 14 },
  { id: 'gem', name: 'Gem', emoji: '💎', stat: 'Sells for a purse', blurb: 'Catches the dark and keeps it.', base: 30 },
  { id: 'scroll', name: 'Scroll', emoji: '📜', stat: 'Casts one spell', blurb: 'Written in wet ink, read by candle.', base: 18 },
  { id: 'rations', name: 'Rations', emoji: '🍖', stat: 'Sates a belly', blurb: 'Questionably cured.', base: 8 },
  { id: 'shroom', name: 'Shroom', emoji: '🍄', stat: 'Doubtful snack', blurb: 'Grew on something that moved.', base: 4 },
  { id: 'key', name: 'Key', emoji: '🗝️', stat: 'Opens one lock', blurb: 'Cold iron, warm guilt.', base: 22 },
  { id: 'bomb', name: 'Bomb', emoji: '💣', stat: 'Handle with care', blurb: 'The fuse has already been lit.', base: 20 },
  { id: 'orb', name: 'Orb', emoji: '🔮', stat: 'Hums faintly', blurb: 'Do not ask it questions.', base: 26 },
  { id: 'charm', name: 'Charm', emoji: '🧿', stat: 'Wards one hex', blurb: 'An eye that never blinks.', base: 10 },
  { id: 'coral', name: 'Coral', emoji: '🪸', stat: 'Still wet from the reef', blurb: 'It keeps time in its branches.', base: 16 },
]

const PREFIX: Record<Rarity, string[]> = {
  common: ['Frayed', 'Damp', 'Worn', 'Mossy', 'Bent'],
  rare: ['Runic', 'Verdant', 'Glowing', 'Hollow', 'Salt-struck'],
  legendary: ['Primordial', 'Star-bitten', 'Biolum', 'Elder', 'God-touched'],
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rollRarity(rnd: () => number): Rarity {
  const r = rnd()
  if (r < 0.62) return 'common'
  if (r < 0.9) return 'rare'
  return 'legendary'
}

export function itemName(item: Item): string {
  const type = LOOT.find((t) => t.id === item.typeId)
  if (!type) return 'Relic'
  const prefixes = PREFIX[item.rarity]
  return `${prefixes[item.level % prefixes.length]} ${type.name}`
}

export function typeOf(item: Item): LootType {
  return LOOT.find((t) => t.id === item.typeId) ?? LOOT[0]
}

export function makeItem(uid: string, typeId: string, rarity: Rarity, level: number): Item {
  const type = LOOT.find((t) => t.id === typeId) ?? LOOT[0]
  const value = Math.round(type.base * RARITY[rarity].mult * (1 + (level - 1) * 0.35))
  return { uid, typeId, rarity, level, value }
}

export function generateLoot(seed: number, count = 14): Item[] {
  const rnd = mulberry32(seed)
  const items: Item[] = []
  for (let i = 0; i < count; i++) {
    const type = LOOT[Math.floor(rnd() * LOOT.length)]
    const rarity = rollRarity(rnd)
    const level = 1 + Math.floor(rnd() * 9)
    items.push(makeItem(`it${seed}-${i}`, type.id, rarity, level))
  }
  return items
}