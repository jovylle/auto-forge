import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Task, SortMode } from './lib/types'
import { sortTasks } from './lib/types'
import { useLocalTasks } from './lib/useTasks'
import { ensureAudio, setSoundEnabled, sfx } from './lib/audio'
import Masthead from './components/Masthead'
import SectionDivider from './components/SectionDivider'
import TaskForm from './components/TaskForm'
import GravitySortControl from './components/GravitySortControl'
import TaskLedger from './components/TaskLedger'
import OrbitStage from './components/OrbitStage'
import AlertTicker from './components/AlertTicker'
import Inspector from './components/Inspector'

interface TickerEvent {
  text: string
  kind: 'hot' | 'alarm' | 'info'
  key: number | string
}

let tickerSeq = 0

export default function App() {
  const [tasks, setTasks] = useLocalTasks()
  const [now, setNow] = useState(() => Date.now())
  const [mode, setMode] = useState<SortMode>('urgency')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<TickerEvent | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [clock, setClock] = useState('--:--')

  const prevOverdue = useRef<number | null>(null)

  // ticking clock + re-evaluate urgency every 20s
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now())
    }, 20000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const t = window.setInterval(() => setClock(fmt.format(new Date())), 1000)
    return () => window.clearInterval(t)
  }, [])

  // impact alert detection: tasks newly overdue → alarm event + sound
  useEffect(() => {
    const overdue = tasks.filter((t) => !t.done && now > t.due).length
    if (prevOverdue.current !== null && overdue > prevOverdue.current) {
      setLastEvent({ text: 'IMPACT — TASK ENTERS CRITICAL WINDOW', kind: 'alarm', key: ++tickerSeq })
      ensureAudio()
      sfx.alarm()
    }
    prevOverdue.current = overdue
  }, [tasks, now])

  const selected = useMemo(() => tasks.find((t) => t.id === selectedId) ?? null, [tasks, selectedId])

  const sorted = useMemo(() => sortTasks(tasks, mode, now), [tasks, mode, now])

  const addTask = useCallback(
    (task: Task) => {
      setTasks([...tasks, task])
      setEnteringId(task.id)
      setLastEvent({ text: `LAUNCHED — ${task.title.toUpperCase()} ENTERS ORBIT`, kind: 'hot', key: ++tickerSeq })
      window.setTimeout(() => setEnteringId(null), 800)
    },
    [tasks, setTasks],
  )

  const completeTask = useCallback(
    (id: string) => {
      setTasks(tasks.map((t) => (t.id === id ? { ...t, done: true, doneAt: Date.now() } : t)))
      setCapturingId(id)
      setLastEvent({ text: 'REENTRY — TASK CAPTURED', kind: 'info', key: ++tickerSeq })
      window.setTimeout(() => setCapturingId(null), 600)
    },
    [tasks, setTasks],
  )

  const deleteTask = useCallback(
    (id: string) => {
      setTasks(tasks.filter((t) => t.id !== id))
      if (selectedId === id) setSelectedId(null)
      setLastEvent({ text: 'ABORT — COMET VAPORIZED', kind: 'info', key: ++tickerSeq })
    },
    [tasks, setTasks, selectedId],
  )

  const selectTask = useCallback((id: string) => {
    setSelectedId(id)
    ensureAudio()
    sfx.select()
  }, [])

  const toggleSound = useCallback(() => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
    if (next) {
      ensureAudio()
      sfx.select()
    }
  }, [soundOn])

  const overdue = tasks.filter((t) => !t.done && now > t.due).length

  return (
    <div className="flex flex-col" style={{ height: '100%', position: 'relative' }}>
      <Masthead time={clock} taskCount={tasks.filter((t) => !t.done).length} overdue={overdue} />

      <main className="flex-1 grid" style={{ gridTemplateColumns: 'minmax(320px, 400px) 1fr', minHeight: 0 }}>
        {/* LEDGER RAIL */}
        <section className="crosshatch" style={{ borderRight: '3px solid var(--concrete)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="p-4 pb-0">
            <GravitySortControl mode={mode} onChange={setMode} />
          </div>
          <SectionDivider label="Sec.01 / Launchpad" />
          <TaskForm onLaunch={addTask} />
          <SectionDivider label="Sec.02 / Registry" />
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <TaskLedger tasks={sorted} now={now} selectedId={selectedId} onSelect={selectTask} onComplete={completeTask} />
          </div>
        </section>

        {/* ORBIT STAGE */}
        <section style={{ position: 'relative', minHeight: 0, minWidth: 0 }}>
          <OrbitStage
            tasks={sorted}
            now={now}
            selectedId={selectedId}
            enteringId={enteringId}
            capturingId={capturingId}
            onSelect={selectTask}
          />
          {selected && (
            <Inspector
              task={selected}
              now={now}
              onClose={() => setSelectedId(null)}
              onComplete={completeTask}
              onDelete={deleteTask}
            />
          )}
        </section>
      </main>

      <AlertTicker tasks={tasks} now={now} lastEvent={lastEvent} soundOn={soundOn} onToggleSound={toggleSound} />
    </div>
  )
}