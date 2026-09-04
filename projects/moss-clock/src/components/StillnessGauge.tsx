import type { View } from './types'

export function StillnessGauge({ view }: { view: View }) {
  return (
    <section
      className={`panel gauge-block${view.disturbed ? ' alarm-state' : ''}`}
      aria-label="Stillness score"
      data-score={view.score}
    >
      <div className="stamp stamp-vert">{view.disturbed ? 'AGITATED' : 'STILLNESS/05'}</div>
      <div className="gauge-body">
        <div className="gauge-rail" role="meter" aria-valuenow={view.score} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`stillness ${view.score}`}>
          <div className="gauge-fill" style={{ ['--score' as string]: view.score }} />
        </div>
        <div className="gauge-readout">
          <span className="gauge-num">{view.score}</span>
          <span className="gauge-cap">STILL</span>
        </div>
      </div>
      <p className="serif-tag gauge-tag">stillness</p>
    </section>
  )
}