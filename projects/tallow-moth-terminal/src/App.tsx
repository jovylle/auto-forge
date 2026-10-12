import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LUNA_LINES,
  MISSIVES,
  NAME_A,
  NAME_B,
  PHRASES,
  REPLIES,
  SPECIES,
  WAXES,
} from './data';
import { CandleFlame, LunaSprite, MothSprite } from './sprites';

interface Seal {
  id: number;
  msg: string;
  melted: boolean;
  wax: string;
  dx: number;
  rot: number;
}

interface Moth {
  id: number;
  name: string;
  species: string;
  wing: string;
  mark: string;
  greeted: number;
}

interface ChatMsg {
  id: number;
  from: string;
  text: string;
  mine: boolean;
}

const STORE_KEY = 'tallow-moth-terminal:v1';
const MAX_MOTHS = 12;
const MAX_CHAT = 60;
const ROTS = [0, 90, 180, 270];

function takeId(ref: React.MutableRefObject<number>): number {
  const id = Date.now() * 1000 + (ref.current % 1000);
  ref.current += 1;
  return id;
}

function makeMoth(id: number): Moth {
  const sp = SPECIES[Math.floor(Math.random() * SPECIES.length)];
  const a = NAME_A[Math.floor(Math.random() * NAME_A.length)];
  const b = NAME_B[Math.floor(Math.random() * NAME_B.length)];
  return { id, name: `${a} ${b}`, species: sp.name, wing: sp.wing, mark: sp.mark, greeted: 0 };
}

function seedState() {
  return {
    seals: [0, 1, 2, 3].map((i) => ({
      id: 10 + i,
      msg: MISSIVES[i],
      melted: i % 2 === 0,
      wax: WAXES[i % WAXES.length],
      dx: (i * 11) % 17 - 8,
      rot: ROTS[i % ROTS.length],
    })) as Seal[],
    moths: [0, 1, 2].map((i) => {
      const sp = SPECIES[(i * 2) % SPECIES.length];
      return {
        id: 20 + i,
        name: `${NAME_A[(i * 3 + 1) % NAME_A.length]} ${NAME_B[(i * 4 + 2) % NAME_B.length]}`,
        species: sp.name,
        wing: sp.wing,
        mark: sp.mark,
        greeted: 0,
      };
    }) as Moth[],
    chat: [
      { id: 30, from: 'TERMINAL', text: 'candle lit. wax warm. moths inbound.', mine: false },
      { id: 31, from: 'Ash duster', text: 'prrrp. first to the flame!', mine: false },
    ] as ChatMsg[],
    lampLit: true,
    luna: false,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seedState();
    const p = JSON.parse(raw) as Partial<ReturnType<typeof seedState>>;
    if (!Array.isArray(p.seals) || !Array.isArray(p.moths) || !Array.isArray(p.chat)) {
      return seedState();
    }
    return {
      seals: p.seals,
      moths: p.moths,
      chat: p.chat,
      lampLit: p.lampLit !== false,
      luna: p.luna === true,
    };
  } catch {
    return seedState();
  }
}

const OCTAGON =
  'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)';

