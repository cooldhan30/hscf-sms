import type { WordComplexity } from './words'
import { getCrosswordPuzzle, CROSSWORD_LEVEL_COUNT } from './crossword'

export interface LevelConfig {
  level: number
  complexity: WordComplexity
  wordsPerLevel: number
}

// Level progression -- data-driven per spec ("do not hardcode the
// entire progression into the UI"). 3 levels per complexity for the
// initial release (9 total). wordsPerLevel is read directly off each
// level's curated crossword puzzle (see crossword.ts) rather than a
// fixed number, since a real crossword's word count is however many
// words were curated to intersect for that grid (2 or 3 here), not an
// arbitrary target -- keeping this derived avoids the two ever
// drifting out of sync.
const COMPLEXITY_BY_LEVEL: WordComplexity[] = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard']

export const LEVEL_CONFIGS: LevelConfig[] = Array.from({ length: CROSSWORD_LEVEL_COUNT }, (_, i) => {
  const level = i + 1
  const puzzle = getCrosswordPuzzle(level)!
  return {
    level,
    complexity: COMPLEXITY_BY_LEVEL[i],
    wordsPerLevel: puzzle.words.length,
  }
})

export function getLevelConfig(level: number): LevelConfig | undefined {
  return LEVEL_CONFIGS.find((l) => l.level === level)
}

export function getLevelsForComplexity(complexity: WordComplexity): LevelConfig[] {
  return LEVEL_CONFIGS.filter((l) => l.complexity === complexity)
}

export const MAX_LEVEL = LEVEL_CONFIGS.length

// A level's 1-based position within its OWN complexity tier (e.g.
// level 5 is the 2nd medium level) -- this is what unlock-gating
// actually compares against, since sms_word_formation_progress tracks
// "highest unlocked" per complexity, not by the global level number.
export function levelPositionWithinComplexity(level: number): number | null {
  const config = getLevelConfig(level)
  if (!config) return null
  const sameComplexity = getLevelsForComplexity(config.complexity)
  const index = sameComplexity.findIndex((l) => l.level === level)
  return index === -1 ? null : index + 1
}
