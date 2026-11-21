import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CUT,
  GLYPHS_FOR_SUTRA,
  LIVES,
  ROUND,
  createGame,
  multiplier,
  rankFor,
  startGame,
  step,
  strike,
  type Game,
  type Oat,
  type Phase,
} from './game/engine'
import { render, type SparkColor, type View } from './game/render'
import { sound } from './sound'
import {
  buildOfuda,
  challengeUrl,
  copyText,
  downloadBlob,
  haikuFor,
  readChallenge,
  shareText,
  type RunResult,
} from './share'

const GLYPHS = ['麦', '截', '神', '雷', '刃', '雨']

// storage can throw outright (Safari block-all-cookies, sandboxed iframe) — never let it blank the page
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* session-only run */
  }
}

type Hud = {
  score: number
  timeLeft: number
  combo: number
  lives: number
  glyphs: number
  sutras: number
  mult: number
}

const ZERO_HUD: Hud = { score: 0, timeLeft: ROUND, combo: 0, lives: LIVES, glyphs: 0, sutras: 0, mult: 1 }

type Judge = { id: number; kind: string; en: string; jp: string }

const JUDGES: Record<string, Judge> = {
  perfect: { id: 0, kind: 'perfect', en: 'PERFECT', jp: '完璧' },
  good: { id: 0, kind: 'good', en: 'GOOD', jp: '良' },
  whiff: { id: 0, kind: 'whiff', en: 'WHIFF', jp: '空振' },
  miss: { id: 0, kind: 'miss', en: 'MISS', jp: '失' },
  sutra: { id: 0, kind: 'sutra', en: 'SUTRA', jp: '経' },
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game>(createGame())
  const viewRef = useRef<View>({ flare: 0, shake: 0, open: 0, sparks: [], time: 0 })
  const phaseRef = useRef<Phase>('title')
  const judgeIdRef = useRef(0)
  const hudRef = useRef<Hud>({ ...ZERO_HUD })

  const [phase, setPhase] = useState<Phase>('title')
  const [hud, setHud] = useState<Hud>({ ...ZERO_HUD })
  const [judge, setJudge] = useState<Judge | null>(null)
  const [best, setBest] = useState(() => Number(lsGet('omm.best') || 0))
  const [muted, setMuted] = useState(() => lsGet('omm.muted') === '1')
  const mutedRef = useRef(muted)
  const [result, setResult] = useState<RunResult | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [challenge] = useState<number | null>(() => readChallenge())
  const [runs, setRuns] = useState(() => Number(lsGet('omm.runs') || 0))
  const resultRef = useRef<HTMLDivElement>(null)

  const pushJudge = useCallback((kind: string) => {
    const base = JUDGES[kind]
    if (!base) return
    judgeIdRef.current += 1
    setJudge({ ...base, id: judgeIdRef.current })
  }, [])

  const burst = useCallback((x: number, y: number, color: SparkColor, n = 12, power = 0.4) => {
    const v = viewRef.current
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 0.08 + Math.random() * power
      v.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.08,
        life: 0.45 + Math.random() * 0.45,
        max: 0.9,
        color,
        size: 1.4 + Math.random() * 2.8,
      })
    }
    if (v.sparks.length > 180) v.sparks.splice(0, v.sparks.length - 180)
  }, [])

  const begin = useCallback(() => {
    const g = gameRef.current
    if (g.phase === 'playing') return
    sound.unlock()
    sound.begin()
    startGame(g)
    phaseRef.current = 'playing'
    setPhase('playing')
    setResult(null)
    setJudge(null)
    viewRef.current.sparks = []
    viewRef.current.flare = 1.4
    viewRef.current.shake = 0
    hudRef.current = { ...ZERO_HUD }
    setHud({ ...ZERO_HUD })
  }, [])

  const snip = useCallback(() => {
    sound.unlock()
    const g = gameRef.current
    if (g.phase === 'title') {
      begin()
      return
    }
    const ev = strike(g)
    if (!ev) return
    const v = viewRef.current
    v.open = 1
    const x = ev.x ?? 0.5

    if (ev.type === 'perfect') {
      v.flare = 1
      burst(x, CUT, 'gold', 14, 0.6)
      sound.slice(g.combo - 1)
      sound.perfect()
      pushJudge('perfect')
    } else if (ev.type === 'good') {
      v.flare = 0.6
      burst(x, CUT, 'cyan', 8, 0.35)
      sound.slice(g.combo - 1)
      pushJudge('good')
    } else if (ev.type === 'sutra') {
      v.flare = 1.6
      burst(0.5, CUT, 'gold', 26, 0.9)
      sound.sutra()
      pushJudge('sutra')
    } else {
      v.shake = 0.4
      sound.whiff()
      pushJudge('whiff')
    }
  }, [begin, burst, pushJudge])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    lsSet('omm.muted', next ? '1' : '0')
    sound.setMuted(next)
    if (!next) {
      sound.unlock()
      sound.tick()
    }
  }, [])

  // sound + persisted mute
  useEffect(() => {
    sound.setMuted(mutedRef.current)
  }, [])

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let last = performance.now()
    const ambient: Oat[] = Array.from({ length: 4 }, (_, i) => ({
      id: -1 - i,
      x: 0.18 + i * 0.2,
      y: i * 0.24,
      vy: 0.16 + i * 0.02,
      rot: i,
      spin: 0.5 - i * 0.2,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const endRound = (g: Game) => {
      const r: RunResult = {
        score: g.score,
        rank: rankFor(g.score),
        bestCombo: g.bestCombo,
        sutras: g.sutras,
        perfects: g.perfects,
        misses: g.misses,
      }
      setResult(r)
      sound.end()
      const stored = Number(lsGet('omm.best') || 0)
      setNewBest(r.score > stored)
      if (r.score > stored) {
        lsSet('omm.best', String(r.score))
        setBest(r.score)
      }
      const n = Number(lsGet('omm.runs') || 0) + 1
      lsSet('omm.runs', String(n))
      setRuns(n)
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const g = gameRef.current
      const v = viewRef.current
      v.time = now / 1000
      v.flare = Math.max(0, v.flare - dt * 3.4)
      v.open = Math.max(0, v.open - dt * 5)
      v.shake = Math.max(0, v.shake - dt * 4)

      for (let i = v.sparks.length - 1; i >= 0; i--) {
        const p = v.sparks[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.5 * dt
        p.life -= dt
        if (p.life <= 0 || p.y > 1.2) v.sparks.splice(i, 1)
      }

      if (g.phase === 'playing') {
        const events = step(g, dt)
        for (const e of events) {
          if (e.type === 'miss') {
            v.shake = 0.55
            burst(e.x ?? 0.5, 0.98, 'red', 14, 0.5)
            sound.miss()
            pushJudge('miss')
          }
        }
      } else if (g.phase === 'title') {
        for (const o of ambient) {
          o.y += o.vy * dt
          o.rot += o.spin * dt
          if (o.y > 1.1) {
            o.y = -0.12
            o.x = 0.16 + Math.random() * 0.68
          }
        }
      }

      if (g.phase !== phaseRef.current) {
        phaseRef.current = g.phase
        setPhase(g.phase)
        if (g.phase === 'result') endRound(g)
      }

      const snap: Hud = {
        score: g.score,
        timeLeft: Math.max(0, Math.ceil(g.timeLeft)),
        combo: g.combo,
        lives: g.lives,
        glyphs: g.glyphs,
        sutras: g.sutras,
        mult: multiplier(g.combo),
      }
      const prev = hudRef.current
      if (
        snap.score !== prev.score ||
        snap.timeLeft !== prev.timeLeft ||
        snap.combo !== prev.combo ||
        snap.lives !== prev.lives ||
        snap.glyphs !== prev.glyphs ||
        snap.sutras !== prev.sutras ||
        snap.mult !== prev.mult
      ) {
        hudRef.current = snap
        setHud(snap)
      }

      const scene = g.phase === 'title' ? { ...g, oats: ambient } : g
      render(ctx, w, h, scene, v)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [burst, pushJudge])

  // keyboard: space / enter snip, M mutes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === 'm' || e.key === 'M') {
        toggleMute()
        return
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        if (tag === 'BUTTON') return
        e.preventDefault()
        snip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snip, toggleMute])

  const onShare = useCallback(async () => {
    if (!result) return
    sound.tick()
    const text = shareText(result)
    const url = challengeUrl(result.score, result.rank)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'OAT MANTIS MINSTER 麦截', text, url })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }
    const ok = await copyText(text)
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 1900)
  }, [result])

  const onExport = useCallback(async () => {
    if (!result || saving) return
    sound.tick()
    setSaving(true)
    try {
      const blob = await buildOfuda(result)
      if (blob) downloadBlob(blob, `oat-mantis-${result.score}.png`)
    } finally {
      setSaving(false)
    }
  }, [result, saving])

  // move focus into the result panel so a timeout end is announced and reachable
  useEffect(() => {
    if (phase === 'result') resultRef.current?.focus()
  }, [phase])

  const timePct = (hud.timeLeft / ROUND) * 100

  return (
    <div className="app">
      <div className="scanlines" aria-hidden="true" />

      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            麦截
          </span>
          <div>
            <h1 className="title" data-text="OAT MANTIS MINSTER">
              OAT MANTIS MINSTER
            </h1>
            <p className="subtitle">
              麦を截れ <span>— cut the grain at the line</span>
            </p>
          </div>
        </div>
        <div className="masthead-right">
          <span className="run-count">
            RUNS <b>{String(runs).padStart(2, '0')}</b>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Sound off, press to enable audio' : 'Sound on, press to mute'}
          >
            <span aria-hidden="true">{muted ? '音 OFF' : '音 ON'}</span>
          </button>
        </div>
      </header>

      <main className="board">
        <aside className="rail" aria-hidden="true">
          <span className="rail-kanji">神</span>
          <span className="rail-kanji hot">麦</span>
          <span className="rail-kanji">截</span>
          <span className="rail-rule" />
          <span className="rail-note">重力の寺 · GRAVITY TEMPLE</span>
          <span className="rail-dots">○ ● ○</span>
        </aside>

        <section className="stage-shell">
          <div className="stage-frame">
            <canvas ref={canvasRef} className="stage-canvas" />
            <div className="stage-top">
              <div className="lives" role="img" aria-label={`${hud.lives} of ${LIVES} lanterns left`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < hud.lives ? 'lit' : ''} aria-hidden="true">
                    灯
                  </span>
                ))}
              </div>
              <div className="clock">
                <span className="clock-k">刻</span>
                <span className="clock-v">{String(hud.timeLeft).padStart(2, '0')}</span>
              </div>
            </div>
            <div className="time-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, timePct))}%` }} />
            </div>
            <div className="cut-label" style={{ top: `${CUT * 100}%` }} aria-hidden="true">
              <span>截線</span>
            </div>

            {judge && (
              <div key={judge.id} className={`judge judge-${judge.kind}`} role="status">
                <span className="judge-en">{judge.en}</span>
                <span className="judge-jp">{judge.jp}</span>
              </div>
            )}

            {phase === 'playing' && (
              <button type="button" className="stage-tap" onClick={snip} aria-label="Snip the falling oat">
                <span className="sr-only">Snip</span>
              </button>
            )}

            {phase === 'title' && (
              <div className="panel panel-title">
                <span className="eyebrow">RITUAL No.3 · 三十秒</span>
                <p className="panel-kanji" aria-hidden="true">
                  麦截
                </p>
                <p className="panel-lead">
                  Snip each oat as it crosses the magenta line.
                  <br />
                  One key. Thirty seconds. Three bells close the gate.
                </p>
                <button type="button" className="btn btn-primary" onClick={begin}>
                  Snip 截
                </button>
                <ul className="panel-keys">
                  <li>
                    <kbd>SPACE</kbd> / tap — snip
                  </li>
                  <li>
                    <kbd>M</kbd> — sound
                  </li>
                </ul>
                {best > 0 && <p className="panel-best">BEST 極 · {best}</p>}
                {challenge !== null && <p className="panel-challenge">挑戦状 — beat {challenge}</p>}
              </div>
            )}

            {phase === 'result' && result && (
              <div className="panel panel-result" role="status" tabIndex={-1} ref={resultRef}>
                <span className="eyebrow">RUN ENDED · 終</span>
                <div className="result-head">
                  <div className="seal" aria-label={`Rank ${result.rank}`}>
                    <span className="seal-k">位</span>
                    <span className="seal-v">{result.rank}</span>
                  </div>
                  <div>
                    <p className="result-score">{result.score}</p>
                    <p className="result-sub">
                      {newBest ? 'NEW BEST 極' : `BEST 極 ${best}`} · {result.misses} bell{result.misses === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <dl className="result-rows">
                  <div>
                    <dt>PERFECT</dt>
                    <dd>{result.perfects}</dd>
                  </div>
                  <div>
                    <dt>CHAIN</dt>
                    <dd>×{result.bestCombo}</dd>
                  </div>
                  <div>
                    <dt>SUTRA</dt>
                    <dd>{result.sutras}</dd>
                  </div>
                </dl>
                <p className="haiku">
                  {haikuFor(result.rank).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
                <div className="result-actions">
                  <button type="button" className="btn btn-primary" onClick={begin}>
                    Again 再
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={onShare}>
                    {copied ? 'Copied ✓' : 'Share 共有'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={onExport} disabled={saving}>
                    {saving ? 'Sealing…' : 'Ofuda 御札'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="ledger">
          <div className="stat">
            <span className="stat-k">SCORE 点</span>
            <strong className="stat-v">{String(hud.score).padStart(3, '0')}</strong>
          </div>
          <div className="stat combo-stat">
            <span className="stat-k">COMBO 連</span>
            <strong className={`stat-v combo ${hud.combo > 0 ? 'hot' : ''}`} key={hud.combo}>
              ×{hud.mult}
            </strong>
            <span className="stat-note">chain {hud.combo}</span>
          </div>
          <div className="stat">
            <span className="stat-k">BEST 極</span>
            <strong className="stat-v dim">{best}</strong>
          </div>

          <div className="sutra">
            <span className="stat-k">SUTRA 経</span>
            <div className="glyphs" role="img" aria-label={`${hud.glyphs} of ${GLYPHS_FOR_SUTRA} glyphs`}>
              {Array.from({ length: GLYPHS_FOR_SUTRA }, (_, i) => (
                <span key={GLYPHS[i]} className={i < hud.glyphs ? 'on' : ''} aria-hidden="true">
                  {GLYPHS[i]}
                </span>
              ))}
            </div>
            <span className="stat-note">{hud.sutras} sealed</span>
          </div>

          {challenge !== null && <p className="challenge">挑戦状 · beat {challenge}</p>}

          <p className="howto">
            Perfect snips build the chain and inscribe sutra glyphs. Six glyphs seal a sutra. A missed oat
            rings the bell.
          </p>
        </aside>
      </main>

      <footer className="footline">
        <span>30 SECOND RITUAL</span>
        <span className="dot" aria-hidden="true">
          ·
        </span>
        <span>WEBAUDIO ONLY · NO FILES</span>
        <span className="dot" aria-hidden="true">
          ·
        </span>
        <span>麦 · 神 · 截</span>
      </footer>
    </div>
  )
}
