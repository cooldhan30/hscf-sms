// Boss Battle's Easy/Normal/Hard -- alters gameplay parameters only
// (player health, boss counterattack severity, damage-per-correct-
// answer). Question difficulty always comes from the selected Question
// Set, never touched here -- the same separation every V2 engine so far
// establishes.
export type BossBattleDifficulty = 'easy' | 'normal' | 'hard'

export interface BossBattleDifficultySettings {
  id: BossBattleDifficulty
  label: string
  description: string
  playerMaxHealth: number
  baseDamagePerCorrectAnswer: number
  chargePerCorrectAnswer: number
  // A wrong answer never damages the player directly (that's what the
  // boss's own counterattack clock is for) -- but it DOES immediately
  // trigger one counterattack early, a real but age-appropriate
  // consequence rather than a punishing double-hit.
  wrongAnswerTriggersCounterattack: boolean
  bossCounterattackMultiplier: number
}

export const BOSS_BATTLE_DIFFICULTY_SETTINGS: BossBattleDifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'More starting health and a gentler boss -- a relaxed introduction to the fight.',
    playerMaxHealth: 120,
    baseDamagePerCorrectAnswer: 22,
    chargePerCorrectAnswer: 12,
    wrongAnswerTriggersCounterattack: true,
    bossCounterattackMultiplier: 0.75,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'A balanced fight -- the default experience.',
    playerMaxHealth: 100,
    baseDamagePerCorrectAnswer: 18,
    chargePerCorrectAnswer: 10,
    wrongAnswerTriggersCounterattack: true,
    bossCounterattackMultiplier: 1,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Less starting health and a fiercer boss -- for confident challengers.',
    playerMaxHealth: 80,
    baseDamagePerCorrectAnswer: 15,
    chargePerCorrectAnswer: 8,
    wrongAnswerTriggersCounterattack: true,
    bossCounterattackMultiplier: 1.3,
  },
]

export function getBossBattleDifficultySettings(id: BossBattleDifficulty): BossBattleDifficultySettings {
  const d = BOSS_BATTLE_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Boss Battle difficulty: ${id}`)
  return d
}
