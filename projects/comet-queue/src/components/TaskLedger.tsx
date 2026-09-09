import type { Task } from '../lib/types'
import { relTime, urgencyForTask, URGENCY_LABEL } from '../lib/types'
import { sfx } from '../lib/audio'

interface Props {
  tasks: Task[]
  now: number
  selectedId: string | null
  onSelect: (id: string) => void
  onComplete: (id: string) => void
}

export default function TaskLedger({ tasks, now, selectedId, onSelect, onComplete }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="font-mono" style={{ padding: 'var(--sp-6) var(--sp-4)', color: 'var(--dust)', fontSize: 12, textAlign: 'center' }}>
        VOID EMPTY —<br />
        launch a comet to begin.
      </div>
    )
  }

  return (
    <div role="list" aria-label="Task registry">
      {tasks.map((t, i) => {
        const u = urgencyForTask(t, now)
        const idx = String(i + 1).padStart(2, '0')
        return (
          <div
            key={t.id}
            role="listitem"
            className={`ledger-row u--${u} ${t.done ? 'ledger-row--done' : ''} ${selectedId === t.id ? 'ledger-row--selected' : ''}`}
            onClick={() => { onSelect(t.id); sfx.select() }}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id); sfx.select() } }}
            aria-label={`${t.title}, ${URGENCY_LABEL[u]} urgency`}
          >
            <span className="ledger-idx">{idx}</span>
            <span className={`ledger-title ${t.done ? 'strike' : ''}`}>{t.title}</span>
            <span className="ledger-meta">{URGENCY_LABEL[u]} · {relTime(t.due, now)}</span>
            {!t.done && (
              <button
                className="btn btn--sm"
                style={{ flex: 'none', padding: '4px 10px', borderWidth: '2px' }}
                onClick={(e) => { e.stopPropagation(); onComplete(t.id); sfx.complete() }}
                aria-label={`Capture ${t.title}`}
              >
                Capture
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}