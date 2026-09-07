export interface Snack {
  id: string
  emoji: string
  name: string
  price: number
}

export const CURRENCY = '$'

export const SNACKS: Snack[] = [
  { id: 'choc', emoji: '🍫', name: 'chocolate bars', price: 12 },
  { id: 'boba', emoji: '🧋', name: 'bobas', price: 18 },
  { id: 'donut', emoji: '🍩', name: 'donuts', price: 15 },
  { id: 'cream', emoji: '🍦', name: 'soft serves', price: 10 },
  { id: 'cookie', emoji: '🍪', name: 'cookies', price: 8 },
]

export const DEFAULT_SNACK_ID = 'donut'

export function getSnack(id: string): Snack {
  return SNACKS.find((s) => s.id === id) ?? SNACKS[0]!
}

export const DAILY_BUDGET = 20
export const WEEKLY_BUDGET = DAILY_BUDGET * 7

export function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  const str =
    abs % 1 === 0
      ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '-' : '') + str
}

export function snackCount(amount: number, price: number): number {
  return amount / price
}

export function wholeSnacks(amount: number, price: number): number {
  return Math.floor(amount / price)
}

export function leftover(amount: number, price: number): number {
  return amount - wholeSnacks(amount, price) * price
}