import { LEG_METERS, MAX_HEAT, RUNNERS } from './types';
import type { Cell, Gate, Obstacle, RunStats, RunnerId, SimEvent } from './types';

/** Deterministic RNG so share-URLs can replay the same dunes. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SteerInput {
  steer: -1 | 0 | 1;
  switchTo: RunnerId | null;
}

const SPAWN_AHEAD = 260;
const HIT_WINDOW = 2.4;

export class RelaySim {
  seed: number;
  private rng: () => number;
  status: 'ready' | 'running' | 'over' = 'ready';
  overCause: '' | 'wrecked' | 'heat' = '';

  lane = 0; // float position in lane units (-1..1)
  targetLane = 1; // 0 | 1 | 2
  active: RunnerId = 1;
  stamina: [number, number, number] = [100, 100, 100];
  heat = 0;
  iframes = 0;
  boost = 0;
  slow = 0;

  speed = 0;
  distance = 0;
  cellsTaken = 0;
  gatesClean = 0;
  switches = 0;
  topSpeed = 0;
  leg = 1;

  obstacles: Obstacle[] = [];
  cells: Cell[] = [];
  gates: Gate[] = [];
  events: SimEvent[] = [];
  private nextSpawnAt = 30;
  private elapsed = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0 || 1;
    this.rng = mulberry32(this.seed);
  }

  get score(): number {
    return Math.floor(this.distance * 2) + this.cellsTaken * 25 + this.gatesClean * 100;
  }

  get stats(): RunStats {
    return {
      distance: Math.floor(this.distance),
      score: this.score,
      cells: this.cellsTaken,
      gates: this.gatesClean,
      switches: this.switches,
      leg: this.leg,
      topSpeed: Math.round(this.topSpeed * 3.6),
      seed: this.seed,
    };
  }

  start(): void {
    this.status = 'running';
  }

  steer(dir: -1 | 1): void {
    if (this.status !== 'running') return;
    this.targetLane = Math.min(2, Math.max(0, this.targetLane + dir));
  }

  switchRunner(to: RunnerId): boolean {
    if (this.status !== 'running' || to === this.active) return false;
    this.active = to;
    this.switches += 1;
    this.iframes = Math.max(this.iframes, 1.0);
    this.boost = Math.max(this.boost, 0.8);
    this.events.push('switch');
    return true;
  }

  cycleRunner(): void {
    const order: RunnerId[] = [(this.active + 1) % 3 as RunnerId, (this.active + 2) % 3 as RunnerId];
    const freshest = order[0] as RunnerId;
    this.switchRunner(freshest);
  }

  update(rawDt: number): void {
    if (this.status !== 'running') return;
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;
    const spec = RUNNERS[this.active] as (typeof RUNNERS)[number];

    // lane easing (faster bike = snappier)
    const laneTarget = this.targetLane - 1;
    const ease = 1 - Math.exp(-dt * (7 + spec.speed * 3));
    this.lane += (laneTarget - this.lane) * ease;

    // speed model
    const base = 14 + Math.min(26, this.distance * 0.045);
    let target = base * spec.speed;
    if (this.stamina[this.active] as number <= 0) target *= 0.55;
    if (this.boost > 0) target *= 1.45;
    if (this.slow > 0) target *= 0.55;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * 2.2));
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.distance += this.speed * dt;

    // stamina: active drains, benched recover
    for (let i = 0 as RunnerId; i < 3; i++) {
      if (i === this.active) this.stamina[i] = Math.max(0, (this.stamina[i] as number) - spec.drain * dt);
      else this.stamina[i] = Math.min(100, (this.stamina[i] as number) + 4.5 * dt);
    }
    if ((this.stamina[this.active] as number) <= 0) this.autoRelay();

    this.iframes = Math.max(0, this.iframes - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.slow = Math.max(0, this.slow - dt);

    const leg = Math.floor(this.distance / LEG_METERS) + 1;
    if (leg !== this.leg) {
      this.leg = leg;
      this.events.push('leg');
    }

    this.spawnAhead();
    this.collide();
    this.gc();

    if (this.heat >= MAX_HEAT) {
      this.status = 'over';
      this.overCause = 'heat';
      this.events.push('over');
    }
  }

  private autoRelay(): void {
    let best: RunnerId = this.active;
    let bestVal = -1;
    for (let i = 0 as RunnerId; i < 3; i++) {
      if (i !== this.active && (this.stamina[i] as number) > bestVal) {
        bestVal = this.stamina[i] as number;
        best = i;
      }
    }
    if (bestVal > 15) {
      this.switchRunner(best);
    } else {
      // whole crew gassed: bonk, heat +1, crew catches breath
      this.heat += 1;
      this.stamina = [55, 55, 55];
      this.slow = Math.max(this.slow, 1.2);
      this.events.push('bonk');
      if (this.heat >= MAX_HEAT) {
        this.status = 'over';
        this.overCause = 'heat';
        this.events.push('over');
      }
    }
  }

  private spawnAhead(): void {
    while (this.nextSpawnAt < this.distance + SPAWN_AHEAD) {
      const at = this.nextSpawnAt;
      const r = this.rng;

      // relay gate every leg boundary
      const legIdx = Math.floor(at / LEG_METERS);
      const gateAt = legIdx * LEG_METERS + LEG_METERS;
      if (at >= gateAt - 12 && at < gateAt + 12 && !this.gates.some((g) => Math.abs(g.at - gateAt) < 20)) {
        this.gates.push({ at: gateAt, lane: Math.floor(r() * 3), resolved: false, clean: false });
        this.nextSpawnAt += 24;
        continue;
      }

      // obstacle row: block 1-2 lanes, never all 3
      const roll = r();
      const blocked = roll < 0.45 ? 1 : 2;
      const lanes = [0, 1, 2].sort(() => r() - 0.5);
      for (let i = 0; i < blocked; i++) {
        this.obstacles.push({ lane: lanes[i] as number, at: at + r() * 4, hit: false });
      }
      // sun-cell arc in a free lane
      const free = (lanes[2] as number) ?? 1;
      const arc = 2 + Math.floor(r() * 3);
      for (let i = 0; i < arc; i++) {
        this.cells.push({ lane: free, at: at + 6 + i * 6, taken: false });
      }
      const gap = 26 + r() * 26 - Math.min(14, this.distance * 0.01);
      this.nextSpawnAt += Math.max(20, gap);
    }
  }

  private playerLane(): number {
    // snap to target when close so dodges feel fair
    return Math.abs(this.lane - (this.targetLane - 1)) < 0.35 ? this.targetLane : Math.round(this.lane + 1);
  }

  private collide(): void {
    const pl = this.playerLane();
    const spec = RUNNERS[this.active] as (typeof RUNNERS)[number];

    for (const o of this.obstacles) {
      if (o.hit || Math.abs(o.at - this.distance) > HIT_WINDOW) continue;
      if (o.lane === pl) {
        o.hit = true;
        if (this.iframes > 0) continue;
        this.heat += 1;
        this.slow = Math.max(this.slow, 1.4);
        this.iframes = Math.max(this.iframes, 1.5);
        this.events.push('crash');
        if (this.heat >= MAX_HEAT) {
          this.status = 'over';
          this.overCause = 'wrecked';
          this.events.push('over');
          return;
        }
      }
    }

    for (const c of this.cells) {
      if (c.taken || Math.abs(c.at - this.distance) > HIT_WINDOW + 1.5) continue;
      const laneDist = Math.abs(c.lane - (this.lane + 1));
      if (laneDist <= 0.45 + spec.magnet * 0.4) {
        c.taken = true;
        this.cellsTaken += 1;
        this.stamina[this.active] = Math.min(100, (this.stamina[this.active] as number) + 4);
        this.events.push('pickup');
      }
    }

    for (const g of this.gates) {
      if (g.resolved || Math.abs(g.at - this.distance) > HIT_WINDOW + 1) continue;
      if (g.at <= this.distance + 1) {
        g.resolved = true;
        if (g.lane === pl) {
          g.clean = true;
          this.gatesClean += 1;
          this.boost = Math.max(this.boost, 2.0);
          this.stamina[this.active] = Math.min(100, (this.stamina[this.active] as number) + 25);
          this.events.push('gate');
        } else {
          this.events.push('miss');
        }
      }
    }
  }

  private gc(): void {
    const cut = this.distance - 12;
    this.obstacles = this.obstacles.filter((o) => o.at > cut);
    this.cells = this.cells.filter((c) => c.at > cut);
    this.gates = this.gates.filter((g) => g.at > cut);
  }
}
