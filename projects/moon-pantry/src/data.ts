export const PHASES = [
  { id: 'new', name: 'New Moon', short: 'NEW MOON', blurb: 'The kitchen goes quiet. Something from nothing.' },
  { id: 'waxing-crescent', name: 'Waxing Crescent', short: 'WAX CRES', blurb: 'A sliver of appetite returns.' },
  { id: 'first-quarter', name: 'First Quarter', short: '1ST QTR', blurb: 'Half-lit and properly hungry.' },
  { id: 'waxing-gibbous', name: 'Waxing Gibbous', short: 'WAX GIB', blurb: 'Nearly full — the pot is nearly ready.' },
  { id: 'full', name: 'Full Moon', short: 'FULL MOON', blurb: 'Feast. The pantry glows.' },
  { id: 'waning-gibbous', name: 'Waning Gibbous', short: 'WAN GIB', blurb: 'Slow simmer, quiet comfort.' },
  { id: 'last-quarter', name: 'Last Quarter', short: 'LAST QTR', blurb: 'Use it up before it turns.' },
  { id: 'waning-crescent', name: 'Waning Crescent', short: 'WAN CRES', blurb: 'The last spoonful before sleep.' },
] as const

export type PhaseId = (typeof PHASES)[number]['id']

export type Accent = 'pink' | 'cyan' | 'yellow' | 'mint' | 'purple' | 'orange'

export interface Recipe {
  id: string
  name: string
  phase: PhaseId
  midnight: boolean
  minutes: number
  serves: number
  blurb: string
  accent: Accent
  ingredients: string[]
  ritual: string[]
}

