// Racing's Easy/Normal/Hard -- alters gameplay parameters only (base
// speed, boost/penalty magnitude, track length). Question difficulty
// always comes from the selected Question Set, never touched here --
// same separation Tower Defense's difficulty settings already
// establish.
export type RacingDifficulty = 'easy' | 'normal' | 'hard'

export interface RacingDifficultySettings {
  id: RacingDifficulty
  label: string
  description: string
  trackLength: number
  baseSpeed: number
  // A correct answer's boost is a speed multiplier applied for
  // boostDurationMs -- accuracy is what wins races, so this is
  // deliberately a large, satisfying jump regardless of how quickly the
  // student answered.
  boostMultiplier: number
  boostDurationMs: number
  // A wrong answer briefly slows the racer -- a real but mild
  // consequence, never a full stop and never a race-ending event.
  penaltyMultiplier: number
  penaltyDurationMs: number
}

export const RACING_DIFFICULTY_SETTINGS: RacingDifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'A shorter track and forgiving penalties -- a relaxed pace for learning the ropes.',
    trackLength: 100,
    baseSpeed: 6,
    boostMultiplier: 2.2,
    boostDurationMs: 2600,
    penaltyMultiplier: 0.85,
    penaltyDurationMs: 1200,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'A balanced race -- the default experience.',
    trackLength: 130,
    baseSpeed: 6,
    boostMultiplier: 2.5,
    boostDurationMs: 2400,
    penaltyMultiplier: 0.7,
    penaltyDurationMs: 1500,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'A longer track and steeper penalties -- accuracy matters even more here.',
    trackLength: 160,
    baseSpeed: 6,
    boostMultiplier: 2.8,
    boostDurationMs: 2200,
    penaltyMultiplier: 0.55,
    penaltyDurationMs: 1800,
  },
]

export function getRacingDifficultySettings(id: RacingDifficulty): RacingDifficultySettings {
  const d = RACING_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown racing difficulty: ${id}`)
  return d
}
