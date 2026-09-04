import type { Signal } from './stations'

const K_LOG = 'ghost-antenna:log'
const K_BROADCAST = 'ghost-antenna:broadcast'

export function loadLog(): Signal[] {
  try {
    const raw = localStorage.getItem(K_LOG)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Signal[]) : []
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
    return raw ? (JSON.parse(raw) as Signal) : null
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