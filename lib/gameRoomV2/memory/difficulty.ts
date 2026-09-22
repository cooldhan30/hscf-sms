// Memory's Easy/Medium/Hard -- alters gameplay parameters only: how
// long a mismatched pair stays visible before flipping back down
// (longer for Easy, so younger players have more time to memorize
// positions) and the streak bonus multiplier. Question difficulty and
// pair content always come from the selected Question Set, never
// touched here -- the same separation every V2 engine establishes.
// Unlike Matching, Memory intentionally has NO round timer -- recall
// games reward careful memorization, not speed, so "timer where
// appropriate" means Memory is the case where a timer would work
// against the mechanic rather than for it.
export type MemoryDifficulty = 'easy' | 'medium' | 'hard'

export interface MemoryDifficultySettings {
  id: MemoryDifficulty
  label: string
  description: string
  mismatchRevealMs: number
  streakBonusPerStep: number
}

export const MEMORY_DIFFICULTY_SETTINGS: MemoryDifficultySettings[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Mismatched cards stay flipped a little longer, giving you extra time to remember.',
    mismatchRevealMs: 1400,
    streakBonusPerStep: 5,
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'The standard pace -- a fair beat to see a mismatch before it flips back.',
    mismatchRevealMs: 900,
    streakBonusPerStep: 8,
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Mismatched cards flip back quickly -- sharp recall pays off.',
    mismatchRevealMs: 550,
    streakBonusPerStep: 12,
  },
]

export function getMemoryDifficultySettings(id: MemoryDifficulty): MemoryDifficultySettings {
  const d = MEMORY_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Memory difficulty: ${id}`)
  return d
}
