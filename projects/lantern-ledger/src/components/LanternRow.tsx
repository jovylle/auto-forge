import Lantern from './Lantern'
import { shortLabel } from '../journal'

interface LanternRowProps {
  dates: string[]
  selected: string | null
  tonight: string
  onLight: (date: string) => void
}

export default function LanternRow({ dates, selected, tonight, onLight }: LanternRowProps) {
  const has = new Set(dates)
  return (
    <div className="lantern-row" role="group" aria-label="Nights">
      {dates.map((d) => (
        <Lantern
          key={d}
          date={d}
          label={shortLabel(d)}
          lit={has.has(d) || selected === d}
          reading={selected === d}
          isTonight={d === tonight}
          onLight={onLight}
        />
      ))}
      {!has.has(tonight) && (
        <Lantern
          date={tonight}
          label="TONIGHT"
          lit={selected === tonight}
          reading={selected === tonight}
          isTonight
          onLight={onLight}
        />
      )}
    </div>
  )
}