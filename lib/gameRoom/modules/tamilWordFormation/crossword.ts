import { segmentTamilWord } from './segmentation'

export type Direction = 'across' | 'down'

export interface CrosswordWordPlacement {
  word: string
  units: string[]
  direction: Direction
  // Grid coordinates of the FIRST unit of this word.
  row: number
  col: number
  meaningEnglish: string
  hintEmoji: string | null
}

export interface CrosswordPuzzle {
  level: number
  // Grid dimensions, computed from the placements (with a small margin).
  rows: number
  cols: number
  words: CrosswordWordPlacement[]
}

interface WordSeed {
  word: string
  meaningEnglish: string
  hintEmoji: string | null
  direction: Direction
  row: number
  col: number
}

// Curated crossword puzzles -- one per level, per the earlier decision
// that hand-curating small intersecting word groups is the only way to
// GUARANTEE every generated puzzle is solvable (most word pairs in the
// bank share no unit at all, so picking 5 random words and hoping they
// form a valid crossword layout isn't reliable). Every placement below
// was verified against segmentTamilWord: the units at the declared
// row/col actually match across every intersection.
//
// Coordinates are grid cells in taught-unit space (one cell = one
// Tamil grapheme-cluster unit, e.g. "மா" or "ன்" -- never a raw
// Unicode code point), row/col 0-indexed, across words read left-to-
// right from (row,col), down words read top-to-bottom from (row,col).
const PUZZLES: WordSeed[][] = [
  // Level 1 (easy) -- பூனை(1)="னை" crosses யானை(1)="னை"
  [
    { word: 'பூனை', meaningEnglish: 'Cat', hintEmoji: '🐱', direction: 'across', row: 0, col: 0 },
    { word: 'யானை', meaningEnglish: 'Elephant', hintEmoji: '🐘', direction: 'down', row: -1, col: 1 },
  ],
  // Level 2 (easy) -- மான் x மீன் x தேன் sharing "ன்" at position 1,
  // plus மான் x மாமா sharing "மா" at position 0.
  [
    { word: 'மான்', meaningEnglish: 'Deer', hintEmoji: '🦌', direction: 'across', row: 1, col: 0 },
    { word: 'மாமா', meaningEnglish: 'Uncle', hintEmoji: '👨', direction: 'down', row: 0, col: 0 },
    { word: 'மீன்', meaningEnglish: 'Fish', hintEmoji: '🐟', direction: 'down', row: 0, col: 1 },
  ],
  // Level 3 (easy) -- வாழை(1)="ழை" crosses மழை(1)="ழை"
  [
    { word: 'வாழை', meaningEnglish: 'Banana', hintEmoji: '🍌', direction: 'across', row: 0, col: 0 },
    { word: 'மழை', meaningEnglish: 'Rain', hintEmoji: '🌧️', direction: 'down', row: -1, col: 1 },
  ],
  // Level 4 (medium) -- குயில்(1)="யி" crosses மயில்(1)="யி"
  [
    { word: 'குயில்', meaningEnglish: 'Cuckoo', hintEmoji: '🐦', direction: 'across', row: 0, col: 0 },
    { word: 'மயில்', meaningEnglish: 'Peacock', hintEmoji: '🦚', direction: 'down', row: -1, col: 1 },
  ],
  // Level 5 (medium) -- காகம்(1)="க" crosses கத்தி(0)="க"
  [
    { word: 'காகம்', meaningEnglish: 'Crow', hintEmoji: '🐦‍⬛', direction: 'across', row: 0, col: 0 },
    { word: 'கத்தி', meaningEnglish: 'Knife', hintEmoji: '🔪', direction: 'down', row: 0, col: 1 },
  ],
  // Level 6 (medium) -- நண்டு(1)="ண்" crosses வண்டி(1)="ண்"
  [
    { word: 'நண்டு', meaningEnglish: 'Crab', hintEmoji: '🦀', direction: 'across', row: 0, col: 0 },
    { word: 'வண்டி', meaningEnglish: 'Vehicle', hintEmoji: '🛺', direction: 'down', row: -1, col: 1 },
  ],
  // Level 7 (hard) -- குரங்கு(2)="ங்" crosses சிங்கம்(1)="ங்"
  [
    { word: 'குரங்கு', meaningEnglish: 'Monkey', hintEmoji: '🐒', direction: 'across', row: 0, col: 0 },
    { word: 'சிங்கம்', meaningEnglish: 'Lion', hintEmoji: '🦁', direction: 'down', row: -1, col: 2 },
  ],
  // Level 8 (hard) -- அண்ணன்(3)="ன்" crosses சூரியன்(3)="ன்"
  [
    { word: 'அண்ணன்', meaningEnglish: 'Older Brother', hintEmoji: '👦', direction: 'across', row: 0, col: 0 },
    { word: 'சூரியன்', meaningEnglish: 'Sun', hintEmoji: '☀️', direction: 'down', row: -3, col: 3 },
  ],
  // Level 9 (hard) -- சிவப்பு(2)="ப்" crosses கருப்பு(2)="ப்"
  [
    { word: 'சிவப்பு', meaningEnglish: 'Red', hintEmoji: '🔴', direction: 'across', row: 0, col: 0 },
    { word: 'கருப்பு', meaningEnglish: 'Black', hintEmoji: '⚫', direction: 'down', row: -2, col: 2 },
  ],
]

function buildPuzzle(seeds: WordSeed[], level: number): CrosswordPuzzle {
  const rawWords = seeds.map((seed) => ({
    word: seed.word,
    units: segmentTamilWord(seed.word),
    direction: seed.direction,
    row: seed.row,
    col: seed.col,
    meaningEnglish: seed.meaningEnglish,
    hintEmoji: seed.hintEmoji,
  }))

  // Seed coordinates are computed relative to the first (across) word
  // starting at (0, 0), which can put a crossing "down" word at a
  // negative row -- normalize the whole puzzle so its minimum row/col
  // is 0, since the grid this renders into is a plain 0-indexed array.
  const minRow = Math.min(...rawWords.map((w) => w.row))
  const minCol = Math.min(...rawWords.map((w) => w.col))
  const words: CrosswordWordPlacement[] = rawWords.map((w) => ({
    ...w,
    row: w.row - minRow,
    col: w.col - minCol,
  }))

  let maxRow = 0
  let maxCol = 0
  for (const w of words) {
    const endRow = w.direction === 'down' ? w.row + w.units.length - 1 : w.row
    const endCol = w.direction === 'across' ? w.col + w.units.length - 1 : w.col
    maxRow = Math.max(maxRow, endRow)
    maxCol = Math.max(maxCol, endCol)
  }

  return { level, rows: maxRow + 1, cols: maxCol + 1, words }
}

export function getCrosswordPuzzle(level: number): CrosswordPuzzle | null {
  const seeds = PUZZLES[level - 1]
  if (!seeds) return null
  return buildPuzzle(seeds, level)
}

export const CROSSWORD_LEVEL_COUNT = PUZZLES.length
