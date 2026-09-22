// Treasure Quest's Easy/Normal/Hard -- alters gameplay parameters only
// (how many keys a correct answer earns, whether a wrong answer costs a
// key). Question difficulty always comes from the selected Question
// Set, never touched here -- the same separation every V2 engine so far
// establishes.
export type TreasureQuestDifficulty = 'easy' | 'normal' | 'hard'

export interface TreasureQuestDifficultySettings {
  id: TreasureQuestDifficulty
  label: string
  description: string
  keysPerCorrectAnswer: number
  // A wrong answer never blocks a door outright -- it costs a key IF
  // the player has one to lose, a real but recoverable setback rather
  // than a hard stop. Easy waives this entirely.
  wrongAnswerCostsKey: boolean
}

export const TREASURE_QUEST_DIFFICULTY_SETTINGS: TreasureQuestDifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Every correct answer earns 2 keys, and wrong answers never cost you one.',
    keysPerCorrectAnswer: 2,
    wrongAnswerCostsKey: false,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'One key per correct answer, and a wrong answer costs you one back -- the default experience.',
    keysPerCorrectAnswer: 1,
    wrongAnswerCostsKey: true,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Keys are scarce -- a correct answer earns a key only half the time, and wrong answers still cost one.',
    keysPerCorrectAnswer: 1,
    wrongAnswerCostsKey: true,
  },
]

// Hard's "only half the time" rule needs its own deterministic (not
// coin-flip-random) mechanism to stay testable -- see
// keysEarnedForAnswer in exploration.ts, which alternates based on the
// running correct-answer count rather than Math.random().
export const HARD_KEY_EVERY_OTHER_CORRECT_ANSWER = true

export function getTreasureQuestDifficultySettings(id: TreasureQuestDifficulty): TreasureQuestDifficultySettings {
  const d = TREASURE_QUEST_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Treasure Quest difficulty: ${id}`)
  return d
}
