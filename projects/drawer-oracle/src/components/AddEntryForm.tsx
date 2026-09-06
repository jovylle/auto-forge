import { useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORIES } from '../lib/ledger'

interface Props {
  onAdd: (name: string, note: string, category: string) => void
}

export default function AddEntryForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[1])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, note, category)
    setName('')
    setNote('')
  }

  return (
    <form className="add-strip" onSubmit={submit}>
      <span className="tape tape-b" aria-hidden="true" />
      <p className="add-label">log a thing</p>
      <div className="add-row">
        <label className="sr-only" htmlFor="addName">
          Thing
        </label>
        <input
          id="addName"
          className="add-input hand"
          placeholder="what is it?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
        />
        <label className="sr-only" htmlFor="addNote">
          Note
        </label>
        <input
          id="addNote"
          className="add-input add-note hand"
          placeholder="a note (where it hides)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
        />
        <label className="sr-only" htmlFor="addCat">
          Category
        </label>
        <select
          id="addCat"
          className="add-select hand"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-log hand">
          log it
        </button>
      </div>
    </form>
  )
}