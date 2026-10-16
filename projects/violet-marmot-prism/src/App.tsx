import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExportFormat,
  GradType,
  Harmony,
  HARMONY_LABELS,
  Stop,
  VISION_LABELS,
  Vision,
  buildExport,
  contrastRatio,
  decodeHash,
  encodeHash,
  gradientCss,
  grade,
  normalizeHex,
  rollHarmony,
  simulate,
  sortedStops,
} from './lib/color';

const LS_KEY = 'violet-marmot-prism-v1';
const PARCHMENT = '#e8dcc8';
const VISIONS: Vision[] = ['true', 'protan', 'deutan', 'tritan', 'achroma'];
const FORMATS: ExportFormat[] = ['css', 'tailwind', 'svg', 'json'];
const EXT: Record<ExportFormat, string> = { css: 'css', tailwind: 'js', svg: 'svg', json: 'json' };
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_STOPS: Stop[] = [
  { id: uid(), color: '#5b2a86', pos: 0 },
  { id: uid(), color: '#8e2436', pos: 50 },
  { id: uid(), color: '#d4a24c', pos: 100 },
];

function loadInitial(): { stops: Stop[]; type: GradType; angle: number; withBlack: boolean; withWhite: boolean } {
  const fallback = { stops: DEFAULT_STOPS, type: 'linear' as GradType, angle: 135, withBlack: false, withWhite: false };
  const sanitize = (stops: Stop[], type: unknown, angle: unknown) => {
    const clean = stops
      .filter((s) => s && normalizeHex(String(s.color)) && Number.isFinite(Number(s.pos)))
      .map((s) => ({
        id: typeof s.id === 'string' ? s.id : uid(),
        color: normalizeHex(String(s.color)) as string,
        pos: Math.max(0, Math.min(100, Number(s.pos))),
      }))
      .filter((s) => s.color !== '#000000' && s.color !== '#ffffff')
      .slice(0, 3);
    if (clean.length < 2) return null;
    const t: GradType = type === 'radial' || type === 'conic' ? type : 'linear';
    const a = Number.isFinite(Number(angle)) ? Math.max(0, Math.min(360, Number(angle))) : 135;
    return { stops: clean, type: t, angle: a };
  };
  const splitCandles = (stops: Stop[]) => ({
    withBlack: stops.some((s) => s.color === '#000000' && s.pos <= 0),
    withWhite: stops.some((s) => s.color === '#ffffff' && s.pos >= 100),
  });
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    const d = decodeHash(window.location.hash);
    if (d) {
      const candles = splitCandles(d.stops);
      const clean = sanitize(d.stops, d.type, d.angle);
      if (clean) return { ...clean, ...candles };
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.stops)) {
        const clean = sanitize(p.stops, p.type, p.angle);
        if (clean) return { ...clean, withBlack: p.withBlack === true, withWhite: p.withWhite === true };
      }
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

