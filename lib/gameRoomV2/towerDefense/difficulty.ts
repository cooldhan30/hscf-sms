// Tower Defense's Easy/Normal/Hard setting -- alters GAMEPLAY parameters
// only (enemy speed/health, starting resources, wave size). Question
// difficulty always comes from the selected Question Set and is never
// touched here, per the spec's explicit "do NOT secretly make
// educational questions harder" instruction.
export type TowerDefenseDifficulty = 'easy' | 'normal' | 'hard'

export interface DifficultySettings {
  id: TowerDefenseDifficulty
  label: string
  description: string
  startingCoins: number
  startingLives: number
  enemyHealthMultiplier: number
  enemySpeedMultiplier: number
  enemiesPerWave: number
  // Enemies advance on a fixed clock; a wrong answer also nudges every
  // enemy forward once as the "meaningful but age-appropriate
  // consequence" -- this multiplier scales how big that nudge is.
  wrongAnswerPushback: number
}

export const DIFFICULTY_SETTINGS: DifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Slower enemies, more starting coins -- a relaxed pace for learning the ropes.',
    startingCoins: 120,
    startingLives: 5,
    enemyHealthMultiplier: 0.8,
    enemySpeedMultiplier: 0.75,
    enemiesPerWave: 5,
    wrongAnswerPushback: 0.06,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'A balanced challenge -- the default experience.',
    startingCoins: 90,
    startingLives: 4,
    enemyHealthMultiplier: 1,
    enemySpeedMultiplier: 1,
    enemiesPerWave: 6,
    wrongAnswerPushback: 0.09,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Faster, tougher enemies and tighter resources -- for confident defenders.',
    startingCoins: 70,
    startingLives: 3,
    enemyHealthMultiplier: 1.3,
    enemySpeedMultiplier: 1.25,
    enemiesPerWave: 8,
    wrongAnswerPushback: 0.13,
  },
]

export function getDifficultySettings(id: TowerDefenseDifficulty): DifficultySettings {
  const d = DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown difficulty: ${id}`)
  return d
}
