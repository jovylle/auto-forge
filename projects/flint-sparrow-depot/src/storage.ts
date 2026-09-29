import type { DepotState, Dispatch, LogEntry, Sparrow } from './types.ts';

const KEY = 'flint-sparrow-depot:v1';

const NAMES = ['Flint', 'Cinder', 'Tinder', 'Soot', 'Ember', 'Pebble'];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function seed(): DepotState {
  const now = Date.now();
  const sparrows: Sparrow[] = NAMES.slice(0, 4).map((name, i) => ({
    id: uid('spw'),
    name,
    state: 'ROOSTING',
    stamina: 90 - i * 8,
    trips: i,
  }));
  const dispatches: Dispatch[] = [
    {
      id: uid('dsp'),
      crate: 'CRATE 01',
      recipient: 'North Crag Lookout',
      note: 'Storm rolling in from the east. Shutter the high perches before dusk.',
      priority: 'URGENT',
      status: 'QUEUED',
      sparrowId: null,
      createdAt: now - 1000 * 60 * 42,
      dispatchedAt: null,
      deliveredAt: null,
    },
    {
      id: uid('dsp'),
      crate: 'CRATE 02',
      recipient: 'Miller Fen Post',
      note: 'Grain tally confirmed: forty-two sacks. Send twine and two spare flints.',
      priority: 'STANDARD',
      status: 'QUEUED',
      sparrowId: null,
      createdAt: now - 1000 * 60 * 18,
      dispatchedAt: null,
      deliveredAt: null,
    },
  ];
  const log: LogEntry[] = [
    {
      id: uid('log'),
      at: now - 1000 * 60 * 60,
      kind: 'HATCH',
      sparrowId: sparrows[0]?.id ?? null,
      dispatchId: null,
      text: `${sparrows[0]?.name ?? 'Flint'} joined the roost. Wings certified.`,
    },
    {
      id: uid('log'),
      at: now - 1000 * 60 * 42,
      kind: 'QUEUE',
      sparrowId: null,
      dispatchId: dispatches[0]?.id ?? null,
      text: 'CRATE 01 queued for North Crag Lookout. Marked URGENT.',
    },
    {
      id: uid('log'),
      at: now - 1000 * 60 * 18,
      kind: 'QUEUE',
      sparrowId: null,
      dispatchId: dispatches[1]?.id ?? null,
      text: 'CRATE 02 queued for Miller Fen Post.',
    },
  ];
  return { sparrows, dispatches, log, crateCounter: 3 };
}

export function load(): DepotState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as DepotState;
    if (!Array.isArray(parsed.sparrows) || !Array.isArray(parsed.dispatches) || !Array.isArray(parsed.log)) {
      throw new Error('bad shape');
    }
    const statuses = new Set(['QUEUED', 'IN-FLIGHT', 'DELIVERED']);
    const priorities = new Set(['LOW', 'STANDARD', 'URGENT']);
    const sparrowStates = new Set(['ROOSTING', 'FLYING', 'RESTING']);
    const sane =
      parsed.dispatches.every(
        (d) => statuses.has((d as Dispatch).status) && priorities.has((d as Dispatch).priority),
      ) && parsed.sparrows.every((s) => sparrowStates.has((s as Sparrow).state));
    if (!sane) throw new Error('bad enums');
    parsed.log = parsed.log.slice(-200);
    return parsed;
  } catch {
    const s = seed();
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage full — run in-memory */
    }
    return s;
  }
}

export function save(state: DepotState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, log: state.log.slice(-200) }));
  } catch {
    /* ignore quota errors */
  }
}

export function newId(prefix: string): string {
  return uid(prefix);
}
