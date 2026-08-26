import { shuffle } from '@/lib/gameRoom/shuffle'

export interface MemoryTile {
  // Unique per tile, distinct from `letter` -- two face-up tiles showing
  // the same letter are still different objects (different board
  // positions), so this is what React keys/click-targeting use; `letter`
  // is what match-comparison uses.
  id: string
  letter: string
}

export interface MemoryGameData {
  tiles: MemoryTile[]
}

// Generic memory-board generator, shared by every Tamil letter set --
// each letter appears exactly twice, shuffled into a random layout
// every time a student starts or replays.
export function generateMemoryGame(letters: readonly string[]): MemoryGameData {
  const pairs: MemoryTile[] = letters.flatMap((letter, i) => [
    { id: `${i}-a`, letter },
    { id: `${i}-b`, letter },
  ])
  return { tiles: shuffle(pairs) }
}
