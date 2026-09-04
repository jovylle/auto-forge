export interface View {
  hh: string
  mm: string
  ss: string
  date: string
  phaseId: 'inhale' | 'hold' | 'exhale'
  phaseRemaining: number
  phaseProgress: number
  running: boolean
  started: boolean
  sessionCycles: number
  score: number
  peak: number
  best: number
  coverage: number
  lushness: number
  calm: number
  lifetimeCycles: number
  disturbed: boolean
  resetArmed: boolean
}