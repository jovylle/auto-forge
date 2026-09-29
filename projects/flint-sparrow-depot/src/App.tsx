import { useEffect, useMemo, useRef, useState } from 'react';
import { FlightStrip, sparkBurst } from './components/flight.tsx';
import { load, newId, save } from './storage.ts';
import type { DepotState, Dispatch, DispatchStatus, Sparrow } from './types.ts';

const STATUS_STYLE: Record<DispatchStatus, { bg: string; label: string }> = {
  QUEUED: { bg: 'bg-ochre', label: 'Queued' },
  'IN-FLIGHT': { bg: 'bg-spark', label: 'In-flight' },
  DELIVERED: { bg: 'bg-teal', label: 'Delivered' },
};

const PRIORITY_STYLE: Record<Dispatch['priority'], string> = {
  LOW: 'bg-parchment',
  STANDARD: 'bg-ochre',
  URGENT: 'bg-spark',
};

function fmtTime(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function fmtDate(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App(): React.JSX.Element {
  const [state, setState] = useState<DepotState>(() => load());
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<Dispatch['priority']>('STANDARD');
  const [sparrowName, setSparrowName] = useState('');
  const [query, setQuery] = useState('');
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [flapId, setFlapId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const burstRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    if (!flapId) return;
    const t = window.setTimeout(() => setFlapId(null), 700);
    return () => window.clearTimeout(t);
  }, [flapId]);

  const sparrowById = useMemo(() => {
    const m = new Map<string, Sparrow>();
    for (const s of state.sparrows) m.set(s.id, s);
    return m;
  }, [state.sparrows]);

  const queued = state.dispatches.filter((d) => d.status === 'QUEUED');
  const flying = state.dispatches.filter((d) => d.status === 'IN-FLIGHT');
  const delivered = state.dispatches.filter((d) => d.status === 'DELIVERED');
  const roosting = state.sparrows.filter((s) => s.state === 'ROOSTING');

  const archive = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.dispatches]
      .filter((d) => d.status === 'DELIVERED')
      .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0))
      .filter(
        (d) =>
          q === '' ||
          d.recipient.toLowerCase().includes(q) ||
          d.note.toLowerCase().includes(q) ||
          d.crate.toLowerCase().includes(q),
      );
  }, [state.dispatches, query]);

  const visibleLog = useMemo(() => {
    return [...state.log]
      .sort((a, b) => b.at - a.at)
      .filter((e) => logFilter === 'ALL' || e.kind === logFilter)
      .slice(0, 60);
  }, [state.log, logFilter]);

  const tickerItems = useMemo(() => {
    const items = [...state.log].sort((a, b) => b.at - a.at).slice(0, 8);
    if (items.length === 0) return ['DEPOT OPEN — QUEUE YOUR FIRST CRATE'];
    return items.map((e) => `${fmtTime(e.at)} — ${e.text}`);
  }, [state.log]);

  const queueDispatch = (ev: React.FormEvent): void => {
    ev.preventDefault();
    if (recipient.trim() === '' || note.trim() === '') return;
    const crate = `CRATE ${String(state.crateCounter).padStart(2, '0')}`;
    const d: Dispatch = {
      id: newId('dsp'),
      crate,
      recipient: recipient.trim().slice(0, 80),
      note: note.trim().slice(0, 500),
      priority,
      status: 'QUEUED',
      sparrowId: null,
      createdAt: Date.now(),
      dispatchedAt: null,
      deliveredAt: null,
    };
    setState((s) => ({
      ...s,
      crateCounter: s.crateCounter + 1,
      dispatches: [d, ...s.dispatches],
      log: [
        ...s.log,
        { id: newId('log'), at: Date.now(), kind: 'QUEUE', sparrowId: null, dispatchId: d.id, text: `${crate} queued for ${d.recipient}. Marked ${priority}.` },
      ],
    }));
    setRecipient('');
    setNote('');
    setPriority('STANDARD');
  };

  const fireBurst = (ev: React.MouseEvent): void => {
    const board = boardRef.current;
    const canvas = burstRef.current;
    if (!board || !canvas) return;
    const b = board.getBoundingClientRect();
    sparkBurst(canvas, ev.clientX - b.left, ev.clientY - b.top);
  };

  const dispatchCrate = (id: string, ev: React.MouseEvent, sparrowId?: string): void => {
    const target = state.dispatches.find((d) => d.id === id);
    if (!target || target.status !== 'QUEUED') return;
    const pick =
      (sparrowId ? state.sparrows.find((s) => s.id === sparrowId) : undefined) ??
      [...state.sparrows]
        .filter((s) => s.state === 'ROOSTING' && s.stamina >= 20)
        .sort((a, b) => b.stamina - a.stamina)[0];
    if (!pick) return;
    fireBurst(ev);
    setFlapId(id);
    const now = Date.now();
    setState((s) => ({
      ...s,
      dispatches: s.dispatches.map((d) =>
        d.id === id ? { ...d, status: 'IN-FLIGHT', sparrowId: pick.id, dispatchedAt: now } : d,
      ),
      sparrows: s.sparrows.map((sp) =>
        sp.id === pick.id ? { ...sp, state: 'FLYING', stamina: Math.max(0, sp.stamina - 15) } : sp,
      ),
      log: [
        ...s.log,
        { id: newId('log'), at: now, kind: 'DISPATCH', sparrowId: pick.id, dispatchId: id, text: `${target.crate} away! ${pick.name} carries a flint note to ${target.recipient}.` },
      ],
    }));
  };

  const deliverCrate = (id: string): void => {
    const target = state.dispatches.find((d) => d.id === id);
    if (!target || target.status !== 'IN-FLIGHT') return;
    const now = Date.now();
    setState((s) => ({
      ...s,
      dispatches: s.dispatches.map((d) => (d.id === id ? { ...d, status: 'DELIVERED', deliveredAt: now } : d)),
      sparrows: s.sparrows.map((sp) =>
        sp.id === target.sparrowId
          ? { ...sp, state: 'RESTING', stamina: Math.min(100, sp.stamina + 5), trips: sp.trips + 1 }
          : sp,
      ),
      log: [
        ...s.log,
        { id: newId('log'), at: now, kind: 'DELIVER', sparrowId: target.sparrowId, dispatchId: id, text: `${target.crate} delivered to ${target.recipient}. Note sealed in the archive.` },
      ],
    }));
  };

  const recallCrate = (id: string): void => {
    const target = state.dispatches.find((d) => d.id === id);
    if (!target || target.status !== 'IN-FLIGHT') return;
    const now = Date.now();
    setState((s) => ({
      ...s,
      dispatches: s.dispatches.map((d) =>
        d.id === id ? { ...d, status: 'QUEUED', sparrowId: null, dispatchedAt: null } : d,
      ),
      sparrows: s.sparrows.map((sp) => (sp.id === target.sparrowId ? { ...sp, state: 'ROOSTING' } : sp)),
      log: [
        ...s.log,
        { id: newId('log'), at: now, kind: 'RETURN', sparrowId: target.sparrowId, dispatchId: id, text: `${target.crate} recalled to the depot. Crate re-queued.` },
      ],
    }));
  };

  const dropCrate = (id: string): void => {
    setState((s) => ({
      ...s,
      dispatches: s.dispatches.filter((d) => d.id !== id),
    }));
  };

  const addSparrow = (ev: React.FormEvent): void => {
    ev.preventDefault();
    const name = sparrowName.trim().slice(0, 24);
    if (name === '') return;
    const sp: Sparrow = { id: newId('spw'), name, state: 'ROOSTING', stamina: 100, trips: 0 };
    setState((s) => ({
      ...s,
      sparrows: [...s.sparrows, sp],
      log: [...s.log, { id: newId('log'), at: Date.now(), kind: 'HATCH', sparrowId: sp.id, dispatchId: null, text: `${name} joined the roost. Wings certified.` }],
    }));
    setSparrowName('');
  };

  const restSparrow = (id: string): void => {
    setState((s) => ({
      ...s,
      sparrows: s.sparrows.map((sp) =>
        sp.id === id && sp.state === 'RESTING'
          ? { ...sp, state: 'ROOSTING', stamina: Math.min(100, sp.stamina + 25) }
          : sp,
      ),
    }));
  };

  const copyNote = (d: Dispatch): void => {
    const text = `${d.crate} — TO: ${d.recipient}\n${d.note}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).then(
        () => {
          setCopiedId(d.id);
          window.setTimeout(() => setCopiedId((c) => (c === d.id ? null : c)), 1400);
        },
        () => undefined,
      );
    }
  };

  return (
    <div className="min-h-screen">
      {/* ---------- MASTHEAD ---------- */}
      <header className="border-b-[5px] border-ink">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono2 text-xs tracking-[0.3em] uppercase">
                <span className="bg-ink text-bone px-2 py-1">Depot No. 07</span>
                <span className="ml-2 hidden sm:inline">Flint-post · same-day wings</span>
              </p>
              <h1 className="masthead-word mt-3 text-[clamp(3rem,8vw,6rem)]">
                Flint Sparrow
                <span className="mt-1 inline-block -rotate-1 border-[3px] border-ink bg-spark px-3 text-bone shadow-hard-sm">
                  Depot
                </span>
              </h1>
              <p className="mt-3 max-w-xl text-base font-medium sm:text-lg">
                Dispatch sparrows with flint notes. Queue a crate, strike the flint, and a bird
                carries your words across the ridge.
              </p>
            </div>
            <div className="flex items-center gap-3 border-[3px] border-ink bg-ochre p-3 shadow-hard-sm rotate-1">
              <div className="pixel-sparrow" aria-hidden="true" />
              <div className="font-mono2 text-xs uppercase leading-tight">
                <p>Roosting: {roosting.length}</p>
                <p>Queued: {queued.length}</p>
                <p>In-flight: {flying.length}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <FlightStrip />
        </div>
        {/* ticker */}
        <div className="overflow-hidden border-t-[3px] border-ink bg-ink text-bone" aria-label="Recent depot activity">
          <div className="ticker-track flex w-max gap-8 whitespace-nowrap py-2 font-mono2 text-xs uppercase">
            {[...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i} className="flex items-center gap-8">
                <span>{t}</span>
                <span className="text-spark">◆</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- MAIN GRID ---------- */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
          {/* ROOST RAIL */}
          <section aria-label="Roost" className="relative order-2 lg:order-1">
            <span className="vert-label absolute -left-1 top-2 hidden text-ink/70 xl:block" aria-hidden="true">
              Roost — 01
            </span>
            <div className="lg:sticky lg:top-6">
              <h2 className="font-display text-2xl uppercase">The Roost</h2>
              <p className="font-mono2 mt-1 text-xs uppercase opacity-70">Sparrows on standby</p>
              <ul className="mt-4 space-y-4">
                {state.sparrows.map((sp, i) => (
                  <li key={sp.id} className="brut-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg uppercase leading-none">{sp.name}</p>
                      <span
                        className={`chip ${sp.state === 'ROOSTING' ? 'bg-teal text-bone' : sp.state === 'FLYING' ? 'bg-spark text-bone' : 'bg-ochre'}`}
                      >
                        {sp.state}
                      </span>
                    </div>
                    <p className="font-mono2 mt-2 text-[0.7rem] uppercase opacity-70">
                      Bird {(i + 1).toString().padStart(2, '0')} · {sp.trips} trips
                    </p>
                    <div className="mt-2" role="img" aria-label={`${sp.name} stamina ${sp.stamina} percent`}>
                      <div className="h-3 border-2 border-ink bg-parchment">
                        <div
                          className={`h-full ${sp.stamina >= 50 ? 'bg-teal' : sp.stamina >= 20 ? 'bg-ochre' : 'bg-spark'}`}
                          style={{ width: `${sp.stamina}%` }}
                        />
                      </div>
                      <p className="font-mono2 mt-1 text-[0.7rem] uppercase">Stamina {sp.stamina}</p>
                    </div>
                    {sp.state === 'RESTING' && (
                      <button type="button" onClick={() => restSparrow(sp.id)} className="brut-btn mt-2 w-full bg-bone px-2 py-1 text-xs">
                        Rouse to roost
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form onSubmit={addSparrow} className="brut-card mt-4 bg-parchment p-3">
                <label htmlFor="new-sparrow" className="font-mono2 text-xs uppercase">
                  Hatch a sparrow
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="new-sparrow"
                    className="brut-input px-2 py-1 text-sm"
                    value={sparrowName}
                    onChange={(e) => setSparrowName(e.target.value)}
                    placeholder="Name — e.g. Slate"
                    maxLength={24}
                  />
                  <button type="submit" className="brut-btn bg-ink px-3 py-1 text-xs text-bone" disabled={sparrowName.trim() === ''}>
                    Add
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* DISPATCH BOARD */}
          <section aria-label="Dispatch board" className="relative order-1 lg:order-2">
            <span className="vert-label absolute -left-1 top-2 hidden text-ink/70 xl:block" aria-hidden="true">
              Dispatch — 02
            </span>
            <h2 className="font-display text-2xl uppercase sm:text-3xl">Dispatch Board</h2>
            <p className="font-mono2 mt-1 text-xs uppercase opacity-70">
              {queued.length} queued · {flying.length} in-flight · {delivered.length} delivered
            </p>

            <form onSubmit={queueDispatch} className="brut-card mt-4 bg-parchment p-4" aria-label="Queue a new dispatch">
              <p className="font-mono2 text-xs uppercase">New crate — flint note</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
                <div>
                  <label htmlFor="recipient" className="font-mono2 text-xs uppercase">
                    Recipient outpost
                  </label>
                  <input
                    id="recipient"
                    className="brut-input mt-1 px-2 py-1.5 text-sm"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g. North Crag Lookout"
                    maxLength={80}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="priority" className="font-mono2 text-xs uppercase">
                    Priority
                  </label>
                  <select
                    id="priority"
                    className="brut-select mt-1 px-2 py-1.5 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Dispatch['priority'])}
                  >
                    <option value="LOW">Low</option>
                    <option value="STANDARD">Standard</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor="note" className="font-mono2 text-xs uppercase">
                  Flint note
                </label>
                <textarea
                  id="note"
                  className="brut-area mt-1 min-h-20 px-2 py-1.5 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Strike it short and bright — the bird can only carry so much."
                  maxLength={500}
                  required
                />
              </div>
              <button type="submit" className="brut-btn mt-3 bg-spark px-4 py-2 text-sm text-bone">
                Queue crate ▲
              </button>
            </form>

            <div ref={boardRef} className="relative mt-6">
              <canvas ref={burstRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
              {flying.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-mono2 text-xs uppercase tracking-widest">▲ In-flight</h3>
                  <ul className="mt-2 space-y-4">
                    {flying.map((d) => (
                      <DispatchCard
                        key={d.id}
                        d={d}
                        sparrowName={d.sparrowId ? (sparrowById.get(d.sparrowId)?.name ?? '—') : '—'}
                        flap={flapId === d.id}
                        onDeliver={() => deliverCrate(d.id)}
                        onRecall={() => recallCrate(d.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="font-mono2 text-xs uppercase tracking-widest">◆ Queue</h3>
                {queued.length === 0 ? (
                  <div className="brut-card mt-2 flex items-center gap-4 p-4">
                    <div className="pixel-sparrow text-[8px]" aria-hidden="true" />
                    <p className="text-sm font-medium">Board clear. Queue a crate above and the roost will stir.</p>
                  </div>
                ) : (
                  <ul className="mt-2 space-y-4">
                    {[...queued]
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((d) => (
                        <DispatchCard
                          key={d.id}
                          d={d}
                          flap={flapId === d.id}
                          canDispatch={roosting.some((s) => s.stamina >= 20)}
                          onDispatch={(ev) => dispatchCrate(d.id, ev)}
                          onDrop={() => dropCrate(d.id)}
                        />
                      ))}
                  </ul>
                )}
                {roosting.length === 0 && queued.length > 0 && (
                  <p className="font-mono2 mt-3 border-2 border-dashed border-ink bg-ochre p-2 text-xs uppercase">
                    No sparrows roosting — every bird is out or resting. Rouse a rester to fly again.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* SPARROW LOG */}
          <section aria-label="Sparrow log" className="relative order-3">
            <span className="vert-label absolute -right-1 top-2 hidden text-ink/70 xl:block" aria-hidden="true">
              Log — 03
            </span>
            <div className="lg:sticky lg:top-6">
              <h2 className="font-display text-2xl uppercase">Sparrow Log</h2>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter log">
                {['ALL', 'QUEUE', 'DISPATCH', 'DELIVER', 'RETURN', 'HATCH'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLogFilter(k)}
                    aria-pressed={logFilter === k}
                    className={`chip cursor-pointer ${logFilter === k ? 'bg-ink text-bone' : 'bg-bone'}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <ol className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {visibleLog.length === 0 && (
                  <li className="brut-card p-3 text-sm">Nothing under this filter yet.</li>
                )}
                {visibleLog.map((e) => (
                  <li key={e.id} className="log-enter brut-card flex gap-3 p-3">
                    <div className="pixel-sparrow mt-1 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-mono2 text-[0.68rem] uppercase opacity-70">
                        {fmtDate(e.at)} · {fmtTime(e.at)} · {e.kind}
                        {e.sparrowId && sparrowById.get(e.sparrowId) ? ` · ${sparrowById.get(e.sparrowId)?.name}` : ''}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug font-medium">{e.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        {/* ---------- NOTE ARCHIVE ---------- */}
        <section aria-label="Note archive" className="relative mt-12 border-t-[5px] border-ink pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="masthead-word text-[clamp(2rem,5vw,3.5rem)]">
                Note <span className="bg-teal text-bone border-[3px] border-ink px-2 shadow-hard-sm inline-block rotate-1">Archive</span>
              </h2>
              <p className="font-mono2 mt-2 text-xs uppercase opacity-70">
                Every delivered flint note, sealed and shelved · {delivered.length} on file
              </p>
            </div>
            <div className="w-full max-w-sm">
              <label htmlFor="archive-search" className="font-mono2 text-xs uppercase">
                Search the shelves
              </label>
              <input
                id="archive-search"
                className="brut-input mt-1 px-2 py-1.5 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Recipient, crate, or a word from the note…"
              />
            </div>
          </div>
          {archive.length === 0 ? (
            <div className="brut-card mt-6 flex items-center gap-4 p-5">
              <div className="pixel-sparrow text-[10px]" aria-hidden="true" />
              <p className="text-sm font-medium">
                {delivered.length === 0
                  ? 'Shelves bare. Deliver a crate and its note will be shelved here.'
                  : 'No notes match that search. Loosen a word or two.'}
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {archive.map((d, i) => (
                <li
                  key={d.id}
                  className={`brut-card p-4 ${i % 3 === 1 ? 'sm:rotate-1' : i % 3 === 2 ? 'sm:-rotate-1' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono2 text-xs uppercase">{d.crate}</span>
                    <span className={`chip ${PRIORITY_STYLE[d.priority]}`}>{d.priority}</span>
                  </div>
                  <p className="font-display mt-2 text-lg uppercase leading-tight">To: {d.recipient}</p>
                  <p className="perf-rule font-mono2 mt-2 pt-2 text-[0.7rem] uppercase opacity-70">
                    {d.deliveredAt ? `Sealed ${fmtDate(d.deliveredAt)} · ${fmtTime(d.deliveredAt)}` : 'Sealed'}
                    {d.sparrowId && sparrowById.get(d.sparrowId) ? ` · via ${sparrowById.get(d.sparrowId)?.name}` : ''}
                  </p>
                  <blockquote className="mt-2 border-l-4 border-spark bg-parchment p-2 text-sm leading-snug">
                    {d.note}
                  </blockquote>
                  <div className="relative mt-3 flex items-center justify-between">
                    <button type="button" onClick={() => copyNote(d)} className="brut-btn bg-bone px-3 py-1 text-xs">
                      {copiedId === d.id ? 'Copied ✓' : 'Copy note'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dropCrate(d.id)}
                      className="brut-btn bg-ink px-3 py-1 text-xs text-bone"
                      aria-label={`Remove ${d.crate} from archive`}
                    >
                      Shred
                    </button>
                    <span className="stamp-in font-display pointer-events-none absolute -top-6 right-2 border-[3px] border-teal px-2 text-sm uppercase text-teal">
                      Filed
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t-[5px] border-ink bg-ink text-bone">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <p className="font-mono2 text-xs uppercase">Flint Sparrow Depot — depot no. 07 · all notes carried by wing</p>
          <p className="font-mono2 text-xs uppercase opacity-70">CSS + canvas only · no images harmed</p>
        </div>
      </footer>
    </div>
  );
}

interface CardProps {
  d: Dispatch;
  sparrowName?: string;
  flap?: boolean;
  canDispatch?: boolean;
  onDispatch?: (ev: React.MouseEvent) => void;
  onDeliver?: () => void;
  onRecall?: () => void;
  onDrop?: () => void;
}

function DispatchCard(props: CardProps): React.JSX.Element {
  const { d, sparrowName, flap, canDispatch, onDispatch, onDeliver, onRecall, onDrop } = props;
  const st = STATUS_STYLE[d.status];
  return (
    <li className={`brut-card p-4 ${flap === true ? 'flap-once' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono2 text-xs uppercase">{d.crate}</span>
        <span className="flex gap-1.5">
          <span className={`chip ${PRIORITY_STYLE[d.priority]}`}>{d.priority}</span>
          <span className={`chip ${st.bg} ${d.status === 'QUEUED' ? '' : 'text-bone'}`}>{st.label}</span>
        </span>
      </div>
      <p className="font-display mt-2 text-xl uppercase leading-tight">To: {d.recipient}</p>
      <p className="mt-1 text-sm leading-snug">{d.note}</p>
      <p className="perf-rule font-mono2 mt-3 pt-2 text-[0.7rem] uppercase opacity-70">
        Penned {fmtDate(d.createdAt)} · {fmtTime(d.createdAt)}
        {sparrowName ? ` · wings: ${sparrowName}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {d.status === 'QUEUED' && onDispatch && (
          <button
            type="button"
            onClick={onDispatch}
            disabled={canDispatch === false}
            className="brut-btn bg-spark px-4 py-1.5 text-xs text-bone"
            title={canDispatch === false ? 'No rested sparrows roosting' : 'Strike the flint and send it'}
          >
            Dispatch ▲
          </button>
        )}
        {d.status === 'IN-FLIGHT' && onDeliver && (
          <button type="button" onClick={onDeliver} className="brut-btn bg-teal px-4 py-1.5 text-xs text-bone">
            Confirm delivery ●
          </button>
        )}
        {d.status === 'IN-FLIGHT' && onRecall && (
          <button type="button" onClick={onRecall} className="brut-btn bg-bone px-3 py-1.5 text-xs">
            Recall
          </button>
        )}
        {d.status === 'QUEUED' && onDrop && (
          <button type="button" onClick={onDrop} className="brut-btn bg-bone px-3 py-1.5 text-xs" aria-label={`Discard ${d.crate}`}>
            Scrap
          </button>
        )}
      </div>
    </li>
  );
}
