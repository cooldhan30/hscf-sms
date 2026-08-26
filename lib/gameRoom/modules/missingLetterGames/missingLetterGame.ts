import { shuffle } from '@/lib/gameRoom/shuffle'

export interface SequenceSlot {
  letter: string
  missing: boolean
}

export interface MissingLetterGameData {
  sequence: SequenceSlot[]
  sourceLetters: string[]
}

// Generic "missing letter" board generator -- shared by any Tamil
// sequence-recall game (Uyir Ezhuthukkal, Mei Ezhuthukkal, and any
// future ordered letter set). `sequence` is the canonical order with a
// random subset of positions marked missing; `sourceLetters` is the
// FULL set shuffled (not just the missing ones), per the explicit
// requirement that a child must recognize the right letter out of the
// complete set, not just from a pre-filtered pool of answers.
export function generateMissingLetterGame(
  correctOrder: readonly string[],
  missingCount: number
): MissingLetterGameData {
  const indices = shuffle(correctOrder.map((_, i) => i)).slice(0, missingCount)
  const missingSet = new Set(indices)

  const sequence: SequenceSlot[] = correctOrder.map((letter, i) => ({
    letter,
    missing: missingSet.has(i),
  }))

  return {
    sequence,
    sourceLetters: shuffle([...correctOrder]),
  }
}
