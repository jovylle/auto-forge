export type PhaseId = 'inhale' | 'hold' | 'exhale'

export interface PhaseDef {
  id: PhaseId
  duration: number
}

export const PHASES: [PhaseDef, PhaseDef, PhaseDef] = [
  { id: 'inhale', duration: 4 },
  { id: 'hold', duration: 4 },
  { id: 'exhale', duration: 6 },
]

function phaseDef(idx: number): PhaseDef {
  return PHASES[idx] ?? PHASES[0]
}

export interface Seed {
  x: number
  y: number
  r: number
  t: number
  born: number
}

export interface MossData {
  coverage: number
  lushness: number
  calmSeconds: number
  cycles: number
  seedRng: number
  seeds: Seed[]
}

export interface BreathData {
  running: boolean
  started: boolean
  phaseIdx: number
  phaseEndAt: number
  remainingAtPause: number
  cycles: number
}

export interface StillData {
  score: number
  peak: number
  best: number
  lastKeyAt: number
  lastInputAt: number
  lastMouse: { x: number; y: number; t: number } | null
}

export interface SimState {
  moss: MossData
  breath: BreathData
  still: StillData
  resetArmedAt: number
}

export const MAX_SEEDS = 420
export const SEED_DENSITY = 2.2
export const AGITATION_GAP_MS = 650
export const AGITATION_PENALTY = 3
export const MAX_DT = 0.5

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function initialSeeds(now: number): Seed[] {
  const rng = mulberry32(0x0c10)
  const cx = 0.38
  const cy = 0.62
  const seeds: Seed[] = []
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2
    const d = Math.sqrt(rng()) * 0.17
    seeds.push({
      x: clamp(cx + Math.cos(a) * d, 0.04, 0.96),
      y: clamp(cy + Math.sin(a) * d, 0.04, 0.96),
      r: 0.02 + rng() * 0.022,
      t: Math.floor(rng() * 3),
      born: now - 4000 - rng() * 5000,
    })
  }
  return seeds
}

export type SaveLike = Partial<Pick<MossData, 'coverage' | 'lushness' | 'calmSeconds' | 'cycles' | 'seedRng' | 'seeds'>> & { best?: number }

export function createSim(save: SaveLike | null, now = Date.now()): SimState {
  const seeds = save && Array.isArray(save.seeds) && save.seeds.length > 0 ? save.seeds : null
  const coverage = seeds && save ? save.coverage ?? 4 : 4
  const lushness = seeds && save ? save.lushness ?? 0 : 0
  const calmSeconds = seeds && save ? save.calmSeconds ?? 0 : 0
  const cycles = seeds && save ? save.cycles ?? 0 : 0
  const seedRng = seeds && save ? save.seedRng ?? 0xc0ffee : 0xc0ffee
  const best = save ? save.best ?? 0 : 0
  return {
    moss: {
      coverage,
      lushness,
      calmSeconds,
      cycles,
      seedRng,
      seeds: seeds ?? initialSeeds(now),
    },
    breath: {
      running: false,
      started: false,
      phaseIdx: 0,
      phaseEndAt: now,
      remainingAtPause: 0,
      cycles: 0,
    },
    still: {
      score: 40,
      peak: 40,
      best,
      lastKeyAt: now,
      lastInputAt: now,
      lastMouse: null,
    },
    resetArmedAt: 0,
  }
}

function spawnSeeds(moss: MossData, now: number): void {
  const target = Math.min(MAX_SEEDS, Math.floor(moss.coverage * SEED_DENSITY))
  if (moss.seeds.length === 0) return
  while (moss.seeds.length < target) {
    moss.seedRng = (moss.seedRng + 0x9e3779b9) >>> 0
    const rng = mulberry32(moss.seedRng)
    const anchor = moss.seeds[Math.floor(rng() * moss.seeds.length)]
    const a = rng() * Math.PI * 2
    const dist = anchor.r * (0.6 + rng() * 1.1)
    moss.seeds.push({
      x: clamp(anchor.x + Math.cos(a) * dist, 0.03, 0.97),
      y: clamp(anchor.y + Math.sin(a) * dist, 0.03, 0.97),
      r: 0.018 + rng() * 0.024,
      t: Math.floor(rng() * 3),
      born: now,
    })
  }
}

