import { tierFor } from '../lib/ledger'

interface Props {
  kept: number
  released: number
  score: number
  found: boolean
  onEmpty: () => void
}

export default function PreservesJar({ kept, released, score, found, onEmpty }: Props) {
  const tier = tierFor(score)
  const pct = Math.round(score * 100)

  return (
    <section className={`jar-card${found ? ' jar-found' : ''}`} aria-label="Declutter score">
      <h2 className="jar-title">Declutter score</h2>
      <div className="jar-stage">
        <div className="jar-box">
          <svg className="jar-svg" viewBox="0 0 140 190" aria-hidden="true">
            <defs>
              <clipPath id="jarInner">
                <path d="M30 88 c0 46 8 80 40 80 s40 -34 40 -80 z" />
              </clipPath>
              <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="color-mix(in srgb, var(--color-rye) 72%, white)" />
                <stop offset="1" stopColor="color-mix(in srgb, var(--color-rye) 88%, black)" />
              </linearGradient>
            </defs>
            <path d="M36 26 h68 M40 20 h60" stroke="var(--color-ink)" strokeWidth="5" strokeLinecap="round" />
            <path
              d="M28 56 a6 6 0 0 1 6 -6 h72 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-72 a6 6 0 0 1 -6 -6 z"
              fill="var(--color-linen)"
              stroke="var(--color-ink)"
              strokeWidth="3"
            />
            <path
              d="M30 88 c0 46 8 80 40 80 s40 -34 40 -80 z"
              fill="rgba(63,82,51,.06)"
              stroke="var(--color-ink)"
              strokeWidth="3"
            />
            <g clipPath="url(#jarInner)">
              <g
                className="jar-fill-g"
                style={{
                  transform: `scaleY(${score})`,
                  transformOrigin: '50% 88.4%',
                  transformBox: 'view-box',
                }}
              >
                <rect x="26" y="84" width="88" height="86" fill="url(#liquidGrad)" />
              </g>
            </g>
            <path d="M34 88 h72" stroke="var(--color-ink)" strokeWidth="2" opacity=".3" />
            <path
              d="M44 112 q4 -3 8 0 M44 134 q4 -3 8 0 M44 156 q4 -3 8 0"
              stroke="var(--color-ink)"
              strokeWidth="2"
              fill="none"
              opacity=".28"
              strokeLinecap="round"
            />
          </svg>
          <span className="jar-pct">{pct}%</span>
        </div>
        <p className="jar-tier hand">{tier.label}</p>
        <p className="jar-note">{tier.note}</p>
        <div className="jar-shelf" aria-hidden="true" />
      </div>
      <p className="score-note">
        kept <strong>{kept}</strong> · released <strong>{released}</strong>
      </p>
      {kept > 0 && (
        <button type="button" className="btn hand" onClick={onEmpty}>
          empty the drawer
        </button>
      )}
    </section>
  )
}