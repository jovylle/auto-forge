export interface FareEntry {
  id: string;
  time: number;
  routeId: string;
  label: string;
  cents: number;
  voided: boolean;
}

export interface Route {
  id: string;
  name: string;
  stops: string[];
}

export const ROUTES: Route[] = [
  { id: 'owl', name: 'Owl Line', stops: ['Depot', 'Old Mill', 'Canal St'] },
  { id: 'harbor', name: 'Harbor Loop', stops: ['Pier 9', 'Fishmarket', 'Lighthouse'] },
  { id: 'ember', name: 'Ember Run', stops: ['Kiln Yard', 'Ash Row', 'Night Market'] },
  { id: 'veil', name: 'Veil Express', stops: ['Northgate', 'Observatory'] },
];

export const FARES: { label: string; cents: number }[] = [
  { label: '25¢', cents: 25 },
  { label: '50¢', cents: 50 },
  { label: '$1', cents: 100 },
  { label: '$2', cents: 200 },
  { label: '$3', cents: 300 },
];

const KEY = 'midnight-trolley-ledger:v1';

export interface Persisted {
  entries: FareEntry[];
  routeId: string;
  settled: { time: number; total: number }[];
}

function validEntry(e: unknown): e is FareEntry {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.time === 'number' &&
    typeof o.routeId === 'string' &&
    typeof o.label === 'string' &&
    typeof o.cents === 'number' &&
    typeof o.voided === 'boolean'
  );
}

export function load(): Persisted {
  const empty: Persisted = { entries: [], routeId: 'owl', settled: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      entries: Array.isArray(p.entries) ? p.entries.filter(validEntry).slice(0, 1000) : [],
      routeId: typeof p.routeId === 'string' && ROUTES.some((r) => r.id === p.routeId) ? p.routeId : 'owl',
      settled: Array.isArray(p.settled)
        ? p.settled.filter(
            (s): s is { time: number; total: number } =>
              typeof s === 'object' && s !== null &&
              typeof (s as { time: unknown }).time === 'number' &&
              typeof (s as { total: unknown }).total === 'number',
          ).slice(0, 24)
        : [],
    };
  } catch {
    return empty;
  }
}

export function save(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full — ignore */
  }
}

export function fmtCents(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  const a = Math.abs(cents);
  return `${sign}$${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
