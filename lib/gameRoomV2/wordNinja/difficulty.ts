// Word Ninja's Easy/Normal/Hard -- alters gameplay parameters only (how
// fast words fly, how many are in the air at once, the time limit for a
// round). Question difficulty/content always comes from the selected
// CATEGORIZE Question Set, never touched here.
export type WordNinjaDifficulty = 'easy' | 'normal' | 'hard'

export interface WordNinjaDifficultySettings {
  id: WordNinjaDifficulty
  label: string
  description: string
  // Milliseconds a word takes to cross the screen -- lower is faster.
  flightDurationMs: number
  // Milliseconds between one word entering and the next -- lower means
  // more words on screen at once.
  spawnIntervalMs: number
  // Slashing (or missing) a word wrong doesn't end the round -- it
  // just needs correcting before submission, since the real grading
  // happens once, server-side, on the full mapping. This only affects
  // the in-flight visual pressure, never the actual scoring rule.
  maxConcurrentWords: number
}

export const WORD_NINJA_DIFFICULTY_SETTINGS: WordNinjaDifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Words fly slowly and one at a time -- plenty of time to read each one.',
    flightDurationMs: 5200,
    spawnIntervalMs: 2200,
    maxConcurrentWords: 1,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'A steady pace with a couple of words in the air -- the default experience.',
    flightDurationMs: 4000,
    spawnIntervalMs: 1500,
    maxConcurrentWords: 2,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Fast-moving words, several in the air at once -- for quick readers.',
    flightDurationMs: 2800,
    spawnIntervalMs: 900,
    maxConcurrentWords: 3,
  },
]

export function getWordNinjaDifficultySettings(id: WordNinjaDifficulty): WordNinjaDifficultySettings {
  const d = WORD_NINJA_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Word Ninja difficulty: ${id}`)
  return d
}
