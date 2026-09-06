export default function EmptyBasket() {
  return (
    <div className="basket">
      <svg className="basket-svg" viewBox="0 0 160 120" aria-hidden="true">
        <path
          d="M30 40 h100 l-8 56 a10 10 0 0 1 -10 8 h-64 a10 10 0 0 1 -10 -8 z"
          fill="rgba(63,82,51,.08)"
          stroke="var(--color-moss)"
          strokeWidth="3"
        />
        <path d="M30 40 q50 -14 100 0" fill="none" stroke="var(--color-moss)" strokeWidth="3" />
        <g stroke="var(--color-moss)" strokeWidth="2" opacity=".5">
          <path d="M42 48 l-4 54" />
          <path d="M58 46 l-4 56" />
          <path d="M74 44 l-4 58" />
          <path d="M90 44 l-4 58" />
          <path d="M106 46 l-4 56" />
          <path d="M122 48 l-4 54" />
        </g>
        <g stroke="var(--color-rye)" strokeWidth="2" opacity=".55">
          <path d="M34 58 q46 10 92 0" />
          <path d="M32 76 q48 12 96 0" />
          <path d="M32 92 q48 12 96 0" />
        </g>
      </svg>
      <p className="basket-note">the drawer is empty — nothing but breadcrumbs.</p>
      <p className="basket-hint">log a thing below to begin.</p>
    </div>
  )
}