import { mulberry32, hashStr } from './random'

export const MIN_FREQ = 87.5
export const MAX_FREQ = 108.0
export const OWN_FREQ = 101.3

export type Source = 'ether' | 'yours'

export type Signal = {
  id: string
  freq: number
  callsign: string
  message: string
  strength: number
  source: Source
  at: number
}

export const POOL = [
  'they played our song at the gas station, 2am',
  'the lighthouse was dark tonight, first time in my life',
  'if you read this, call your mother',
  'i buried the keys under the rain barrel, like we said',
  'snow on the highway, truckers talk in codes',
  'every radio in this town is a grave with a mouth',
  'the bees came back to the empty lot',
  'i learned to whistle with a blade of grass',
  'last transmission from the valley was static and a lullaby',
  'the diner closed, but the sign still hums',
  'copper wire in my hands remembers your voice',
  'we were never supposed to meet like this',
  'the orchard is blooming again, no one left to see',
  'i left the door unlocked on purpose',
  'three dogs barked at the moon and the moon barked back',
  'the river rose and took the old bridge',
  'my grandmother said the air remembers everything',
  'do not trust the static between 2 and 3 am',
  'i tuned in and heard my own funeral',
  'the aurora was purple tonight, like a bruise',
  'someone left bread for the crows again',
  'the payphone rings when it rains',
  'i am the voice you heard, and i am fine',
  'the tapes hissed their secrets, we just had to listen',
]

const CALLSIGNS = [
  'HUSH-3',
  'KNOX-7',
  'WORM-9',
  'DEAD-4',
  'MER-2',
  'FAR-6',
  'WISP-8',
  'GLOW-1',
  'DRIFT-5',
  'VANE-3',
  'SIGH-7',
  'ORE-9',
  'MOTE-2',
  'LOW-4',
  'TIDE-8',
  'CLAY-6',
  'DUST-3',
  'ASH-5',
  'REED-7',
  'SLOW-9',
  'HUM-2',
  'PULSE-4',
  'WAIT-6',
  'GONE-8',
  'STILL-3',
  'NIGH-5',
]

export function dailySeed(): string {
  return new Date().toISOString().slice(0, 10)
}

function pick<T>(rnd: () => number, arr: T[]): T {
  const i = Math.floor(rnd() * arr.length)
  return arr[i] as T
}

function roundFreq(f: number): number {
  return Math.round(f * 10) / 10
}

export function generateEtherStations(seed: string = dailySeed()): Signal[] {
  const rnd = mulberry32(hashStr('ether:' + seed))
  const stations: Signal[] = []
  const taken = new Set<number>()
  const calls = new Set<string>()
  const usedPhrases = new Set<string>()

  const add = (freq: number) => {
    const f = roundFreq(freq)
    if (f < MIN_FREQ || f > MAX_FREQ || taken.has(f)) return
    taken.add(f)
    let callsign = pick(rnd, CALLSIGNS)
    let guard = 0
    while (calls.has(callsign) && guard++ < 12) callsign = pick(rnd, CALLSIGNS)
    calls.add(callsign)
    let msg = pick(rnd, POOL)
    let g = 0
    while (usedPhrases.has(msg) && g++ < 8) msg = pick(rnd, POOL)
    usedPhrases.add(msg)
    stations.push({
      id: `eth:${seed}:${f}`,
      freq: f,
      callsign,
      message: msg,
      strength: 2 + Math.floor(rnd() * 3),
      source: 'ether',
      at: Date.now() - Math.floor(rnd() * 3 * 3600_000),
    })
  }

  add(95.1)
  while (stations.length < 12) {
    const f = MIN_FREQ + rnd() * (MAX_FREQ - MIN_FREQ)
    if (Math.abs(f - OWN_FREQ) < 0.6) continue
    add(f)
  }

  return stations.sort((a, b) => a.freq - b.freq)
}

export function fmtFreq(f: number): string {
  return f.toFixed(1)
}