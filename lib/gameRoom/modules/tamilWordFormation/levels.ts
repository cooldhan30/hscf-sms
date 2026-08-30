import type { WordComplexity } from './words'

export interface LevelConfig {
  level: number
  complexity: WordComplexity
  wordsPerLevel: number
  distractorCount: number
}

// Level progression -- data-driven per spec ("do not hardcode the
// entire progression into the UI"). 3 levels per complexity for the
// initial release (9 total), each drawing 5 words from that
// complexity's word bank. distractorCount scales with complexity
// (1-2 easy, 2-3 medium, 3-4 hard), matching the spec's guidance.
export const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, complexity: 'easy', wordsPerLevel: 5, distractorCount: 1 },
  { level: 2, complexity: 'easy', wordsPerLevel: 5, distractorCount: 2 },
  { level: 3, complexity: 'easy', wordsPerLevel: 5, distractorCount: 2 },
  { level: 4, complexity: 'medium', wordsPerLevel: 5, distractorCount: 2 },
  { level: 5, complexity: 'medium', wordsPerLevel: 5, distractorCount: 3 },
  { level: 6, complexity: 'medium', wordsPerLevel: 5, distractorCount: 3 },
  { level: 7, complexity: 'hard', wordsPerLevel: 5, distractorCount: 3 },
  { level: 8, complexity: 'hard', wordsPerLevel: 5, distractorCount: 4 },
  { level: 9, complexity: 'hard', wordsPerLevel: 5, distractorCount: 4 },
]

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
