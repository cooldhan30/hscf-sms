import { shuffle } from '@/lib/gameRoom/shuffle'
import { UYIR_EZHUTHUKKAL } from './letters'

export interface OrderGameData {
  tiles: string[]
}

// A fresh shuffled tray of all 12 letters -- randomized every time a
// student starts or replays the game. The reused Fisher-Yates shuffle()
// (lib/gameRoom/shuffle.ts) is the same unbiased shuffle the quiz engine
// uses for question-set selection.
export function generateOrderGame(): OrderGameData {
  return { tiles: shuffle([...UYIR_EZHUTHUKKAL]) }
}

// The target order is always the canonical Uyir Ezhuthukkal sequence --
// a tile is correct in a slot iff it matches this array at that index.
export function isCorrectAtSlot(letter: string, slotIndex: number): boolean {
  return UYIR_EZHUTHUKKAL[slotIndex] === letter
}
