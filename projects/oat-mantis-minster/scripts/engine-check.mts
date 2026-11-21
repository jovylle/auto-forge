// Self-check for the pure game rules. Run: npm run check
import assert from 'node:assert/strict'
import {
  CUT,
  LIVES,
  ROUND,
  createGame,
  multiplier,
  rankFor,
  startGame,
  step,
  strike,
} from '../src/game/engine.ts'

const g = createGame()
assert.equal(g.phase, 'title')

startGame(g)
assert.equal(g.phase, 'playing')
assert.equal(g.timeLeft, ROUND)

// one oat parked on the line → perfect
g.oats = [{ id: 1, x: 0.5, y: CUT, vy: 0.4, rot: 0, spin: 0 }]
const perfect = strike(g)
assert.equal(perfect?.type, 'perfect')
assert.equal(g.perfects, 1)
assert.equal(g.glyphs, 1)
assert.equal(g.score, 3)
assert.equal(g.combo, 1)

// good window is forgiving but worth less
g.combo = 0
g.oats = [{ id: 2, x: 0.5, y: CUT + 0.06, vy: 0.4, rot: 0, spin: 0 }]
assert.equal(strike(g)?.type, 'good')
assert.equal(g.score, 4)

// empty swing breaks the chain and scores nothing
g.combo = 5
assert.equal(strike(g)?.type, 'whiff')
assert.equal(g.combo, 0)
assert.equal(g.score, 4)

// six perfects seal a sutra and pay a bonus
g.combo = 0
g.glyphs = 5
g.oats = [{ id: 3, x: 0.5, y: CUT, vy: 0.4, rot: 0, spin: 0 }]
assert.equal(strike(g)?.type, 'sutra')
assert.equal(g.sutras, 1)
assert.equal(g.glyphs, 0)

// multiplier caps at x5
assert.equal(multiplier(0), 1)
assert.equal(multiplier(4), 2)
assert.equal(multiplier(100), 5)

// an oat that falls past the gate costs a lantern and ends the run at zero
g.oats = [{ id: 4, x: 0.5, y: 1.05, vy: 1, rot: 0, spin: 0 }]
const events = step(g, 0.05)
assert.ok(events.some((e) => e.type === 'miss'))
assert.equal(g.lives, LIVES - 1)

g.lives = 1
g.oats = [{ id: 5, x: 0.5, y: 1.05, vy: 1, rot: 0, spin: 0 }]
step(g, 0.05)
assert.equal(g.phase, 'result')

// two oats leaving in the same frame ring one bell, not two
const g2 = createGame()
startGame(g2)
g2.lives = 1
g2.oats = [
  { id: 8, x: 0.4, y: 1.05, vy: 1, rot: 0, spin: 0 },
  { id: 9, x: 0.6, y: 1.05, vy: 1, rot: 0, spin: 0 },
]
const lastBell = step(g2, 0.05)
assert.equal(lastBell.filter((e) => e.type === 'miss').length, 1)
assert.equal(g2.lives, 0)
assert.equal(g2.misses, 1)

// score → rank bands
assert.equal(rankFor(0), 'C')
assert.equal(rankFor(160), 'B')
assert.equal(rankFor(320), 'A')
assert.equal(rankFor(520), 'S')

console.log('engine ok:', { score: g.score, rank: 'S', phase: g.phase })
