import { useCallback, useEffect, useRef, useState } from 'react'
import { CUSTOM, SNACKS, cx, fmtSnack, parseMoney, quipFor, snackLabel, wholeAndPart, type SnackChoice } from '../lib'
import { Sun } from './Sun'
import { blip, chord, error, hoverTick } from '../audio'

interface ConverterProps {
  snack: SnackChoice
  onSnack: (c: SnackChoice) => void
  onPokeSun: () => void
}

export function Converter({ snack, onSnack, onPokeSun }: ConverterProps) {
  const [amountStr, setAmountStr] = useState('')
  const [result, setResult] = useState<{ units: number; emoji: string; name: string } | null>(null)
  const [err, setErr] = useState(false)
  const [sweepKey, setSweepKey] = useState(0)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customErr, setCustomErr] = useState(false)

  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  const cur = snackLabel(snack)
  const amount = parseMoney(amountStr)
  const isCustom = snack.kind === 'custom'

  const clearResult = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    fromRef.current = 0
    setDisplay(0)
    setResult(null)
  }, [])

  const run = useCallback((to: number) => {
    cancelAnimationFrame(rafRef.current)
    const from = fromRef.current
    const t0 = performance.now()
    const dur = 700
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * e
      fromRef.current = v
      setDisplay(v)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    clearResult()
  }, [snack, clearResult])

  const onAmountChange = (v: string) => {
    setAmountStr(v)
    clearResult()
  }

  const convert = () => {
    if (!(amount > 0)) {
      error()
      setErr(true)
      window.setTimeout(() => setErr(false), 260)
      return
    }
    const units = amount / cur.price
    setResult({ units, emoji: cur.emoji, name: cur.name })
    setSweepKey((k) => k + 1)
    chord()
    run(units)
  }

  const selectSnack = (c: SnackChoice) => {
    if (c.kind === 'custom') {
      const price = parseMoney(customPrice)
      if (!(price > 0)) {
        error()
        setCustomErr(true)
        window.setTimeout(() => setCustomErr(false), 260)
        return
      }
      onSnack({ kind: 'custom', name: customName.trim() || 'Custom', price })
    } else {
      onSnack(c)
    }
    blip()
    clearResult()
  }

  const applyCustomBlur = () => {
    if (!isCustom) return
    const price = parseMoney(customPrice)
    if (price > 0 && customName.trim()) {
      onSnack({ kind: 'custom', name: customName.trim(), price })
    }
  }

  const displayDim = display <= 0
  const quip = result ? quipFor(result.units) : 'enter an amount, snacklord.'
  const wp = result ? wholeAndPart(result.units) : null

  return (
    <section className="panel col-span-12 lg:col-span-5" aria-labelledby="converter-title">
      <h2 id="converter-title" className="panel-title">
        Snack Converter
        <span className="katakana">スナック・コンバーター</span>
      </h2>

      <p className="mt-2 text-xs text-muted">
        current snack: <span className="text-lilac">{cur.emoji} {cur.name}</span>{' '}
        · <span className="term-num text-sun text-sm">{fmtSnack(cur.price)}</span>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Pick a snack">
        {SNACKS.map((s) => {
          const sel = snack.kind === 'preset' && snack.id === s.id
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={sel}
              className={cx('chip', sel && 'sel')}
              onClick={() => selectSnack({ kind: 'preset', id: s.id })}
              onMouseEnter={hoverTick}
            >
              <span aria-hidden="true">{s.emoji}</span>
              <span className="truncate">{s.name}</span>
              <span className="price">{fmtSnack(s.price)}</span>
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={isCustom}
          className={cx('chip', isCustom && 'sel')}
          onClick={() => selectSnack({ kind: 'custom', name: customName.trim() || 'Custom', price: parseMoney(customPrice) || 0 })}
          onMouseEnter={hoverTick}
        >
          <span aria-hidden="true">{CUSTOM.emoji}</span>
          <span>{CUSTOM.name}</span>
        </button>
      </div>

      {isCustom && (
        <div className="slide-in mt-3 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="custom-name" className="field-label">Snack name</label>
            <input
              id="custom-name"
              className={cx('neon-input mt-1', customErr && !customName.trim() && 'err')}
              placeholder="e.g. Lava Cake"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onBlur={applyCustomBlur}
            />
          </div>
          <div>
            <label htmlFor="custom-price" className="field-label">Price per unit</label>
            <input
              id="custom-price"
              className={cx('neon-input mt-1', customErr && !(parseMoney(customPrice) > 0) && 'err')}
              placeholder="0.00"
              inputMode="decimal"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              onBlur={applyCustomBlur}
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pink" aria-hidden="true">$</span>
          <input
            id="convert-amount"
            className={cx('neon-input amount pl-7', err && 'err')}
            placeholder="0.00"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => onAmountChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && convert()}
            aria-label="Dollar amount to convert into snacks"
          />
        </div>
        <button type="button" className="neon-btn pink" onClick={convert} onMouseEnter={hoverTick}>
          Convert ▶
        </button>
      </div>

      <div className="mt-5 flex flex-col items-center gap-2">
        <Sun value={fmtSnack(display)} dim={displayDim} sweepKey={sweepKey} onPoke={onPokeSun} />
        <p className="sun-quip" aria-live="polite">{quip}</p>

        {result && wp ? (
          <div className="mt-1 text-center">
            <p className="text-sm text-lilac">
              <span className="term-num text-xl text-lilac">{wp.whole}</span> WHOLE{' '}
              <span className="text-muted">+</span>{' '}
              <span className="term-num text-xl text-sun">{fmtSnack(wp.part)}</span> OF A{' '}
              {result.name.toUpperCase()}
            </p>
            <p className="mt-2 text-2xl leading-none" aria-hidden="true">
              {Array.from({ length: Math.min(wp.whole, 15) }, (_, i) => (
                <span key={i}>{result.emoji}</span>
              ))}
              {wp.whole > 15 && <span className="ml-1 text-sm text-muted">+{wp.whole - 15}</span>}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">hit CONVERT to cash in your dollars as snacks.</p>
        )}
      </div>
    </section>
  )
}