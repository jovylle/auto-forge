export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function blobPath(seed: number, radius: number): string {
  const rnd = mulberry32(seed)
  const n = 7 + Math.floor(rnd() * 3)
  const pts: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.45
    const rr = radius * (0.72 + rnd() * 0.55)
    pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr])
  }
  let d = ''
  const p0 = pts[n - 1]
  const p1 = pts[0]
  d += `M ${(p0[0] + p1[0]) / 2} ${(p0[1] + p1[1]) / 2}`
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    d += ` Q ${a[0]} ${a[1]} ${mx} ${my}`
  }
  d += ' Z'
  return d
}