import { memo } from 'react'

interface LanternProps {
  date: string
  label: string
  lit: boolean
  reading: boolean
  isTonight: boolean
  onLight: (date: string) => void
}

function Lantern({ date, label, lit, reading, isTonight, onLight }: LanternProps) {
  return (
    <button
      type="button"
      className={`lantern${lit ? ' is-lit' : ''}${reading ? ' is-reading' : ''}${
        isTonight ? ' is-tonight' : ''
      }`}
      aria-label={`${label}${isTonight ? ' — tonight' : ''}${lit ? '' : ', dark'}`}
      aria-pressed={reading}
      onClick={() => onLight(date)}
    >
      <span className="lantern-notch" aria-hidden="true" />
      <span className="lantern-halo" aria-hidden="true" />
      <span className="lantern-cap" aria-hidden="true" />
      <span className="lantern-chamber" aria-hidden="true" />
      <span className="lantern-legs" aria-hidden="true">
        <i className="leg leg-l" />
        <i className="leg leg-r" />
      </span>
      <span className="lantern-label">{label}</span>
    </button>
  )
}

export default memo(Lantern)