import { Puddle, Settled, Tier, TIER_META, TIER_ORDER } from './types'

interface Persisted {
  puddles: Puddle[]
  settled: Settled[]
  raining: boolean
  brush: Tier
  nextId: number
}

export class State {
  puddles: Puddle[] = []
  settled: Settled[] = []
  raining = false
  brush: Tier = 'S'
  nextId = 1

  private listeners = new Set<() => void>()
  private last = performance.now()
  private readonly KEY = 'puddle-atlas:v1'

  constructor() {
    this.load()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  private persist(): void {
    try {
      const data: Persisted = {
        puddles: this.puddles,
        settled: this.settled,
        raining: this.raining,
        brush: this.brush,
        nextId: this.nextId,
      }
      localStorage.setItem(this.KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable — play session-only */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.KEY)
      if (!raw) return
      const d = JSON.parse(raw) as Partial<Persisted>
      if (Array.isArray(d.puddles)) {
        this.puddles = d.puddles.filter(
          (p) => p && typeof p.id === 'number' && typeof p.row === 'number' && typeof p.col === 'number',
        )
      }
      if (Array.isArray(d.settled)) this.settled = d.settled
      if (typeof d.raining === 'boolean') this.raining = d.raining
      if (d.brush === 'S' || d.brush === 'M' || d.brush === 'L') this.brush = d.brush
      if (typeof d.nextId === 'number') this.nextId = d.nextId
    } catch {
      /* corrupted store — start fresh */
    }
  }

  addPuddle(row: number, col: number): void {
    this.puddles.push({
      id: this.nextId++,
      row,
      col,
      tier: this.brush,
      bornAt: Date.now(),
      seed: (Math.random() * 2 ** 31) >>> 0,
      evap: 0,
    })
    this.persist()
    this.emit()
  }

  removePuddle(id: number): void {
    const before = this.puddles.length
    this.puddles = this.puddles.filter((p) => p.id !== id)
    this.settled = this.settled.filter((s) => s.id !== id)
    if (this.puddles.length !== before) {
      this.persist()
      this.emit()
    }
  }

  cycleBrush(): void {
    this.brush = TIER_ORDER[(TIER_ORDER.indexOf(this.brush) + 1) % TIER_ORDER.length]
    this.persist()
    this.emit()
  }

  setRaining(v: boolean): void {
    if (this.raining === v) return
    this.raining = v
    if (v) {
      for (const p of this.puddles) {
        p.evap = Math.max(0, p.evap - TIER_META[p.tier].life * 0.15)
      }
    }
    this.persist()
    this.emit()
  }

  remaining(p: Puddle): number {
    return TIER_META[p.tier].life - p.evap
  }

  tick(): void {
    const now = performance.now()
    const dt = Math.min(now - this.last, 100)
    this.last = now
    if (this.raining) return
    let changed = false
    for (const p of this.puddles) {
      p.evap += dt
      if (p.evap >= TIER_META[p.tier].life) {
        this.settled.push({ id: p.id, tier: p.tier, bornAt: p.bornAt, diedAt: Date.now() })
        changed = true
      }
    }
    if (changed) {
      this.puddles = this.puddles.filter((p) => p.evap < TIER_META[p.tier].life)
      this.persist()
      this.emit()
    }
  }
}