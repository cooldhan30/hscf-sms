import { shuffle } from '@/lib/gameRoom/shuffle'
import { UYIR_EZHUTHUKKAL } from './letters'

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

// 24 tiles -- each of the 12 letters appears exactly twice, shuffled
// into a random board layout every time a student starts or replays.
export function generateMemoryGame(): MemoryGameData {
  const pairs: MemoryTile[] = UYIR_EZHUTHUKKAL.flatMap((letter, i) => [
    { id: `${i}-a`, letter },
    { id: `${i}-b`, letter },
  ])
  return { tiles: shuffle(pairs) }
}
