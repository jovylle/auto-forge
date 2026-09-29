import { useEffect, useMemo, useState } from 'react';

/* ============================================================
   LICHEN ARCHIVE — Bauhaus colony catalog (single component)
   Palette (3 max + black/white): red #DA291C · yellow #F5C518
   · blue #1D4E89 · ink #161616 · white #FFFFFF
   ============================================================ */

type Substrate = 'Rock' | 'Bark' | 'Soil' | 'Concrete';
type Ring = { year: number; widthMm: number; note: string };
type Colony = {
  id: string;
  name: string;
  species: string;
  substrate: Substrate;
  site: string;
  founded: number;
  notes: string;
  rings: Ring[];
};

const STORE_KEY = 'lichen-archive:v1';
const SUBSTRATES: Substrate[] = ['Rock', 'Bark', 'Soil', 'Concrete'];
const RING_COLORS = ['#1D4E89', '#F5C518', '#DA291C']; // blue -> yellow -> red
const THIS_YEAR = new Date().getFullYear();

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

function seed(): Colony[] {
  return [
    {
      id: 'seed-redoubt',
      name: 'Old Redoubt',
      species: 'Xanthoria elegans',
      substrate: 'Rock',
      site: 'Basalt outcrop, north face',
      founded: 1987,
      notes: 'Orange rosette on wind-scoured basalt. Grows ~1mm/yr, slower on the shaded lip.',
      rings: [
        { year: 1990, widthMm: 0.6, note: 'First full survey' },
        { year: 1994, widthMm: 0.9, note: 'Wet spring' },
        { year: 1998, widthMm: 1.1, note: '' },
        { year: 2002, widthMm: 0.7, note: 'Rockfall dust cover' },
        { year: 2006, widthMm: 1.0, note: '' },
        { year: 2010, widthMm: 0.8, note: 'Moss encroachment east' },
        { year: 2014, widthMm: 1.2, note: 'Canopy cleared uphill' },
        { year: 2018, widthMm: 0.9, note: '' },
        { year: 2022, widthMm: 1.0, note: 'Drought, pale thallus' },
        { year: 2025, widthMm: 0.7, note: 'Latest caliper read' },
      ],
    },
    {
      id: 'seed-parish',
      name: 'Bark Parish',
      species: 'Parmelia sulcata',
      substrate: 'Bark',
      site: 'Veteran oak, trunk SW',
      founded: 2003,
      notes: 'Grey shield lichen following the bark fissures upward. Measured along the fissure line.',
      rings: [
        { year: 2005, widthMm: 1.3, note: 'Colonised fissure' },
        { year: 2008, widthMm: 1.4, note: '' },
        { year: 2011, widthMm: 1.0, note: 'Ivy cut back' },
        { year: 2015, widthMm: 1.2, note: '' },
        { year: 2019, widthMm: 0.8, note: 'Bark slough event' },
        { year: 2023, widthMm: 1.1, note: 'Recovering well' },
        { year: 2025, widthMm: 0.9, note: 'Latest caliper read' },
      ],
    },
    {
      id: 'seed-psalter',
      name: 'Pavement Psalter',
      species: 'Lecanora muralis',
      substrate: 'Concrete',
      site: 'Church steps, third tread',
      founded: 1974,
      notes: 'Oldest resident. Pale green placodioid disc, ~50 years of foot traffic dodged.',
      rings: [
        { year: 1980, widthMm: 1.2, note: 'Earliest photo record' },
        { year: 1986, widthMm: 1.0, note: '' },
        { year: 1992, widthMm: 1.1, note: 'Steps repointed nearby' },
        { year: 1998, widthMm: 0.6, note: 'Salt damage winter' },
        { year: 2004, widthMm: 0.9, note: '' },
        { year: 2010, widthMm: 1.0, note: 'Grit regime changed' },
        { year: 2016, widthMm: 0.8, note: '' },
        { year: 2021, widthMm: 0.7, note: 'Pigeon deterrent fitted' },
        { year: 2025, widthMm: 0.5, note: 'Latest caliper read' },
      ],
    },
  ];
}

