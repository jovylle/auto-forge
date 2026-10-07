export interface Waypoint {
  id: string
  name: string
  x: number // 0..100
  y: number // 0..100
  note: string
  pinned: boolean
  seed: number
}

export interface Route {
  id: string
  name: string
  stopIds: string[]
  color: string
}

export const ROUTE_COLORS = ['#ff2e88', '#00e8db', '#ffb02e', '#b6ff2e', '#c77bff']

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

const NAME_A = ['Ember', 'Lantern', 'Paper', 'Neon', 'Cinder', 'Fog', 'Kite', 'Moss', 'Tide', 'Crane']
const NAME_B = ['Crossing', 'Harbor', 'Relay', 'Garden', 'Market', 'Tower', 'Alley', 'Gate', 'Pier', 'Shrine']

export function autoName(n: number): string {
  const a = NAME_A[n % NAME_A.length] ?? 'Drift'
  const b = NAME_B[Math.floor(n / NAME_A.length) % NAME_B.length] ?? 'Point'
  return `${a} ${b}`
}

/** Drifted position at time t (seconds) unless pinned or drift disabled. */
export function drifted(w: Waypoint, t: number, driftOn: boolean): { x: number; y: number } {
  if (!driftOn || w.pinned) return { x: w.x, y: w.y }
  const amp = 1.6
  return {
    x: w.x + Math.sin(t * 0.35 + w.seed * 1.7) * amp,
    y: w.y + Math.cos(t * 0.27 + w.seed * 2.3) * amp,
  }
}

export function easeOutCubic(v: number): number {
  const c = Math.min(1, Math.max(0, v))
  return 1 - Math.pow(1 - c, 3)
}

/** Rough territory coverage % via grid sampling. */
export function coverage(pts: { x: number; y: number }[], radius: number): number {
  if (pts.length === 0) return 0
  const cols = 50
  const rows = 32
  let hit = 0
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = (i + 0.5) * (100 / cols)
      const py = (j + 0.5) * (100 / rows)
      for (const p of pts) {
        const dx = px - p.x
        const dy = py - p.y
        if (dx * dx + dy * dy <= radius * radius) {
          hit++
          break
        }
      }
    }
  }
  return Math.round((hit / (cols * rows)) * 100)
}

/** Total route length in map units. */
export function routeLength(stops: { x: number; y: number }[]): number {
  let d = 0
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    if (a && b) d += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return Math.round(d * 10) / 10
}
