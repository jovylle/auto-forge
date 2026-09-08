import { useMemo, useRef, useState } from 'react'
import { computeReading, ELEMENT_EMBLEM, encodeShare, type Receipt } from '../lib/oracle'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function Dial({ label, value, accent }: { label: string; value: number; accent: string }) {
  const rot = -90 + (value / 100) * 180
  const ticks = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i <= 10; i++) arr.push((i / 10) * 180 - 90)
    return arr
  }, [])
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="dial" role="img" aria-label={`${label}: ${value} of 100`}>
        <div className="face" />
        {ticks.map((t, i) => (
          <span key={i} className="tick" style={{ transform: `translate(-50%,-50%) rotate(${t}deg) translateY(-58px)` }} />
        ))}
        <div className="needle" style={{ '--rot': `${rot}deg`, background: `linear-gradient(180deg, ${accent}, ${accent})`, opacity: 0.95 } as React.CSSProperties} />
      </div>
      <span className="mono text-xs uppercase tracking-widest text-[var(--muted)]">{label}</span>
    </div>
  )
}

function Reveal({ progress, start, end, children }: { progress: number; start: number; end: number; children: React.ReactNode }) {
  const on = progress >= start
  return <div className={`ink-reveal ${on ? 'on' : ''}`} style={{ transitionDelay: on ? `${(end - progress) * 0.3}s` : '0s' }}>{children}</div>
}