function load(): Colony[] {
  const fallback = seed();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const clean = parsed.filter(
      (c): c is Colony =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as Colony).id === 'string' &&
        typeof (c as Colony).name === 'string' &&
        Array.isArray((c as Colony).rings),
    );
    return clean.length > 0 ? clean : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [colonies, setColonies] = useState<Colony[]>(load);
  const [selectedId, setSelectedId] = useState<string>(() => colonies[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [substrate, setSubstrate] = useState<'All' | Substrate>('All');
  const [sort, setSort] = useState<'name' | 'oldest' | 'largest' | 'rings'>('oldest');
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pingKey, setPingKey] = useState(0);

  const [fName, setFName] = useState('');
  const [fSpecies, setFSpecies] = useState('');
  const [fSubstrate, setFSubstrate] = useState<Substrate>('Rock');
  const [fSite, setFSite] = useState('');
  const [fFounded, setFFounded] = useState(String(THIS_YEAR - 5));
  const [fNotes, setFNotes] = useState('');

  const [rYear, setRYear] = useState(String(THIS_YEAR));
  const [rWidth, setRWidth] = useState('0.8');
  const [rNote, setRNote] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(colonies));
    } catch {
      /* storage full or blocked — archive stays in memory */
    }
  }, [colonies]);

  useEffect(() => {
    if (!armedDelete) return;
    const t = setTimeout(() => setArmedDelete(null), 3200);
    return () => clearTimeout(t);
  }, [armedDelete]);

  const selected = colonies.find((c) => c.id === selectedId) ?? colonies[0] ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = colonies.filter((c) => {
      const hitSub = substrate === 'All' || c.substrate === substrate;
      if (!hitSub) return false;
      if (!q) return true;
      return [c.name, c.species, c.site, c.notes, String(c.founded)]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'oldest') return a.founded - b.founded;
      if (sort === 'largest') {
        const da = a.rings.reduce((s, r) => s + r.widthMm, 0);
        const db = b.rings.reduce((s, r) => s + r.widthMm, 0);
        return db - da;
      }
      return b.rings.length - a.rings.length;
    });
    return list;
  }, [colonies, query, substrate, sort]);

  function mark(text: string, q: string) {
    const needle = q.trim();
    if (!needle) return text;
    const i = text.toLowerCase().indexOf(needle.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="match-wipe px-0.5 text-inherit">{text.slice(i, i + needle.length)}</mark>
        {text.slice(i + needle.length)}
      </>
    );
  }

  function addColony() {
    const name = fName.trim() || `Unnamed ${fSubstrate} colony`;
    const founded = Math.min(THIS_YEAR, Math.max(1700, parseInt(fFounded, 10) || THIS_YEAR));
    const c: Colony = {
      id: uid(),
      name,
      species: fSpecies.trim() || 'Species undetermined',
      substrate: fSubstrate,
      site: fSite.trim() || 'Site unrecorded',
      founded,
      notes: fNotes.trim(),
      rings: [{ year: founded, widthMm: 0.5, note: 'First sighting' }],
    };
    setColonies((prev) => [c, ...prev]);
    setSelectedId(c.id);
    setFName('');
    setFSpecies('');
    setFSite('');
    setFNotes('');
    setShowForm(false);
    setPingKey((k) => k + 1);
  }

  function removeColony(id: string) {
    if (armedDelete !== id) {
      setArmedDelete(id);
      return;
    }
    setArmedDelete(null);
    const next = colonies.filter((c) => c.id !== id);
    if (selectedId === id) setSelectedId(next[0]?.id ?? '');
    setColonies(next);
  }

  function addRing() {
    if (!selected) return;
    const year = parseInt(rYear, 10);
    const width = parseFloat(rWidth);
    if (!year || year < selected.founded || year > THIS_YEAR + 1) return;
    if (!(width > 0) || width > 20) return;
    if (selected.rings.some((r) => r.year === year)) return;
    const ring: Ring = { year, widthMm: Math.round(width * 10) / 10, note: rNote.trim() };
    setColonies((prev) =>
      prev.map((c) =>
        c.id === selected.id ? { ...c, rings: [...c.rings, ring].sort((a, b) => a.year - b.year) } : c,
      ),
    );
    setRNote('');
    setActiveYear(year);
  }

  function removeRing(colonyId: string, year: number) {
    const colony = colonies.find((c) => c.id === colonyId);
    if (!colony || colony.rings.length <= 1) return; // keep at least one ring
    setColonies((prev) =>
      prev.map((c) => (c.id === colonyId ? { ...c, rings: c.rings.filter((r) => r.year !== year) } : c)),
    );
    if (activeYear === year) setActiveYear(null);
  }

  function pickColony(id: string) {
    setSelectedId(id);
    setActiveYear(null);
    setHoverYear(null);
    document.getElementById('rings')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---- ring geometry: accumulate widths, then auto-fit to viewBox ---- */
  const geometry = useMemo(() => {
    if (!selected || selected.rings.length === 0) return null;
    const rings = [...selected.rings].sort((a, b) => a.year - b.year);
    const strokes = rings.map((r) => 2 + r.widthMm * 7);
    const GAP = 5;
    let r = 30;
    const radii: number[] = rings.map((_, i) => {
      if (i === 0) {
        const v = r;
        r += strokes[0] / 2;
        return v;
      }
      r += strokes[i - 1] / 2 + GAP + strokes[i] / 2;
      return r - strokes[i] / 2;
    });
    const outer = r + strokes[strokes.length - 1] / 2;
    const scale = Math.min(1, 168 / Math.max(outer, 1));
    return { rings, radii: radii.map((v) => v * scale), strokes: strokes.map((s) => s * scale), outer: outer * scale };
  }, [selected]);

  const selStats = useMemo(() => {
    if (!selected) return null;
    const total = selected.rings.reduce((s, r) => s + r.widthMm, 0);
    const age = Math.max(1, THIS_YEAR - selected.founded);
    return { total: Math.round(total * 10) / 10, diameter: Math.round(total * 2 * 10) / 10, age, avg: Math.round((total / age) * 100) / 100 };
  }, [selected]);

  const focusRing = selected?.rings.find((r) => r.year === (hoverYear ?? activeYear ?? -1)) ?? null;

  return (
    <div className="min-h-screen bg-white font-body text-ink">
      {/* ================= HEADER ================= */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-stretch justify-between gap-4 px-4 pt-6 pb-5 sm:px-6">
          <div>
            <p className="font-display text-[11px] tracking-[0.35em] text-bau-red">FIELD CATALOG · Nº 001</p>
            <h1 className="font-display mt-2 text-4xl leading-[0.95] uppercase sm:text-6xl">
              Lichen
              <br />
              Archive
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-snug">
              A Bauhaus register of slow-growing colonies. Log them, read their rings, search the archive.
            </p>
          </div>
          {/* shape cluster: red circle / blue half-disc / yellow square */}
          <div className="relative hidden w-56 shrink-0 overflow-hidden sm:block" aria-hidden="true">
            <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-bau-red" />
            <div className="absolute top-16 right-24 h-24 w-24 rounded-full border-[6px] border-ink" />
            <div className="absolute top-20 right-2 h-20 w-20 rotate-12 bg-bau-yellow" />
            <div className="absolute bottom-1 right-28 h-16 w-8 rounded-r-full bg-bau-blue" />
          </div>
        </div>
        <div className="flex">
          <div className="h-2.5 flex-1 bg-bau-red" />
          <div className="h-2.5 flex-1 bg-bau-yellow" />
          <div className="h-2.5 flex-1 bg-bau-blue" />
          <div className="h-2.5 flex-[4] bg-ink" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* ============ ARCHIVE SEARCH (sticky strip) ============ */}
        <section aria-label="Archive search" className="border-[3px] border-ink">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-ink px-4 py-3 text-white">
            <h2 className="font-display text-sm tracking-[0.25em] uppercase">⌕ Archive search</h2>
            <p className="text-xs tracking-widest uppercase opacity-80" role="status">
              {results.length} / {colonies.length} specimens
            </p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
            <label className="flex items-center gap-2 border-[3px] border-ink px-3 py-2 focus-within:bg-black/5">
              <span className="font-display text-xs" aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, species, site, notes…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
                aria-label="Search the archive"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="font-display border-2 border-ink bg-bau-red px-2 text-xs text-white"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by substrate">
              {(['All', ...SUBSTRATES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubstrate(s)}
                  aria-pressed={substrate === s}
                  className={`font-display border-[3px] px-2.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors ${
                    substrate === s ? 'border-ink bg-bau-blue text-white' : 'border-ink bg-white hover:bg-bau-yellow'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="font-display cursor-pointer border-[3px] border-ink bg-white px-2 py-1.5 text-[11px] uppercase"
                aria-label="Sort colonies"
              >
                <option value="oldest">Oldest</option>
                <option value="name">Name A–Z</option>
                <option value="largest">Largest</option>
                <option value="rings">Most rings</option>
              </select>
            </label>
          </div>
        </section>

        {/* ============ MAIN: LOG + RINGS (asymmetric) ============ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* -------- COLONY LOG (left, 5) -------- */}
          <section aria-label="Colony log" className="lg:col-span-5">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl uppercase">
                <span className="mr-2 inline-block h-5 w-5 bg-bau-red align-baseline" aria-hidden="true" />
                Colony log
              </h2>
              <button
                onClick={() => setShowForm((v) => !v)}
                aria-expanded={showForm}
                className="add-btn font-display relative flex h-12 w-12 items-center justify-center rounded-full bg-ink text-xl text-white"
                aria-label={showForm ? 'Close new colony form' : 'Log a new colony'}
              >
                {pingKey > 0 && <span key={pingKey} className="ping-ring absolute inset-0 rounded-full border-4 border-bau-yellow" aria-hidden="true" />}
                <span className={`inline-block transition-transform ${showForm ? 'rotate-45' : ''}`}>+</span>
              </button>
            </div>

            {showForm && (
              <form
                className="mt-3 border-[3px] border-ink"
                onSubmit={(e) => {
                  e.preventDefault();
                  addColony();
                }}
              >
                <p className="font-display bg-bau-yellow px-3 py-2 text-xs tracking-[0.25em] uppercase">▲ New specimen</p>
                <div className="grid gap-2 p-3">
                  <label className="grid gap-1 text-xs font-bold tracking-wider uppercase">
                    Colony name
                    <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Gatehouse Green" className="border-2 border-ink px-2 py-1.5 text-sm font-normal normal-case" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs font-bold tracking-wider uppercase">
                      Species
                      <input value={fSpecies} onChange={(e) => setFSpecies(e.target.value)} placeholder="Latin name" className="border-2 border-ink px-2 py-1.5 text-sm font-normal normal-case" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold tracking-wider uppercase">
                      Substrate
                      <select value={fSubstrate} onChange={(e) => setFSubstrate(e.target.value as Substrate)} className="cursor-pointer border-2 border-ink bg-white px-2 py-1.5 text-sm font-normal">
                        {SUBSTRATES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs font-bold tracking-wider uppercase">
                      Site
                      <input value={fSite} onChange={(e) => setFSite(e.target.value)} placeholder="Where it lives" className="border-2 border-ink px-2 py-1.5 text-sm font-normal normal-case" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold tracking-wider uppercase">
                      Founded
                      <input value={fFounded} onChange={(e) => setFFounded(e.target.value)} inputMode="numeric" className="border-2 border-ink px-2 py-1.5 text-sm font-normal" />
                    </label>
                  </div>
                  <label className="grid gap-1 text-xs font-bold tracking-wider uppercase">
                    Field notes
                    <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} placeholder="Aspect, colour, neighbours…" className="border-2 border-ink px-2 py-1.5 text-sm font-normal normal-case" />
                  </label>
                  <button type="submit" className="font-display bg-ink py-2 text-sm tracking-[0.2em] text-white uppercase hover:bg-bau-blue">
                    ■ File in archive
                  </button>
                </div>
              </form>
            )}

            <div className="log-scroll mt-3 max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {results.length === 0 && (
                <div key={query + substrate} className="shake-once border-[3px] border-bau-red p-5 text-center">
                  <div className="mx-auto h-0 w-0 border-x-[26px] border-b-[44px] border-x-transparent border-b-bau-red" aria-hidden="true" />
                  <p className="font-display mt-3 text-sm tracking-widest uppercase">No specimens found</p>
                  <p className="mt-1 text-sm">Nothing matches “{query}”. Loosen the search or log a new colony.</p>
                  <button onClick={() => { setQuery(''); setSubstrate('All'); }} className="font-display mt-3 border-[3px] border-ink bg-bau-yellow px-3 py-1.5 text-xs uppercase">
                    Reset search
                  </button>
                </div>
              )}
              {results.map((c) => {
                const active = c.id === selected?.id;
                const growth = c.rings.reduce((s, r) => s + r.widthMm, 0);
                return (
                  <article
                    key={c.id}
                    data-active={active}
                    onClick={() => pickColony(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pickColony(c.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${c.name} rings`}
                    className={`log-row cursor-pointer border-[3px] border-ink border-l-[10px] bg-white p-3 text-left transition-colors ${
                      active ? 'border-l-bau-blue' : 'border-l-transparent hover:border-l-bau-blue'
                    }`}
                    aria-current={active ? 'true' : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className={`bullet mt-1.5 h-3.5 w-3.5 shrink-0 ${active ? 'bg-bau-red' : 'bg-bau-red'}`} aria-hidden="true" />
                        <div>
                          <h3 className="font-display text-lg leading-tight uppercase">{mark(c.name, query)}</h3>
                          <p className="text-sm italic">{mark(c.species, query)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeColony(c.id);
                        }}
                        className={`font-display shrink-0 border-2 px-2 py-1 text-[10px] tracking-widest uppercase ${
                          armedDelete === c.id ? 'border-ink bg-bau-red text-white' : 'border-ink bg-white hover:bg-bau-red hover:text-white'
                        }`}
                        aria-label={armedDelete === c.id ? `Confirm removal of ${c.name}` : `Remove ${c.name}`}
                      >
                        {armedDelete === c.id ? 'Sure?' : '✕'}
                      </button>
                    </div>
                    <div className="rule my-2 h-[3px] bg-ink" aria-hidden="true" />
                    <dl className="grid grid-cols-3 gap-1 text-[11px] tracking-wide uppercase">
                      <div><dt className="opacity-60">Substrate</dt><dd className="font-bold">{c.substrate}</dd></div>
                      <div><dt className="opacity-60">Since</dt><dd className="font-bold">{c.founded}</dd></div>
                      <div><dt className="opacity-60">Growth</dt><dd className="font-bold">{Math.round(growth * 10) / 10} mm</dd></div>
                    </dl>
                    <p className="mt-1.5 text-sm leading-snug">{mark(c.site, query)}</p>
                    {c.notes && <p className="mt-1 text-[13px] leading-snug text-ink/70">{mark(c.notes, query)}</p>}
                    <p className="mt-1.5 text-[11px] tracking-widest uppercase">
                      <span className="bg-ink px-1.5 py-0.5 text-white">◉ {c.rings.length} rings</span>
                      {active && <span className="ml-1 bg-bau-yellow px-1.5 py-0.5">● on scope</span>}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* diagonal divider */}
          <div className="hidden items-stretch justify-center lg:col-span-1 lg:flex" aria-hidden="true">
            <div className="w-[5px] rotate-[8deg] bg-ink" />
          </div>

          {/* -------- GROWTH RINGS (right, 6) -------- */}
          <section id="rings" aria-label="Growth rings" className="scroll-mt-4 lg:col-span-6">
            <h2 className="font-display text-2xl uppercase">
              <span className="mr-2 inline-block h-5 w-5 rounded-full bg-bau-blue align-baseline" aria-hidden="true" />
              Growth rings
            </h2>
            {!selected || !geometry || !selStats ? (
              <p className="mt-3 border-[3px] border-ink p-5 text-sm">The archive is empty. Log the first colony to grow rings.</p>
            ) : (
              <div className="mt-3 border-[3px] border-ink">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[3px] border-ink bg-ink px-4 py-2.5 text-white">
                  <p className="font-display text-lg uppercase">{selected.name}</p>
                  <p className="text-xs tracking-[0.25em] uppercase">est. {selected.founded}</p>
                </div>

                {/* ring visualizer */}
                <div className="bg-white p-2">
                  <svg viewBox="0 0 400 400" className="mx-auto block w-full max-w-[430px]" role="img" aria-label={`Growth rings of ${selected.name}: ${geometry.rings.length} measured rings`}>
                    {/* live edge */}
                    <circle cx="200" cy="200" r={geometry.outer + 12} fill="none" stroke="#DA291C" strokeWidth="3" strokeDasharray="10 8" className="live-edge" />
                    {geometry.rings.map((ring, i) => {
                      const r = geometry.radii[i];
                      const sw = geometry.strokes[i];
                      const color = RING_COLORS[i % 3];
                      const hot = hoverYear === ring.year || activeYear === ring.year;
                      const circ = 2 * Math.PI * Math.max(r, 1);
                      return (
                        <g key={ring.year}>
                          <circle cx="200" cy="200" r={r} fill="none" stroke="#161616" strokeWidth={sw + (hot ? 6 : 3)} opacity={hot ? 1 : 0.9} strokeDasharray={String(circ)} className="ring-draw" style={{ ['--ring-len' as string]: circ }} />
                          <circle
                            cx="200" cy="200" r={r} fill="none" stroke={color} strokeWidth={sw + (hot ? 3 : 0)}
                            strokeDasharray={String(circ)} className="ring-draw cursor-pointer" style={{ ['--ring-len' as string]: circ, animationDelay: `${i * 70}ms` }}
                            onMouseEnter={() => setHoverYear(ring.year)}
                            onMouseLeave={() => setHoverYear(null)}
                            onFocus={() => setHoverYear(ring.year)}
                            onBlur={() => setHoverYear(null)}
                            onClick={() => {
                              setActiveYear(ring.year);
                              document.getElementById(`ring-${ring.year}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Ring ${ring.year}, ${ring.widthMm} millimetres`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveYear(ring.year);
                              }
                            }}
                          >
                            <title>{`${ring.year}: ${ring.widthMm} mm`}</title>
                          </circle>
                        </g>
                      );
                    })}
                    <circle cx="200" cy="200" r="10" fill="#161616" />
                    {/* center readout in viewBox units so it scales with the art */}
                    {focusRing ? (
                      <g textAnchor="middle" aria-hidden="true">
                        <text x="200" y="258" fontSize="26" fontWeight="900" fill="#161616" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                          {focusRing.year}
                        </text>
                        <text x="200" y="280" fontSize="16" fontWeight="900" fill="#DA291C" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                          +{focusRing.widthMm} mm
                        </text>
                      </g>
                    ) : (
                      <text x="200" y="262" textAnchor="middle" fontSize="22" fontWeight="900" fill="#161616" style={{ fontFamily: "'Archivo Black', sans-serif" }} aria-hidden="true">
                        {selected.founded}
                      </text>
                    )}
                  </svg>
                </div>

                {/* stats */}
                <div className="grid grid-cols-3 border-t-[3px] border-ink text-center" role="list" aria-label="Colony statistics">
                  {[
                    { k: 'Age', v: `${selStats.age} yrs`, bg: 'bg-bau-red text-white' },
                    { k: 'Diameter', v: `${selStats.diameter} mm`, bg: 'bg-bau-yellow' },
                    { k: 'Mean / yr', v: `${selStats.avg} mm`, bg: 'bg-bau-blue text-white' },
                  ].map((s) => (
                    <div key={s.k} role="listitem" className={`border-ink px-2 py-2.5 [&:not(:last-child)]:border-r-[3px] ${s.bg}`}>
                      <p className="font-display text-base leading-tight sm:text-xl">{s.v}</p>
                      <p className="text-[10px] tracking-[0.3em] uppercase opacity-80">{s.k}</p>
                    </div>
                  ))}
                </div>

                {/* growth events + add ring */}
                <div className="border-t-[3px] border-ink p-3">
                  <h3 className="font-display text-xs tracking-[0.3em] uppercase">✎ Growth events</h3>
                  <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                    {[...geometry.rings].reverse().map((ring) => (
                      <li
                        key={ring.year}
                        id={`ring-${ring.year}`}
                        className={`flex scroll-mt-2 items-center justify-between gap-2 border-2 px-2 py-1 text-sm ${
                          activeYear === ring.year ? 'border-ink bg-bau-yellow' : 'border-ink/20 hover:border-ink'
                        }`}
                      >
                        <button onClick={() => setActiveYear(activeYear === ring.year ? null : ring.year)} className="flex flex-1 items-center gap-2 text-left" aria-pressed={activeYear === ring.year}>
                          <span className="h-3 w-3 shrink-0 rounded-full border-2 border-ink" style={{ background: RING_COLORS[geometry.rings.indexOf(ring) % 3] }} aria-hidden="true" />
                          <span className="font-display">{ring.year}</span>
                          <span>+{ring.widthMm} mm</span>
                          {ring.note && <span className="truncate text-ink/60">— {ring.note}</span>}
                        </button>
                        <button onClick={() => removeRing(selected.id, ring.year)} className="px-1 text-xs text-bau-red hover:font-bold" aria-label={`Delete ${ring.year} measurement`}>
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addRing();
                    }}
                  >
                    <label className="grid gap-1 text-[10px] font-bold tracking-widest uppercase">
                      Year
                      <input value={rYear} onChange={(e) => setRYear(e.target.value)} inputMode="numeric" className="border-2 border-ink px-2 py-1.5 text-sm font-normal" aria-label="Ring year" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-bold tracking-widest uppercase">
                      Width mm
                      <input value={rWidth} onChange={(e) => setRWidth(e.target.value)} inputMode="decimal" className="border-2 border-ink px-2 py-1.5 text-sm font-normal" aria-label="Ring width in millimetres" />
                    </label>
                    <label className="grid hidden gap-1 text-[10px] font-bold tracking-widest uppercase sm:grid">
                      Note
                      <input value={rNote} onChange={(e) => setRNote(e.target.value)} placeholder="optional" className="border-2 border-ink px-2 py-1.5 text-sm font-normal" aria-label="Ring note" />
                    </label>
                    <button type="submit" className="font-display col-span-3 bg-ink px-3 py-2 text-xs tracking-[0.2em] text-white uppercase hover:bg-bau-red sm:col-span-1 sm:col-start-3">
                      + Ring
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ============ FOOTER ============ */}
        <footer className="mt-8 border-t-4 border-ink pt-4 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-xs tracking-[0.25em] uppercase">● ■ ▲ Lichen Archive — slow time, hard shapes</p>
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-4 w-4 rounded-full bg-bau-red" />
              <span className="h-4 w-4 bg-bau-yellow" />
              <span className="h-4 w-4 bg-bau-blue" />
              <span className="h-4 w-4 bg-ink" />
            </div>
            <p className="text-xs tracking-wider uppercase">Stored locally · {colonies.length} colonies · {colonies.reduce((s, c) => s + c.rings.length, 0)} rings</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
