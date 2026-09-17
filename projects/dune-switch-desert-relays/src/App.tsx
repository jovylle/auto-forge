import { useCallback, useEffect, useRef, useState } from 'react';
import DuneCanvas from './components/DuneCanvas';
import type { HudState } from './components/DuneCanvas';
import { RelaySim } from './game/engine';
import { Synth } from './game/audio';
import { clearBoard, loadBest, loadBoard, loadMuted, pushBoard, saveBest, saveMuted } from './game/storage';
import type { BoardEntry } from './game/storage';
import { buildShareText, exportRun, importRun, seedFromUrl } from './game/share';
import type { RunStats } from './game/types';
import { MAX_HEAT, RUNNERS } from './game/types';
import type { RunnerId, SimEvent } from './game/types';

type Screen = 'title' | 'playing' | 'paused' | 'over';

const initialHud: HudState = {
  speed: 0,
  distance: 0,
  score: 0,
  heat: 0,
  stamina: [100, 100, 100],
  active: 1,
  leg: 1,
  boost: false,
  cells: 0,
  gates: 0,
  switches: 0,
};

export default function App() {
  const [seed, setSeed] = useState<number>(() => seedFromUrl());
  const simRef = useRef<RelaySim>(new RelaySim(seed));
  const [canvasKey, setCanvasKey] = useState(0);
  const [screen, setScreen] = useState<Screen>('title');
  const [hud, setHud] = useState<HudState>(initialHud);
  const [muted, setMuted] = useState<boolean>(() => loadMuted());
  const [best, setBest] = useState<RunStats | null>(() => loadBest());
  const [board, setBoard] = useState<BoardEntry[]>(() => loadBoard());
  const [isNewBest, setIsNewBest] = useState(false);
  const [finalStats, setFinalStats] = useState<RunStats | null>(null);
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState<'share' | 'export' | 'import' | null>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [imported, setImported] = useState<RunStats | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const synthRef = useRef<Synth | null>(null);
  const toastTimer = useRef(0);

  const sim = simRef.current;
  const running = screen === 'playing';

  const synth = useCallback((): Synth => {
    if (!synthRef.current) {
      synthRef.current = new Synth();
      synthRef.current.setMuted(loadMuted());
    }
    return synthRef.current;
  }, []);

  useEffect(() => {
    synth().setMuted(muted);
    saveMuted(muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1600);
  }, []);

  const startRun = useCallback(
    (nextSeed: number) => {
      setSeed(nextSeed);
      const fresh = new RelaySim(nextSeed);
      simRef.current = fresh;
      setHud(initialHud);
      setFinalStats(null);
      setIsNewBest(false);
      setDrawer(null);
      setCanvasKey((k) => k + 1);
      setScreen('playing');
      const s = synth();
      s.ensure();
      s.startArp();
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('seed', String(nextSeed));
        window.history.replaceState(null, '', url.toString());
      } catch {
        /* ignore */
      }
    },
    [synth],
  );

  const endRun = useCallback(() => {
    const stats = simRef.current.stats;
    setFinalStats(stats);
    setScreen('over');
    synth().engine(false, 0);
    synth().stopArp();
    setIsNewBest(saveBest(stats));
    setBest(loadBest());
    setBoard(pushBoard(stats));
    setDrawer('share');
  }, [synth]);

  const handleEvent = useCallback(
    (e: SimEvent) => {
      const s = synth();
      switch (e) {
        case 'pickup':
          s.pickup();
          break;
        case 'crash':
          s.crash();
          showToast('HULL HIT — switch rider to phase out!');
          break;
        case 'switch':
          s.whoosh();
          showToast(`${RUNNERS[simRef.current.active]?.name ?? ''} TAKES THE BATON`);
          break;
        case 'gate':
          s.gate();
          showToast('CLEAN RELAY — BOOST!');
          break;
        case 'miss':
          s.miss();
          showToast('GATE MISSED — no boost');
          break;
        case 'leg':
          showToast(`LEG ${simRef.current.leg} — gates ahead`);
          break;
        case 'bonk':
          s.bonk();
          showToast('CREW GASSED — heat +1');
          break;
        case 'over':
          break;
      }
    },
    [showToast, synth],
  );

  const handleHud = useCallback(
    (h: HudState) => {
      setHud(h);
      synth().engine(screen === 'playing', Math.min(1, h.speed / 42));
    },
    [screen, synth],
  );

  // keyboard controls
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key;
      if (k === 'Enter') {
        ev.preventDefault();
        if (screen === 'title' || screen === 'over') startRun(simRef.current.seed);
        else if (screen === 'paused') setScreen('playing');
        return;
      }
      if (k === 'm' || k === 'M') {
        setMuted((m) => !m);
        return;
      }
      if (screen !== 'playing') {
        if ((k === 'p' || k === 'P' || k === 'Escape') && screen === 'paused') setScreen('playing');
        return;
      }
      const s = simRef.current;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        ev.preventDefault();
        synth().ensure();
        s.steer(-1);
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        ev.preventDefault();
        synth().ensure();
        s.steer(1);
      } else if (k === ' ' || k === 'Tab') {
        ev.preventDefault();
        synth().ensure();
        s.cycleRunner();
      } else if (k === '1' || k === '2' || k === '3') {
        synth().ensure();
        s.switchRunner((Number(k) - 1) as RunnerId);
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        ev.preventDefault();
        setScreen('paused');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, startRun, synth]);

  const copyShare = useCallback(async () => {
    const stats = finalStats ?? simRef.current.stats;
    const text = buildShareText(stats);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [finalStats]);

  const downloadRun = useCallback(() => {
    const stats = finalStats ?? simRef.current.stats;
    const blob = new Blob([exportRun(stats)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dune-switch-seed${stats.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [finalStats]);

  const tryImport = useCallback(() => {
    const r = importRun(importText);
    setImported(r);
    if (!r) showToast('BAD FILE — not a dune-switch run');
  }, [importText, showToast]);

  // swipe steering on the stage
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || screen !== 'playing') return;
    const endX = e.changedTouches[0]?.clientX ?? touchX.current;
    const dx = endX - touchX.current;
    if (Math.abs(dx) > 24) simRef.current.steer(dx > 0 ? 1 : -1);
    touchX.current = null;
  };

  const heatPips = Array.from({ length: MAX_HEAT }, (_, i) => i < hud.heat);

  return (
    <div className="ds-root">
      <div className="ds-stars" aria-hidden="true" />
      {/* slanted marquee header */}
      <header className="ds-marquee" aria-label="Dune Switch marquee">
        <div className="ds-marquee-inner">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i}>DUNE SWITCH ✦ DESERT RELAYS ✦ PASS THE BATON ✦&nbsp;</span>
          ))}
        </div>
        <div className="ds-titleblock">
          <h1 className="ds-title">
            DUNE<span>SWITCH</span>
          </h1>
          <p className="ds-subtitle">desert relays · retro-wave rally</p>
        </div>
        <div className="ds-topbtns">
          <button className="ds-btn ds-btn-small" onClick={() => setHelpOpen(true)} aria-label="How to play">
            ?
          </button>
          <button
            className="ds-btn ds-btn-small"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? '♪̸' : '♪'}
          </button>
        </div>
      </header>

      <main className="ds-layout">
        {/* stage */}
        <section
          className="ds-stage"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label="Race stage"
        >
          <DuneCanvas
            key={canvasKey}
            sim={sim}
            running={running}
            onHud={handleHud}
            onEvent={handleEvent}
            onGameOver={endRun}
          />
          <div className="ds-scanlines" aria-hidden="true" />
          <div className="ds-hud" aria-live="polite">
            <div className="ds-hud-left">
              <div className="ds-score">{hud.score.toLocaleString()}<small>PTS</small></div>
              <div className="ds-dist">{hud.distance.toLocaleString()}m · LEG {hud.leg}</div>
            </div>
            <div className="ds-hud-right">
              <div className="ds-speed">{Math.round(hud.speed * 3.6)}<small>KM/H</small></div>
              <div className="ds-heat" aria-label={`Heat ${hud.heat} of ${MAX_HEAT}`}>
                {heatPips.map((hot, i) => (
                  <i key={i} className={hot ? 'on' : ''} />
                ))}
              </div>
            </div>
          </div>
          {hud.boost && screen === 'playing' && <div className="ds-boost">BOOST</div>}
          {toast !== '' && <div className="ds-toast" role="status">{toast}</div>}

          {screen === 'title' && (
            <div className="ds-overlay">
              <p className="ds-kicker">3 riders · 1 baton · 0 mercy</p>
              <h2 className="ds-big">OUTRUN<br />THE SUN</h2>
              <p className="ds-lede">
                Thread the dunes, vacuum up sun-cells, and thread every relay gate.
                Your crew tires — <b>switch riders</b> before they gas out.
              </p>
              <div className="ds-row">
                <button className="ds-btn ds-btn-go" onClick={() => startRun(seed)}>
                  ▶ START ENGINE
                </button>
                <button
                  className="ds-btn"
                  onClick={() => startRun((Math.random() * 1e9) >>> 0 || 7)}
                >
                  ⚄ SEED {String(seed).slice(-5)}
                </button>
              </div>
              {best && (
                <p className="ds-bestline">
                  HOUSE BEST — {best.score.toLocaleString()}pts · {best.distance.toLocaleString()}m · seed {best.seed}
                </p>
              )}
            </div>
          )}

          {screen === 'paused' && (
            <div className="ds-overlay">
              <h2 className="ds-big">PIT STOP</h2>
              <p className="ds-lede">Engine idling. The sun waits for no rider.</p>
              <div className="ds-row">
                <button className="ds-btn ds-btn-go" onClick={() => setScreen('playing')}>
                  ▶ RESUME
                </button>
                <button className="ds-btn" onClick={() => startRun(sim.seed)}>
                  ↻ RESTART
                </button>
              </div>
            </div>
          )}

          {screen === 'over' && finalStats && (
            <div className="ds-overlay">
              <p className="ds-kicker">{isNewBest ? '★ NEW HOUSE BEST ★' : 'WRECKED IN THE DUNES'}</p>
              <h2 className="ds-big">{finalStats.score.toLocaleString()}<small className="ds-pts">PTS</small></h2>
              <dl className="ds-stats">
                <div><dt>DIST</dt><dd>{finalStats.distance.toLocaleString()}m</dd></div>
                <div><dt>CELLS</dt><dd>{finalStats.cells}</dd></div>
                <div><dt>GATES</dt><dd>{finalStats.gates}</dd></div>
                <div><dt>PASSES</dt><dd>{finalStats.switches}</dd></div>
                <div><dt>TOP</dt><dd>{finalStats.topSpeed}km/h</dd></div>
                <div><dt>SEED</dt><dd>{finalStats.seed}</dd></div>
              </dl>
              <div className="ds-row">
                <button className="ds-btn ds-btn-go" onClick={() => startRun(finalStats.seed)}>
                  ↻ REMATCH
                </button>
                <button
                  className="ds-btn"
                  onClick={() => startRun((Math.random() * 1e9) >>> 0 || 7)}
                >
                  ⚄ NEW DUNES
                </button>
                <button className="ds-btn" onClick={() => setDrawer(drawer === null ? 'share' : null)}>
                  ⎘ SHARE
                </button>
              </div>
            </div>
          )}
        </section>

        {/* relay rail */}
        <aside className="ds-rail" aria-label="Relay crew">
          <h2 className="ds-railhead">RELAY<br />CREW</h2>
          {RUNNERS.map((r, i) => {
            const active = hud.active === i || (screen !== 'playing' && i === 1 && hud.switches === 0);
            const st = hud.stamina[i] ?? 100;
            return (
              <button
                key={r.name}
                className={`ds-card${active ? ' active' : ''}${st <= 20 ? ' gassed' : ''}`}
                onClick={() => {
                  if (screen === 'playing') {
                    synth().ensure();
                    simRef.current.switchRunner(i as RunnerId);
                  }
                }}
                aria-label={`Switch to ${r.name}`}
                aria-pressed={active}
              >
                <span className="ds-card-key">{i + 1}</span>
                <span className="ds-card-name">{r.name}</span>
                <span className="ds-card-bike">{r.bike}</span>
                <span className="ds-card-blurb">{r.blurb}</span>
                <span className="ds-stam" aria-label={`${r.name} stamina ${Math.round(st)} percent`}>
                  <i style={{ width: `${Math.round(st)}%` }} />
                </span>
              </button>
            );
          })}
          <div className="ds-steer" role="group" aria-label="Steer">
            <button className="ds-btn" onClick={() => simRef.current.steer(-1)} aria-label="Steer left">◀</button>
            <button className="ds-btn" onClick={() => simRef.current.cycleRunner()} aria-label="Pass baton">⇄ PASS</button>
            <button className="ds-btn" onClick={() => simRef.current.steer(1)} aria-label="Steer right">▶</button>
          </div>
          {screen === 'playing' ? (
            <button className="ds-btn ds-btn-ghost" onClick={() => setScreen('paused')}>❚❚ PIT (P)</button>
          ) : (
            <button className="ds-btn ds-btn-ghost" onClick={() => setDrawer(drawer === null ? 'share' : null)}>
              ⎘ SHARE / EXPORT
            </button>
          )}
        </aside>
      </main>

      {/* share / export drawer */}
      {drawer !== null && (
        <section className="ds-drawer" aria-label="Share and export">
          <div className="ds-tabs" role="tablist">
            {(['share', 'export', 'import'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={drawer === t}
                className={`ds-tab${drawer === t ? ' on' : ''}`}
                onClick={() => setDrawer(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
            <button className="ds-tab ds-tab-x" onClick={() => setDrawer(null)} aria-label="Close drawer">✕</button>
          </div>
          {drawer === 'share' && (
            <div className="ds-pane">
              <pre className="ds-sharetext">{buildShareText(finalStats ?? simRef.current.stats)}</pre>
              <div className="ds-row">
                <button className="ds-btn ds-btn-go" onClick={copyShare}>
                  {copied ? '✓ COPIED!' : '⧉ COPY RACE CARD'}
                </button>
                <button className="ds-btn" onClick={downloadRun}>⬇ RUN.JSON</button>
              </div>
              {board.length > 0 && (
                <ol className="ds-board">
                  {board.map((b, i) => (
                    <li key={`${b.seed}-${i}`}>
                      <b>#{i + 1}</b> {b.score.toLocaleString()}pts · {b.distance.toLocaleString()}m · {b.date} · seed {b.seed}
                    </li>
                  ))}
                </ol>
              )}
              {board.length > 0 && (
                <button
                  className="ds-btn ds-btn-ghost"
                  onClick={() => {
                    clearBoard();
                    setBoard([]);
                    setBest(null);
                  }}
                >
                  WIPE BOARD
                </button>
              )}
            </div>
          )}
          {drawer === 'export' && (
            <div className="ds-pane">
              <p className="ds-lede">Your run as portable JSON — send it to a rival, they can import + race your seed.</p>
              <pre className="ds-sharetext">{exportRun(finalStats ?? simRef.current.stats)}</pre>
              <div className="ds-row">
                <button className="ds-btn ds-btn-go" onClick={downloadRun}>⬇ DOWNLOAD JSON</button>
              </div>
            </div>
          )}
          {drawer === 'import' && (
            <div className="ds-pane">
              <p className="ds-lede">Paste a rival&apos;s run.json to scout their line — then race their seed.</p>
              <textarea
                className="ds-import"
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"game":"dune-switch",…}'
                aria-label="Paste run JSON"
              />
              <div className="ds-row">
                <button className="ds-btn ds-btn-go" onClick={tryImport}>⇪ INSPECT</button>
                {imported && (
                  <button className="ds-btn" onClick={() => startRun(imported.seed)}>
                    RACE SEED {imported.seed} →
                  </button>
                )}
              </div>
              {imported && (
                <p className="ds-bestline">
                  {imported.score.toLocaleString()}pts · {imported.distance.toLocaleString()}m · {imported.cells} cells · {imported.gates} gates · leg {imported.leg}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <footer className="ds-help" aria-label="Controls">
        <span><b>◀ ▶ / A D</b> steer</span>
        <span><b>SPACE</b> pass baton</span>
        <span><b>1 2 3</b> pick rider</span>
        <span><b>P</b> pit</span>
        <span><b>M</b> {muted ? 'unmute' : 'mute'}</span>
        <span className="ds-seedline">SEED {seed}</span>
      </footer>

      {helpOpen && (
        <div className="ds-helpmodal" role="dialog" aria-modal="true" aria-label="How to play">
          <div className="ds-helpanel">
            <h2>HOW TO RACE</h2>
            <ol>
              <li><b>Steer</b> with ◀ ▶ / A D / swipe. Thread the obsidian slabs.</li>
              <li><b>Vacuum sun-cells</b> (amber diamonds) — they feed rider stamina.</li>
              <li><b>Relay gates</b> glow every 400m: be in the marked lane for boost + stamina.</li>
              <li><b>Pass the baton</b> (SPACE / tap a crew card) — fresh legs, 1s of phase-through.</li>
              <li><b>3 hull hits</b> and you&apos;re wreckage. Gassed crew auto-passes; a fully gassed crew costs heat.</li>
            </ol>
            <button className="ds-btn ds-btn-go" onClick={() => setHelpOpen(false)}>GOT IT ▶</button>
          </div>
        </div>
      )}
    </div>
  );
}
