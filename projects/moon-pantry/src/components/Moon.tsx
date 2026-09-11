import type { PhaseId } from '../data'

const SHIFT: Record<PhaseId, number | null> = {
  new: 0,
  'waxing-crescent': -25,
  'first-quarter': -50,
  'waxing-gibbous': -70,
  full: null,
  'waning-gibbous': 70,
  'last-quarter': 50,
  'waning-crescent': 25,
}

interface MoonProps {
  phase: PhaseId
  size?: number
  className?: string
}

export function Moon({ phase, size = 48, className = '' }: MoonProps) {
  const shift = SHIFT[phase]
  return (
    <span
      className={`moon ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="moon__lit" />
      {shift !== null && (
        <span className="moon__shadow" style={{ transform: `translateX(${shift}%)` }} />
      )}
    </span>
  )
}
