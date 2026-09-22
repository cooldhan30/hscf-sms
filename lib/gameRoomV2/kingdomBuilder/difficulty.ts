// Kingdom Builder's Settler/Builder/Architect -- alters gameplay
// parameters only (resource multiplier, whether a wrong answer costs
// any resources at all). Question difficulty always comes from the
// selected Question Set, never touched here -- the same separation
// every V2 engine establishes (see Treasure Quest/Space Mission's
// difficulty.ts).
export type KingdomBuilderDifficulty = 'settler' | 'builder' | 'architect'

export interface KingdomBuilderDifficultySettings {
  id: KingdomBuilderDifficulty
  label: string
  description: string
  resourceMultiplier: number
  wrongAnswerCostsResources: boolean
}

export const KINGDOM_BUILDER_DIFFICULTY_SETTINGS: KingdomBuilderDifficultySettings[] = [
  {
    id: 'settler',
    label: 'Settler',
    description: 'Extra resources per correct answer, and a wrong answer never costs you anything you\'ve already earned.',
    resourceMultiplier: 1.5,
    wrongAnswerCostsResources: false,
  },
  {
    id: 'builder',
    label: 'Builder',
    description: 'Standard resource rewards -- the default kingdom.',
    resourceMultiplier: 1,
    wrongAnswerCostsResources: true,
  },
  {
    id: 'architect',
    label: 'Architect',
    description: 'Resources are precious -- every answer counts more toward your kingdom\'s growth.',
    resourceMultiplier: 0.75,
    wrongAnswerCostsResources: true,
  },
]

export function getKingdomBuilderDifficultySettings(id: KingdomBuilderDifficulty): KingdomBuilderDifficultySettings {
  const d = KINGDOM_BUILDER_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Kingdom Builder difficulty: ${id}`)
  return d
}
