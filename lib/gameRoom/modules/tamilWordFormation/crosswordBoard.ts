import { shuffle } from '@/lib/gameRoom/shuffle'
import type { CrosswordPuzzle } from './crossword'

export interface GridCell {
  row: number
  col: number
  // The correct unit for this cell, resolved from whichever word(s)
  // cover it -- every word crossing a cell was already verified to
  // agree on the same unit there (see crossword.ts's build-time check).
  unit: string
  filled: boolean
}

export interface WheelLetter {
  unit: string
  wheelId: string
}

export function buildGridCells(puzzle: CrosswordPuzzle): GridCell[] {
  const cellMap = new Map<string, GridCell>()
  for (const w of puzzle.words) {
    for (let i = 0; i < w.units.length; i++) {
      const row = w.direction === 'down' ? w.row + i : w.row
      const col = w.direction === 'across' ? w.col + i : w.col
      const key = `${row},${col}`
      if (!cellMap.has(key)) {
        cellMap.set(key, { row, col, unit: w.units[i], filled: false })
      }
    }
  }
  return Array.from(cellMap.values())
}

// The letter wheel shows every DISTINCT unit needed across the whole
// puzzle (not per-word) -- a shared intersection unit (e.g. "ங்" used
// by both குரங்கு and சிங்கம்) only needs one wheel tile since the
// player reuses it for both words, matching how a real Wordscapes
// wheel doesn't duplicate a letter unless the target word itself
// repeats it.
export function buildWheelLetters(puzzle: CrosswordPuzzle): WheelLetter[] {
  const seen = new Map<string, number>()
  const letters: WheelLetter[] = []
  for (const w of puzzle.words) {
    for (const unit of w.units) {
      const count = seen.get(unit) ?? 0
      // Only add another copy of this unit if some word in the puzzle
      // actually needs it more than once (e.g. a double letter) --
      // otherwise the wheel is exactly the puzzle's distinct alphabet.
      const maxNeeded = Math.max(...puzzle.words.map((word) => word.units.filter((u) => u === unit).length))
      if (count < maxNeeded) {
        letters.push({ unit, wheelId: `${unit}-${count}` })
        seen.set(unit, count + 1)
      }
    }
  }
  return shuffle(letters)
}
