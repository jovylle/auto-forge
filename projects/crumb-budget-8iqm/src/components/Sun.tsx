import { useState } from 'react'
import { cx } from '../lib'

interface SunProps {
  value: string
  dim: boolean
  sweepKey: number
  onPoke: () => void
}

export function Sun({ value, dim, sweepKey, onPoke }: SunProps) {
  const [wobble, setWobble] = useState(false)

  const poke = () => {
    setWobble(true)
    window.setTimeout(() => setWobble(false), 260)
    onPoke()
  }

  return (
    <div className="sun-wrap">
      <button
        type="button"
        className={cx('sun', dim && 'dim', wobble && 'wobble')}
        onClick={poke}
        aria-label="Retro sun showing the converter readout. Click it five times for a surprise."
      >
        <span className="sun-readout">{value}</span>
        <span className="sun-slats" key={sweepKey} aria-hidden="true" />
      </button>
    </div>
  )
}