export default function OracleReading({ receipts, progress }: { receipts: Receipt[]; progress: number }) {
  const reading = useMemo(() => computeReading(receipts), [receipts])
  const [copied, setCopied] = useState(false)
  const posterRef = useRef<HTMLDivElement>(null)

  const shareToken = useMemo(() => encodeShare(receipts), [receipts])

  const shareURL = typeof window !== 'undefined' && shareToken ? `${window.location.origin}${window.location.pathname}?o=${encodeURIComponent(shareToken)}` : ''

  const onCopy = async () => {
    const text = shareURL || shareToken
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      ta.remove()
    }
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 1400)
  }

  const onExport = () => {
    const node = posterRef.current
    if (!node) return
    const html = node.outerHTML
    let css = ''
    try {
      const parts: string[] = []
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          parts.push(Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'))
        } catch {
          /* cross-origin sheet — skip */
        }
      }
      css = `<style>${parts.join('\n')}</style>`
    } catch {
      css = ''
    }
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt Oracle — reading</title>${css}</head><body style="background:#241811;padding:24px;display:flex;justify-content:center">${html}</body></html>`
    const blob = new Blob([doc], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'receipt-oracle-reading.html'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const hasData = reading.count > 0
  const topShare = reading.byCategory[0]?.share ?? 0

  const poster = (
    <div ref={posterRef} className="export-poster parch" style={{ fontFamily: 'Georgia, serif' }}>
      <div className="display brass-engrave text-2xl mb-1" style={{ backgroundClip: 'text' }}>Receipt Oracle</div>
      <div className="mono text-xs mb-3" style={{ color: '#6b4e17' }}>the augury of the ledger · {reading.count} receipts · {fmt.format(reading.total)}</div>
      {reading.dominant ? (
        <p style={{ margin: '0 0 0.5rem' }}>
          Your dominant element is <strong>{reading.dominant.element}</strong> ({reading.dominant.label}, {Math.round(topShare * 100)}%).
        </p>
      ) : (
        <p style={{ margin: 0 }}>The page is blank.</p>
      )}
      {reading.byCategory.map((c) => (
        <div key={c.category} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 3 }}>
          <span style={{ width: 70 }}>{c.label}</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(90,63,18,0.2)' }}>
            <div style={{ width: `${c.share * 100}%`, height: 8, background: '#a97e22' }} />
          </div>
          <span className="mono">{fmt.format(c.amount)}</span>
        </div>
      ))}
      {reading.omens.length > 0 && <p style={{ marginTop: '0.75rem', fontSize: 13, fontStyle: 'italic' }}>{reading.omens[0]}</p>}
    </div>
  )

  return (
    <div className="scroll-stage">
      <div className="scroll-pin flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center gap-5 px-4 w-full max-w-3xl mx-auto">
          <Reveal progress={progress} start={0.02} end={0.12}>
            <div className="oracle-eye" style={{ marginBottom: 8 }}>
              <div className="ring" />
              <div className="iris" />
              <div className="pupil" style={{ transform: `scale(${1 + Math.min(0.3, progress * 0.4)})` }} />
              <div className="lid top" />
              <div className="lid bot" />
            </div>
          </Reveal>

          <Reveal progress={progress} start={0.1} end={0.24}>
            <h2 className="display brass-engrave text-3xl sm:text-5xl text-center m-0">{reading.opener}</h2>
          </Reveal>

          <div className="w-full max-w-md">
            {reading.dominant && (
              <Reveal progress={progress} start={0.24} end={0.4}>
                <p className="text-center text-lg m-0" style={{ color: 'var(--parch)' }}>
                  {ELEMENT_EMBLEM[reading.dominant.element]} Your dominant element is{' '}
                  <strong style={{ color: 'var(--brass-bright)' }}>{reading.dominant.element}</strong> — {reading.dominant.label} commands {Math.round(topShare * 100)}% of your brass.
                </p>
              </Reveal>
            )}
            {reading.byCategory.slice(0, 5).map((c, i) => (
              <Reveal key={c.category} progress={progress} start={0.3 + i * 0.05} end={0.44 + i * 0.05}>
                <div className="flex items-center gap-2 py-1">
                  <span className="mono text-xs" style={{ width: 90, color: 'var(--muted)' }}>{c.label}</span>
                  <div className="flex-1 h-2 rounded-sm" style={{ background: 'rgba(21,14,7,0.5)', overflow: 'hidden' }}>
                    <div className="h-full" style={{ width: `${c.share * 100}%`, background: 'linear-gradient(90deg,#6b4e17,#a97e22,#f0d27a)' }} />
                  </div>
                  <span className="mono text-xs" style={{ color: 'var(--brass-bright)' }}>{fmt.format(c.amount)}</span>
                </div>
              </Reveal>
            ))}
          </div>

          {reading.omens.map((o, i) => (
            <Reveal key={i} progress={progress} start={0.55 + i * 0.07} end={0.66 + i * 0.07}>
              <p className="text-center italic m-0 max-w-lg" style={{ color: i === 0 && hasData ? 'var(--ember)' : 'var(--parch)' }}>“{o}”</p>
            </Reveal>
          ))}

          <Reveal progress={progress} start={0.8} end={0.9}>
            <div className="flex flex-wrap justify-center gap-6 items-center">
              <Dial label="Peril" value={reading.dangerScore} accent="#d9541e" />
              <Dial label="Heat" value={reading.heatScore} accent="#b87333" />
              <Dial label="Diligence" value={reading.diligence} accent="#f0d27a" />
            </div>
          </Reveal>

          <Reveal progress={progress} start={0.92} end={1}>
            <div className="flex flex-col items-center gap-4 pt-2">
              <p className="text-center m-0 max-w-lg italic" style={{ color: 'var(--muted)' }}>{reading.closer}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={onCopy} className="brass-btn">Copy Share-Link</button>
                <button onClick={onExport} className="brass-btn ghost">Export Poster</button>
              </div>
              {copied && <span className="mono text-xs" style={{ color: 'var(--brass-bright)' }}>Share-link copied to clipboard</span>}
              {hasData && <span className="mono text-xs" style={{ color: 'var(--muted)' }}>avg {fmt.format(reading.average)} · total {fmt.format(reading.total)}</span>}
            </div>
          </Reveal>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', visibility: 'hidden', height: 0 }} aria-hidden>
        {poster}
      </div>
    </div>
  )
}