export const RECIPES: Recipe[] = [
  {
    id: 'blackout-noodles', name: 'New Moon Blackout Noodles', phase: 'new', midnight: true,
    minutes: 15, serves: 1, accent: 'purple', blurb: 'One pot, one lamp, zero witnesses.',
    ingredients: ['Ramen', 'Miso', 'Garlic', 'Scallions', 'Eggs', 'Chili flakes', 'Sesame oil'],
    ritual: ['Boil', 'Whisk', 'Slurp'],
  },
  {
    id: 'silence-rice', name: 'New Moon Silence Rice', phase: 'new', midnight: true,
    minutes: 25, serves: 2, accent: 'mint', blurb: 'Rice, butter, a cracked egg, and quiet.',
    ingredients: ['Rice', 'Butter', 'Soy sauce', 'Eggs', 'Scallions', 'Sesame oil'],
    ritual: ['Rinse', 'Steam', 'Crack'],
  },
  {
    id: 'crescent-toast', name: 'Waxing Crescent Honey Toast', phase: 'waxing-crescent', midnight: false,
    minutes: 8, serves: 1, accent: 'yellow', blurb: 'A sliver of something sweet.',
    ingredients: ['Bread', 'Butter', 'Honey', 'Cinnamon', 'Banana'],
    ritual: ['Toast', 'Spread', 'Drizzle'],
  },
  {
    id: 'crescent-lemon-pasta', name: 'Waxing Crescent Lemon Pasta', phase: 'waxing-crescent', midnight: false,
    minutes: 18, serves: 2, accent: 'yellow', blurb: 'Bright, buttery, almost awake.',
    ingredients: ['Pasta', 'Lemon', 'Butter', 'Parmesan', 'Cream', 'Black pepper'],
    ritual: ['Boil', 'Zest', 'Twirl'],
  },
  {
    id: 'quarter-pancakes', name: 'First Quarter Midnight Pancakes', phase: 'first-quarter', midnight: true,
    minutes: 20, serves: 3, accent: 'pink', blurb: 'Stacked high under a half-lit sky.',
    ingredients: ['Flour', 'Milk', 'Eggs', 'Butter', 'Sugar', 'Maple syrup', 'Berries'],
    ritual: ['Whisk', 'Griddle', 'Stack'],
  },
  {
    id: 'quarter-chili', name: 'First Quarter Chili Beans', phase: 'first-quarter', midnight: false,
    minutes: 35, serves: 4, accent: 'orange', blurb: 'Half a pot is still a whole meal.',
    ingredients: ['Black beans', 'Tomatoes', 'Onion', 'Garlic', 'Cumin', 'Chili flakes', 'Tortillas', 'Cheese'],
    ritual: ['Sweat', 'Simmer', 'Scoop'],
  },
  {
    id: 'gibbous-garlic-pasta', name: 'Waxing Gibbous Garlic Butter Pasta', phase: 'waxing-gibbous', midnight: false,
    minutes: 20, serves: 2, accent: 'mint', blurb: 'Almost full, definitely garlicky.',
    ingredients: ['Pasta', 'Garlic', 'Butter', 'Parmesan', 'Chili flakes', 'Olive oil', 'Basil'],
    ritual: ['Boil', 'Sizzle', 'Toss'],
  },
  {
    id: 'waning-avocado', name: 'Waning Gibbous Avocado Toast', phase: 'waning-gibbous', midnight: false,
    minutes: 10, serves: 2, accent: 'mint', blurb: 'Smash it, crown it, eat it standing.',
    ingredients: ['Bread', 'Avocado', 'Lemon', 'Chili flakes', 'Olive oil', 'Eggs'],
    ritual: ['Toast', 'Smash', 'Crown'],
  },
  {
    id: 'full-frittata', name: 'Full Moon Feast Frittata', phase: 'full', midnight: false,
    minutes: 30, serves: 4, accent: 'orange', blurb: 'The whole pantry, glowing.',
    ingredients: ['Eggs', 'Potatoes', 'Spinach', 'Onion', 'Cheese', 'Olive oil', 'Thyme'],
    ritual: ['Sauté', 'Pour', 'Bake'],
  },
  {
    id: 'full-grilled-cheese', name: 'Full Moon Grilled Cheese', phase: 'full', midnight: true,
    minutes: 12, serves: 2, accent: 'orange', blurb: 'Butter, bread, cheese — a full moon in a pan.',
    ingredients: ['Bread', 'Butter', 'Cheese', 'Tomatoes', 'Basil'],
    ritual: ['Butter', 'Griddle', 'Pull'],
  },
  {
    id: 'waning-miso', name: 'Waning Gibbous Miso Soup', phase: 'waning-gibbous', midnight: true,
    minutes: 15, serves: 2, accent: 'cyan', blurb: 'Warm, salty, forgiving.',
    ingredients: ['Miso', 'Tofu', 'Scallions', 'Mushrooms', 'Ginger', 'Soy sauce'],
    ritual: ['Simmer', 'Dissolve', 'Ladle'],
  },
  {
    id: 'waning-oats', name: 'Full Moon Honey Oats', phase: 'full', midnight: false,
    minutes: 12, serves: 1, accent: 'cyan', blurb: 'Slow oats for a slow descent.',
    ingredients: ['Oats', 'Milk', 'Honey', 'Banana', 'Peanut butter', 'Cinnamon'],
    ritual: ['Simmer', 'Swirl', 'Spoon'],
  },
  {
    id: 'last-quarter-tomato', name: 'Last Quarter Tomato Confit', phase: 'last-quarter', midnight: false,
    minutes: 40, serves: 2, accent: 'pink', blurb: 'Use up the last of the tomatoes.',
    ingredients: ['Tomatoes', 'Garlic', 'Olive oil', 'Basil', 'Bread', 'Parmesan'],
    ritual: ['Roast', 'Mash', 'Slather'],
  },
  {
    id: 'last-quarter-quesadilla', name: 'Last Quarter Quesadilla', phase: 'last-quarter', midnight: false,
    minutes: 14, serves: 2, accent: 'pink', blurb: 'Folded, griddled, gone.',
    ingredients: ['Tortillas', 'Cheese', 'Black beans', 'Onion', 'Cilantro', 'Lime'],
    ritual: ['Griddle', 'Fold', 'Slice'],
  },
  {
    id: 'waning-cocoa', name: 'Waning Crescent Cocoa', phase: 'waning-crescent', midnight: true,
    minutes: 10, serves: 2, accent: 'purple', blurb: 'The last warm thing before sleep.',
    ingredients: ['Milk', 'Chocolate', 'Sugar', 'Cinnamon', 'Vanilla', 'Cream'],
    ritual: ['Warm', 'Whisk', 'Sip'],
  },
  {
    id: 'waning-yogurt', name: 'Waning Crescent Berry Yogurt', phase: 'waning-crescent', midnight: false,
    minutes: 5, serves: 1, accent: 'purple', blurb: 'Layer it like the sky is closing.',
    ingredients: ['Yogurt', 'Berries', 'Honey', 'Oats', 'Vanilla'],
    ritual: ['Layer', 'Crunch', 'Chill'],
  },
]

export const ALL_INGREDIENTS: string[] = Array.from(
  new Set(RECIPES.flatMap((r) => r.ingredients)),
).sort((a, b) => a.localeCompare(b))

export const BASICS = [
  'Eggs', 'Butter', 'Flour', 'Milk', 'Sugar', 'Olive oil',
  'Garlic', 'Onion', 'Pasta', 'Rice', 'Bread', 'Cheese', 'Salt',
]
