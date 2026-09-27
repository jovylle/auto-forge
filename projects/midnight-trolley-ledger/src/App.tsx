import { useEffect, useMemo, useState } from 'react';
import { FARES, ROUTES, fmtCents, fmtTime, load, save, type FareEntry } from './ledger';

type TotalView = 'shift' | 'route' | 'voided';

let seq = 0;
const nid = () => `f${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export default function App() {
  const initial = useMemo(load, []);
  const [entries, setEntries] = useState<FareEntry[]>(initial.entries);
  const [routeId, setRouteId] = useState(initial.routeId);
  const [view, setView] = useState<TotalView>('shift');
  const [pressed, setPressed] = useState<string | null>(null);
  const [settled, setSettled] = useState<{ time: number; total: number }[]>(initial.settled);
  const [flash, setFlash] = useState(false);
  const [armClear, setArmClear] = useState(false);

  useEffect(() => { save({ entries, routeId, settled }); }, [entries, routeId, settled]);

  const route = ROUTES.find((r) => r.id === routeId) ?? ROUTES[0];
  const live = useMemo(() => entries.filter((e) => !e.voided), [entries]);
  const voided = useMemo(() => entries.filter((e) => e.voided), [entries]);
  const shiftTotal = live.reduce((s, e) => s + e.cents, 0);
  const perRoute = useMemo(() => {
    const m = new Map<string, { n: number; cents: number }>();
    for (const r of ROUTES) m.set(r.id, { n: 0, cents: 0 });
    for (const e of live) {
      const cur = m.get(e.routeId) ?? { n: 0, cents: 0 };
      cur.n += 1; cur.cents += e.cents;
      m.set(e.routeId, cur);
    }
    return m;
  }, [live]);
  const voidedTotal = voided.reduce((s, e) => s + e.cents, 0);

  const punch = (label: string, cents: number) => {
    setPressed(label);
    window.setTimeout(() => setPressed(null), 130);
    setEntries((prev) => [{ id: nid(), time: Date.now(), routeId, label, cents, voided: false }, ...prev].slice(0, 1000));
    setArmClear(false);
  };

  const toggleVoid = (id: string) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, voided: !e.voided } : e)));

  const settleShift = () => {
    if (live.length === 0) return;
    setSettled((p) => [{ time: Date.now(), total: shiftTotal }, ...p].slice(0, 24));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 950);
    // settled fares leave the tape; truly voided ones stay for the record
    setEntries((prev) => prev.filter((e) => e.voided));
    setArmClear(false);
  };

  const clearTape = () => {
    if (!armClear) {
      setArmClear(true);
      window.setTimeout(() => setArmClear(false), 3000);
      return;
    }
    setEntries([]); setSettled([]); setArmClear(false);
  };

  const cycleView = () =>
    setView((v) => (v === 'shift' ? 'route' : v === 'route' ? 'voided' : 'shift'));

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
      <div className="h-1 w-full wire-glow opacity-80" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        {/* masthead — off-center, extreme-minimal */}
        <header className="pt-8 pb-6 flex items-end justify-between gap-6 border-b" style={{ borderColor: 'var(--lamp)' }}>
          <div>
            <p className="label opacity-70">night shift · car nº 7</p>
            <h1 className="font-display text-5xl sm:text-7xl leading-none mt-2">Midnight<br />Trolley Ledger</h1>
          </div>
          <p className="label hidden md:block text-right opacity-70 max-w-44">click only —<br />no typing on this car</p>
        </header>

        <div className="grid gap-8 mt-8 lg:grid-cols-[104px_minmax(0,1fr)_300px]">
          {/* night routes rail */}
          <nav aria-label="Night routes" className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible py-1">
            {ROUTES.map((r) => {
              const active = r.id === routeId;
              const stat = perRoute.get(r.id) ?? { n: 0, cents: 0 };
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRouteId(r.id)}
                  aria-pressed={active}
                  className="flex lg:flex-col items-center gap-2 rounded-md border px-3 py-3 min-w-24 transition-colors"
                  style={{
                    borderColor: active ? 'var(--lamp)' : 'transparent',
                    background: active ? 'color-mix(in srgb, var(--lamp) 14%, transparent)' : 'transparent',
                  }}
                >
                  <span
                    className="route-dot block h-4 w-4 rounded-full border-2"
                    style={{
                      borderColor: 'var(--lamp)',
                      background: active ? 'var(--lamp)' : 'transparent',
                    }}
                  />
                  <span className="text-left">
                    <span className="font-display block text-lg leading-tight">{r.name}</span>
                    <span className="label opacity-70 block mt-1">{stat.n} fares · {fmtCents(stat.cents)}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* fare log tape */}
          <section aria-label="Fare log">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="label" style={{ color: 'var(--lamp)' }}>fare log — {route.name}</h2>
              <span className="label opacity-60">{live.length} punched · click a row to void</span>
            </div>
            <div className="rounded-sm p-4 sm:p-5" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
              {entries.length === 0 ? (
                <p className="font-display text-3xl py-10 text-center opacity-80">No fares yet.<br />Punch the first ticket →</p>
              ) : (
                <ol className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}>
                  {entries.map((e) => {
                    const r = ROUTES.find((x) => x.id === e.routeId);
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => toggleVoid(e.id)}
                          aria-pressed={e.voided}
                          title={e.voided ? 'Click to un-void' : 'Click to void'}
                          className="tape-row w-full flex items-center gap-3 py-2.5 pl-3 pr-1 text-left hover:opacity-80"
                        >
                          <span className="text-xs tabular-nums opacity-70 w-20 shrink-0">{fmtTime(e.time)}</span>
                          <span className="label shrink-0 w-24 truncate">{r?.name ?? e.routeId}</span>
                          <span className={`font-medium tabular-nums flex-1 ${e.voided ? 'strike opacity-60' : ''}`}>
                            {e.label}
                          </span>
                          <span className={`tabular-nums font-semibold ${e.voided ? 'strike opacity-60' : ''}`}>
                            {fmtCents(e.cents)}
                          </span>
                          {e.voided && (
                            <span className="label shrink-0" style={{ color: 'var(--oxide)' }}>void</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={clearTape} aria-pressed={armClear} className="label rounded border px-3 py-2 opacity-80 hover:opacity-100" style={{ borderColor: 'var(--oxide)', color: 'var(--oxide)' }}>
                {armClear ? 'click again to confirm' : 'tear off tape'}
              </button>
              <span className="label opacity-50 self-center">route stops: {route.stops.join(' → ')}</span>
            </div>
          </section>

          {/* fare box + ledger totals */}
          <aside className="flex flex-col gap-6">
            <section aria-label="Fare box">
              <h2 className="label mb-3" style={{ color: 'var(--lamp)' }}>fare box</h2>
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                {FARES.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => punch(f.label, f.cents)}
                    className={`rounded-md border px-3 py-4 text-lg font-semibold tabular-nums transition-colors ${pressed === f.label ? 'coin-press' : ''}`}
                    style={{ borderColor: 'var(--lamp)', color: 'var(--lamp)' }}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={settleShift}
                  className="rounded-md px-3 py-4 text-lg font-semibold col-span-3 lg:col-span-2 transition-transform hover:scale-[1.02] active:scale-95"
                  style={{ background: 'var(--lamp)', color: 'var(--ink)' }}
                >
                  PUNCH · settle shift
                </button>
              </div>
            </section>

            <section aria-label="Ledger totals">
              <button type="button" onClick={cycleView} title="Click to switch total view" className="w-full text-left rounded-md border p-4" style={{ borderColor: 'var(--lamp)' }}>
                <span className="label opacity-70">
                  ledger totals · {view === 'shift' ? 'shift' : view === 'route' ? 'by route' : 'voided'} · click to switch
                </span>
                {view === 'shift' && (
                  <span className={`font-display block text-6xl mt-1 tabular-nums ${flash ? 'odo-flash' : ''}`} style={flash ? { color: 'var(--moss)' } : undefined}>
                    {fmtCents(shiftTotal)}
                  </span>
                )}
                {view === 'route' && (
                  <span className="block mt-2 space-y-1">
                    {ROUTES.map((r) => {
                      const s = perRoute.get(r.id) ?? { n: 0, cents: 0 };
                      return (
                        <span key={r.id} className="flex justify-between text-sm tabular-nums">
                          <span className="label">{r.name}</span>
                          <span>{s.n} × {fmtCents(s.cents)}</span>
                        </span>
                      );
                    })}
                  </span>
                )}
                {view === 'voided' && (
                  <span className="block mt-1">
                    <span className="font-display block text-5xl tabular-nums" style={{ color: 'var(--oxide)' }}>{fmtCents(voidedTotal)}</span>
                    <span className="label opacity-70">{voided.length} voided tickets</span>
                  </span>
                )}
                <span className="label mt-2 block" style={{ color: shiftTotal > 0 ? 'var(--moss)' : undefined }}>
                  {shiftTotal > 0 ? '● balanced' : '○ empty car'}
                </span>
              </button>

              {settled.length > 0 && (
                <div className="mt-3">
                  <h3 className="label opacity-70 mb-2">settled shifts</h3>
                  <ol className="space-y-1">
                    {settled.map((s, i) => (
                      <li key={`${s.time}-${i}`} className="flex justify-between text-sm tabular-nums opacity-80">
                        <span>{fmtTime(s.time)}</span>
                        <span>{fmtCents(s.total)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </aside>
        </div>

        <footer className="mt-12 label opacity-50 flex justify-between">
          <span>midnight trolley ledger</span>
          <span>saved on this device</span>
        </footer>
      </div>
    </div>
  );
}
