import { shuffle } from '@/lib/gameRoom/shuffle'

export interface Pair {
  left: string
  right: string
}

export interface PairMatchGameData {
  leftCards: string[]
  rightCards: string[]
}

// Generic two-column matching board generator -- left and right sides
// are shuffled INDEPENDENTLY (per spec), since showing them in the same
// shuffled order would let a child match by position instead of by
// meaning. Shared by any future left/right pairing game (Ina
// Ezhuthukkal today; e.g. a future Uyir-Mei matching game could reuse
// this the same way).
export function generatePairMatchGame(pairs: readonly Pair[]): PairMatchGameData {
  return {
    leftCards: shuffle(pairs.map((p) => p.left)),
    rightCards: shuffle(pairs.map((p) => p.right)),
  }
}

export function isMatchingPair(pairs: readonly Pair[], left: string, right: string): boolean {
  return pairs.some((p) => p.left === left && p.right === right)
}
