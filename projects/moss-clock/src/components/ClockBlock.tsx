import type { View } from './types'

export function ClockBlock({ view }: { view: View }) {
  return (
    <section className="panel clock-block" aria-label="Live clock">
      <div className="stamp stamp-vert">CHRONO/01</div>
      <div className="ruler-y" aria-hidden="true" />
      <div className="clock-face" aria-label={`${view.hh}:${view.mm}:${view.ss}`}>
        <span className="clock-digits" aria-hidden="true">
          <span className="digit">{view.hh}</span>
          <span className="colon">:</span>
          <span className="digit">{view.mm}</span>
          <span className="colon">:</span>
          <span className="digit">{view.ss}</span>
        </span>
      </div>
      <div className="clock-sub">
        <span className="date-mono">{view.date}</span>
        <span className="serif-tag">a clock that grows moss when you are still</span>
      </div>
    </section>
  )
}