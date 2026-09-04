import type { View } from './types'

export function BreathPanel({ view, onToggle }: { view: View; onToggle: () => void }) {
  const count = view.started ? Math.max(1, Math.ceil(view.phaseRemaining)) : 0
  const phase = view.started ? view.phaseId : 'idle'

  return (
    <section className="panel breath-block" aria-label="Breath timer">
      <div className="stamp stamp-vert">RESPIRATION/03</div>
      <h2 className="panel-head">Breath</h2>
      <div className={`breath-orb ${phase}`} style={{ ['--p' as string]: view.phaseProgress }}>
        <span className="breath-count">{view.started ? count : '·'}</span>
      </div>
      <div className="breath-label-row">
        <span className={`phase-label phase-${phase}`}>{phase.toUpperCase()}</span>
        <span className="phase-sub">{view.started ? `${Math.round(view.phaseRemaining)}s` : 'press space'}</span>
      </div>
      <button
        type="button"
        className="btn-raw focus-brutal"
        onClick={onToggle}
        aria-label={!view.started ? 'Start breathing' : view.running ? 'Pause breathing' : 'Resume breathing'}
      >
        {!view.started ? 'START' : view.running ? 'PAUSE' : 'RESUME'}
      </button>
      <div className="cycle-row">
        <span className="cycle-label">cycle</span>
        <span className="cycle-num">{String(view.sessionCycles).padStart(2, '0')}</span>
      </div>
    </section>
  )
}