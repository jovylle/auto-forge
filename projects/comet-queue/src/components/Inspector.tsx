import type { Task } from '../lib/types'
import { fmtDate, relTime, URGENCY_LABEL, urgencyForTask } from '../lib/types'
import { sfx } from '../lib/audio'

interface Props {
  task: Task
  now: number
  onClose: () => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

export default function Inspector({ task, now, onClose, onComplete, onDelete }: Props) {
  const u = urgencyForTask(task, now)
  return (
    <aside className="inspector inspector--open" role="dialog" aria-label={`Inspector for ${task.title}`}>
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '3px solid var(--concrete)' }}>
        <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dust)' }}>
          Inspector
        </span>
        <button className="btn btn--sm" onClick={() => { onClose(); sfx.select() }} aria-label="Close inspector">
          Close ✕
        </button>
      </div>

      <div className="crosshatch" style={{ padding: 'var(--sp-5) var(--sp-4)' }}>
        <h2 className="font-display" style={{ fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.05, margin: 0 }}>
          {task.title}
        </h2>
        <div className="mt-3">
          <span className="stamp" style={{ borderColor: task.done ? 'var(--citron)' : 'var(--comet)', color: task.done ? 'var(--citron)' : 'var(--comet)' }}>
            {task.done ? 'Captured' : `Impact ${URGENCY_LABEL[u]}`}
          </span>
        </div>
      </div>

      <div className="kv">
        <div><div className="k">Urgency</div><div className="v">{URGENCY_LABEL[u]}</div></div>
        <div><div className="k">Window</div><div className="v">{relTime(task.due, now)}</div></div>
        <div><div className="k">Due</div><div className="v">{fmtDate(task.due)}</div></div>
        <div><div className="k">Mass</div><div className="v">{task.mass}×</div></div>
        <div><div className="k">Launched</div><div className="v">{fmtDate(task.createdAt)}</div></div>
        <div><div className="k">Ride</div><div className="v">R{u === 'crit' ? 1 : u === 'high' ? 2 : u === 'mid' ? 3 : 4}</div></div>
      </div>

      <div className="flex gap-3 p-4 mt-auto" style={{ borderTop: '3px solid var(--concrete)' }}>
        {!task.done ? (
          <button className="btn" style={{ flex: 1 }} onClick={() => { onComplete(task.id); sfx.complete() }}>
            Reentry ✓
          </button>
        ) : null}
        <button className="btn btn--danger" style={{ flex: 1 }} onClick={() => { onDelete(task.id); sfx.delete() }}>
          Abort ✕
        </button>
      </div>
    </aside>
  )
}