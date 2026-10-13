// Harmonic tide reckoning for the marina: moon (M2) + sun (S2) + declination (K1).
// Synthetic but smooth and deterministic — the lanterns swell with it.

const M2 = 12.4206012 * 3600 // principal lunar, seconds
const S2 = 12.0 * 3600 // principal solar, seconds
const K1 = 23.93447 * 3600 // diurnal, seconds
const EPOCH = Date.UTC(2026, 0, 1) / 1000

export const heightAt = (unixSec: number): number => {
  const t = unixSec - EPOCH
  return (
    0.82 * Math.cos((2 * Math.PI * t) / M2 + 0.4) +
    0.38 * Math.cos((2 * Math.PI * t) / S2 - 0.9) +
    0.12 * Math.cos((2 * Math.PI * t) / K1 + 1.7)
  )
}

/** normalized 0..1 swell used to scale lantern glow */
export const swellAt = (unixSec: number): number => {
  const h = heightAt(unixSec)
  return Math.min(1, Math.max(0, (h + 1.32) / 2.64))
}

export interface Extreme {
  kind: 'high' | 'low'
  at: Date
  height: number
}

/** scan minute-by-minute across [from, from+hours] for sign changes of the derivative */
export function extremesFrom(from: Date, hours = 30): Extreme[] {
  const step = 120 // 2-minute steps
  const t0 = Math.floor(from.getTime() / 1000)
  const out: Extreme[] = []
  let prev = heightAt(t0)
  let prevSlope = 0
  for (let s = step; s <= hours * 3600; s += step) {
    const h = heightAt(t0 + s)
    const slope = h - prev
    if (prevSlope !== 0 && Math.sign(slope) !== Math.sign(prevSlope)) {
      // refine peak by parabolic interpolation around prev sample
      const h0 = heightAt(t0 + s - 2 * step)
      const h1 = prev
      const h2 = h
      const denom = h0 - 2 * h1 + h2
      let off = 0
      if (denom !== 0) off = (0.5 * (h0 - h2)) / denom
      off = Math.max(-1, Math.min(1, off))
      const peakT = t0 + s - step + off * step
      const kind = prevSlope > 0 ? 'high' : 'low'
      out.push({ kind, at: new Date(peakT * 1000), height: heightAt(peakT) })
    }
    if (slope !== 0) prevSlope = slope
    prev = h
  }
  return out
}

export const fmtTime = (d: Date): string =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const fmtDay = (d: Date): string =>
  d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

/** playful harbor units: fathoms & thumbs */
export function harborMeasure(h: number): string {
  const fathoms = 2 + h
  const whole = Math.floor(fathoms)
  const thumbs = Math.round((fathoms - whole) * 12)
  return `${whole} fathoms ${thumbs} thumbs`
}
