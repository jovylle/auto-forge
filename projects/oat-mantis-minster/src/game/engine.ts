// Pure game state + rules. No DOM, no audio — the view and the sound layer read events.

export const CUT = 0.7 // y of the cut line, 0..1 of stage height
export const ROUND = 30
export const LIVES = 3
export const PERFECT_WINDOW = 0.026
export const GOOD_WINDOW = 0.085
export const GLYPHS_FOR_SUTRA = 6

export type Phase = 'title' | 'playing' | 'result'
export type Hit = 'perfect' | 'good'
export type EventType = Hit | 'whiff' | 'miss' | 'sutra' | 'end'

export interface GameEvent {
  type: EventType
  /** x of the oat that caused it, 0..1 — used for sparks */
  x?: number
}

export interface Oat {
  id: number
  x: number
  y: number
  vy: number
  rot: number
  spin: number
}

export interface Game {
  phase: Phase
  score: number
  combo: number
  bestCombo: number
  perfects: number
  goods: number
  misses: number
  lives: number
  timeLeft: number
  glyphs: number
  sutras: number
  elapsed: number
  oats: Oat[]
  spawnIn: number
  nextId: number
  lastHit: Hit | null
}

export function createGame(): Game {
  return {
    phase: 'title',
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
    lives: LIVES,
    timeLeft: ROUND,
    glyphs: 0,
    sutras: 0,
    elapsed: 0,
    oats: [],
    spawnIn: 0,
    nextId: 1,
    lastHit: null,
  }
}

export function startGame(g: Game) {
  Object.assign(g, createGame(), { phase: 'playing', spawnIn: 0.55 })
}

export function multiplier(combo: number) {
  return 1 + Math.min(4, Math.floor(combo / 4))
}

export function rankFor(score: number): 'S' | 'A' | 'B' | 'C' {
  if (score >= 520) return 'S'
  if (score >= 320) return 'A'
  if (score >= 160) return 'B'
  return 'C'
}

const laneX = () => 0.2 + Math.random() * 0.6

export function step(g: Game, dt: number): GameEvent[] {
  const ev: GameEvent[] = []
  if (g.phase !== 'playing') return ev
  const d = Math.min(dt, 0.05)
  g.elapsed += d
  g.timeLeft = Math.max(0, g.timeLeft - d)

  // spawn: pace tightens over the round
  g.spawnIn -= d
  if (g.spawnIn <= 0) {
    const ramp = Math.min(1, g.elapsed / ROUND)
    const count = ramp > 0.45 && Math.random() < 0.22 ? 2 : 1
    for (let i = 0; i < count; i++) {
      g.oats.push({
        id: g.nextId++,
        x: laneX(),
        y: -0.08,
        vy: 0.4 + ramp * 0.24 + Math.random() * 0.05,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 2.4,
      })
    }
    g.spawnIn = 0.92 - ramp * 0.42 - Math.random() * 0.08
  }

  for (const o of g.oats) {
    o.y += o.vy * d
    o.rot += o.spin * d
  }

  // oats that slip past the gate ring the bell
  for (let i = g.oats.length - 1; i >= 0; i--) {
    const o = g.oats[i]
    if (o.y > 1.08) {
      g.oats.splice(i, 1)
      g.lives -= 1
      g.combo = 0
      g.misses += 1
      ev.push({ type: 'miss', x: o.x })
      if (g.lives <= 0) {
        g.lives = 0
        g.phase = 'result'
        break // one bell ends the gate, never two in the same frame
      }
    }
  }

  if (g.timeLeft <= 0 && g.phase === 'playing') g.phase = 'result'
  if (g.phase === 'result') ev.push({ type: 'end' })
  return ev
}

/** One snip. Returns what it caught — null when the round is not running. */
export function strike(g: Game): GameEvent | null {
  if (g.phase !== 'playing') return null

  let best: Oat | null = null
  let bestD = Infinity
  for (const o of g.oats) {
    const d = Math.abs(o.y - CUT)
    if (d < bestD) {
      bestD = d
      best = o
    }
  }

  const mult = multiplier(g.combo)
  if (best && bestD <= PERFECT_WINDOW) {
    g.oats.splice(g.oats.indexOf(best), 1)
    g.combo += 1
    g.bestCombo = Math.max(g.bestCombo, g.combo)
    g.perfects += 1
    g.score += 3 * mult
    g.glyphs += 1
    g.lastHit = 'perfect'
    if (g.glyphs >= GLYPHS_FOR_SUTRA) {
      g.glyphs = 0
      g.sutras += 1
      g.score += 40
      return { type: 'sutra', x: best.x }
    }
    return { type: 'perfect', x: best.x }
  }
  if (best && bestD <= GOOD_WINDOW) {
    g.oats.splice(g.oats.indexOf(best), 1)
    g.combo += 1
    g.bestCombo = Math.max(g.bestCombo, g.combo)
    g.goods += 1
    g.score += 1 * mult
    g.lastHit = 'good'
    return { type: 'good', x: best.x }
  }

  // empty swing: no score, the chain breaks, so mashing is a losing line
  g.combo = 0
  g.lastHit = null
  return { type: 'whiff' }
}
