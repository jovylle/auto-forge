export const MISSIVES: string[] = [
  'the flame remembers every wing',
  'dust on the glass, gold on the tongue',
  'i flew through rain to find this light',
  'wax holds what the night forgets',
  'tap twice if the dark is loud tonight',
  'a porch light in july. that is home.',
  'the moon is just a far lamp',
  'leave crumbs of light for the lost',
  'my wings are maps of every candle',
  'hum low. the flame likes company.',
  'tonight the dark tastes like honey',
  'perch a while. no one counts the hours here',
  'i traded a star for this warm glass',
  'if found, return to the nearest glow',
];

export const PHRASES: string[] = [
  'greetings, night wings',
  'the lamp is lit for you',
  'tell me of the far dark',
  'who brings dust of gold?',
  'sing the static song',
  'rest your wings, traveler',
  'what did the moon say?',
  'stay till the wax runs out',
];

export const REPLIES: string[] = [
  'prrrp. the far dark is soft tonight.',
  'i followed the smell of warm wax for miles.',
  'the moon said: blink slower.',
  'gold dust? check behind the third flame.',
  'static song goes: ksssh-ksssh-WEEEEE.',
  'my wings are tired but my heart is a lantern.',
  'the porch light misses you too.',
  'i will stay. feed me flickers.',
  'a bat sneezed near the pines. we do not speak of it.',
  'your glow is the steadiest on this street.',
  'i counted eleven stars and lost count twice.',
  'shhh. the candle is dreaming.',
];

export const NAME_A = [
  'Ash', 'Tallow', 'Soot', 'Ember', 'Dusk', 'Cinder', 'Gloam', 'Wax', 'Flicker', 'Murk',
];

export const NAME_B = [
  'wing', 'duster', 'flutter', 'gloamer', 'snout', 'powder', 'lampling', 'nightlet', 'cinderling', 'wisp',
];

export interface Species {
  name: string;
  wing: string;
  mark: string;
}

export const SPECIES: Species[] = [
  { name: 'Ember Owlet', wing: '#d9a441', mark: '#8c2b2b' },
  { name: 'Russet Sphinx', wing: '#b4552d', mark: '#3b2447' },
  { name: 'Ash Geometer', wing: '#e8d5a3', mark: '#5e1b1b' },
  { name: 'Plum Underwing', wing: '#7a4a8c', mark: '#1c0e0b' },
  { name: 'Honey Ermine', wing: '#ffe9a8', mark: '#8a5f1c' },
  { name: 'Soot Lappet', wing: '#6b4a2e', mark: '#ffe9a8' },
];

export const WAXES = ['#8c2b2b', '#b4552d', '#7a4a8c'];

export const LUNA_LINES = [
  '...the flame parts like water...',
  'LUNA: child of moon-dust, keeper of the last lamp.',
  'LUNA: you clicked with a patient heart. the night approves.',
  'LUNA: my wings are green with the envy of stars.',
];

export function pick<T>(arr: T[], n: number): T {
  return arr[n % arr.length];
}
