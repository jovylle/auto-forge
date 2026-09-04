import { useEffect, useRef, useState } from 'react'
import { OWN_FREQ, fmtFreq } from '../lib/stations'

const MAX_LEN = 160

type Props = {
  hasBroadcast: boolean
  onBroadcast: (message: string) => void
}

export default function Composer({ hasBroadcast, onBroadcast }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const toggle = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setOpen((o) => {
      const next = !o
      if (next) timerRef.current = window.setTimeout(() => textareaRef.current?.focus(), 260)
      return next
    })
  }

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onBroadcast(trimmed)
    setSent(true)
    setText('')
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setOpen(false)
      setSent(false)
    }, 1500)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3 border-2 border-ember bg-soot px-3 py-2.5" style={{ transform: 'rotate(-0.4deg)' }}>
        <span className="font-display text-sm tracking-[0.14em] text-ember uppercase">your channel</span>
        <span className="font-crt text-base text-bone">{fmtFreq(OWN_FREQ)} MHz</span>
        {hasBroadcast && <span className="you-stamp text-phosphor! border-phosphor!">on air</span>}
        <button
          type="button"
          className="broadcast-btn ml-auto"
          onClick={toggle}
          aria-expanded={open}
        >
          {open ? 'close' : 'broadcast'}
        </button>
      </div>

      {open && (
        <div className="slip mt-3 p-4">
          <div className="flex items-center gap-2">
            <span className="rec-dot" aria-hidden="true" />
            <span className="font-crt text-sm tracking-[0.2em] text-soot/70 uppercase">rec — message for a stranger</span>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            maxLength={MAX_LEN}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="say anything. it floats until someone tunes in…"
            className="mt-3 w-full resize-none border-2 border-dashed border-soot/40 bg-bone/40 p-3 font-hand text-base text-soot placeholder:text-soot/40 focus:border-soot focus:outline-none"
            aria-label="your broadcast message"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-crt text-xs tracking-[0.14em] text-soot/60">
              {text.length}/{MAX_LEN}
            </span>
            <button type="button" className="broadcast-btn" onClick={submit} disabled={!text.trim() || sent}>
              {sent ? 'sent ✓' : 'send it'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}