export type Tier = 'S' | 'M' | 'L'

export interface Puddle {
  id: number
  row: number
  col: number
  tier: Tier
  bornAt: number
  seed: number
  evap: number
}

export interface Settled {
  id: number
  tier: Tier
  bornAt: number
  diedAt: number
}

export interface TierMeta {
  life: number
  dia: number
  stroke: number
  drops: number
}

export const TIER_META: Record<Tier, TierMeta> = {
  S: { life: 20_000, dia: 14, stroke: 0, drops: 0 },
  M: { life: 45_000, dia: 26, stroke: 1, drops: 1 },
  L: { life: 90_000, dia: 42, stroke: 1.5, drops: 2 },
}

export const TIER_ORDER: Tier[] = ['S', 'M', 'L']

export function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function fmtBorn(t: number): string {
  const d = new Date(t)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}