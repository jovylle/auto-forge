export default function Masthead() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="masthead">
      <p className="masthead-kicker">the kitchen wall ledger</p>
      <h1 className="masthead-title">
        Drawer <em>Oracle</em>
      </h1>
      <svg className="flourish" viewBox="0 0 220 24" aria-hidden="true">
        <path
          d="M4 14 C40 4 70 20 110 12 C150 4 180 16 216 10"
          fill="none"
          stroke="var(--color-madder)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M40 18 C80 10 130 18 190 13"
          fill="none"
          stroke="var(--color-moss)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".7"
        />
        <circle cx="110" cy="12" r="3" fill="var(--color-rye)" />
      </svg>
      <p className="masthead-sub">
        Photograph-free junk-drawer inventory.
        <br />
        Everything kept, honestly.
      </p>
      <p className="masthead-date">{today}</p>
    </header>
  )
}