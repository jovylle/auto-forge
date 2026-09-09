import type { SortMode } from '../lib/types'
import { sfx } from '../lib/audio'

interface Props {
  mode: SortMode
  onChange: (m: SortMode) => void
}

const MODES: { value: SortMode; label: string }[] = [
  { value: 'urgency', label: 'Urgency' },
  { value: 'chrono', label: 'Chrono' },
  { value: 'mass', label: 'Mass' },
]

export default function GravitySortControl({ mode, onChange }: Props) {
  return (
    <div className="flex" role="group" aria-label="Sort mode" style={{ border: '2px solid var(--concrete)', display: 'flex' }}>
      {MODES.map((m) => (
        <button
          key={m.value}
          className="seg"
          aria-pressed={mode === m.value}
          onClick={() => { if (mode !== m.value) { onChange(m.value); sfx.sort() } }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}