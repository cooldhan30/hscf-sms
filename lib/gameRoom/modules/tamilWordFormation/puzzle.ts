import { shuffle } from '@/lib/gameRoom/shuffle'
import type { TamilWord, WordComplexity } from './words'
import { getWordsByComplexity } from './words'
import { getLevelConfig } from './levels'

export interface WordPuzzle {
  wordId: string
  word: string
  unitCount: number
  meaningEnglish: string
  category: string
  hintEmoji: string | null
  // The correct answer sequence -- never sent in a form the client
  // could trivially read out of order and submit, since validation of
  // the FINAL submitted sequence still happens server-side-equivalent
  // logic in the component (the target units are necessarily present
  // in gameData already, same tradeoff every other interactive game
  // here makes -- see the platform-wide "no adversarial-scoring
  // concern for a solo practice game" rationale).
  targetUnits: string[]
  // Target units + distractor units, shuffled together -- what the
  // child actually sees and taps from.
  tileUnits: string[]
}

export interface LevelPuzzleData {
  level: number
  complexity: WordComplexity
  puzzles: WordPuzzle[]
}

// Builds one word's tile set: the word's own units plus N distractor
// units drawn from OTHER words in the same complexity bucket (so a
// distractor is always a real, previously-learnable Tamil unit, never
// an arbitrary/misleading fragment) -- excludes any unit that's
// already part of the target word, so there's no ambiguity about
// which tile is "the" ங் the child needs, and the puzzle always stays
// solvable (a distractor never happens to be needed but withheld).
function buildPuzzle(word: TamilWord, distractorCount: number, pool: TamilWord[]): WordPuzzle {
  const targetUnits = word.units
  const targetUnitSet = new Set(targetUnits)

  const candidateDistractors = shuffle(
    Array.from(new Set(pool.filter((w) => w.id !== word.id).flatMap((w) => w.units))).filter(
      (unit) => !targetUnitSet.has(unit)
    )
  )
  const distractors = candidateDistractors.slice(0, distractorCount)

  return {
    wordId: word.id,
    word: word.word,
    unitCount: word.unitCount,
    meaningEnglish: word.meaningEnglish,
    category: word.category,
    hintEmoji: word.hintEmoji,
    targetUnits,
    tileUnits: shuffle([...targetUnits, ...distractors]),
  }
}

// Generates one level's full set of word puzzles -- wordsPerLevel
// words drawn (without repeats within the level) from that level's
// complexity bucket, each shuffled independently with its own
// distractor set, and the word ORDER itself shuffled too (per spec:
// "shuffle the order of target words" on every play).
export function generateLevelPuzzles(level: number): LevelPuzzleData | null {
  const config = getLevelConfig(level)
  if (!config) return null

  const pool = getWordsByComplexity(config.complexity)
  const chosen = shuffle(pool).slice(0, config.wordsPerLevel)

  return {
    level,
    complexity: config.complexity,
    puzzles: chosen.map((word) => buildPuzzle(word, config.distractorCount, pool)),
  }
}
