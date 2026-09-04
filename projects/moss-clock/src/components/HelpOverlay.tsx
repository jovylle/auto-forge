import { useEffect, useRef } from 'react'

interface Props {
  onClose: () => void
}

const ROWS: [string, string][] = [
  ['SPACE', 'start or pause the breathing session'],
  ['ESC', 'pause the session · close this panel'],
  ['← / →', 'jump to the previous / next breath phase'],
  ['? / H', 'toggle this help panel'],
  ['R', 'wipe the moss wall (press twice to confirm)'],
  ['TAB', 'move focus between controls'],
  ['ENTER', 'activate the focused button'],
]

export function HelpOverlay({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      returnFocusRef.current?.focus()
    }
  }, [])

  return (
    <div className="help-overlay">
      <section ref={panelRef} className="panel help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="stamp stamp-vert">FIELD MANUAL</div>
        <h2 id="help-title" className="help-title">
          MOSS CLOCK
        </h2>
        <p className="serif-tag help-lede">it grows when you are calm. breathe slow. stay still.</p>
        <ul className="help-rows">
          {ROWS.map(([key, label]) => (
            <li className="help-row" key={key}>
              <kbd className="keycap keycap-lg">{key}</kbd>
              <span className="keycap-label">{label}</span>
            </li>
          ))}
        </ul>
        <div className="help-rules">
          <p>
            <span className="rule-dot rule-calm" /> stillness rises while you breathe and when you rest your hands.
          </p>
          <p>
            <span className="rule-dot rule-agitate" /> fast key taps, hard pointer flicks and tab-hopping break it.
          </p>
          <p>
            <span className="rule-dot rule-moss" /> moss spreads only from its own edge, like real moss. nothing grows
            while you are away.
          </p>
        </div>
        <button ref={closeRef} type="button" className="btn-raw focus-brutal" onClick={onClose}>
          CLOSE
        </button>
      </section>
    </div>
  )
}