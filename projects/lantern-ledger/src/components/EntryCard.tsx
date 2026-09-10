import type { Entry } from '../journal'
import { fullLabel, nightNumber } from '../journal'

interface EntryCardProps {
  entry: Entry | null
  date: string
  isTonight: boolean
  entryDates: string[]
  lit: boolean
  onSnuff: () => void
}

export default function EntryCard({ entry, date, isTonight, entryDates, lit, onSnuff }: EntryCardProps) {
  const night = nightNumber(date, entryDates)
  return (
    <section className={`entry-card${lit ? ' is-lit' : ''}`} aria-label="Reading">
      {lit ? (
        <>
          <div className="entry-card-head">
            <span className="entry-night">
              NIGHT {night}
              {isTonight ? ' · TONIGHT' : ''}
            </span>
            <span className="entry-date">{fullLabel(date)}</span>
          </div>
          {entry && entry.text.trim().length > 0 ? (
            <p className="entry-text">{entry.text}</p>
          ) : (
            <p className="entry-text entry-empty">
              This night is still dark. Write it below, then light the lantern.
            </p>
          )}
          <button type="button" className="btn btn-ghost btn-snuff" onClick={onSnuff}>
            Snuff the light
          </button>
        </>
      ) : (
        <p className="entry-dark">The room is dark. Tap a lantern to light the night.</p>
      )}
    </section>
  )
}