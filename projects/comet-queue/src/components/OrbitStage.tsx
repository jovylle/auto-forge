import type { Task, Urgency } from '../lib/types'
import { urgencyForTask, RING_PERIOD, URGENCY_LABEL } from '../lib/types'

interface Props {
  tasks: Task[]
  now: number
  selectedId: string | null
  enteringId: string | null
  capturingId: string | null
  onSelect: (id: string) => void
}

const RING_SIZE: Record<Urgency, number> = { crit: 200, high: 300, mid: 400, low: 500 }

const RING_CSS: Record<Urgency, { dashed: boolean; ticked: boolean }> = {
  crit: { dashed: false, ticked: true },
  high: { dashed: true, ticked: false },
  mid: { dashed: false, ticked: false },
  low: { dashed: true, ticked: false },
}

export default function OrbitStage({ tasks, now, selectedId, enteringId, capturingId, onSelect }: Props) {
  const overdue = tasks.filter((t) => !t.done && now > t.due).length
  const rings: Urgency[] = ['crit', 'high', 'mid', 'low']
  const perRing = (u: Urgency) => tasks.filter((t) => urgencyForTask(t, now) === u)

  return (
    <div
      className="lamp-wash scanlines blueprint-grid"
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {/* corner crosshair brackets */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
        <span
          key={corner}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            ...(corner === 'top-left' && { top: 12, left: 12, borderTop: '2px solid var(--concrete)', borderLeft: '2px solid var(--concrete)' }),
            ...(corner === 'top-right' && { top: 12, right: 12, borderTop: '2px solid var(--concrete)', borderRight: '2px solid var(--concrete)' }),
            ...(corner === 'bottom-left' && { bottom: 12, left: 12, borderBottom: '2px solid var(--concrete)', borderLeft: '2px solid var(--concrete)' }),
            ...(corner === 'bottom-right' && { bottom: 12, right: 12, borderBottom: '2px solid var(--concrete)', borderRight: '2px solid var(--concrete)' }),
          }}
        />
      ))}

      {rings.map((u, i) => {
        const size = RING_SIZE[u]
        const css = RING_CSS[u]
        const ringTasks = perRing(u)
        const ccw = i % 2 === 1
        return (
          <div
            key={u}
            style={{ position: 'absolute', top: '50%', left: '50%', width: size, height: size, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}
          >
            {/* the ring line */}
            <div
              className={`ring ${css.dashed ? 'ring--dashed' : ''} ${css.ticked ? 'ring--ticked' : ''}`}
              style={{ width: size, height: size }}
              aria-hidden="true"
            />
            {/* static band label pinned top of ring */}
            <span className="ring-label" style={{ whiteSpace: 'nowrap', top: -12, left: 10 }}>
              R{i + 1} // {URGENCY_LABEL[u]} — {RING_PERIOD[u]}s
            </span>
            {/* rotating rotor carrying comets */}
            <div
              className={`ring-rotor ${ccw ? 'ring-rotor--ccw' : ''}`}
              style={{ animationDuration: `${RING_PERIOD[u]}s` }}
            >
              {ringTasks.map((t, j) => {
                const angle = (j / Math.max(1, ringTasks.length)) * 360
                return (
                  <div key={t.id} style={{ position: 'absolute', inset: 0, transform: `rotate(${angle}deg)` }}>
                    {/* anchor point on the ring edge */}
                    <div style={{ position: 'absolute', top: 0, left: '50%', width: 0, height: 0 }}>
                      {/* centers the chip on the anchor */}
                      <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
                        {/* counter-rotor — MUST oppose the parent rotor's direction to stay upright */}
                        <div className={ccw ? 'ring-rotor' : 'ring-rotor ring-rotor--ccw'} style={{ animationDuration: `${RING_PERIOD[u]}s` }}>
                          <div
                            className={`comet u--${u} ${selectedId === t.id ? 'comet--selected' : ''} ${t.done ? 'comet--done' : ''} ${enteringId === t.id ? 'comet--entering' : ''} ${capturingId === t.id ? 'comet--capturing' : ''}`}
                            onClick={() => onSelect(t.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id) } }}
                            aria-label={`${t.title}, ${URGENCY_LABEL[u]} urgency`}
                            style={{ pointerEvents: 'auto', position: 'relative' }}
                          >
                            <span className="comet-nucleus" aria-hidden="true" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{t.title}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* the core */}
      <div className={`core ${overdue > 0 ? 'core--alarm' : ''}`} aria-label={`Overdue tasks: ${overdue}`}>
        <div className="core-num">{overdue}</div>
        <div className="core-label">overdue</div>
      </div>
    </div>
  )
}