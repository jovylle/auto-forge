import { useEffect, useRef, useState } from 'react'

const GARBLE = ['▓', '▒', '░', '#', '%', '&', '@', 'Ø', '†']

export function useDecode(text: string, nonce: number): { shown: string; done: boolean } {
  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (nonce <= 0) {
      setShown('')
      setDone(true)
      return
    }
    setShown('')
    setDone(false)
    const chars = text.split('')
    let i = 0
    let interval = 0
    const step = () => {
      i += 1
      let out = chars.slice(0, i).join('')
      if (Math.random() < 0.3 && i < chars.length && out.length > 0) {
        const g = out.split('')
        const idx = Math.floor(Math.random() * g.length)
        g[idx] = GARBLE[Math.floor(Math.random() * GARBLE.length)] as string
        out = g.join('')
      }
      setShown(out)
      if (i >= chars.length) {
        window.clearInterval(interval)
        setShown(text)
        setDone(true)
      }
    }
    step()
    interval = window.setInterval(step, 55)
    return () => window.clearInterval(interval)
  }, [text, nonce])

  return { shown, done }
}

type Props = {
  text: string
  nonce: number
  locked: boolean
  lockLabel: string
}

export default function Decode({ text, nonce, locked, lockLabel }: Props) {
  const { shown, done } = useDecode(text, nonce)
  const idle = !locked
  const prevLocked = useRef(locked)

  useEffect(() => {
    if (locked && !prevLocked.current) {
      try {
        navigator.vibrate?.(40)
      } catch {
        /* ignore */
      }
    }
    prevLocked.current = locked
  }, [locked])

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center p-[6%]">
      {idle ? (
        <div className="crt-idle font-crt text-sm tracking-[0.18em] text-ether uppercase">
          · · · drifting the dial · · ·
        </div>
      ) : null}
      {locked && (
        <div className="crt-decode-inner">
          <span>
            {shown}
            {!done && <span className="cursor" />}
          </span>
        </div>
      )}
      {locked && done && (
        <div className="absolute right-[7%] bottom-[6%] font-crt text-sm tracking-[0.18em] text-phosphor/70 uppercase">
          {lockLabel}
        </div>
      )}
    </div>
  )
}