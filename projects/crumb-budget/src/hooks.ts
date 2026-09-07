import { useEffect, useRef, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function useCountUp(target: number, reduceMotion: boolean, duration = 650): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const first = useRef(true)

  useEffect(() => {
    if (reduceMotion) {
      setValue(target)
      fromRef.current = target
      return
    }
    if (first.current) {
      first.current = false
      fromRef.current = target
      setValue(target)
      return
    }
    const from = fromRef.current
    const diff = target - from
    if (diff === 0) return
    const start = performance.now()
    let raf = 0
    const ease = (t: number): number => 1 - Math.pow(1 - t, 4)
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration)
      const v = from + diff * ease(t)
      setValue(v)
      fromRef.current = v
      if (t < 1) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, reduceMotion, duration])

  return value
}

export interface TiltHandlers {
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => void
}

export function tiltHandlers(enabled: boolean): TiltHandlers {
  return {
    onMouseMove: (e) => {
      if (!enabled) return
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      el.style.setProperty('--ry', `${px * 6 - 3}deg`)
      el.style.setProperty('--rx', `${-(py * 6 - 3)}deg`)
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
    },
    onMouseLeave: (e) => {
      if (!enabled) return
      const el = e.currentTarget
      el.style.setProperty('--ry', '0deg')
      el.style.setProperty('--rx', '0deg')
    },
  }
}