import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import {
  buildReading,
  categoryMeta,
  decodeShare,
  encodeShare,
  loadAwakened,
  loadLedger,
  money,
  moneyWhole,
  randomSeed,
  readHashToken,
  saveAwakened,
  saveLedger,
  uid,
} from './oracle'
import type { Reading, Receipt } from './oracle'
import { downloadPoster } from './poster'

const AWAKE_CLICKS = 7
const MAX_OMENS = 8

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const easeOut = (v: number): number => 1 - Math.pow(1 - v, 3)

/* progress bands — fractions p of the whole ritual scroll */
const AT = {
  opening: 0.02,
  blank: 0.22,
  metersHead: 0.55,
  verdictTitle: 0.72,
  verdictBody: 0.75,
  echo: 0.8,
  ashes: 0.9,
}
const O_START = 0.16
const O_END = 0.5
const M_START = 0.57
const M_SPAN = 0.13
const EYE_OPEN = 0.68

function omenAt(i: number, n: number): number {
  if (n <= 1) return (O_START + O_END) / 2
  return O_START + ((O_END - O_START) * i) / (n - 1)
}

/* allocate whole-number percents that always sum to exactly 100 */
function allocatePercents(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return weights.map(() => 0)
  const pcts = weights.map((w) => Math.floor((w / total) * 100))
  let remainder = 100 - pcts.reduce((a, b) => a + b, 0)
  if (remainder <= 0) return pcts
  const fracs = weights
    .map((w, i) => ({ i, f: (w / total) * 100 - Math.floor((w / total) * 100) }))
    .sort((a, b) => b.f - a.f)
  for (let k = 0; k < remainder; k++) {
    const idx = fracs[k]?.i
    if (idx === undefined) break
    pcts[idx] = (pcts[idx] ?? 0) + 1
  }
  return pcts
}

