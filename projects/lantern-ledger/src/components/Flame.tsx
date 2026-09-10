import { useEffect, useState } from 'react'

interface FlameProps {
  streak: number
  flareTick: number
  expanded: boolean
  onToggle: () => void
}

export default function Flame({ streak, flareTick, expanded, onToggle }: FlameProps) {
  const [flaring, setFlaring] = useState(false)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    if (flareTick === 0) return
    setFlaring(true)
    setRolling(true)
    const a = window.setTimeout(() => setFlaring(false), 700)
    const b = window.setTimeout(() => setRolling(false), 400)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [flareTick])

  const scale = Math.min(0.8 + streak * 0.05, 2.2)

  return (
    <button
      type="button"
      className={`flame${expanded ? ' is-open' : ''}${flaring ? ' is-flaring' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`Streak meter — ${streak} ${streak === 1 ? 'night' : 'nights'} lit in a row`}
    >
      <span className="flame-mark" style={{ transform: `scaleY(${scale})` }} aria-hidden="true">
        <svg viewBox="0 0 40 48" width="44" height="52">
          <polygon className="flame-outer" points="20,1 37,34 20,44 3,34" />
          <polygon className="flame-inner" points="20,10 31,33 20,40 9,33" />
        </svg>
      </span>
      <span className={`flame-num${rolling ? ' is-rolling' : ''}`}>{streak}</span>
      <span className="flame-cap">NIGHTS</span>
    </button>
  )
}