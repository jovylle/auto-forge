export type RunnerId = 0 | 1 | 2;

export interface RunnerSpec {
  name: string;
  bike: string;
  blurb: string;
  /** speed multiplier while active */
  speed: number;
  /** stamina drained per second */
  drain: number;
  /** pickup magnet radius in lanes */
  magnet: number;
}

export const RUNNERS: readonly [RunnerSpec, RunnerSpec, RunnerSpec] = [
  { name: 'JOLT', bike: 'dart-bike', blurb: 'Fast + twitchy. Drinks stamina.', speed: 1.18, drain: 7.5, magnet: 0.35 },
  { name: 'MIRAGE', bike: 'sand-skiff', blurb: 'Balanced cruiser. Sips stamina.', speed: 1.0, drain: 5.0, magnet: 0.6 },
  { name: 'HAULER', bike: 'dune-crawler', blurb: 'Slow + wide pickup net.', speed: 0.86, drain: 3.4, magnet: 1.0 },
];

export interface Obstacle {
  lane: number;
  at: number;
  hit: boolean;
}

export interface Cell {
  lane: number;
  at: number;
  taken: boolean;
}

export interface Gate {
  at: number;
  lane: number;
  resolved: boolean;
  clean: boolean;
}

export type SimEvent = 'pickup' | 'crash' | 'switch' | 'gate' | 'miss' | 'leg' | 'bonk' | 'over';

export interface RunStats {
  distance: number;
  score: number;
  cells: number;
  gates: number;
  switches: number;
  leg: number;
  topSpeed: number;
  seed: number;
}

export const LEG_METERS = 400;
export const MAX_HEAT = 3;
