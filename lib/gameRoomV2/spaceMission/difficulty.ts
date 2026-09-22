// Space Mission's Cadet/Pilot/Commander -- alters gameplay parameters
// only (thrust per correct answer, shield damage per wrong answer,
// starting shields). Question difficulty always comes from the
// selected Question Set, never touched here -- the same separation
// every V2 engine establishes (see Treasure Quest's difficulty.ts).
export type SpaceMissionDifficulty = 'cadet' | 'pilot' | 'commander'

export interface SpaceMissionDifficultySettings {
  id: SpaceMissionDifficulty
  label: string
  description: string
  thrustPerCorrectAnswer: number
  shieldDamagePerWrongAnswer: number
  startingShields: number
  maxShields: number
}

export const SPACE_MISSION_DIFFICULTY_SETTINGS: SpaceMissionDifficultySettings[] = [
  {
    id: 'cadet',
    label: 'Cadet',
    description: 'Extra thrust per correct answer, and shields barely scratch from a wrong one -- built for a first flight.',
    thrustPerCorrectAnswer: 16,
    shieldDamagePerWrongAnswer: 10,
    startingShields: 100,
    maxShields: 100,
  },
  {
    id: 'pilot',
    label: 'Pilot',
    description: 'Standard thrust and shield wear -- the default mission.',
    thrustPerCorrectAnswer: 12,
    shieldDamagePerWrongAnswer: 20,
    startingShields: 100,
    maxShields: 100,
  },
  {
    id: 'commander',
    label: 'Commander',
    description: 'Every answer counts more -- less thrust per success, more shield wear per mistake.',
    thrustPerCorrectAnswer: 9,
    shieldDamagePerWrongAnswer: 25,
    startingShields: 100,
    maxShields: 100,
  },
]

export function getSpaceMissionDifficultySettings(id: SpaceMissionDifficulty): SpaceMissionDifficultySettings {
  const d = SPACE_MISSION_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Space Mission difficulty: ${id}`)
  return d
}
