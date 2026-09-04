import type { View } from './types'
import { formatCalm, formatPct } from '../sim'

export function StatsLedger({ view, onReset }: { view: View; onReset: () => void }) {
  return (
    <section className="panel stats-block" aria-label="Growth ledger">
      <div className="stamp stamp-vert">LOG/04</div>
      <h2 className="panel-head">Ledger</h2>
      <dl className="ledger">
        <div className="ledger-row">
          <dt>CALM TIME</dt>
          <dd>{formatCalm(view.calm)}</dd>
        </div>
        <div className="ledger-row">
          <dt>CYCLES</dt>
          <dd>{view.lifetimeCycles}</dd>
        </div>
        <div className="ledger-row">
          <dt>COVERAGE</dt>
          <dd>{formatPct(view.coverage)}</dd>
        </div>
        <div className="ledger-row">
          <dt>LUSHNESS</dt>
          <dd>{formatPct(view.lushness)}</dd>
        </div>
        <div className="ledger-row">
          <dt>BEST STILL</dt>
          <dd>{view.best}</dd>
        </div>
        <div className="ledger-row">
          <dt>PEAK</dt>
          <dd>{view.peak}</dd>
        </div>
      </dl>
      <button type="button" className="btn-raw btn-wipe focus-brutal" onClick={onReset}>
        {view.resetArmed ? 'WIPE ARMED' : 'WIPE WALL'}
      </button>
      {view.resetArmed && (
        <p className="wipe-hint" role="status">
          press R again to wipe the wall
        </p>
      )}
    </section>
  )
}