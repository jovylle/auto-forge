import { useEffect, useState } from 'react'
import type { Task } from '../lib/types'

const KEY = 'comet-queue:v1'

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Task[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string')
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks))
  } catch {
    // storage unavailable — fail silently
  }
}

export function useLocalTasks(): [Task[], (t: Task[]) => void] {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])
  return [tasks, setTasks]
}