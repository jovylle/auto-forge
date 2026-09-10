import { useMemo, useState } from 'react'
import type { Entry } from './journal'
import {
  calcStreak,
  fullLabel,
  lastNDays,
  loadEntries,
  nightNumber,
  saveEntries,
  shortLabel,
  todayISO,
} from './journal'
import Rail from './components/Rail'
import Flame from './components/Flame'
import EntryCard from './components/EntryCard'
import Composer from './components/Composer'
import LanternRow from './components/LanternRow'

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries())
  const [selected, setSelected] = useState<string | null>(() => {
    const dates = loadEntries().map((e) => e.date).sort()
    return dates.length > 0 ? dates[dates.length - 1] : null
  })
  const [draft, setDraft] = useState<string>(
    () => loadEntries().find((e) => e.date === todayISO())?.text ?? '',
  )
  const [flareTick, setFlareTick] = useState(0)
  const [meterOpen, setMeterOpen] = useState(false)

  const tonight = todayISO()
  const entryDates = useMemo(
    () => Array.from(new Set(entries.map((e) => e.date))).sort(),
    [entries],
  )
  const streak = useMemo(() => calcStreak(entryDates), [entryDates])
  const days = useMemo(() => lastNDays(7), [])
  const tonightEntry = entries.find((e) => e.date === tonight) ?? null
  const selectedEntry = entries.find((e) => e.date === selected) ?? null

  const handleLight = (date: string) => {
    setSelected((prev) => (prev === date ? null : date))
  }

  const handleSave = () => {
    const text = draft.trim()
    if (text.length === 0) return
    const now = Date.now()
    const has = entries.some((e) => e.date === tonight)
    const next = has
      ? entries.map((e) => (e.date === tonight ? { ...e, text, createdAt: now } : e))
      : [...entries, { date: tonight, text, createdAt: now }]
    try {
      saveEntries(next)
    } catch {
      // storage unavailable — keep the night lit in memory
    }
    setEntries(next)
    setSelected(tonight)
    setDraft(text)
    setFlareTick((t) => t + 1)
  }

  return (
    <div className="app">
      <div className={`ambient${selected !== null ? ' is-lit' : ''}`} aria-hidden="true" />
      <Rail>
        <Flame
          streak={streak}
          flareTick={flareTick}
          expanded={meterOpen}
          onToggle={() => setMeterOpen((o) => !o)}
        />
        {meterOpen && (
          <div className="meter">
            <span className="meter-title">LAST 7 NIGHTS</span>
            <div className="meter-days">
              {days.map((d) => (
                <span
                  key={d}
                  className={`meter-day${entryDates.includes(d) ? ' is-on' : ''}${
                    d === tonight ? ' is-today' : ''
                  }`}
                  role="img"
                  aria-label={`${shortLabel(d)} — ${entryDates.includes(d) ? 'journaled' : 'dark'}${
                    d === tonight ? ', tonight' : ''
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </Rail>
      <main className="stage">
        <div className="date-bar">
          <span className="date-bar-night">NIGHT {nightNumber(tonight, entryDates)}</span>
          <span className="date-bar-date">{fullLabel(tonight)}</span>
        </div>
        <EntryCard
          entry={selectedEntry}
          date={selected ?? tonight}
          isTonight={selected === tonight}
          entryDates={entryDates}
          lit={selected !== null}
          onSnuff={() => setSelected(null)}
        />
        <Composer
          draft={draft}
          onChange={setDraft}
          onLight={handleSave}
          isEditing={tonightEntry !== null}
        />
        <LanternRow
          dates={entryDates}
          selected={selected}
          tonight={tonight}
          onLight={handleLight}
        />
      </main>
    </div>
  )
}