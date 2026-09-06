import type { CSSProperties } from 'react'
import type { Burst } from '../types'

const COLORS = ['var(--color-rye)', 'var(--color-moss)']
const N = 8

interface Props {
  burst: Burst
}

export default function SeedBurst({ burst }: Props) {
  const seeds = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.7
    const d = 28 + Math.random() * 30
    const dx = Math.cos(a) * d
    const dy = Math.sin(a) * d - 16
    const color = COLORS[i % 2]
    const rot = Math.round(Math.random() * 360)
    return { dx, dy, color, rot }
  })

  return (
    <span className="burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
      {seeds.map((s, i) => (
        <span
          key={i}
          className="seed"
          style={
            {
              '--dx': `${s.dx}px`,
              '--dy': `${s.dy}px`,
              '--rot': `${s.rot}deg`,
              background: s.color,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}