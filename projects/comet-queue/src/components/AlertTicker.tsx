import { useMemo } from 'react'
import type { Task } from '../lib/types'
import { relTime, URGENCY_LABEL, urgencyForTask } from '../lib/types'

interface Props {
  tasks: Task[]
  now: number
  lastEvent: { text: string; kind: 'hot' | 'alarm' | 'info'; key: number | string } | null
  soundOn: boolean
  onToggleSound: () => void
}

export default function AlertTicker({ tasks, now, lastEvent, soundOn, onToggleSound }: Props) {
  const alarms = useMemo(() => {
    return tasks
      .filter((t) => !t.done && now > t.due)
      .map((t) => ({ text: `${t.title.toUpperCase()} ENTERS CRITICAL WINDOW (${relTime(t.due, now)})`, kind: 'alarm' as const, key: `alarm-${t.id}` }))
  }, [tasks, now])

  const upcoming = useMemo(() => {
    return tasks
      .filter((t) => !t.done && now <= t.due && urgencyForTask(t, now) === 'crit')
      .slice(0, 3)
      .map((t) => ({ text: `${URGENCY_LABEL[urgencyForTask(t, now)]} WINDOW — ${t.title.toUpperCase()} (${relTime(t.due, now)})`, kind: 'hot' as const, key: `hot-${t.id}` }))
  }, [tasks, now])

  const items = [
    ...(lastEvent ? [lastEvent] : []),
    ...alarms.slice(0, 4),
    ...upcoming,
  ]

  return (
    <footer
      className="ticker"
      style={{ position: 'relative', zIndex: 5 }}
      aria-label="Alert ticker"
      aria-live="polite"
    >
      <span className="font-mono" style={{ fontWeight: 700, color: 'var(--comet)', fontSize: 11, letterSpacing: '0.12em', flex: 'none' }}>
        ▸TICKER
      </span>
      <div style={{ display: 'flex', gap: 18, overflow: 'hidden', flex: 1, alignItems: 'center', whiteSpace: 'nowrap' }}>
        {items.length === 0 && (
          <span className="ticker-item" style={{ color: 'var(--dust)' }}>
            ALL QUIET · NO IMPACTS DETECTED
          </span>
        )}
        {items.map((it) => (
          <span key={it.key} className={`ticker-item ${it.kind === 'alarm' ? 'ticker-item--alarm' : it.kind === 'hot' ? 'ticker-item--hot' : ''}`}>
            {it.text}
            <span aria-hidden="true" style={{ color: 'var(--concrete)' }}>◆</span>
          </span>
        ))}
      </div>
      <button
        className="btn btn--sm"
        onClick={onToggleSound}
        style={{ flex: 'none', marginLeft: 'auto' }}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
      >
        {soundOn ? 'SND ON' : 'SND OFF'}
      </button>
    </footer>
  )
}