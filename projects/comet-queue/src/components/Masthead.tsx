interface Props {
  time: string
  taskCount: number
  overdue: number
}

export default function Masthead({ time, taskCount, overdue }: Props) {
  return (
    <header className="flex items-end justify-between gap-4 px-6 pb-0 pt-6" style={{ borderBottom: '4px solid var(--concrete)', position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <h1
          className="font-display uppercase leading-none tracking-[-0.02em]"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4.2rem)', fontWeight: 800, margin: 0, color: 'var(--bone)' }}
        >
          Comet<span style={{ color: 'var(--comet)' }}>Queue</span>
        </h1>
        <p className="font-mono" style={{ margin: '6px 0 0', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--dust)' }}>
          tasks orbiting the urgent
        </p>
      </div>
      <div className="text-right font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dust)', paddingBottom: 14, flex: 'none' }}>
        <div style={{ color: 'var(--bone)' }}>STATION TIME · {time}</div>
        <div>TASKS · {taskCount}</div>
        <div style={{ color: overdue > 0 ? 'var(--flare)' : 'var(--dust)' }}>OVERDUE · {overdue}</div>
      </div>
    </header>
  )
}