import type { MossData } from './sim'
import { MAX_SEEDS, clamp } from './sim'

const KEY = 'moss-clock:v1'

export type SaveData = {
  v: 1
  coverage: number
  lushness: number
  calmSeconds: number
  cycles: number
  best: number
  seedRng: number
  seeds: MossData['seeds']
  savedAt: number
}

export function toSave(moss: MossData, best: number): SaveData {
  return {
    v: 1,
    coverage: moss.coverage,
    lushness: moss.lushness,
    calmSeconds: moss.calmSeconds,
    cycles: moss.cycles,
    best,
    seedRng: moss.seedRng,
    seeds: moss.seeds.slice(0, MAX_SEEDS),
    savedAt: Date.now(),
  }
}

function isSeed(s: unknown): s is MossData['seeds'][number] {
  return (
    typeof s === 'object' &&
    s !== null &&
    Number.isFinite((s as { x?: unknown }).x) &&
    Number.isFinite((s as { y?: unknown }).y) &&
    Number.isFinite((s as { r?: unknown }).r) &&
    Number.isFinite((s as { born?: unknown }).born) &&
    Number.isInteger((s as { t?: unknown }).t) &&
    (s as { t?: unknown }).t !== undefined &&
    (s as { t: number }).t >= 0 &&
    (s as { t: number }).t <= 2
  )
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SaveData>
    if (data.v !== 1) return null
    const seeds = Array.isArray(data.seeds) ? data.seeds.filter(isSeed).slice(0, MAX_SEEDS) : []
    return {
      v: 1,
      coverage: clamp(finiteOr(data.coverage, 4), 0, 100),
      lushness: clamp(finiteOr(data.lushness, 0), 0, 100),
      calmSeconds: clamp(finiteOr(data.calmSeconds, 0), 0, 1e9),
      cycles: clamp(finiteOr(data.cycles, 0), 0, 1e6),
      best: clamp(finiteOr(data.best, 0), 0, 100),
      seedRng: finiteOr(data.seedRng, 0xc0ffee),
      seeds,
      savedAt: data.savedAt ?? Date.now(),
    }
  } catch {
    return null
  }
}

export function saveSim(moss: MossData, best: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(toSave(moss, best)))
  } catch {
    /* storage unavailable — memory only */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}