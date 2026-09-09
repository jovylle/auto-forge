import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Task, Urgency } from '../lib/types'
import { makeId } from '../lib/types'
import { sfx } from '../lib/audio'

interface Props {
  onLaunch: (task: Task) => void
}

const URGENCIES: { value: Urgency; label: string }[] = [
  { value: 'crit', label: 'CRIT' },
  { value: 'high', label: 'HIGH' },
  { value: 'mid', label: 'MID' },
  { value: 'low', label: 'LOW' },
]

export default function TaskForm({ onLaunch }: Props) {
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('mid')
  const [mass, setMass] = useState(1)
  const [dueOffset, setDueOffset] = useState(24)
  const [launched, setLaunched] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const hours = Number(dueOffset)
    const task: Task = {
      id: makeId(),
      title: trimmed,
      createdAt: Date.now(),
      due: Date.now() + Math.max(0.5, hours) * 3600 * 1000,
      done: false,
      mass,
      priority: { crit: 0, high: 1, mid: 2, low: 3 }[urgency],
    }
    sfx.add()
    onLaunch(task)
    setTitle('')
    setUrgency('mid')
    setMass(1)
    setDueOffset(24)
    setLaunched(true)
    window.setTimeout(() => setLaunched(false), 1400)
  }

  return (
    <form onSubmit={submit} style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>
      <label className="font-mono" htmlFor="cq-title" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dust)', display: 'block', marginBottom: 6 }}>
        Task call sign
      </label>
      <input
        id="cq-title"
        name="cq-title"
        className="field"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. file the launch report"
        maxLength={80}
        aria-label="Task title"
      />

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <span id="cq-urgency-label" className="font-mono block" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dust)', marginBottom: 6 }}>
            Urgency
          </span>
          <div id="cq-urgency" role="group" aria-labelledby="cq-urgency-label" className="flex" style={{ border: '3px solid var(--concrete)' }}>
            {URGENCIES.map((u) => (
              <button
                type="button"
                key={u.value}
                onClick={() => { setUrgency(u.value); sfx.select() }}
                className="seg"
                aria-pressed={urgency === u.value}
                style={{ background: urgency === u.value ? 'var(--bone)' : 'transparent', color: urgency === u.value ? 'var(--void)' : 'var(--dust)' }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="font-mono block" htmlFor="cq-window" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dust)', marginBottom: 6 }}>
            Window (hrs)
          </label>
          <input
            id="cq-window"
            name="cq-window"
            className="field"
            type="number"
            min={0.5}
            max={720}
            step="any"
            value={dueOffset}
            onChange={(e) => setDueOffset(Number(e.target.value))}
            aria-label="Due window in hours"
          />
        </div>

        <div>
          <label className="font-mono block" htmlFor="cq-mass" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dust)', marginBottom: 6 }}>
            Mass {mass}×
          </label>
          <input
            id="cq-mass"
            name="cq-mass"
            className="field"
            type="range"
            min={1}
            max={5}
            step={1}
            value={mass}
            onChange={(e) => { setMass(Number(e.target.value)); sfx.tick() }}
            aria-label="Task mass"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mt-5">
        <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
          Launch comet
        </button>
        {launched && (
          <span className="stamp" role="status" aria-live="polite">
            Launched
          </span>
        )}
      </div>
    </form>
  )
}