export default function App() {
  const idRef = useRef(1000);
  const [initial] = useState(loadState);
  const [seals, setSeals] = useState<Seal[]>(initial.seals);
  const [moths, setMoths] = useState<Moth[]>(initial.moths);
  const [chat, setChat] = useState<ChatMsg[]>(initial.chat);
  const [lampLit, setLampLit] = useState(initial.lampLit);
  const [luna, setLuna] = useState(initial.luna);
  const [stampIdx, setStampIdx] = useState(0);
  const [drip, setDrip] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [hopId, setHopId] = useState<number | null>(null);
  const [sparkId, setSparkId] = useState<number | null>(null);
  const [flameClicks, setFlameClicks] = useState(0);
  const [lunaVisiting, setLunaVisiting] = useState(false);
  const [flashChip, setFlashChip] = useState<number | null>(null);
  const [events, setEvents] = useState<string[]>([
    'terminal lit. wax warm.',
    'three moths already perch.',
    'the flame likes attention...',
  ]);
  const timers = useRef<number[]>([]);
  const flameTimer = useRef<number | null>(null);
  const chatBox = useRef<HTMLDivElement | null>(null);

  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  };

  useEffect(() => {
    const stash = timers.current;
    const ft = flameTimer.current;
    return () => {
      stash.forEach((t) => window.clearTimeout(t));
      if (ft !== null) window.clearTimeout(ft);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ seals, moths, chat, lampLit, luna }));
    } catch {
      /* storage full or blocked — terminal keeps humming in memory */
    }
  }, [seals, moths, chat, lampLit, luna]);

  useEffect(() => {
    if (chatBox.current) chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  /* moth arrivals drift in while the lamp burns */
  useEffect(() => {
    if (!lampLit) return;
    const iv = window.setInterval(() => {
      setMoths((prev) => {
        if (prev.length >= MAX_MOTHS) return prev;
        const m = makeMoth(takeId(idRef));
        setEvents((e) => [`» ${m.name} the ${m.species} lands`, ...e].slice(0, 12));
        return [...prev, m];
      });
    }, 7000);
    return () => window.clearInterval(iv);
  }, [lampLit]);

  const pushChat = (from: string, text: string, mine: boolean) => {
    const id = takeId(idRef);
    setChat((prev) => [...prev, { id, from, text, mine }].slice(-MAX_CHAT));
  };

  const mothReply = (excludeId?: number) => {
    later(() => {
      setMoths((prev) => {
        const pool = prev.filter((m) => m.id !== excludeId);
        const speaker = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
        const line = REPLIES[Math.floor(Math.random() * REPLIES.length)];
        pushChat(speaker ? speaker.name : 'THE DARK', line, false);
        return prev;
      });
    }, 900);
  };

  /* ---------- wax board ---------- */
  const stamp = (waxIdx: number) => {
    if (drip) return;
    const wax = WAXES[waxIdx % WAXES.length];
    setDrip(wax);
    later(() => {
      const id = takeId(idRef);
      const msg = MISSIVES[stampIdx % MISSIVES.length];
      setStampIdx((s) => s + 1);
      setSeals((prev) =>
        [
          ...prev,
          {
            id,
            msg,
            melted: false,
            wax,
            dx: (id % 17) - 8,
            rot: ROTS[id % ROTS.length],
          },
        ].slice(-24),
      );
      setDrip(null);
      setShakeKey((k) => k + 1);
      setEvents((e) => [`a fresh ${waxIdx === 0 ? 'blood-red' : waxIdx === 1 ? 'ember' : 'plum'} seal drips`, ...e].slice(0, 12));
    }, 660);
  };

  const toggleSeal = (id: number) => {
    setSeals((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target && !target.melted) {
        setEvents((e) => [`seal melts: "${target.msg.slice(0, 26)}..."`, ...e].slice(0, 12));
      }
      return prev.map((s) => (s.id === id ? { ...s, melted: !s.melted } : s));
    });
  };

  const meltToggleAll = () => {
    setSeals((prev) => {
      const anySealed = prev.some((s) => !s.melted);
      setEvents((e) => [anySealed ? 'all seals melt at once' : 'all notes resealed', ...e].slice(0, 12));
      return prev.map((s) => ({ ...s, melted: anySealed }));
    });
  };

  /* ---------- moth arrivals ---------- */
  const callMoth = () => {
    if (moths.length >= MAX_MOTHS) return;
    const m = makeMoth(takeId(idRef));
    setMoths((prev) => [...prev, m]);
    setEvents((e) => [`» ${m.name} the ${m.species} lands`, ...e].slice(0, 12));
  };

  const greet = (m: Moth) => {
    setHopId(m.id);
    setSparkId(m.id);
    setMoths((prev) => prev.map((x) => (x.id === m.id ? { ...x, greeted: x.greeted + 1 } : x)));
    pushChat('YOU', `*waves a wing at ${m.name}*`, true);
    setFlashChip(Math.floor(Math.random() * PHRASES.length));
    later(() => {
      pushChat(m.name, `prrrp! greeted ${m.greeted + 1}x. ${REPLIES[m.greeted % REPLIES.length]}`, false);
    }, 900);
    later(() => {
      setHopId(null);
      setSparkId(null);
      setFlashChip(null);
    }, 1800);
    setEvents((e) => [`you greet ${m.name}`, ...e].slice(0, 12));
  };

  /* ---------- terminal chat ---------- */
  const sendPhrase = (i: number) => {
    pushChat('YOU', PHRASES[i], true);
    mothReply();
  };

  const clearChat = () => {
    setChat([{ id: takeId(idRef), from: 'TERMINAL', text: 'static clears. the lamp hums on.', mine: false }]);
  };

  /* ---------- easter egg: the patient flame ---------- */
  const touchFlame = () => {
    if (lunaVisiting) return;
    const n = flameClicks + 1;
    if (flameTimer.current !== null) window.clearTimeout(flameTimer.current);
    if (n >= 5) {
      setFlameClicks(0);
      setLunaVisiting(true);
      const first = !luna;
      setLuna(true);
      LUNA_LINES.forEach((line, i) => later(() => pushChat('LUNA', line, false), 600 + i * 900));
      setEvents((e) => ['THE GREAT LUNA MOTH DESCENDS', ...e].slice(0, 12));
      later(() => setLunaVisiting(false), first ? 9500 : 8000);
    } else {
      setFlameClicks(n);
      flameTimer.current = window.setTimeout(() => setFlameClicks(0), 2500);
    }
  };

  const resetAll = () => {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
    const s = seedState();
    setSeals(s.seals);
    setMoths(s.moths);
    setChat(s.chat);
    setLampLit(s.lampLit);
    setLuna(false);
    setLunaVisiting(false);
    setFlameClicks(0);
    setEvents(['terminal snuffed. relit. wax warm.']);
  };

  const ticker = useMemo(() => events.join('  ///  ') + '  ///  ', [events]);
  const meltedCount = seals.filter((s) => s.melted).length;

  return (
    <div className="night-sky min-h-screen">
      <div className="scanlines" aria-hidden />
      {lunaVisiting && (
        <div
          aria-hidden
          className="luna-wash dither pointer-events-none fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(46, 91, 52, 0.35)' }}
        />
      )}

      {/* ================= header ================= */}
      <header className="border-b-4 border-tallowdeep bg-coal">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pb-3 pt-4">
          <div>
            <p className="font-pixel text-[10px] uppercase tracking-widest text-tallow">
              social terminal no. 7
            </p>
            <h1 className="font-pixel mt-2 text-lg text-flame sm:text-2xl">
              TALLOW MOTH TERMINAL
            </h1>
            <p className="mt-2 text-xl leading-none text-cream">
              moths gather at the candlewax terminal <span className="cursor-blink text-tallow">▌</span>
            </p>
          </div>

          {/* the candle: click-only easter egg lives here */}
          <div className="flex items-end gap-3">
            <div className="hidden text-right sm:block">
              <p className="font-pixel text-[9px] uppercase text-tallow">the candle</p>
              <p className="mt-1 min-h-6 text-lg leading-none text-cream" aria-live="polite">
                {lunaVisiting
                  ? 'SHE COMES.'
                  : flameClicks > 0
                    ? `the flame shivers... (${flameClicks}/5)`
                    : luna
                      ? 'LUNA blesses this terminal'
                      : 'the flame likes attention...'}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={touchFlame}
                aria-label="Touch the candle flame. Click it five times for a secret."
                className="flame-halo flex min-h-12 min-w-12 items-end justify-center bg-plumdeep p-2"
                style={{ boxShadow: '0 0 0 4px #000, 0 0 24px 4px rgba(255, 177, 61, 0.55)' }}
              >
                <CandleFlame size={1} />
              </button>
              <div aria-hidden className="mt-0 h-10 w-8 bg-tallow" style={{ boxShadow: '4px 4px 0 #000' }}>
                <div className="dither h-2 w-full bg-tallowdeep" />
              </div>
              <div aria-hidden className="h-2 w-14 bg-sealdeep" style={{ boxShadow: '4px 4px 0 #000' }} />
            </div>
          </div>
        </div>

        {/* ticker */}
        <div className="ticker-mask border-t-4 border-tallowdeep bg-soot px-2 py-2" aria-label="terminal ticker">
          <span className="ticker-inner text-xl text-tallow">
            {[0, 1].map((k) => (
              <span key={k} aria-hidden={k === 1}>
                {ticker}
              </span>
            ))}
          </span>
        </div>
      </header>

      {/* ================= stats strip ================= */}
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pt-4">
        {[
          `${moths.length} MOTHS PERCHED`,
          `${meltedCount}/${seals.length} SEALS MELTED`,
          `${chat.length} STATIC LINES`,
          luna ? 'LUNA: BLESSED' : 'LUNA: ???',
        ].map((s) => (
          <span
            key={s}
            className="font-pixel border-2 border-tallowdeep bg-coal px-2 py-2 text-[9px] text-cream"
          >
            {s}
          </span>
        ))}
      </div>

      {/* ================= main skyline ================= */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-10 pt-4 lg:grid-cols-12">
        {/* ---- left rail: moth arrivals ---- */}
        <section aria-label="moth arrivals" className="order-2 lg:order-1 lg:col-span-3">
          <div className="px-panel p-4">
            <h2 className="font-pixel text-[11px] uppercase text-tallow">moth arrivals</h2>
            <p className="mt-1 text-lg leading-tight">tap a moth to greet it</p>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setLampLit((v) => !v)}
                aria-pressed={lampLit}
                className={`px-btn ${lampLit ? 'bg-seal text-flame' : 'bg-plum text-cream'}`}
              >
                {lampLit ? 'DIM THE LAMP' : 'LIGHT THE LAMP'}
              </button>
              <button
                type="button"
                onClick={callMoth}
                disabled={moths.length >= MAX_MOTHS}
                className="px-btn bg-tallow text-soot"
              >
                {moths.length >= MAX_MOTHS ? 'ROOST FULL' : 'CALL A MOTH'}
              </button>
            </div>

            <div className={`mt-3 border-4 border-plum bg-plumdeep p-3 ${lampLit ? 'lamp-glow' : ''}`}>
              <p className="font-pixel text-[9px] uppercase text-flame">
                {lampLit ? 'lamp: BURNING' : 'lamp: COLD'}
              </p>
              <div aria-hidden className="mx-auto mt-2 h-8 w-6 bg-tallow">
                <div className="dither h-2 w-full bg-tallowdeep" />
              </div>
            </div>

            {(lunaVisiting || luna) && (
              <div className="mt-3 border-4 border-luna bg-soot p-3 text-center">
                {lunaVisiting ? (
                  <div className="luna-descend inline-block">
                    <LunaSprite px={6} />
                  </div>
                ) : (
                  <div className="inline-block opacity-90">
                    <LunaSprite px={3} />
                  </div>
                )}
                <p className="font-pixel mt-2 text-[9px] uppercase text-luna">
                  {lunaVisiting ? 'THE GREAT LUNA MOTH' : 'luna watches'}
                </p>
              </div>
            )}

            <ul className="mt-3 flex flex-col gap-3">
              {moths.map((m) => (
                <li key={m.id} style={{ marginLeft: `${(m.id % 4) * 12}px` }}>
                  <button
                    type="button"
                    onClick={() => greet(m)}
                    aria-label={`Greet ${m.name}, ${m.species}`}
                    className="flex min-h-12 w-full items-center gap-3 border-4 border-tallowdeep bg-soot p-2 text-left hover:border-flame"
                  >
                    <span className={hopId === m.id ? 'hop inline-block' : 'inline-block'}>
                      <MothSprite wing={m.wing} mark={m.mark} px={3} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xl leading-none">{m.name}</span>
                      <span className="font-pixel mt-1 block text-[8px] uppercase text-tallow">
                        {m.species} · waved {m.greeted}x
                      </span>
                    </span>
                    {sparkId === m.id && (
                      <span aria-hidden className="spark font-pixel text-sm text-flame">
                        ✦
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {moths.length === 0 && (
              <p className="mt-3 border-4 border-dashed border-tallowdeep p-3 text-lg">
                no moths. light the lamp and call one.
              </p>
            )}
          </div>
        </section>

        {/* ---- center: wax board ---- */}
        <section aria-label="wax board" className="order-1 lg:order-2 lg:col-span-6">
          <div key={shakeKey} className={`px-panel px-panel-plum p-4 ${shakeKey > 0 ? 'shake' : ''}`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-pixel text-[11px] uppercase text-tallow">wax board</h2>
                <p className="mt-1 text-lg leading-tight">stamp a seal · tap a seal to melt it open</p>
              </div>
              <button type="button" onClick={meltToggleAll} className="px-btn bg-seal text-flame">
                {seals.some((s) => !s.melted) ? 'MELT ALL' : 'RESEAL ALL'}
              </button>
            </div>

            {/* stamp row */}
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="wax stamps">
              {['BLOOD SEAL', 'EMBER SEAL', 'PLUM SEAL'].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => stamp(i)}
                  disabled={drip !== null}
                  className="px-btn text-soot"
                  style={{ backgroundColor: WAXES[i] }}
                  aria-label={`Stamp a new ${label.toLowerCase()} note onto the board`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* drip chute */}
            <div aria-hidden className="relative mt-2 h-2 bg-soot" style={{ boxShadow: 'inset 0 0 0 2px #000' }}>
              {drip && (
                <span
                  className="drip-drop absolute left-1/2 top-[-14px] block h-3 w-2"
                  style={{ backgroundColor: drip }}
                />
              )}
            </div>

            {/* the board */}
            <div className="dither-gold mt-2 grid grid-cols-2 gap-4 border-4 border-tallowdeep bg-coal p-4 sm:grid-cols-3">
              {seals.map((s) => (
                <div key={s.id} style={{ marginTop: `${(s.id % 3) * 10}px`, marginLeft: `${s.dx}px` }}>
                  <button
                    type="button"
                    onClick={() => toggleSeal(s.id)}
                    aria-label={s.melted ? `Reseal note: ${s.msg}` : `Melt seal to reveal note`}
                    aria-pressed={s.melted}
                    className="seal-pop block h-16 w-16"
                    style={{
                      backgroundColor: s.melted ? '#5e1b1b' : s.wax,
                      clipPath: OCTAGON,
                      transform: `rotate(${s.rot}deg)`,
                      boxShadow: '4px 4px 0 #000',
                    }}
                  >
                    <span aria-hidden className="font-pixel text-sm" style={{ color: '#ffe9a8' }}>
                      {s.melted ? '✦' : '❖'}
                    </span>
                  </button>
                  {s.melted && (
                    <p className="melt-in mt-2 max-w-36 border-2 border-flame bg-soot p-2 text-lg leading-tight text-flame">
                      “{s.msg}”
                    </p>
                  )}
                </div>
              ))}
              {seals.length === 0 && (
                <p className="col-span-full text-lg text-cream">
                  bare wax. stamp something into it.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---- right: terminal chat (pushed down = jagged skyline) ---- */}
        <section aria-label="terminal chat" className="order-3 lg:col-span-3 lg:mt-28">
          <div className="px-panel border-flame p-4" style={{ borderColor: '#8a5f1c' }}>
            <div className="flex items-end justify-between gap-2">
              <h2 className="font-pixel text-[11px] uppercase text-tallow">terminal chat</h2>
              <button
                type="button"
                onClick={clearChat}
                className="font-pixel border-2 border-tallowdeep bg-soot px-2 py-2 text-[8px] uppercase text-cream hover:border-flame"
              >
                CLEAR STATIC
              </button>
            </div>
            <p className="mt-1 text-lg leading-tight">click-only radio. tap a phrase to send it.</p>

            <div
              ref={chatBox}
              role="log"
              aria-live="polite"
              aria-label="chat log"
              className="mt-3 h-72 overflow-y-auto border-4 border-plum bg-soot p-2"
            >
              {chat.map((c) => (
                <p
                  key={c.id}
                  className={`mb-2 border-2 p-2 text-lg leading-tight ${
                    c.mine
                      ? 'border-tallow bg-coal text-flame'
                      : c.from === 'LUNA'
                        ? 'border-luna bg-lunadeep text-flame'
                        : 'border-plum bg-plumdeep text-cream'
                  }`}
                >
                  <span className={`font-pixel block text-[8px] uppercase ${c.from === 'LUNA' ? 'text-luna' : 'text-tallow'}`}>
                    {c.from}
                  </span>
                  {c.text}
                </p>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2" role="group" aria-label="phrase chips">
              {PHRASES.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => sendPhrase(i)}
                  className={`font-pixel min-h-12 border-2 px-2 py-2 text-left text-[8px] uppercase leading-relaxed ${
                    flashChip === i
                      ? 'flash-flame border-flame bg-coal text-flame'
                      : 'border-tallowdeep bg-coal text-cream hover:border-flame hover:text-flame'
                  }`}
                >
                  ▸ {p}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-4 border-tallowdeep bg-coal">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="font-pixel text-[9px] uppercase text-tallow">
            CLICK-ONLY TERMINAL — every act is a tap · no typing, no dragging
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="font-pixel border-2 border-seal bg-soot px-3 py-3 text-[9px] uppercase text-cream hover:border-flame"
          >
            SNUFF ALL (RESET)
          </button>
        </div>
      </footer>
    </div>
  );
}
