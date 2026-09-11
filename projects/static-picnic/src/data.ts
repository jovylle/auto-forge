export interface Dish {
  id: string
  name: string
  host: string
  freq: number
  tagline: string
  flavor: string
  vibe: string[]
  signal: number // 0-5 bars
  stripe: 'pink' | 'yellow' | 'green'
}

// Frequencies in MHz (87.5–108.0 band) + the hidden 66.6 void
export const STATIONS: Dish[] = [
  { id: 'gumbo', name: 'Slow Simmer Gumbo', host: 'Aunt Ro', freq: 88.3, tagline: 'Ladled over a 40-year-old pot.', flavor: 'Gumbo, gumbo, gumbo.', vibe: ['low & slow', 'everyone gets a second bowl'], signal: 4, stripe: 'pink' },
  { id: 'zap', name: 'Pocket Zaps', host: 'Kid Static', freq: 90.5, tagline: 'Homemade potato-zap chips, extra crackle.', flavor: 'BZZT meets salt.', vibe: ['snappy', 'short broadcast'], signal: 5, stripe: 'yellow' },
  { id: 'jello', name: 'Jello Jamboree', host: 'The Shimmy', freq: 93.1, tagline: 'A wobbly tower of 90s lime.', flavor: 'Boop, wibble, plop.', vibe: ['wobble set', 'never sets'], signal: 3, stripe: 'green' },
  { id: 'moon', name: 'Moon Pies, Static', host: 'Buzz', freq: 96.7, tagline: 'Graham cracker confetti from a passing van.', flavor: 'Night snack, low static.', vibe: ['lunar', 'marshmallow core'], signal: 4, stripe: 'pink' },
  { id: 'confetti', name: 'Confetti Corn', host: 'Dottie', freq: 99.9, tagline: 'One kernel for every color in the radio.', flavor: 'Kersplode of sweetness.', vibe: ['party band', 'pops on arrival'], signal: 5, stripe: 'yellow' },
  { id: 'glow', name: 'Glowstick Slaw', host: 'Neon Nell', freq: 101.5, tagline: 'Cabbage that hums in the dark.', flavor: 'Crunch, then phosphor.', vibe: ['rave greens', 'slightly electric'], signal: 3, stripe: 'green' },
  { id: 'butter', name: 'Butter Broadcast', host: 'Old Sal', freq: 104.3, tagline: 'A single perfect knob of butter, on loop.', flavor: 'Golden, uninterrupted.', vibe: ['warm carrier wave', 'no signal loss'], signal: 5, stripe: 'pink' },
  { id: 'devil', name: 'Deviled Static', host: 'Half-Egg Hal', freq: 107.9, tagline: 'Six eggs, paprika, a bit of hum.', flavor: 'Zing, then quiet.', vibe: ['brunch band', 'three-minute skip'], signal: 2, stripe: 'yellow' },
]

export const VOID_DISH: Dish = {
  id: 'void',
  name: 'THE VOID',
  host: '???',
  freq: 66.6,
  tagline: 'No dish. Only empty plates and a hum.',
  flavor: 'Nothing, but in a nice bowl.',
  vibe: ['you should not be here', 'welcome anyway'],
  signal: 1,
  stripe: 'green',
}

export const BAND_MIN = 87.5
export const BAND_MAX = 108.0
export const TICK = 0.5

export function nearestStation(freq: number, stations: Dish[]): Dish | null {
  let best: Dish | null = null
  let bestDist = Infinity
  for (const s of stations) {
    const d = Math.abs(s.freq - freq)
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return bestDist <= 0.6 ? best : null
}

export function lockKey(dish: Dish): string {
  return `static-picnic:locked:${dish.id}`
}

export interface BoardCard {
  id: string
  dishId: string
  note: string
  name: string
  freq: number
  stripe: Dish['stripe']
}

export interface Seat {
  id: string
  label: string
  occupant: string | null
  strength: number // 1-5
}

export const SEAT_IDS = ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5']