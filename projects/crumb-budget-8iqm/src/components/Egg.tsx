import { useEffect, useMemo, useState } from 'react'
import { fmtMoney } from '../lib'
import { fanfare, zap } from '../audio'

const RAIN = ['🍩', '🧋', '🌮', '🍪', '🍕', '🍫', '☕']

interface EggProps {
  lifetimeTotal: number
  onClose: () => void
}

interface Drop {
  e: string
  left: number
  dur: number
  delay: number
}

export function Egg({ lifetimeTotal, onClose }: EggProps) {
  const [canClose, setCanClose] = useState(false)

  const drops = useMemo<Drop[]>(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      e: RAIN[i % RAIN.length]!,
      left: Math.random() * 96,
      dur: 2.6 + Math.random() * 2,
      delay: Math.random() * 2.5,
    }))
  }, [])

  useEffect(() => {
    fanfare()
    const timer = window.setTimeout(() => setCanClose(true), 1500)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      zap()
    }
  }, [onClose])

  const galactic = fmtMoney(lifetimeTotal * 42)

  const close = () => {
    if (!canClose) return
    onClose()
  }

  return (
    <div
      className="egg-overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="Snack Overdrive"
      onClick={close}
    >
      <div className="egg-rain" aria-hidden="true">
        {drops.map((d, i) => (
          <span
            key={i}
            style={{ left: `${d.left}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }}
          >
            {d.e}
          </span>
        ))}
      </div>

      <div className="egg-sun" aria-hidden="true">
        <span className="sun-slats" />
      </div>

      <h1 className="egg-banner">SNACK OVERDRIVE</h1>

      <div className="egg-marquee" aria-hidden="true">
        <span>
          スナック・オーバードライブ ・ エンドレス・サマー ・ おかネはパワー ・ エンドレス・サマー ・ スナック・オーバードライブ ・
        </span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-xs tracking-[0.3em] text-muted">GALACTIC CRUMBS · LIFETIME TOTAL × 42</p>
        <p className="egg-galactic">{galactic}</p>
        <p className="text-sm italic text-muted">your debt resonates across dimensions.</p>
      </div>

      <button
        type="button"
        className="neon-btn pink mt-2"
        onClick={close}
        aria-label="Close snack overdrive"
      >
        ✕ come back down
      </button>
    </div>
  )
}