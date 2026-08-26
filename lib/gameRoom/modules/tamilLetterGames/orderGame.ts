import { shuffle } from '@/lib/gameRoom/shuffle'

export interface OrderGameData {
  tiles: string[]
}

// Generic drag-to-order board generator, shared by every Tamil letter
// set (Uyir Ezhuthukkal, Mei Ezhuthukkal, and any future set) -- the
// canonical `letters` order IS the correct answer order for that set.
export function generateOrderGame(letters: readonly string[]): OrderGameData {
  return { tiles: shuffle([...letters]) }
}

export function isCorrectAtSlot(letters: readonly string[], letter: string, slotIndex: number): boolean {
  return letters[slotIndex] === letter
}
