const FLOATERS: Array<{ e: string; left: string; top: string; dur: number; delay: number }> = [
  { e: '🍩', left: '8%', top: '14%', dur: 8, delay: 0 },
  { e: '🧋', left: '72%', top: '10%', dur: 10, delay: 0.8 },
  { e: '🌮', left: '25%', top: '6%', dur: 9, delay: 1.4 },
  { e: '🍪', left: '86%', top: '22%', dur: 7, delay: 0.4 },
  { e: '🍕', left: '46%', top: '4%', dur: 11, delay: 2 },
]

export function Decor() {
  return (
    <>
      <div className="scanlines" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className="floating-snack"
          style={{
            left: f.left,
            top: f.top,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
          }}
          aria-hidden="true"
        >
          {f.e}
        </span>
      ))}
    </>
  )
}