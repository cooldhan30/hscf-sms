// Game-mechanics difficulty (enemy strength, resources). Educational
// difficulty comes from the question set itself, never from here.
export type TowerDefenseDifficulty = 'easy' | 'normal' | 'hard'

export interface DifficultySettings {
  id: TowerDefenseDifficulty
  label: string
  description: string
  startingCoins: number
  baseHealth: number
  enemyHealthMultiplier: number
  enemySpeedMultiplier: number
  waveBudgetMultiplier: number
}

export const DIFFICULTY_SETTINGS: DifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Slower, weaker enemies, more coins and a sturdier fort.',
    startingCoins: 170,
    baseHealth: 25,
    enemyHealthMultiplier: 0.7,
    enemySpeedMultiplier: 0.85,
    waveBudgetMultiplier: 0.8,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'A balanced defence -- the intended experience.',
    startingCoins: 140,
    baseHealth: 20,
    enemyHealthMultiplier: 1,
    enemySpeedMultiplier: 1,
    waveBudgetMultiplier: 1,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Tougher, faster waves and tighter coins. Every answer counts.',
    startingCoins: 120,
    baseHealth: 15,
    enemyHealthMultiplier: 1.3,
    enemySpeedMultiplier: 1.1,
    waveBudgetMultiplier: 1.2,
  },
]

export function getDifficultySettings(id: TowerDefenseDifficulty): DifficultySettings {
  const d = DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown difficulty: ${id}`)
  return d
}
