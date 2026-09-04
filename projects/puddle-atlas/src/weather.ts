export function rainIntensity(nowMs: number, raining: boolean): number {
  const t = nowMs / 60000
  const a = 0.5 + 0.5 * Math.sin(t * 0.43 + 1.2)
  const b = 0.5 + 0.5 * Math.sin(t * 1.71 + 0.4)
  const c = 0.5 + 0.5 * Math.sin(t * 0.117 + 4.6)
  const amb = 0.28 * a * (0.3 + 0.7 * b) * (0.4 + 0.6 * c)
  if (raining) {
    const pulse = 0.9 + 0.1 * Math.sin(nowMs / 480)
    return Math.min(1, 0.6 + 0.4 * pulse)
  }
  return amb
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = hex.trim().replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}