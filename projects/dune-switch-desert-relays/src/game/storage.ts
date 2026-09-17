import type { RunStats } from './types';

export interface BoardEntry {
  score: number;
  distance: number;
  cells: number;
  gates: number;
  seed: number;
  date: string;
}

const BEST_KEY = 'dune-switch:best';
const BOARD_KEY = 'dune-switch:board';
const MUTE_KEY = 'dune-switch:muted';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked — non-fatal */
  }
}

export function loadBest(): RunStats | null {
  return read<RunStats | null>(BEST_KEY, null);
}

export function saveBest(s: RunStats): boolean {
  const prev = loadBest();
  if (prev && prev.score >= s.score) return false;
  write(BEST_KEY, s);
  return true;
}

export function loadBoard(): BoardEntry[] {
  return read<BoardEntry[]>(BOARD_KEY, []);
}

export function pushBoard(s: RunStats): BoardEntry[] {
  const board = loadBoard();
  board.push({
    score: s.score,
    distance: s.distance,
    cells: s.cells,
    gates: s.gates,
    seed: s.seed,
    date: new Date().toISOString().slice(0, 10),
  });
  board.sort((a, b) => b.score - a.score);
  const top = board.slice(0, 5);
  write(BOARD_KEY, top);
  return top;
}

export function clearBoard(): void {
  write(BOARD_KEY, []);
  write(BEST_KEY, null);
}

export function loadMuted(): boolean {
  return read<boolean>(MUTE_KEY, false);
}

export function saveMuted(m: boolean): void {
  write(MUTE_KEY, m);
}
