import { useCallback, useEffect, useRef, useState } from 'react'
import LedgerDesk from './components/LedgerDesk'
import OracleReading from './components/OracleReading'
import { CATEGORIES, decodeShare, type Receipt } from './lib/oracle'

const STORE_KEY = 'receipt-oracle:receipts:v1'

function isReceipt(r: unknown): r is Receipt {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return (
    typeof o.name === 'string' &&
    typeof o.amount === 'number' &&
    Number.isFinite(o.amount) &&
    o.amount > 0 &&
    typeof o.category === 'string' &&
    CATEGORIES.some((c) => c.key === o.category) &&
    typeof o.date === 'string'
  )
}

function loadReceipts(): Receipt[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(isReceipt) : []
  } catch {
    return []
  }
}

export default function App() {
  const [receipts, setReceipts] = useState<Receipt[]>(() => loadReceipts())
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const initedShare = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(receipts))
    } catch {
      /* storage full or unavailable */
    }
  }, [receipts])

  // import from share-link once on load
  useEffect(() => {
    if (initedShare.current) return
    initedShare.current = true
    try {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('o')
      if (token) {
        const imported = decodeShare(token)
        if (imported.length > 0) {
          const replace = receipts.length === 0 || window.confirm('Replace your current ledger with the shared augury?')
          if (replace) {
            setReceipts(imported)
            setNotice(`Imported ${imported.length} receipts from the shared augury. Scroll to read it.`)
          }
          const url = new URL(window.location.href)
          url.search = ''
          window.history.replaceState({}, '', url.toString())
        }
      }
    } catch {
      /* ignore malformed link */
    }
  }, [])

  const addReceipt = useCallback((r: Receipt) => {
    setReceipts((prev) => [...prev, r])
  }, [])

  const clearReceipts = useCallback(() => {
    setReceipts([])
  }, [])

  // scroll reactivity: window/document scroll drives the oracle reading progress
  useEffect(() => {
    let raf = 0
    const compute = () => {
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      setProgress(total <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / total)))
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="app-shell">
      <div className="gear-dust" aria-hidden />
      <header className="relative z-10 border-b border-[var(--brass-deep)]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-4">
          <div className="oracle-eye shrink-0" style={{ width: 56, height: 56 }}>
            <div className="ring" />
            <div className="iris" />
            <div className="pupil" />
          </div>
          <div>
            <h1 className="display brass-engrave text-2xl sm:text-3xl m-0">Receipt Oracle</h1>
            <p className="mono text-xs m-0 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>expense fortune teller · vol. {receipts.length}</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <div className="gear gear-spin" style={{ width: 34, height: 34 }} aria-hidden />
          </div>
        </div>
      </header>

      {notice && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-3">
          <div className="parch px-4 py-2 text-sm flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss notice" className="brass-btn ghost text-xs px-2 py-0.5">✕</button>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[42fr_58fr] gap-6 px-4 py-6">
        <LedgerDesk receipts={receipts} onAdd={addReceipt} onClear={clearReceipts} />
        <OracleReading receipts={receipts} progress={progress} />
      </main>

      <footer className="relative z-10 border-t border-[var(--brass-deep)] mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 mono text-xs" style={{ color: 'var(--muted)' }}>
          <span>Receipt Oracle — read the ledger, mind your brass.</span>
          <span>Ink · Scroll · Foretell</span>
        </div>
      </footer>
    </div>
  )
}
