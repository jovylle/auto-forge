import type { Signal } from '../lib/stations'
import { fmtFreq } from '../lib/stations'

type Props = {
  signals: Signal[]
  newestId: string | null
}

const BAR_HEIGHTS = [5, 9, 13, 9, 5]

export default function SignalBoard({ signals, newestId }: Props) {
  const recent = signals.slice(0, 14)

  return (
    <section className="board-sheet board-torn scratch wobble-b" aria-label="signal board">
      <div className="mb-1 flex items-center justify-between border-b border-soot/30 pb-2">
        <h2 className="font-display text-sm tracking-[0.2em] text-soot/80 uppercase">signal board</h2>
        <span className="font-crt text-xs tracking-[0.16em] text-soot/60">receipts {signals.length}</span>
      </div>

      {recent.length === 0 ? (
        <div className="py-4 font-hand text-sm text-soot/70 italic">no signals yet — the ether is listening.</div>
      ) : (
        <ul className="divide-y divide-soot/20">
          {recent.map((s, i) => (
            <li
              key={s.id}
              className={`board-row ${s.id === newestId ? 'board-enter' : ''}`}
              aria-label={`signal ${s.callsign} on ${fmtFreq(s.freq)} megahertz`}
            >
              <div className="font-crt text-sm text-soot/80 leading-none">
                {fmtFreq(s.freq)}
                <div className="mt-1 text-[10px] tracking-[0.12em] text-soot/50">{s.callsign}</div>
              </div>
              <div className="min-w-0">
                <p className="truncate text-soot/85">{s.message}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="bars" aria-hidden="true">
                    {BAR_HEIGHTS.map((h, j) => (
                      <i key={j} style={{ height: h }} className={j < s.strength ? (i === 0 ? 'lit' : 'filled') : ''} />
                    ))}
                  </span>
                  <span className="font-crt text-[10px] tracking-[0.14em] text-soot/50 uppercase">
                    {s.strength * 20}%
                  </span>
                </div>
              </div>
              <div>{s.source === 'yours' ? <span className="you-stamp">you</span> : null}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}