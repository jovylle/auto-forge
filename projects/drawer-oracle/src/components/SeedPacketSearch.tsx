import { CATEGORIES } from '../lib/ledger'

interface Props {
  query: string
  onQuery: (q: string) => void
  cat: string
  onCat: (c: string) => void
  count: number
}

export default function SeedPacketSearch({ query, onQuery, cat, onCat, count }: Props) {
  const searching = query.trim().length > 0

  return (
    <section className="seedpacket" aria-label="Find my thing">
      <span className="packet-corner" aria-hidden="true" />
      <h2 className="packet-title">Find my thing</h2>
      <label className="sr-only" htmlFor="findInput">
        What are you hunting for?
      </label>
      <div className="packet-frame hand">
        <span className="pencil" aria-hidden="true">
          ✎
        </span>
        <input
          id="findInput"
          type="search"
          className="packet-input"
          placeholder="a lost button…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      <p className="packet-feedback" role="status" aria-live="polite">
        {searching
          ? count === 0
            ? 'no such thing in the drawer'
            : count === 1
              ? '1 thing found'
              : `${count} things found`
          : ''}
      </p>
      <div className="packet-tabs" role="group" aria-label="Filter by category">
        {['all', ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            className={`packet-tab hand${cat === c ? ' is-on' : ''}`}
            aria-pressed={cat === c}
            onClick={() => onCat(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </section>
  )
}