export function tickSim(sim: SimState, dt: number, now: number): void {
  const { moss, breath, still } = sim

  if (breath.running) {
    let remaining = breath.phaseEndAt - now
    let transitions = 0
    while (remaining <= 0 && transitions < 60) {
      transitions += 1
      breath.phaseIdx += 1
      if (breath.phaseIdx >= PHASES.length) {
        breath.phaseIdx = 0
        breath.cycles += 1
        moss.cycles += 1
        const reward = 0.7 + (still.score / 100) * 0.8
        moss.coverage = clamp(moss.coverage + reward, 0, 100)
        moss.lushness = clamp(moss.lushness + 1.3, 0, 100)
        spawnSeeds(moss, now)
      }
      remaining += PHASES[breath.phaseIdx].duration * 1000
    }
    if (remaining <= 0) remaining = 0
    breath.phaseEndAt = now + remaining
  }

  let rate = 0
  if (breath.running) {
    rate = breath.phaseIdx === 1 ? 2.2 : breath.phaseIdx === 0 ? 1.2 : 0.9
  } else if (now - still.lastInputAt > 20000) {
    rate = 0.6
  }
  if (rate > 0) still.score = clamp(still.score + rate * dt, 0, 100)
  still.peak = Math.max(still.peak, still.score)
  still.best = Math.max(still.best, still.score)

  if (breath.running || still.score >= 50) moss.calmSeconds += dt

  const calmFactor = 0.4 + still.score / 100
  if (still.score < 30) {
    moss.coverage = clamp(moss.coverage - 0.05 * dt, 0, 100)
    moss.lushness = clamp(moss.lushness - 0.09 * dt, 0, 100)
  } else {
    const growth = 0.03 * calmFactor + (breath.running ? 0.02 : 0)
    moss.coverage = clamp(moss.coverage + growth * dt, 0, 100)
    moss.lushness = clamp(moss.lushness + 0.05 * dt * calmFactor, 0, 100)
  }
  spawnSeeds(moss, now)
}

export function startBreath(sim: SimState, now: number): void {
  const b = sim.breath
  b.started = true
  b.running = true
  b.phaseIdx = 0
  b.phaseEndAt = now + PHASES[0].duration * 1000
  b.remainingAtPause = 0
  b.cycles = 0
}

export function pauseBreath(sim: SimState, now: number): void {
  const b = sim.breath
  if (!b.running) return
  b.remainingAtPause = Math.max(0, b.phaseEndAt - now)
  b.running = false
}

export function resumeBreath(sim: SimState, now: number): void {
  const b = sim.breath
  if (b.running || !b.started) return
  b.running = true
  b.phaseEndAt = now + (b.remainingAtPause > 0 ? b.remainingAtPause : PHASES[b.phaseIdx].duration * 1000)
}

export function toggleBreath(sim: SimState, now: number): void {
  const b = sim.breath
  if (!b.started) startBreath(sim, now)
  else if (b.running) pauseBreath(sim, now)
  else resumeBreath(sim, now)
}

export function shiftPhase(sim: SimState, dir: 1 | -1, now: number): void {
  const b = sim.breath
  if (!b.started) {
    startBreath(sim, now)
    return
  }
  b.phaseIdx = (b.phaseIdx + dir + PHASES.length) % PHASES.length
  if (b.running) b.phaseEndAt = now + PHASES[b.phaseIdx].duration * 1000
  else b.remainingAtPause = PHASES[b.phaseIdx].duration * 1000
}

export function noteKey(sim: SimState, now: number): void {
  const s = sim.still
  const gap = now - s.lastKeyAt
  if (gap < AGITATION_GAP_MS) s.score = clamp(s.score - AGITATION_PENALTY, 0, 100)
  else s.score = clamp(s.score + 1, 0, 100)
  s.lastKeyAt = now
  s.lastInputAt = now
}

export function noteMouse(sim: SimState, x: number, y: number, now: number): void {
  const s = sim.still
  if (s.lastMouse) {
    const dtm = now - s.lastMouse.t
    const dist = Math.hypot(x - s.lastMouse.x, y - s.lastMouse.y)
    if (dtm < 250 && dist > 90) s.score = clamp(s.score - 1.5, 0, 100)
  }
  const m = s.lastMouse ?? { x, y, t: now }
  m.x = x
  m.y = y
  m.t = now
  s.lastMouse = m
  s.lastInputAt = now
}

export function noteHidden(sim: SimState): void {
  sim.still.score = clamp(sim.still.score - 8, 0, 100)
  sim.still.lastInputAt = Date.now()
}

export function wipeSim(sim: SimState, now: number): void {
  sim.moss = {
    coverage: 4,
    lushness: 0,
    calmSeconds: 0,
    cycles: 0,
    seedRng: 0xc0ffee,
    seeds: initialSeeds(now),
  }
  sim.breath = {
    running: false,
    started: false,
    phaseIdx: 0,
    phaseEndAt: now,
    remainingAtPause: 0,
    cycles: 0,
  }
  sim.still = { score: 40, peak: 40, best: 0, lastKeyAt: now, lastInputAt: now, lastMouse: null }
  sim.resetArmedAt = 0
}

export interface PhaseView {
  id: PhaseId
  remaining: number
  duration: number
  progress: number
}

export function phaseOf(sim: SimState, now: number): PhaseView {
  const b = sim.breath
  const def = PHASES[b.phaseIdx]
  if (!b.started) return { id: def.id, remaining: def.duration, duration: def.duration, progress: 0 }
  const remainingMs = b.running ? Math.max(0, b.phaseEndAt - now) : b.remainingAtPause
  const remaining = remainingMs / 1000
  const progress = 1 - clamp(remaining / def.duration, 0, 1)
  return { id: def.id, remaining, duration: def.duration, progress }
}

export function formatCalm(totalSeconds: number): string {
  const s = Math.floor(totalSeconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${String(r).padStart(2, '0')}s`
}

export function formatPct(v: number): string {
  return `${v.toFixed(1)}%`
}