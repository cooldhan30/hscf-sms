// Racing's visual themes -- presentation only, zero effect on physics
// or scoring. Swapping a theme never changes how boosts/penalties work,
// which is what keeps "multiple visual themes" a pure reskin rather
// than a source of hidden gameplay differences between players who pick
// different themes (important once multiplayer racers can each choose
// their own theme and still race on a level physical footing).
export type RaceThemeId = 'chariot' | 'kite' | 'boat'

export interface RaceTheme {
  id: RaceThemeId
  name: string
  tamilName: string
  description: string
  racerEmoji: string
  trackGradientClass: string
  trackAccentClass: string
  finishEmoji: string
}

export const RACE_THEMES: RaceTheme[] = [
  {
    id: 'chariot',
    name: 'Chariot Race',
    tamilName: 'தேர் பந்தயம்',
    description: 'Race a decorated temple chariot down a festival avenue.',
    racerEmoji: '\u{1F3CE}️',
    trackGradientClass: 'from-amber-100 to-orange-200 dark:from-gamev2ink-800 dark:to-gamev2ink-900',
    trackAccentClass: 'text-orange-400/70 dark:text-gamev2ink-600',
    finishEmoji: '\u{1F3C1}',
  },
  {
    id: 'kite',
    name: 'Kite Flyer',
    tamilName: 'பட்டம் பறத்தல்',
    description: 'Send a kite soaring across an open sky track.',
    racerEmoji: '\u{1FA81}',
    trackGradientClass: 'from-sky-100 to-cyan-200 dark:from-gamev2ink-800 dark:to-gamev2ink-900',
    trackAccentClass: 'text-cyan-400/70 dark:text-gamev2ink-600',
    finishEmoji: '\u{1F3C1}',
  },
  {
    id: 'boat',
    name: 'River Boat Race',
    tamilName: 'படகு பந்தயம்',
    description: 'Paddle a river boat past palm-lined banks to the finish.',
    racerEmoji: '\u{1F6F6}',
    trackGradientClass: 'from-teal-100 to-emerald-200 dark:from-gamev2ink-800 dark:to-gamev2ink-900',
    trackAccentClass: 'text-emerald-400/70 dark:text-gamev2ink-600',
    finishEmoji: '\u{1F3C1}',
  },
]

export function getRaceTheme(id: RaceThemeId): RaceTheme {
  const t = RACE_THEMES.find((th) => th.id === id)
  if (!t) throw new Error(`Unknown race theme: ${id}`)
  return t
}