/* ---------------------------------- utils --------------------------------- */
function pasteToken(seed: number, receipts: Receipt[]): string {
  const url = window.location.href.split('#')[0]
  return `${url}#o=${encodeShare(seed, receipts)}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

const ledgerKey = (a: Receipt[]): string =>
  JSON.stringify([...a].sort((x, y) => x.id.localeCompare(y.id)))

/* ------------------------------------ App --------------------------------- */
export default function App() {
  const [receipts, setReceipts] = useState<Receipt[]>(() => loadLedger())
  const [awakened, setAwakened] = useState<boolean>(() => loadAwakened())
  const [seed, setSeed] = useState<number>(() => randomSeed())
  const [offer, setOffer] = useState<{ seed: number; receipts: Receipt[] } | null>(null)
  const [toast, setToast] = useState<{ id: number; msg: ReactNode } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const notify = useCallback((msg: ReactNode) => {
    setToast({ id: Date.now(), msg })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }, [])
  const showToast = notify
  const reading = useMemo(() => buildReading(receipts, seed, awakened), [receipts, seed, awakened])

  const doShare = useCallback(() => {
    copyText(pasteToken(seed, receipts)).then((ok) =>
      notify(ok ? 'Share-link sealed to thy clipboard.' : 'The clipboard refused the seal.'),
    )
  }, [seed, receipts, notify])

  const doPoster = useCallback(() => {
    downloadPoster(reading, awakened)
    notify('A poster descends from the candle — check thy downloads.')
  }, [reading, awakened, notify])

  // awaken body class + persist
  useEffect(() => {
    document.body.classList.toggle('awakened', awakened)
    saveAwakened(awakened)
  }, [awakened])

  // import a shared reading that arrived via the URL fragment
  useEffect(() => {
    const token = readHashToken()
    if (!token) return
    const payload = decodeShare(token)
    if (!payload) return
    if (ledgerKey(payload.receipts) !== ledgerKey(loadLedger())) setOffer(payload)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  // persist ledger on every change
  useEffect(() => {
    saveLedger(receipts)
  }, [receipts])

  const adoptOffer = (accept: boolean) => {
    if (!offer) return
    if (accept) {
      setReceipts(offer.receipts)
      setSeed(offer.seed)
      showToast('A foreign ledger is adopted. The omens now speak of it.')
    }
    setOffer(null)
  }

  return (
    <>
      <Candle />
      <main className="relative z-10">
        <Hero awakened={awakened} hasEntries={receipts.length > 0} />
        <Desk
          receipts={receipts}
          onAdd={(r) => setReceipts((prev) => [r, ...prev])}
          onRemove={(id) => setReceipts((prev) => prev.filter((r) => r.id !== id))}
          onBurn={() => {
            setReceipts([])
            showToast('The ledger is ash. A clean, dangerous slate.')
          }}
          onShare={doShare}
          onPoster={doPoster}
          toastMe={showToast}
          total={reading.total}
        />
        <Ritual
          receipts={receipts}
          reading={reading}
          awakened={awakened}
          onAwaken={() => setAwakened(true)}
          onShare={doShare}
          onPoster={doPoster}
          onConsult={() => setSeed(randomSeed())}
        />
        <Footer
          onConsult={() => setSeed(randomSeed())}
          onShare={doShare}
          onPoster={doPoster}
          onAwaken={() => setAwakened((v) => !v)}
          awakened={awakened}
        />
      </main>

      {offer && (
        <div className="banner card" role="alert">
          <div className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="eyebrow">A reading arrives from afar</div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--bone)]">
                A sealed ledger of {offer.receipts.length} offering{offer.receipts.length === 1 ? '' : 's'} lies in
                the thread. Adopt it, and the oracle will consult its omens anew.
              </p>
            </div>
            <div className="flex flex-none gap-2">
              <button className="btn btn-ghost" onClick={() => adoptOffer(false)}>
                Dismiss
              </button>
              <button className="btn btn-ember" onClick={() => adoptOffer(true)}>
                Adopt
              </button>
            </div>
          </div>
        </div>
      )}

      <div key={toast?.id ?? 'none'} className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
      </div>
    </>
  )
}

/* ------------------------------- candle glow ------------------------------ */
function Candle() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const move = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = ref.current
        if (!el) return
        const dx = (e.clientX / window.innerWidth - 0.5) * 34
        const dy = (e.clientY / window.innerHeight - 0.5) * 20
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      })
    }
    window.addEventListener('mousemove', move)
    return () => {
      window.removeEventListener('mousemove', move)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div id="candleGlow" ref={ref} />
}

/* ---------------------------------- hero ---------------------------------- */
function Hero(props: { awakened: boolean; hasEntries: boolean }) {
  return (
    <header
      id="top"
      className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-5 py-16 text-center"
    >
      <div className="eyebrow flex items-center gap-3">
        <span className="inline-block h-px w-10 bg-current opacity-60" />
        <span>a tool for the fiscally doomed · expense fortune teller</span>
        <span className="inline-block h-px w-10 bg-current opacity-60" />
      </div>

      <h1 className="hero-title mt-7">
        <span className="font-body italic text-[var(--vellum)]">the</span>&nbsp;Receipt
        <br />
        O<span className="text-[var(--accent)]">r</span>acle
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--vellum)]">
        Ink thy expenses on the desk below. Then <em className="not-italic text-[var(--bone)]">descend</em> — and let
        the candle read what the ledger truly foretells.
      </p>

      {props.awakened && (
        <div className="mt-4">
          <span className="rune-badge">ᛟ the oracle is awakened</span>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <a className="btn btn-ember no-underline" href={props.hasEntries ? '#ritual' : '#desk'}>
          {props.hasEntries ? 'Descend into the reading ↓' : 'Ink thy first offering ↓'}
        </a>
      </div>

      <div className="mt-16 flex flex-col items-center gap-1 text-[var(--vellum)]">
        <span className="text-[0.65rem] tracking-[0.35em]">SCROLL</span>
        <span className="animate-bounce text-[var(--accent)]">ᛝ</span>
      </div>
    </header>
  )
}

/* ---------------------------------- desk ---------------------------------- */
function Desk(props: {
  receipts: Receipt[]
  onAdd: (r: Receipt) => void
  onRemove: (id: string) => void
  onBurn: () => void
  onShare: () => void
  onPoster: () => void
  toastMe: (m: ReactNode) => void
  total: number
}) {
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Receipt['category']>('sustenance')
  const [err, setErr] = useState<{ merchant?: string; amount?: string }>({})
  const [stampedId, setStampedId] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const amt = Number(amount.trim())
    const nextErr: { merchant?: string; amount?: string } = {}
    const name = merchant.trim()
    if (name.length < 2) nextErr.merchant = 'The merchant must bear a name (2+ letters).'
    if (name.length > 60) nextErr.merchant = "The merchant's name must stay under 60 letters."
    if (!Number.isFinite(amt) || amt <= 0) nextErr.amount = 'The coin must be a number greater than zero.'
    if (Number.isFinite(amt) && amt > 1e9) nextErr.amount = 'A tithe beyond a billion? The oracle declines such greed.'
    setErr(nextErr)
    if (nextErr.merchant || nextErr.amount) return
    const rec: Receipt = {
      id: uid(),
      merchant: name,
      amount: Math.round(amt * 100) / 100,
      category,
      at: new Date().toISOString(),
    }
    props.onAdd(rec)
    setStampedId(rec.id)
    window.setTimeout(() => setStampedId(null), 750)
    setMerchant('')
    setAmount('')
    props.toastMe(
      <>
        <strong>{rec.merchant}</strong> · {money(rec.amount)} inked &amp; waxed.
      </>,
    )
  }

  return (
    <section id="desk" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Chapter I — the desk</div>
          <h2 className="ff-display mt-1 text-4xl font-extrabold tracking-wide text-[var(--bone)]">
            Ink thy offerings
          </h2>
        </div>
        <p className="max-w-md text-right text-sm leading-relaxed text-[var(--vellum)]">
          Whatever thou spendest, write it down. The oracle reads only what is written.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* form — asymmetric, slightly tilted */}
        <form onSubmit={submit} className="card col-span-12 -rotate-[0.4deg] p-6 lg:col-span-5" noValidate>
          <div className="eyebrow">Offering desk</div>
          <div className="mt-1 text-sm italic text-[var(--vellum)]">a new expense to confess</div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="eyebrow" htmlFor="f-merchant">
                Merchant / affair
              </label>
              <input
                id="f-merchant"
                className={`field mt-2 ${err.merchant ? 'err' : ''}`}
                placeholder="e.g. The Rusty Kettle"
                value={merchant}
                maxLength={60}
                aria-invalid={err.merchant ? true : undefined}
                aria-describedby={err.merchant ? 'f-merchant-err' : undefined}
                onChange={(e) => {
                  setMerchant(e.target.value)
                  if (err.merchant) setErr((p) => ({ ...p, merchant: undefined }))
                }}
                autoComplete="off"
              />
              {err.merchant && (
                <p id="f-merchant-err" className="mt-1 text-xs text-[var(--burn)]">
                  {err.merchant}
                </p>
              )}
            </div>

            <div>
              <label className="eyebrow" htmlFor="f-amount">
                Coin spent
              </label>
              <input
                id="f-amount"
                inputMode="decimal"
                className={`field mt-2 ${err.amount ? 'err' : ''}`}
                placeholder="0.00"
                value={amount}
                aria-invalid={err.amount ? true : undefined}
                aria-describedby={err.amount ? 'f-amount-err' : undefined}
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (err.amount) setErr((p) => ({ ...p, amount: undefined }))
                }}
              />
              {err.amount && (
                <p id="f-amount-err" className="mt-1 text-xs text-[var(--burn)]">
                  {err.amount}
                </p>
              )}
            </div>

            <div>
              <label className="eyebrow" htmlFor="f-category">
                Nature of the expense
              </label>
              <select
                id="f-category"
                className="field mt-2"
                value={category}
                onChange={(e) => setCategory(e.target.value as Receipt['category'])}
              >
                {(['sustenance', 'passage', 'shelter', 'recreation', 'rites'] as const).map((c) => (
                  <option key={c} value={c}>
                    {categoryMeta(c).rune} {categoryMeta(c).label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-ember mt-2 w-full py-3! text-base">
              Ink &amp; seal the receipt ✒
            </button>
            <p className="text-center text-xs italic text-[var(--vellum)]">
              Stored only in this device — no cloud, no spies, no audit.
            </p>
          </div>
        </form>

        {/* ledger */}
        <div className="card col-span-12 p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow">The ledger</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="big-num">{moneyWhole(props.total)}</span>
                <span className="text-sm text-[var(--vellum)]">
                  across {props.receipts.length} offering{props.receipts.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost px-3! py-2! text-sm" onClick={props.onShare} title="Copy a share-link carrying this exact ledger and reading">
                ⊕ Share-link
              </button>
              <button className="btn btn-ghost px-3! py-2! text-sm" onClick={props.onPoster} title="Download a PNG augury poster of this reading">
                ⚘ Poster
              </button>
              <button
                className="btn btn-burn px-3! py-2! text-sm"
                disabled={props.receipts.length === 0}
                onClick={() => {
                  if (
                    props.receipts.length === 0 ||
                    window.confirm('Burn the entire ledger to ash? The omens will be silent until thou inkest anew.')
                  ) {
                    props.onBurn()
                  }
                }}
              >
                ☠ Burn all
              </button>
            </div>
          </div>

          <div className="mt-5">
            {props.receipts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] px-5 py-10 text-center">
                <div className="ff-display text-3xl text-[var(--accent)]">ᛉ</div>
                <p className="mt-2 italic text-[var(--vellum)]">
                  The book is blank. Confess a single expense above, and the oracle will find its voice.
                </p>
              </div>
            ) : (
              <ul className="max-h-[46vh] overflow-y-auto pr-1">
                {props.receipts.map((r) => {
                  const m = categoryMeta(r.category)
                  return (
                    <li
                      key={r.id}
                      className={`ledger-row ${stampedId === r.id ? 'stamp-in' : ''}`}
                    >
                      <span className="cat-dot" style={{ color: m.color, background: m.color }} aria-hidden />
                      <div className="min-w-0 flex-1 truncate">
                        <span className="ff-display text-lg font-bold text-[var(--bone)]">{r.merchant}</span>
                        <span className="ml-2 hidden text-xs uppercase tracking-widest text-[var(--vellum)] sm:inline">
                          {m.label}
                        </span>
                      </div>
                      <span className="ff-display text-lg font-black text-[var(--accent)]">{money(r.amount)}</span>
                      <button
                        className="ml-1 grid h-7 w-7 flex-none place-items-center rounded-full border border-transparent text-[var(--vellum)] transition hover:border-[var(--burn)] hover:text-[var(--burn)]"
                        onClick={() => props.onRemove(r.id)}
                        aria-label={`Burn ${r.merchant}`}
                        title="Remove this receipt"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------ ritual stage ------------------------------ */
interface RitualProps {
  receipts: Receipt[]
  reading: Reading
  awakened: boolean
  onAwaken: () => void
  onShare: () => void
  onPoster: () => void
  onConsult: () => void
}

function Ritual(props: RitualProps) {
  const ritualRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sigilRef = useRef<HTMLDivElement>(null)
  const eyeRef = useRef<HTMLButtonElement>(null)
  const glowRef = useRef<HTMLElement | null>(null)

  const nodesRef = useRef<{ el: Element; at: number }[]>([])
  const metersRef = useRef<{ el: HTMLElement; at: number }[]>([])
  const clicksRef = useRef(0)
  const [clicks, setClicks] = useState(0)

  const { reading, awakened } = props

  const update = useCallback(() => {
    const ritual = ritualRef.current
    const stage = stageRef.current
    if (!ritual || !stage) return
    const vh = window.innerHeight
    const rect = ritual.getBoundingClientRect()
    const span = ritual.offsetHeight - vh
    if (span <= 0) return
    const p = clamp01(-rect.top / span)
    const pe = easeOut(p)

    stage.style.setProperty('--p', p.toFixed(4))
    if (glowRef.current) glowRef.current.style.opacity = String(0.7 + p * 0.3)
    if (sigilRef.current) sigilRef.current.style.setProperty('--rot', `${-40 + pe * 440}deg`)
    if (eyeRef.current) eyeRef.current.classList.toggle('lid-open', p >= EYE_OPEN)

    for (const node of nodesRef.current) node.el.classList.toggle('shown', p >= node.at)
    for (const m of metersRef.current) {
      const frac = easeOut(clamp01((p - m.at) / M_SPAN))
      m.el.style.setProperty('--fill', frac.toFixed(4))
    }
  }, [])

  // cache DOM nodes when the reading content changes, then settle state
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const nodes: { el: Element; at: number }[] = []
    stage.querySelectorAll('[data-at]').forEach((el) => {
      const raw = el.getAttribute('data-at')
      if (raw !== null) {
        const v = Number.parseFloat(raw)
        if (Number.isFinite(v)) nodes.push({ el, at: v })
      }
    })
    nodesRef.current = nodes
    const meters: { el: HTMLElement; at: number }[] = []
    stage.querySelectorAll<HTMLElement>('.meter-fill').forEach((el) => {
      const raw = el.getAttribute('data-at')
      if (raw !== null) {
        const v = Number.parseFloat(raw)
        if (Number.isFinite(v)) meters.push({ el, at: v })
      }
    })
    metersRef.current = meters
    if (glowRef.current === null) glowRef.current = document.getElementById('candleGlow')
    update()
  }, [reading, awakened, update])

  useEffect(() => {
    const onScroll = () => update()
    const onResize = () => update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [update])

  useEffect(() => {
    if (awakened) {
      clicksRef.current = AWAKE_CLICKS
      setClicks(AWAKE_CLICKS)
    } else {
      clicksRef.current = 0
      setClicks(0)
    }
  }, [awakened])

  const eyeClick = () => {
    if (awakened) return
    const next = Math.min(clicksRef.current + 1, AWAKE_CLICKS)
    clicksRef.current = next
    setClicks(next)
    if (next >= AWAKE_CLICKS) props.onAwaken()
  }

  const whisper =
    awakened
      ? 'the oracle is awake'
      : clicks === 0
        ? 'touch the eye'
        : clicks < 3
          ? 'the eye stirs…'
          : clicks < AWAKE_CLICKS
            ? 'it sees thee counting…'
            : ''

  const counts = reading.tallies
  const percents = useMemo(() => allocatePercents(counts.map((c) => c.share)), [counts])
  const shownOmens = reading.omens.slice(0, MAX_OMENS)
  const hiddenCount = reading.omens.length - shownOmens.length
  const hiddenSum = reading.omens.slice(MAX_OMENS).reduce((s, x) => s + x.amount, 0)
  const ats = useMemo(() => shownOmens.map((_, i) => omenAt(i, shownOmens.length)), [shownOmens.length])

  return (
    <section id="ritual" ref={ritualRef} className="ritual scroll-mt-0" aria-label="The descent — a scroll divination">
      <div ref={stageRef} className="stage" style={{ '--p': 0 } as CSSProperties}>
        <div className="stage-inner">
          {/* -------- left: the oracle's face -------- */}
          <div className="flex flex-col items-center">
            <div ref={sigilRef} className="sigil-wrap">
              <div className="sigil-ring outer" aria-hidden />
              <div className="sigil-ring mid" aria-hidden />
              <div className="sigil-rune" aria-hidden>
                {awakened ? 'ᛟ' : 'ᛉ'}
              </div>
              <button
                ref={eyeRef}
                type="button"
                className={`eye ${awakened ? 'ignited' : ''}`}
                onClick={eyeClick}
                aria-label={
                  awakened
                    ? 'The awakened eye of the oracle'
                    : `Touch the oracle's eye to rouse it (${AWAKE_CLICKS - clicks} touches remain)`
                }
              >
                <span className="eye-brow" aria-hidden />
                <span className="eye-pupil" aria-hidden />
              </button>
              <span className={`whisper ${clicks > 0 ? 'on' : ''}`} aria-hidden>
                {whisper}
              </span>
            </div>
          </div>

          {/* -------- right: the revealed words -------- */}
          <div className="oracle-pane">
            <div className="reveal" data-at={AT.opening}>
              <div className="eyebrow">Chapter II — the descent</div>
              <h3 className="ff-display mt-2 text-[clamp(1.7rem,3.4vw,2.7rem)] font-extrabold leading-tight text-[var(--bone)]">
                The candle is lit.
                <br />
                <span className="text-[var(--accent)]">The quill has confessed.</span>
              </h3>
            </div>

            {/* omens — one per expense */}
            <div className="mt-4">
              {shownOmens.map((o, i) => (
                <div
                  key={`${o.merchant}-${i}`}
                  className={`reveal omen ${o.apex ? 'apex' : ''}`}
                  data-at={ats[i]}
                  style={{ '--accent': o.category.color } as CSSProperties}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="merchant">{o.merchant}</span>
                    <span className="amt">{money(o.amount)}</span>
                  </div>
                  <div className="quip">“{o.quip}.”</div>
                </div>
              ))}
              {hiddenCount > 0 && (
                <div className="reveal omen" data-at={omenAt(shownOmens.length, shownOmens.length + 1)}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="merchant">…{hiddenCount} more shadows</span>
                    <span className="amt">{money(hiddenSum)}</span>
                  </div>
                  <div className="quip">“The oracle sews the rest shut — the eye can only hold so many flames.”</div>
                </div>
              )}
              {shownOmens.length === 0 && (
                <div
                  className="reveal omen"
                  data-at={AT.blank}
                  style={{ '--accent': 'var(--arcane)' } as CSSProperties}
                >
                  <div className="merchant">The book is blank</div>
                  <div className="quip">“No offerings, no omens. Confess above, then return to this candle.”</div>
                </div>
              )}
            </div>

            {/* temper & weight — category scales */}
            {counts.length > 0 && (
              <>
                <div className="reveal mt-9" data-at={AT.metersHead}>
                  <div className="eyebrow">Chapter III — temper &amp; weight</div>
                  <h4 className="ff-display mt-1 text-xl font-bold text-[var(--bone)]">
                    Where thy coin burns brightest
                  </h4>
                </div>
                <div className="mt-3">
                  {counts.map((t, i) => (
                    <div
                      key={t.meta.id}
                      className="reveal meter-row"
                      data-at={M_START - 0.01 + (i / Math.max(counts.length - 1, 1)) * 0.02}
                    >
                      <div className="meter-label">
                        <span>
                          <span
                            className="cat-dot mr-2 inline-block"
                            style={{ color: t.meta.color, background: t.meta.color }}
                            aria-hidden
                          />
                          {t.meta.label}
                        </span>
                        <span className="mval">
                          {t.meta.rune} {percents[i]}%
                        </span>
                      </div>
                      <div className="meter-track">
                        <div
                          className="meter-fill"
                          data-at={M_START}
                          style={{ '--mcolor': t.meta.color, '--fill': 0 } as CSSProperties}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* the verdict */}
            <div className="reveal mt-10" data-at={AT.verdictTitle}>
              <div className="eyebrow">Chapter IV — the verdict</div>
              <div className="verdict-title">✦ {reading.verdict.title}</div>
            </div>
            <div className="reveal verdict-lines" data-at={AT.verdictBody}>
              {reading.verdict.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              <p className="mt-3 flex flex-wrap items-baseline gap-3">
                <span className="eyebrow text-[0.68rem]!">thy total tithe</span>
                <span className="big-num text-[clamp(2rem,4.6vw,3.4rem)]!">{money(reading.total)}</span>
              </p>
            </div>
            {reading.awakenedEcho && (
              <div className="reveal echo-line verdict-lines" data-at={AT.echo}>
                <p>
                  <strong className="ff-display">ᛟ</strong> {reading.awakenedEcho}
                </p>
              </div>
            )}

            {/* ashes */}
            <div className="reveal mt-12" data-at={AT.ashes}>
              <div className="eyebrow">Epilogue — the ashes</div>
              <p className="mt-2 max-w-md leading-relaxed text-[var(--vellum)]">
                The reading ends, as all readings do. Seal this fortune into a thread for another day — or scatter it to
                the downloads and consult the candle anew.
              </p>
              <div className="ashes-actions">
                <button className="btn btn-ghost" onClick={props.onShare}>
                  ⊕ Seal share-link
                </button>
                <button className="btn btn-ghost" onClick={props.onPoster}>
                  ⚘ Descend a poster
                </button>
                <button className="btn btn-ember" onClick={props.onConsult}>
                  ⟲ Consult again
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* drifting embers */}
        <div className="emberfield" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="ember"
              style={{
                left: `${(i * 53) % 100}%`,
                animationDuration: `${6 + ((i * 7) % 9)}s`,
                animationDelay: `${-((i * 11) % 12)}s`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- footer --------------------------------- */
function Footer(props: {
  onConsult: () => void
  onShare: () => void
  onPoster: () => void
  onAwaken: () => void
  awakened: boolean
}) {
  return (
    <footer className="relative mx-auto max-w-5xl px-5 pb-20 pt-4 text-center">
      <div className="ff-display text-3xl text-[var(--accent)]" aria-hidden>
        ᛟ
      </div>
      <p className="mx-auto mt-2 max-w-lg italic leading-relaxed text-[var(--vellum)]">
        “Spend as one who has already read the ending — and let every receipt be a candle thou art willing to light
        twice.”
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button className="btn btn-ghost px-3! py-2! text-sm" onClick={props.onShare}>
          ⊕ Share-link
        </button>
        <button className="btn btn-ghost px-3! py-2! text-sm" onClick={props.onPoster}>
          ⚘ Poster
        </button>
        <button className="btn btn-ghost px-3! py-2! text-sm" onClick={props.onConsult}>
          ⟲ Consult again
        </button>
        <button
          className="btn btn-ghost px-3! py-2! text-sm"
          onClick={props.onAwaken}
          aria-pressed={props.awakened}
        >
          {props.awakened ? 'ᛟ extinguish the oracle' : 'ᛉ awaken the oracle'}
        </button>
      </div>
      <div className="mt-10 flex flex-col gap-1 text-xs tracking-wide text-[var(--vellum)]">
        <span>No cloud · no cookies · no API keys — thy ledger lives only in this browser&rsquo;s memory.</span>
        <span>
          <a className="no-underline underline-offset-2 hover:text-[var(--accent)] hover:underline" href="#top">
            return to the top
          </a>
          {' · '}a dark-fantasy expense fortune teller
        </span>
      </div>
    </footer>
  )
}
