import { shuffle } from '@/lib/gameRoom/shuffle'

export interface ClassifySortGameData {
  tiles: string[]
}

export interface Classifiable {
  letter: string
  type: string
}

// Generic drag-into-category-box board generator -- shared by every
// Tamil classification game (Kuril/Nedil's 2 boxes, Vallinam/Mellinam/
// Idaiyinam's 3 boxes, and any future N-category classification game).
// A letter's correct box is looked up from `items` by the component,
// not baked into the shuffled tile order.
export function generateClassifySortGame(items: readonly Classifiable[]): ClassifySortGameData {
  return { tiles: shuffle(items.map((i) => i.letter)) }
}

export function classifyLetter<T extends Classifiable>(items: readonly T[], letter: string): T['type'] | undefined {
  return items.find((i) => i.letter === letter)?.type
}
