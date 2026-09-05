import type { Signal } from './stations'

const K_LOG = 'ghost-antenna:log'
const K_BROADCAST = 'ghost-antenna:broadcast'

function isSignal(x: unknown): x is Signal {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.freq === 'number' &&
    typeof s.callsign === 'string' &&
    typeof s.message === 'string' &&
    typeof s.strength === 'number' &&
    typeof s.at === 'number' &&
    (s.source === 'ether' || s.source === 'yours')
  )
}

export function loadLog(): Signal[] {
  try {
    const raw = localStorage.getItem(K_LOG)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSignal) : []
  } catch {
    return []
  }
}

export function saveLog(log: Signal[]): void {
  try {
    localStorage.setItem(K_LOG, JSON.stringify(log))
  } catch {
    /* storage unavailable — log lives for the session only */
  }
}

export function loadBroadcast(): Signal | null {
  try {
    const raw = localStorage.getItem(K_BROADCAST)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isSignal(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveBroadcast(sig: Signal | null): void {
  try {
    if (sig) localStorage.setItem(K_BROADCAST, JSON.stringify(sig))
    else localStorage.removeItem(K_BROADCAST)
  } catch {
    /* ignore */
  }
}