export default function App() {
  const [initial] = useState(loadInitial);
  const [stops, setStops] = useState<Stop[]>(initial.stops);
  const [gradType, setGradType] = useState<GradType>(initial.type);
  const [angle, setAngle] = useState<number>(initial.angle);
  const [withBlack, setWithBlack] = useState(initial.withBlack);
  const [withWhite, setWithWhite] = useState(initial.withWhite);
  const [harmony, setHarmony] = useState<Harmony>('analogous');
  const [tumbling, setTumbling] = useState(false);
  const [flashed, setFlashed] = useState(false);
  const [vision, setVision] = useState<Vision>('true');
  const [format, setFormat] = useState<ExportFormat>('css');
  const [selected, setSelected] = useState<string | null>(initial.stops[0]?.id ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [bleedId, setBleedId] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Effective stops: at most 3 chromatic + optional black/white endpoints.
  const effective = useMemo<Stop[]>(() => {
    const list: Stop[] = [];
    if (withBlack) list.push({ id: '__black', color: '#000000', pos: 0 });
    list.push(...stops);
    if (withWhite) list.push({ id: '__white', color: '#ffffff', pos: 100 });
    return sortedStops(list);
  }, [stops, withBlack, withWhite]);

  const css = useMemo(() => gradientCss(effective, gradType, angle), [effective, gradType, angle]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ stops, type: gradType, angle, withBlack, withWhite }));
    } catch {
      /* storage unavailable */
    }
  }, [stops, gradType, angle, withBlack, withWhite]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, [toast]);

  async function copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        /* clipboard unavailable */
      }
    }
    setToast(msg);
  }

  function castDie() {
    if (tumbling) return;
    setTumbling(true);
    window.setTimeout(() => {
      const rolled = rollHarmony(harmony);
      setStops((prev) => prev.map((s, i) => ({ ...s, color: rolled[i % rolled.length] })));
      setTumbling(false);
      setFlashed(true);
      window.setTimeout(() => setFlashed(false), 550);
      setToast(`The die spoke: ${HARMONY_LABELS[harmony]} harmony`);
    }, 600);
  }

  function addStop() {
    if (stops.length >= 3) {
      setToast('The prism holds but 3 colors (+ black & white)');
      return;
    }
    const mid = stops.length === 2 ? 50 : 33 * stops.length;
    setStops((prev) => [...prev, { id: uid(), color: '#4e9b87', pos: Math.round(mid) }]);
  }

  function removeStop(id: string) {
    if (stops.length <= 2) {
      setToast('A gradient needs at least 2 colors');
      return;
    }
    setStops((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (selected === id) setSelected(next[0]?.id ?? null);
      return next;
    });
  }

  function updateStop(id: string, patch: Partial<Stop>) {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function download() {
    const blob = new Blob([buildExport(format, effective, gradType, angle)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `violet-marmot-prism.${EXT[format]}`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(`Palette sealed as .${EXT[format]}`);
  }

  // Contrast pairs among effective stops + parchment text checks.
  const pairs = useMemo(() => {
    const out: { a: Stop; b: Stop; ratio: number }[] = [];
    for (let i = 0; i < effective.length; i++) {
      for (let j = i + 1; j < effective.length; j++) {
        out.push({ a: effective[i], b: effective[j], ratio: contrastRatio(effective[i].color, effective[j].color) });
      }
    }
    return out;
  }, [effective]);

  const textChecks = useMemo(
    () => effective.map((s) => ({ stop: s, ratio: contrastRatio(s.color, PARCHMENT) })),
    [effective],
  );

  const simStops = useMemo(() => effective.map((s) => ({ ...s, sim: simulate(s.color, vision) })), [effective, vision]);
  const simCss = useMemo(
    () => gradientCss(simStops.map((s) => ({ ...s, color: s.sim })), gradType, angle),
    [simStops, gradType, angle],
  );
  const muddled = useMemo(() => {
    const out: { a: string; b: string; ratio: number }[] = [];
    for (let i = 0; i < simStops.length; i++) {
      for (let j = i + 1; j < simStops.length; j++) {
        const r = contrastRatio(simStops[i].sim, simStops[j].sim);
        if (r < 1.5) out.push({ a: simStops[i].color, b: simStops[j].color, ratio: r });
      }
    }
    return out;
  }, [simStops]);

  const exportText = useMemo(() => buildExport(format, effective, gradType, angle), [format, effective, gradType, angle]);
  const shareLink = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
    return base + encodeHash(effective, gradType, angle);
  }, [effective, gradType, angle]);

  const angleLabel = gradType === 'radial' ? 'Focus depth' : gradType === 'conic' ? 'Origin' : 'Angle';

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="fog fog-a" aria-hidden="true" />
      <div className="fog fog-b" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        {/* ── Masthead ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4 border-b border-[#2a2231] py-5">
          <div className="flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
              <polygon points="17,2 30,10 30,24 17,32 4,24 4,10" fill="none" stroke="#d4a24c" strokeWidth="1.5" />
              <polygon points="17,8 25,13 25,21 17,26 9,21 9,13" fill="#5b2a86" />
              <circle cx="17" cy="17" r="3" fill="#d4a24c" />
            </svg>
            <div>
              <h1 className="font-cathedral text-lg sm:text-xl font-bold tracking-[0.18em] uppercase text-[#e8dcc8]">
                Violet Marmot Prism
              </h1>
              <p className="text-[11px] tracking-[0.28em] uppercase text-[#9b8fa6]">
                dark-fantasy gradient forge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={castDie}
              className={`btn-gilt font-cathedral rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold tracking-[0.14em] uppercase ${tumbling ? 'dice-tumbling' : ''} ${flashed ? 'gilt-flash' : ''}`}
              aria-label="Roll the harmony dice"
            >
              ◆ Cast die
            </button>
            <button
              onClick={() => copyText(exportText, 'Palette copied — one click, sealed')}
              className="btn-ghost rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm tracking-[0.14em] uppercase"
            >
              Export
            </button>
          </div>
        </header>

        {/* ── Forge: preview + rail ────────────────────────────── */}
        <main className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: the Prism plate */}
          <section className="lg:col-span-7" aria-label="Live gradient preview">
            <div className="flex items-stretch gap-4">
              <span className="spine-label hidden md:block font-cathedral text-[10px] uppercase text-[#8a6a30] pt-2" aria-hidden="true">
                grimoire · plate I
              </span>
              <div className="flex-1">
                <div className="plate-frame overflow-hidden rounded-sm bg-[#1a1420]">
                  <div className="relative aspect-[16/10] w-full" style={{ background: css }} role="img" aria-label={`Gradient preview: ${css}`}>
                    <div className="prism-sheen absolute inset-0" aria-hidden="true" />
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 rounded bg-[#0e0a0f]/80 px-3 py-2 backdrop-blur-sm">
                      <p className="font-cathedral text-base sm:text-2xl font-bold tracking-[0.1em] text-[#e8dcc8]">
                        {effective.map((s) => s.color).join(' · ').toUpperCase()}
                      </p>
                      <p className="text-[11px] text-[#9b8fa6]">
                        {gradType} · {gradType === 'linear' ? `${Math.round(angle)}°` : `focus ${Math.round(angle)}`} · {effective.length} stops
                      </p>
                    </div>
                  </div>
                </div>

                {/* stop ribbon — click a shield to select */}
                <div className="mt-4 flex items-center gap-3" role="group" aria-label="Palette stops">
                  {effective.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (!s.id.startsWith('__')) setSelected(s.id);
                        setBleedId(s.id);
                        copyText(s.color.toUpperCase(), `${s.color.toUpperCase()} copied`);
                        window.setTimeout(() => setBleedId(null), 220);
                      }}
                      className={`swatch-shield h-14 w-12 sm:h-16 sm:w-14 border border-[#2a2231] ${selected === s.id ? 'swatch-selected' : ''} ${bleedId === s.id ? 'bleed' : ''}`}
                      style={{ background: s.color, color: s.color }}
                      title={`${s.color.toUpperCase()} — click to copy`}
                      aria-label={`Copy ${s.color}`}
                    />
                  ))}
                  <p className="ml-1 text-[11px] leading-relaxed text-[#9b8fa6]">
                    tap a shield
                    <br />
                    to copy its hex
                  </p>
                </div>

                {/* live CSS readout */}
                <div className="mt-4 rounded-md border border-[#2a2231] bg-[#1a1420] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-cathedral text-[11px] tracking-[0.24em] uppercase text-[#8a6a30]">living incantation</p>
                    <button
                      onClick={() => copyText(`background: ${css};`, 'Gradient CSS copied')}
                      className="text-[11px] tracking-[0.18em] uppercase text-[#d4a24c] hover:brightness-125"
                    >
                      copy css
                    </button>
                  </div>
                  <code className="mt-1 block break-all text-xs leading-relaxed text-[#e8dcc8]">
                    background: {css};
                  </code>
                </div>
              </div>
            </div>

            {/* ── Perception strip ─────────────────────────────── */}
            <section className="mt-8" aria-label="Color-blind perception preview">
              <h2 className="font-cathedral text-sm font-bold tracking-[0.24em] uppercase text-[#e8dcc8]">
                Perception veil
              </h2>
              <p className="mt-1 text-xs text-[#9b8fa6]">
                How mortal eyes read your gradient — protan, deutan, tritan &amp; achroma veils.
              </p>
              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Vision simulations">
                {VISIONS.map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={vision === v}
                    onClick={() => setVision(v)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase transition-colors ${
                      vision === v
                        ? 'border-[#d4a24c] bg-[#d4a24c]/15 text-[#e8dcc8]'
                        : 'border-[#2a2231] text-[#9b8fa6] hover:border-[#8a6a30] hover:text-[#e8dcc8]'
                    }`}
                  >
                    {VISION_LABELS[v]}
                  </button>
                ))}
              </div>
              <div key={vision} className="veil-fade mt-3 overflow-hidden rounded-md border border-[#2a2231]">
                <div className="h-24 w-full sm:h-28" style={{ background: simCss }} role="img" aria-label={`${VISION_LABELS[vision]} simulation`} />
                <div className="flex flex-wrap items-center gap-2 bg-[#1a1420] px-3 py-2.5">
                  {simStops.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5 text-[11px]">
                      <span className="inline-block h-4 w-4 rounded-sm border border-[#2a2231]" style={{ background: s.sim }} />
                      <span className="text-[#9b8fa6]">{s.sim.toUpperCase()}</span>
                    </span>
                  ))}
                  <span className="ml-auto flex items-center gap-1.5 text-[11px]">
                    {muddled.length === 0 ? (
                      <>
                        <span className="text-[#4e9b87]" aria-hidden="true">✦</span>
                        <span className="text-[#4e9b87]">stops stay distinct</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#8e2436]" aria-hidden="true">✦</span>
                        <span className="text-[#8e2436]">
                          muddied: {muddled.map((m) => `${m.a.toUpperCase()}≈${m.b.toUpperCase()}`).join(', ')}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Contrast altar ───────────────────────────────── */}
            <section className="mt-8" aria-label="Contrast checks">
              <h2 className="font-cathedral text-sm font-bold tracking-[0.24em] uppercase text-[#e8dcc8]">
                Contrast altar
              </h2>
              <div className="mt-3 overflow-hidden rounded-md border border-[#2a2231]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#241b2c] text-left text-[10px] tracking-[0.2em] uppercase text-[#9b8fa6]">
                      <th className="px-3 py-2 font-medium">Pairing</th>
                      <th className="px-3 py-2 font-medium">Ratio</th>
                      <th className="px-3 py-2 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((p, i) => {
                      const g = grade(p.ratio);
                      return (
                        <tr key={i} className="border-t border-[#2a2231] bg-[#1a1420]">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-4 w-6 rounded-sm border border-black/40" style={{ background: p.a.color }} />
                              <span className="text-[#9b8fa6]">×</span>
                              <span className="inline-block h-4 w-6 rounded-sm border border-black/40" style={{ background: p.b.color }} />
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-[#e8dcc8]">{p.ratio.toFixed(2)}:1</td>
                          <td className="px-3 py-2">
                            <GradeBadge g={g} />
                          </td>
                        </tr>
                      );
                    })}
                    {textChecks.map((t) => {
                      const g = grade(t.ratio);
                      return (
                        <tr key={t.stop.id + '-text'} className="border-t border-[#2a2231] bg-[#1a1420]">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-4 w-6 rounded-sm border border-black/40" style={{ background: t.stop.color }} />
                              <span className="text-[#9b8fa6]">× parchment text</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-[#e8dcc8]">{t.ratio.toFixed(2)}:1</td>
                          <td className="px-3 py-2">
                            <GradeBadge g={g} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          {/* Right rail */}
          <aside className="lg:col-span-4 lg:col-start-9 lg:mt-10" aria-label="Mixer controls">
            <div className="flex gap-4">
              <div className="engraved-rule hidden sm:block" aria-hidden="true" />
              <div className="flex-1 space-y-6">
                {/* stop stack */}
                <section aria-label="Color stops">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-cathedral text-sm font-bold tracking-[0.24em] uppercase text-[#e8dcc8]">
                      Pigments
                    </h2>
                    <span className="text-[11px] text-[#9b8fa6]">{stops.length}/3 + candles</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {stops.map((s, idx) => (
                      <StopCard
                        key={s.id}
                        stop={s}
                        index={idx}
                        selected={selected === s.id}
                        onSelect={() => setSelected(s.id)}
                        onColor={(c) => updateStop(s.id, { color: c })}
                        onHex={(hex) => {
                          const n = normalizeHex(hex);
                          if (n) updateStop(s.id, { color: n });
                          return n !== null;
                        }}
                        onPos={(pos) => updateStop(s.id, { pos })}
                        onRemove={() => removeStop(s.id)}
                        canRemove={stops.length > 2}
                      />
                    ))}
                  </div>
                  <button
                    onClick={addStop}
                    disabled={stops.length >= 3}
                    className="btn-ghost mt-3 w-full rounded-md px-3 py-2 text-xs tracking-[0.18em] uppercase disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {stops.length >= 3 ? 'Prism full — 3 colors max' : '+ Grind a pigment'}
                  </button>

                  {/* black / white candles */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <CandleToggle label="Black candle" on={withBlack} onFlip={() => setWithBlack((v) => !v)} swatch="#000000" />
                    <CandleToggle label="White candle" on={withWhite} onFlip={() => setWithWhite((v) => !v)} swatch="#ffffff" />
                  </div>
                </section>

                {/* geometry */}
                <section aria-label="Gradient geometry">
                  <h2 className="font-cathedral text-sm font-bold tracking-[0.24em] uppercase text-[#e8dcc8]">
                    Refraction
                  </h2>
                  <div className="mt-3 flex gap-2" role="group" aria-label="Gradient type">
                    {(['linear', 'radial', 'conic'] as GradType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setGradType(t)}
                        aria-pressed={gradType === t}
                        className={`flex-1 rounded-md border px-2 py-2 text-[11px] tracking-[0.14em] uppercase transition-colors ${
                          gradType === t
                            ? 'border-[#d4a24c] bg-[#d4a24c]/15 text-[#e8dcc8]'
                            : 'border-[#2a2231] text-[#9b8fa6] hover:border-[#8a6a30]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 block">
                    <span className="flex justify-between text-[11px] tracking-[0.18em] uppercase text-[#9b8fa6]">
                      <span>{angleLabel}</span>
                      <span className="tabular-nums text-[#d4a24c]">{Math.round(angle)}°</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={angle}
                      onChange={(e) => setAngle(Number(e.target.value))}
                      className="gilt-range mt-1"
                      aria-label={angleLabel}
                    />
                  </label>
                </section>

                {/* harmony dice */}
                <section aria-label="Harmony dice">
                  <h2 className="font-cathedral text-sm font-bold tracking-[0.24em] uppercase text-[#e8dcc8]">
                    Harmony die
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Harmony mode">
                    {(Object.keys(HARMONY_LABELS) as Harmony[]).map((h) => (
                      <button
                        key={h}
                        onClick={() => setHarmony(h)}
                        aria-pressed={harmony === h}
                        className={`rounded-full border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase transition-colors ${
                          harmony === h
                            ? 'border-[#d4a24c] bg-[#d4a24c]/15 text-[#e8dcc8]'
                            : 'border-[#2a2231] text-[#9b8fa6] hover:border-[#8a6a30]'
                        }`}
                      >
                        {HARMONY_LABELS[h]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={castDie}
                    className={`btn-gilt mt-3 w-full rounded-md px-3 py-2.5 font-cathedral text-sm font-bold tracking-[0.18em] uppercase ${tumbling ? 'dice-tumbling' : ''}`}
                  >
                    {tumbling ? '··· tumbling ···' : '◆ Cast the die'}
                  </button>
                </section>

                {/* export ledger */}
                <section aria-label="Export palette">
                  <h2 className="font-cathedral text-sm font-bold tracking-[0.24em] uppercase text-[#e8dcc8]">
                    Export ledger
                  </h2>
                  <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Export format">
                    {FORMATS.map((f) => (
                      <button
                        key={f}
                        role="tab"
                        aria-selected={format === f}
                        onClick={() => setFormat(f)}
                        className={`flex-1 rounded border px-1 py-1.5 text-[10px] tracking-[0.1em] uppercase transition-colors ${
                          format === f
                            ? 'border-[#d4a24c] bg-[#d4a24c]/15 text-[#e8dcc8]'
                            : 'border-[#2a2231] text-[#9b8fa6] hover:border-[#8a6a30]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <pre className="mt-2 max-h-44 overflow-auto rounded-md border border-[#2a2231] bg-[#0e0a0f] p-3 text-[11px] leading-relaxed text-[#e8dcc8]">
                    {exportText}
                  </pre>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => copyText(exportText, `${format.toUpperCase()} palette copied`)}
                      className="btn-gilt rounded-md px-3 py-2 text-xs font-bold tracking-[0.14em] uppercase"
                    >
                      Copy
                    </button>
                    <button
                      onClick={download}
                      className="btn-ghost rounded-md px-3 py-2 text-xs tracking-[0.14em] uppercase"
                    >
                      Download
                    </button>
                  </div>
                  <button
                    onClick={() => copyText(shareLink, 'Share-link copied — the prism travels')}
                    className="mt-2 w-full rounded-md border border-dashed border-[#8a6a30] px-3 py-2 text-[11px] tracking-[0.14em] uppercase text-[#d4a24c] hover:bg-[#d4a24c]/10"
                  >
                    Copy share-link
                  </button>
                </section>
              </div>
            </div>
          </aside>
        </main>

        <footer className="mt-12 border-t border-[#2a2231] pt-4 text-[11px] tracking-[0.2em] uppercase text-[#9b8fa6]">
          <p>Violet Marmot Prism · mixed in the dark · keeps 3 pigments + black &amp; white candles</p>
        </footer>
      </div>

      {/* toast */}
      {toast && (
        <div className="toast-rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[#d4a24c] bg-[#1a1420]/95 px-4 py-2.5 text-sm text-[#e8dcc8] shadow-[0_8px_30px_rgba(0,0,0,0.6)]" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function GradeBadge({ g }: { g: string }) {
  const color = g === 'fail' ? '#8e2436' : '#4e9b87';
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase"
      style={{ borderColor: color, color }}
    >
      {g === 'fail' ? '✦ fail' : `✦ ${g}`}
    </span>
  );
}

function CandleToggle({ label, on, onFlip, swatch }: { label: string; on: boolean; onFlip: () => void; swatch: string }) {
  return (
    <button
      onClick={onFlip}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] tracking-[0.1em] uppercase transition-colors ${
        on ? 'border-[#d4a24c] bg-[#d4a24c]/10 text-[#e8dcc8]' : 'border-[#2a2231] text-[#9b8fa6] hover:border-[#8a6a30]'
      }`}
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
        style={{ borderColor: on ? '#d4a24c' : '#2a2231', background: swatch }}
        aria-hidden="true"
      >
        {on && <span style={{ color: swatch === '#000000' ? '#d4a24c' : '#170f04' }}>✦</span>}
      </span>
      {label}
    </button>
  );
}

function StopCard({
  stop,
  index,
  selected,
  onSelect,
  onColor,
  onHex,
  onPos,
  onRemove,
  canRemove,
}: {
  stop: Stop;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onColor: (c: string) => void;
  onHex: (hex: string) => boolean;
  onPos: (pos: number) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [draft, setDraft] = useState(stop.color.toUpperCase());
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(stop.color.toUpperCase());
    setBad(false);
  }, [stop.color]);

  function commitHex() {
    const ok = onHex(draft);
    setBad(!ok);
    if (!ok) setDraft(stop.color.toUpperCase());
  }

  return (
    <div
      className={`rounded-md border bg-[#1a1420] p-2.5 transition-colors ${selected ? 'border-[#d4a24c]' : 'border-[#2a2231]'}`}
    >
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          className="rune-color w-14 shrink-0"
          value={stop.color}
          onChange={(e) => onColor(e.target.value)}
          onFocus={onSelect}
          aria-label={`Pigment ${index + 1} color picker`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-cathedral text-[10px] tracking-[0.24em] uppercase text-[#8a6a30]">
              Pigment {['I', 'II', 'III'][index] ?? index + 1}
            </span>
            {canRemove && (
              <button
                onClick={onRemove}
                className="text-[10px] tracking-[0.14em] uppercase text-[#9b8fa6] hover:text-[#8e2436]"
                aria-label={`Remove pigment ${index + 1}`}
              >
                unbind
              </button>
            )}
          </div>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            onFocus={onSelect}
            spellCheck={false}
            maxLength={7}
            aria-label={`Pigment ${index + 1} hex value`}
            className={`mt-1 w-full rounded border bg-[#0e0a0f] px-2 py-1 text-sm tabular-nums tracking-wider text-[#e8dcc8] ${
              bad ? 'border-[#8e2436]' : 'border-[#2a2231]'
            }`}
          />
        </div>
      </div>
      <label className="mt-2 block">
        <span className="flex justify-between text-[10px] tracking-[0.18em] uppercase text-[#9b8fa6]">
          <span>position</span>
          <span className="tabular-nums text-[#d4a24c]">{Math.round(stop.pos)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={stop.pos}
          onChange={(e) => onPos(Number(e.target.value))}
          onFocus={onSelect}
          className="gilt-range"
          aria-label={`Pigment ${index + 1} position`}
        />
      </label>
    </div>
  );
}
