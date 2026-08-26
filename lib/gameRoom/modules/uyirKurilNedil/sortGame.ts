import { shuffle } from '@/lib/gameRoom/shuffle'
import { UYIR_KURIL_NEDIL, type KurilNedilType } from './letters'

export interface SortGameData {
  tiles: string[]
}

// A fresh shuffled tray of all 10 letters -- randomized every time a
// student starts or replays the game.
export function generateSortGame(): SortGameData {
  return { tiles: shuffle(UYIR_KURIL_NEDIL.map((l) => l.letter)) }
}

export function classify(letter: string): KurilNedilType | undefined {
  return UYIR_KURIL_NEDIL.find((l) => l.letter === letter)?.type
}
