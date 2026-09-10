import type { ReactNode } from 'react'

interface RailProps {
  children: ReactNode
}

export default function Rail({ children }: RailProps) {
  return (
    <aside className="rail">
      <div className="rail-wordmark" aria-hidden="true">
        <span className="rail-word">LANTERN</span>
        <span className="rail-word rail-word-accent">LEDGER</span>
      </div>
      <div className="rail-graphic" aria-hidden="true">
        <span className="rail-diamond" />
        <span className="rail-bar" />
      </div>
      <div className="rail-children">{children}</div>
    </aside>
  )
}