interface ComposerProps {
  draft: string
  onChange: (text: string) => void
  onLight: () => void
  isEditing: boolean
}

export default function Composer({ draft, onChange, onLight, isEditing }: ComposerProps) {
  return (
    <section className="composer" aria-label="Write tonight">
      <label className="composer-title" htmlFor="composer-input">
        {isEditing ? 'Rekindle tonight' : 'Tonight'}
      </label>
      <textarea
        id="composer-input"
        className="composer-input"
        placeholder="A few lines before the light goes out…"
        value={draft}
        maxLength={2000}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-amber btn-light"
        onClick={onLight}
        disabled={draft.trim().length === 0}
      >
        {isEditing ? 'Relight tonight' : 'Light tonight’s lantern'}
      </button>
    </section>
  )
}