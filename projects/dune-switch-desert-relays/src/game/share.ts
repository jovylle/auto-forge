import type { RunStats } from './types';

export function buildShareText(s: RunStats): string {
  return (
    `🏜 DUNE SWITCH — desert relays\n` +
    `${s.distance}m · ${s.score}pts · LEG ${s.leg}\n` +
    `▸ ${s.cells} sun-cells · ${s.gates} clean gates · ${s.switches} baton passes\n` +
    `Seed ${s.seed} — beat my relay: ${buildShareUrl(s.seed)}`
  );
}

export function buildShareUrl(seed: number): string {
  const base = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  return `${base}?seed=${seed}`;
}

export function seedFromUrl(): number {
  try {
    const q = new URLSearchParams(window.location.search).get('seed');
    const n = q ? parseInt(q, 10) : NaN;
    if (Number.isFinite(n) && (n as number) > 0) return n as number;
  } catch {
    /* ignore */
  }
  return (Math.random() * 1e9) >>> 0 || 7;
}

export function exportRun(s: RunStats): string {
  return JSON.stringify({ game: 'dune-switch', version: 1, run: s }, null, 2);
}

export function importRun(json: string): RunStats | null {
  try {
    const obj = JSON.parse(json) as { game?: string; run?: RunStats };
    if (obj.game !== 'dune-switch' || !obj.run) return null;
    const r = obj.run;
    if (typeof r.score !== 'number' || typeof r.seed !== 'number') return null;
    return r;
  } catch {
    return null;
  }
}
