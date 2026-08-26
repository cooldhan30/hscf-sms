import { shuffle } from '@/lib/gameRoom/shuffle'
import { UYIR_KURIL_NEDIL, type KurilNedilType } from './letters'

export interface KurilNedilMemoryTile {
  // Unique per tile (distinct from `letter`) -- React key/click target.
  id: string
  letter: string
  type: KurilNedilType
}

export interface KurilNedilMemoryGameData {
  tiles: KurilNedilMemoryTile[]
}

// 20 tiles -- each of the 10 letters appears exactly twice. Unlike the
// plain letter-matching memory game, two cards match here when their
// `type` (kuril/nedil) is the same, NOT when their `letter` is the
// same -- so this data intentionally keeps `type` on every tile for the
// component's match check to use directly, rather than re-deriving it.
export function generateKurilNedilMemoryGame(): KurilNedilMemoryGameData {
  const pairs: KurilNedilMemoryTile[] = UYIR_KURIL_NEDIL.flatMap(({ letter, type }, i) => [
    { id: `${i}-a`, letter, type },
    { id: `${i}-b`, letter, type },
  ])
  return { tiles: shuffle(pairs) }
}
