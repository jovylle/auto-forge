export type Urgency = 'crit' | 'high' | 'mid' | 'low'

export interface Task {
  id: string
  title: string
  due: number
  createdAt: number
  done: boolean
  doneAt?: number
  /** mass / weight — how "heavy" this task is; nudges gravity sort */
  mass: number
  priority: number
}

export type SortMode = 'urgency' | 'chrono' | 'mass'

export const URGENCY_RANK: Record<Urgency, number> = { crit: 0, high: 1, mid: 2, low: 3 }

export const URGENCY_LABEL: Record<Urgency, string> = {
  crit: 'CRIT',
  high: 'HIGH',
  mid: 'MID',
  low: 'LOW',
}

export const RING_PERIOD: Record<Urgency, number> = {
  crit: 24,
  high: 48,
  mid: 96,
  low: 240,
}

/** Return the id of the ring a task rides on. */
export function ringFor(task: Task): Urgency {
  return taskUrgency(task)
}

/**
 * Gravity sort: urgency dominates, but due-soonness adds "pull" and
 * heavy tasks get lifted. Score from 0 (must act now) to 1 (cold).
 */
export function gravityScore(task: Task, now: number): number {
  const urgencyBias = URGENCY_RANK[taskUrgency(task)] / 3
  const windowMs = 3 * 24 * 3600 * 1000
  const late = now - task.due
  let dueBias = 0
  if (late > 0) dueBias = 0.9
  else if (task.due - now < windowMs / 12) dueBias = 0.4
  else if (task.due - now < windowMs / 3) dueBias = 0.2
  const massPull = Math.min(0.25, (task.mass - 1) * 0.05)
  return Math.max(0, Math.min(1, urgencyBias - dueBias - massPull))
}

export function urgencyForTask(task: Task, now: number): Urgency {
  const hoursRemaining = (task.due - now) / (3600 * 1000)
  if (hoursRemaining <= 0) return 'crit'
  if (hoursRemaining <= 12) return 'crit'
  if (hoursRemaining <= 48) return 'high'
  if (hoursRemaining <= 7 * 24) return 'mid'
  return 'low'
}

export function taskUrgency(task: Task): Urgency {
  return urgencyForTask(task, Date.now())
}

export function sortTasks(tasks: Task[], mode: SortMode, now: number): Task[] {
  const list = [...tasks]
  switch (mode) {
    case 'urgency':
      return list.sort((a, b) => {
        const s = gravityScore(a, now) - gravityScore(b, now)
        if (s !== 0) return s
        return a.due - b.due
      })
    case 'chrono':
      return list.sort((a, b) => a.due - b.due)
    case 'mass':
      return list.sort((a, b) => b.mass - a.mass)
  }
}

export function relTime(ts: number, now: number): string {
  const diff = ts - now
  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60000)
  if (m < 1) return 'now'
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const prefix = diff < 0 ? 'T-' : 'T+'
  if (d >= 1) return `${prefix}${d}d`
  if (h >= 1) return `${prefix}${h}h`
  return `${prefix}${m}m`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}